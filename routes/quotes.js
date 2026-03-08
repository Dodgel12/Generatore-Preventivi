// routes/quotes.js
const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('./auth');
const router = express.Router();

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
  res.json(q);
});

// Crea preventivo
router.post('/', requireAuth, (req, res) => {
  const { title, client_name, client_email, client_phone, client_address, client_vat,
    items, subtotal, tax_rate, tax_amount, discount, total, notes, validity_days, status } = req.body;

  if (!client_name) return res.status(400).json({ error: 'Nome cliente obbligatorio' });

  const quote_number = generateQuoteNumber();
  const result = db.prepare(`
    INSERT INTO quotes (quote_number, title, client_name, client_email, client_phone, client_address, client_vat,
      items, subtotal, tax_rate, tax_amount, discount, total, notes, validity_days, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(quote_number, title || '', client_name, client_email || '', client_phone || '',
    client_address || '', client_vat || '', JSON.stringify(items || []),
    subtotal || 0, tax_rate ?? 22, tax_amount || 0, discount || 0, total || 0,
    notes || '', validity_days || 30, status || 'draft', req.session.userId);

  res.json({ success: true, id: result.lastInsertRowid, quote_number });
});

// Aggiorna preventivo
router.put('/:id', requireAuth, (req, res) => {
  const { title, client_name, client_email, client_phone, client_address, client_vat,
    items, subtotal, tax_rate, tax_amount, discount, total, notes, validity_days, status } = req.body;

  const existing = db.prepare('SELECT id FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Preventivo non trovato' });

  db.prepare(`
    UPDATE quotes SET title=?, client_name=?, client_email=?, client_phone=?, client_address=?, client_vat=?,
      items=?, subtotal=?, tax_rate=?, tax_amount=?, discount=?, total=?, notes=?, validity_days=?, status=?,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=?
  `).run(title || '', client_name, client_email || '', client_phone || '', client_address || '', client_vat || '',
    JSON.stringify(items || []), subtotal || 0, tax_rate ?? 22, tax_amount || 0, discount || 0, total || 0,
    notes || '', validity_days || 30, status || 'draft', req.params.id);

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
