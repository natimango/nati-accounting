ALTER TABLE drops ADD COLUMN IF NOT EXISTS drop_number INTEGER DEFAULT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drops_drop_number ON drops(drop_number) WHERE drop_number IS NOT NULL;
