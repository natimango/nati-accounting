import { pool } from '../config/database';

const migrations = [
  // Users table
  `
  CREATE TABLE IF NOT EXISTS users (
    user_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Accounts (Chart of Accounts)
  `
  CREATE TABLE IF NOT EXISTS accounts (
    account_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_code VARCHAR(50) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL,
    parent_account_id UUID REFERENCES accounts(account_id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Journal Entries
  `
  CREATE TABLE IF NOT EXISTS journal_entries (
    journal_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_date DATE NOT NULL,
    reference_type VARCHAR(50) NOT NULL,
    reference_id VARCHAR(255),
    description TEXT NOT NULL,
    total_debit DECIMAL(15,2) NOT NULL,
    total_credit DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'DRAFT',
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT balanced_entry CHECK (total_debit = total_credit)
  );
  `,

  // Journal Entry Lines
  `
  CREATE TABLE IF NOT EXISTS journal_entry_lines (
    line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    journal_id UUID NOT NULL REFERENCES journal_entries(journal_id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(account_id),
    debit_amount DECIMAL(15,2) DEFAULT 0,
    credit_amount DECIMAL(15,2) DEFAULT 0,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT debit_or_credit CHECK (
      (debit_amount > 0 AND credit_amount = 0) OR
      (credit_amount > 0 AND debit_amount = 0)
    )
  );
  `,

  // Vendors
  `
  CREATE TABLE IF NOT EXISTS vendors (
    vendor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name VARCHAR(255) NOT NULL,
    vendor_type VARCHAR(50) NOT NULL,
    gstin VARCHAR(15),
    pan VARCHAR(10),
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Bills
  `
  CREATE TABLE IF NOT EXISTS bills (
    bill_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_url TEXT,
    document_id VARCHAR(255),
    vendor_id UUID REFERENCES vendors(vendor_id),
    bill_number VARCHAR(100),
    bill_date DATE,
    due_date DATE,
    total_amount DECIMAL(15,2) NOT NULL,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    category VARCHAR(50),
    journal_id UUID REFERENCES journal_entries(journal_id),
    status VARCHAR(50) DEFAULT 'PENDING',
    confidence_score DECIMAL(5,2),
    ai_extracted_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Bill Items
  `
  CREATE TABLE IF NOT EXISTS bill_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bill_id UUID NOT NULL REFERENCES bills(bill_id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2),
    rate DECIMAL(15,2),
    amount DECIMAL(15,2) NOT NULL,
    account_id UUID REFERENCES accounts(account_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Orders
  `
  CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_order_id VARCHAR(255) UNIQUE NOT NULL,
    customer_id VARCHAR(255),
    order_date DATE NOT NULL,
    gross_amount DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    gateway_charges DECIMAL(15,2) DEFAULT 0,
    net_amount DECIMAL(15,2) NOT NULL,
    cogs DECIMAL(15,2) DEFAULT 0,
    journal_id UUID REFERENCES journal_entries(journal_id),
    status VARCHAR(50) DEFAULT 'PENDING',
    sync_status VARCHAR(50) DEFAULT 'SYNCED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Order Items
  `
  CREATE TABLE IF NOT EXISTS order_items (
    item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    quantity INTEGER NOT NULL,
    price DECIMAL(15,2) NOT NULL,
    cogs DECIMAL(15,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // SKU Costing
  `
  CREATE TABLE IF NOT EXISTS sku_costing (
    sku_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku_code VARCHAR(100) UNIQUE NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    mrp DECIMAL(15,2) NOT NULL,
    fabric_cost DECIMAL(15,2) DEFAULT 0,
    artist_royalty DECIMAL(15,2) DEFAULT 0,
    production_cost DECIMAL(15,2) DEFAULT 0,
    packaging_cost DECIMAL(15,2) DEFAULT 0,
    total_cogs DECIMAL(15,2) GENERATED ALWAYS AS (
      fabric_cost + artist_royalty + production_cost + packaging_cost
    ) STORED,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Settlements
  `
  CREATE TABLE IF NOT EXISTS settlements (
    settlement_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_settlement_id VARCHAR(255) UNIQUE NOT NULL,
    settlement_date DATE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    journal_id UUID REFERENCES journal_entries(journal_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  `,

  // Settlement Orders (many-to-many)
  `
  CREATE TABLE IF NOT EXISTS settlement_orders (
    settlement_id UUID REFERENCES settlements(settlement_id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(order_id) ON DELETE CASCADE,
    PRIMARY KEY (settlement_id, order_id)
  );
  `,

  // Create indexes
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(entry_date);`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entries_status ON journal_entries(status);`,
  `CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON journal_entry_lines(account_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bills_vendor ON bills(vendor_id);`,
  `CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);`,
  `CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);`,
  `CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);`,
];

async function runMigrations() {
  console.log('🔄 Running database migrations...');

  try {
    for (let i = 0; i < migrations.length; i++) {
      console.log(`Running migration ${i + 1}/${migrations.length}...`);
      await pool.query(migrations[i]);
    }

    console.log('✅ All migrations completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();
