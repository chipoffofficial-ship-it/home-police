const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  const url = 'file://' + __dirname + '/dist/index.html';
  await p.goto(url); await p.waitForTimeout(400);
  // ошибки регистрации
  await p.fill('#nm', 'А'); await p.click('#go'); console.log('1:', await p.textContent('#msg'));
  await p.fill('#nm', 'Анна'); await p.fill('#pin', '12'); await p.click('#go'); console.log('2:', await p.textContent('#msg'));
  await p.fill('#pin', '1234'); await p.fill('#pin2', '4321'); await p.click('#go'); console.log('3:', await p.textContent('#msg'));
  await p.fill('#pin2', '1234'); await p.click('#go'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'm_menu.png' });
  // играем немного
  await p.click('.casecard[data-c="c1"]'); await p.waitForTimeout(1500);
  if (await p.$('#acc')) { await p.click('#acc'); await p.waitForSelector('#end', { timeout: 15000 }); await p.click('#end'); }
  await p.click('.nav[data-v="map"]'); await p.click('.loc[data-l="workshop"]'); await p.click('.spot[data-s="safe"]'); await p.waitForTimeout(600);
  // перезагрузка: автовход
  await p.reload(); await p.waitForTimeout(600);
  console.log('autologin:', !!(await p.$('.casecard')), 'status:', (await p.textContent('.casecard[data-c="c1"]')).slice(-12));
  await p.click('#lo'); await p.waitForTimeout(300);
  await p.fill('#pin', '0000'); await p.click('#go'); console.log('4:', await p.textContent('#msg'));
  await p.fill('#pin', '1234'); await p.click('#go'); await p.waitForTimeout(300);
  console.log('relogin:', !!(await p.$('.casecard')), 'xfer button:', !!(await p.$('#xfer')));
  console.log('errors', errs); await b.close();
})();
