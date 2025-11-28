import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { OrderStatus } from '../types';

export const createOrder = async (req: Request, res: Response) => {
  const {
    order_id: externalOrderId,
    customer_id,
    order_date,
    gross_amount,
    discount,
    gateway_charges,
    net_amount,
    items
  } = req.body;

  if (!externalOrderId || !order_date || !gross_amount || !net_amount || !items) {
    throw new AppError('Missing required fields', 400);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Calculate total COGS
    const totalCogs = items.reduce((sum: number, item: any) => sum + (item.cogs || 0), 0);

    // Create order
    const orderResult = await client.query(
      `INSERT INTO orders (
        external_order_id, customer_id, order_date,
        gross_amount, discount_amount, gateway_charges, net_amount, cogs
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING order_id`,
      [externalOrderId, customer_id, order_date, gross_amount, discount || 0, gateway_charges || 0, net_amount, totalCogs]
    );

    const orderId = orderResult.rows[0].order_id;

    // Create order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, sku, quantity, price, cogs)
         VALUES ($1, $2, $3, $4, $5)`,
        [orderId, item.sku, item.quantity, item.price, item.cogs || 0]
      );
    }

    // Create journal entry for revenue
    const journalResult = await client.query(
      `INSERT INTO journal_entries (
        entry_date, reference_type, reference_id, description,
        total_debit, total_credit, status
      ) VALUES ($1, 'ORDER', $2, $3, $4, $4, 'POSTED')
      RETURNING journal_id`,
      [order_date, orderId, `Order: ${externalOrderId}`, gross_amount]
    );

    const journalId = journalResult.rows[0].journal_id;

    // Get account IDs
    const accounts = await client.query(`
      SELECT account_code, account_id FROM accounts
      WHERE account_code IN ('1100', '4000', '4020', '4030')
    `);

    const accountMap = new Map(accounts.rows.map(row => [row.account_code, row.account_id]));

    // DR: Accounts Receivable (net amount)
    await client.query(
      `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
       VALUES ($1, $2, $3, 0)`,
      [journalId, accountMap.get('1100'), net_amount]
    );

    // DR: Gateway Charges (if any)
    if (gateway_charges && gateway_charges > 0) {
      await client.query(
        `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
         VALUES ($1, $2, $3, 0)`,
        [journalId, accountMap.get('4030'), gateway_charges]
      );
    }

    // DR: Discounts (if any)
    if (discount && discount > 0) {
      await client.query(
        `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
         VALUES ($1, $2, $3, 0)`,
        [journalId, accountMap.get('4020'), discount]
      );
    }

    // CR: Revenue
    await client.query(
      `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
       VALUES ($1, $2, 0, $3)`,
      [journalId, accountMap.get('4000'), gross_amount]
    );

    // Record COGS if available
    if (totalCogs > 0) {
      const cogsAccounts = await client.query(`
        SELECT account_code, account_id FROM accounts
        WHERE account_code IN ('5000', '1300')
      `);

      const cogsMap = new Map(cogsAccounts.rows.map(row => [row.account_code, row.account_id]));

      // DR: COGS
      await client.query(
        `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
         VALUES ($1, $2, $3, 0)`,
        [journalId, cogsMap.get('5000'), totalCogs]
      );

      // CR: Inventory
      await client.query(
        `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
         VALUES ($1, $2, 0, $3)`,
        [journalId, cogsMap.get('1300'), totalCogs]
      );
    }

    // Update order with journal_id
    await client.query(
      'UPDATE orders SET journal_id = $1, status = $2 WHERE order_id = $3',
      [journalId, OrderStatus.SYNCED, orderId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        order_id: orderId,
        journal_id: journalId
      },
      message: 'Order recorded successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Order creation error:', error);
    throw new AppError('Failed to create order', 500);
  } finally {
    client.release();
  }
};

export const createSettlement = async (req: Request, res: Response) => {
  const {
    settlement_id: externalSettlementId,
    settlement_date,
    amount,
    orders: orderIds
  } = req.body;

  if (!externalSettlementId || !settlement_date || !amount) {
    throw new AppError('Missing required fields', 400);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Create settlement
    const settlementResult = await client.query(
      `INSERT INTO settlements (external_settlement_id, settlement_date, amount)
       VALUES ($1, $2, $3)
       RETURNING settlement_id`,
      [externalSettlementId, settlement_date, amount]
    );

    const settlementId = settlementResult.rows[0].settlement_id;

    // Link orders to settlement
    if (orderIds && orderIds.length > 0) {
      for (const extOrderId of orderIds) {
        const orderResult = await client.query(
          'SELECT order_id FROM orders WHERE external_order_id = $1',
          [extOrderId]
        );

        if (orderResult.rows.length > 0) {
          await client.query(
            'INSERT INTO settlement_orders (settlement_id, order_id) VALUES ($1, $2)',
            [settlementId, orderResult.rows[0].order_id]
          );
        }
      }
    }

    // Create journal entry
    const journalResult = await client.query(
      `INSERT INTO journal_entries (
        entry_date, reference_type, reference_id, description,
        total_debit, total_credit, status
      ) VALUES ($1, 'SETTLEMENT', $2, $3, $4, $4, 'POSTED')
      RETURNING journal_id`,
      [settlement_date, settlementId, `Settlement: ${externalSettlementId}`, amount]
    );

    const journalId = journalResult.rows[0].journal_id;

    // Get account IDs
    const accounts = await client.query(`
      SELECT account_code, account_id FROM accounts
      WHERE account_code IN ('1000', '1100')
    `);

    const accountMap = new Map(accounts.rows.map(row => [row.account_code, row.account_id]));

    // DR: Bank Account
    await client.query(
      `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
       VALUES ($1, $2, $3, 0)`,
      [journalId, accountMap.get('1000'), amount]
    );

    // CR: Accounts Receivable
    await client.query(
      `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount)
       VALUES ($1, $2, 0, $3)`,
      [journalId, accountMap.get('1100'), amount]
    );

    // Update settlement with journal_id
    await client.query(
      'UPDATE settlements SET journal_id = $1 WHERE settlement_id = $2',
      [journalId, settlementId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: {
        settlement_id: settlementId,
        journal_id: journalId
      },
      message: 'Settlement recorded successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
