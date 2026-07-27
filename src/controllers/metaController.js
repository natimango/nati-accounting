const pool = require('../config/database');

async function listCoaAccounts(req, res) {
  try {
    const result = await pool.query(
      `SELECT coa_account_id, account_code, account_name
       FROM coa_accounts
       ORDER BY account_code`
    );
    res.json({ success: true, accounts: result.rows });
  } catch (error) {
    console.error('CoA list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function listDepartments(req, res) {
  try {
    const result = await pool.query(
      `SELECT department_id, department_name
       FROM departments
       WHERE is_active
       ORDER BY department_name`
    );
    res.json({ success: true, departments: result.rows });
  } catch (error) {
    console.error('Departments list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function listDrops(req, res) {
  try {
    const result = await pool.query(
      `SELECT drop_id, drop_name
       FROM drops
       WHERE is_active
       ORDER BY drop_name`
    );
    res.json({ success: true, drops: result.rows });
  } catch (error) {
    console.error('Drops list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createDrop(req, res) {
  try {
    const { drop_name, description, launch_date, season } = req.body;
    if (!drop_name || !drop_name.trim()) {
      return res.status(400).json({ success: false, error: 'drop_name is required' });
    }
    const result = await pool.query(
      `INSERT INTO drops (drop_name, description, launch_date, season, is_active)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (drop_name) DO UPDATE SET is_active = true
       RETURNING drop_id, drop_name`,
      [drop_name.trim(), description || null, launch_date || null, season || null]
    );
    res.json({ success: true, drop: result.rows[0] });
  } catch (error) {
    console.error('Create drop error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  listCoaAccounts,
  listDepartments,
  listDrops,
  createDrop
};
