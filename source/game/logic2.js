// Дополнительная проверка логики с точки зрения игрока
global.window = globalThis;
require('./case1.js'); require('./gen.js');
const cases = [window.CASES[0]].concat(window.CaseGen.genAll(100));
const ts = t => { const [d, h] = t.split(' '); const [dd, mm] = d.split('.'); const [H, M] = h.split(':'); return ((+mm * 40 + +dd) * 24 + +H) * 60 + +M; };
let bad = 0;
cases.forEach(C => {
  const e = [];
  // хронология переписок в каждом телефоне
  Object.values(C.phones).forEach(ph => ph.chats.forEach(ch => { for (let i = 1; i < ch.msgs.length; i++) if (ts(ch.msgs[i][0]) < ts(ch.msgs[i - 1][0])) e.push('порядок сообщений: ' + (ch.with || ch.name)); }));
  // время в названии улики совпадает со временем сообщения
  Object.values(C.phones).forEach(ph => ph.chats.forEach(ch => ch.msgs.forEach(m => { if (!m[3]) return; const n = C.evidence[m[3]].name.match(/ в (\d\d:\d\d)$/); if (n && n[1] !== m[0].split(' ')[1]) e.push('время в улике ' + m[3] + ': ' + n[1] + ' ≠ ' + m[0]); })));
  // основания: у каждого подозреваемого есть свой пункт 1, задержать можно только виновного
  if (C._meta) {
    const cu = C._meta.culprit;
    Object.values(C.actions).forEach(a => {
      const g = a.grounds;
      if (!g || g.length !== 2) e.push('основания ' + a.person);
      g[0].forEach(id => { if (!C.evidence[id]) e.push('нет улики ' + id); });
      if (a.person !== cu && !g[1].includes('__none')) e.push('невиновного можно поставить на место: ' + a.person);
      if (a.person !== cu && g[0].some(id => C.evidence[id] && !(C.evidence[id].name + C.evidence[id].desc).includes(C.people[a.person].name.slice(0, 3)))) e.push('пункт 1 не про человека ' + a.person);
    });
    const txt = JSON.stringify(C).toLowerCase();
    if (/все говорят правду/.test(txt)) e.push('фраза «все говорят правду»');
  }
  if (e.length) { bad++; console.log('✗', C.num || 1, C.title, [...new Set(e)].slice(0, 4).join('; ')); }
});
console.log(bad ? 'ОШИБОК: ' + bad : 'Логика переписок и оснований для задержания в порядке во всех ' + cases.length + ' делах.');
