// public/js/api.js
// Centralized fetch wrapper with auth handling

const BabboAPI = {
  async _fetch(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include'
    });
    if (res.status === 401) { window.location.href = '/login.html'; return; }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
  get: (url) => BabboAPI._fetch(url),
  post: (url, body) => BabboAPI._fetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => BabboAPI._fetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body) => BabboAPI._fetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => BabboAPI._fetch(url, { method: 'DELETE' }),

  // Auth
  login: (u, p) => BabboAPI.post('/api/auth/login', { username: u, password: p }),
  logout: () => BabboAPI.post('/api/auth/logout', {}),
  me: () => BabboAPI.get('/api/auth/me'),
  changePassword: (old_p, new_p) => BabboAPI.post('/api/auth/change-password', { old_password: old_p, new_password: new_p }),

  // Quotes
  getQuotes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return BabboAPI.get('/api/quotes' + (q ? '?' + q : ''));
  },
  getQuote: (id) => BabboAPI.get(`/api/quotes/${id}`),
  getStats: () => BabboAPI.get('/api/quotes/stats'),
  createQuote: (data) => BabboAPI.post('/api/quotes', data),
  updateQuote: (id, data) => BabboAPI.put(`/api/quotes/${id}`, data),
  updateQuoteStatus: (id, status) => BabboAPI.patch(`/api/quotes/${id}/status`, { status }),
  deleteQuote: (id) => BabboAPI.delete(`/api/quotes/${id}`),

  // PDF
  generatePDF: (id) => BabboAPI.post(`/api/pdf/generate/${id}`, {}),
  viewPDF: (id) => `/api/pdf/view/${id}`,
  downloadPDF: (id) => `/api/pdf/download/${id}`,

  // Print
  printQuote: (id, printer_url) => BabboAPI.post(`/api/print/${id}`, { printer_url }),

  // AI
  aiStatus: () => BabboAPI.get('/api/ai/status'),
  suggestDesc: (product_name, context) => BabboAPI.post('/api/ai/suggest-description', { product_name, context }),
  suggestPrice: (product_name, context) => BabboAPI.post('/api/ai/suggest-price', { product_name, context }),
  suggestText: (client_name, items) => BabboAPI.post('/api/ai/suggest-text', { client_name, items }),

  // Backup
  backup: (custom_path) => BabboAPI.post('/api/backup', { custom_path })
};
