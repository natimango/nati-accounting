-- Recurring bill templates: create standing orders that generate a bill stub each period
CREATE TABLE IF NOT EXISTS recurring_bill_templates (
    template_id     SERIAL PRIMARY KEY,
    template_name   TEXT NOT NULL,
    vendor_id       INTEGER REFERENCES vendors(vendor_id),
    vendor_name     TEXT,                     -- fallback if vendor_id is null
    category        TEXT,
    category_group  TEXT CHECK (category_group IN ('COGS','FULFILLMENT','MARKETING','OPERATIONS')),
    drop_id         INTEGER REFERENCES drops(drop_id),
    amount          NUMERIC(14,2),
    payment_terms   INTEGER DEFAULT 30,       -- days
    notes           TEXT,
    frequency       TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly','monthly','quarterly','yearly')),
    next_due_date   DATE NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_by      INTEGER REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rbt_active ON recurring_bill_templates(is_active, next_due_date);
