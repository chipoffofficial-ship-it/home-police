const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fakeDb = (initial) => `
(() => {
  const store = ${JSON.stringify(initial || {})};
  window.__store = store;
  const snap = (id, v) => ({ id, exists: v !== undefined, data: () => v === undefined ? undefined : JSON.parse(JSON.stringify(v)), metadata: {} });
  const docRef = path => ({ id: path.split('/').pop(), path,
    get: async () => snap(path.split('/').pop(), store[path]),
    set: async d => { store[path] = JSON.parse(JSON.stringify(d)); },
    update: async d => { if (!store[path]) throw { code: 'invalid_argument' }; Object.assign(store[path], d); },
    acquire: async () => ({ acquired: true }),
    collection: name => colRef(path + '/' + name) });
  const colRef = path => ({ path, doc: id => docRef(path + '/' + id),
    get: async () => { const docs = Object.keys(store).filter(k => k.startsWith(path + '/') && k.slice(path.length + 1).indexOf('/') < 0).map(k => snap(k.split('/').pop(), store[k])); return { docs, size: docs.length, empty: !docs.length }; } });
  const db = { doc: docRef, collection: colRef };
  window.claude = { use: async n => n === 'db' ? db : null };
})();`;
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const url = 'file://' + __dirname + '/dist/index.html';
  const errs = [];
  // устройство 1
  const c1 = await b.newContext({ viewport: { width: 1280, height: 860 } }); await c1.addInitScript(fakeDb());
  const p = await c1.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto(url); await p.waitForTimeout(600);
  await p.screenshot({ path: 'c_login.png' });
  await p.click('#sw'); await p.fill('#lg', 'Шерлок_221'); await p.fill('#pw', 'secret1'); await p.fill('#pw2', 'secret1'); await p.click('#go'); await p.waitForTimeout(1500);
  await p.screenshot({ path: 'c_menu.png' });
  await p.click('.casecard[data-c="g5"]'); await p.waitForTimeout(1500);
  if (await p.$('#acc')) { await p.click('#acc'); await p.waitForSelector('#end', { timeout: 20000 }); await p.click('#end'); }
  await p.click('.nav[data-v="map"]'); await p.click('.loc[data-l="scene"]'); await p.waitForTimeout(300);
  for (const s of await p.$$eval('.spot', e => e.map(x => x.dataset.s))) { await p.click(`.spot[data-s="${s}"]`); await p.waitForTimeout(100); }
  await p.screenshot({ path: 'c_scene.png' });
  await p.waitForTimeout(2500);
  const store = await p.evaluate(() => window.__store);
  console.log('docs in cloud:', Object.keys(store));
  // устройство 2 — новый браузер, тот же облачный store
  const c2 = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true }); await c2.addInitScript(fakeDb(store));
  const p2 = await c2.newPage(); p2.on('pageerror', e => errs.push(e.message));
  await p2.goto(url); await p2.waitForTimeout(600);
  await p2.fill('#lg', 'шерлок_221'); await p2.fill('#pw', 'wrong'); await p2.click('#go'); await p2.waitForTimeout(800); console.log('wrong pw:', await p2.textContent('#msg'));
  await p2.fill('#pw', 'secret1'); await p2.click('#go'); await p2.waitForTimeout(1200);
  console.log('device2 card:', (await p2.textContent('.casecard[data-c="g5"]')).trim());
  await p2.screenshot({ path: 'c_device2.png' });
  console.log('errors', errs); await b.close();
})();
