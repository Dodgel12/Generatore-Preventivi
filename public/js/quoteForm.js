// public/js/quoteForm.js
// Dynamic quote form with live totals and AI assistance

const QuoteForm = {
  tabs: [],
  activeTab: 0,
  editingId: null,
  quoteNumber: null,
  aiEnabled: false,
  showOverallTotal: false,

  init() {
    this.bindEvents();
    BabboAPI.aiStatus().then(s => { this.aiEnabled = s.configured; }).catch(() => {});
  },

  bindEvents() {
    document.getElementById('btn-add-item').addEventListener('click', () => this.addItem());
    document.getElementById('form-tax-rate').addEventListener('input', (e) => {
      this.currentTab().tax_rate = parseFloat(e.target.value) || 0;
      this.recalcTotals();
    });
    document.getElementById('form-discount').addEventListener('input', (e) => {
      this.currentTab().discount = parseFloat(e.target.value) || 0;
      this.recalcTotals();
    });
    document.getElementById('form-validity').addEventListener('input', (e) => {
      const v = e.target.value;
      if (v === '') { this.currentTab().validity_days = null; return; }
      const n = parseInt(v);
      this.currentTab().validity_days = (!Number.isFinite(n) || n <= 0) ? null : n;
    });
    document.getElementById('form-notes').addEventListener('input', (e) => {
      this.currentTab().notes = e.target.value;
    });
    document.getElementById('form-tab-name').addEventListener('input', (e) => {
      this.currentTab().name = e.target.value;
      this.renderTabs();
    });
    document.getElementById('form-pricing-mode').addEventListener('change', (e) => {
      this.setPricingMode(e.target.value);
    });

    document.getElementById('form-show-overall-total').addEventListener('change', (e) => {
      this.showOverallTotal = !!e.target.checked;
    });

    document.getElementById('form-single-total').addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      this.currentTab().single_total = Number.isFinite(v) ? Math.max(v, 0) : 0;
      this.recalcTotals();
    });

    const tabBar = document.getElementById('quote-tabs');
    tabBar.addEventListener('click', (e) => {
      const pill = e.target.closest('.tab-pill');
      if (pill && pill.dataset.tab != null) {
        this.setActiveTab(parseInt(pill.dataset.tab));
        return;
      }
      if (e.target.id === 'btn-add-tab') {
        this.addTab();
        return;
      }
      if (e.target.id === 'btn-remove-tab') {
        this.removeActiveTab();
        return;
      }
    });

    document.getElementById('quote-form').addEventListener('submit', (e) => { e.preventDefault(); this.save(); });
  },

  reset(quote = null) {
    this.editingId = quote?.id || null;
    this.quoteNumber = quote?.quote_number || null;
    this.tabs = this._normalizeTabsFromQuote(quote);
    this.activeTab = 0;
    this.showOverallTotal = !!(quote?.show_overall_total);

    const f = document.getElementById('quote-form');
    f.querySelector('#form-client-name').value = quote?.client_name || '';
    f.querySelector('#form-client-email').value = quote?.client_email || '';
    f.querySelector('#form-client-phone').value = quote?.client_phone || '';
    f.querySelector('#form-client-address').value = quote?.client_address || '';
    f.querySelector('#form-client-vat').value = quote?.client_vat || '';
    f.querySelector('#form-title').value = quote?.title || '';
    f.querySelector('#form-status').value = quote?.status || 'draft';

    const showOverallEl = f.querySelector('#form-show-overall-total');
    if (showOverallEl) showOverallEl.checked = this.showOverallTotal;

    this.renderTabs();
    this.setActiveTab(0);

    const title = document.getElementById('form-view-title');
    title.textContent = quote ? `Modifica ${quote.quote_number}` : 'Nuovo Preventivo';
  },

  currentTab() {
    if (!this.tabs.length) this.tabs = [this.newTab()];
    return this.tabs[this.activeTab] || this.tabs[0];
  },

  newTab() {
    return {
      name: `Preventivo ${this.tabs.length + 1}`,
      pricing_mode: 'unit',
      items: [this.newItem('unit')],
      tax_rate: 22,
      discount: 0,
      validity_days: null,
      notes: '',
      single_total: 0
    };
  },

  newItem(mode = 'unit') {
    if (mode === 'total') return { description: '', quantity: 1, unit_price: 0, discount: 0, line_total: 0 };
    return { description: '', quantity: 1, unit_price: 0, discount: 0, line_total: 0 };
  },

  addTab() {
    this.tabs.push(this.newTab());
    this.setActiveTab(this.tabs.length - 1);
  },

  removeActiveTab() {
    if (this.tabs.length <= 1) return;
    this.tabs.splice(this.activeTab, 1);
    this.setActiveTab(Math.max(0, this.activeTab - 1));
  },

  setActiveTab(idx) {
    this.activeTab = Math.max(0, Math.min(idx, this.tabs.length - 1));
    const tab = this.currentTab();

    document.getElementById('form-tab-name').value = tab.name || '';
    document.getElementById('form-pricing-mode').value = tab.pricing_mode || 'unit';
    document.getElementById('form-tax-rate').value = tab.tax_rate ?? 22;
    document.getElementById('form-discount').value = tab.discount ?? 0;
    document.getElementById('form-validity').value = tab.validity_days == null ? '' : tab.validity_days;
    document.getElementById('form-notes').value = tab.notes || '';
    document.getElementById('form-single-total').value = tab.single_total ?? 0;

    this.applyPricingModeUI();
    this.renderTabs();
    this.renderItemsHeader();
    this.renderItems();
    this.recalcTotals();
  },

  setPricingMode(mode) {
    const tab = this.currentTab();
    const next = mode === 'single' ? 'single' : 'unit';
    const prev = (tab.pricing_mode || 'unit');
    if (prev === next) return;

    // Convert items in-place
    if (next === 'single') {
      // Carry over current computed total as default single_total
      this.recalcTotals();
      tab.single_total = tab.total || tab.subtotal || 0;
      tab.items.forEach((it) => {
        it.quantity = 1;
        it.unit_price = 0;
        it.discount = 0;
        it.line_total = 0;
      });
      tab.tax_rate = 0;
      tab.discount = 0;
    } else {
      tab.items.forEach((it) => {
        it.quantity = it.quantity || 1;
        it.unit_price = it.unit_price || 0;
        it.discount = it.discount || 0;
      });
      if (!Number.isFinite(parseFloat(tab.tax_rate))) tab.tax_rate = 22;
    }

    tab.pricing_mode = next;

    this.applyPricingModeUI();
    this.renderItemsHeader();
    this.renderItems();
    this.recalcTotals();
  },

  applyPricingModeUI() {
    const wrap = document.querySelector('.items-table-wrap');
    const tab = this.currentTab();
    const isSingle = (tab.pricing_mode || 'unit') === 'single';
    if (wrap) wrap.classList.toggle('pricing-single', isSingle);

    // Toggle single-total input + disable tax/discount in single mode
    const singleWrap = document.getElementById('single-total-wrap');
    if (singleWrap) singleWrap.style.display = isSingle ? '' : 'none';

    const taxEl = document.getElementById('form-tax-rate');
    const discEl = document.getElementById('form-discount');
    if (taxEl) taxEl.disabled = isSingle;
    if (discEl) discEl.disabled = isSingle;
  },

  addItem() {
    const tab = this.currentTab();
    tab.items.push(this.newItem(tab.pricing_mode || 'unit'));
    this.renderItems();
    // Focus on the description of the new row
    const rows = document.querySelectorAll('.item-row');
    const last = rows[rows.length - 1];
    last?.querySelector('input')?.focus();
  },

  removeItem(idx) {
    const tab = this.currentTab();
    tab.items.splice(idx, 1);
    if (!tab.items.length) tab.items.push(this.newItem(tab.pricing_mode || 'unit'));
    this.renderItems();
    this.recalcTotals();
  },

  renderTabs() {
    const bar = document.getElementById('quote-tabs');
    if (!bar) return;
    const pills = this.tabs.map((t, i) => {
      const name = (t?.name || `Preventivo ${i + 1}`);
      return `<button type="button" class="tab-pill ${i === this.activeTab ? 'active' : ''}" data-tab="${i}">${this._esc(name)}</button>`;
    }).join('');

    const actions = `
      <div class="tab-actions">
        <button type="button" class="btn btn-ghost btn-sm" id="btn-add-tab">+ Tab</button>
        ${this.tabs.length > 1 ? '<button type="button" class="btn btn-ghost btn-sm" id="btn-remove-tab">Rimuovi Tab</button>' : ''}
      </div>
    `;
    bar.innerHTML = pills + actions;
  },

  renderItemsHeader() {
    const h = document.getElementById('items-table-header');
    if (!h) return;
    const mode = this.currentTab().pricing_mode || 'unit';
    if (mode === 'single') {
      h.innerHTML = `
        <span>Descrizione</span>
        <span></span>
      `;
      return;
    }
    h.innerHTML = `
      <span>Descrizione</span>
      <span>Qtà</span>
      <span>Prezzo Unit.</span>
      <span>Sc. %</span>
      <span style="text-align:right">Totale</span>
      <span></span>
    `;
  },

  renderItems() {
    const container = document.getElementById('items-rows');
    container.innerHTML = '';
    const tab = this.currentTab();
    const mode = tab.pricing_mode || 'unit';

    tab.items.forEach((item, i) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      if (mode === 'single') {
        row.innerHTML = `
          <input type="text" placeholder="Descrizione prodotto/servizio" value="${this._esc(item.description)}" data-field="description" data-idx="${i}">
          <button type="button" class="btn-remove-item" data-idx="${i}" title="Rimuovi riga">×</button>
        `;
      } else {
        row.innerHTML = `
          <input type="text" placeholder="Descrizione prodotto/servizio" value="${this._esc(item.description)}" data-field="description" data-idx="${i}">
          <input type="number" placeholder="1" min="0.01" step="0.01" value="${item.quantity}" data-field="quantity" data-idx="${i}">
          <input type="number" placeholder="0.00" min="0" step="0.01" value="${item.unit_price}" data-field="unit_price" data-idx="${i}">
          <input type="number" placeholder="0" min="0" max="100" step="0.1" value="${item.discount || ''}" data-field="discount" data-idx="${i}">
          <div class="line-total">€ ${this._fmt(item.line_total)}</div>
          <button type="button" class="btn-remove-item" data-idx="${i}" title="Rimuovi riga">×</button>
          ${this.aiEnabled ? `<div class="ai-item-actions" data-idx="${i}"></div>` : ''}
        `;
      }
      container.appendChild(row);
    });

    // Bind events
    container.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('input', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        const field = e.target.dataset.field;
        const tab = this.currentTab();
        tab.items[idx][field] = field === 'description' ? e.target.value : (parseFloat(e.target.value) || 0);
        this.calcLineTotal(idx, tab);
        this.recalcTotals();
        // Update line total display without full re-render
        const rows = container.querySelectorAll('.item-row');
        const ltEl = rows[idx]?.querySelector('.line-total');
        if (ltEl) ltEl.textContent = `€ ${this._fmt(tab.items[idx].line_total)}`;
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (input.dataset.field === 'unit_price')) {
          e.preventDefault();
          this.addItem();
        }
      });
    });
    container.querySelectorAll('.btn-remove-item').forEach(btn => {
      btn.addEventListener('click', (e) => this.removeItem(parseInt(e.target.dataset.idx)));
    });
  },

  calcLineTotal(idx, tab = null) {
    const t = tab || this.currentTab();
    const mode = t.pricing_mode || 'unit';
    const item = t.items[idx];
    if (!item) return;
    if (mode === 'single') {
      item.line_total = 0;
      return;
    }
    const gross = (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
    item.line_total = gross * (1 - (parseFloat(item.discount) || 0) / 100);
  },

  recalcTotals() {
    const tab = this.currentTab();
    tab.items.forEach((_, i) => this.calcLineTotal(i, tab));

    const mode = tab.pricing_mode || 'unit';
    let subtotal, taxRate, discount, taxAmount, total;

    if (mode === 'single') {
      subtotal = parseFloat(tab.single_total) || 0;
      taxRate = 0;
      discount = 0;
      taxAmount = 0;
      total = subtotal;
      // Keep form controls aligned
      tab.tax_rate = 0;
      tab.discount = 0;
    } else {
      subtotal = tab.items.reduce((s, it) => s + (parseFloat(it.line_total) || 0), 0);
      taxRate = parseFloat(tab.tax_rate) || 0;
      discount = parseFloat(tab.discount) || 0;
      const taxable = subtotal - discount;
      taxAmount = taxable * (taxRate / 100);
      total = taxable + taxAmount;
    }

    tab.subtotal = subtotal;
    tab.tax_amount = taxAmount;
    tab.total = total;

    document.getElementById('total-subtotal').textContent = `€ ${this._fmt(subtotal)}`;
    document.getElementById('total-discount').textContent = discount > 0 ? `− € ${this._fmt(discount)}` : '€ 0,00';
    document.getElementById('total-tax').textContent = `€ ${this._fmt(taxAmount)} (${taxRate}%)`;
    document.getElementById('total-grand').textContent = `€ ${this._fmt(total)}`;
  },

  getFormData() {
    // Ensure every tab has up-to-date totals
    this.tabs.forEach((t) => {
      t.items = Array.isArray(t.items) ? t.items : [];
      t.items.forEach((_, i) => this.calcLineTotal(i, t));
      const mode = t.pricing_mode || 'unit';
      if (mode === 'single') {
        const single = parseFloat(t.single_total) || 0;
        t.subtotal = single;
        t.discount = 0;
        t.tax_rate = 0;
        t.tax_amount = 0;
        t.total = single;
      } else {
        const sub = t.items.reduce((s, it) => s + (parseFloat(it.line_total) || 0), 0);
        const disc = parseFloat(t.discount) || 0;
        const rate = parseFloat(t.tax_rate) || 0;
        const taxable = sub - disc;
        t.subtotal = sub;
        t.tax_amount = taxable * (rate / 100);
        t.total = taxable + t.tax_amount;
      }
    });

    const overallSubtotal = this.tabs.reduce((s, t) => s + (parseFloat(t.subtotal) || 0), 0);
    const overallDiscount = this.tabs.reduce((s, t) => s + (parseFloat(t.discount) || 0), 0);
    const overallTax = this.tabs.reduce((s, t) => s + (parseFloat(t.tax_amount) || 0), 0);
    const overallTotal = this.tabs.reduce((s, t) => s + (parseFloat(t.total) || 0), 0);

    const first = this.tabs[0] || this.newTab();

    return {
      client_name: document.getElementById('form-client-name').value.trim(),
      client_email: document.getElementById('form-client-email').value.trim(),
      client_phone: document.getElementById('form-client-phone').value.trim(),
      client_address: document.getElementById('form-client-address').value.trim(),
      client_vat: document.getElementById('form-client-vat').value.trim(),
      title: document.getElementById('form-title').value.trim(),
      status: document.getElementById('form-status').value,

      show_overall_total: !!this.showOverallTotal,
      // New format
      tabs: this.tabs,

      // Aggregates (used by list/stats)
      subtotal: overallSubtotal,
      discount: overallDiscount,
      tax_amount: overallTax,
      total: overallTotal,

      // Legacy fields (server can ignore, but keep for compatibility)
      pricing_mode: first.pricing_mode || 'unit',
      tax_rate: first.tax_rate ?? 22,
      validity_days: first.validity_days ?? null,
      notes: (first.notes || '').trim(),
      items: first.items || []
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

  _normalizeTabsFromQuote(quote) {
    const fromApiTabs = Array.isArray(quote?.tabs) ? quote.tabs : null;
    const tabs = (fromApiTabs && fromApiTabs.length) ? JSON.parse(JSON.stringify(fromApiTabs)) : null;
    if (tabs) {
      // Ensure minimal fields
      return tabs.map((t, idx) => ({
        name: t?.name || `Preventivo ${idx + 1}`,
        pricing_mode: t?.pricing_mode || quote?.pricing_mode || 'unit',
        items: Array.isArray(t?.items) ? t.items : (Array.isArray(quote?.items) ? quote.items : []),
        tax_rate: (t?.tax_rate ?? quote?.tax_rate ?? 22),
        discount: (t?.discount ?? quote?.discount ?? 0),
        validity_days: (t?.validity_days ?? quote?.validity_days ?? null),
        notes: (t?.notes ?? quote?.notes ?? ''),
        single_total: (t?.single_total ?? t?.subtotal ?? t?.total ?? 0),
        subtotal: t?.subtotal,
        tax_amount: t?.tax_amount,
        total: t?.total
      }));
    }

    const legacyItems = Array.isArray(quote?.items) ? JSON.parse(JSON.stringify(quote.items)) : [];
    return [{
      name: 'Preventivo',
      pricing_mode: quote?.pricing_mode || 'unit',
      items: legacyItems.length ? legacyItems : [this.newItem('unit')],
      tax_rate: quote?.tax_rate ?? 22,
      discount: quote?.discount ?? 0,
      validity_days: quote?.validity_days ?? null,
      notes: quote?.notes || '',
      single_total: quote?.total ?? 0,
      subtotal: quote?.subtotal,
      tax_amount: quote?.tax_amount,
      total: quote?.total
    }];
  },

  _esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); },
  _fmt(n) { return parseFloat(n || 0).toFixed(2).replace('.', ','); }
};
