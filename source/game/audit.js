// Аудит: что отличает преступника от невиновных «на глаз», до расследования
global.window = globalThis;
require('./case1.js'); require('./gen.js');
const all = window.CaseGen.genAll(100);
const stat = {};
const bump = k => (stat[k] = (stat[k] || 0) + 1);
const issues = [];
all.forEach(C => {
  const cu = C._meta.culprit;
  const sus = C.accuse.questions[0].opts.map(o => o[0]);
  const vph = C.phones.v;
  const feat = pid => {
    const p = C.people[pid], T = C.talk[pid];
    const chat = vph.chats.find(c => c.with === p.name);
    const firstTopics = T.topics.filter(t => !t.req).map(t => t.id).join(',');
    return {
      topics: firstTopics,
      pins: chat ? chat.msgs.filter(m => m[3]).length : 0,
      msgs: chat ? chat.msgs.length : 0,
      eveningMsg: chat ? chat.msgs.some(m => m[0].startsWith(vph.calls.length ? '' : '') && m[0].split(' ')[0] === (C.bank[pid].tx.find(t => t[3]) || [''])[0].split(' ')[0]) : false,
      introLen: T.intro.length,
      home: /дома/i.test(T.topics.find(t => t.id === 'where').lines[0] || ''),
      inCalls: vph.calls.some(c => c.who === p.name),
      reporter: C.evidence.ev_report.desc.includes(p.name),
    };
  };
  const F = Object.fromEntries(sus.map(p => [p, feat(p)]));
  ['topics', 'pins', 'msgs', 'introLen', 'home', 'inCalls', 'reporter', 'eveningMsg'].forEach(k => {
    const v = F[cu][k];
    const same = sus.filter(p => p !== cu && JSON.stringify(F[p][k]) === JSON.stringify(v)).length;
    if (same === 0) bump(k);
    const inn = sus.find(p => p !== cu);
    const same2 = sus.filter(p => p !== inn && JSON.stringify(F[p][k]) === JSON.stringify(F[inn][k])).length;
    if (same2 === 0) bump('(для сравнения у невиновного) ' + k);
  });
});
console.log('Признак уникален у преступника (из 100 дел):', stat);
