// public/js/quoteForm.js
// Dynamic quote form with live totals and AI assistance

const QuoteForm = {
  items: [],
  editingId: null,
  quoteNumber: null,
  aiEnabled: false,

  init() {
    this.bindEvents();
    BabboAPI.aiStatus().then(s => { this.aiEnabled = s.configured; }).catch(() => {});
  },

  bindEvents() {
    document.getElementById('btn-add-item').addEventListener('click', () => this.addItem());
    document.getElementById('form-tax-rate').addEventListener('input', () => this.recalcTotals());
    document.getElementById('form-discount').addEventListener('input', () => this.recalcTotals());
    document.getElementById('quote-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
  },

  reset(quote = null) {
    this.editingId = quote?.id || null;
    this.quoteNumber = quote?.quote_number || null;
    this.items = quote?.items ? JSON.parse(JSON.stringify(quote.items)) : [];

    const f = document.getElementById('quote-form');
    f.querySelector('#form-client-name').value = quote?.client_name || '';
    f.querySelector('#form-client-email').value = quote?.client_email || '';
    f.querySelector('#form-client-phone').value = quote?.client_phone || '';
    f.querySelector('#form-client-address').value = quote?.client_address || '';
    f.querySelector('#form-client-vat').value = quote?.client_vat || '';
    f.querySelector('#form-title').value = quote?.title || '';
    f.querySelector('#form-notes').value = quote?.notes || '';
    f.querySelector('#form-tax-rate').value = quote?.tax_rate ?? 22;
    f.querySelector('#form-discount').value = quote?.discount || 0;
    f.querySelector('#form-validity').value = quote?.validity_days || 30;
    f.querySelector('#form-status').value = quote?.status || 'draft';

    if (!this.items.length) this.items.push(this.newItem());
    this.renderItems();
    this.recalcTotals();

    const title = document.getElementById('form-view-title');
    title.textContent = quote ? `Modifica ${quote.quote_number}` : 'Nuovo Preventivo';
  },

  newItem() {
    return { description: '', quantity: 1, unit_price: 0, discount: 0, line_total: 0 };
  },

  addItem() {
    this.items.push(this.newItem());
    this.renderItems();
    // Focus on the description of the new row
    const rows = document.querySelectorAll('.item-row');
    const last = rows[rows.length - 1];
    last?.querySelector('input')?.focus();
  },

  removeItem(idx) {
    this.items.splice(idx, 1);
    if (!this.items.length) this.items.push(this.newItem());
    this.renderItems();
    this.recalcTotals();
  },

  renderItems() {
    const container = document.getElementById('items-rows');
    container.innerHTML = '';
    this.items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <input type="text" placeholder="Descrizione prodotto/servizio" value="${this._esc(item.description)}" data-field="description" data-idx="${i}">
        <input type="number" placeholder="1" min="0.01" step="0.01" value="${item.quantity}" data-field="quantity" data-idx="${i}">
        <input type="number" placeholder="0.00" min="0" step="0.01" value="${item.unit_price}" data-field="unit_price" data-idx="${i}">
        <input type="number" placeholder="0" min="0" max="100" step="0.1" value="${item.discount || ''}" data-field="discount" data-idx="${i}">
        <div class="line-total">€ ${this._fmt(item.line_total)}</div>
        <button type="button" class="btn-remove-item" data-idx="${i}" title="Rimuovi riga">×</button>
        ${this.aiEnabled ? `<div class="ai-item-actions" data-idx="${i}"></div>` : ''}
      `;
      container.appendChild(row);
    });

    // Bind events
    container.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        this.items[idx][field] = field === 'description' ? e.target.value : (parseFloat(e.target.value) || 0);
        this.calcLineTotal(idx);
        this.recalcTotals();
        // Update line total display without full re-render
        const rows = container.querySelectorAll('.item-row');
        const ltEl = rows[idx]?.querySelector('.line-total');
        if (ltEl) ltEl.textContent = `€ ${this._fmt(this.items[idx].line_total)}`;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.dataset.field === 'unit_price') {
          e.preventDefault();
          this.addItem();
        }
      });
    });
    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => this.removeItem(parseInt(e.target.dataset.idx)));
    });
  },

  calcLineTotal(idx) {
    const item = this.items[idx];
    const gross = item.quantity * item.unit_price;
    item.line_total = gross * (1 - (item.discount || 0) / 100);
  },

  recalcTotals() {
    this.items.forEach((_, i) => this.calcLineTotal(i));
    const subtotal = this.items.reduce((s, it) => s + it.line_total, 0);
    const taxRate = parseFloat(document.getElementById('form-tax-rate').value) || 0;
    const discount = parseFloat(document.getElementById('form-discount').value) || 0;
    const taxable = subtotal - discount;
    const taxAmount = taxable * (taxRate / 100);
    const total = taxable + taxAmount;

    document.getElementById('total-subtotal').textContent = `€ ${this._fmt(subtotal)}`;
    document.getElementById('total-discount').textContent = discount > 0 ? `− € ${this._fmt(discount)}` : '€ 0,00';
    document.getElementById('total-tax').textContent = `€ ${this._fmt(taxAmount)} (${taxRate}%)`;
    document.getElementById('total-grand').textContent = `€ ${this._fmt(total)}`;
  },

  getFormData() {
    return {
      client_name: document.getElementById('form-client-name').value.trim(),
      client_email: document.getElementById('form-client-email').value.trim(),
      client_phone: document.getElementById('form-client-phone').value.trim(),
      client_address: document.getElementById('form-client-address').value.trim(),
      client_vat: document.getElementById('form-client-vat').value.trim(),
      title: document.getElementById('form-title').value.trim(),
      notes: document.getElementById('form-notes').value.trim(),
      tax_rate: parseFloat(document.getElementById('form-tax-rate').value) || 22,
      discount: parseFloat(document.getElementById('form-discount').value) || 0,
      validity_days: parseInt(document.getElementById('form-validity').value) || 30,
      status: document.getElementById('form-status').value,
      items: this.items,
      subtotal: this.items.reduce((s, it) => s + it.line_total, 0),
      tax_amount: (() => {
        const sub = this.items.reduce((s, it) => s + it.line_total, 0);
        const disc = parseFloat(document.getElementById('form-discount').value) || 0;
        const rate = parseFloat(document.getElementById('form-tax-rate').value) || 0;
        return (sub - disc) * (rate / 100);
      })(),
      total: (() => {
        const sub = this.items.reduce((s, it) => s + it.line_total, 0);
        const disc = parseFloat(document.getElementById('form-discount').value) || 0;
        const rate = parseFloat(document.getElementById('form-tax-rate').value) || 0;
        const taxable = sub - disc;
        return taxable + taxable * (rate / 100);
      })()
    };
  },

  async save() {
    const data = this.getFormData();
    if (!data.client_name) return Toast.show('Nome cliente obbligatorio', 'error');

    const btn = document.getElementById('btn-save-quote');
    btn.disabled = true;
    btn.textContent = 'Salvataggio...';
    try {
      let result;
      if (this.editingId) {
        await BabboAPI.updateQuote(this.editingId, data);
        result = { id: this.editingId };
        Toast.show('Preventivo aggiornato!', 'success');
      } else {
        result = await BabboAPI.createQuote(data);
        Toast.show(`Preventivo ${result.quote_number} creato!`, 'success');
      }
      App.navigate('dashboard');
      App.loadDashboard();
    } catch (err) {
      Toast.show(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Salva Preventivo';
    }
  },

  _esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); },
  _fmt(n) { return parseFloat(n || 0).toFixed(2).replace('.', ','); }
};
