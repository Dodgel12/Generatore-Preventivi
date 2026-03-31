// routes/quotes.js
const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('./auth');
const router = express.Router();

function toNumber(v, fallback = 0) {
  const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeItem(raw, pricingMode = 'unit') {
  const item = {
    description: (raw?.description || '').toString(),
    notes: raw?.notes ? raw.notes.toString() : '',
    quantity: Math.max(toNumber(raw?.quantity, 1), 0),
    unit_price: Math.max(toNumber(raw?.unit_price, 0), 0),
    discount: Math.max(Math.min(toNumber(raw?.discount, 0), 100), 0),
    line_total: Math.max(toNumber(raw?.line_total, 0), 0)
  };

  if (pricingMode === 'total') {
    // Total-only mode: line_total is user-entered. Keep other numeric fields harmless.
    item.quantity = item.quantity || 1;
    item.unit_price = 0;
    item.discount = 0;
    item.line_total = Math.max(toNumber(raw?.line_total, item.line_total), 0);
    return item;
  }

  const gross = item.quantity * item.unit_price;
  item.line_total = gross * (1 - (item.discount || 0) / 100);
  return item;
}

function calcTabTotals(tab) {
  const subtotal = (tab.items || []).reduce((s, it) => s + toNumber(it.line_total, 0), 0);
  const discount = Math.max(toNumber(tab.discount, 0), 0);
  const tax_rate = Math.max(toNumber(tab.tax_rate, 22), 0);
  const taxable = subtotal - discount;
  const tax_amount = taxable * (tax_rate / 100);
  const total = taxable + tax_amount;

  return {
    ...tab,
    subtotal,
    discount,
    tax_rate,
    tax_amount,
    total
  };
}

function normalizeTabs(body) {
  const inputTabs = Array.isArray(body?.tabs) ? body.tabs : null;
  if (inputTabs && inputTabs.length) {
    return inputTabs.map((t, idx) => {
      const pricing_mode = (t?.pricing_mode || body?.pricing_mode || 'unit').toString();
      const itemsRaw = Array.isArray(t?.items) ? t.items : [];
      const items = itemsRaw.map(it => normalizeItem(it, pricing_mode));
      const tab = {
        name: (t?.name || `Preventivo ${idx + 1}`).toString(),
        pricing_mode,
        items,
        tax_rate: t?.tax_rate ?? body?.tax_rate,
        discount: t?.discount ?? body?.discount,
        validity_days: (t?.validity_days === '' || t?.validity_days === undefined) ? null : (t?.validity_days ?? body?.validity_days ?? null),
        notes: (t?.notes ?? '').toString()
      };
      return calcTabTotals(tab);
    });
  }

  // Legacy/single-tab payload
  const pricing_mode = (body?.pricing_mode || 'unit').toString();
  const itemsRaw = Array.isArray(body?.items) ? body.items : [];
  const items = itemsRaw.map(it => normalizeItem(it, pricing_mode));
  const tab = {
    name: 'Preventivo',
    pricing_mode,
    items,
    tax_rate: body?.tax_rate,
    discount: body?.discount,
    validity_days: (body?.validity_days === '' || body?.validity_days === undefined) ? null : (body?.validity_days ?? null),
    notes: (body?.notes ?? '').toString()
  };
  return [calcTabTotals(tab)];
}

// Helper: genera numero preventivo sequenziale
function generateQuoteNumber() {
  const year = new Date().getFullYear();
  const last = db.prepare("SELECT quote_number FROM quotes WHERE quote_number LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`PRE-${year}-%`);
  let seq = 1;
  if (last) {
    const parts = last.quote_number.split('-');
    seq = parseInt(parts[parts.length - 1]) + 1;
  }
  return `PRE-${year}-${String(seq).padStart(4, '0')}`;
}

// Lista preventivi
router.get('/', requireAuth, (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query;
  let query = 'SELECT id, quote_number, title, client_name, client_email, total, status, created_at, updated_at FROM quotes WHERE 1=1';
  const params = [];

  if (status) { query += ' AND status = ?'; params.push(status); }
  if (search) {
    query += ' AND (client_name LIKE ? OR quote_number LIKE ? OR title LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

  const quotes = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM quotes').get().count;
  res.json({ quotes, total, page: parseInt(page), limit: parseInt(limit) });
});

// Stats dashboard
router.get('/stats', requireAuth, (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count FROM quotes').get().count;
  const byStatus = db.prepare('SELECT status, COUNT(*) as count FROM quotes GROUP BY status').all();
  const totalValue = db.prepare('SELECT SUM(total) as sum FROM quotes WHERE status != ?').get('rejected').sum || 0;
  const recentMonth = db.prepare("SELECT COUNT(*) as count FROM quotes WHERE created_at >= date('now','-30 days')").get().count;
  res.json({ total, byStatus, totalValue, recentMonth });
});

// Singolo preventivo
router.get('/:id', requireAuth, (req, res) => {
  const q = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Preventivo non trovato' });
  q.items = JSON.parse(q.items || '[]');
  q.tabs = (() => {
    try {
      const t = JSON.parse(q.tabs || '[]');
      return Array.isArray(t) ? t : [];
    } catch {
      return [];
    }
  })();

  // Backward compatibility: if tabs are empty, expose a single tab built from legacy fields
  if (!q.tabs.length) {
    q.tabs = [
      {
        name: 'Preventivo',
        pricing_mode: q.pricing_mode || 'unit',
        items: q.items,
        tax_rate: q.tax_rate ?? 22,
        discount: q.discount ?? 0,
        validity_days: q.validity_days ?? null,
        notes: q.notes || '',
        subtotal: q.subtotal ?? 0,
        tax_amount: q.tax_amount ?? 0,
        total: q.total ?? 0
      }
    ];
  }
  res.json(q);
});

// Crea preventivo
router.post('/', requireAuth, (req, res) => {
  const { title, client_name, client_email, client_phone, client_address, client_vat, status } = req.body;

  if (!client_name) return res.status(400).json({ error: 'Nome cliente obbligatorio' });

  const tabs = normalizeTabs(req.body);
  const overall = {
    subtotal: tabs.reduce((s, t) => s + toNumber(t.subtotal, 0), 0),
    tax_amount: tabs.reduce((s, t) => s + toNumber(t.tax_amount, 0), 0),
    discount: tabs.reduce((s, t) => s + toNumber(t.discount, 0), 0),
    total: tabs.reduce((s, t) => s + toNumber(t.total, 0), 0)
  };
  const first = tabs[0] || { items: [], pricing_mode: 'unit', tax_rate: 22, notes: '', validity_days: null };

  const quote_number = generateQuoteNumber();
  const result = db.prepare(`
    INSERT INTO quotes (quote_number, title, client_name, client_email, client_phone, client_address, client_vat,
      items, tabs, pricing_mode, subtotal, tax_rate, tax_amount, discount, total, notes, validity_days, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    quote_number,
    title || '',
    client_name,
    client_email || '',
    client_phone || '',
    client_address || '',
    client_vat || '',
    JSON.stringify(first.items || []),
    JSON.stringify(tabs),
    first.pricing_mode || 'unit',
    overall.subtotal,
    first.tax_rate ?? 22,
    overall.tax_amount,
    overall.discount,
    overall.total,
    (req.body?.notes ?? first.notes ?? '').toString(),
    (req.body?.validity_days === '' || req.body?.validity_days === undefined) ? null : (req.body?.validity_days ?? first.validity_days ?? null),
    status || 'draft',
    req.session.userId
  );

  res.json({ success: true, id: result.lastInsertRowid, quote_number });
});

// Aggiorna preventivo
router.put('/:id', requireAuth, (req, res) => {
  const { title, client_name, client_email, client_phone, client_address, client_vat, status } = req.body;

  const existing = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Preventivo non trovato' });

  const tabs = normalizeTabs(req.body);
  const overall = {
    subtotal: tabs.reduce((s, t) => s + toNumber(t.subtotal, 0), 0),
    tax_amount: tabs.reduce((s, t) => s + toNumber(t.tax_amount, 0), 0),
    discount: tabs.reduce((s, t) => s + toNumber(t.discount, 0), 0),
    total: tabs.reduce((s, t) => s + toNumber(t.total, 0), 0)
  };
  const first = tabs[0] || { items: [], pricing_mode: 'unit', tax_rate: 22, notes: '', validity_days: null };

  db.prepare(`
    UPDATE quotes SET title=?, client_name=?, client_email=?, client_phone=?, client_address=?, client_vat=?,
      items=?, tabs=?, pricing_mode=?, subtotal=?, tax_rate=?, tax_amount=?, discount=?, total=?, notes=?, validity_days=?, status=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(
    title || '',
    client_name,
    client_email || '',
    client_phone || '',
    client_address || '',
    client_vat || '',
    JSON.stringify(first.items || []),
    JSON.stringify(tabs),
    first.pricing_mode || 'unit',
    overall.subtotal,
    first.tax_rate ?? 22,
    overall.tax_amount,
    overall.discount,
    overall.total,
    (req.body?.notes ?? first.notes ?? '').toString(),
    (req.body?.validity_days === '' || req.body?.validity_days === undefined) ? null : (req.body?.validity_days ?? first.validity_days ?? null),
    status || 'draft',
    req.params.id
  );

  res.json({ success: true });
});

// Aggiorna stato preventivo
router.patch('/:id/status', requireAuth, (req, res) => {
  const { status } = req.body;
  const existing = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Preventivo non trovato' });

  db.prepare('UPDATE quotes SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(status || 'draft', req.params.id);

  res.json({ success: true });
});

// Elimina preventivo
router.delete('/:id', requireAuth, (req, res) => {
  const existing = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Preventivo non trovato' });
  db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
