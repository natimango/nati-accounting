import { pool } from '../config/database';
import bcrypt from 'bcryptjs';

async function seed() {
  console.log('🌱 Seeding database...');

  try {
    // 1. Create default admin user
    console.log('Creating default admin user...');
    const passwordHash = await bcrypt.hash('admin123', 10);

    await pool.query(`
      INSERT INTO users (email, password_hash, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (email) DO NOTHING
    `, ['admin@nati.com', passwordHash, 'NATI Admin', 'ADMIN']);

    // 2. Seed Chart of Accounts (D2C-specific)
    console.log('Seeding Chart of Accounts...');

    const accounts = [
      // ASSETS (1000-1999)
      { code: '1000', name: 'Bank Account', type: 'ASSET' },
      { code: '1100', name: 'Accounts Receivable', type: 'ASSET' },
      { code: '1200', name: 'Raw Material Inventory', type: 'ASSET' },
      { code: '1300', name: 'Finished Goods Inventory', type: 'ASSET' },
      { code: '1400', name: 'GST Input Credit', type: 'ASSET' },

      // LIABILITIES (2000-2999)
      { code: '2000', name: 'Accounts Payable', type: 'LIABILITY' },
      { code: '2100', name: 'GST Payable', type: 'LIABILITY' },
      { code: '2200', name: 'TDS Payable', type: 'LIABILITY' },
      { code: '2300', name: 'Vendor Advances', type: 'LIABILITY' },

      // EQUITY (3000-3999)
      { code: '3000', name: 'Owner\'s Equity', type: 'EQUITY' },
      { code: '3100', name: 'Retained Earnings', type: 'EQUITY' },

      // REVENUE (4000-4999)
      { code: '4000', name: 'Gross Revenue', type: 'REVENUE' },
      { code: '4010', name: 'Returns & Refunds', type: 'REVENUE' },
      { code: '4020', name: 'Discounts Given', type: 'REVENUE' },
      { code: '4030', name: 'Payment Gateway Charges', type: 'REVENUE' },

      // COGS (5000-5999)
      { code: '5000', name: 'Raw Materials - Fabric', type: 'EXPENSE' },
      { code: '5010', name: 'Artist Royalties', type: 'EXPENSE' },
      { code: '5020', name: 'Packaging Materials', type: 'EXPENSE' },
      { code: '5030', name: 'Stitching/Production Labor', type: 'EXPENSE' },
      { code: '5040', name: 'Printing/Embroidery', type: 'EXPENSE' },
      { code: '5050', name: 'QC Costs', type: 'EXPENSE' },
      { code: '5060', name: 'Freight Inward', type: 'EXPENSE' },

      // OPERATING EXPENSES (6000-6999)
      { code: '6000', name: 'Shipping Costs', type: 'EXPENSE' },
      { code: '6010', name: 'Returns Processing', type: 'EXPENSE' },
      { code: '6020', name: 'Marketing - Meta Ads', type: 'EXPENSE' },
      { code: '6030', name: 'Marketing - Google Ads', type: 'EXPENSE' },
      { code: '6040', name: 'Marketing - Influencer', type: 'EXPENSE' },
      { code: '6050', name: 'Marketing - Content Creation', type: 'EXPENSE' },
      { code: '6100', name: 'Platform Fees', type: 'EXPENSE' },
      { code: '6200', name: 'Warehousing', type: 'EXPENSE' },
      { code: '6300', name: 'Salaries', type: 'EXPENSE' },
      { code: '6400', name: 'Rent', type: 'EXPENSE' },
      { code: '6500', name: 'Utilities', type: 'EXPENSE' },
      { code: '6600', name: 'Professional Fees', type: 'EXPENSE' },
      { code: '6700', name: 'Software & Subscriptions', type: 'EXPENSE' },
      { code: '6800', name: 'Bank Charges', type: 'EXPENSE' },
      { code: '6900', name: 'Miscellaneous Expenses', type: 'EXPENSE' },
    ];

    for (const account of accounts) {
      await pool.query(`
        INSERT INTO accounts (account_code, account_name, account_type)
        VALUES ($1, $2, $3)
        ON CONFLICT (account_code) DO NOTHING
      `, [account.code, account.name, account.type]);
    }

    // 3. Create sample vendors
    console.log('Creating sample vendors...');

    const vendors = [
      {
        name: 'Gujarat Textile Mills',
        type: 'SUPPLIER',
        gstin: '24AAACC1234A1ZN',
        payment_terms: 'Net 30'
      },
      {
        name: 'Priya Sharma (Artist)',
        type: 'ARTIST',
        payment_terms: 'Immediate'
      },
      {
        name: 'Meta Ads',
        type: 'SERVICE_PROVIDER',
        payment_terms: 'Immediate'
      },
      {
        name: 'Shiprocket Logistics',
        type: 'SERVICE_PROVIDER',
        gstin: '27AAACC5678B1ZP',
        payment_terms: 'Net 15'
      }
    ];

    for (const vendor of vendors) {
      await pool.query(`
        INSERT INTO vendors (vendor_name, vendor_type, gstin, payment_terms)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `, [vendor.name, vendor.type, vendor.gstin || null, vendor.payment_terms]);
    }

    // 4. Create sample SKU costing
    console.log('Creating sample SKU costing...');

    const skus = [
      {
        code: 'HEMP-TEE-BLACK-M',
        name: 'Hemp T-Shirt Black - Medium',
        mrp: 4500,
        fabric: 800,
        royalty: 360,
        production: 650,
        packaging: 100
      },
      {
        code: 'ORGANIC-DRESS-BLUE-S',
        name: 'Organic Cotton Dress Blue - Small',
        mrp: 6500,
        fabric: 1200,
        royalty: 520,
        production: 950,
        packaging: 150
      }
    ];

    for (const sku of skus) {
      await pool.query(`
        INSERT INTO sku_costing (
          sku_code, product_name, mrp,
          fabric_cost, artist_royalty, production_cost, packaging_cost
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (sku_code) DO NOTHING
      `, [
        sku.code, sku.name, sku.mrp,
        sku.fabric, sku.royalty, sku.production, sku.packaging
      ]);
    }

    console.log('✅ Database seeded successfully!');
    console.log('\n📋 Default Login Credentials:');
    console.log('   Email: admin@nati.com');
    console.log('   Password: admin123');
    console.log('\n⚠️  Please change the password after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seed();
