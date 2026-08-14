const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function runMigrations() {
  try {
    // Ensure tracking table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    const { rows: applied } = await pool.query('SELECT filename FROM schema_migrations');
    const appliedSet = new Set(applied.map(r => r.filename));


    let count = 0;
    for (const file of files) {
      if (appliedSet.has(file)) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      try {
        await pool.query('BEGIN');
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await pool.query('COMMIT');
        console.log(`[migration] ✓ ${file}`);
        count++;
      } catch (err) {
        await pool.query('ROLLBACK');
        console.error(`[migration] ✗ ${file}: ${err.message}`);
      }
    }

    if (count > 0) {
      console.log(`[migration] Applied ${count} new migration(s)`);
    } else {
      console.log('[migration] All migrations up to date');
    }
  } catch (err) {
    console.error('[migration] Runner failed:', err.message);
  }
}

module.exports = { runMigrations };
