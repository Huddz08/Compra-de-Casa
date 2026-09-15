import http from 'node:http';
import { readFile } from 'node:fs/promises';
const allowed = new Set(['index.html','style.css','mobile-list.css','app.js','domain.js','storage.js','config.js','icon.svg']);
const types = {html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml'};
http.createServer(async(req,res)=>{
  const name = new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';
  if(!allowed.has(name)){res.writeHead(404);res.end('Não encontrado');return;}
  try{const body=await readFile(new URL(name,import.meta.url));res.writeHead(200,{'Content-Type':types[name.split('.').pop()],'Cache-Control':'no-store'});res.end(body);}catch{res.writeHead(500);res.end('Erro ao abrir arquivo');}
}).listen(4173,'127.0.0.1',()=>console.log('Compra de Casa: http://localhost:4173'));
