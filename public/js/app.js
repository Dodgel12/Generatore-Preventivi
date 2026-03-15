// public/js/app.js
// Main application controller

const Toast = {
  show(msg, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', info: 'ℹ' };
    el.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
    container.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
  }
};

const App = {
  currentView: 'dashboard',
  currentUser: null,

  async init() {
    try {
      const user = await BabboAPI.me();
      this.currentUser = user;
      document.getElementById('user-name-display').textContent = user.username;
      document.getElementById('user-avatar-letter').textContent = user.username[0].toUpperCase();
    } catch (e) { window.location.href = '/login.html'; return; }

    this.bindNav();
    QuoteForm.init();
    this.navigate('dashboard');
  },

  bindNav() {
    document.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => this.navigate(el.dataset.nav));
    });
    document.getElementById('btn-logout').addEventListener('click', async () => {
      await BabboAPI.logout();
      window.location.href = '/login.html';
    });
    document.getElementById('btn-new-quote').addEventListener('click', () => {
      QuoteForm.reset();
      this.navigate('new-quote');
    });
    document.querySelector('[data-nav="new-quote"]').addEventListener('click', () => {
      QuoteForm.reset();
      this.navigate('new-quote');
    });
    document.getElementById('btn-cancel-form').addEventListener('click', () => {
      this.navigate('dashboard');
    });
  },

  navigate(view) {
    this.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const viewEl = document.getElementById(`view-${view}`);
    if (viewEl) viewEl.classList.add('active');
    const navEl = document.querySelector(`[data-nav="${view}"]`);
    if (navEl) navEl.classList.add('active');

    const titles = {
      'dashboard': 'Dashboard', 'new-quote': 'Nuovo Preventivo',
      'quotes': 'Preventivi', 'settings': 'Impostazioni'
    };
    document.getElementById('topbar-title').textContent = titles[view] || view;

    if (view === 'dashboard') this.loadDashboard();
    if (view === 'quotes') this.loadQuotesList();
    if (view === 'new-quote') { document.getElementById('form-view-title').textContent = QuoteForm.editingId ? `Modifica ${QuoteForm.quoteNumber || ''}` : 'Nuovo Preventivo'; }
    if (view === 'settings') this.loadSettings();
  },

  async loadDashboard() {
    try {
      const stats = await BabboAPI.getStats();
      document.getElementById('stat-total').textContent = stats.total;
      document.getElementById('stat-month').textContent = stats.recentMonth;
      document.getElementById('stat-value').textContent = `€ ${(stats.totalValue || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}`;
      const accepted = (stats.byStatus || []).find(s => s.status === 'accepted');
      document.getElementById('stat-accepted').textContent = accepted?.count || 0;

      // Recent quotes
      const { quotes } = await BabboAPI.getQuotes({ limit: 8 });
      this.renderQuoteRows(document.getElementById('dashboard-quotes-tbody'), quotes, true);
    } catch (e) { console.error(e); }
  },

  async loadQuotesList() {
    const search = document.getElementById('search-input').value;
    const status = document.getElementById('filter-status').value;
    const params = {};
    if (search) params.search = search;
    if (status) params.status = status;

    const tbody = document.getElementById('quotes-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="loading-overlay"><div class="spinner"></div> Caricamento...</td></tr>';
    try {
      const { quotes } = await BabboAPI.getQuotes(params);
      this.renderQuoteRows(tbody, quotes, false);
    } catch (e) { tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--red)">Errore: ${e.message}</td></tr>`; }
  },

  renderQuoteRows(tbody, quotes, compact = false) {
    if (!quotes?.length) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">📄</div><h3>Nessun preventivo</h3><p>Crea il tuo primo preventivo!</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = quotes.map(q => `
      <tr style="cursor:pointer" onclick="App.openQuoteDetail(${q.id})">
        <td><span style="font-weight:700;color:var(--purple)">${q.quote_number}</span></td>
        <td>${q.client_name}</td>
        ${!compact ? `<td>${q.title || '<span style="color:var(--text-dim)">—</span>'}</td>` : ''}
        <td onclick="event.stopPropagation()">
          <select class="badge-select badge-${q.status}" onchange="App.updateQuoteStatus(${q.id}, this.value)">
            <option value="draft" ${q.status === 'draft' ? 'selected' : ''}>Bozza</option>
            <option value="sent" ${q.status === 'sent' ? 'selected' : ''}>Inviato</option>
            <option value="accepted" ${q.status === 'accepted' ? 'selected' : ''}>Accettato</option>
            <option value="rejected" ${q.status === 'rejected' ? 'selected' : ''}>Rifiutato</option>
          </select>
        </td>
        <td style="font-weight:700">€ ${parseFloat(q.total || 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}</td>
        <td style="color:var(--text-muted);font-size:12px">${new Date(q.created_at).toLocaleDateString('it-IT')}</td>
        <td onclick="event.stopPropagation()">
          <div style="display:flex;gap:6px">
            <button class="btn btn-sm btn-secondary" onclick="App.editQuote(${q.id})">✏️</button>
            <button class="btn btn-sm btn-secondary" onclick="App.generateAndViewPDF(${q.id})">📄</button>
            <button class="btn btn-sm btn-danger" onclick="App.deleteQuote(${q.id}, '${q.quote_number}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  },

  statusLabel(s) {
    return { draft: 'Bozza', sent: 'Inviato', accepted: 'Accettato', rejected: 'Rifiutato' }[s] || s;
  },

  async updateQuoteStatus(id, status) {
    try {
      await BabboAPI.updateQuoteStatus(id, status);
      Toast.show('Stato aggiornato!', 'success');
      // Refresh current view to update stats and badge colors
      if (this.currentView === 'dashboard') this.loadDashboard();
      else if (this.currentView === 'quotes') this.loadQuotesList();
    } catch (e) { Toast.show(e.message, 'error'); this.loadQuotesList(); }
  },

  async openQuoteDetail(id) {
    await this.editQuote(id);
  },

  async editQuote(id) {
    try {
      const quote = await BabboAPI.getQuote(id);
      QuoteForm.reset(quote);
      this.navigate('new-quote');
    } catch (e) { Toast.show(e.message, 'error'); }
  },

  async generateAndViewPDF(id) {
    Toast.show('Generazione PDF in corso...', 'info');
    try {
      await BabboAPI.generatePDF(id);
      Toast.show('PDF generato!', 'success');
      // Open PDF in new tab
      window.open(BabboAPI.viewPDF(id), '_blank');
    } catch (e) { Toast.show('Errore PDF: ' + e.message, 'error'); }
  },

  async deleteQuote(id, number) {
    if (!confirm(`Eliminare il preventivo ${number}? Questa azione è irreversibile.`)) return;
    try {
      await BabboAPI.deleteQuote(id);
      Toast.show('Preventivo eliminato', 'success');
      if (this.currentView === 'dashboard') this.loadDashboard();
      else this.loadQuotesList();
    } catch (e) { Toast.show(e.message, 'error'); }
  },

  loadSettings() {
    // Load saved settings from localStorage
    const printerUrl = localStorage.getItem('printer_url') || '';
    const backupPath = localStorage.getItem('backup_path') || '';
    const geminiKey = localStorage.getItem('gemini_key') || '';
    document.getElementById('setting-printer-url').value = printerUrl;
    document.getElementById('setting-backup-path').value = backupPath;
    document.getElementById('setting-gemini-key').value = geminiKey;
  }
};

// Quote detail view - generate PDF and print
window.handleGeneratePDF = async function(id) {
  const btn = document.getElementById('btn-gen-pdf');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generazione...'; }
  try {
    const result = await BabboAPI.generatePDF(id);
    Toast.show('PDF generato!', 'success');
    const preview = document.getElementById('pdf-preview-frame');
    if (preview) preview.src = BabboAPI.viewPDF(id);
    if (btn) { btn.disabled = false; btn.textContent = '📄 Genera PDF'; }
  } catch (e) {
    Toast.show('Errore: ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '📄 Genera PDF'; }
  }
};

// Settings save handlers
window.saveSettings = function() {
  const printerUrl = document.getElementById('setting-printer-url').value.trim();
  const backupPath = document.getElementById('setting-backup-path').value.trim();
  if (printerUrl) localStorage.setItem('printer_url', printerUrl);
  if (backupPath) localStorage.setItem('backup_path', backupPath);
  Toast.show('Impostazioni salvate', 'success');
};

window.doBackup = async function() {
  const backupPath = document.getElementById('setting-backup-path').value.trim();
  if (!backupPath) return Toast.show('Inserisci il percorso di backup prima', 'error');
  try {
    const btn = document.getElementById('btn-backup');
    btn.disabled = true; btn.textContent = 'Backup in corso...';
    const result = await BabboAPI.backup(backupPath);
    Toast.show(`Backup completato! ${result.files} file copiati in ${result.path}`, 'success');
    btn.disabled = false; btn.textContent = '💾 Esegui Backup';
  } catch (e) {
    Toast.show('Errore backup: ' + e.message, 'error');
    const btn = document.getElementById('btn-backup');
    if (btn) { btn.disabled = false; btn.textContent = '💾 Esegui Backup'; }
  }
};

window.changePassword = async function() {
  const oldP = document.getElementById('old-password').value;
  const newP = document.getElementById('new-password').value;
  const confP = document.getElementById('confirm-password').value;
  if (!oldP || !newP) return Toast.show('Compila tutti i campi', 'error');
  if (newP !== confP) return Toast.show('Le password non coincidono', 'error');
  if (newP.length < 6) return Toast.show('La password deve essere di almeno 6 caratteri', 'error');
  try {
    await BabboAPI.changePassword(oldP, newP);
    Toast.show('Password cambiata con successo!', 'success');
    ['old-password', 'new-password', 'confirm-password'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  } catch (e) { Toast.show(e.message, 'error'); }
};

// Search handler
window.onSearchInput = function() {
  clearTimeout(window._searchTimer);
  window._searchTimer = setTimeout(() => App.loadQuotesList(), 400);
};

// Init
document.addEventListener('DOMContentLoaded', () => App.init());
