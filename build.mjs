import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public',{recursive:true});
for (const name of ['index.html','style.css','mobile-list.css','shopping-flow.css','app.js','domain.js','ocr.js','storage.js','config.js','icon.svg']) await copyFile(name,`public/${name}`);
console.log('Site pronto em public/');
