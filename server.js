// server.js
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Crea cartelle necessarie
['pdfs', 'backups'].forEach(dir => {
  const p = path.join(__dirname, dir);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Middleware
app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'preventivi-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000 // 8 ore
  }
}));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/quotes', require('./routes/quotes'));
app.use('/api/pdf', require('./routes/pdf'));
app.use('/api/print', require('./routes/print'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/backup', require('./routes/backup'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ ok: true, time: new Date().toISOString(), version: '1.0.0' });
});

// SPA fallback — serve index.html per tutte le rotte non-API
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Babbo Preventivi avviato su http://localhost:${PORT}`);
  console.log(`📋 Login: admin / admin123`);
  console.log(`   (Cambia la password subito in Impostazioni!)\n`);
});

module.exports = app;
