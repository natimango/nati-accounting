export interface User {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
}

export interface Bill {
  bill_id: string;
  document_url?: string;
  vendor_name?: string;
  bill_number?: string;
  bill_date?: string;
  total_amount: number;
  category?: string;
  status: string;
  confidence_score?: number;
  created_at: string;
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
}
