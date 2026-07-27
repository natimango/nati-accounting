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

    // If tracking table is empty but database is already bootstrapped,
    // mark all existing migration files as applied (idempotent seed).
    // We detect bootstrap by checking if the bills table exists.
    if (appliedSet.size === 0) {
      const { rows: hasBills } = await pool.query(`
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'bills'
      `);
      if (hasBills.length > 0) {
        // Pre-populate — mark all files as applied so they are skipped
        for (const file of files) {
          await pool.query(
            'INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING',
            [file]
          );
          appliedSet.add(file);
        }
        console.log(`[migration] Seeded ${files.length} already-applied migrations into tracking table`);
        return;
      }
    }

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
