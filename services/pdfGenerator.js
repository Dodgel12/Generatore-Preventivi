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
Handlebars.registerHelper('eq', (a, b) => a === b);

function ensureTabs(quoteData) {
  const tabs = Array.isArray(quoteData?.tabs) ? quoteData.tabs : [];
  if (tabs.length) {
    const overall_total = tabs.reduce((s, t) => s + (parseFloat(t?.total || 0) || 0), 0);
    const show_overall_total_section = !!quoteData?.show_overall_total && tabs.length > 1;
    return { ...quoteData, overall_total, show_overall_total_section };
  }
  const items = Array.isArray(quoteData?.items) ? quoteData.items : [];
  return {
    ...quoteData,
    tabs: [
      {
        name: 'Preventivo',
        pricing_mode: quoteData?.pricing_mode || 'unit',
        items,
        tax_rate: quoteData?.tax_rate ?? 22,
        discount: quoteData?.discount ?? 0,
        validity_days: quoteData?.validity_days ?? null,
        notes: quoteData?.notes || '',
        subtotal: quoteData?.subtotal ?? 0,
        tax_amount: quoteData?.tax_amount ?? 0,
        total: quoteData?.total ?? 0
      }
    ],
    overall_total: parseFloat(quoteData?.total || 0) || 0,
    show_overall_total_section: false
  };
}

async function generatePDF(quoteData, companyData) {
  const templateSrc = fs.readFileSync(
    path.join(__dirname, '../templates/quote-template.html'), 'utf8'
  );
  const template = Handlebars.compile(templateSrc);
  const normalized = ensureTabs(quoteData);
  const html = template({ ...normalized, company: companyData });

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
