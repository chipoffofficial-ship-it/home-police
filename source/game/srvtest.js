const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http=require('http'),fs=require('fs');let saved='{}';
const srv=http.createServer((q,r)=>{if(q.url==='/api/save'){if(q.method==='POST'){let b='';q.on('data',d=>b+=d);q.on('end',()=>{saved=b;r.end('ok')});}else r.end(saved);return;}if(q.url==='/api/ping'){r.end('ok');return;}r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('dist/index.html'));}).listen(8766);
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage();
await p.goto('http://127.0.0.1:8766/');await p.waitForTimeout(500);await p.click('.casecard[data-c="c1"]');await p.waitForTimeout(1500);
await p.evaluate(()=>{});await p.waitForTimeout(1000);
const s=JSON.parse(saved);console.log('saved v',s.v,'flags',Object.keys(s.cases.c1.flags).length);
await p.reload();await p.waitForTimeout(800);console.log('menu shows:',await p.textContent('.casecard[data-c="c1"]'));await b.close();srv.close();})();
