const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http=require('http'),fs=require('fs');let saved='{}',quit=0;
const srv=http.createServer((q,r)=>{if(q.url==='/api/save'){if(q.method==='POST'){let b='';q.on('data',d=>b+=d);q.on('end',()=>{saved=b;r.end('ok')});}else r.end(saved);return;}if(q.url==='/api/ping'){r.end('ok');return;}if(q.url==='/api/quit'){quit++;r.end('bye');return;}r.setHeader('Content-Type','text/html; charset=utf-8');r.end(fs.readFileSync('dist/index.html'));}).listen(8767);
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const p=await b.newPage({viewport:{width:1366,height:768}});const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:8767/');await p.waitForTimeout(500);
await p.fill('#nm','Холмс');await p.fill('#pin','1234');await p.fill('#pin2','1234');await p.click('#go');await p.waitForTimeout(500);
await p.screenshot({path:'q_title.png'});
await p.click('.casecard[data-c="g3"]');await p.waitForTimeout(1500);
if(await p.$('#acc')){await p.click('#acc');await p.waitForSelector('#end',{timeout:20000});await p.click('#end');}
await p.click('.nav[data-v="map"]');await p.click('.loc[data-l="scene"]');await p.waitForTimeout(200);
await p.screenshot({path:'q_desk.png'});
await p.click('#quitg');await p.waitForTimeout(200);await p.screenshot({path:'q_ask.png'});await p.click('#qy');await p.waitForTimeout(1200);
const s=JSON.parse(saved);console.log('quit calls',quit,'saved cases',Object.keys(s.profiles['Холмс'].save.cases),'visited',!!s.profiles['Холмс'].save.cases.g3.flags.v_scene,'errors',errs);
await b.close();srv.close();})();
