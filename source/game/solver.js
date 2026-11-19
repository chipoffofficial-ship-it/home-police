// Автопрохождение дел по правилам движка: проверяет, что каждое дело решаемо
global.window = globalThis;
require('./case1.js'); require('./gen.js');
const cases = [window.CASES[0], window.CaseGen.genCase(424242, { tutorial: true })].concat(window.CaseGen.genAll(100));

function solve(C) {
  const F = {}, EV = [], done = {}, presented = {};
  const has = f => !!F[f];
  const chk = f => (f[0] === '!' ? !has(f.slice(1)) : has(f));
  const req = r => !r || r.every(x => (Array.isArray(x) ? x.some(y => chk(y)) : chk(x)));
  let changed = true;
  const set = f => { if (!F[f]) { F[f] = 1; changed = true; } };
  const give = id => { if (!C.evidence[id]) throw new Error('нет улики ' + id); if (!EV.includes(id)) { EV.push(id); set(id); } };
  C.start.forEach(f => (C.evidence[f] ? give(f) : set(f)));
  const errors = [];
  let rounds = 0;
  while (changed && rounds < 200) {
    changed = false; rounds++;
    C.messages.forEach(m => { if (!done['m' + m.id] && req(m.req)) { done['m' + m.id] = 1; (m.set || []).forEach(set); changed = true; } });
    C.locations.forEach(l => {
      if (!req(l.req)) return;
      set('v_' + l.id);
      (l.people || []).forEach(p => set('k_' + p));
      (l.spots || []).forEach(s => { if (req(s.req) && !done['s' + s.id + l.id]) { done['s' + s.id + l.id] = 1; changed = true; (s.set || []).forEach(set); (s.give || []).forEach(give); } });
    });
    const canTalk = pid => {
      if (C.people[pid].victim) return false;
      const sm = C.summon[pid]; if (sm && req(sm.req)) return true;
      return C.locations.some(l => req(l.req) && (l.people || []).includes(pid) && has('v_' + l.id));
    };
    Object.keys(C.talk).forEach(pid => {
      if (!canTalk(pid)) return;
      set('k_' + pid);
      const T = C.talk[pid];
      T.topics.forEach(t => { if (req(t.req) && !has('t_' + pid + '_' + t.id)) { set('t_' + pid + '_' + t.id); (t.set || []).forEach(set); (t.give || []).forEach(give); } });
      EV.slice().forEach(e => {
        let resp = null;
        (T.presentFlags || []).forEach(pf => { if (!resp && pf.ev === e && req(pf.req)) resp = pf; });
        if (!resp && T.present && T.present[e]) { const r = T.present[e]; const o = Array.isArray(r) ? { lines: r } : r; if (o && req(o.req)) resp = o; }
        const key = pid + ':' + e + ':' + (resp ? resp.lines[0] : '');
        if (resp && !presented[key]) { presented[key] = 1; changed = true; (resp.set || []).forEach(set); (resp.give || []).forEach(give); }
      });
    });
    Object.entries(C.phones).forEach(([k, ph]) => {
      if (!req(ph.req)) return;
      set(ph.openFlag);
      ph.calls.forEach(c => c.ev && give(c.ev));
      ph.chats.forEach(c => c.msgs.forEach(m => m[3] && give(m[3])));
      (ph.notes || []).forEach(n => n.ev && give(n.ev)); (ph.memos || []).forEach(n => n.ev && give(n.ev));
    });
    Object.entries(C.records || {}).forEach(([k, r]) => { const vis = r.show ? req(r.show) : r.owner ? has('k_' + r.owner) : true; if (!vis || !req(r.req)) return; r.rows.forEach(t => { if (t[2]) give(t[2]); if (t[3]) set('k_' + t[3]); }); });
    Object.entries(C.bank).forEach(([k, b]) => { if (!has('k_' + b.owner) || !req(b.req)) return; b.tx.forEach(t => { if (t[3]) give(t[3]); if (t[4]) set('k_' + t[4]); }); });
    Object.entries(C.wiretaps || {}).forEach(([k, w]) => { if (!has('k_' + w.target) || !req(w.req)) return; w.calls.forEach(c => give(c.ev)); });
    EV.slice().forEach(id => { const e = C.evidence[id]; if (e.lab && req(e.lab.req) && !done['lab' + id]) { done['lab' + id] = 1; set('lab_any'); (e.lab.set || []).forEach(set); changed = true; } });
    Object.entries(C.actions).forEach(([k, a]) => { if (req(a.req) && (a.grounds || []).every(g => g.some(e => EV.includes(e))) && !done['a' + k]) { done['a' + k] = 1; changed = true; (a.done || []).forEach(set); (a.give || []).forEach(give); } });
  }
  // проверки
  const A = C.accuse;
  if (!req(A.req)) errors.push('обвинение недоступно');
  if (!has('confession')) errors.push('нет признания');
  A.questions.forEach(q => { if (!q.opts.some(o => o[0] === q.correct)) errors.push('нет верного ответа: ' + q.q); });
  const killer = A.questions[0].correct;
  A.questions[0].opts.forEach(o => { if (!has('k_' + o[0])) errors.push('подозреваемый не известен игроку: ' + o[1]); });
  const keys = A.keyEvidence.filter(e => EV.includes(e));
  if (keys.length < 4) errors.push('мало ключевых улик: ' + keys.length);
  if (C.status) Object.entries(C.status).forEach(([pid, arr]) => arr.forEach(([f]) => { if (!has(f)) errors.push('не достигнут статус ' + f + ' у ' + C.people[pid].name); }));
  // невиновных задержать нельзя
  Object.entries(C.actions).forEach(([k, a]) => { if (a.person !== killer && has(a.done[0]) && a.done[0] !== 'denis_detained') errors.push('задержан невиновный ' + a.person); });
  return { errors, ev: EV.length, rounds, flags: Object.keys(F).length };
}

let bad = 0;
cases.forEach(C => {
  let r;
  try { r = solve(C); } catch (e) { r = { errors: ['исключение: ' + e.message] }; }
  if (r.errors.length) { bad++; console.log(`✗ ${C.num || 1} ${C.title}: ${r.errors.join('; ')}`); }
});
// проверка ссылок на улики во всех делах
cases.forEach(C => {
  const ev = new Set(Object.keys(C.evidence)), errs = [];
  const chk = (id, w) => { if (id && !ev.has(id)) errs.push(id + ' в ' + w); };
  C.locations.forEach(l => (l.spots || []).forEach(s => (s.give || []).forEach(g => chk(g, 'spot'))));
  Object.values(C.phones).forEach(p => { p.calls.forEach(c => chk(c.ev, 'call')); p.chats.forEach(c => c.msgs.forEach(m => chk(m[3], 'msg'))); });
  Object.values(C.records || {}).forEach(r => r.rows.forEach(t => { chk(t[2], 'rec'); if (t[3] && !C.people[t[3]]) errs.push('владелец ' + t[3]); }));
  Object.values(C.bank).forEach(b => b.tx.forEach(t => { chk(t[3], 'tx'); if (t[4] && !C.people[t[4]]) errs.push('владелец ' + t[4]); }));
  Object.values(C.talk).forEach(T => { T.topics.forEach(t => (t.give || []).forEach(g => chk(g, 'topic'))); Object.keys(T.present || {}).forEach(e => chk(e, 'present')); (T.presentFlags || []).forEach(f => chk(f.ev, 'pf')); });
  C.accuse.keyEvidence.forEach(e => chk(e, 'key'));
  Object.keys(C.talk).forEach(p => { if (!C.people[p]) errs.push('talk без человека ' + p); });
  C.locations.forEach(l => (l.people || []).forEach(p => { if (!C.people[p]) errs.push('место: нет человека ' + p); }));
  C.messages.forEach(m => { if (!C.people[m.from]) errs.push('сообщение от ' + m.from); });
  if (errs.length) { bad++; console.log(`✗ ссылки ${C.num || 1}: ${errs.slice(0, 5).join(', ')}`); }
});
console.log(bad ? `ОШИБОК: ${bad}` : `Все ${cases.length} дел проходятся до признания и верного обвинения.`);
