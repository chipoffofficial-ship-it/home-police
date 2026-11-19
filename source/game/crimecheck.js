// Ищет фразы, не подходящие к типу преступления
global.window = globalThis;
require('./case1.js'); require('./gen.js');
const all = window.CaseGen.genAll(100);
const BAD = {
  theft: /жертв|убив|убил|убий|убит\b|тел[оа]\b|трупа?|мёртв|мертв|похорон|отрав|яд\b|пожар|поджо|поджёг|сгорел|скорую/i,
  arson: /жертв|убив|убил|убий|убит\b|тел[оа]\b|трупа?|мёртв|мертв|похорон|отрав|яд\b|украл|кражи?\b|сейф/i,
  poison: /убив|убил|убий|убит\b|тел[оа]\b|трупа?|мёртв|мертв|похорон|пожар|поджо|кражи?\b/i,
  murder: /отрав|пожар|поджо|кражи?\b/i,
};
const hits = {};
all.forEach(C => {
  const re = BAD[C._meta.crime];
  const seen = new Set();
  const walk = (o, path) => {
    if (typeof o === 'string') { const m = o.match(re); if (m && !seen.has(o)) { seen.add(o); const k = C._meta.crime + ' | ' + m[0] + ' | ' + o.replace(/[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+/g, 'ИМЯ').slice(0, 140); hits[k] = (hits[k] || 0) + 1; } }
    else if (Array.isArray(o)) o.forEach(x => walk(x, path)); else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, path + '.' + k));
  };
  walk({ talk: C.talk, ev: C.evidence, msg: C.messages, loc: C.locations, ph: C.phones, acc: C.accuse, intro: C.intro, tasks: C.tasks, bank: C.bank }, '');
});
const list = Object.entries(hits).sort((a, b) => b[1] - a[1]);
list.forEach(([k, v]) => console.log(v, k));
console.log(list.length ? `Неподходящих фраз: ${list.length}` : 'Неподходящих фраз нет.');
