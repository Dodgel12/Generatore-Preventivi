// services/printService.js
const ipp = require('ipp');
const fs = require('fs');

/**
 * Invia un PDF alla stampante WiFi via protocollo IPP.
 */
function printPDF(pdfPath, printerUrl = null) {
  const url = printerUrl || process.env.PRINTER_URL;
  if (!url) throw new Error('PRINTER_URL non configurato in .env');

  const pdfBuffer = fs.readFileSync(pdfPath);
  const printer = new ipp.Printer(url);

  const msg = {
    'operation-attributes-tag': {
      'requesting-user-name': 'preventivi-app',
      'job-name': `Preventivo_${Date.now()}`,
      'document-format': 'application/pdf'
    },
    data: pdfBuffer
  };

  return new Promise((resolve, reject) => {
    printer.execute('Print-Job', msg, (err, res) => {
      if (err) return reject(err);
      const status = res['status-code'];
      if (status !== 'successful-ok' && status !== 'successful-ok-ignored-or-substituted-attributes') {
        return reject(new Error(`Errore stampante: ${status}`));
      }
      resolve({ success: true, jobId: res['job-attributes-tag']?.['job-id'] });
    });
  });
}

async function getPrinterInfo(printerUrl) {
  const url = printerUrl || process.env.PRINTER_URL;
  if (!url) throw new Error('PRINTER_URL non configurato');
  const printer = new ipp.Printer(url);
  return new Promise((resolve, reject) => {
    printer.execute('Get-Printer-Attributes', null, (err, res) => {
      if (err) return reject(err);
      resolve(res['printer-attributes-tag']);
    });
  });
}

module.exports = { printPDF, getPrinterInfo };
