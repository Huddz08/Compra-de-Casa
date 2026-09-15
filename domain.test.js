import test from 'node:test';
import assert from 'node:assert/strict';
import {productKey, lastPrice, addItem, total, monthlySpend, previousMonth, priceCandidates} from './domain.js';
const p={name:'Arroz',brand:'Marca A',type:'Branco',size:5,unit:'kg'};
test('identidade separa marcas, tipos e tamanhos',()=>{
  for(const change of [{brand:'Marca B'},{type:'Integral'},{size:1},{unit:'g'}]) assert.notEqual(productKey(p),productKey({...p,...change}));
  assert.equal(productKey(p),productKey({...p,name:' ARROZ '}));
});
const state={products:[],revision:0,lists:[
  {id:'a',month:'2026-07',createdAt:'2026-07-01',closed:true,items:[{productId:'rice',price:20,quantity:2,checked:true}]},
  {id:'b',month:'2026-08',createdAt:'2026-08-01',closed:true,items:[{productId:'rice',price:22,quantity:1,checked:true},{productId:'beans',price:8,quantity:1,checked:false}]},
  {id:'c',month:'2026-09',createdAt:'2026-09-01',closed:false,items:[{productId:'rice',price:99,quantity:1,checked:true}]}
]};
test('preço anterior ignora futuro, rascunhos e itens não comprados',()=>{assert.equal(lastPrice(state,'rice','2026-09'),22);assert.equal(lastPrice(state,'rice','2026-08'),20);assert.equal(lastPrice(state,'beans','2026-09'),null);});
test('nova lista herda preço e zera marcações',()=>{const list={month:'2026-09',items:[]};addItem(state,list,'rice',3);assert.equal(list.items[0].price,22);assert.equal(list.items[0].baseline,22);assert.equal(list.items[0].checked,false);assert.equal(total(list),66);assert.throws(()=>addItem(state,list,'rice',2));});
test('gastos mensais incluem apenas compras concluídas e marcadas',()=>{assert.deepEqual(monthlySpend(state),[['2026-07',40],['2026-08',22]]);assert.equal(total(state.lists[1]),30);assert.equal(total(state.lists[1],true),22);});
test('referência mensal atravessa ano corretamente',()=>{assert.equal(previousMonth('2026-01'),'2025-12');assert.equal(previousMonth('2026-09'),'2026-08');});
test('OCR reconhece múltiplos preços e pede escolha sem duplicar',()=>{assert.deepEqual(priceCandidates('R$ 12,99 Varejo 15.90 atacado 12,99 peso 500 g'),[12.99,15.9]);assert.deepEqual(priceCandidates('sem preço'),[]);});
