-- Composite index covering the 3 bill_items lateral subqueries in getDocuments
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_postable_status
  ON bill_items(bill_id, is_postable, posting_status);

-- Composite index for dimension-gap lateral (bill_id + nullable dims)
CREATE INDEX IF NOT EXISTS idx_bill_items_bill_dims
  ON bill_items(bill_id, coa_account_id, department_id, drop_id);

-- bills.document_id lookup (used on every row of the getDocuments join)
CREATE INDEX IF NOT EXISTS idx_bills_document_id ON bills(document_id);

-- payments aggregation per bill
CREATE INDEX IF NOT EXISTS idx_payments_bill_amount ON payments(bill_id, amount);

-- payment_schedule earliest-due lookup
CREATE INDEX IF NOT EXISTS idx_ps_bill_status_due
  ON payment_schedule(bill_id, payment_status, due_date);

-- vendors lookup by vendor_id (FK, often missing an index)
CREATE INDEX IF NOT EXISTS idx_vendors_vendor_id ON vendors(vendor_id);

-- Full-text search on vendor_name and file_name for server-side search
CREATE INDEX IF NOT EXISTS idx_documents_file_name_trgm
  ON documents USING gin(file_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm
  ON vendors USING gin(vendor_name gin_trgm_ops);

-- Enable pg_trgm if not already (safe to call repeatedly)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- bills.bill_date for date-range filters on bills page
CREATE INDEX IF NOT EXISTS idx_bills_bill_date ON bills(bill_date);

-- documents.uploaded_at already exists but add status+uploaded_at composite
CREATE INDEX IF NOT EXISTS idx_documents_status_uploaded
  ON documents(status, uploaded_at DESC);
