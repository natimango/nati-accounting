-- Drop close tracking
ALTER TABLE drops ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS closed_by TEXT DEFAULT NULL;
ALTER TABLE drops ADD COLUMN IF NOT EXISTS close_notes TEXT DEFAULT NULL;

-- Brain chat history (lightweight, for context continuity)
CREATE TABLE IF NOT EXISTS brain_chat_log (
  id            SERIAL PRIMARY KEY,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  context_json  JSONB DEFAULT NULL,
  actor_id      INT  DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
