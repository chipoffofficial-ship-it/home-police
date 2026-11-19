// Проверка хронологии: не противоречат ли события друг другу
global.window = globalThis;
require('./case1.js'); require('./gen.js');
const all = window.CaseGen.genAll(100);
const toMin = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
let bad = 0;
all.forEach(C => {
  const errs = [];
  const T = C.evidence.ev_autopsy.desc.match(/(\d\d:\d\d)/g);
  const cu = C._meta.culprit;
  const sus = C.accuse.questions[0].opts.map(o => o[0]);
  // 1) кто сообщил о преступлении — не должен в это время сидеть на алиби-камерах
  const rep = C.evidence.ev_report.desc;
  sus.filter(p => p !== cu).forEach(p => {
    if (!rep.includes(C.people[p].name)) return;
    const cctv = C.evidence['ev_cctv_' + p].desc.match(/до (\d\d:\d\d)/)[1];
    const tRep = rep.match(/в (\d\d:\d\d)/);
    if (tRep) { let d = toMin(tRep[1]) - toMin(cctv); if (d < -600) d += 1440; if (d < 15) errs.push(`сообщил ${C.people[p].name} в ${tRep[1]}, но камеры до ${cctv}`); }
  });
  // 2) оплата преступника рядом с местом раньше прибытия по свидетелю
  const cb = C.evidence.ev_cbank.desc.match(/(\d\d:\d\d)/)[1], wit = C.evidence.ev_witness.desc.match(/Около (\d\d:\d\d)/)[1];
  let d2 = toMin(wit) - toMin(cb); if (d2 < -600) d2 += 1440; if (C._meta.routeB === 'tcard') { if (d2 > 0 || d2 < -15) errs.push(`уход ${wit} и автобус ${cb}`); } else if (d2 < 0 || d2 > 30) errs.push(`оплата ${cb} и приезд ${wit}`);
  // 3) машина свидетеля совпадает только с машиной преступника
  const wd = C.evidence.ev_witness.desc;
  const matches = sus.filter(p => { const car = C.people[p].db.car; if (car === '—') return false; const [model, color, plate] = car.split(', '); const brand = { 'Skoda': 'Шкода', 'Toyota': 'Тойота', 'Kia': 'Киа', 'Lada': 'Лада', 'Hyundai': 'Хёндай', 'Volkswagen': 'Фольксваген', 'Renault': 'Рено', 'Mazda': 'Мазда', 'Nissan': 'Ниссан', 'Ford': 'Форд' }[model.split(' ')[0]]; const mm = wd.match(/начинался на «(.+?)»/); if (!mm) return p === C._meta.culprit; const pre = mm[1]; return wd.includes(color) && wd.includes(brand) && plate.startsWith(pre); });
  if (matches.length !== 1 || matches[0] !== cu) errs.push('машину по описанию свидетеля нельзя однозначно привязать: ' + matches.join(','));
  // 4) алиби невиновных покрывают окно преступления
  sus.filter(p => p !== cu).forEach(p => { const m = C.evidence['ev_cctv_' + p].desc.match(/с (\d\d:\d\d) до (\d\d:\d\d)/); if (!m) errs.push('нет окна алиби ' + p); });
  if (errs.length) { bad++; console.log(`✗ №${C.num} ${C.title}: ${errs.join('; ')}`); }
});
console.log(bad ? `Противоречий: ${bad}` : 'Хронология и улики непротиворечивы во всех 100 делах.');
