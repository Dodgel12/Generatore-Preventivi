// routes/ai.js
const express = require('express');
const { requireAuth } = require('./auth');
const { suggestDescription, suggestPrice, generateQuoteText } = require('../services/aiService');
const router = express.Router();

// Suggerisci descrizione
router.post('/suggest-description', requireAuth, async (req, res) => {
  const { product_name, context } = req.body;
  if (!product_name) return res.status(400).json({ error: 'product_name obbligatorio' });
  try {
    const description = await suggestDescription(product_name, context);
    res.json({ success: true, description });
  } catch (err) {
    res.status(500).json({ error: 'Errore AI: ' + err.message });
  }
});

// Suggerisci prezzo
router.post('/suggest-price', requireAuth, async (req, res) => {
  const { product_name, context } = req.body;
  if (!product_name) return res.status(400).json({ error: 'product_name obbligatorio' });
  try {
    const price = await suggestPrice(product_name, context);
    res.json({ success: true, ...price });
  } catch (err) {
    res.status(500).json({ error: 'Errore AI: ' + err.message });
  }
});

// Genera testo introduttivo preventivo
router.post('/suggest-text', requireAuth, async (req, res) => {
  const { client_name, items } = req.body;
  if (!client_name) return res.status(400).json({ error: 'client_name obbligatorio' });
  try {
    const text = await generateQuoteText(client_name, items || []);
    res.json({ success: true, text });
  } catch (err) {
    res.status(500).json({ error: 'Errore AI: ' + err.message });
  }
});

// Verifica se AI è configurata
router.get('/status', requireAuth, (req, res) => {
  const configured = !!process.env.GEMINI_API_KEY;
  res.json({ configured, model: 'gemini-2.5-flash' });
});

module.exports = router;
