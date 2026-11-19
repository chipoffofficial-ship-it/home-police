global.window = globalThis;
require('./case1.js'); require('./gen.js');
const all = window.CaseGen.genAll(100);
const lines = [];
all.forEach(C => Object.entries(C.talk).forEach(([pid, T]) => {
  const add = l => { if (typeof l === 'string' && !l.startsWith('> ') && !l.startsWith('* ')) lines.push(l); };
  T.intro.forEach(add); T.topics.forEach(t => t.lines.forEach(add));
  Object.values(T.present || {}).forEach(r => (Array.isArray(r) ? r : r.lines).forEach(add));
  (T.presentFlags || []).forEach(r => r.lines.forEach(add));
}));
const norm = s => s.replace(/[А-ЯЁ][а-яё]+ [А-ЯЁ][а-яё]+(ой|ым|а|у|ов|ев|ин)?/g, 'ИМЯ').replace(/\d\d:\d\d/g, 'ВРЕМЯ').replace(/«[^»]*»/g, '«…»');
const cnt = (f, n) => { const m = {}; lines.forEach(l => { const k = f(l); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, n); };
const words = s => s.replace(/[.,!?…—«»:;]/g, ' ').split(/\s+/).filter(Boolean);
console.log('Всего реплик:', lines.length, '| уникальных:', new Set(lines.map(norm)).size);
console.log('\nСамые частые реплики:'); cnt(norm, 18).forEach(([k, v]) => console.log(v, '|', k.slice(0, 110)));
console.log('\nЧастые начала (3 слова):'); cnt(l => words(l).slice(0, 3).join(' '), 12).forEach(([k, v]) => console.log(v, '|', k));
console.log('\nЧастые концовки (3 слова):'); cnt(l => words(l).slice(-3).join(' '), 12).forEach(([k, v]) => console.log(v, '|', k));
