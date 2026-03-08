// routes/backup.js
const express = require('express');
const { requireAuth } = require('./auth');
const { performBackup } = require('../services/backupService');
const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { custom_path } = req.body;
  try {
    const result = await performBackup(custom_path || null);
    res.json(result);
  } catch (err) {
    console.error('[BACKUP] Errore:', err);
    res.status(500).json({ error: 'Errore backup: ' + err.message });
  }
});

module.exports = router;
