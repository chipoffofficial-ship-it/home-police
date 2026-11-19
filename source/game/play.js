const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + __dirname + '/dist/index.html'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'a_reg.png' });
  const ff = async () => { for (let k=0;k<2;k++){ await p.evaluate(() => __HP.S.queue.forEach(q => q.due = __HP.S.play)); await p.waitForTimeout(1300);} };
  const answerCall = async (shot) => { for (let i = 0; i < 6; i++) { if (await p.$('#acc')) { await p.click('#acc'); await p.waitForTimeout(6500); if (shot) await p.screenshot({ path: shot }); await p.click('#end'); return true; } await p.waitForTimeout(500); } return false; };
  const clear = async () => { for (let k=0;k<3;k++){ if (await p.$('#acc')) { await p.click('#acc'); await p.waitForSelector('#end',{timeout:20000}); await p.click('#end'); await p.waitForTimeout(200);} else if (await p.$('#pc')) { await p.click('#pc'); } else if (await p.$('#end')) { await p.click('#end'); } } };
  const nav = async v => { await clear(); await p.click(`.nav[data-v="${v}"]`); await p.waitForTimeout(250); };
  const closeOv = async () => { if (await p.$('#pc')) await p.click('#pc'); };
  await p.fill('#nm', 'Шерлок'); await p.fill('#pin', '1234'); await p.fill('#pin2', '1234'); await p.click('#go'); await p.waitForTimeout(500);
  await p.screenshot({ path: 'a_title.png' });
  await p.click('.casecard[data-c="c1"]'); await p.waitForTimeout(800);
  await answerCall('a_call.png');
  await p.screenshot({ path: 'a_case.png' });
  // осмотр мастерской
  await nav('map'); await p.click('.loc[data-l="workshop"]'); await p.waitForTimeout(300);
  for (const s of ['body', 'safe', 'vitrine', 'bench', 'phone', 'back']) { await p.click(`.spot[data-s="${s}"]`); await p.waitForTimeout(200); }
  await p.screenshot({ path: 'a_scene.png' });
  // телефон: PIN
  await nav('phones');
  for (const k of '1406') { await p.click(`.pad [data-k="${k}"]`); await p.waitForTimeout(80); }
  await p.waitForTimeout(400);
  await p.click('[data-tab="calls"]'); await p.click('[data-pin="ev_call_2247"]');
  await p.click('[data-tab="memos"]'); await p.click('[data-pin="ev_voice_memo"]');
  await p.click('[data-tab="msgs"]'); await p.click('.plist .row[data-c="0"]'); await p.waitForTimeout(200);
  await p.hover('.bub:last-child'); await p.click('.bub:last-child .pin');
  await p.screenshot({ path: 'a_phone.png' });
  // экспертиза камней
  await nav('evidence'); await p.click('.ev[data-e="ev_stones"]'); await p.click('#lab'); await ff();
  await answerCall();
  // опрос улицы
  await nav('map'); await p.click('.loc[data-l="street"]'); await p.waitForTimeout(300);
  await clear(); await p.click('.person[data-p="zoya"]'); await p.waitForTimeout(1500);
  await p.click('.topic[data-t="night"]'); await p.waitForTimeout(3500);
  await p.screenshot({ path: 'a_talk.png' });
  await p.click('#bye');
  // банк Дениса
  await nav('bank'); await p.click('[data-b="denis"]'); await ff(); await nav('bank'); await p.click('[data-b="denis"]'); await p.waitForTimeout(200);
  await p.click('[data-pin="ev_velo_payment"]'); await p.click('[data-pin="ev_denis_from_alina"] >> nth=0'); await p.click('[data-own="alina"]');
  await p.screenshot({ path: 'a_bank.png' });
  // ложь Дениса
  await nav('people'); await p.click('.person[data-p="denis"]'); await p.click('#talk'); await p.waitForTimeout(1500);
  await p.click('#pres'); await p.click('.picker [data-e="ev_call_2247"]'); await p.waitForTimeout(3500);
  await p.screenshot({ path: 'a_lie.png' });
  await p.click('#bye');
  // задержание
  // неверный запрос: Кирилл
  await nav('people'); await p.click('.person[data-p="kirill"]').catch(async () => { await p.click('.person[data-p="marina"]'); });
  await p.click('#det'); await p.click('.picker [data-e="ev_call_2247"]'); await p.click('#dg'); await p.waitForTimeout(300);
  await p.screenshot({ path: 'a_reject.png' }); await p.click('#pc');
  // верный запрос, но без оснований (только звонок) — тоже отказ
  await nav('people'); await p.click('.person[data-p="denis"]'); await p.click('#det'); await p.click('.picker [data-e="ev_report"]'); await p.click('#dg'); await p.waitForTimeout(300); await p.click('#pc');
  // правильный запрос
  await nav('people'); await p.click('.person[data-p="denis"]'); await p.click('#det');
  await p.click('.picker [data-e="ev_call_2247"]'); await p.click('.picker [data-e="ev_velo_payment"]'); await p.click('#dg'); await p.waitForTimeout(400);
  await p.screenshot({ path: 'a_dossier.png' }); console.log('DET', await p.evaluate(() => [!!__HP.S.flags.denis_detained, __HP.S.badDetain, document.querySelector('.ov') && document.querySelector('.ov').innerText.slice(0,200)]));
  await ff(); await answerCall();
  // телефон Дениса в техотдел
  await nav('phones'); await p.click('[data-ph="denis"]'); await p.click('#tech'); await ff(); await p.waitForTimeout(500);
  await nav('phones'); await p.click('[data-ph="denis"]'); await p.click('.plist .row[data-c="0"]'); await p.waitForTimeout(200);
  await p.screenshot({ path: 'a_phone2.png' });
  await p.evaluate(() => {}); 
  const pinMsgT = await p.$('[data-pin="ev_msg_t"]'); await p.hover('.bub:nth-last-child(2)'); await pinMsgT.click();
  // прослушка: нужен ev_alina_from_abaev → банк Алины
  await nav('bank'); await p.click('[data-b="alina"]'); await ff(); await nav('bank'); await p.click('[data-b="alina"]'); await p.waitForTimeout(200);
  await p.click('[data-pin="ev_alina_from_abaev"]');
  await nav('wire'); await p.click('[data-w="timur"]'); await ff(); await nav('wire');
  await p.click('[data-pin="ev_wiretap_call"]');
  await p.screenshot({ path: 'a_wire.png' });
  // признание
  await nav('people'); await p.click('.person[data-p="denis"]'); await p.click('#talk'); await p.waitForTimeout(800);
  await p.click('#pres'); await p.click('.picker [data-e="ev_wiretap_call"]'); await p.waitForTimeout(3500);
  await p.click('.topic[data-t="confess"]'); await p.waitForTimeout(6000);
  await p.screenshot({ path: 'a_confess.png' });
  await p.click('#bye');
  // обвинение
  await nav('case'); await p.click('#accuse'); await p.waitForTimeout(300);
  for (const v of ['denis', 'swap', 'timur']) { await p.click(`input[value="${v}"]`); await p.click('#nx'); await p.waitForTimeout(150); }
  for (const e of ['ev_call_2247', 'ev_msg_t', 'ev_wiretap_call', 'ev_velo_payment']) await p.click(`.picker [data-e="${e}"]`);
  await p.click('#go'); await p.waitForTimeout(600);
  await p.waitForTimeout(1500); await p.screenshot({ path: 'a_verdict.png' });
  const st = await p.evaluate(() => ({ score: __HP.S.accused.score, ev: __HP.S.ev.length, inbox: __HP.S.inbox.length, bad: __HP.S.badDetain, detained: !!__HP.S.flags.denis_detained }));
  console.log(JSON.stringify(st), 'errors', errs);
  await b.close();
})();
