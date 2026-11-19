const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0 Mobile Safari/537.36', viewport: { width: 412, height: 860 } });
  await ctx.route('https://chipoffofficial-ship-it.github.io/**', r => {
    const u = r.request().url();
    if (u.includes('version.json')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: '{"version":4}' });
    if (u.includes('game.html')) return r.fulfill({ status: 200, contentType: 'text/html', headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync('/tmp/game_v4.html', 'utf8') });
    r.abort();
  });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/dist/index.html'); await p.waitForTimeout(500);
  console.log('start version', await p.evaluate(() => window.HP_VERSION));
  await p.fill('#nm', 'Пуаро'); await p.fill('#pin', '4321'); await p.fill('#pin2', '4321'); await p.click('#go'); await p.waitForTimeout(400);
  await p.click('.casecard[data-c="g7"]'); await p.waitForTimeout(1200);
  if (await p.$('#acc')) { await p.click('#acc'); await p.waitForSelector('#end', { timeout: 20000 }); await p.click('#end'); }
  await p.waitForTimeout(2500);
  const toast = await p.$('.toast button'); console.log('update toast:', !!toast);
  await toast.click(); await p.waitForTimeout(2500);
  const st = await p.evaluate(() => ({ ver: window.HP_VERSION, cases: window.CASES.length, user: !!document.querySelector('.casecard'), g7: (document.querySelector('.casecard[data-c="g7"]') || {}).textContent }));
  console.log('after reload:', JSON.stringify(st));
  await p.reload(); await p.waitForTimeout(1500);
  console.log('second launch version', await p.evaluate(() => window.HP_VERSION), 'toast again:', !!(await p.$('.toast button')));
  console.log('errors', errs); await b.close();
})();
