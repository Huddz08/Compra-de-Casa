import { priceCandidates } from './domain.js';

// Keep the ordering explicit: prefer an identified retail price, otherwise the
// first monetary value in reading order. Alternatives remain available in UI.
export function suggestedPrices(text) {
  const prices = priceCandidates(text);
  const retail = text.split(/\r?\n/).flatMap((line, index, lines) => {
    if (!/varejo|pre[cç]o\s+(?:unit[aá]rio|normal)/i.test(line)) return [];
    const inline = priceCandidates(line);
    return inline.length ? inline : priceCandidates(lines[index + 1] || '');
  }).find(price => prices.includes(price));
  return retail == null ? prices : [retail, ...prices.filter(p => p !== retail)];
}

export async function recognizePrices(image, onProgress = () => {}) {
  // The CDN ESM bundle exports Tesseract as default, not createWorker by name.
  const { default: Tesseract } = await import('https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js');
  let worker;
  try {
    worker = await Tesseract.createWorker('eng', 1, {
      logger: message => { if (message.status === 'recognizing text') onProgress(Math.round(message.progress * 100)); }
    });
    await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
    const { data } = await worker.recognize(image);
    return suggestedPrices(data.text);
  } finally {
    if (worker) await worker.terminate();
  }
}

export function fillSuggestedPrice(input, prices) {
  input.value = prices.length ? prices[0].toFixed(2) : '';
  return prices.length > 0;
}
