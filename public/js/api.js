// public/js/api.js
// Centralized fetch wrapper with auth handling

const API = {
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
  get: (url) => API._fetch(url),
  post: (url, body) => API._fetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => API._fetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  patch: (url, body) => API._fetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url) => API._fetch(url, { method: 'DELETE' }),

  // Auth
  login: (u, p) => API.post('/api/auth/login', { username: u, password: p }),
  logout: () => API.post('/api/auth/logout', {}),
  me: () => API.get('/api/auth/me'),
  changePassword: (old_p, new_p) => API.post('/api/auth/change-password', { old_password: old_p, new_password: new_p }),

  // Quotes
  getQuotes: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return API.get('/api/quotes' + (q ? '?' + q : ''));
  },
  getQuote: (id) => API.get(`/api/quotes/${id}`),
  getStats: () => API.get('/api/quotes/stats'),
  createQuote: (data) => API.post('/api/quotes', data),
  updateQuote: (id, data) => API.put(`/api/quotes/${id}`, data),
  updateQuoteStatus: (id, status) => API.patch(`/api/quotes/${id}/status`, { status }),
  deleteQuote: (id) => API.delete(`/api/quotes/${id}`),

  // PDF
  generatePDF: (id) => API.post(`/api/pdf/generate/${id}`, {}),
  viewPDF: (id) => `/api/pdf/view/${id}`,
  downloadPDF: (id) => `/api/pdf/download/${id}`,

  // Print
  printQuote: (id, printer_url) => API.post(`/api/print/${id}`, { printer_url }),

  // AI
  aiStatus: () => API.get('/api/ai/status'),
  suggestDesc: (product_name, context) => API.post('/api/ai/suggest-description', { product_name, context }),
  suggestPrice: (product_name, context) => API.post('/api/ai/suggest-price', { product_name, context }),
  suggestText: (client_name, items) => API.post('/api/ai/suggest-text', { client_name, items }),

  // Backup
  backup: (custom_path) => API.post('/api/backup', { custom_path })
};
