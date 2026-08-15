-- Repair: re-apply work from migrations 037-039 which were silently skipped
-- because the old bootstrap code marked them as applied before they ran.
-- All statements use IF NOT EXISTS / ON CONFLICT so they are safe to re-run.

-- ── 037: document_comments ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_comments (
    comment_id  SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_comments_doc ON document_comments(document_id, created_at DESC);

-- ── 038: drop_number column ───────────────────────────────────────────────
ALTER TABLE drops ADD COLUMN IF NOT EXISTS drop_number INTEGER DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drops_drop_number ON drops(drop_number) WHERE drop_number IS NOT NULL;

-- ── 039: seed Hemp Hase Drop 1 & tag all unassigned bills ────────────────
INSERT INTO drops (drop_name, drop_number, description, is_active)
VALUES ('Hemp Hase Drop 1', 1, 'Founding drop — all pre-production operational bills', true)
ON CONFLICT (drop_name) DO UPDATE
  SET drop_number = 1,
      description = EXCLUDED.description,
      is_active   = true;

UPDATE bills
SET drop_name = 'Hemp Hase Drop 1'
WHERE drop_name IS NULL
   OR drop_name = ''
   OR drop_name = 'Unassigned';

UPDATE bill_items
SET drop_id = (SELECT drop_id FROM drops WHERE drop_name = 'Hemp Hase Drop 1' LIMIT 1)
WHERE drop_id IS NULL
  AND bill_id IN (SELECT bill_id FROM bills WHERE drop_name = 'Hemp Hase Drop 1');
