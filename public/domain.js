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
  return [...new Set((text.match(/\d{1,5}[,.]\s*\d{2}(?!\d)/g) || []).map(s => Number(s.replace(/\s/g, '').replace(',', '.'))).filter(n => n > 0 && n < 100000))];
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
