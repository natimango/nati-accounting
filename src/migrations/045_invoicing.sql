BEGIN;

-- Migration 045: Invoicing — outbound invoices to B2B customers
-- Handles: customer registry, GST-compliant invoices, line items, status lifecycle

-- ── CUSTOMERS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
  customer_id   SERIAL PRIMARY KEY,
  customer_name VARCHAR(255) NOT NULL,
  customer_code VARCHAR(50)  UNIQUE,
  gstin         VARCHAR(15),              -- buyer's GSTIN
  pan           VARCHAR(10),
  contact_name  VARCHAR(255),
  email         VARCHAR(255),
  phone         VARCHAR(20),
  address       TEXT,
  city          VARCHAR(100),
  state         VARCHAR(100),             -- for CGST/SGST vs IGST determination
  state_code    VARCHAR(5),               -- 2-digit GST state code e.g. '27' = Maharashtra
  pincode       VARCHAR(10),
  is_active     BOOLEAN      DEFAULT true,
  notes         TEXT,
  created_at    TIMESTAMPTZ  DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(customer_name);
CREATE INDEX IF NOT EXISTS idx_customers_gstin ON customers(gstin) WHERE gstin IS NOT NULL;

-- ── INVOICE SEQUENCE (per FY) ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_sequences (
  fy            VARCHAR(10) PRIMARY KEY,  -- '2526', '2627' etc.
  last_number   INTEGER     DEFAULT 0
);

-- ── INVOICES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  invoice_id      SERIAL PRIMARY KEY,
  invoice_number  VARCHAR(50)  UNIQUE NOT NULL,  -- NATI/2526/0001
  invoice_date    DATE         NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,

  customer_id     INTEGER REFERENCES customers(customer_id),
  -- Snapshot fields (in case customer is edited later)
  customer_name   VARCHAR(255) NOT NULL,
  customer_gstin  VARCHAR(15),
  customer_address TEXT,
  customer_state  VARCHAR(100),
  customer_state_code VARCHAR(5),

  -- Drop linkage (optional)
  drop_id         INTEGER REFERENCES drops(drop_id),
  drop_name       VARCHAR(150),

  -- Amounts (computed from line items; stored for fast query)
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  cgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  sgst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  igst_amount     NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(14,2) NOT NULL DEFAULT 0,

  -- Inter-state flag: true → IGST, false → CGST+SGST
  -- NATI's state = Maharashtra (27); buyer outside MH → inter-state
  is_interstate   BOOLEAN      DEFAULT false,
  place_of_supply VARCHAR(100),

  -- Status lifecycle
  status          VARCHAR(20)  NOT NULL DEFAULT 'draft',
  -- draft | sent | partially_paid | paid | void | overdue

  payment_terms_text VARCHAR(255),   -- e.g. 'Net 30', 'Due on receipt'
  notes           TEXT,
  internal_notes  TEXT,

  -- Payment tracking
  amount_paid     NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_date    DATE,
  payment_method  VARCHAR(30),
  payment_ref     VARCHAR(200),

  created_by      INTEGER REFERENCES users(user_id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_date       ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_invoices_customer   ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_drop       ON invoices(drop_id);

-- ── INVOICE LINE ITEMS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_items (
  item_id         SERIAL PRIMARY KEY,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  line_number     INTEGER NOT NULL DEFAULT 1,
  description     VARCHAR(500) NOT NULL,
  hsn_code        VARCHAR(20),
  quantity        NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit             VARCHAR(30) DEFAULT 'pcs',
  unit_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_pct    NUMERIC(5,2)  DEFAULT 0,
  amount          NUMERIC(14,2) NOT NULL DEFAULT 0,  -- qty * unit_price * (1 - discount/100)
  gst_rate        NUMERIC(5,2)  DEFAULT 0,
  cgst_amount     NUMERIC(14,2) DEFAULT 0,
  sgst_amount     NUMERIC(14,2) DEFAULT 0,
  igst_amount     NUMERIC(14,2) DEFAULT 0,
  sku_code        VARCHAR(50),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);

-- ── INVOICE PAYMENTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_payments (
  payment_id      SERIAL PRIMARY KEY,
  invoice_id      INTEGER NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
  payment_date    DATE    NOT NULL DEFAULT CURRENT_DATE,
  amount          NUMERIC(14,2) NOT NULL,
  payment_method  VARCHAR(30),
  reference       VARCHAR(200),
  notes           TEXT,
  created_by      INTEGER REFERENCES users(user_id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);

-- ── NATI's own GST registration (used on invoice header) ─────────────────────
INSERT INTO invoice_sequences (fy, last_number)
  VALUES ('2526', 0)
  ON CONFLICT (fy) DO NOTHING;

COMMIT;
