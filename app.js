import { recognizePrices, fillSuggestedPrice } from './ocr.js';
import { uid, emptyState, money, productKey, addItem, total, monthlySpend, previousMonth } from './domain.js';
import { cloud, localPreview, prepareLogin, login, save, logout } from './storage.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nowMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; };
const monthName = m => new Date(m+'-02T12:00:00').toLocaleDateString('pt-BR',{month:'long',year:'numeric'});
let state = emptyState(), selected = '', tab = 'list', filter = '', busy = false, toastTimer;
const compactMoney = n => n == null ? '—' : n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const current = () => state.lists.find(l => l.id === selected);
const product = id => state.products.find(p => p.id === id);
const description = p => `${p.brand} · ${p.type} · ${p.size} ${p.unit}`;
const status = message => { $('#sync').textContent = message; };
function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').hidden = true, 6000); }
function errorMessage(e) { if (e.code === 'auth/popup-closed-by-user') return 'Login cancelado. Toque em Entrar com Google para tentar novamente.'; if (e.code === 'auth/popup-blocked') return 'Permita a janela de login e tente novamente no Chrome ou Safari.'; if (e.code === 'auth/unauthorized-domain') return 'Autorize o domínio deste site em Authentication → Settings no Firebase.'; if (e.code === 'auth/operation-not-allowed') return 'Habilite o provedor Google em Authentication no Firebase.'; if (e.code?.includes('permission-denied')) return 'Este e-mail não tem acesso à casa. Peça ao administrador para autorizá-lo no Firebase ou entre com outra conta.'; if (e.code?.includes('network')) return 'Sem conexão. Verifique a internet e tente novamente.'; return e.message || 'Não foi possível concluir. Tente novamente.'; }
async function mutate(change) {
  if (busy) return false;
  busy = true; const expected = state.revision; const next = structuredClone(state);
  try { change(next); next.revision = expected + 1; status('Salvando…'); await save(next, expected); if (state.revision <= next.revision) state = next; render(); status(cloud ? '● Sincronizado com a casa' : '● Salvo neste aparelho'); return true; }
  catch(e) { toast(errorMessage(e)); status('⚠ Alteração não salva'); return false; }
  finally { busy = false; }
}
const loginButton = $('#google-login');
$('#login-mode').textContent = cloud ? 'Apenas contas autorizadas da família têm acesso.' : localPreview ? 'Prévia local · Dados somente neste navegador. O login Google estará disponível após configurar o Firebase.' : 'O acesso aguarda a configuração do Firebase pelo responsável pela casa.';
if (localPreview) { loginButton.textContent = 'Experimentar neste aparelho →'; loginButton.disabled = false; }
if (cloud) prepareLogin().then(() => { loginButton.disabled = false; }).catch(e => { $('#login-error').textContent = 'Não foi possível preparar o login. Confira a conexão e a configuração e recarregue a página. ' + errorMessage(e); });
function closeSession(error) {
  state = emptyState(); selected = ''; $('#content').innerHTML = ''; $('#modal').close();
  $('#app').hidden = true; $('#login-screen').hidden = false;
  $('#login-error').textContent = errorMessage(error);
  logout().catch(() => {});
}
$('#login-form').onsubmit = async e => {
  e.preventDefault(); loginButton.disabled = true; $('#login-error').textContent = '';
  try {
    await login(data => { state = data; if (!current()) selected = [...state.lists].sort((a,b)=>b.month.localeCompare(a.month)||b.createdAt.localeCompare(a.createdAt))[0]?.id || ''; render(); }, closeSession);
    $('#login-screen').hidden = true; $('#app').hidden = false;
    status(cloud ? '● Sincronizado com a casa' : '● Salvo neste aparelho');
  } catch(err) { $('#login-error').textContent = errorMessage(err); }
  finally { loginButton.disabled = false; }
};
$('#logout').onclick = async () => { await logout(); location.reload(); };
$('#close-modal').onclick = () => $('#modal').close();
document.querySelectorAll('[data-tab]').forEach(b => { b.setAttribute('aria-label', b.querySelector('span').textContent); b.onclick = () => { tab = b.dataset.tab; filter = ''; render(); }; });
$('#export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'})); const a = document.createElement('a'); a.href = url; a.download = `compra-de-casa-${nowMonth()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); };
$('#backup-mobile').onclick = () => $('#export').click();
$('#logout-mobile').onclick = () => $('#logout').click();
$('#import-backup').onclick = () => {
  if (state.products.length || state.lists.length) return toast('Importe apenas em uma casa vazia, para preservar seu histórico atual.');
  modal('Trazer um backup para esta casa', '<p>Selecione o arquivo JSON baixado no Compra de Casa. Seus produtos e listas serão adicionados a esta casa vazia.</p><input id="backup-file" type="file" accept="application/json,.json" aria-label="Arquivo de backup"><p id="backup-info" role="status"></p><button id="confirm-import" class="primary" disabled>Importar produtos e listas</button>');
  let imported;
  $('#backup-file').onchange = async e => {
    $('#confirm-import').disabled = true;
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > 900000) throw new Error('O backup ultrapassa o limite desta versão (900 KB).');
      const data = JSON.parse(await file.text());
      const validId = id => typeof id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(id);
      const text = s => typeof s === 'string' && s.trim().length > 0 && s.length <= 150;
      if (!Array.isArray(data.products) || !Array.isArray(data.lists)) throw new Error('Formato de backup inválido.');
      const ids = new Set();
      for (const p of data.products) {
        if (!validId(p.id) || ids.has(p.id) || !text(p.name) || !text(p.brand) || !text(p.type) || !text(p.category) || !['kg','g','L','ml','un'].includes(p.unit) || !Number.isFinite(p.size) || p.size <= 0) throw new Error('Produto inválido no backup.');
        ids.add(p.id);
      }
      const listIds = new Set();
      for (const l of data.lists) {
        if (!validId(l.id) || listIds.has(l.id) || !text(l.name) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(l.month) || !text(l.createdAt) || typeof l.closed !== 'boolean' || !Array.isArray(l.items)) throw new Error('Lista inválida no backup.');
        listIds.add(l.id); const itemIds = new Set(), products = new Set();
        for (const i of l.items) {
          if (!validId(i.id) || itemIds.has(i.id) || products.has(i.productId) || !ids.has(i.productId) || !Number.isInteger(i.quantity) || i.quantity < 1 || i.quantity > 999 || ![i.price,i.baseline].every(n=>n===null || (Number.isFinite(n)&&n>0&&n<=99999)) || typeof i.checked !== 'boolean' || typeof i.updated !== 'boolean' || (l.closed&&i.checked&&i.price===null)) throw new Error('Item inválido no backup.');
          itemIds.add(i.id); products.add(i.productId);
        }
      }
      imported = { products: data.products, lists: data.lists };
      $('#backup-info').textContent = `${data.products.length} produtos e ${data.lists.length} listas prontos para importar.`;
      $('#confirm-import').disabled = false;
    } catch(e) { $('#backup-info').textContent = errorMessage(e); }
  };
  $('#confirm-import').onclick = async () => { if (!imported) return; if (await mutate(s=>{if(s.products.length||s.lists.length)throw new Error('A casa já recebeu dados. Importação cancelada.');s.products=imported.products;s.lists=imported.lists;})) { selected=state.lists.at(-1)?.id||'';$('#modal').close();render();toast('Backup importado.'); } };
};
function modal(title, body) { $('#modal-title').textContent = title; $('#modal-body').innerHTML = body; $('#modal').showModal(); }
function delta(price, baseline) { if (price == null || baseline == null) return '<small class="muted">Sem comparação anterior</small>'; const d = Math.round((price-baseline)*100)/100; return `<small class="delta ${d>0?'up':d<0?'down':''}">${d>0?'↗':d<0?'↘':'→'} ${d===0?'Mesmo preço':money(Math.abs(d)) + (d>0?' mais caro':' mais barato')}</small>`; }
function render() {
  document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active',b.dataset.tab===tab));
  $('#section-label').textContent = {list:'Lista de compras',analytics:'Evolução dos gastos',catalog:'Nossos produtos'}[tab];
  $('#content').classList.toggle('shopping-view', tab === 'list' && Boolean(current()));
  if(tab==='list') renderList(); else if(tab==='catalog') renderCatalog(); else renderAnalytics();
}
function title(eyebrow, heading, sub, action='') { return `<section class="page-title"><div><span class="eyebrow">${eyebrow}</span><h1>${heading}</h1><p>${sub}</p></div>${action}</section>`; }
function renderList() {
  const l = current();
  $('#content').innerHTML = title('PLANEJAR É CUIDAR','Nossa lista de compras','Tudo o que a casa precisa, em um só lugar.','<button class="primary" id="new-list">＋ Nova lista</button>') + (l ? `
  <div class="list-toolbar"><div><label class="sr-only" for="list-select">Escolher lista</label><select id="list-select">${[...state.lists].sort((a,b)=>b.month.localeCompare(a.month)||b.createdAt.localeCompare(a.createdAt)).map(x=>`<option value="${x.id}" ${x.id===l.id?'selected':''}>${esc(x.name)} · ${monthName(x.month)}${x.closed?' · concluída':''}</option>`).join('')}</select><span class="pill">${l.closed?'Concluída':'Em planejamento'}</span></div><button class="text-button" id="close-list" ${l.closed?'disabled':''}>✓ Finalizar compra</button></div>
  <div class="stats shopping-stats"><article class="stat green"><span>TOTAL ${l.closed?'COMPRADO':'ESTIMADO'}</span><strong>${money(total(l,l.closed))}</strong><small>${l.items.filter(i=>i.price==null).length} itens sem preço ${l.closed?'na lista':'· inclui preços anteriores'}</small></article><article class="stat"><span>JÁ NO CARRINHO</span><strong>${money(total(l,true))}</strong><small>Somente os itens marcados</small></article><article class="stat"><span>SEU PROGRESSO</span><strong>${l.items.filter(i=>i.checked).length}<em> / ${l.items.length} itens</em></strong><div class="progress"><i style="width:${l.items.length?l.items.filter(i=>i.checked).length/l.items.length*100:0}%"></i></div></article></div>
  <p class="compact-price-note">${l.items.filter(i=>i.price==null).length} itens sem preço · Inclui preços anteriores até a atualização.</p><section class="list-card"><div class="card-toolbar"><h2>O que vamos levar <span>${l.items.length}</span></h2><button id="add-item" class="primary" ${l.closed?'disabled':''}>＋ Adicionar item</button></div><div class="search-row"><span>⌕</span><input id="search" placeholder="Buscar na lista…" aria-label="Buscar na lista" value="${esc(filter)}"><small>VALORES POR EMBALAGEM</small></div><div class="items-heading" aria-hidden="true"><span>✓</span><span>Produto</span><span>Qtd.</span><span>Preço R$</span><span>Total R$</span><span></span></div><div id="items"></div></section><div class="tip"><span>✧</span><p><strong>Uma foto, um preço atualizado.</strong><br>Toque na câmera do item, fotografe a etiqueta e confirme o valor encontrado.</p></div>` : `<section class="empty welcome"><span class="empty-icon">▤</span><h2>Uma lista nova. Uma rotina mais leve.</h2><p>Cadastre o que a casa precisa. No mercado, marque os itens<br>e fotografe as etiquetas para atualizar os preços.</p><button class="primary" id="first-list">Criar minha primeira lista →</button></section>`);
  $('#new-list').onclick = newList; if (!l) { $('#first-list').onclick = newList; return; }
  $('#list-select').onchange = e => { selected = e.target.value; filter=''; render(); };
  $('#search').oninput = e => { filter = e.target.value; renderItems(); };
  $('#add-item').onclick = () => itemForm();
  $('#close-list').onclick = () => {
    const bought = l.items.filter(i=>i.checked);
    if (!bought.length) return toast('Marque os itens que você comprou antes de finalizar.');
    if (bought.some(i=>i.price==null)) return toast('Informe o preço de todos os itens marcados antes de finalizar.');
    modal('Finalizar esta compra?',`<p>Vamos registrar <strong>${money(total(l,true))}</strong> em ${bought.length} itens comprados. Somente eles entram nos gráficos e no histórico de preços. Os demais ficam na lista para referência.</p><p>Confira os preços herdados: eles serão considerados pagos se você não os atualizar.</p><button id="confirm-close" class="primary">Concluir e guardar no histórico</button>`);
    $('#confirm-close').onclick = async () => { if(await mutate(s=>{s.lists.find(x=>x.id===l.id).closed=true;})) $('#modal').close(); };
  };
  renderItems();
}
function renderItems() {
  const l=current(); const items = l.items.filter(i => { const p=product(i.productId); return `${p.name} ${description(p)}`.toLocaleLowerCase().includes(filter.toLocaleLowerCase()); });
  $('#items').innerHTML = items.length ? items.map(i=>{ const p=product(i.productId); return `<article class="item ${i.checked?'checked':''}"><input class="check" type="checkbox" aria-label="Marcar ${esc(p.name)} como comprado" data-check="${i.id}" ${i.checked?'checked':''} ${l.closed?'disabled':''}><span class="product-icon">${{Alimentos:'▧',Bebidas:'◡',Limpeza:'✧',Higiene:'◇',Outros:'▦'}[p.category]||'▦'}</span><div class="item-name"><strong>${esc(p.name)}</strong><small>${esc(description(p))}</small><span class="category">${esc(p.category)}</span></div><div class="quantity"><label for="qty-${i.id}">Qtd.</label><input id="qty-${i.id}" data-qty="${i.id}" type="number" min="1" max="999" step="1" value="${i.quantity}" ${l.closed?'disabled':''}></div><div class="item-price"><button class="price-button" aria-label="Editar preço de ${esc(p.name)}: ${money(i.price)}" data-price="${i.id}" ${l.closed?'disabled':''}><span class="desktop-price">${money(i.price)} ${l.closed?'':'⌄'}</span><span class="mobile-price">${compactMoney(i.price)}</span></button><span class="item-delta">${delta(i.price,i.baseline)}<small class="mobile-delta ${i.price>i.baseline?'up':'down'}" title="Preço anterior: ${money(i.baseline)}">${i.price==null||i.baseline==null?'—':i.price===i.baseline?'=':(i.price>i.baseline?'↗':'↘')+compactMoney(Math.abs(i.price-i.baseline))}</small></span><small class="muted">${i.updated?'Preço atualizado':i.price==null?'Fotografe ou digite':'Preço da compra anterior'}</small></div><div class="subtotal"><small>Subtotal</small><strong><span class="desktop-price">${i.price==null?'—':money(i.price*i.quantity)}</span><span class="mobile-price">${i.price==null?'—':compactMoney(i.price*i.quantity)}</span></strong></div><button class="camera" data-photo="${i.id}" aria-label="Fotografar preço de ${esc(p.name)}" ${l.closed?'disabled':''}>▣</button><button class="remove" data-remove="${i.id}" aria-label="Remover ${esc(p.name)}" ${l.closed?'disabled':''}>×</button></article>`; }).join('') : `<div class="empty"><h3>${filter?'Nenhum item encontrado':'Sua lista está esperando os primeiros itens'}</h3><p>${filter?'Tente outro nome ou marca.':'Use “Adicionar item” para começar.'}</p></div>`;
  document.querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>mutate(s=>{s.lists.find(x=>x.id===l.id).items.find(i=>i.id===el.dataset.check).checked=el.checked;}));
  document.querySelectorAll('[data-qty]').forEach(el=>el.onchange=()=>{const n=Number(el.value);if(!Number.isInteger(n)||n<1||n>999){toast('Use uma quantidade inteira entre 1 e 999.');renderItems();return;} mutate(s=>{s.lists.find(x=>x.id===l.id).items.find(i=>i.id===el.dataset.qty).quantity=n;});});
  document.querySelectorAll('[data-price]').forEach(el=>el.onclick=()=>priceForm(el.dataset.price));
  document.querySelectorAll('[data-photo]').forEach(el=>el.onclick=()=>priceForm(el.dataset.photo,true));
  document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{modal('Remover item?', '<p>O produto continuará no cadastro e nas compras anteriores.</p><button class="primary" id="confirm-remove">Remover desta lista</button>');$('#confirm-remove').onclick=async()=>{if(await mutate(s=>{const list=s.lists.find(x=>x.id===l.id);list.items=list.items.filter(i=>i.id!==el.dataset.remove);}))$('#modal').close();};});
}
function newList() {
  const latest=[...state.lists].sort((a,b)=>b.month.localeCompare(a.month)||b.createdAt.localeCompare(a.createdAt))[0];
  modal('Uma nova lista para a casa',`<form id="new-list-form"><label>Nome da lista<input name="name" required maxlength="70" placeholder="Ex.: Compra do mês"></label><label>Mês de referência<input name="month" type="month" required value="${nowMonth()}"></label><label>Como você quer começar?<select name="source"><option value="empty">Criar do zero</option>${latest?`<option value="copy">Copiar ${esc(latest.name)}</option>`:''}</select></label><p class="form-note">Os preços vêm da última compra concluída anterior ao mês escolhido, sempre do mesmo produto, marca, tipo e embalagem.</p><button class="primary">Criar lista →</button></form>`);
  $('#new-list-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const id=uid();if(await mutate(s=>{const l={id,name:f.get('name').trim(),month:f.get('month'),createdAt:new Date().toISOString(),closed:false,items:[]};if(!l.name)throw new Error('Informe um nome para a lista.');if(f.get('source')==='copy'&&latest)latest.items.forEach(i=>addItem(s,l,i.productId,i.quantity));s.lists.push(l);})){selected=id;$('#modal').close();render();}};
}
function itemForm(catalogOnly=false) {
  const l=current();
  modal(catalogOnly?'Cadastrar produto':'Adicionar à lista',`<form id="item-form">${!catalogOnly&&state.products.length?`<label>Escolher um produto cadastrado<select name="existing" id="existing"><option value="">＋ Cadastrar um novo produto</option>${state.products.map(p=>`<option value="${p.id}">${esc(p.name+' · '+description(p))}</option>`).join('')}</select></label>`:''}<fieldset id="product-fields"><label>Nome do produto<input name="name" required maxlength="80" placeholder="Ex.: Arroz"></label><div class="form-grid"><label>Marca<input name="brand" required maxlength="60" placeholder="Ex.: Tio João"></label><label>Tipo / versão<input name="type" required maxlength="80" placeholder="Ex.: Branco tipo 1"></label></div><div class="form-grid"><label>Tamanho da embalagem<input name="size" type="number" required min="0.001" max="100000" step="0.001" placeholder="5"></label><label>Unidade<select name="unit"><option>kg</option><option>g</option><option>L</option><option>ml</option><option>un</option></select></label></div><label>Categoria<select name="category"><option>Alimentos</option><option>Bebidas</option><option>Limpeza</option><option>Higiene</option><option>Outros</option></select></label></fieldset>${!catalogOnly?'<label>Quantidade de embalagens<input name="quantity" type="number" min="1" max="999" step="1" value="1" required></label>':''}<p class="form-note">Use sempre a mesma unidade no cadastro. Uma embalagem diferente deve ser cadastrada como outro produto.</p><button class="primary">${catalogOnly?'Salvar produto':'Adicionar item'}</button></form>`);
  if($('#existing'))$('#existing').onchange=e=>{$('#product-fields').disabled=!!e.target.value;$('#product-fields').hidden=!!e.target.value;};
  $('#item-form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);if(await mutate(s=>{let pid=f.get('existing');if(!pid){const p={id:uid(),name:f.get('name').trim(),brand:f.get('brand').trim(),type:f.get('type').trim(),size:Number(f.get('size')),unit:f.get('unit'),category:f.get('category')};if(!p.name||!p.brand||!p.type)throw new Error('Preencha nome, marca e tipo.');const existing=s.products.find(x=>productKey(x)===productKey(p));pid=existing?.id||p.id;if(!existing)s.products.push(p);else if(catalogOnly)throw new Error('Este produto já está cadastrado.');}if(!catalogOnly){const list=s.lists.find(x=>x.id===l.id);if(list.closed)throw new Error('Esta compra já foi concluída.');addItem(s,list,pid,Number(f.get('quantity')));}}))$('#modal').close();};
}
function priceForm(id, photo=false) {
  const l=current(), item=l.items.find(i=>i.id===id), p=product(item.productId);
  modal('Atualizar preço',`<p><strong>${esc(p.name)}</strong><br>${esc(description(p))}</p><div class="photo-box"><label class="upload-label">▣ Fotografar ou escolher etiqueta<input id="photo-input" type="file" accept="image/*" capture="environment"></label><small>Aproxime a câmera do preço por embalagem.</small><img id="photo-preview" alt="Etiqueta escolhida" hidden><p id="ocr-status" role="status"></p><div id="candidates"></div></div><form id="price-form"><label>Preço por embalagem (R$)<input id="price-value" name="price" type="number" inputmode="decimal" min="0.01" max="99999" step="0.01" required value="${item.price??''}"></label><p class="form-note">Confirme se é o preço correto para esta embalagem e condição de compra. A foto é processada no aparelho e não fica salva.</p><button class="primary">Confirmar e salvar preço</button></form>`);
  $('#price-form').onsubmit=async e=>{e.preventDefault();const price=Number(new FormData(e.target).get('price'));if(await mutate(s=>{const list=s.lists.find(x=>x.id===l.id);if(list.closed)throw new Error('Esta compra já foi concluída.');const i=list.items.find(i=>i.id===id);i.price=price;i.updated=true;}))$('#modal').close();};
  const input=$('#photo-input'), output=$('#ocr-status'), candidates=$('#candidates'), value=$('#price-value'), preview=$('#photo-preview');
  const submit = $('#price-form button');
  let reading = false;
  const originalSubmit = $('#price-form').onsubmit;
  $('#price-form').onsubmit = event => { if (reading) { event.preventDefault(); return; } return originalSubmit(event); };
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    if (file.size > 20 * 1024 * 1024) { output.textContent = 'Escolha uma imagem de até 20 MB.'; input.value = ''; return; }
    reading = true; input.disabled = true; value.disabled = true; submit.disabled = true;
    value.value = ''; candidates.innerHTML = ''; value.classList.remove('price-detected');
    const url = URL.createObjectURL(file);
    try {
      preview.src = url; preview.hidden = false;
      output.textContent = 'Lendo o preço… Na primeira foto, o carregamento pode levar alguns segundos.';
      const prices = await recognizePrices(file, progress => { output.textContent = 'Lendo etiqueta… ' + progress + '%'; });
      if (!input.isConnected) return;
      const found = fillSuggestedPrice(value, prices);
      if (found) {
        value.classList.add('price-detected');
        output.textContent = 'Preço preenchido: ' + money(prices[0]) + (prices.length > 1 ? '. Há outros valores na etiqueta: confira o sugerido ou toque em uma alternativa.' : '. Confira e toque em Confirmar e salvar preço.');
        if (prices.length > 1) {
          candidates.innerHTML = prices.map((n,index) => '<button type="button" class="candidate" aria-pressed="' + (index === 0) + '" data-value="' + n + '">' + money(n) + '</button>').join('');
          candidates.querySelectorAll('button').forEach(button => button.onclick = () => {
            fillSuggestedPrice(value, [Number(button.dataset.value)]);
            candidates.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
            output.textContent = 'Preço preenchido: ' + money(Number(button.dataset.value)) + '. Confira e salve.';
          });
        }
        value.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      } else output.textContent = 'Não encontramos um preço nítido. Fotografe mais perto da etiqueta ou digite o valor.';
    } catch { if (input.isConnected) output.textContent = 'Não foi possível ler a foto. Confira a internet e tente outra foto em JPG/PNG.'; }
    finally { URL.revokeObjectURL(url); reading = false; input.disabled = false; input.value = ''; value.disabled = false; submit.disabled = false; }
  };
  if(photo)input.click();
}
function renderCatalog() {
  $('#content').innerHTML=title('CADA PRODUTO, DO SEU JEITO','Nossos produtos','Marca, tipo e embalagem: a base de uma comparação justa.','<button id="new-product" class="primary">＋ Cadastrar produto</button>')+`<section class="catalog-grid">${state.products.length?state.products.map(p=>`<article class="product-card"><span class="category">${esc(p.category)}</span><h2>${esc(p.name)}</h2><p>${esc(description(p))}</p><small>Identidade fixa para preservar o histórico.</small></article>`).join(''):'<div class="empty"><h2>O começo de um bom planejamento</h2><p>Cadastre seus produtos aqui ou ao adicionar itens à lista.</p></div>'}</section>`;
  $('#new-product').onclick=()=>itemForm(true);
}
function renderAnalytics() {
  const months=monthlySpend(state), latest=months.at(-1), prev=latest?months.find(([m])=>m===previousMonth(latest[0])):null;
  $('#content').innerHTML=title('OLHAR PARA OS NÚMEROS, CUIDAR DA CASA','Evolução dos gastos','Um retrato das compras concluídas, mês a mês.')+(!latest?'<section class="empty welcome"><span class="empty-icon">▥</span><h2>Seu histórico começa na primeira compra</h2><p>Finalize uma lista para ver os gastos e acompanhar os preços.</p></section>':`<div class="stats"><article class="stat green"><span>ÚLTIMO MÊS · ${monthName(latest[0]).toUpperCase()}</span><strong>${money(latest[1])}</strong><small>Somente itens comprados</small></article><article class="stat"><span>EM RELAÇÃO AO MÊS ANTERIOR</span><strong>${prev?`${latest[1]>=prev[1]?'＋':'−'}${money(Math.abs(latest[1]-prev[1]))}`:'—'}</strong><small>${prev&&prev[1]>0?`${((latest[1]/prev[1]-1)*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}% de variação no gasto`:'Sem base no mês imediatamente anterior'}</small></article><article class="stat"><span>COMPRAS CONCLUÍDAS</span><strong>${state.lists.filter(l=>l.closed).length}</strong><small>Em ${months.length} meses com registros</small></article></div><section class="chart-card"><h2>Quanto a casa gastou</h2><p>Gasto total mensal · R$</p>${barChart(months)}</section><section class="chart-card"><h2>Comparar dois meses</h2><div class="form-grid"><label>Primeiro mês<select id="compare-a">${months.map(([m])=>`<option value="${m}" ${m===(prev?.[0]||months[0][0])?'selected':''}>${monthName(m)}</option>`).join('')}</select></label><label>Segundo mês<select id="compare-b">${months.map(([m])=>`<option value="${m}" ${m===latest[0]?'selected':''}>${monthName(m)}</option>`).join('')}</select></label></div><div id="comparison"></div></section><section class="chart-card"><h2>O preço de cada produto</h2><label>Produto<select id="chart-product">${state.products.map(p=>`<option value="${p.id}">${esc(p.name+' · '+description(p))}</option>`).join('')}</select></label><div id="product-chart"></div></section>`);
  if(!latest)return;
  const compare=()=>{const a=$('#compare-a').value,b=$('#compare-b').value;const ta=months.find(([m])=>m===a)[1],tb=months.find(([m])=>m===b)[1];const get=m=>{const map=new Map();state.lists.filter(l=>l.closed&&l.month===m).forEach(l=>l.items.filter(i=>i.checked&&i.price!=null).forEach(i=>{const v=map.get(i.productId)||{q:0,sum:0};v.q+=i.quantity;v.sum+=i.quantity*i.price;map.set(i.productId,v);}));return map;};const ma=get(a),mb=get(b);const ids=[...new Set([...ma.keys(),...mb.keys()])];$('#comparison').innerHTML=`<div class="comparison-summary">${monthName(a)}: <strong>${money(ta)}</strong> <span>→</span> ${monthName(b)}: <strong>${money(tb)}</strong><br><small>Diferença no gasto: ${tb>=ta?'+':'−'}${money(Math.abs(tb-ta))}. Inclui mudanças de quantidade e de produtos.</small></div><div class="table-scroll"><table><thead><tr><th>Produto / embalagem</th><th>Preço médio · 1º mês</th><th>Preço médio · 2º mês</th><th>Variação unitária</th></tr></thead><tbody>${ids.map(id=>{const p=product(id),x=ma.get(id),y=mb.get(id);return `<tr><td><strong>${esc(p.name)}</strong><small>${esc(description(p))}</small></td><td>${x?money(x.sum/x.q):'Não comprado'}</td><td>${y?money(y.sum/y.q):'Não comprado'}</td><td>${x&&y?delta(y.sum/y.q,x.sum/x.q):'Sem par comparável'}</td></tr>`;}).join('')}</tbody></table></div><p class="form-note">Preço médio por embalagem, ponderado pela quantidade comprada. Apenas cadastros idênticos são comparados.</p>`;};
  $('#compare-a').onchange=compare;$('#compare-b').onchange=compare;compare();
  const showProduct=()=>{const id=$('#chart-product').value;const data=months.flatMap(([m])=>{const items=state.lists.filter(l=>l.closed&&l.month===m).flatMap(l=>l.items.filter(i=>i.checked&&i.productId===id&&i.price!=null));const q=items.reduce((s,i)=>s+i.quantity,0);return q?[[m,items.reduce((s,i)=>s+i.price*i.quantity,0)/q]]:[];});$('#product-chart').innerHTML=data.length?barChart(data)+'<p class="form-note">Preço médio por embalagem em cada mês, ponderado pela quantidade.</p>':'<p class="empty">Este produto ainda não tem compras concluídas.</p>';};
  $('#chart-product').onchange=showProduct;showProduct();
}
function barChart(data) { const max=Math.max(...data.map(([,v])=>v),1);return `<div class="bar-chart" role="img" aria-label="${esc(data.map(([m,v])=>monthName(m)+': '+money(v)).join('; '))}">${data.map(([m,v])=>`<div class="bar-column"><strong>${money(v)}</strong><div class="bar-track"><div class="bar" style="height:${Math.max(v/max*100,1)}%"></div></div><small>${esc(monthName(m))}</small></div>`).join('')}</div>`; }
window.addEventListener('storage', e=>{if(!cloud&&e.key==='compra-de-casa-v1'&&e.newValue){try{state=JSON.parse(e.newValue);render();}catch{toast('Erro ao receber dados de outra aba.');}}});
window.addEventListener('offline',()=>status('⚠ Sem internet'+(cloud?' · reconecte para salvar':'')));
