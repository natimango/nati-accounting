CREATE TABLE IF NOT EXISTS document_comments (
    comment_id  SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    body        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_doc_comments_doc ON document_comments(document_id, created_at DESC);
