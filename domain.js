export const uid = () => crypto.randomUUID();
export const emptyState = () => ({ products: [], lists: [], revision: 0 });
export const money = n => n == null ? 'Sem preço' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
export const normalize = s => String(s).trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
export const productKey = p => [p.name, p.brand, p.type, Number(p.size), p.unit].map(normalize).join('|');
export const total = (list, checkedOnly = false) => list.items.reduce((s, i) => s + ((!checkedOnly || i.checked) ? (i.price ?? 0) * i.quantity : 0), 0);
export function lastPrice(state, productId, beforeMonth) {
  return state.lists.filter(l => l.closed && l.month < beforeMonth).sort((a,b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt)).flatMap(l => l.items.filter(i => i.productId === productId && i.checked && i.price != null)).at(0)?.price ?? null;
}
export function addItem(state, list, productId, quantity) {
  if (list.items.some(i => i.productId === productId)) throw new Error('Este produto já está na lista. Ajuste a quantidade nele.');
  const price = lastPrice(state, productId, list.month);
  list.items.push({ id: uid(), productId, quantity, price, baseline: price, checked: false, updated: false });
}
export function priceCandidates(text) {
  // Some shelf labels place cents on a separate line. Only join digit groups
  // without punctuation when a currency marker establishes that it is a price.
  const normalized = text.replace(/R\s*\$\s*(\d{1,5})\s+(\d{2})(?!\d)/gi, 'R$ $1,$2');
  const matches = [...normalized.matchAll(/(?<![\d.,/])(\d{1,5})\s*[,.]\s*(\d{2})(?![\d.,/])/g)];
  return [...new Set(matches.filter(m => !/^\s*(?:kg|g|ml|l|%)(?![a-z])/i.test(normalized.slice(m.index + m[0].length)))
    .map(m => Number(`${m[1]}.${m[2]}`)).filter(n => n > 0 && n <= 99999))];
}
export function monthlySpend(state) {
  const months = new Map();
  state.lists.filter(l => l.closed).forEach(l => months.set(l.month, (months.get(l.month) || 0) + total(l, true)));
  return [...months].sort(([a], [b]) => a.localeCompare(b));
}
export function previousMonth(month) {
  const [y,m] = month.split('-').map(Number);
  return `${m === 1 ? y-1 : y}-${String(m === 1 ? 12 : m-1).padStart(2,'0')}`;
}
