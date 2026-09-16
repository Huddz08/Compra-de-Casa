export const uid = () => crypto.randomUUID();
export const emptyState = () => ({ products: [], lists: [], revision: 0 });
export function deleteList(state, listId) {
  if (!state.lists.some(l => l.id === listId)) throw new Error('Esta lista já foi excluída. Reabra a página de listas.');
  state.lists = state.lists.filter(l => l.id !== listId);
  for (const list of state.lists) {
    if (list.followupListId === listId) delete list.followupListId;
    if (list.sourceListId === listId) {
      delete list.sourceListId;
      for (const item of list.items) delete item.sourceItemId;
    }
  }
}
export const money = n => n == null ? 'Sem preço' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
export const normalize = s => String(s).trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
export const productKey = p => [p.name, p.brand, p.type, Number(p.size), p.unit].map(normalize).join('|');
export const total = (list, checkedOnly = false) => list.items.reduce((s, i) => s + ((!checkedOnly || i.checked) ? (i.price ?? 0) * i.quantity : 0), 0);
export function lastPrice(state, productId, beforeMonth) {
  return state.lists.filter(l => l.closed && l.month < beforeMonth).sort((a,b) => b.month.localeCompare(a.month) || b.createdAt.localeCompare(a.createdAt)).flatMap(l => l.items.filter(i => i.productId === productId && i.checked && i.price != null)).at(0)?.price ?? null;
}
export function addItem(state, list, productId, quantity) {
  if (list.items.some(i => i.productId === productId)) throw new Error('Este produto já está na lista. Ajuste a quantidade nele.');
  const cutoff = list.purchaseDate || list.month + '-31';
  const price = purchaseHistory(state, productId).filter(p => p.date ? p.date <= cutoff : p.month < list.month).at(-1)?.price ?? lastPrice(state, productId, list.month);
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
  state.lists.filter(l => l.closed).forEach(l => months.set(spendMonth(l), roundMoney((months.get(spendMonth(l)) || 0) + paidTotal(l))));
  return [...months].sort(([a], [b]) => a.localeCompare(b));
}
export function previousMonth(month) {
  const [y,m] = month.split('-').map(Number);
  return `${m === 1 ? y-1 : y}-${String(m === 1 ? 12 : m-1).padStart(2,'0')}`;
}

export const pendingItems = list => list.items.filter(i => !i.checked);
export const roundMoney = value => Math.round((value + Number.EPSILON) * 100) / 100;
export const spendMonth = list => list.purchaseDate?.slice(0,7) || list.month;
export const paidTotal = list => list.closed && Number.isFinite(list.actualTotal) ? list.actualTotal : roundMoney(total(list, true));
export const checkoutAdjustment = list => roundMoney(paidTotal(list) - total(list, true));
export const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function validateListDetails(list) {
  if (!list.name?.trim()) throw new Error('Informe o nome da lista.');
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(list.month || '')) throw new Error('Informe o mês da lista.');
  if (list.purchaseDate && !validDate(list.purchaseDate)) throw new Error('Informe uma data válida.');
  if (list.actualTotal != null && (!Number.isFinite(list.actualTotal) || list.actualTotal < 0 || list.actualTotal > 9999999)) throw new Error('Informe um valor de caixa válido, entre 0 e 9.999.999.');
}
export function purchaseHistory(state, productId) {
  return state.lists.filter(l => l.closed).flatMap(l => l.items
    .filter(i => i.productId === productId && i.checked && i.price != null)
    .map(i => ({ listId: l.id, listName: l.name, market: l.market || '', date: l.purchaseDate || l.closedAt?.slice(0,10) || null,
      month: l.month, price: i.price, quantity: i.quantity, createdAt: l.createdAt })))
    .sort((a,b) => (a.date || a.month + '-01').localeCompare(b.date || b.month + '-01') || a.createdAt.localeCompare(b.createdAt) || a.listId.localeCompare(b.listId));
}
export function mergeListDraft(remote, base, draft, products) {
  const existing = remote.lists.find(l => l.id === draft.id);
  if (JSON.stringify(existing) !== JSON.stringify(base)) throw new Error('Esta lista foi alterada em outro aparelho. Suas alterações continuam abertas. Volte às listas e descarte a edição para carregar a versão mais recente.');
  const next = structuredClone(remote), list = structuredClone(draft);
  // Another family member may have created the same product while this editor was open.
  for (const item of list.items) {
    if (next.products.some(p => p.id === item.productId)) continue;
    const product = products.find(p => p.id === item.productId);
    if (!product) throw new Error('Produto não encontrado. Reabra a lista.');
    const matching = next.products.find(p => productKey(p) === productKey(product));
    if (matching) item.productId = matching.id;
    else next.products.push(structuredClone(product));
  }
  if (new Set(list.items.map(i => i.productId)).size !== list.items.length) throw new Error('Há produtos duplicados após a sincronização. Reabra a lista para revisar.');
  next.lists[next.lists.findIndex(l => l.id === list.id)] = list;
  return next;
}
export function finalizeList(state, listId, timestamp = new Date().toISOString(), actualTotal) {
  const list = state.lists.find(l => l.id === listId);
  if (!list || list.closed) throw new Error('Esta compra já foi finalizada ou não está disponível.');
  const bought = list.items.filter(i => i.checked);
  if (!bought.length) throw new Error('Marque pelo menos um item comprado antes de finalizar.');
  if (bought.some(i => !Number.isFinite(i.price) || i.price <= 0)) throw new Error('Informe o preço dos itens no carrinho.');
  validateListDetails(list);
  if (!list.market?.trim() || !validDate(list.purchaseDate)) throw new Error('Informe o mercado e a data da compra.');
  const paid = actualTotal ?? roundMoney(total(list, true));
  if (!Number.isFinite(paid) || paid < 0 || paid > 9999999) throw new Error('Informe um valor de caixa válido.');
  const pending = pendingItems(list);
  list.closed = true; list.closedAt = timestamp; list.actualTotal = roundMoney(paid);
  if (!pending.length) return null;
  const followup = { id: uid(), name: ('Pendências · ' + list.name).slice(0,70), month: list.month,
    market: '', purchaseDate: '', notes: 'Itens não encontrados na compra anterior.', createdAt: timestamp,
    closed: false, sourceListId: list.id,
    items: pending.map(i => ({ id: uid(), productId: i.productId, quantity: i.quantity, price: i.price, baseline: i.baseline,
      checked: false, updated: false, sourceItemId: i.id })) };
  list.followupListId = followup.id;
  state.lists.push(followup);
  return followup.id;
}
