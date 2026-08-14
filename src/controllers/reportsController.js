const pool = require('../config/database');
const { normalizeCategory, channelAccountCode } = require('../utils/categoryMap');
const { getContributionMarginData } = require('../services/skuCostService');
const { getUnitEconomicsData } = require('../services/unitEconomicsService');
const { getGarmentEconomics } = require('../services/garmentEconomicsService');

const BILL_DATE_SQL = `COALESCE(b.bill_date, b.created_at::date, d.uploaded_at::date)`;
const ACTIVE_BILL_FILTER = `
  COALESCE(b.total_amount, 0) > 0
  AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')
  AND COALESCE(d.status, 'uploaded') <> 'deleted'
`;

// Get Profit & Loss Statement — Management P&L format
// Gross Sales → Net Sales → COGS → Gross Profit → CM1 → CM2 → EBITDA
async function getProfitLoss(req, res) {
  try {
    const { start_date, end_date, section, drop_name } = req.query;

    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate   = end_date   || new Date().toISOString().split('T')[0];

    // ── REVENUE ──────────────────────────────────────────────────────────────
    const salesParams = [startDate, endDate];
    let salesWhere = 'entry_date BETWEEN $1 AND $2';
    if (section) { salesParams.push(section); salesWhere += ` AND section = $${salesParams.length}`; }
    if (drop_name) {
      salesParams.push(drop_name);
      salesWhere += ` AND drop_id IN (SELECT drop_id FROM drops WHERE drop_name = $${salesParams.length})`;
    }

    const salesAgg = await pool.query(
      `SELECT
         channel,
         SUM(gross_sales)    AS gross_sales,
         SUM(returns_amount) AS returns_amount,
         SUM(net_sales)      AS net_sales,
         SUM(gross_units)    AS gross_units,
         SUM(returned_units) AS returned_units,
         SUM(marketplace_commission)    AS marketplace_commission,
         SUM(payment_gateway_charges)   AS payment_gateway_charges,
         SUM(shipping_collected)        AS shipping_collected,
         SUM(cgst_collected + sgst_collected + igst_collected) AS gst_collected
       FROM sales_entries
       WHERE ${salesWhere}
       GROUP BY channel
       ORDER BY net_sales DESC`,
      salesParams
    );

    let grossSalesTotal = 0, returnsTotal = 0, netSalesTotal = 0;
    let marketplaceCommTotal = 0, gatewayTotal = 0, shippingCollectedTotal = 0;
    let gstCollectedTotal = 0;
    const revenueByChannel = [];

    salesAgg.rows.forEach(row => {
      const gs = parseFloat(row.gross_sales || 0);
      const ret = parseFloat(row.returns_amount || 0);
      const net = parseFloat(row.net_sales || 0);
      grossSalesTotal += gs;
      returnsTotal    += ret;
      netSalesTotal   += net;
      marketplaceCommTotal   += parseFloat(row.marketplace_commission || 0);
      gatewayTotal           += parseFloat(row.payment_gateway_charges || 0);
      shippingCollectedTotal += parseFloat(row.shipping_collected || 0);
      gstCollectedTotal      += parseFloat(row.gst_collected || 0);
      revenueByChannel.push({
        channel: row.channel,
        account_code: channelAccountCode(row.channel),
        gross_sales: gs,
        returns: ret,
        net_sales: net,
        units: parseInt(row.gross_units || 0),
        returned_units: parseInt(row.returned_units || 0),
        marketplace_commission: parseFloat(row.marketplace_commission || 0),
        payment_gateway: parseFloat(row.payment_gateway_charges || 0),
        gst_collected: parseFloat(row.gst_collected || 0)
      });
    });

    // ── BILLS — split by management category ─────────────────────────────────
    const billParams = [startDate, endDate];
    let billExtra = '';
    if (section) { billParams.push(section); billExtra += ` AND b.section = $${billParams.length}`; }
    if (drop_name) { billParams.push(drop_name); billExtra += ` AND b.drop_name = $${billParams.length}`; }

    const billAgg = await pool.query(
      `SELECT
         COALESCE(b.category_group, 'OPERATIONS') AS category_group,
         COALESCE(b.category, 'misc')              AS category,
         SUM(b.total_amount)                       AS total,
         COUNT(*)                                  AS bill_count
       FROM bills b
       LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
         AND ${ACTIVE_BILL_FILTER}${billExtra}
       GROUP BY b.category_group, b.category`,
      billParams
    );

    let cogsTotal = 0, fulfilmentTotal = 0, marketingTotal = 0, opexTotal = 0;
    const cogsLines = [], fulfilmentLines = [], marketingLines = [], opexLines = [];

    billAgg.rows.forEach(row => {
      const grp = (row.category_group || 'OPERATIONS').toUpperCase();
      const cat = (row.category || 'misc').toLowerCase();
      const amt = parseFloat(row.total || 0);
      const cnt = parseInt(row.bill_count || 0);
      const label = cat.replace(/_/g, ' ');

      if (grp === 'COGS') {
        cogsTotal += amt;
        cogsLines.push({ category: label, amount: amt, bill_count: cnt });
      } else if (grp === 'FULFILLMENT') {
        fulfilmentTotal += amt;
        fulfilmentLines.push({ category: label, amount: amt, bill_count: cnt });
      } else if (grp === 'MARKETING') {
        marketingTotal += amt;
        marketingLines.push({ category: label, amount: amt, bill_count: cnt });
      } else {
        opexTotal += amt;
        opexLines.push({ category: label, amount: amt, bill_count: cnt });
      }
    });

    // ── INPUT TAX CREDIT from bills ───────────────────────────────────────────
    const itcRow = await pool.query(
      `SELECT
         COALESCE(SUM(b.cgst_amount), 0) AS cgst_itc,
         COALESCE(SUM(b.sgst_amount), 0) AS sgst_itc,
         COALESCE(SUM(b.igst_amount), 0) AS igst_itc
       FROM bills b
       LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
         AND ${ACTIVE_BILL_FILTER}${billExtra}`,
      billParams
    );
    const cgstItc = parseFloat(itcRow.rows[0]?.cgst_itc || 0);
    const sgstItc = parseFloat(itcRow.rows[0]?.sgst_itc || 0);
    const igstItc = parseFloat(itcRow.rows[0]?.igst_itc || 0);
    const totalItc = cgstItc + sgstItc + igstItc;

    // ── MANAGEMENT P&L WATERFALL ──────────────────────────────────────────────
    const grossProfit    = netSalesTotal - cogsTotal;
    const grossMarginPct = netSalesTotal ? (grossProfit / netSalesTotal * 100) : 0;

    // CM1 = Gross Profit - Fulfilment (logistics, commissions, gateway)
    // Also include marketplace_commission and gateway from sales_entries
    const totalFulfilment = fulfilmentTotal + marketplaceCommTotal + gatewayTotal;
    const cm1 = grossProfit - totalFulfilment;
    const cm1Pct = netSalesTotal ? (cm1 / netSalesTotal * 100) : 0;

    // CM2 = CM1 - Marketing / CAC spend
    const cm2 = cm1 - marketingTotal;
    const cm2Pct = netSalesTotal ? (cm2 / netSalesTotal * 100) : 0;

    // EBITDA = CM2 - Operating expenses
    const ebitda    = cm2 - opexTotal;
    const ebitdaPct = netSalesTotal ? (ebitda / netSalesTotal * 100) : 0;

    // Section-level breakdown (if no section filter applied)
    let sectionBreakdown = null;
    if (!section) {
      const secSales = await pool.query(
        `SELECT section, SUM(net_sales) AS net_sales, SUM(gross_units - returned_units) AS net_units
         FROM sales_entries WHERE entry_date BETWEEN $1 AND $2 AND section IS NOT NULL
         GROUP BY section ORDER BY net_sales DESC`,
        [startDate, endDate]
      );
      const secBills = await pool.query(
        `SELECT section, category_group, SUM(total_amount) AS total
         FROM bills b LEFT JOIN documents d ON b.document_id = d.document_id
         WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
           AND ${ACTIVE_BILL_FILTER}
           AND b.section IS NOT NULL
           AND b.category_group IN ('COGS', 'FULFILLMENT')
         GROUP BY section, category_group`,
        [startDate, endDate]
      );
      const secMap = {};
      secSales.rows.forEach(r => {
        secMap[r.section] = { section: r.section, net_sales: parseFloat(r.net_sales || 0), net_units: parseInt(r.net_units || 0), cogs: 0, fulfillment: 0 };
      });
      secBills.rows.forEach(r => {
        if (!secMap[r.section]) return;
        const grp = (r.category_group || '').toUpperCase();
        if (grp === 'COGS') secMap[r.section].cogs += parseFloat(r.total || 0);
        else if (grp === 'FULFILLMENT') secMap[r.section].fulfillment += parseFloat(r.total || 0);
      });
      sectionBreakdown = Object.values(secMap).map(s => {
        const gp  = s.net_sales - s.cogs;
        const cm1 = gp - s.fulfillment;
        return {
          ...s,
          gross_profit:      gp,
          gross_margin_pct:  s.net_sales ? parseFloat((gp  / s.net_sales * 100).toFixed(1)) : 0,
          cm1,
          cm1_pct:           s.net_sales ? parseFloat((cm1 / s.net_sales * 100).toFixed(1)) : 0,
        };
      });
    }

    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      filters: { section: section || null, drop_name: drop_name || null },

      // Revenue
      gross_sales: grossSalesTotal,
      returns: returnsTotal,
      net_sales: netSalesTotal,
      revenue_by_channel: revenueByChannel,
      gst_collected: gstCollectedTotal,

      // GST / ITC
      itc: { cgst: cgstItc, sgst: sgstItc, igst: igstItc, total: totalItc },
      net_gst_payable: Math.max(0, gstCollectedTotal - totalItc),

      // COGS
      cogs: { lines: cogsLines, total: cogsTotal },

      // Waterfall
      gross_profit: grossProfit,
      gross_margin_pct: parseFloat(grossMarginPct.toFixed(1)),

      fulfilment: {
        lines: fulfilmentLines,
        marketplace_commission: marketplaceCommTotal,
        payment_gateway: gatewayTotal,
        total: totalFulfilment
      },
      cm1: cm1,
      cm1_pct: parseFloat(cm1Pct.toFixed(1)),

      marketing: { lines: marketingLines, total: marketingTotal },
      cm2: cm2,
      cm2_pct: parseFloat(cm2Pct.toFixed(1)),

      opex: { lines: opexLines, total: opexTotal },
      ebitda: ebitda,
      ebitda_pct: parseFloat(ebitdaPct.toFixed(1)),

      // Section breakdown (when no section filter)
      section_breakdown: sectionBreakdown
    });

  } catch (error) {
    console.error('P&L error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get Trial Balance
async function getTrialBalance(req, res) {
  try {
    const { as_of_date } = req.query;
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0];
    
    const result = await pool.query(`
      SELECT 
        a.account_code,
        a.account_name,
        a.account_type,
        COALESCE(SUM(jel.debit_amount), 0) as total_debit,
        COALESCE(SUM(jel.credit_amount), 0) as total_credit,
        COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as balance
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON a.account_id = jel.account_id
      LEFT JOIN journal_entries je ON jel.journal_id = je.journal_id
      WHERE je.entry_date <= $1 OR je.entry_date IS NULL
      AND (je.status = 'posted' OR je.status IS NULL)
      AND a.is_active = true
      GROUP BY a.account_id, a.account_code, a.account_name, a.account_type
      HAVING COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) != 0
      ORDER BY a.account_code
    `, [asOfDate]);
    
    const totalDebits = result.rows.reduce((sum, r) => sum + parseFloat(r.total_debit), 0);
    const totalCredits = result.rows.reduce((sum, r) => sum + parseFloat(r.total_credit), 0);
    
    res.json({
      success: true,
      as_of_date: asOfDate,
      accounts: result.rows,
      totals: {
        total_debits: totalDebits,
        total_credits: totalCredits,
        difference: totalDebits - totalCredits
      }
    });
    
  } catch (error) {
    console.error('Trial Balance error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get Balance Sheet — derived entirely from bills + sales_entries (source of truth)
async function getBalanceSheet(req, res) {
  try {
    const { as_of_date } = req.query;
    const asOfDate = as_of_date || new Date().toISOString().split('T')[0];

    const BILL_FILTER = `
      COALESCE(b.total_amount, 0) > 0
      AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')
      AND COALESCE(d.status, 'uploaded') <> 'deleted'
      AND COALESCE(b.bill_date, b.created_at::date, d.uploaded_at::date) <= $1
    `;

    // ── ASSETS ────────────────────────────────────────────────────────────────
    // Accounts Receivable = total net sales revenue collected up to as_of_date
    const salesRow = await pool.query(
      `SELECT COALESCE(SUM(net_sales), 0) AS net_sales,
              COALESCE(SUM(gross_sales), 0) AS gross_sales,
              COALESCE(SUM(returns_amount), 0) AS returns,
              COALESCE(SUM(cgst_collected + sgst_collected + igst_collected), 0) AS gst_collected
       FROM sales_entries WHERE entry_date <= $1`,
      [asOfDate]
    );
    const s = salesRow.rows[0];
    const netSales      = parseFloat(s.net_sales);
    const gstCollected  = parseFloat(s.gst_collected);

    // Input Tax Credit = GST on bills (cgst_amount + sgst_amount + igst_amount)
    const itcRow = await pool.query(
      `SELECT COALESCE(SUM(b.cgst_amount + b.sgst_amount + b.igst_amount), 0) AS itc
       FROM bills b LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ${BILL_FILTER}`,
      [asOfDate]
    );
    const itc = parseFloat(itcRow.rows[0].itc);

    const assetAccounts = [
      { account_code: '4000', account_name: 'Revenue Received (Net Sales)', balance: netSales },
    ];
    if (itc > 0) assetAccounts.push({ account_code: '1170', account_name: 'Input Tax Credit (GST on bills)', balance: itc });
    const totalAssets = assetAccounts.reduce((s, a) => s + a.balance, 0);

    // ── LIABILITIES ───────────────────────────────────────────────────────────
    // Accounts Payable = ONLY unpaid/pending bills — paid bills are NOT liabilities
    const UNPAID_FILTER = `
      COALESCE(b.total_amount, 0) > 0
      AND COALESCE(b.status, 'pending') NOT IN ('deleted', 'void')
      AND COALESCE(d.status, 'uploaded') <> 'deleted'
      AND COALESCE(b.bill_date, b.created_at::date, d.uploaded_at::date) <= $1
      AND COALESCE(b.payment_status, 'pending') NOT IN ('paid')
    `;

    const billsRow = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN COALESCE(b.category_group,'OPERATIONS') = 'COGS'
                          THEN b.total_amount END), 0)  AS cogs_payable,
         COALESCE(SUM(CASE WHEN COALESCE(b.category_group,'OPERATIONS') <> 'COGS'
                          THEN b.total_amount END), 0)  AS opex_payable,
         COUNT(*)                                        AS unpaid_count
       FROM bills b
       LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ${UNPAID_FILTER}`,
      [asOfDate]
    );

    // For advance bills: use payment_schedule outstanding balance instead of full bill amount
    const advanceRow = await pool.query(
      `SELECT COALESCE(SUM(ps.amount_due - COALESCE(ps.amount_paid,0)), 0) AS advance_balance
       FROM payment_schedule ps
       JOIN bills b ON ps.bill_id = b.bill_id
       LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ps.payment_status IN ('PENDING','PARTIAL','OVERDUE')
         AND COALESCE(b.bill_date, b.created_at::date, d.uploaded_at::date) <= $1
         AND COALESCE(b.status,'pending') NOT IN ('deleted','void')`,
      [asOfDate]
    );
    const advanceBalance = parseFloat(advanceRow.rows[0].advance_balance);

    const bp = billsRow.rows[0];
    const cogsPayable  = parseFloat(bp.cogs_payable);
    const opexPayable  = parseFloat(bp.opex_payable);

    const netGstPayable = Math.max(0, gstCollected - itc);

    const liabilityAccounts = [];
    if (cogsPayable > 0)    liabilityAccounts.push({ account_code: '2110', account_name: 'Accounts Payable — COGS / Purchase (unpaid)', balance: cogsPayable });
    if (opexPayable > 0)    liabilityAccounts.push({ account_code: '2110', account_name: 'Accounts Payable — Operating Expenses (unpaid)', balance: opexPayable });
    if (advanceBalance > 0) liabilityAccounts.push({ account_code: '2110', account_name: 'Advance Bills — Outstanding Balance Due', balance: advanceBalance });
    if (netGstPayable > 0)  liabilityAccounts.push({ account_code: '2120', account_name: 'GST Payable (Output − ITC)', balance: netGstPayable });
    const totalLiabilities = liabilityAccounts.reduce((s, a) => s + a.balance, 0);

    // ── EQUITY ────────────────────────────────────────────────────────────────
    // Retained Earnings = cumulative net revenue (P&L driven from bills/sales)
    const allTimeSales = await pool.query(
      `SELECT COALESCE(SUM(net_sales), 0) AS total FROM sales_entries WHERE entry_date <= $1`,
      [asOfDate]
    );
    const allTimeBills = await pool.query(
      `SELECT COALESCE(SUM(b.total_amount), 0) AS total
       FROM bills b LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ${BILL_FILTER}`,
      [asOfDate]
    );
    const retainedEarnings = parseFloat(allTimeSales.rows[0].total) - parseFloat(allTimeBills.rows[0].total);
    const equityAccounts = [
      { account_code: '3200', account_name: 'Retained Earnings (Revenue − Total Spend)', balance: retainedEarnings }
    ];
    const totalEquity = retainedEarnings;

    res.json({
      success: true,
      as_of_date: asOfDate,
      assets: { accounts: assetAccounts, total: totalAssets },
      liabilities: { accounts: liabilityAccounts, total: totalLiabilities },
      equity: { accounts: equityAccounts, total: totalEquity },
      total_liabilities_equity: totalLiabilities + totalEquity
    });

  } catch (error) {
    console.error('Balance Sheet error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getContributionMargin(req, res) {
  try {
    const dropId = req.query.dropId ? Number(req.query.dropId) : null;
    const data = await getContributionMarginData(Number.isFinite(dropId) ? dropId : null);
    res.json({ success: true, drop_id: dropId, data });
  } catch (error) {
    console.error('Contribution margin error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function getUnitEconomics(req, res) {
  try {
    const dropId = req.query.dropId ? Number(req.query.dropId) : null;
    const data = await getUnitEconomicsData(Number.isFinite(dropId) ? dropId : null);
    res.json({ success: true, drop_id: dropId, data });
  } catch (error) {
    console.error('Unit economics error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

// Get Journal Entries (Ledger view)
async function getJournalEntries(req, res) {
  try {
    const { start_date, end_date, account_id } = req.query;
    
    let query = `
      SELECT 
        je.journal_id,
        je.entry_date,
        je.reference_type,
        je.reference_id,
        je.description,
        je.total_debit,
        je.total_credit,
        je.status,
        json_agg(
          json_build_object(
            'line_id', jel.line_id,
            'account_code', a.account_code,
            'account_name', a.account_name,
            'debit', jel.debit_amount,
            'credit', jel.credit_amount,
            'description', jel.description
          ) ORDER BY jel.line_number
        ) as lines
      FROM journal_entries je
      JOIN journal_entry_lines jel ON je.journal_id = jel.journal_id
      JOIN accounts a ON jel.account_id = a.account_id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (start_date) {
      query += ` AND je.entry_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }
    
    if (end_date) {
      query += ` AND je.entry_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }
    
    if (account_id) {
      query += ` AND jel.account_id = $${paramCount}`;
      params.push(account_id);
      paramCount++;
    }
    
    query += `
      GROUP BY je.journal_id
      ORDER BY je.entry_date DESC, je.journal_id DESC
      LIMIT 100
    `;
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      entries: result.rows
    });
    
  } catch (error) {
    console.error('Journal entries error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Get all accounts (Chart of Accounts)
async function getChartOfAccounts(req, res) {
  try {
    const result = await pool.query(`
      SELECT 
        account_id,
        account_code,
        account_name,
        account_type,
        parent_account_id,
        is_active,
        description
      FROM accounts
      WHERE is_active = true
      ORDER BY account_code
    `);
    
    res.json({
      success: true,
      accounts: result.rows
    });
    
  } catch (error) {
    console.error('Chart of Accounts error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Spend by dimensions (drop/trip) for D2C ops visibility
async function getDimensionSpend(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const query = `
      SELECT
        COALESCE(b.drop_name, 'Unassigned') AS drop_name,
        COALESCE(b.trip_name, 'Unassigned') AS trip_name,
        'Unassigned' AS channel,
        'Unassigned' AS campaign,
        COALESCE(b.category_group, b.department, 'OPERATIONS') AS department,
        SUM(b.total_amount) AS spend_total,
        SUM(b.subtotal) AS spend_subtotal,
        SUM(b.tax_amount) AS spend_tax,
        COUNT(*) AS bill_count
      FROM bills b
      LEFT JOIN documents d ON b.document_id = d.document_id
      WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
        AND ${ACTIVE_BILL_FILTER}
      GROUP BY b.drop_name, b.trip_name, COALESCE(b.category_group, b.department, 'OPERATIONS')
      ORDER BY spend_total DESC NULLS LAST, bill_count DESC;
    `;

    const result = await pool.query(query, [startDate, endDate]);

    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      rows: result.rows
    });
  } catch (error) {
    console.error('Dimension spend error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Upsert drop-level budget (drop + department)
async function upsertDropBudget(req, res) {
  try {
    const { drop_name, department, amount, start_date, end_date, notes } = req.body;
    if (!drop_name || !department || !amount || !start_date || !end_date) {
      return res.status(400).json({ error: 'drop_name, department, amount, start_date, end_date are required' });
    }
    const actor = (req.user && (req.user.email || req.user.name)) || 'system';

    const result = await pool.query(
      `INSERT INTO drop_budgets (drop_name, department, amount, start_date, end_date, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (drop_name, department)
       DO UPDATE SET amount = EXCLUDED.amount,
                     start_date = EXCLUDED.start_date,
                     end_date = EXCLUDED.end_date,
                     notes = EXCLUDED.notes,
                     updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [drop_name, department, amount, start_date, end_date, notes || null]
    );

    await pool.query(
      `INSERT INTO drop_budget_history
        (drop_name, department, amount, start_date, end_date, notes, changed_by, change_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'UPSERT')`,
      [drop_name, department, amount, start_date, end_date, notes || null, actor]
    );

    res.json({ success: true, budget: result.rows[0] });
  } catch (error) {
    console.error('Upsert drop budget error:', error);
    res.status(500).json({ error: error.message });
  }
}

// List drop budgets (optional filter by drop)
async function getDropBudgets(req, res) {
  try {
    const { drop_name } = req.query;
    const params = [];
    let where = '';
    if (drop_name) {
      params.push(drop_name);
      where = 'WHERE drop_name = $1';
    }
    const result = await pool.query(
      `SELECT * FROM drop_budgets ${where} ORDER BY drop_name, department`,
      params
    );
    res.json({ success: true, budgets: result.rows });
  } catch (error) {
    console.error('Get drop budgets error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getDropBudgetHistory(req, res) {
  try {
    const { drop_name, limit = 100 } = req.query;
    const params = [limit];
    let where = '';
    if (drop_name) {
      params.unshift(drop_name);
      where = 'WHERE drop_name = $1';
      params[1] = limit;
    }
    const query = `
      SELECT drop_name, department, amount, start_date, end_date, notes, changed_by, change_type, created_at
      FROM drop_budget_history
      ${where}
      ORDER BY created_at DESC
      LIMIT $${drop_name ? 2 : 1}
    `;
    const result = await pool.query(query, params);
    res.json({ success: true, history: result.rows });
  } catch (error) {
    console.error('Get drop budget history error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Drop-level variance: budget vs actual spend by department
async function getDropVariance(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const budgets = await pool.query(
      `SELECT drop_name, department, amount, start_date, end_date
       FROM drop_budgets
       WHERE start_date <= $2 AND end_date >= $1`,
      [startDate, endDate]
    );

    const actuals = await pool.query(
      `SELECT 
          COALESCE(drop_name, 'Unassigned') AS drop_name,
          COALESCE(department, 'Unassigned') AS department,
          SUM(total_amount) AS spend_total,
          COUNT(*) AS bill_count
       FROM bills
       WHERE bill_date BETWEEN $1 AND $2
       GROUP BY drop_name, department`,
      [startDate, endDate]
    );

    // Map actuals for quick lookup
    const actualMap = {};
    actuals.rows.forEach(r => {
      const key = `${r.drop_name}||${r.department}`;
      actualMap[key] = r;
    });

    const rows = budgets.rows.map(b => {
      const key = `${b.drop_name}||${b.department}`;
      const actual = actualMap[key];
      const actualSpend = parseFloat(actual?.spend_total || 0);
      return {
        drop_name: b.drop_name,
        department: b.department,
        budget_amount: parseFloat(b.amount),
        actual_amount: actualSpend,
        variance: parseFloat(b.amount) - actualSpend,
        bill_count: actual ? parseInt(actual.bill_count, 10) : 0,
        period: { start_date: startDate, end_date: endDate }
      };
    });

    // Also include actuals with no budget for visibility
    actuals.rows.forEach(a => {
      const key = `${a.drop_name}||${a.department}`;
      if (!rows.find(r => `${r.drop_name}||${r.department}` === key)) {
        rows.push({
          drop_name: a.drop_name,
          department: a.department,
          budget_amount: 0,
          actual_amount: parseFloat(a.spend_total || 0),
          variance: 0 - parseFloat(a.spend_total || 0),
          bill_count: parseInt(a.bill_count, 10),
          period: { start_date: startDate, end_date: endDate }
        });
      }
    });

    res.json({ success: true, rows });
  } catch (error) {
    console.error('Drop variance error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Metrics summary: docs by status, spend by vendor/category
async function getMetricsSummary(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const docsByStatus = await pool.query(`
      SELECT status, COUNT(*) as count
      FROM documents
      WHERE status <> 'deleted'
        AND uploaded_at::date BETWEEN $1 AND $2
      GROUP BY status
    `, [startDate, endDate]);

    const spendByVendor = await pool.query(`
      SELECT COALESCE(v.vendor_name, 'Unassigned') as vendor_name, SUM(b.total_amount) as total
      FROM bills b
      LEFT JOIN vendors v ON b.vendor_id = v.vendor_id
      LEFT JOIN documents d ON b.document_id = d.document_id
      WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
        AND ${ACTIVE_BILL_FILTER}
      GROUP BY v.vendor_name
      ORDER BY total DESC NULLS LAST
      LIMIT 5
    `, [startDate, endDate]);

    const spendByCategoryRaw = await pool.query(`
      SELECT COALESCE(b.category, d.document_category, 'misc') as category, SUM(b.total_amount) as total
      FROM bills b
      LEFT JOIN documents d ON b.document_id = d.document_id
      WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
        AND ${ACTIVE_BILL_FILTER}
      GROUP BY COALESCE(b.category, d.document_category, 'misc')
    `, [startDate, endDate]);

    const spendByPayment = await pool.query(`
      SELECT COALESCE(b.payment_method, 'UNSPECIFIED') as payment_method, SUM(b.total_amount) as total
      FROM bills b
      LEFT JOIN documents d ON b.document_id = d.document_id
      WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
        AND ${ACTIVE_BILL_FILTER}
      GROUP BY b.payment_method
      ORDER BY total DESC NULLS LAST
    `, [startDate, endDate]);

    const { spendByCategory, spendByGroup } = aggregateCategorySpend(spendByCategoryRaw.rows);

    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      docs_by_status: docsByStatus.rows,
      spend_by_vendor: spendByVendor.rows,
      spend_by_group: spendByGroup,
      spend_by_category: spendByCategory,
      spend_by_payment_method: spendByPayment.rows
    });
  } catch (error) {
    console.error('Metrics summary error:', error);
    res.status(500).json({ error: error.message });
  }
}

// COGS by SKU (from bill_items)
async function getCogsBySku(req, res) {
  try {
    const { sku_code } = req.params;
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT 
        sku_code,
        SUM(amount) as total_amount,
        SUM(quantity) as total_qty,
        AVG(unit_price) as avg_rate
      FROM bill_items
      WHERE sku_code = $1
        AND EXISTS (
          SELECT 1 FROM bills b WHERE b.bill_id = bill_items.bill_id AND b.bill_date BETWEEN $2 AND $3
        )
      GROUP BY sku_code
    `, [sku_code, startDate, endDate]);

    res.json({
      success: true,
      sku_code,
      period: { start_date: startDate, end_date: endDate },
      summary: result.rows[0] || null
    });
  } catch (error) {
    console.error('COGS by SKU error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Ingest marketing spend (API/CSV hook)
async function ingestMarketingSpend(req, res) {
  try {
    const { channel, campaign, drop_name, amount, spend_date, source, notes } = req.body;
    if (!channel || !amount) {
      return res.status(400).json({ error: 'channel and amount are required' });
    }
    await pool.query(
      `INSERT INTO marketing_spend (channel, campaign, drop_name, amount, spend_date, source, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [channel, campaign || null, drop_name || null, amount, spend_date || new Date(), source || 'API', notes || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Ingest marketing error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Ingest shipment/fulfillment costs
async function ingestShipmentCost(req, res) {
  try {
    const { order_id, carrier, tracking_number, charge_amount, drop_name, sku_code, notes } = req.body;
    if (!charge_amount) return res.status(400).json({ error: 'charge_amount is required' });
    await pool.query(
      `INSERT INTO shipments (order_id, carrier, tracking_number, charge_amount, drop_name, sku_code, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [order_id || null, carrier || null, tracking_number || null, charge_amount, drop_name || null, sku_code || null, notes || null]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Ingest shipment error:', error);
    res.status(500).json({ error: error.message });
  }
}

function aggregateCategorySpend(rows = []) {
  const categoryTotals = {};
  const groupTotals = {};

  rows.forEach(row => {
    const amount = parseFloat(row.total || 0);
    if (!amount) return;
    const info = normalizeCategory(row.category);
    categoryTotals[info.category] = (categoryTotals[info.category] || 0) + amount;
    groupTotals[info.category_group] = (groupTotals[info.category_group] || 0) + amount;
  });

  const spendByCategory = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const spendByGroup = Object.entries(groupTotals)
    .map(([category_group, total]) => ({ category_group, total }))
    .sort((a, b) => b.total - a.total);

  return { spendByCategory, spendByGroup };
}

// GET /api/reports/sales?start_date=&end_date=&drop_id=
async function getSalesEntries(req, res) {
  try {
    const { start_date, end_date, drop_id } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate = end_date || new Date().toISOString().split('T')[0];
    const params = [startDate, endDate];
    let dropFilter = '';
    if (drop_id) { params.push(drop_id); dropFilter = `AND drop_id = $${params.length}`; }
    const r = await pool.query(
      `SELECT se.*, d.drop_name AS drop_label
       FROM sales_entries se
       LEFT JOIN drops d ON se.drop_id = d.drop_id
       WHERE entry_date BETWEEN $1 AND $2 ${dropFilter}
       ORDER BY entry_date DESC, entry_id DESC`,
      params
    );
    res.json({ success: true, entries: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/reports/sales — record a sales entry
async function createSalesEntry(req, res) {
  try {
    const {
      entry_date, channel, drop_id, drop_name, section,
      gross_sales, returns_amount = 0,
      gross_units = 0, returned_units = 0,
      marketplace_commission = 0, payment_gateway_charges = 0,
      shipping_collected = 0,
      cgst_collected = 0, sgst_collected = 0, igst_collected = 0,
      settlement_ref, settlement_date, notes
    } = req.body;
    if (!channel || gross_sales == null) {
      return res.status(400).json({ error: 'channel and gross_sales required' });
    }
    const VALID_CHANNELS = ['D2C_WEBSITE','MYNTRA','AJIO','NYKAA','INSTAGRAM','POPUP','OTHER'];
    const ch = channel.toUpperCase();
    if (!VALID_CHANNELS.includes(ch)) {
      return res.status(400).json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` });
    }
    const r = await pool.query(
      `INSERT INTO sales_entries
         (entry_date, channel, drop_id, drop_name, section,
          gross_sales, returns_amount,
          gross_units, returned_units,
          marketplace_commission, payment_gateway_charges, shipping_collected,
          cgst_collected, sgst_collected, igst_collected,
          settlement_ref, settlement_date, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [entry_date || new Date().toISOString().split('T')[0], ch, drop_id || null,
       drop_name || null, section || null, gross_sales, returns_amount, gross_units, returned_units,
       marketplace_commission, payment_gateway_charges, shipping_collected,
       cgst_collected, sgst_collected, igst_collected,
       settlement_ref || null, settlement_date || null, notes || null,
       req.user?.userId || null]
    );
    res.json({ success: true, entry: r.rows[0] });
  } catch (err) {
    console.error('createSalesEntry error', err);
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/reports/sales/:id
async function deleteSalesEntry(req, res) {
  try {
    await pool.query('DELETE FROM sales_entries WHERE entry_id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/reports/sales/:id
async function updateSalesEntry(req, res) {
  try {
    const { id } = req.params;
    const {
      entry_date, channel, drop_id, section,
      gross_sales, returns_amount = 0,
      gross_units = 0, returned_units = 0,
      marketplace_commission = 0, payment_gateway_charges = 0,
      shipping_collected = 0,
      cgst_collected = 0, sgst_collected = 0, igst_collected = 0,
      settlement_ref, settlement_date, notes
    } = req.body;
    if (!channel || gross_sales == null) {
      return res.status(400).json({ error: 'channel and gross_sales required' });
    }
    const VALID_CHANNELS = ['D2C_WEBSITE','MYNTRA','AJIO','NYKAA','INSTAGRAM','POPUP','OTHER'];
    const ch = channel.toUpperCase();
    if (!VALID_CHANNELS.includes(ch)) {
      return res.status(400).json({ error: `channel must be one of: ${VALID_CHANNELS.join(', ')}` });
    }
    const r = await pool.query(
      `UPDATE sales_entries SET
         entry_date=$1, channel=$2, drop_id=$3, section=$4,
         gross_sales=$5, returns_amount=$6,
         gross_units=$7, returned_units=$8,
         marketplace_commission=$9, payment_gateway_charges=$10, shipping_collected=$11,
         cgst_collected=$12, sgst_collected=$13, igst_collected=$14,
         settlement_ref=$15, settlement_date=$16, notes=$17
       WHERE entry_id=$18
       RETURNING *`,
      [entry_date, ch, drop_id || null, section || null,
       gross_sales, returns_amount, gross_units, returned_units,
       marketplace_commission, payment_gateway_charges, shipping_collected,
       cgst_collected, sgst_collected, igst_collected,
       settlement_ref || null, settlement_date || null, notes || null,
       id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Entry not found' });
    res.json({ success: true, entry: r.rows[0] });
  } catch (err) {
    console.error('updateSalesEntry error', err);
    res.status(500).json({ error: err.message });
  }
}

async function getGarmentProfitability(req, res) {
  try {
    const dropId = parseInt(req.query.drop_id, 10);
    const data = await getGarmentEconomics(Number.isFinite(dropId) ? dropId : null);
    res.json({ success: true, drop_id: dropId || null, ...data });
  } catch (err) {
    console.error('Garment economics error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Upsert SKU assumptions (returns model, gateway, etc.)
async function upsertSkuAssumptions(req, res) {
  try {
    const { sku_id } = req.params;
    const {
      shipping_subsidy_avg, gateway_fee_pct, gateway_fee_fixed,
      returns_rate, return_shipping_avg, reconditioning_cost_avg,
      expected_resale_discount_pct, cm_buffer
    } = req.body;
    await pool.query(
      `INSERT INTO sku_assumptions
         (sku_id, shipping_subsidy_avg, gateway_fee_pct, gateway_fee_fixed,
          returns_rate, return_shipping_avg, reconditioning_cost_avg,
          expected_resale_discount_pct, cm_buffer, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())
       ON CONFLICT (sku_id) DO UPDATE SET
         shipping_subsidy_avg       = EXCLUDED.shipping_subsidy_avg,
         gateway_fee_pct            = EXCLUDED.gateway_fee_pct,
         gateway_fee_fixed          = EXCLUDED.gateway_fee_fixed,
         returns_rate               = EXCLUDED.returns_rate,
         return_shipping_avg        = EXCLUDED.return_shipping_avg,
         reconditioning_cost_avg    = EXCLUDED.reconditioning_cost_avg,
         expected_resale_discount_pct = EXCLUDED.expected_resale_discount_pct,
         cm_buffer                  = EXCLUDED.cm_buffer,
         updated_at                 = NOW()`,
      [sku_id, shipping_subsidy_avg, gateway_fee_pct, gateway_fee_fixed,
       returns_rate, return_shipping_avg, reconditioning_cost_avg,
       expected_resale_discount_pct, cm_buffer]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('upsertSkuAssumptions error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Upsert size sell-through data
async function upsertSizeSellThrough(req, res) {
  try {
    const { sku_id } = req.params;
    const { sizes } = req.body; // [{ size, units_available, units_sold, bottleneck_flag }]
    if (!Array.isArray(sizes) || !sizes.length) {
      return res.status(400).json({ error: 'sizes array required' });
    }
    for (const s of sizes) {
      await pool.query(
        `INSERT INTO size_sellthrough (sku_id, size, units_available, units_sold, bottleneck_flag)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (sku_id, size) DO UPDATE SET
           units_available = EXCLUDED.units_available,
           units_sold      = EXCLUDED.units_sold,
           bottleneck_flag = EXCLUDED.bottleneck_flag,
           updated_at      = NOW()`,
        [sku_id, s.size, s.units_available || 0, s.units_sold || 0, s.bottleneck_flag || false]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('upsertSizeSellThrough error:', err);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/reports/trend?months=6
// Returns monthly P&L metrics for the last N months — for sparklines/charts
async function getPLTrend(req, res) {
  try {
    const months = Math.min(parseInt(req.query.months || 6), 24);
    const now = new Date();

    // Build month ranges
    const ranges = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      ranges.push({
        label: d.toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
        start: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`,
        end: `${last.getFullYear()}-${String(last.getMonth()+1).padStart(2,'0')}-${String(last.getDate()).padStart(2,'0')}`,
      });
    }

    const salesAgg = await pool.query(
      `SELECT DATE_TRUNC('month', entry_date) AS month,
              SUM(net_sales) AS net_sales, SUM(gross_units - returned_units) AS net_units
       FROM sales_entries
       WHERE entry_date >= $1 AND entry_date <= $2
       GROUP BY 1 ORDER BY 1`,
      [ranges[0].start, ranges[ranges.length - 1].end]
    );

    const billAgg = await pool.query(
      `SELECT DATE_TRUNC('month', ${BILL_DATE_SQL}) AS month,
              COALESCE(b.category_group, 'OPERATIONS') AS category_group,
              SUM(b.total_amount) AS total
       FROM bills b
       LEFT JOIN documents d ON b.document_id = d.document_id
       WHERE ${BILL_DATE_SQL} >= $1
         AND ${BILL_DATE_SQL} <= $2
         AND ${ACTIVE_BILL_FILTER}
       GROUP BY 1, 2 ORDER BY 1`,
      [ranges[0].start, ranges[ranges.length - 1].end]
    );

    // Build lookup maps
    const salesMap = {};
    salesAgg.rows.forEach(r => {
      const key = r.month.toISOString().slice(0, 7);
      salesMap[key] = { net_sales: parseFloat(r.net_sales || 0), net_units: parseInt(r.net_units || 0) };
    });
    const billMap = {};
    billAgg.rows.forEach(r => {
      const key = r.month.toISOString().slice(0, 7);
      if (!billMap[key]) billMap[key] = { COGS: 0, FULFILLMENT: 0, MARKETING: 0, OPERATIONS: 0 };
      const grp = (r.category_group || 'OPERATIONS').toUpperCase();
      billMap[key][grp] = (billMap[key][grp] || 0) + parseFloat(r.total || 0);
    });

    const data = ranges.map(r => {
      const key = r.start.slice(0, 7);
      const s = salesMap[key] || { net_sales: 0, net_units: 0 };
      const b = billMap[key] || { COGS: 0, FULFILLMENT: 0, MARKETING: 0, OPERATIONS: 0 };
      const ns      = s.net_sales;
      const gp      = ns - b.COGS;
      const cm1     = gp - b.FULFILLMENT;
      const cm2     = cm1 - b.MARKETING;
      const ebitda  = cm2 - b.OPERATIONS;
      return {
        label: r.label,
        month: key,
        net_sales: ns,
        net_units: s.net_units,
        cogs: b.COGS,
        fulfillment: b.FULFILLMENT,
        marketing: b.MARKETING,
        operations: b.OPERATIONS,
        gross_profit: gp,
        gross_margin_pct: ns ? parseFloat((gp / ns * 100).toFixed(1)) : 0,
        cm1: cm1,
        cm1_pct: ns ? parseFloat((cm1 / ns * 100).toFixed(1)) : 0,
        cm2: cm2,
        cm2_pct: ns ? parseFloat((cm2 / ns * 100).toFixed(1)) : 0,
        ebitda: ebitda,
        ebitda_pct: ns ? parseFloat((ebitda / ns * 100).toFixed(1)) : 0,
      };
    });

    res.json({ success: true, months: data });
  } catch (err) {
    console.error('PLTrend error:', err);
    res.status(500).json({ error: err.message });
  }
}

// Vendor spend analysis — top vendors by total spend with category breakdown
async function getVendorAnalysis(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate   = end_date   || new Date().toISOString().split('T')[0];

    const result = await pool.query(`
      SELECT
        COALESCE(b.vendor_name, 'Unknown Vendor') AS vendor_name,
        COALESCE(b.vendor_type, 'Other')          AS vendor_type,
        COALESCE(b.category_group, 'OPERATIONS')  AS category_group,
        COUNT(*)                                   AS bill_count,
        SUM(b.total_amount)                        AS total_spend,
        AVG(b.total_amount)                        AS avg_bill,
        MIN(${BILL_DATE_SQL})                      AS first_bill,
        MAX(${BILL_DATE_SQL})                      AS last_bill
      FROM bills b
      LEFT JOIN documents d ON b.document_id = d.document_id
      WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
        AND ${ACTIVE_BILL_FILTER}
      GROUP BY b.vendor_name, b.vendor_type, COALESCE(b.category_group, 'OPERATIONS')
      ORDER BY total_spend DESC NULLS LAST
      LIMIT 100
    `, [startDate, endDate]);

    const totalSpend = result.rows.reduce((s, r) => s + parseFloat(r.total_spend || 0), 0);

    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      total_spend: totalSpend,
      vendors: result.rows.map(r => ({
        vendor_name:   r.vendor_name,
        vendor_type:   r.vendor_type,
        category_group: r.category_group,
        bill_count:    parseInt(r.bill_count),
        total_spend:   parseFloat(r.total_spend || 0),
        avg_bill:      parseFloat(r.avg_bill    || 0),
        first_bill:    r.first_bill ? r.first_bill.toISOString().split('T')[0] : null,
        last_bill:     r.last_bill  ? r.last_bill.toISOString().split('T')[0]  : null,
        pct_of_total:  totalSpend > 0 ? parseFloat(((parseFloat(r.total_spend || 0) / totalSpend) * 100).toFixed(1)) : 0,
      })),
    });
  } catch (error) {
    console.error('Vendor analysis error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Cash Flow Statement — monthly cash receipts vs cash payments
async function getCashFlow(req, res) {
  try {
    const { start_date, end_date } = req.query;
    const startDate = start_date || new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
    const endDate   = end_date   || new Date().toISOString().split('T')[0];

    // Cash receipts: sales settlements by month
    const receipts = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', entry_date), 'YYYY-MM') AS month,
        SUM(net_sales)  AS net_sales,
        SUM(gross_sales) AS gross_sales,
        SUM(returns_amount) AS returns,
        SUM(marketplace_commission + payment_gateway_charges) AS platform_fees,
        COUNT(*) AS entry_count
      FROM sales_entries
      WHERE entry_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', entry_date)
      ORDER BY 1
    `, [startDate, endDate]);

    // Cash payments: actual payments made (from payments table)
    const payments = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', p.payment_date), 'YYYY-MM') AS month,
        COALESCE(b.category_group, 'OPERATIONS') AS category_group,
        SUM(p.amount_paid) AS amount_paid,
        COUNT(*) AS payment_count
      FROM payments p
      LEFT JOIN bills b ON p.bill_id = b.bill_id
      WHERE p.payment_date BETWEEN $1 AND $2
      GROUP BY DATE_TRUNC('month', p.payment_date), COALESCE(b.category_group, 'OPERATIONS')
      ORDER BY 1, 2
    `, [startDate, endDate]);

    // Bill spend accrual by month (for reference)
    const billAccrual = await pool.query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', ${BILL_DATE_SQL}), 'YYYY-MM') AS month,
        COALESCE(b.category_group, 'OPERATIONS') AS category_group,
        SUM(b.total_amount) AS accrued_amount,
        COUNT(*) AS bill_count
      FROM bills b
      LEFT JOIN documents d ON b.document_id = d.document_id
      WHERE ${BILL_DATE_SQL} BETWEEN $1 AND $2
        AND ${ACTIVE_BILL_FILTER}
      GROUP BY DATE_TRUNC('month', ${BILL_DATE_SQL}), COALESCE(b.category_group, 'OPERATIONS')
      ORDER BY 1, 2
    `, [startDate, endDate]);

    // Build month-keyed maps
    const receiptMap = {};
    receipts.rows.forEach(r => {
      receiptMap[r.month] = {
        net_sales:     parseFloat(r.net_sales || 0),
        gross_sales:   parseFloat(r.gross_sales || 0),
        returns:       parseFloat(r.returns || 0),
        platform_fees: parseFloat(r.platform_fees || 0),
        entry_count:   parseInt(r.entry_count),
      };
    });

    const paymentMap = {};
    payments.rows.forEach(r => {
      if (!paymentMap[r.month]) paymentMap[r.month] = {};
      paymentMap[r.month][r.category_group] = parseFloat(r.amount_paid || 0);
    });

    const accrualMap = {};
    billAccrual.rows.forEach(r => {
      if (!accrualMap[r.month]) accrualMap[r.month] = {};
      accrualMap[r.month][r.category_group] = parseFloat(r.accrued_amount || 0);
    });

    const allMonths = Array.from(new Set([
      ...Object.keys(receiptMap),
      ...Object.keys(paymentMap),
      ...Object.keys(accrualMap),
    ])).sort();

    const GROUPS = ['COGS', 'FULFILLMENT', 'MARKETING', 'OPERATIONS'];

    const months = allMonths.map(month => {
      const rec  = receiptMap[month]  || {};
      const paid = paymentMap[month]  || {};
      const acc  = accrualMap[month]  || {};

      const cashIn    = rec.net_sales || 0;
      const cashOut   = GROUPS.reduce((s, g) => s + (paid[g] || 0), 0);
      const netCash   = cashIn - cashOut;

      const accrualOut = GROUPS.reduce((s, g) => s + (acc[g] || 0), 0);

      return {
        month,
        label: new Date(month + '-01').toLocaleString('en-IN', { month: 'short', year: 'numeric' }),
        cash_in:   cashIn,
        gross_sales: rec.gross_sales || 0,
        returns:     rec.returns || 0,
        platform_fees: rec.platform_fees || 0,
        cash_out:  cashOut,
        cash_out_by_group: GROUPS.reduce((o, g) => { o[g] = paid[g] || 0; return o; }, {}),
        accrual_out: accrualOut,
        accrual_by_group: GROUPS.reduce((o, g) => { o[g] = acc[g] || 0; return o; }, {}),
        net_cash: netCash,
      };
    });

    const totCashIn  = months.reduce((s, m) => s + m.cash_in,  0);
    const totCashOut = months.reduce((s, m) => s + m.cash_out, 0);

    res.json({
      success: true,
      period: { start_date: startDate, end_date: endDate },
      months,
      totals: {
        cash_in:   totCashIn,
        cash_out:  totCashOut,
        net_cash:  totCashIn - totCashOut,
      },
    });
  } catch (error) {
    console.error('Cash flow error:', error);
    res.status(500).json({ error: error.message });
  }
}

// Create manual journal entry (double-entry)
async function createJournalEntry(req, res) {
  const client = await pool.connect();
  try {
    const { entry_date, description, reference_type = 'manual', lines } = req.body;
    if (!entry_date || !description || !Array.isArray(lines) || lines.length < 2) {
      return res.status(400).json({ error: 'entry_date, description, and at least 2 lines are required' });
    }

    const totalDebit  = lines.reduce((s, l) => s + parseFloat(l.debit  || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + parseFloat(l.credit || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({ error: `Debits (${totalDebit.toFixed(2)}) must equal credits (${totalCredit.toFixed(2)})` });
    }

    await client.query('BEGIN');

    const jeRes = await client.query(
      `INSERT INTO journal_entries (entry_date, reference_type, description, total_debit, total_credit, status, created_by)
       VALUES ($1, $2, $3, $4, $5, 'posted', $6)
       RETURNING journal_id`,
      [entry_date, reference_type, description, totalDebit, totalCredit, req.user?.user_id || null]
    );
    const journalId = jeRes.rows[0].journal_id;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (!l.account_id) continue;
      await client.query(
        `INSERT INTO journal_entry_lines (journal_id, account_id, debit_amount, credit_amount, description, line_number)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [journalId, l.account_id, parseFloat(l.debit || 0), parseFloat(l.credit || 0), l.description || null, i + 1]
      );
    }

    await client.query('COMMIT');
    res.json({ success: true, journal_id: journalId });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createJournalEntry error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
}

module.exports = {
  getProfitLoss,
  getPLTrend,
  getTrialBalance,
  getBalanceSheet,
  getJournalEntries,
  getChartOfAccounts,
  getVendorAnalysis,
  getDimensionSpend,
  upsertDropBudget,
  getDropBudgets,
  getDropBudgetHistory,
  getDropVariance,
  getMetricsSummary,
  getCogsBySku,
  getContributionMargin,
  getUnitEconomics,
  getGarmentProfitability,
  upsertSkuAssumptions,
  upsertSizeSellThrough,
  ingestMarketingSpend,
  ingestShipmentCost,
  getSalesEntries,
  createSalesEntry,
  updateSalesEntry,
  deleteSalesEntry,
  getCashFlow,
  createJournalEntry
};
