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
    const showAll = req.query.all === '1';
    const result = await pool.query(
      `SELECT drop_id, drop_name, drop_number, description, launch_date, season, is_active, created_at
       FROM drops
       ${showAll ? '' : 'WHERE is_active'}
       ORDER BY drop_number NULLS LAST, drop_name`
    );
    res.json({ success: true, drops: result.rows });
  } catch (error) {
    console.error('Drops list error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function updateDrop(req, res) {
  try {
    const { drop_id } = req.params;
    const { drop_name, description, launch_date, season, is_active, drop_number } = req.body;
    const sets = [], vals = [];
    let i = 1;
    if (drop_name   !== undefined) { sets.push(`drop_name=$${i++}`);    vals.push(drop_name); }
    if (description !== undefined) { sets.push(`description=$${i++}`);  vals.push(description); }
    if (launch_date !== undefined) { sets.push(`launch_date=$${i++}`);  vals.push(launch_date || null); }
    if (season      !== undefined) { sets.push(`season=$${i++}`);       vals.push(season); }
    if (is_active   !== undefined) { sets.push(`is_active=$${i++}`);    vals.push(is_active); }
    if (drop_number !== undefined) { sets.push(`drop_number=$${i++}`);  vals.push(drop_number === '' ? null : drop_number); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    vals.push(drop_id);
    const r = await pool.query(
      `UPDATE drops SET ${sets.join(', ')} WHERE drop_id=$${i} RETURNING *`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Drop not found' });
    res.json({ success: true, drop: r.rows[0] });
  } catch (error) {
    console.error('updateDrop error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

async function createDrop(req, res) {
  try {
    const { drop_name, description, launch_date, season, drop_number } = req.body;
    if (!drop_name || !drop_name.trim()) {
      return res.status(400).json({ success: false, error: 'drop_name is required' });
    }
    const result = await pool.query(
      `INSERT INTO drops (drop_name, description, launch_date, season, drop_number, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (drop_name) DO UPDATE SET is_active = true
       RETURNING drop_id, drop_name, drop_number`,
      [drop_name.trim(), description || null, launch_date || null, season || null, drop_number || null]
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
  createDrop,
  updateDrop
};
