import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Unwrap backend's { success, data } envelope
const unwrap = (res: { data: { data?: unknown } }) => res.data.data ?? res.data;

export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return unwrap(response) as { token: string; user: unknown };
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return unwrap(response);
  },
};

export const billsApi = {
  uploadBill: async (file: File) => {
    const formData = new FormData();
    formData.append('bill', file);
    const response = await api.post('/bills/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return unwrap(response);
  },

  getBills: async (status?: string) => {
    const response = await api.get('/bills', { params: { status } });
    return unwrap(response) as unknown[];
  },

  getBillById: async (id: string) => {
    const response = await api.get(`/bills/${id}`);
    return unwrap(response);
  },

  approveBill: async (id: string) => {
    const response = await api.post(`/bills/${id}/approve`);
    return unwrap(response);
  },
};

export const tagsApi = {
  getTags: async () => {
    const response = await api.get('/tags');
    return unwrap(response) as unknown[];
  },

  setBillTags: async (billId: string, tagIds: string[]) => {
    const response = await api.put(`/tags/bill/${billId}`, { tag_ids: tagIds });
    return unwrap(response);
  },
};

export const reportsApi = {
  getDashboard: async () => {
    const response = await api.get('/reports/dashboard');
    return unwrap(response);
  },

  getProfitAndLoss: async (startDate: string, endDate: string) => {
    const response = await api.get('/reports/profit-loss', {
      params: { start_date: startDate, end_date: endDate },
    });
    return unwrap(response);
  },

  getBalanceSheet: async (asOfDate: string) => {
    const response = await api.get('/reports/balance-sheet', {
      params: { as_of_date: asOfDate },
    });
    return unwrap(response);
  },

  getSpendByCategory: async (startDate: string, endDate: string) => {
    const response = await api.get('/reports/spend-by-category', {
      params: { start_date: startDate, end_date: endDate },
    });
    return unwrap(response);
  },

  getMonthlyTrend: async (months: number = 6) => {
    const response = await api.get('/reports/monthly-trend', { params: { months } });
    return unwrap(response);
  },
};
