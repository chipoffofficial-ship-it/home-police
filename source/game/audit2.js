// Аудит-2: ищет признаки, по которым преступника видно «на глаз» (до улик).
// Для каждого признака: как часто преступник уникален / максимален / минимален — против среднего невиновного.
global.window = globalThis;
require('./case1.js'); require('./gen.js');
const N = +process.argv[2] || 400;
const all = []; for (let i = 1; i <= N; i++) all.push(window.CaseGen.genCase(i));
const st = {};
const add = (k, sub, v) => { st[k] = st[k] || { cu: {}, inn: {}, n: 0 }; st[k][sub] = st[k][sub] || {}; };
const res = {};
function feats(C, pid) {
  const p = C.people[pid], T = C.talk[pid], vph = C.phones.v;
  const chat = vph.chats.find(c => c.with === p.name) || { msgs: [] };
  const top = T.topics.filter(t => !t.req);
  const ans = id => ((top.find(t => t.id === id) || {}).lines || []).join(' ');
  const bank = C.bank[pid] || { tx: [] };
  const f = {
    pos_accuse: C.accuse.questions[0].opts.findIndex(o => o[0] === pid),
    pos_chat: vph.chats.findIndex(c => c.with === p.name),
    pos_contacts: vph.contacts.findIndex(c => c[0] === p.name),
    pos_bank: Object.keys(C.bank).indexOf(pid),
    pos_summon: Object.keys(C.summon).indexOf(pid),
    pid_num: +pid.slice(1),
    age: p.age, female: p.f ? 1 : 0, role: p.role, work_has_comma: /,|:/.test(p.db.work) ? 1 : 0,
    record: p.db.record, family: p.db.family, car: p.db.car ? 1 : 0, glasses: p.pt.glasses ? 1 : 0, collar: p.pt.collar,
    intro_n: T.intro.length, intro_len: T.intro.join(' ').length, intro0: T.intro[0].replace(p.name, 'X').replace(/^\* X, [^.]*\. /, ''), intro1: T.intro[1],
    topics_n: top.length, topics_ids: top.map(t => t.id).join(','),
    rel_len: ans('rel').length, where_len: ans('where').length, contact_len: ans('contact').length, susp_len: ans('susp').length, car_len: ans('car').length,
    all_len: top.map(t => t.lines.join(' ')).join(' ').length,
    where_home: /дома/i.test(ans('where')) ? 1 : 0, where_venue: /«/.test(ans('where')) ? 1 : 0,
    contact_no: /^нет|не общал|не видел|не писал/i.test(ans('contact')) ? 1 : 0,
    susp_none: (top.find(t => t.id === 'susp') || {}).set ? 0 : 1,
    where_sets: ((top.find(t => t.id === 'where') || {}).set || []).length,
    notes_n: top.filter(t => t.note).length,
    chat_n: chat.msgs.length, chat_last_len: chat.msgs.length ? chat.msgs[chat.msgs.length - 1][2].length : 0,
    chat_pins: chat.msgs.filter(m => m[3]).length, chat_last_who: chat.msgs.length ? chat.msgs[chat.msgs.length - 1][1] : '',
    in_calls: vph.calls.filter(c => c.who === p.name).length,
    bank_n: bank.tx.length, bank_pins: bank.tx.filter(t => t[3]).length, bank_crime_day: bank.tx.filter(t => t[0].split(' ')[0] === (C.bank[Object.keys(C.bank)[0]].tx[0] || [''])[0].split(' ')[0]).length,
    in_messages: C.messages.filter(m => !JSON.stringify(m.req || []).match(/detained|confession|cphone/) && JSON.stringify(m).includes(p.name)).length,
    in_intro: (C.intro || []).join(' ').includes(p.name) ? 1 : 0,
    in_report: (C.evidence.ev_report.desc || '').includes(p.name) ? 1 : 0,
    on_map: C.locations.filter(l => (l.people || []).includes(pid)).length,
  };
  return f;
}
all.forEach(C => {
  const cu = C._meta.culprit;
  const sus = C.accuse.questions[0].opts.map(o => o[0]);
  const F = Object.fromEntries(sus.map(p => [p, feats(C, p)]));
  Object.keys(F[cu]).forEach(k => {
    res[k] = res[k] || { uniqCu: 0, uniqInn: 0, maxCu: 0, maxInn: 0, minCu: 0, minInn: 0, n: 0, vals: {} };
    const r = res[k]; r.n++;
    const vals = sus.map(p => F[p][k]);
    const isNum = typeof F[cu][k] === 'number';
    const uniq = p => sus.filter(q => q !== p && F[q][k] === F[p][k]).length === 0;
    const mx = p => isNum && sus.every(q => q === p || F[q][k] < F[p][k]);
    const mn = p => isNum && sus.every(q => q === p || F[q][k] > F[p][k]);
    const inns = sus.filter(p => p !== cu);
    if (uniq(cu)) r.uniqCu++; r.uniqInn += inns.filter(uniq).length / inns.length;
    if (mx(cu)) r.maxCu++; r.maxInn += inns.filter(mx).length / inns.length;
    if (mn(cu)) r.minCu++; r.minInn += inns.filter(mn).length / inns.length;
    const cv = String(F[cu][k]).slice(0, 40); r.vals[cv] = (r.vals[cv] || 0) + 1;
  });
});
const rows = Object.entries(res).map(([k, r]) => {
  const d = Math.max(r.uniqCu - r.uniqInn, r.maxCu - r.maxInn, r.minCu - r.minInn);
  return [k, d, `уник ${r.uniqCu}/${r.uniqInn.toFixed(0)} макс ${r.maxCu}/${r.maxInn.toFixed(0)} мин ${r.minCu}/${r.minInn.toFixed(0)}`, Object.entries(r.vals).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => x.join('×')).join(' | ')];
}).sort((a, b) => b[1] - a[1]);
console.log(`Из ${N} дел. Формат: преступник/невиновный. Перекос > ${Math.round(N * 0.08)} — подозрительно.`);
rows.forEach(r => console.log((r[1] > N * 0.08 ? '⚠️ ' : '   ') + r[0].padEnd(16), r[2], '   частые у преступника:', r[3]));
