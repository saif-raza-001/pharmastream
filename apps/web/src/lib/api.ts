import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

export const productsAPI = {
  getAll: (params?: any) => api.get('/products', { params }),
  getById: (id: string) => api.get(`/products/${id}`),
  getByBarcode: (barcode: string) => api.get(`/products/barcode/${barcode}`),
  create: (data: any) => api.post('/products', data),
  update: (id: string, data: any) => api.put(`/products/${id}`, data),
  delete: (id: string) => api.delete(`/products/${id}`),
  addBatch: (data: any) => api.post('/products/batch', data),
  updateBatch: (id: string, data: any) => api.put(`/products/batch/${id}`, data),
  deleteBatch: (id: string) => api.delete(`/products/batch/${id}`),
  import: (products: any[]) => api.post('/products/import', { products }),
};

export const categoriesAPI = {
  getAll: () => api.get('/categories'),
  create: (data: any) => api.post('/categories', data),
  update: (id: string, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string) => api.delete(`/categories/${id}`),
};

export const invoicesAPI = {
  create: (data: any) => api.post('/invoices', data),
  getAll: (params?: any) => api.get('/invoices', { params }),
  getById: (id: string) => api.get(`/invoices/${id}`),
  getRecent: () => api.get('/invoices/recent'),
  receivePayment: (id: string, data: { amount: number; mode: string; reference?: string }) => 
    api.post(`/invoices/${id}/payment`, data),
  delete: (id: string) => api.delete(`/invoices/${id}`),
};

export const purchasesAPI = {
  create: (data: any) => api.post('/purchases', data),
  getAll: () => api.get('/purchases'),
  getById: (id: string) => api.get(`/purchases/${id}`),
};

export const manufacturersAPI = {
  getAll: () => api.get('/manufacturers'),
  create: (data: any) => api.post('/manufacturers', data),
  update: (id: string, data: any) => api.put(`/manufacturers/${id}`, data),
  delete: (id: string) => api.delete(`/manufacturers/${id}`),
};

export const accountsAPI = {
  getAll: (type?: string, search?: string) => {
    const params = new URLSearchParams();
    if (type) params.append('type', type);
    if (search) params.append('search', search);
    return api.get(`/accounts?${params.toString()}`);
  },
  getById: (id: string) => api.get(`/accounts/${id}`),
  getLedger: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api.get(`/accounts/${id}/ledger?${params.toString()}`);
  },
  getStatement: (id: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    return api.get(`/accounts/${id}/statement?${params.toString()}`);
  },
  getStats: (type?: string) => api.get(`/accounts/stats${type ? `?type=${type}` : ''}`),
  create: (data: any) => api.post('/accounts', data),
  update: (id: string, data: any) => api.put(`/accounts/${id}`, data),
  delete: (id: string) => api.delete(`/accounts/${id}`),
};

export const settingsAPI = {
  get: () => api.get('/settings'),
  update: (data: any) => api.post('/settings', data),
};

export const paymentsAPI = {
  getRecent: () => api.get('/payments'),
  createReceipt: (data: any) => api.post('/payments/receipt', data),
  createPayment: (data: any) => api.post('/payments/payment', data),
};

export const reportsAPI = {
  getDashboard: () => api.get('/reports/dashboard'),
  getSales: (params?: any) => api.get('/reports/sales', { params }),
  getPurchases: (params?: any) => api.get('/reports/purchases', { params }),
  getStock: (filter?: string, categoryId?: string) => api.get('/reports/stock', { params: { filter, categoryId } }),
  getGST: (from: string, to: string) => api.get('/reports/gst', { params: { from, to } }),
};

export default api;
