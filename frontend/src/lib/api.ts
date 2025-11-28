import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth API
export const authApi = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (email: string, password: string, full_name: string) => {
    const response = await api.post('/auth/register', { email, password, full_name });
    return response.data;
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// Bills API
export const billsApi = {
  uploadBill: async (file: File) => {
    const formData = new FormData();
    formData.append('bill', file);

    const response = await api.post('/bills/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getBills: async (status?: string) => {
    const response = await api.get('/bills', {
      params: { status },
    });
    return response.data;
  },

  getBillById: async (id: string) => {
    const response = await api.get(`/bills/${id}`);
    return response.data;
  },

  approveBill: async (id: string) => {
    const response = await api.post(`/bills/${id}/approve`);
    return response.data;
  },
};

// Reports API
export const reportsApi = {
  getDashboard: async () => {
    const response = await api.get('/reports/dashboard');
    return response.data;
  },

  getProfitAndLoss: async (startDate: string, endDate: string) => {
    const response = await api.get('/reports/profit-loss', {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    });
    return response.data;
  },

  getBalanceSheet: async (asOfDate: string) => {
    const response = await api.get('/reports/balance-sheet', {
      params: {
        as_of_date: asOfDate,
      },
    });
    return response.data;
  },
};
