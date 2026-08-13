import { Request, Response } from 'express';
import { pool } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const getProfitAndLoss = async (req: Request, res: Response) => {
  const { start_date, end_date } = req.query;

  if (!start_date || !end_date) {
    throw new AppError('start_date and end_date are required', 400);
  }

  const result = await pool.query(`
    WITH account_balances AS (
      SELECT
        a.account_code,
        a.account_name,
        a.account_type,
        SUM(jel.credit_amount - jel.debit_amount) as balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.journal_id = je.journal_id
      WHERE je.status = 'POSTED'
        AND je.entry_date >= $1
        AND je.entry_date <= $2
        AND a.account_type IN ('REVENUE', 'EXPENSE')
      GROUP BY a.account_id, a.account_code, a.account_name, a.account_type
    )
    SELECT * FROM account_balances
    ORDER BY account_code
  `, [start_date, end_date]);

  const accounts = result.rows;

  // Calculate metrics
  const revenue = accounts
    .filter(a => a.account_type === 'REVENUE' && a.account_code === '4000')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0);

  const returns = Math.abs(accounts
    .filter(a => a.account_code === '4010')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0));

  const discounts = Math.abs(accounts
    .filter(a => a.account_code === '4020')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0));

  const gatewayCharges = Math.abs(accounts
    .filter(a => a.account_code === '4030')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0));

  const netRevenue = revenue - returns - discounts;

  const cogsAccounts = accounts
    .filter(a => a.account_type === 'EXPENSE' && a.account_code.startsWith('5'))
    .map(a => ({ ...a, balance: Math.abs(parseFloat(a.balance)) }));

  const cogs = cogsAccounts.reduce((sum, a) => sum + a.balance, 0);
  const grossProfit = netRevenue - cogs;
  const grossMargin = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;

  const fulfillmentAccounts = accounts
    .filter(a => ['6000', '6010'].includes(a.account_code))
    .map(a => ({ ...a, balance: Math.abs(parseFloat(a.balance)) }));

  const variableExpenses = fulfillmentAccounts.reduce((sum, a) => sum + a.balance, 0) + gatewayCharges;
  const contributionMargin = grossProfit - variableExpenses;
  const contributionMarginPct = netRevenue > 0 ? (contributionMargin / netRevenue) * 100 : 0;

  const marketingAccounts = accounts
    .filter(a => {
      const code = parseInt(a.account_code);
      return code >= 6020 && code <= 6050;
    })
    .map(a => ({ ...a, balance: Math.abs(parseFloat(a.balance)) }));

  const marketingExpenses = marketingAccounts.reduce((sum, a) => sum + a.balance, 0);

  const operationsAccounts = accounts
    .filter(a => parseInt(a.account_code) >= 6100)
    .map(a => ({ ...a, balance: Math.abs(parseFloat(a.balance)) }));

  const fixedExpenses = operationsAccounts.reduce((sum, a) => sum + a.balance, 0);
  const operatingExpenses = marketingExpenses + fixedExpenses;
  const operatingProfit = contributionMargin - operatingExpenses;
  const operatingMargin = netRevenue > 0 ? (operatingProfit / netRevenue) * 100 : 0;

  // Get order metrics
  const orderMetrics = await pool.query(`
    SELECT
      COUNT(*) as order_count,
      AVG(net_amount) as avg_order_value
    FROM orders
    WHERE order_date >= $1 AND order_date <= $2
      AND status != 'RETURNED'
  `, [start_date, end_date]);

  const orders = parseInt(orderMetrics.rows[0]?.order_count || '0');
  const aov = parseFloat(orderMetrics.rows[0]?.avg_order_value || '0');
  const blendedCAC = orders > 0 ? marketingExpenses / orders : 0;
  const mer = marketingExpenses > 0 ? netRevenue / marketingExpenses : 0;

  res.json({
    success: true,
    data: {
      period: {
        start_date,
        end_date
      },
      summary: {
        gross_revenue: revenue,
        returns,
        discounts,
        net_revenue: netRevenue,
        cogs,
        gross_profit: grossProfit,
        gross_margin: grossMargin,
        variable_expenses: variableExpenses,
        contribution_margin: contributionMargin,
        contribution_margin_pct: contributionMarginPct,
        operating_expenses: operatingExpenses,
        marketing_expenses: marketingExpenses,
        fixed_expenses: fixedExpenses,
        operating_profit: operatingProfit,
        operating_margin: operatingMargin
      },
      d2c_metrics: {
        orders,
        aov: Math.round(aov),
        blended_cac: Math.round(blendedCAC),
        mer: mer.toFixed(2),
        gross_margin_per_order: orders > 0 ? Math.round(grossProfit / orders) : 0,
        contribution_margin_per_order: orders > 0 ? Math.round(contributionMargin / orders) : 0
      },
      breakdown: {
        cogs: cogsAccounts,
        fulfillment: fulfillmentAccounts,
        marketing: marketingAccounts,
        operations: operationsAccounts,
      }
    }
  });
};

export const getBalanceSheet = async (req: Request, res: Response) => {
  const { as_of_date } = req.query;

  if (!as_of_date) {
    throw new AppError('as_of_date is required', 400);
  }

  const result = await pool.query(`
    WITH account_balances AS (
      SELECT
        a.account_code,
        a.account_name,
        a.account_type,
        CASE
          WHEN a.account_type IN ('ASSET', 'EXPENSE') THEN
            SUM(jel.debit_amount - jel.credit_amount)
          ELSE
            SUM(jel.credit_amount - jel.debit_amount)
        END as balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.journal_id = je.journal_id
      WHERE je.status = 'POSTED'
        AND je.entry_date <= $1
        AND a.account_type IN ('ASSET', 'LIABILITY', 'EQUITY')
      GROUP BY a.account_id, a.account_code, a.account_name, a.account_type
    )
    SELECT * FROM account_balances
    WHERE balance != 0
    ORDER BY account_code
  `, [as_of_date]);

  const accounts = result.rows;

  const assets = accounts
    .filter(a => a.account_type === 'ASSET')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0);

  const liabilities = accounts
    .filter(a => a.account_type === 'LIABILITY')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0);

  const equity = accounts
    .filter(a => a.account_type === 'EQUITY')
    .reduce((sum, a) => sum + parseFloat(a.balance), 0);

  res.json({
    success: true,
    data: {
      as_of_date,
      summary: {
        total_assets: assets,
        total_liabilities: liabilities,
        total_equity: equity
      },
      accounts: {
        assets: accounts.filter(a => a.account_type === 'ASSET'),
        liabilities: accounts.filter(a => a.account_type === 'LIABILITY'),
        equity: accounts.filter(a => a.account_type === 'EQUITY')
      }
    }
  });
};

export const getDashboard = async (req: Request, res: Response) => {
  const today = new Date().toISOString().split('T')[0];

  // Today's metrics
  const todayMetrics = await pool.query(`
    SELECT
      COUNT(*) as order_count,
      COALESCE(SUM(net_amount), 0) as revenue,
      COALESCE(AVG(net_amount), 0) as avg_order_value
    FROM orders
    WHERE order_date = $1
  `, [today]);

  // This month's metrics
  const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

  const monthMetrics = await pool.query(`
    SELECT
      COALESCE(SUM(net_amount), 0) as revenue,
      COALESCE(SUM(cogs), 0) as cogs,
      COUNT(*) as orders
    FROM orders
    WHERE order_date >= $1
  `, [firstDayOfMonth]);

  const monthRevenue = parseFloat(monthMetrics.rows[0]?.revenue || '0');
  const monthCogs = parseFloat(monthMetrics.rows[0]?.cogs || '0');
  const monthMargin = monthRevenue > 0 ? ((monthRevenue - monthCogs) / monthRevenue) * 100 : 0;

  // Pending bills
  const pendingBills = await pool.query(`
    SELECT bill_id, bill_number, total_amount, due_date, vendor_id
    FROM bills
    WHERE status IN ('PENDING', 'POSTED')
      AND due_date IS NOT NULL
    ORDER BY due_date ASC
    LIMIT 5
  `);

  res.json({
    success: true,
    data: {
      today: {
        revenue: parseFloat(todayMetrics.rows[0]?.revenue || '0'),
        orders: parseInt(todayMetrics.rows[0]?.order_count || '0'),
        aov: parseFloat(todayMetrics.rows[0]?.avg_order_value || '0')
      },
      this_month: {
        revenue: monthRevenue,
        cogs: monthCogs,
        gross_margin: monthMargin,
        orders: parseInt(monthMetrics.rows[0]?.orders || '0')
      },
      pending_bills: pendingBills.rows
    }
  });
};

export const getSpendByCategory = async (req: Request, res: Response) => {
  const { start_date, end_date } = req.query;
  if (!start_date || !end_date) throw new AppError('start_date and end_date are required', 400);

  const result = await pool.query(`
    SELECT
      b.category,
      b.expense_type,
      COUNT(*) as bill_count,
      SUM(b.total_amount) as total_amount,
      AVG(b.total_amount) as avg_amount
    FROM bills b
    WHERE b.bill_date >= $1 AND b.bill_date <= $2
      AND b.status != 'CANCELLED'
    GROUP BY b.category, b.expense_type
    ORDER BY total_amount DESC
  `, [start_date, end_date]);

  const totalSpend = result.rows.reduce((s, r) => s + parseFloat(r.total_amount), 0);

  res.json({
    success: true,
    data: {
      period: { start_date, end_date },
      total_spend: totalSpend,
      categories: result.rows.map(r => ({
        category: r.category || 'Uncategorised',
        expense_type: r.expense_type,
        bill_count: parseInt(r.bill_count),
        total_amount: parseFloat(r.total_amount),
        avg_amount: parseFloat(r.avg_amount),
        pct_of_total: totalSpend > 0 ? (parseFloat(r.total_amount) / totalSpend * 100) : 0,
      })),
    }
  });
};

export const getMonthlyTrend = async (req: Request, res: Response) => {
  const { months = 6 } = req.query;
  const n = Math.min(parseInt(months as string) || 6, 24);

  const result = await pool.query(`
    SELECT
      TO_CHAR(o.order_date, 'YYYY-MM') as month,
      COALESCE(SUM(o.net_amount), 0) as revenue,
      COALESCE(SUM(o.cogs), 0) as cogs,
      COUNT(o.order_id) as orders
    FROM orders o
    WHERE o.order_date >= NOW() - INTERVAL '1 month' * $1
      AND o.status != 'RETURNED'
    GROUP BY 1
    ORDER BY 1
  `, [n]);

  const spendResult = await pool.query(`
    SELECT
      TO_CHAR(b.bill_date, 'YYYY-MM') as month,
      SUM(b.total_amount) as total_spend
    FROM bills b
    WHERE b.bill_date >= NOW() - INTERVAL '1 month' * $1
      AND b.status != 'CANCELLED'
    GROUP BY 1
    ORDER BY 1
  `, [n]);

  const spendMap: Record<string, number> = {};
  spendResult.rows.forEach(r => { spendMap[r.month] = parseFloat(r.total_spend); });

  res.json({
    success: true,
    data: {
      months: result.rows.map(r => ({
        month: r.month,
        revenue: parseFloat(r.revenue),
        cogs: parseFloat(r.cogs),
        gross_profit: parseFloat(r.revenue) - parseFloat(r.cogs),
        orders: parseInt(r.orders),
        spend: spendMap[r.month] || 0,
      })),
    }
  });
};
