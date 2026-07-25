BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029: Sales revenue ingestion for Indian D2C channels
-- Records actual sales per channel per drop — wires into P&L revenue line.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sales_entries (
  entry_id            SERIAL PRIMARY KEY,
  entry_date          DATE          NOT NULL DEFAULT CURRENT_DATE,
  channel             VARCHAR(50)   NOT NULL,
  -- D2C_WEBSITE | MYNTRA | AJIO | NYKAA | INSTAGRAM | POPUP | OTHER
  drop_id             INTEGER       REFERENCES drops(drop_id),
  drop_name           VARCHAR(150),

  -- Gross revenue before deductions
  gross_sales         NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Returns and refunds (positive number, will be subtracted)
  returns_amount      NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Net revenue = gross_sales - returns_amount
  net_sales           NUMERIC(14,2) GENERATED ALWAYS AS (gross_sales - returns_amount) STORED,

  -- Units
  gross_units         INTEGER       DEFAULT 0,
  returned_units      INTEGER       DEFAULT 0,

  -- Deductions captured here (informational — also tracked as 6xxx expenses)
  marketplace_commission  NUMERIC(14,2) DEFAULT 0,
  payment_gateway_charges NUMERIC(14,2) DEFAULT 0,
  shipping_collected      NUMERIC(14,2) DEFAULT 0,  -- shipping charged to customer

  -- GST collected (output GST — will reconcile against 2120/2121/2122)
  cgst_collected      NUMERIC(14,2) DEFAULT 0,
  sgst_collected      NUMERIC(14,2) DEFAULT 0,
  igst_collected      NUMERIC(14,2) DEFAULT 0,

  -- Settlement reference (Myntra/Ajio settlement ID, Razorpay payout etc.)
  settlement_ref      VARCHAR(200),
  settlement_date     DATE,

  notes               TEXT,
  created_by          INTEGER REFERENCES users(user_id),
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sales_entries_date    ON sales_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_sales_entries_drop    ON sales_entries(drop_id);
CREATE INDEX IF NOT EXISTS idx_sales_entries_channel ON sales_entries(channel);

-- GST fields on bills: capture input GST per bill for ITC
ALTER TABLE bills
  ADD COLUMN IF NOT EXISTS cgst_amount  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gst_rate     NUMERIC(5,2);   -- e.g. 5.00, 12.00, 18.00

-- GST on bill_items too
ALTER TABLE bill_items
  ADD COLUMN IF NOT EXISTS cgst_amount  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sgst_amount  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS igst_amount  NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS hsn_code     VARCHAR(20),
  ADD COLUMN IF NOT EXISTS gst_rate     NUMERIC(5,2);

COMMIT;
