export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface Tag {
  tag_id: string;
  tag_name: string;
  tag_group: 'PURCHASE' | 'FULFILLMENT' | 'MARKETING' | 'OPERATIONS';
  account_code: string;
  color: string;
}

export interface BillItem {
  item_id: string;
  description: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

export interface Bill {
  bill_id: string;
  document_url?: string;
  vendor_name?: string;
  vendor_type?: string;
  gstin?: string;
  bill_number?: string;
  bill_date?: string;
  due_date?: string;
  total_amount: number;
  tax_amount?: number;
  category?: string;
  expense_type?: 'PURCHASE' | 'OPEX';
  status: string;
  confidence_score?: number;
  created_at: string;
  items?: BillItem[];
  tags?: Tag[];
}

export interface DashboardData {
  today: {
    revenue: number;
    orders: number;
    aov: number;
  };
  this_month: {
    revenue: number;
    cogs: number;
    gross_margin: number;
    orders: number;
  };
  pending_bills: Array<{
    bill_id: string;
    bill_number?: string;
    total_amount: number;
    due_date?: string;
  }>;
}

export interface AccountLine {
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number;
}

export interface ProfitAndLossData {
  period: {
    start_date: string;
    end_date: string;
  };
  summary: {
    gross_revenue: number;
    returns: number;
    discounts: number;
    net_revenue: number;
    cogs: number;
    gross_profit: number;
    gross_margin: number;
    variable_expenses: number;
    contribution_margin: number;
    contribution_margin_pct: number;
    operating_expenses: number;
    marketing_expenses: number;
    fixed_expenses: number;
    operating_profit: number;
    operating_margin: number;
  };
  d2c_metrics: {
    orders: number;
    aov: number;
    blended_cac: number;
    mer: string;
    gross_margin_per_order: number;
    contribution_margin_per_order: number;
  };
  breakdown: {
    cogs: AccountLine[];
    fulfillment: AccountLine[];
    marketing: AccountLine[];
    operations: AccountLine[];
  };
}

export interface BalanceSheetData {
  as_of_date: string;
  summary: {
    total_assets: number;
    total_liabilities: number;
    total_equity: number;
  };
  accounts: {
    assets: AccountLine[];
    liabilities: AccountLine[];
    equity: AccountLine[];
  };
}

export interface SpendCategoryRow {
  category: string;
  expense_type: string;
  bill_count: number;
  total_amount: number;
  avg_amount: number;
  pct_of_total: number;
}

export interface SpendByCategoryData {
  period: { start_date: string; end_date: string };
  total_spend: number;
  categories: SpendCategoryRow[];
}

export interface MonthlyTrendRow {
  month: string;
  revenue: number;
  cogs: number;
  gross_profit: number;
  orders: number;
  spend: number;
}

export interface MonthlyTrendData {
  months: MonthlyTrendRow[];
}
