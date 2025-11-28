// Account Types
export enum AccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE'
}

export interface Account {
  account_id: string;
  account_code: string;
  account_name: string;
  account_type: AccountType;
  parent_account_id?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Journal Entry Types
export enum JournalEntryStatus {
  DRAFT = 'DRAFT',
  POSTED = 'POSTED',
  VOID = 'VOID'
}

export enum ReferenceType {
  ORDER = 'ORDER',
  BILL = 'BILL',
  PAYMENT = 'PAYMENT',
  SETTLEMENT = 'SETTLEMENT',
  RETURN = 'RETURN',
  ADJUSTMENT = 'ADJUSTMENT'
}

export interface JournalEntry {
  journal_id: string;
  entry_date: Date;
  reference_type: ReferenceType;
  reference_id?: string;
  description: string;
  total_debit: number;
  total_credit: number;
  status: JournalEntryStatus;
  created_by?: string;
  created_at: Date;
  updated_at: Date;
}

export interface JournalEntryLine {
  line_id: string;
  journal_id: string;
  account_id: string;
  debit_amount: number;
  credit_amount: number;
  description?: string;
  created_at: Date;
}

// Bill Types
export enum BillStatus {
  PENDING = 'PENDING',
  POSTED = 'POSTED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export enum BillCategory {
  RAW_MATERIALS = 'RAW_MATERIALS',
  ARTIST_ROYALTY = 'ARTIST_ROYALTY',
  MARKETING = 'MARKETING',
  LOGISTICS = 'LOGISTICS',
  RENT = 'RENT',
  UTILITIES = 'UTILITIES',
  SALARY = 'SALARY',
  OTHER = 'OTHER'
}

export interface Bill {
  bill_id: string;
  document_url?: string;
  document_id?: string;
  vendor_id?: string;
  bill_number?: string;
  bill_date?: Date;
  due_date?: Date;
  total_amount: number;
  tax_amount?: number;
  category?: BillCategory;
  journal_id?: string;
  status: BillStatus;
  confidence_score?: number;
  ai_extracted_data?: any;
  created_at: Date;
  updated_at: Date;
}

export interface BillItem {
  item_id: string;
  bill_id: string;
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
  account_id?: string;
  created_at: Date;
}

// Vendor Types
export enum VendorType {
  SUPPLIER = 'SUPPLIER',
  ARTIST = 'ARTIST',
  SERVICE_PROVIDER = 'SERVICE_PROVIDER',
  OTHER = 'OTHER'
}

export interface Vendor {
  vendor_id: string;
  vendor_name: string;
  vendor_type: VendorType;
  gstin?: string;
  pan?: string;
  email?: string;
  phone?: string;
  address?: string;
  payment_terms?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Order Types
export enum OrderStatus {
  PENDING = 'PENDING',
  SYNCED = 'SYNCED',
  SETTLED = 'SETTLED',
  RETURNED = 'RETURNED'
}

export interface Order {
  order_id: string;
  external_order_id: string;
  customer_id?: string;
  order_date: Date;
  gross_amount: number;
  discount_amount: number;
  gateway_charges: number;
  net_amount: number;
  cogs: number;
  journal_id?: string;
  status: OrderStatus;
  sync_status: string;
  created_at: Date;
  updated_at: Date;
}

export interface OrderItem {
  item_id: string;
  order_id: string;
  sku: string;
  quantity: number;
  price: number;
  cogs: number;
  created_at: Date;
}

// SKU Types
export interface SKUCosting {
  sku_id: string;
  sku_code: string;
  product_name: string;
  mrp: number;
  fabric_cost: number;
  artist_royalty: number;
  production_cost: number;
  packaging_cost: number;
  total_cogs: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// User Types
export enum UserRole {
  ADMIN = 'ADMIN',
  ACCOUNTANT = 'ACCOUNTANT',
  VIEWER = 'VIEWER'
}

export interface User {
  user_id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Gemini AI Types
export interface BillExtractionResult {
  vendor_name?: string;
  vendor_gstin?: string;
  bill_number?: string;
  bill_date?: string;
  due_date?: string;
  total_amount?: number;
  tax_amount?: number;
  category?: BillCategory;
  line_items?: Array<{
    description: string;
    quantity?: number;
    rate?: number;
    amount: number;
  }>;
  confidence_score: number;
  raw_response: any;
}
