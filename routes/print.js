// routes/print.js
const express = require('express');
const db = require('../db/database');
const { requireAuth } = require('./auth');
const { printPDF, getPrinterInfo } = require('../services/printService');
const router = express.Router();

// Stampa preventivo
router.post('/:id', requireAuth, async (req, res) => {
  const quote = db.prepare('SELECT pdf_path, quote_number FROM quotes WHERE id = ?').get(req.params.id);
  if (!quote) return res.status(404).json({ error: 'Preventivo non trovato' });
  if (!quote.pdf_path) return res.status(400).json({ error: 'Genera prima il PDF del preventivo' });

  const printerUrl = req.body.printer_url || process.env.PRINTER_URL;
  if (!printerUrl) return res.status(400).json({ error: 'PRINTER_URL non configurato. Vai in Impostazioni.' });

  try {
    const result = await printPDF(quote.pdf_path, printerUrl);
    res.json({ success: true, ...result });
  } catch (err) {
    console.error('[PRINT] Errore stampa:', err);
    res.status(500).json({ error: 'Errore stampa: ' + err.message });
  }
});

// Info stampante
router.get('/info', requireAuth, async (req, res) => {
  try {
    const info = await getPrinterInfo(req.query.url || null);
    res.json(info);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
