const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ ...devices['Pixel 7'] }); const p = await ctx.newPage();
  const errs=[]; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + __dirname + '/dist/index.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'm_title.png' });
  await p.fill('#nm', 'Ватсон'); await p.fill('#pin', '1111'); await p.fill('#pin2', '1111'); await p.tap('#go'); await p.waitForTimeout(500);
  await p.tap('.casecard[data-c="g2"]'); await p.waitForTimeout(1500);
  if (await p.$('#acc')) { await p.tap('#acc'); await p.waitForTimeout(6000); await p.screenshot({ path: 'm_call.png' }); await p.tap('#end'); }
  await p.screenshot({ path: 'm_case.png' });
  await p.tap('.nav[data-v="map"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'm_map.png' });
  const vic = await p.evaluate(() => __HP.C.locations.find(l => l.id === 'office').people[0]);
  await p.tap('.loc[data-l="office"]'); await p.waitForTimeout(300);
  await p.tap(`.person[data-p="${vic}"]`); await p.waitForTimeout(1500);
  for (const t of ['what', 'who', 'phone']) { await p.tap(`.topic[data-t="${t}"]`); await p.waitForTimeout(t === 'who' ? 5000 : 3000); }
  await p.screenshot({ path: 'm_talk.png' });
  await p.tap('#bye'); await p.tap('.nav[data-v="phones"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'm_phone.png' });
  await p.tap('.nav[data-v="people"]'); await p.waitForTimeout(300); await p.screenshot({ path: 'm_people.png' });
  console.log('errors', errs); await b.close();
})();
