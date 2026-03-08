// services/pdfGenerator.js
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');

// Register Handlebars helpers
Handlebars.registerHelper('formatCurrency', (value) => {
  return parseFloat(value || 0).toFixed(2).replace('.', ',');
});
Handlebars.registerHelper('formatDate', (dateStr) => {
  return new Date(dateStr).toLocaleDateString('it-IT');
});
Handlebars.registerHelper('add', (a, b) => parseInt(a) + parseInt(b));
Handlebars.registerHelper('multiply', (a, b) => (parseFloat(a) * parseFloat(b)).toFixed(2));

async function generatePDF(quoteData, companyData) {
  const templateSrc = fs.readFileSync(
    path.join(__dirname, '../templates/quote-template.html'), 'utf8'
  );
  const template = Handlebars.compile(templateSrc);
  const html = template({ ...quoteData, company: companyData });

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' }
    });

    const pdfsDir = path.join(__dirname, '../pdfs');
    if (!fs.existsSync(pdfsDir)) fs.mkdirSync(pdfsDir, { recursive: true });

    const filename = `preventivo_${quoteData.quote_number.replace(/[\/\\:]/g, '-')}.pdf`;
    const outputPath = path.join(pdfsDir, filename);
    fs.writeFileSync(outputPath, pdfBuffer);

    return outputPath;
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF };
