// services/aiService.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

let genAI = null;
let model = null;

function getModel() {
  if (!model) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY non configurato in .env');
    genAI = new GoogleGenerativeAI(apiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  }
  return model;
}

async function suggestDescription(productName, context = '') {
  const m = getModel();
  const prompt = `Sei un assistente commerciale italiano. Scrivi una descrizione professionale e concisa (max 2 righe) per questa voce in un preventivo: "${productName}". ${context ? 'Contesto: ' + context : ''} Rispondi solo con la descrizione, senza prefissi.`;
  const result = await m.generateContent(prompt);
  return result.response.text().trim();
}

async function suggestPrice(productName, marketContext = '') {
  const m = getModel();
  const prompt = `Suggerisci un range di prezzo di mercato italiano (in EUR) per: "${productName}". ${marketContext}. Rispondi SOLO con JSON valido, nessun testo extra: {"min": X, "max": Y, "note": "..."}`;
  const result = await m.generateContent(prompt);
  const text = result.response.text().replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(text);
  } catch {
    return { min: null, max: null, note: text };
  }
}

async function generateQuoteText(clientInfo, items) {
  const m = getModel();
  const itemList = items.map(i => `- ${i.description}: ${i.quantity} x €${i.unit_price}`).join('\n');
  const prompt = `Scrivi un testo professionale e cordiale per un preventivo italiano indirizzato a ${clientInfo}. 
Prodotti/servizi inclusi:\n${itemList}\n
Il testo deve essere max 3 frasi, professionale, in italiano. Rispondi solo con il testo.`;
  const result = await m.generateContent(prompt);
  return result.response.text().trim();
}

module.exports = { suggestDescription, suggestPrice, generateQuoteText };
