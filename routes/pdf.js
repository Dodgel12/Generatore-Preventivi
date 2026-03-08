// routes/pdf.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/database');
const { requireAuth } = require('./auth');
const { generatePDF } = require('../services/pdfGenerator');
const router = express.Router();

function getCompanyData() {
  return {
    name: process.env.COMPANY_NAME || 'Antoni Gabriele',
    vat: process.env.COMPANY_VAT || '',
    address: process.env.COMPANY_ADDRESS || '',
    email: process.env.COMPANY_EMAIL || '',
    phone: process.env.COMPANY_PHONE || ''
  };
}

// Genera PDF per un preventivo
router.post('/generate/:id', requireAuth, async (req, res) => {
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });

  try {
    quote.items = JSON.parse(quote.items || '[]');
    const pdfPath = await generatePDF(quote, getCompanyData());

    // Aggiorna il path nel DB
    db.prepare('UPDATE quotes SET pdf_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(pdfPath, req.params.id);

    res.json({ success: true, pdf_path: pdfPath, filename: path.basename(pdfPath) });
  } catch (err) {
    console.error('[PDF] Errore generazione:', err);
    res.status(500).json({ error: 'Errore nella generazione del PDF: ' + err.message });
  }
});

// Stream PDF al browser
router.get('/view/:id', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT pdf_path FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote || !quote.pdf_path) {
    return res.status(404).json({ error: 'PDF non trovato. Generalo prima.' });
  }
  if (!fs.existsSync(quote.pdf_path)) {
    return res.status(404).json({ error: 'File PDF non trovato su disco' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="${path.basename(quote.pdf_path)}"`);
  fs.createReadStream(quote.pdf_path).pipe(res);
});

// Download PDF
router.get('/download/:id', requireAuth, (req, res) => {
  const quote = db.prepare('SELECT pdf_path, quote_number FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote || !quote.pdf_path || !fs.existsSync(quote.pdf_path)) {
    return res.status(404).json({ error: 'PDF non trovato' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Preventivo_${quote.quote_number}.pdf"`);
  fs.createReadStream(quote.pdf_path).pipe(res);
});

module.exports = router;
