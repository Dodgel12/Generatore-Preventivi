// services/backupService.js
const fs = require('fs');
const path = require('path');

async function performBackup(customPath = null) {
  const nasPath = customPath || process.env.BACKUP_PATH;
  if (!nasPath) throw new Error('BACKUP_PATH non configurato in .env');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const destDir = path.join(nasPath, `backup_${timestamp}`);
  fs.mkdirSync(destDir, { recursive: true });

  // Copia database SQLite
  const dbSrc = path.join(__dirname, '../db/quotes.db');
  if (fs.existsSync(dbSrc)) {
    fs.copyFileSync(dbSrc, path.join(destDir, 'quotes.db'));
  }

  // Copia tutti i PDF
  const pdfsDir = path.join(__dirname, '../pdfs');
  let pdfCount = 0;
  if (fs.existsSync(pdfsDir)) {
    const pdfFiles = fs.readdirSync(pdfsDir).filter(f => f.endsWith('.pdf'));
    for (const file of pdfFiles) {
      fs.copyFileSync(path.join(pdfsDir, file), path.join(destDir, file));
    }
    pdfCount = pdfFiles.length;
  }

  return { success: true, path: destDir, files: pdfCount + 1 };
}

module.exports = { performBackup };
