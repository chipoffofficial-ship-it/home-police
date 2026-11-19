// ===== HOME POLICE — движок детектива =====
(function () {
  'use strict';
  if (window.__HP_SKIP) return; // загружается обновлённая версия
  const P = window.Portrait;
  const CASES = window.CASES;
  const app = document.getElementById('app');
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------- профили и сохранения ----------
  // STORE: все профили устройства. SAVE: прогресс текущего детектива.
  let NATIVE = false;
  let STORE = { v: 4, profiles: {}, last: null, auto: null };
  let USER = null;
  let SAVE = { v: 3, cases: {}, settings: { sound: true } };
  let LEGACY = null;
  function parse(t) { try { return JSON.parse(t); } catch (e) { return null; } }
  async function loadSave() {
    let o = null;
    if (location.protocol.startsWith('http')) {
      try { const r = await fetch('/api/save', { cache: 'no-store' }); if (r.ok) { NATIVE = true; o = parse(await r.text()); } } catch (e) { /* без лаунчера */ }
    }
    if (!NATIVE) { try { o = parse(localStorage.getItem('homepolice_v4') || 'null') || parse(localStorage.getItem('homepolice_v3') || 'null'); } catch (e) { /* нет хранилища */ } }
    if (o && o.v === 4) STORE = Object.assign({ profiles: {}, last: null, auto: null }, o);
    else if (o && o.v === 3) LEGACY = o;
  }
  let saveT = null;
  function persist() {
    clearTimeout(saveT);
    saveT = setTimeout(writeStore, 400);
  }
  function writeStore() {
    if (USER && STORE.profiles[USER]) STORE.profiles[USER].save = SAVE;
    const d = JSON.stringify(STORE);
    if (NATIVE) fetch('/api/save', { method: 'POST', body: d }).catch(() => {});
    try { localStorage.setItem('homepolice_v4', d); } catch (e) { /* ignore */ }
    return d;
  }
  function pinHash(name, pin) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    const str = 'HP*' + name.toLowerCase() + '*' + pin + '*Туманск';
    for (let r = 0; r < 500; r++) for (let i = 0; i < str.length; i++) {
      h1 = Math.imul(h1 ^ str.charCodeAt(i), 16777619) >>> 0;
      h2 = Math.imul(h2 ^ (str.charCodeAt(i) + r), 2246822519) >>> 0;
    }
    return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  }
  function login(name) {
    USER = name; STORE.last = name;
    SAVE = STORE.profiles[name].save;
    SAVE.settings = Object.assign({ sound: true }, SAVE.settings || {});
    SAVE.cases = SAVE.cases || {};
    writeStore();
    screenTitle();
  }
  function logout() { musicStop(); if (USER) writeStore(); USER = null; STORE.auto = null; writeStore(); screenAuth(); }
  // ---------- экран входа и регистрации ----------
  function screenAuth(mode) {
    S = null; C = null; clearInterval(tickT);
    const names = Object.keys(STORE.profiles);
    if (!mode) mode = names.length ? 'login' : 'reg';
    const sel = STORE.last && STORE.profiles[STORE.last] ? STORE.last : names[0];
    let form = '';
    if (mode === 'login') form = `<div style="text-align:center"><div class="hint">С возвращением,</div><h2 id="who" style="margin:4px 0 2px;font-family:Georgia;font-size:28px">🕵️ ${esc(sel)}</h2><div class="hint" style="margin-bottom:14px">Введите свой PIN-код</div></div>
      <input id="pin" class="inp" type="password" inputmode="numeric" maxlength="6" placeholder="PIN-код" autocomplete="current-password" style="text-align:center;font-size:22px;letter-spacing:6px">
      <button class="btn gold" id="go" style="width:100%;margin-top:14px">Войти</button>
      ${names.length > 1 ? `<div class="hint" style="margin-top:16px">Другой детектив:</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${names.map(n => `<button class="btn sm ${n === sel ? 'gold' : ''}" data-u="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
      <div style="margin-top:14px"><button class="btn sm" id="toReg">+ Новый детектив</button></div>`;
    else if (mode === 'reg') form = `<h2 style="margin:0 0 4px;font-family:Georgia">Регистрация детектива</h2><p class="hint">Профиль и прогресс хранятся на этом устройстве.</p>
      <input id="nm" class="inp" maxlength="20" placeholder="Имя детектива" autocomplete="username">
      <input id="pin" class="inp" type="password" inputmode="numeric" maxlength="6" placeholder="Придумайте PIN-код (4–6 цифр)" autocomplete="new-password">
      <input id="pin2" class="inp" type="password" inputmode="numeric" maxlength="6" placeholder="Повторите PIN-код" autocomplete="new-password">
      <button class="btn gold" id="go" style="width:100%;margin-top:14px">Зарегистрироваться</button>
      ${names.length ? '<div style="margin-top:14px"><button class="btn sm" id="toLog">← У меня уже есть профиль</button></div>' : ''}`;
    app.innerHTML = `<div class="title fade"><div class="logoimg">${BADGE_SVG}</div><h1 class="logo">HOME POLICE</h1><div class="sub">Детективные расследования туманного города</div>
      <div class="card auth" style="width:min(440px,92vw);margin-top:22px;text-align:left;padding:22px">${form}<div id="msg" style="color:#ff9a90;margin-top:10px;min-height:20px;font-size:14px"></div></div></div>`;
    const msg = t => { $('#msg').textContent = t; if (t) snd('err'); };
    let cur = sel;
    document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => { cur = b.dataset.u; document.querySelectorAll('[data-u]').forEach(x => x.classList.toggle('gold', x === b)); const w = $('#who'); if (w) w.textContent = '🕵️ ' + cur; $('#msg').textContent = ''; $('#pin').value = ''; $('#pin').focus(); });
    const tr = $('#toReg'); if (tr) tr.onclick = () => screenAuth('reg');
    const tl = $('#toLog'); if (tl) tl.onclick = () => screenAuth(Object.keys(STORE.profiles).length ? 'login' : 'reg');
    const go = () => {
      if (mode === 'login') {
        const pin = $('#pin').value.trim();
        if (!cur) { msg('Выберите детектива'); return; }
        if (pinHash(cur, pin) !== STORE.profiles[cur].hash) { msg('Неверный PIN-код'); $('#pin').value = ''; return; }
        STORE.auto = null; STORE.last = cur;
        login(cur);
      } else if (mode === 'reg') {
        const nm = $('#nm').value.trim().replace(/\s+/g, ' ');
        const pin = $('#pin').value.trim(), pin2 = $('#pin2').value.trim();
        if (nm.length < 2) { msg('Имя — минимум 2 символа'); return; }
        if (Object.keys(STORE.profiles).some(n => n.toLowerCase() === nm.toLowerCase())) { msg('Такой детектив уже есть на этом устройстве'); return; }
        if (!/^\d{4,6}$/.test(pin)) { msg('PIN-код — от 4 до 6 цифр'); return; }
        if (pin !== pin2) { msg('PIN-коды не совпадают'); return; }
        const first = !Object.keys(STORE.profiles).length;
        STORE.profiles[nm] = { hash: pinHash(nm, pin), created: Date.now(), save: (first && LEGACY) ? LEGACY : { v: 3, cases: {}, settings: { sound: true } } };
        LEGACY = null;
        STORE.auto = null; STORE.last = nm;
        snd('win');
        login(nm);
      }
    };
    $('#go').onclick = go;
    document.querySelectorAll('.auth input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') go(); });
    const f1 = $('#nm') || $('#pin'); if (f1) setTimeout(() => f1.focus(), 50);
  }
  // ---------- звук ----------
  let AC = null;
  // ---------- ФОНОВАЯ МУЗЫКА (генерируется на лету: тихий нуар-эмбиент) ----------
  const MUS = { on: false, timer: null, bar: 0, master: null, next: 0 };
  const musicWanted = () => !SAVE || !SAVE.settings || SAVE.settings.music !== false;
  function musicStart() {
    if (MUS.on || !musicWanted()) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state === 'suspended') AC.resume();
      if (!MUS.master) {
        MUS.master = AC.createGain(); MUS.master.gain.value = 0;
        const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800; lp.Q.value = 0.3;
        // мягкое «эхо» для простора
        const dl = AC.createDelay(1.5), fb = AC.createGain(), wet = AC.createGain();
        dl.delayTime.value = 0.42; fb.gain.value = 0.32; wet.gain.value = 0.35;
        MUS.bus = AC.createGain();
        MUS.bus.connect(lp); lp.connect(MUS.master); lp.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(MUS.master);
        MUS.master.connect(AC.destination);
        // тихий дождь за окном
        const len = AC.sampleRate * 2, buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
        const ns = AC.createBufferSource(); ns.buffer = buf; ns.loop = true;
        const bp = AC.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.6;
        const rg = AC.createGain(); rg.gain.value = 0.025;
        ns.connect(bp); bp.connect(rg); rg.connect(MUS.master); ns.start();
      }
      MUS.on = true;
      MUS.master.gain.cancelScheduledValues(AC.currentTime);
      MUS.master.gain.setTargetAtTime(0.16, AC.currentTime, 2.5);
      MUS.next = AC.currentTime + 0.3;
      const tick = () => { while (MUS.next < AC.currentTime + 1.5) { musicBar(MUS.next); MUS.next += 8; } };
      tick(); MUS.timer = setInterval(tick, 500);
    } catch (e) { MUS.on = false; }
  }
  function musicStop() {
    if (!MUS.on) return;
    MUS.on = false; clearInterval(MUS.timer);
    try { MUS.master.gain.cancelScheduledValues(AC.currentTime); MUS.master.gain.setTargetAtTime(0, AC.currentTime, 0.6); } catch (e) { /* ignore */ }
  }
  // Am — Fmaj7 — Dm9 — E7(b9): медленная минорная гармония
  const CHORDS = [[57, 60, 64, 67], [53, 57, 60, 64], [50, 57, 60, 64], [52, 56, 59, 62]];
  const BASS = [45, 41, 38, 40];
  const SCALE = [69, 72, 74, 76, 79, 81, 84];
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);
  function voice(f, t, dur, vol, type, det) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = f; if (det) o.detune.value = det;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.linearRampToValueAtTime(vol * 0.8, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + dur + 0.05);
  }
  function pluck(f, t, vol) {
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 2.6);
    o.connect(g); g.connect(MUS.bus); o.start(t); o.stop(t + 2.7);
  }
  function musicBar(t) {
    const k = MUS.bar % 4; MUS.bar++;
    CHORDS[k].forEach(n => { voice(hz(n), t, 8.6, 0.018, 'sawtooth', -6); voice(hz(n), t, 8.6, 0.018, 'triangle', 5); });
    voice(hz(BASS[k] - 12), t, 8.2, 0.07, 'sine');
    // редкие ноты «пианино», как капли
    const notes = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < notes; i++) if (Math.random() < 0.8) {
      const pool = SCALE.filter(n => CHORDS[k].some(c => (n - c) % 12 === 0) || Math.random() < 0.35);
      pluck(hz(pool[Math.floor(Math.random() * pool.length)]), t + 0.8 + i * (1.4 + Math.random() * 1.2), 0.045);
    }
  }
  document.addEventListener('visibilitychange', () => { try { if (!AC) return; if (document.hidden) AC.suspend(); else AC.resume(); } catch (e) { /* ignore */ } });
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (!MUS.on && musicWanted() && USER) musicStart(); }, { passive: true }));
  function snd(k) {
    if (!SAVE.settings.sound) return;
    try {
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      const t = AC.currentTime;
      const tone = (f, d, type, v, at) => { const o = AC.createOscillator(), g = AC.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || .12, t + (at || 0)); g.gain.exponentialRampToValueAtTime(.0001, t + (at || 0) + d); o.connect(g); g.connect(AC.destination); o.start(t + (at || 0)); o.stop(t + (at || 0) + d + .05); };
      if (k === 'msg') { tone(880, .12, 'sine', .1); tone(1320, .15, 'sine', .08, .1); }
      else if (k === 'ev') { tone(523, .12, 'triangle', .12); tone(784, .2, 'triangle', .12, .1); }
      else if (k === 'ring') { for (let i = 0; i < 3; i++) { tone(660, .25, 'sine', .1, i * .5); tone(880, .25, 'sine', .08, i * .5 + .25); } }
      else if (k === 'lie') { tone(220, .25, 'sawtooth', .08); tone(330, .3, 'square', .06, .15); }
      else if (k === 'err') tone(160, .25, 'sawtooth', .08);
      else if (k === 'click') tone(700, .04, 'square', .03);
      else if (k === 'win') [523, 659, 784, 1046].forEach((f, i) => tone(f, .4, 'triangle', .12, i * .14));
    } catch (e) { /* без звука */ }
  }

  // ---------- состояние дела ----------
  let C = null, S = null;
  function newState(c) {
    return { flags: {}, ev: [], evNew: {}, labs: {}, bankReq: {}, recReq: {}, tech: {}, wire: {}, queue: [], fired: {}, inbox: [], journal: [], tlog: {}, lies: {}, presented: {}, spots: {}, notes: '', play: 0, view: 'case', pplNew: {}, pins: {}, accused: null, started: Date.now() };
  }
  function caseSt(c) { const s2 = SAVE.cases[c.id]; return s2 && (s2.gen || 0) === (c.gen || 0) ? s2 : null; }
  function openCase(id, fresh) {
    C = CASES.find(c => c.id === id);
    if (SAVE.cases[id] && (SAVE.cases[id].gen || 0) !== (C.gen || 0)) { delete SAVE.cases[id]; toast('Дело обновилось в новой версии игры — начато заново.'); }
    if (fresh || !SAVE.cases[id]) {
      SAVE.cases[id] = newState(C); SAVE.cases[id].gen = C.gen || 0;
      S = SAVE.cases[id];
      S.recReq = S.recReq || {};
      C.start.forEach(f => { if (C.evidence[f]) give(f, true); else setFlag(f, true); });
      checkTriggers();
      persist();
    }
    S = SAVE.cases[id];
    S.recReq = S.recReq || {};
    renderDesk();
    startTick();
  }

  const has = f => !!S.flags[f];
  function req(r) {
    if (!r) return true;
    for (const x of r) {
      if (Array.isArray(x)) { if (!x.some(y => typeof y === 'string' ? chk(y) : req([y]))) return false; }
      else if (!chk(x)) return false;
    }
    return true;
  }
  function chk(f) { return f[0] === '!' ? !has(f.slice(1)) : has(f); }
  function setFlag(f, silent) {
    if (S.flags[f]) return;
    S.flags[f] = 1;
    if (f.startsWith('k_')) { const pid = f.slice(2); if (C.people[pid] && !silent) { S.pplNew[pid] = 1; toast(`👤 Новое лицо в деле: ${C.people[pid].name}`); } else if (C.people[pid]) S.pplNew[pid] = 1; }
    if (!silent) { checkTriggers(); persist(); }
  }
  function setFlags(a) { (a || []).forEach(f => setFlag(f)); }
  function give(id, silent) {
    if (S.ev.includes(id)) return false;
    const e = C.evidence[id]; if (!e) return false;
    S.ev.push(id); S.evNew[id] = 1; S.flags[id] = 1;
    journal(`Улика: ${e.name}`);
    if (!silent) { snd('ev'); toast(`${e.icon} Новая улика: <b>${esc(e.name)}</b>`, 'ev'); checkTriggers(); persist(); updateBadges(); }
    return true;
  }
  function journal(text) { S.journal.push({ t: clock(), text }); }
  function clock(off) {
    const sec = 9 * 3600 + (S ? S.play : 0) * 10 + (off || 0);
    const h = Math.floor(sec / 3600) % 24, m = Math.floor(sec / 60) % 60;
    return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }

  // ---------- триггеры и очередь ----------
  function checkTriggers() {
    C.messages.forEach(m => {
      if (S.fired[m.id] || !req(m.req)) return;
      S.fired[m.id] = 1;
      S.queue.push({ due: S.play + (m.delay || 1), type: 'msg', id: m.id });
    });
  }
  let tickT = null;
  function startTick() {
    clearInterval(tickT);
    tickT = setInterval(() => {
      if (!S || document.hidden) return;
      S.play++;
      const due = S.queue.filter(q => q.due <= S.play);
      if (due.length) {
        S.queue = S.queue.filter(q => q.due > S.play);
        due.forEach(processQ);
        persist();
      }
      const cl = $('#clock'); if (cl) cl.textContent = clock();
      if (S.play % 15 === 0) persist();
      tryCall();
      renderPending();
    }, 1000);
  }
  function processQ(q) {
    if (q.type === 'msg') {
      const m = C.messages.find(x => x.id === q.id);
      const item = { id: m.id, from: m.from, time: clock(), read: false, text: m.text || null, lines: m.lines || null, call: !!m.call };
      S.inbox.unshift(item);
      setFlags(m.set);
      if (m.call) callQueue.push(item); else { snd('msg'); toast(`💬 <b>${esc(C.people[m.from].name)}</b>: ${esc(m.text.slice(0, 90))}${m.text.length > 90 ? '…' : ''}`); }
    } else if (q.type === 'lab') {
      const e = C.evidence[q.id];
      S.labs[q.id].done = true;
      setFlags(e.lab.set);
      if (e.lab.note) journal(e.lab.note);
      S.inbox.unshift({ id: 'lab_' + q.id, from: 'vera', time: clock(), read: false, text: `Готово заключение по «${e.name}». ${e.lab.text}` });
      snd('msg'); toast(`🧪 Готова экспертиза: <b>${esc(e.name)}</b>`, 'ev');
    } else if (q.type === 'bank') {
      S.bankReq[q.id].done = true;
      const b = C.bank[q.id];
      journal(`Получена выписка: ${C.people[b.owner].name}, ${b.acc}`);
      S.inbox.unshift({ id: 'bank_' + q.id, from: 'liza', time: clock(), read: false, text: `Банк прислал выписку по счёту ${b.acc} (${C.people[b.owner].name}). Смотри в «Финансах».` });
      snd('msg'); toast(`🏦 Пришла выписка: <b>${esc(C.people[b.owner].name)}</b>`);
    } else if (q.type === 'tech') {
      S.tech[q.id].done = true;
      const ph = C.phones[q.id];
      setFlag(ph.openFlag);
      journal(`Техотдел разблокировал: ${ph.title}`);
      S.inbox.unshift({ id: 'tech_' + q.id, from: 'liza', time: clock(), read: false, text: `${ph.title} разблокирован${ph.chats.some(c => c.restored) ? ', удалённые данные восстановлены' : ''}. Раздел «Телефоны».` });
      snd('msg'); toast(`📱 Разблокирован: <b>${esc(ph.title)}</b>`);
    } else if (q.type === 'partner') {
      doOrder(q.id);
    } else if (q.type === 'k9') {
      const t = (C.k9 && C.k9.text) || 'Собака покрутилась у входа, но след затоптан.';
      S.inbox.unshift({ id: 'k9_' + S.play, from: 'kin', time: clock(), read: false, text: t });
      journal('Кинолог: ' + t); snd('msg'); toast('🐕 Кинолог закончил работу — сообщение в телефоне');
    } else if (q.type === 'rec') {
      S.recReq = S.recReq || {}; S.recReq[q.id].done = true;
      const r = C.records[q.id];
      journal(`Получен ответ: ${r.title}`);
      S.inbox.unshift({ id: 'rec_' + q.id, from: 'liza', time: clock(), read: false, text: `Пришёл ответ: ${r.title}. Раздел «Запросы».` });
      snd('msg'); toast(`📡 Пришёл ответ: <b>${esc(r.title)}</b>`);
    } else if (q.type === 'wire') {
      S.wire[q.id].done = true;
      journal(`Получены записи прослушки: ${C.people[C.wiretaps[q.id].target].name}`);
      S.inbox.unshift({ id: 'wire_' + q.id, from: 'liza', time: clock(), read: false, text: `Есть записи разговоров с номера ${C.people[C.wiretaps[q.id].target].name}. Раздел «Прослушка».` });
      snd('msg'); toast('🎧 Новые записи прослушки');
    }
    checkTriggers();
    updateBadges();
    if (['lab', 'bank', 'tech', 'wire', 'rec'].includes(q.type)) refreshIf(q.type === 'lab' ? 'evidence' : q.type === 'bank' ? 'bank' : q.type === 'tech' ? 'phones' : q.type);
  }
  function refreshIf(v) { if (S.view === v && !$('.ov')) renderView(); }

  // ---------- уведомления ----------
  function toast(html, cls) {
    const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.innerHTML = html;
    const old = document.querySelectorAll('.toast'); old.forEach((t, i) => { t.style.bottom = (22 + (old.length - i) * 62) + 'px'; });
    document.body.appendChild(d); setTimeout(() => d.remove(), 4200);
  }

  // ---------- рабочий стол ----------
  const NAV = [
    ['case', '📁', 'Дело'], ['map', '🗺️', 'Выезд'], ['people', '👥', 'Люди'], ['db', '🗄️', 'База данных'],
    ['evidence', '🧪', 'Улики'], ['phones', '📱', 'Телефоны'], ['bank', '🏦', 'Финансы'], ['rec', '📡', 'Запросы'], ['wire', '🎧', 'Прослушка'], ['journal', '📓', 'Журнал'],
  ];
  const BADGE_SVG = `<svg viewBox="0 0 120 120"><defs><linearGradient id="lgx" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f7dd9d"/><stop offset=".6" stop-color="#c8933d"/><stop offset="1" stop-color="#8c6422"/></linearGradient></defs><path d="M60 4 L106 21 Q108 71 60 117 Q12 71 14 21Z" fill="url(#lgx)" stroke="#5c4215" stroke-width="3"/><path d="M60 15 L96 28 Q97 68 60 105 Q23 68 24 28Z" fill="#141922"/><path d="M60 32 L86 53 L81 53 L81 78 L39 78 L39 53 L34 53Z" fill="url(#lgx)"/><rect x="54" y="61" width="12" height="17" fill="#141922"/><path d="M60 84 L62.5 90 L69 90 L64 94 L66 100 L60 96.5 L54 100 L56 94 L51 90 L57.5 90Z" fill="url(#lgx)"/></svg>`;

  function renderDesk() {
    app.innerHTML = `<div class="desk fade"><div class="side"><div class="brand">${BADGE_SVG}<div><b>HOME POLICE</b><small>${rankOf(profXP()).ic} ${rankOf(profXP()).n}</small></div></div>
      ${NAV.map(([id, ic, nm]) => `<button class="nav" data-v="${id}"><span class="ic">${ic}</span>${nm}<span class="bd" id="bd_${id}" style="display:none"></span></button>`).join('')}
      <div class="sp"></div>
      <button class="myphone" id="myph"><span style="font-size:22px">📲</span><div style="text-align:left"><b style="font-size:14px">Мой телефон</b><br><small style="color:var(--mut)">Звонки и сообщения</small></div><span class="bd" id="bd_inbox" style="display:none;margin-left:auto;background:var(--red);border-radius:10px;font-size:11px;padding:1px 7px;font-weight:700"></span></button>
      <button class="nav" id="tomenu" style="margin-top:6px"><span class="ic">🏠</span>Главное меню</button>
      ${NATIVE ? '<button class="nav" id="quitg"><span class="ic">⏻</span>Выйти из игры</button>' : ''}
      </div><div class="main"><div class="topbar"><h1>${esc(C.title)}</h1><span class="chip">📅 ${esc(C.date)}</span><span class="chip">🕘 <b id="clock">${clock()}</b></span><div class="pending" id="pending"></div><div class="sp"></div>
      ${perk('partner') ? '<button class="btn sm" id="partnerB">🧑‍🤝‍🧑 Напарник</button>' : ''}<button class="btn sm" id="callG">📞 Позвонить Громову</button></div><div class="content" id="content"></div></div></div>`;
    document.querySelectorAll('.nav[data-v]').forEach(b => b.onclick = () => { snd('click'); S.view = b.dataset.v; renderView(); });
    $('#myph').onclick = openInbox;
    $('#tomenu').onclick = () => { persist(); clearInterval(tickT); screenTitle(); };
    const qg = $('#quitg'); if (qg) qg.onclick = askQuit;
    $('#callG').onclick = callGromov;
    const pb = $('#partnerB'); if (pb) pb.onclick = openPartner;
    renderView();
    renderPending();
  }
  function updateBadges() {
    if (!$('.desk')) return;
    const set = (id, n, g) => { const b = $('#bd_' + id); if (!b) return; b.style.display = n ? '' : 'none'; b.textContent = n; b.className = 'bd' + (g ? ' g' : ''); };
    set('evidence', Object.keys(S.evNew).length);
    set('people', Object.keys(S.pplNew).filter(p => has('k_' + p)).length);
    const ib = S.inbox.filter(m => !m.read).length; const bi = $('#bd_inbox'); if (bi) { bi.style.display = ib ? '' : 'none'; bi.textContent = ib; }
    set('phones', Object.keys(C.phones).filter(k => req(C.phones[k].req) && !S['seen_ph_' + k]).length);
    set('bank', Object.keys(S.bankReq).filter(k => S.bankReq[k].done && !S.bankReq[k].seen).length);
    { const nr = $('.nav[data-v="rec"]'); if (nr) nr.style.display = Object.keys(C.records || {}).length ? '' : 'none'; } { set('rec', Object.keys(S.recReq || {}).filter(k => S.recReq[k].done && !S.recReq[k].seen).length); }
    set('wire', Object.keys(S.wire).filter(k => S.wire[k].done && !S.wire[k].seen).length);
    set('case', C.tasks.filter(t => req(t.req) && !req(t.done)).length, true);
    set('map', C.locations.filter(l => req(l.req) && !has('v_' + l.id)).length, true);
  }
  function renderPending() {
    const el = $('#pending'); if (!el) return;
    const items = [];
    const rest = q => Math.max(0, q.due - S.play);
    S.queue.forEach(q => {
      if (q.type === 'lab') items.push(`🧪 ${C.evidence[q.id].name.slice(0, 18)}… ${rest(q)}с`);
      if (q.type === 'bank') items.push(`🏦 Банк: ${C.people[C.bank[q.id].owner].name.split(' ')[0]} ${rest(q)}с`);
      if (q.type === 'tech') items.push(`📱 Техотдел ${rest(q)}с`);
      if (q.type === 'wire') items.push(`🎧 Прослушка ${rest(q)}с`);
      if (q.type === 'partner') items.push(`🧑‍🤝‍🧑 Напарник ${rest(q)}с`);
      if (q.type === 'k9') items.push(`🐕 Кинолог ${rest(q)}с`);
      if (q.type === 'rec') items.push(`📡 ${C.records[q.id].short || 'Запрос'} ${rest(q)}с`);
    });
    el.innerHTML = items.slice(0, 4).map(t => `<span class="chip"><span class="spin"></span>${esc(t)}</span>`).join('');
  }

  function renderView() {
    document.querySelectorAll('.nav[data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === S.view));
    const el = $('#content'); if (!el) return;
    el.scrollTop = 0;
    ({ case: vCase, map: vMap, people: vPeople, db: vDB, evidence: vEvidence, phones: vPhones, bank: vBank, rec: vRec, wire: vWire, journal: vJournal })[S.view](el);
    updateBadges();
  }

  // ---------- ДЕЛО ----------
  function vCase(el) {
    const tasks = C.tasks.filter(t => req(t.req));
    const done = tasks.filter(t => req(t.done)).length;
    const canAccuse = req(C.accuse.req);
    el.innerHTML = `<div class="fade two" style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:22px;align-items:start">
      <div><div class="paper">${S.accused ? '<div class="stamp">ЗАКРЫТО</div>' : ''}<div style="letter-spacing:3px;font-size:12px;color:#7b6a4c;font-weight:700">УГОЛОВНОЕ ДЕЛО № ${C.num || 1}</div>
        <h2 style="font-family:Georgia;margin:4px 0 2px;font-size:28px">${esc(C.title)}</h2><div style="color:#6b5d45">${esc(C.subtitle)}</div>
        ${C.intro.map(p => `<p>${esc(p)}</p>`).join('')}</div>
        <div class="card" style="margin-top:18px"><b>👥 Ключевые лица</b><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-top:10px">${knownPeople().slice(0, 8).map(personChip).join('')}</div></div>
      </div>
      <div><div class="card"><div style="display:flex;justify-content:space-between;align-items:center"><b style="font-size:16px">🎯 Задачи расследования</b><span class="tag gold">${done}/${tasks.length}</span></div>
        <ul class="tasks" style="margin-top:8px">${tasks.map(t => `<li class="${req(t.done) ? 'done' : ''}"><span class="ck">${req(t.done) ? '✓' : ''}</span>${esc(t.text)}</li>`).join('')}</ul></div>
        <div class="card" style="margin-top:16px"><b>⚖️ Обвинение</b><p class="hint" style="margin:6px 0 12px">${canAccuse ? 'Когда будете уверены — предъявите обвинение. Ответы и выбранные улики определят исход дела в суде.' : 'Станет доступно, когда будет задержан главный подозреваемый.'}</p>
        <button class="btn ${canAccuse ? 'red' : ''}" id="accuse" ${canAccuse ? '' : 'disabled'}>${S.accused ? 'Посмотреть итог дела' : 'Предъявить обвинение'}</button>${perk('analyst') ? '<button class="btn" id="analyst" style="margin-left:8px">🧠 Спросить аналитика' : ''}</button></div>
        <div class="card" style="margin-top:16px;font-size:13.5px;color:var(--mut);line-height:1.6"><b style="color:var(--txt)">Как работать</b><br>
        🗺️ <b>Выезд</b> — осматривайте места и опрашивайте людей.<br>🧪 <b>Улики</b> — отправляйте находки на экспертизу.<br>📱 <b>Телефоны</b> — переписки, звонки, заметки. Кнопка 📌 добавляет сообщение в улики.<br>🏦 <b>Финансы</b> — выписки и владельцы счетов.<br>👥 <b>Люди</b> — допросы. Предъявляйте улики, чтобы ловить на лжи.<br>🚔 <b>Задержание</b> — в досье подозреваемого. Нужно приложить улики-основания.</div>
      </div></div>`;
    bindPersonChips(el);
    $('#accuse').onclick = () => S.accused ? showVerdict() : openAccuse();
    const an = $('#analyst'); if (an) an.onclick = openAnalyst;
  }
  function knownPeople() { return Object.keys(C.people).filter(p => has('k_' + p) && !C.people[p].colleague); }
  function pt(pid, opts) { const p = C.people[pid]; return P.portrait(Object.assign({ f: !!p.f }, p.pt), Object.assign({ dead: p.victim }, opts || {})); }
  function personChip(pid) {
    const p = C.people[pid];
    return `<div class="person" data-p="${pid}"><div class="ph">${pt(pid)}</div><div><b>${esc(p.name)}</b><small>${esc(p.role)}</small><div>${statusTags(pid)}</div></div></div>`;
  }
  function bindPersonChips(el) { el.querySelectorAll('.person[data-p]').forEach(d => d.onclick = () => openPerson(d.dataset.p)); }
  function statusTags(pid) {
    const t = [];
    if (C.people[pid].victim) t.push('<span class="tag">жертва</span>');
    (C.status && C.status[pid] || []).forEach(([f, label, cls]) => { if (has(f)) t.push(`<span class="tag ${cls}">${esc(label)}</span>`); });
    if (Object.keys(S.lies).some(k => k.startsWith(pid + ':'))) t.push('<span class="tag red">лгал</span>');
    return t.join('');
  }

  // ---------- ВЫЕЗД ----------
  function vMap(el) {
    const locs = C.locations.filter(l => req(l.req));
    el.innerHTML = `<div class="fade"><h2 class="h2">Выезд на место</h2><p class="hint">Куда поехать? Новые адреса появляются по ходу расследования.</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">${locs.map(l => `<div class="loc" data-l="${l.id}">
        <div class="art" style="background:linear-gradient(135deg,${l.art[0]},${l.art[1]})"><span class="em">${l.icon}</span><b>${esc(l.name)}</b></div>
        <div class="bd">📍 ${esc(l.addr)} ${has('v_' + l.id) ? '<span class="tag">посещено</span>' : '<span class="tag gold">новое</span>'}</div></div>`).join('')}</div></div>`;
    el.querySelectorAll('.loc').forEach(d => d.onclick = () => { snd('click'); openLocation(d.dataset.l); });
  }
  function openLocation(id) {
    const l = C.locations.find(x => x.id === id);
    setFlag('v_' + id);
    const el = $('#content');
    const spots = (l.spots || []).filter(s => req(s.req));
    const people = (l.people || []);
    people.forEach(p => setFlag('k_' + p));
    el.innerHTML = `<div class="fade"><button class="btn sm" id="back">← Ко всем адресам</button>
      <div class="scene" style="margin-top:14px"><div class="art" style="background:linear-gradient(135deg,${l.art[0]},${l.art[1]})"><span class="em">${l.icon}</span><h2>${esc(l.name)}</h2><small>📍 ${esc(l.addr)}</small></div>
      <div class="body"><p class="desc">${esc(l.desc)}</p>
      ${spots.length ? `<b style="display:block;margin-bottom:8px">🔍 Осмотр</b>${spots.map(s => `<div class="spot ${S.spots[s.id] ? 'done' : ''}" data-s="${s.id}"><span class="i">${S.spots[s.id] ? '✔️' : '🔎'}</span><div style="flex:1"><b>${esc(s.name)}</b>${S.spots[s.id] ? `<div class="res">${esc(s.text)}</div>` : ''}</div></div>`).join('')}` : ''}
      ${C.k9 && C.k9.loc === id && perk('k9') ? `<div style="margin:14px 0">${has('k9_used') ? '<span class="tag">🐕 Кинолог уже работал на этом месте</span>' : '<button class="btn gold" id="k9b">🐕 Вызвать кинолога</button> <span class="hint">собака пройдёт по следу преступника</span>'}</div>` : ''}
      ${people.length ? `<b style="display:block;margin:16px 0 8px">💬 Поговорить</b><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(260px,1fr))">${people.map(personChip).join('')}</div>` : ''}
      </div></div></div>`;
    $('#back').onclick = () => renderView();
    const kb = $('#k9b'); if (kb) kb.onclick = () => { setFlag('k9_used'); S.queue.push({ due: S.play + spd(25), type: 'k9', id: 'k9' }); persist(); toast('🐕 Кинолог с собакой выехали'); renderPending(); openLocation(id); };
    el.querySelectorAll('.spot').forEach(d => d.onclick = () => {
      const s = l.spots.find(x => x.id === d.dataset.s);
      if (!S.spots[s.id]) {
        S.spots[s.id] = 1; snd('click');
        setFlags(s.set); (s.give || []).forEach(g => give(g));
        if (s.note) journal(s.note);
        persist();
      }
      openLocation(id);
    });
    el.querySelectorAll('.person[data-p]').forEach(d => d.onclick = () => openTalk(d.dataset.p));
    updateBadges();
  }

  // ---------- ЛЮДИ ----------
  function vPeople(el) {
    const ppl = knownPeople();
    el.innerHTML = `<div class="fade"><h2 class="h2">Люди по делу</h2><p class="hint">Нажмите на человека, чтобы открыть досье и допросить.</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">${ppl.map(p => personChip(p) .replace('<b>', S.pplNew[p] ? '<b><span class="newdot"></span> ' : '<b>')).join('')}</div></div>`;
    bindPersonChips(el);
  }
  function canTalk(pid) {
    if (C.people[pid].victim) return false;
    const sm = C.summon[pid];
    if (sm && req(sm.req)) return true;
    return C.locations.some(l => req(l.req) && (l.people || []).includes(pid) && has('v_' + l.id));
  }
  function openPerson(pid) {
    delete S.pplNew[pid];
    const p = C.people[pid];
    if (p.db) setFlag('db_' + pid);
    const isSusp = suspects().includes(pid);
    const detained = Object.values(C.actions).some(a => a.person === pid && a.done && has(a.done[0]));
    const bk = Object.keys(C.bank).filter(k => C.bank[k].owner === pid);
    const el = $('#content');
    el.innerHTML = `<div class="fade"><button class="btn sm" id="back">← Назад</button>
      <div class="card" style="margin-top:14px"><div class="dossier"><div class="ph">${pt(pid, { mug: !p.victim })}</div><div>
      <h2 class="h2">${esc(p.name)}</h2><div style="color:var(--mut);margin-bottom:6px">${esc(p.role)}${p.age ? ', ' + p.age + ' лет' : ''}</div><div style="margin-bottom:10px">${statusTags(pid)}</div>
      ${p.db ? dbTable(p.db) : ''}
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        ${canTalk(pid) ? `<button class="btn gold" id="talk">${C.summon[pid] && C.summon[pid].phone ? '📞 Позвонить' : '💬 Допросить'}</button>` : (p.victim ? '' : '<button class="btn" disabled>Пока негде допросить</button>')}
        ${bk.map(k => `<button class="btn" data-bank="${k}">🏦 Выписка по счёту</button>`).join('')}
        ${isSusp ? (detained ? '<span class="tag red" style="padding:8px 12px">🚔 Задержан' + (p.f ? 'а' : '') + '</span>' : `<button class="btn red" id="det">🚔 Запросить задержание</button>`) : ''}
      </div></div></div></div>
      ${personNotes(pid)}</div>`;
    $('#back').onclick = () => renderView();
    const tb = $('#talk'); if (tb) tb.onclick = () => openTalk(pid);
    const db2 = $('#det'); if (db2) db2.onclick = () => requestDetain(pid);
    el.querySelectorAll('[data-bank]').forEach(b => b.onclick = () => { S.view = 'bank'; renderView(); });
    updateBadges();
  }
  function personNotes(pid) {
    const log = S.tlog[pid];
    if (!log || !log.length) return '';
    return `<div class="card" style="margin-top:16px"><b>🗒️ Протокол разговора</b><div style="margin-top:10px;max-height:320px;overflow:auto;font-size:14px;line-height:1.55">${log.map(([c, t]) => `<div style="padding:3px 0;${c === 'me' ? 'color:#9ec0ff' : c === 'n' ? 'color:var(--mut);font-style:italic' : c === 'lie' ? 'color:#ff9a90;font-weight:700' : c === 'ev' ? 'color:#f0d08a' : ''}">${c === 'me' ? 'Вы: ' : ''}${esc(t)}</div>`).join('')}</div></div>`;
  }
  function dbTable(d) {
    const rows = [['Дата рождения', d.dob], ['Адрес', d.addr], ['Место работы', d.work], ['Телефон', d.phone], ['Семья', d.family], ['Судимости', d.record], ['Транспорт', d.car], ['Счета', d.acc]];
    return `<table>${rows.map(([a, b]) => `<tr><td>${a}</td><td>${esc(b)}</td></tr>`).join('')}</table>`;
  }
  function detainWhy(p, okA, okB, picks0) {
    const sx = p.f ? 'ась' : 'ся', bl = p.f ? 'была' : 'был';
    const al = has('alibi_' + pid0(p));
    let t;
    if (!okA && !okB) t = `Из твоих бумаг не видно ни что ${esc(p.name)} связывал${sx} с потерпевшей стороной перед преступлением, ни что ${bl} на месте. Посмотри, какие улики касаются именно этого человека.`;
    else if (!okA) t = `Что ${esc(p.name)} ${bl} рядом с местом — допустим. Но где связь с потерпевшей стороной перед преступлением? Переписка, звонок, запись — что-то, где фигурирует именно ${p.f ? 'она' : 'он'}.`;
    else if (!okB) t = `Контакт с потерпевшей стороной — вижу. Но общаться — не преступление. Что доказывает, что ${p.f ? 'она' : 'он'} ${p.f ? 'была' : 'был'} на месте в тот вечер? Оплата, геолокация, поездка, камера, ложное алиби?`;
    else t = `Бумаги вроде есть, но картинка не складывается. Проверь ещё раз алиби и показания — что-то здесь не так.`;
    if (!okB && picks0.includes('ev_witness')) t += ' Показаний свидетеля мало: по ним одним конкретного человека на место не поставишь.';
    if (al) t += ` И учти: ${p.f ? 'её' : 'его'} алиби подтверждено.`;
    return t;
  }
  function pid0(p) { return Object.keys(C.people).find(k => C.people[k] === p); }
  function suspects() { return C.accuse.questions[0].opts.map(o => o[0]); }
  function requestDetain(pid) {
    const p = C.people[pid];
    let picks = [];
    const ov = overlay('<div class="modal" id="dm" style="width:min(900px,94vw)"></div>');
    const draw = () => {
      const m = $('#dm');
      m.innerHTML = `<div class="tag red">ЗАПРОС НА ЗАДЕРЖАНИЕ</div><h2 style="margin-top:8px">${esc(p.name)}</h2>
        <p class="hint" style="line-height:1.55">Громов подпишет задержание, только если улики докажут две вещи: <b>1)</b> именно этот человек связывался с потерпевшей стороной незадолго до преступления (переписка, звонок, запись); <b>2)</b> именно его можно поставить на место преступления (оплата картой, геолокация телефона, поездка, камера рядом с местом, разоблачённое ложное алиби). Ложь на допросе сама по себе — не основание. Выберите до 4 улик. Каждый отклонённый запрос снижает итоговую оценку.</p>
        <div class="pickwrap">${pickerHTML(picks)}</div>
        <div class="row"><span class="hint" style="margin-right:auto"><span id="pcnt">Выбрано: ${picks.length}/4</span>${S.badDetain ? ` · отклонённых запросов: ${S.badDetain}` : ''}</span><button class="btn" id="dc">Отмена</button><button class="btn red" id="dg">🚔 Отправить Громову</button></div>`;
      bindPicker(m, picks, 4);
      m.querySelector('#dc').onclick = closeOv;
      m.querySelector('#dg').onclick = () => {
        if (!picks.length) { toast('Выберите улики-основания', 'err'); return; }
        const a = Object.values(C.actions).find(x => x.person === pid);
        const gr = (a && a.grounds) || [[], []];
        const okA = !!(gr[0] && gr[0].some(e => picks.includes(e))), okB = !!(gr[1] && gr[1].some(e => picks.includes(e)));
        const ok = a && req(a.req) && gr.every(g => g.some(e => picks.includes(e)));
        closeOv();
        if (!ok) {
          if (perk('grace') && !S.graceUsed) { S.graceUsed = 1; toast('🎖️ Право на ошибку: этот отказ не снизит оценку'); } else S.badDetain = (S.badDetain || 0) + 1; persist(); snd('err');
          journal(`Громов отклонил запрос на задержание: ${p.name}.`);
          popup(`<div style="display:flex;gap:14px;align-items:center"><div style="width:64px;flex:none;border-radius:8px;overflow:hidden">${pt('gromov')}</div><h2 style="margin:0">Громов: «Не подпишу»</h2></div><p style="line-height:1.6;margin-top:12px">«Не убедил. ${detainWhy(p, okA, okB, picks)}»</p>`);
          return;
        }
        setFlags(a.done); (a.give || []).forEach(g => give(g));
        if (a.note) journal(a.note);
        snd('win'); toast(`🚔 Громов подписал задержание: ${esc(p.name)}`, 'ev'); persist();
        openPerson(pid);
      };
    };
    draw();
  }

  // ---------- БАЗА ДАННЫХ ----------
  function vDB(el) {
    el.innerHTML = `<div class="fade"><h2 class="h2">База данных МВД</h2><p class="hint">Поиск по фамилии, имени или номеру телефона. Найденные люди попадают в дело.</p>
      <div class="dbhead">ИЦ ГУ МВД · ТУМАНСК · доступ: следователь · сеанс ${clock()}</div>
      <div class="search"><input id="q" placeholder="Например: Лебедев или 913 402" autofocus><button class="btn gold" id="go">Найти</button></div><div id="res"></div></div>`;
    const go = () => {
      const q = $('#q').value.trim().toLowerCase();
      const res = $('#res');
      if (q.length < 3) { res.innerHTML = '<p class="hint">Введите хотя бы 3 символа.</p>'; return; }
      const dq = q.replace(/\D/g, '');
      const found = Object.keys(C.people).filter(pid => {
        const p = C.people[pid]; if (p.colleague || !p.db) return false;
        const words = p.name.toLowerCase().replace(/ё/g, 'е').split(/\s+/);
        const qq = q.replace(/ё/g, 'е');
        if (words.some(w => w.length >= 3 && (w === qq || w.startsWith(qq) && qq.length >= 4))) return true;
        if (p.name.toLowerCase().replace(/ё/g, 'е') === qq) return true;
        if (dq.length >= 6 && p.db.phone.replace(/\D/g, '').includes(dq)) return true;
        return false;
      });
      if (!found.length) { res.innerHTML = '<div class="card">По запросу ничего не найдено.</div>'; snd('err'); return; }
      found.forEach(f => setFlag('k_' + f));
      res.innerHTML = `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(270px,1fr))">${found.map(personChip).join('')}</div>`;
      bindPersonChips(res);
      updateBadges();
    };
    $('#go').onclick = go; $('#q').onkeydown = e => { if (e.key === 'Enter') go(); };
  }

  // ---------- УЛИКИ ----------
  let EVTAB = 'all';
  function vEvidence(el) {
    const cats = [...new Set(S.ev.map(evCat))].sort((a, b) => (PCAT.indexOf(a) + 1 || 99) - (PCAT.indexOf(b) + 1 || 99));
    if (EVTAB !== 'all' && EVTAB !== 'lab' && !cats.includes(EVTAB)) EVTAB = 'all';
    const labIds = S.ev.filter(id => C.evidence[id].lab);
    const nw = ids => ids.filter(id => S.evNew[id]).length;
    const tabs = [['all', 'Все', S.ev]].concat(labIds.length ? [['lab', '🧪 Экспертиза', labIds]] : []).concat(cats.map(c => [c, c, S.ev.filter(id => evCat(id) === c)]));
    const list = (EVTAB === 'all' ? S.ev : EVTAB === 'lab' ? labIds : S.ev.filter(id => evCat(id) === EVTAB)).slice().reverse();
    el.innerHTML = `<div class="fade"><h2 class="h2">Улики и экспертиза</h2><p class="hint">Всего улик: ${S.ev.length}. Вещдоки можно отправить на экспертизу Вере Соколовой.</p>
      <div class="ptabs" style="margin-bottom:14px">${tabs.map(([k, l, ids]) => `<button class="ptab ${EVTAB === k ? 'on' : ''}" data-et="${esc(k)}">${esc(l)} <i>${ids.length}</i>${nw(ids) ? '<span class="newdot"></span>' : ''}</button>`).join('')}</div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${list.map(evCard).join('') || '<div class="card">Пусто.</div>'}</div></div>`;
    el.querySelectorAll('[data-et]').forEach(b => b.onclick = () => { EVTAB = b.dataset.et; vEvidence(el); });
    el.querySelectorAll('.ev').forEach(d => d.onclick = () => openEvidence(d.dataset.e));
  }
  function evCard(id) {
    const e = C.evidence[id];
    let lab = '';
    if (e.lab) lab = S.labs[id] ? (S.labs[id].done ? '<span class="tag green">экспертиза готова</span>' : '<span class="tag blue">на экспертизе</span>') : '<span class="tag gold">можно на экспертизу</span>';
    return `<div class="ev" data-e="${id}"><div class="i">${e.icon}</div><div><b>${esc(e.name)}${S.evNew[id] ? '<span class="newdot"></span>' : ''}</b><small>${esc(e.desc)}</small>${lab}</div></div>`;
  }
  function openEvidence(id) {
    delete S.evNew[id]; updateBadges();
    const e = C.evidence[id];
    let lab = '';
    if (e.lab) {
      const L = S.labs[id];
      if (!L) lab = req(e.lab.req) ? `<button class="btn gold" id="lab">🧪 Отправить на экспертизу</button>` : `<div class="labbox">Для экспертизы не хватает материала для сравнения.</div>`;
      else if (!L.done) lab = `<div class="labbox"><span class="spin"></span> На экспертизе. Вера пришлёт результат.</div>`;
      else lab = `<div class="labbox done"><b>🧪 Заключение эксперта:</b><br>${esc(e.lab.text)}</div>`;
    }
    popup(`<div style="display:flex;gap:16px;align-items:flex-start"><div style="font-size:54px">${e.icon}</div><div><div class="tag">${esc(e.cat)}</div><h2>${esc(e.name)}</h2><p style="line-height:1.6;font-size:15.5px">${esc(e.desc)}</p></div></div>${lab}`, m => {
      const b = m.querySelector('#lab');
      if (b) b.onclick = () => { S.labs[id] = { done: false }; setFlag('lab_any'); S.queue.push({ due: S.play + spd(e.lab.time), type: 'lab', id }); persist(); snd('click'); toast('🧪 Отправлено на экспертизу'); closeOv(); renderPending(); if (S.view === 'evidence') renderView(); };
    });
  }

  // ---------- ТЕЛЕФОНЫ ----------
  let PH = { id: null, tab: 'msgs', chat: null, pin: '' };
  function vPhones(el) {
    const list = Object.keys(C.phones).filter(k => req(C.phones[k].req));
    if (!list.length) { el.innerHTML = `<div class="fade"><h2 class="h2">Телефоны</h2><p class="hint">Изъятых телефонов пока нет.</p></div>`; return; }
    if (!PH.id || !list.includes(PH.id)) PH = { id: list[0], tab: 'msgs', chat: null, pin: '' };
    S['seen_ph_' + PH.id] = 1;
    const ph = C.phones[PH.id];
    const open = has(ph.openFlag);
    const T = S.tech[PH.id];
    el.innerHTML = `<div class="fade"><h2 class="h2">Изъятые телефоны</h2><div style="display:flex;gap:8px;margin:8px 0 18px">${list.map(k => `<button class="btn sm ${k === PH.id ? 'gold' : ''}" data-ph="${k}">${esc(C.phones[k].title)}</button>`).join('')}</div>
      <div class="phonewrap"><div class="phone"><div class="notch"></div><div class="stat"><span>${clock()}</span><span>📶 🔋</span></div><div class="scr" id="scr"></div>
      ${open ? `<div class="tabs">${[['msgs', '💬', 'Чаты'], ['calls', '📞', 'Звонки'], ['contacts', '👤', 'Контакты'], ['notes', '📝', 'Заметки'], ['photos', '🖼️', 'Фото'], ['memos', '🎙️', 'Диктофон']].map(([k, i, n]) => `<button data-tab="${k}" class="${PH.tab === k ? 'on' : ''}"><span>${i}</span>${n}</button>`).join('')}</div>` : ''}</div>
      <div class="side-info"><div class="card"><b>${esc(ph.title)}</b><p class="hint" style="margin:6px 0 10px">Владелец: ${esc(C.people[ph.owner].name)}</p>
      ${open ? '<p style="font-size:14px;line-height:1.6">Изучите переписки, звонки и заметки. Наведите на сообщение и нажмите <b>📌</b>, чтобы добавить его в улики. Тогда его можно будет предъявить на допросе.</p>' :
        (T ? `<div class="labbox">${T.done ? 'Готово.' : '<span class="spin"></span> Техотдел работает над разблокировкой…'}</div>` :
          `<p style="font-size:14px;line-height:1.6">${ph.techOnly ? 'Телефон зашифрован. Нужен техотдел.' : esc(ph.pinHint || 'Введите PIN или отправьте в техотдел.')}</p><button class="btn" id="tech">🛠️ Отправить в техотдел (~${ph.tech} с)</button>`)}
      </div></div></div></div>`;
    el.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => { PH = { id: b.dataset.ph, tab: 'msgs', chat: null, pin: '' }; renderView(); });
    el.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { PH.tab = b.dataset.tab; PH.chat = null; renderView(); });
    const tb = $('#tech'); if (tb) tb.onclick = () => { S.tech[PH.id] = { done: false }; S.queue.push({ due: S.play + spd(ph.tech), type: 'tech', id: PH.id }); persist(); toast('🛠️ Телефон передан в техотдел'); renderView(); renderPending(); };
    drawPhone(ph, open);
  }
  function drawPhone(ph, open) {
    const scr = $('#scr');
    const bg = `background:linear-gradient(170deg,${ph.wall[0]},${ph.wall[1]})`;
    if (!open) {
      if (ph.techOnly || S.tech[PH.id]) { scr.innerHTML = `<div class="plock" style="${bg}"><div class="time">${clock()}</div><div style="margin-top:30px;font-size:40px">🔒</div><div style="margin-top:10px;opacity:.8">Зашифровано</div></div>`; return; }
      scr.innerHTML = `<div class="plock" id="lock" style="${bg}"><div class="time">${clock()}</div><div style="opacity:.8">Введите код-пароль</div><div class="dots">${[0, 1, 2, 3].map(i => `<i class="${i < PH.pin.length ? 'f' : ''}"></i>`).join('')}</div>
        <div class="pad">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => k ? `<button data-k="${k}">${k}</button>` : '<span></span>').join('')}</div></div>`;
      scr.querySelectorAll('[data-k]').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        if (k === '⌫') PH.pin = PH.pin.slice(0, -1); else if (PH.pin.length < 4) PH.pin += k;
        if (PH.pin.length === 4) {
          if (PH.pin === ph.pin) { setFlag(ph.openFlag); journal(`Разблокирован ${ph.title} (PIN ${ph.pin})`); snd('win'); toast('🔓 Телефон разблокирован!', 'ev'); PH.pin = ''; renderView(); return; }
          snd('err'); PH.pin = ''; drawPhone(ph, false); $('#lock').classList.add('shake'); return;
        }
        drawPhone(ph, false);
      });
      return;
    }
    const pinBtn = ev => ev ? `<button class="pin ${S.ev.includes(ev) ? 'got' : ''}" data-pin="${ev}" title="В улики">${S.ev.includes(ev) ? '✓' : '📌'}</button>` : '';
    if (PH.tab === 'msgs') {
      if (PH.chat == null) {
        scr.innerHTML = `<div style="padding:10px 16px 6px;font-size:26px;font-weight:700;color:#fff">Чаты</div><div class="plist">${ph.chats.map((c, i) => { const last = c.msgs[c.msgs.length - 1]; return `<div class="row" data-c="${i}"><div class="av">${esc(c.with[0])}</div><div><b>${esc(c.with)}</b>${c.restored ? ' <span class="tag red">восст.</span>' : ''}<small>${esc(last[2])}</small></div><div class="r">${esc(last[0].split(' ')[0])}</div></div>`; }).join('')}</div>`;
        scr.querySelectorAll('[data-c]').forEach(r => r.onclick = () => { PH.chat = +r.dataset.c; drawPhone(ph, true); });
      } else {
        const c = ph.chats[PH.chat];
        scr.innerHTML = `<div class="chathead"><button class="btn sm" id="cb" style="padding:2px 9px">‹</button><div class="av" style="width:32px;height:32px;border-radius:50%;background:#3a4a6a;display:flex;align-items:center;justify-content:center">${esc(c.with[0])}</div><b>${esc(c.with)}</b></div>
          ${c.restored ? '<div class="restored">⚠ Переписка была удалена владельцем. Восстановлено техотделом.</div>' : ''}
          <div class="bubbles">${c.msgs.map(m => `<div class="bub ${m[1]} ${c.restored ? 'del' : ''}">${esc(m[2])}<span class="tm">${esc(m[0])}</span>${pinBtn(m[3])}</div>`).join('')}</div>`;
        $('#cb').onclick = () => { PH.chat = null; drawPhone(ph, true); };
        scr.scrollTop = scr.scrollHeight;
      }
    } else if (PH.tab === 'calls') {
      scr.innerHTML = `<div style="padding:10px 16px 6px;font-size:26px;font-weight:700;color:#fff">Недавние</div><div class="plist">${ph.calls.map(c => `<div class="row callrow" style="position:relative"><span class="ic">${c.dir === 'out' ? '↗️' : '↙️'}</span><div><b style="${c.dur === 'не ответила' ? 'color:#ff6a6a' : ''}">${esc(c.who)}</b><small>${c.dir === 'out' ? 'Исходящий' : 'Входящий'} · ${esc(c.dur)}</small></div><div class="r">${esc(c.t)}</div>${c.ev ? `<button class="btn sm" data-pin="${c.ev}" style="margin-left:8px">${S.ev.includes(c.ev) ? '✓' : '📌'}</button>` : ''}</div>`).join('')}</div>`;
    } else if (PH.tab === 'contacts') {
      scr.innerHTML = `<div style="padding:10px 16px 6px;font-size:26px;font-weight:700;color:#fff">Контакты</div><div class="plist">${ph.contacts.map(c => `<div class="row"><div class="av">${esc(c[0][0])}</div><div><b>${esc(c[0])}</b><small>${esc(c[1])}</small></div></div>`).join('')}</div><p style="color:#777;font-size:12px;padding:12px 16px">Номер можно найти в «Базе данных».</p>`;
    } else if (PH.tab === 'notes') {
      scr.innerHTML = `<div style="padding:10px 16px 6px;font-size:26px;font-weight:700;color:#fff">Заметки</div>${ph.notes.length ? ph.notes.map(n => `<div class="note" style="position:relative"><b>${esc(n.title)}</b><br><small style="color:#888">${esc(n.t)}</small><br><br>${esc(n.text)}${n.ev ? `<div style="margin-top:10px"><button class="btn sm" data-pin="${n.ev}">${S.ev.includes(n.ev) ? '✓ В уликах' : '📌 В улики'}</button></div>` : ''}</div>`).join('') : '<p style="color:#777;padding:16px">Нет заметок</p>'}`;
    } else if (PH.tab === 'photos') {
      scr.innerHTML = `<div style="padding:10px 16px 6px;font-size:26px;font-weight:700;color:#fff">Фото</div><div class="photos">${ph.photos.map((f, i) => `<div data-f="${i}">${P.photo(f.art)}</div>`).join('')}</div>`;
      scr.querySelectorAll('[data-f]').forEach(d => d.onclick = () => { const f = ph.photos[+d.dataset.f]; popup(`<div style="border-radius:10px;overflow:hidden">${P.photo(f.art)}</div><p style="margin-top:12px"><b>${esc(f.cap)}</b><br><span class="hint">${esc(f.t)}</span></p>`); });
    } else if (PH.tab === 'memos') {
      scr.innerHTML = `<div style="padding:10px 16px 6px;font-size:26px;font-weight:700;color:#fff">Диктофон</div>${ph.memos.length ? ph.memos.map(m => `<div class="memo"><b>🎙️ Запись ${esc(m.t)}</b> · ${esc(m.dur)}<div class="wave">${Array.from({ length: 40 }, (_, i) => `<i style="height:${6 + Math.abs(Math.sin(i * 1.7)) * 26}px"></i>`).join('')}</div>${esc(m.text)}${m.ev ? `<div style="margin-top:10px"><button class="btn sm" data-pin="${m.ev}">${S.ev.includes(m.ev) ? '✓ В уликах' : '📌 В улики'}</button></div>` : ''}</div>`).join('') : '<p style="color:#777;padding:16px">Нет записей</p>'}`;
    }
    scr.querySelectorAll('[data-pin]').forEach(b => b.onclick = e => { e.stopPropagation(); if (give(b.dataset.pin)) drawPhone(ph, true); });
  }

  // ---------- ФИНАНСЫ ----------
  let BK = null;
  function vBank(el) {
    const keys = Object.keys(C.bank).filter(k => has('k_' + C.bank[k].owner));
    el.innerHTML = `<div class="fade"><h2 class="h2">Финансовые запросы</h2><p class="hint">Запросите выписку по счёту, чтобы отследить переводы. Нажмите «Установить владельца», чтобы узнать, кому принадлежит неизвестный счёт.</p>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr));margin-bottom:20px">${keys.map(k => { const b = C.bank[k], R = S.bankReq[k]; return `<div class="card click" data-b="${k}" style="${BK === k ? 'border-color:var(--gold)' : ''}"><b>${esc(C.people[b.owner].name)}</b><div class="hint" style="margin:4px 0 8px">${esc(b.acc)}</div>${R ? (R.done ? `<span class="tag green">выписка получена</span>${!R.seen ? '<span class="newdot"></span>' : ''}` : '<span class="tag blue">запрос в банке…</span>') : '<span class="tag gold">запросить</span>'}</div>`; }).join('')}</div><div id="stm"></div></div>`;
    el.querySelectorAll('[data-b]').forEach(d => d.onclick = () => {
      const k = d.dataset.b, b = C.bank[k];
      if (!S.bankReq[k]) {
        if (!req(b.req)) { snd('err'); popup(`<h2>🏦 Банк отказал</h2><p>Нет оснований для запроса. ${esc(b.why || '')}</p>`); return; }
        S.bankReq[k] = { done: false }; S.queue.push({ due: S.play + spd(b.delay), type: 'bank', id: k }); persist(); toast('🏦 Запрос отправлен в банк'); renderPending(); vBank(el); return;
      }
      BK = k; vBank(el);
    });
    if (BK && S.bankReq[BK] && S.bankReq[BK].done) {
      S.bankReq[BK].seen = true;
      const b = C.bank[BK];
      $('#stm').innerHTML = `<div class="card bank"><div class="bankhead"><div class="logo2">🏦</div><div><b style="font-size:17px">Выписка: ${esc(C.people[b.owner].name)}</b><div style="color:#a8d8c0;font-size:13px">${esc(b.acc)} · период 01.09–18.11</div></div></div>
        <table><tr><th>Дата и время</th><th>Описание</th><th style="text-align:right">Сумма</th><th></th></tr>${b.tx.map(t => `<tr class="${t[3] && S.ev.includes(t[3]) ? 'hl' : ''}"><td style="white-space:nowrap;color:var(--mut)">${esc(t[0])}</td><td>${esc(t[2])}${t[4] ? (has('k_' + t[4]) ? ` <span class="tag blue">👤 ${esc(C.people[t[4]].name)}</span>` : ` <button class="btn sm" data-own="${t[4]}">👤 Установить владельца</button>`) : ''}</td><td class="${t[1] > 0 ? 'plus' : 'minus'}">${t[1] > 0 ? '+' : '−'}${Math.abs(t[1]).toLocaleString('ru-RU')} ₽</td><td style="width:44px">${t[3] ? `<button class="btn sm" data-pin="${t[3]}">${S.ev.includes(t[3]) ? '✓' : '📌'}</button>` : ''}</td></tr>`).join('')}</table></div>`;
      $('#stm').querySelectorAll('[data-pin]').forEach(x => x.onclick = () => { give(x.dataset.pin); vBank(el); });
      $('#stm').querySelectorAll('[data-own]').forEach(x => x.onclick = () => { const pid = x.dataset.own; setFlag('k_' + pid); journal(`Установлен владелец счёта: ${C.people[pid].name}`); vBank(el); });
    }
    updateBadges();
  }

  // ---------- ЗАПРОСЫ (оператор связи, такси, камеры, транспорт) ----------
  let RK = null;
  function recVisible(r) { return r.show ? req(r.show) : r.owner ? has('k_' + r.owner) : true; }
  function vRec(el) {
    S.recReq = S.recReq || {};
    const keys = Object.keys(C.records || {}).filter(k => recVisible(C.records[k]));
    el.innerHTML = `<div class="fade"><h2 class="h2">Запросы и ориентировки</h2><p class="hint">Операторы связи, службы такси, дорожные камеры, транспортные карты. Каждый запрос нужно обосновать — без оснований откажут.</p>
      ${keys.length ? '' : '<div class="card">Пока запрашивать нечего. Новые возможности появятся по ходу расследования.</div>'}
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(250px,1fr));margin-bottom:20px">${keys.map(k => { const r = C.records[k], R = S.recReq[k]; return `<div class="card click" data-r="${k}" style="${RK === k ? 'border-color:var(--gold)' : ''}"><b>${r.icon || '📡'} ${esc(r.title)}</b><div class="hint" style="margin:4px 0 8px">${esc(r.sub || '')}</div>${R ? (R.done ? `<span class="tag green">ответ получен</span>${!R.seen ? '<span class="newdot"></span>' : ''}` : '<span class="tag blue">запрос отправлен…</span>') : '<span class="tag gold">запросить</span>'}</div>`; }).join('')}</div><div id="rcv"></div></div>`;
    el.querySelectorAll('[data-r]').forEach(d => d.onclick = () => {
      const k = d.dataset.r, r = C.records[k];
      if (!S.recReq[k]) {
        if (!req(r.req)) { snd('err'); popup(`<h2>${r.icon || '📡'} Отказ</h2><p>${esc(r.why || 'Нет оснований для запроса.')}</p>`); return; }
        S.recReq[k] = { done: false }; S.queue.push({ due: S.play + spd(r.delay || 20), type: 'rec', id: k }); persist(); toast('📡 Запрос отправлен'); renderPending(); vRec(el); return;
      }
      RK = k; vRec(el);
    });
    if (RK && S.recReq[RK] && S.recReq[RK].done) {
      S.recReq[RK].seen = true;
      const r = C.records[RK];
      $('#rcv').innerHTML = `<div class="card bank"><div class="bankhead"><div class="logo2">${r.icon || '📡'}</div><div><b style="font-size:17px">${esc(r.title)}</b><div style="color:#a8d8c0;font-size:13px">${esc(r.head || '')}</div></div></div>
        <table><tr><th>Время</th><th>${esc(r.col || 'Запись')}</th><th></th></tr>${r.rows.map(t => `<tr class="${t[2] && S.ev.includes(t[2]) ? 'hl' : ''}"><td style="white-space:nowrap;color:var(--mut)">${esc(t[0])}</td><td>${esc(t[1])}${t[3] ? (has('k_' + t[3]) ? ` <span class="tag blue">👤 ${esc(C.people[t[3]].name)}</span>` : ` <button class="btn sm" data-own="${t[3]}">🔎 ${esc(r.ownLabel || 'Установить владельца')}</button>`) : ''}</td><td>${t[2] ? `<button class="pin ${S.ev.includes(t[2]) ? 'got' : ''}" data-pin="${t[2]}" title="В улики">${S.ev.includes(t[2]) ? '✓' : '📌'}</button>` : ''}</td></tr>`).join('')}</table>${r.note ? `<p class="hint" style="margin-top:10px">${esc(r.note)}</p>` : ''}</div>`;
      $('#rcv').querySelectorAll('[data-pin]').forEach(x => x.onclick = () => { give(x.dataset.pin); vRec(el); });
      $('#rcv').querySelectorAll('[data-own]').forEach(x => x.onclick = () => { const pid = x.dataset.own; setFlag('k_' + pid); journal(`Установлен владелец: ${C.people[pid].name}`); vRec(el); });
    }
    updateBadges();
  }

  // ---------- ПРОСЛУШКА ----------
  function vWire(el) {
    const keys = Object.keys(C.wiretaps).filter(k => has('k_' + C.wiretaps[k].target));
    el.innerHTML = `<div class="fade"><h2 class="h2">Прослушивание телефонов</h2><p class="hint">Нужна санкция суда. Без серьёзных оснований её не дадут.</p>
      ${keys.length ? '' : '<div class="card">Пока некого ставить на прослушку.</div>'}
      ${keys.map(k => { const w = C.wiretaps[k], st = S.wire[k]; return `<div class="card" style="margin-bottom:14px"><div style="display:flex;align-items:center;gap:14px"><div style="width:56px;height:68px;border-radius:8px;overflow:hidden">${pt(w.target)}</div><div style="flex:1"><b>${esc(C.people[w.target].name)}</b><div class="hint" style="margin:2px 0">${esc(C.people[w.target].db.phone)}</div></div>
        ${st ? (st.done ? '<span class="tag green">записи получены</span>' : '<span class="tag blue"><span class="spin"></span> идёт прослушка…</span>') : `<button class="btn gold" data-w="${k}">⚖️ Запросить санкцию</button>`}</div>
        ${st && st.done ? w.calls.map(c => `<div class="tape" style="margin-top:14px"><b>📼 ${esc(c.t)} · ${esc(c.a)} → ${esc(c.b)}</b> · ${esc(c.dur)}<div class="wave">${Array.from({ length: 60 }, (_, i) => `<i style="height:${5 + Math.abs(Math.sin(i * 0.9) * Math.cos(i * 0.37)) * 30}px"></i>`).join('')}</div>
          <div class="tr">${c.lines.map(([w2, t]) => w2 === '*' ? `<div class="n">${esc(t)}</div>` : `<div><b>${esc(w2)}:</b> ${esc(t)}</div>`).join('')}</div>
          <div style="margin-top:10px"><button class="btn sm" data-pin="${c.ev}">${S.ev.includes(c.ev) ? '✓ В уликах' : '📌 Добавить запись в улики'}</button></div></div>`).join('') : ''}</div>`; }).join('')}</div>`;
    keys.forEach(k => { if (S.wire[k] && S.wire[k].done) S.wire[k].seen = true; });
    el.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
      const w = C.wiretaps[b.dataset.w];
      if (!req(w.req)) { snd('err'); popup(`<h2>⚖️ Суд отказал</h2><p>${esc(w.why)}</p>`); return; }
      S.wire[b.dataset.w] = { done: false }; S.queue.push({ due: S.play + spd(w.delay), type: 'wire', id: b.dataset.w }); persist(); toast('⚖️ Санкция получена, номер на прослушке'); vWire(el); renderPending();
    });
    el.querySelectorAll('[data-pin]').forEach(x => x.onclick = () => { give(x.dataset.pin); vWire(el); });
    updateBadges();
  }

  // ---------- ЖУРНАЛ ----------
  function vJournal(el) {
    el.innerHTML = `<div class="fade two" style="display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:22px;align-items:start">
      <div class="card"><b>📓 Журнал расследования</b><div style="margin-top:8px">${S.journal.slice().reverse().map(j => `<div class="jr"><span class="t">${esc(j.t)}</span><span>${esc(j.text)}</span></div>`).join('')}</div></div>
      <div class="card"><b>✏️ Мои заметки</b><p class="hint" style="margin:6px 0 10px">Пишите версии и догадки. Сохраняется автоматически.</p><textarea class="notes" id="nt" placeholder="Например: у кого был код сейфа?..">${esc(S.notes)}</textarea></div></div>`;
    $('#nt').oninput = e => { S.notes = e.target.value; persist(); };
  }

  // ---------- РАЗГОВОР ----------
  let TK = null;
  function openTalk(pid) {
    const p = C.people[pid], T = C.talk[pid];
    if (!T) return;
    setFlag('k_' + pid);
    TK = pid;
    const ov = overlay(`<div class="talk"><div class="who"><div class="ph">${pt(pid)}</div><h3>${esc(p.name)}</h3><div style="color:var(--mut);font-size:14px">${esc(p.role)}</div><div>${statusTags(pid)}</div><div style="flex:1"></div>
      <button class="btn gold" id="pres">📂 Предъявить улику</button><button class="btn" id="bye">Завершить разговор</button></div>
      <div class="r"><div class="log" id="log"></div><div class="topics" id="tops"></div></div></div>`);
    const log = $('#log');
    if (!S.tlog[pid]) {
      S.tlog[pid] = [];
      const intro = (T.detainFlag && has(T.detainFlag) && T.introDetained) ? T.introDetained : T.intro;
      addLines(pid, intro, false);
    } else if (T.detainFlag && has(T.detainFlag) && T.introDetained && !S['intro2_' + pid]) {
      S['intro2_' + pid] = 1; addLines(pid, T.introDetained, false);
    }
    S.tlog[pid].forEach(([c, t]) => log.appendChild(lineEl(c, t, pid)));
    log.scrollTop = log.scrollHeight;
    drawTopics(pid);
    $('#bye').onclick = () => { closeOv(); TK = null; persist(); if (S.view === 'people' || S.view === 'case' || S.view === 'map') renderView(); updateBadges(); };
    $('#pres').onclick = () => pickEvidence(pid);
  }
  function lineEl(c, t, pid) {
    const d = document.createElement('div');
    d.className = 'ln ' + c;
    d.innerHTML = c === 'p' ? `<b style="color:var(--gold);font-size:12.5px;display:block">${esc(C.people[pid].name.split(' ')[0])}</b>${esc(t)}` : esc(t);
    return d;
  }
  function parseLine(s) {
    if (s.startsWith('> ')) return ['me', s.slice(2)];
    if (s.startsWith('* ')) return ['n', s.slice(2)];
    return ['p', s];
  }
  function addLines(pid, lines, animate) {
    const log = $('#log');
    const parsed = lines.map(parseLine);
    parsed.forEach(l => S.tlog[pid].push(l));
    if (!log) return;
    if (!animate) return;
    let i = 0;
    const lock = $('#tops'); if (lock) lock.style.pointerEvents = 'none';
    (function next() {
      if (i >= parsed.length) { if (lock) lock.style.pointerEvents = ''; drawTopics(pid); return; }
      log.appendChild(lineEl(parsed[i][0], parsed[i][1], pid)); log.scrollTop = log.scrollHeight;
      const sp = parsed[i][0] === 'p' ? say(pid, parsed[i][1]) : parsed[i][0] === 'me' ? say('me', parsed[i][1]) : 0;
      i++; setTimeout(next, sp ? Math.max(520, sp) : parsed[i - 1][0] === 'me' ? 250 : 520);
    })();
  }
  function drawTopics(pid) {
    const T = C.talk[pid], el = $('#tops'); if (!el) return;
    const tops = T.topics.filter(t => req(t.req));
    el.innerHTML = tops.map(t => `<button class="topic ${has('t_' + pid + '_' + t.id) ? 'done' : 'new'}" data-t="${t.id}">${has('t_' + pid + '_' + t.id) ? '✓ ' : '❓ '}${esc(t.q)}</button>`).join('') || '<span class="hint">Больше вопросов нет. Попробуйте предъявить улику.</span>';
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const t = T.topics.find(x => x.id === b.dataset.t);
      const first = !has('t_' + pid + '_' + t.id);
      snd('click');
      addLines(pid, ['> ' + t.q].concat(t.lines), true);
      if (first) {
        setFlag('t_' + pid + '_' + t.id);
        setFlags(t.set); (t.give || []).forEach(g => give(g));
        if (t.note) journal(t.note);
      }
      persist();
    });
  }
  // ---------- выбор улик: вкладки по типам, без прыжков страницы ----------
  let PTAB = 'all';
  const PCAT = ['Документы', 'Вещдоки', 'Наблюдения', 'Показания', 'Телефоны', 'Финансы', 'Запросы', 'Прослушка'];
  const evCat = id => C.evidence[id].cat || 'Прочее';
  function pickerHTML(picks) {
    const cats = [...new Set(S.ev.map(evCat))].sort((a, b) => (PCAT.indexOf(a) + 1 || 99) - (PCAT.indexOf(b) + 1 || 99));
    if (PTAB !== 'all' && !cats.includes(PTAB)) PTAB = 'all';
    const tabs = [['all', 'Все', S.ev.length]].concat(cats.map(c => [c, c, S.ev.filter(id => evCat(id) === c).length]));
    const list = S.ev.filter(id => PTAB === 'all' || evCat(id) === PTAB).slice().reverse();
    return `<div class="ptabs">${tabs.map(([k, l, n]) => `<button class="ptab ${PTAB === k ? 'on' : ''}" data-pt="${esc(k)}">${esc(l)} <i>${n}</i></button>`).join('')}</div>
      <div class="picker">${list.map(id => `<div class="ev ${picks.includes(id) ? 'sel' : ''}" data-e="${id}"><div class="i">${C.evidence[id].icon}</div><div><b>${esc(C.evidence[id].name)}</b><small>${esc(C.evidence[id].desc)}</small></div></div>`).join('')}</div>`;
  }
  function bindPicker(m, picks, max, onPick) {
    const wrap = m.querySelector('.pickwrap');
    wrap.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { PTAB = b.dataset.pt; wrap.innerHTML = pickerHTML(picks); bindPicker(m, picks, max, onPick); });
    wrap.querySelectorAll('.picker [data-e]').forEach(d => d.onclick = () => {
      const id = d.dataset.e;
      if (!max) { onPick(id); return; }
      const i = picks.indexOf(id);
      if (i >= 0) { picks.splice(i, 1); d.classList.remove('sel'); }
      else if (picks.length < max) { picks.push(id); d.classList.add('sel'); }
      else { toast(`Можно выбрать не больше ${max}`, 'err'); return; }
      const c = m.querySelector('#pcnt'); if (c) c.textContent = `Выбрано: ${picks.length}/${max}`;
    });
  }
  function pickEvidence(pid) {
    const box = document.createElement('div'); box.className = 'ov'; box.style.zIndex = 60;
    box.innerHTML = `<div class="modal" style="width:min(900px,94vw)"><h2>Что предъявить?</h2><p class="hint">Выберите улику. Ищите противоречия в показаниях.</p><div class="pickwrap">${pickerHTML([])}</div><div class="row"><button class="btn" id="cx">Отмена</button></div></div>`;
    document.body.appendChild(box);
    box.querySelector('#cx').onclick = () => box.remove();
    bindPicker(box, [], 0, id => { box.remove(); present(pid, id); });
  }
  const GENERIC = ['Не понимаю, к чему вы это.', 'И что это должно значить?', 'Мне нечего об этом сказать.', 'Впервые вижу. Это как-то связано со мной?', '* Человек пожимает плечами.'];
  function present(pid, evId) {
    const T = C.talk[pid];
    const e = C.evidence[evId];
    let resp = null;
    (T.presentFlags || []).forEach(pf => { if (!resp && pf.ev === evId && req(pf.req)) resp = pf; });
    if (!resp && T.present && T.present[evId]) {
      const r = T.present[evId];
      const o = Array.isArray(r) ? { lines: r } : r;
      if (o && req(o.req)) resp = o;
    }
    S.tlog[pid].push(['ev', `📂 Вы предъявляете: ${e.name}`]);
    $('#log').appendChild(lineEl('ev', `📂 Вы предъявляете: ${e.name}`, pid));
    if (!resp) { addLines(pid, [GENERIC[(evId.length + pid.length) % GENERIC.length]], true); persist(); return; }
    const key = pid + ':' + evId;
    const first = !S.presented[key];
    S.presented[key] = 1;
    addLines(pid, resp.lines, true);
    if (resp.lie && !S.lies[key]) {
      S.lies[key] = 1;
      setTimeout(() => { S.tlog[pid].push(['lie', '⚠ ЛОЖЬ РАСКРЫТА']); const l = $('#log'); if (l) { l.appendChild(lineEl('lie', '⚠ ЛОЖЬ РАСКРЫТА', pid)); l.scrollTop = l.scrollHeight; } snd('lie'); }, resp.lines.length * 520 + 200);
    }
    if (first) { setFlags(resp.set); (resp.give || []).forEach(g => give(g)); if (resp.note) journal(resp.note); }
    persist();
  }

  // ---------- МОЙ ТЕЛЕФОН ----------
  let callQueue = [];
  function tryCall() {
    if (!callQueue.length || $('.ov')) return;
    const m = callQueue.shift();
    incomingCall(m);
  }
  function incomingCall(m) {
    snd('ring');
    const p = C.people[m.from];
    const ov = overlay(`<div class="call"><div class="ph ring">${pt(m.from)}</div><h3>${esc(p.name)}</h3><div class="st">Входящий звонок…</div><div id="cl" class="calllog"></div><div id="cb"><button class="cbtn no" id="dec">✕</button><button class="cbtn ok" id="acc">📞</button></div></div>`);
    const accept = () => {
      m.read = true;
      $('.call .ph').classList.remove('ring');
      $('.call .st').textContent = 'Идёт разговор';
      $('#cb').innerHTML = '';
      const cl = $('#cl'); let i = 0;
      (function next() {
        if (i >= m.lines.length) { $('#cb').innerHTML = '<button class="cbtn no" id="end">✕</button>'; $('#end').onclick = () => { closeOv(); updateBadges(); }; return; }
        const [w, t] = m.lines[i];
        const d = document.createElement('div'); d.className = 'ln ' + (w === '>' ? 'me' : 'p'); d.style.maxWidth = '100%'; d.style.fontSize = '14px';
        d.innerHTML = w === '>' ? esc(t) : `<b style="color:var(--gold);font-size:12px;display:block">${esc(w)}</b>${esc(t)}`;
        cl.appendChild(d); cl.scrollTop = cl.scrollHeight; i++;
        const sp = say(w === '>' ? 'me' : m.from, t);
        setTimeout(next, Math.max(900, sp));
      })();
    };
    $('#acc').onclick = accept;
    $('#dec').onclick = () => { closeOv(); toast('Пропущенный звонок. Его можно прослушать в «Моём телефоне».'); updateBadges(); };
  }
  function openInbox() {
    const ov = overlay(`<div class="modal inbox" style="width:min(620px,94vw);padding:0"><div style="padding:18px 22px;border-bottom:1px solid var(--line);display:flex;align-items:center"><h2 style="margin:0">📲 Мой телефон</h2><div style="flex:1"></div><button class="btn sm" id="x">Закрыть</button></div>
      <div>${S.inbox.length ? S.inbox.map((m, i) => `<div class="msg" data-i="${i}"><div class="av">${pt(m.from)}</div><div style="flex:1;min-width:0"><b>${esc(C.people[m.from].name)}</b> ${m.read ? '' : '<span class="newdot"></span>'}<span style="float:right;color:var(--mut);font-size:12px">${m.call ? '📞 ' : ''}${esc(m.time)}</span><div style="color:#c8cfdc;font-size:14px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(m.text || (m.lines && m.lines[0][1]) || '')}</div></div></div>`).join('') : '<p class="hint" style="padding:20px">Сообщений нет.</p>'}</div></div>`);
    $('#x').onclick = () => { closeOv(); updateBadges(); };
    ov.querySelectorAll('[data-i]').forEach(d => d.onclick = () => {
      const m = S.inbox[+d.dataset.i]; m.read = true; persist();
      const body = m.lines ? m.lines.map(([w, t]) => `<div class="ln ${w === '>' ? 'me' : 'p'}" style="max-width:100%;margin:6px 0">${w === '>' ? '' : `<b style="color:var(--gold);font-size:12px;display:block">${esc(w)}</b>`}${esc(t)}</div>`).join('') : `<div class="ln p" style="max-width:100%">${esc(m.text)}</div>`;
      popup(`<h2>${m.call ? '📞 Звонок' : '💬 Сообщение'}: ${esc(C.people[m.from].name)}</h2><div style="color:var(--mut);margin-bottom:10px">${esc(m.time)}</div>${body}`, null, openInbox);
    });
  }
  function callGromov() {
    const t = C.tasks.find(x => req(x.req) && !req(x.done));
    const line = t ? `Что дальше? По-моему, сейчас главное: ${t.text.charAt(0).toLowerCase() + t.text.slice(1)}.` : 'Всё, что нужно, у тебя есть. Предъявляй обвинение.';
    incomingCallOut([['Громов', 'Слушаю.'], ['>', 'Комиссар, нужен совет.'], ['Громов', line], ['Громов', t && t.id === 'detain' ? 'Для задержания мне нужны две вещи по одному человеку: его контакт с потерпевшей стороной перед преступлением и улика, которая ставит его на место. Соврать на допросе может кто угодно — у каждого свои секреты. Проверь, почему человек врёт.' : 'И помни: врать могут не только виновные. Ищи, где слова не сходятся с фактами, и выясняй почему.']]);
  }
  function incomingCallOut(lines) {
    overlay(`<div class="call"><div class="ph">${pt('gromov')}</div><h3>Комиссар Громов</h3><div class="st">Исходящий звонок</div><div id="cl" class="calllog"></div><div id="cb"></div></div>`);
    const cl = $('#cl'); let i = 0;
    (function next() {
      if (i >= lines.length) { $('#cb').innerHTML = '<button class="cbtn no" id="end">✕</button>'; $('#end').onclick = closeOv; return; }
      const [w, t] = lines[i];
      const d = document.createElement('div'); d.className = 'ln ' + (w === '>' ? 'me' : 'p'); d.style.maxWidth = '100%'; d.style.fontSize = '14px';
      d.innerHTML = w === '>' ? esc(t) : `<b style="color:var(--gold);font-size:12px;display:block">${esc(w)}</b>${esc(t)}`;
      cl.appendChild(d); i++;
      const sp = say(w === '>' ? 'me' : 'gromov', t);
      setTimeout(next, Math.max(800, sp));
    })();
  }

  // ---------- ОБВИНЕНИЕ ----------
  function openAccuse() {
    const A = C.accuse;
    const ans = {}; let picks = [];
    let step = 0;
    const ov = overlay('<div class="modal" id="acc" style="width:min(860px,94vw)"></div>');
    const draw = () => {
      const m = $('#acc');
      if (step < A.questions.length) {
        const q = A.questions[step];
        m.innerHTML = `<div class="tag red">ОБВИНИТЕЛЬНОЕ ЗАКЛЮЧЕНИЕ · ${step + 1}/${A.questions.length + 1}</div><h2 style="margin-top:8px">${esc(q.q)}</h2><div class="quiz">${q.opts.map(([k, l]) => `<label><input type="radio" name="q" value="${k}" ${ans[step] === k ? 'checked' : ''}>${esc(l)}</label>`).join('')}</div>
          <div class="row"><button class="btn" id="cx">Отмена</button>${step ? '<button class="btn" id="pv">← Назад</button>' : ''}<button class="btn gold" id="nx">Далее →</button></div>`;
        m.querySelector('#nx').onclick = () => { const v = m.querySelector('input:checked'); if (!v) { toast('Выберите ответ', 'err'); return; } ans[step] = v.value; step++; draw(); };
      } else {
        m.innerHTML = `<div class="tag red">ОБВИНИТЕЛЬНОЕ ЗАКЛЮЧЕНИЕ · ${step + 1}/${A.questions.length + 1}</div><h2 style="margin-top:8px">Какие улики вы передадите в суд?</h2><p class="hint">Выберите до 4 самых сильных доказательств. Суд оценит каждую.</p>
          <div class="pickwrap">${pickerHTML(picks)}</div>
          <div class="row"><span class="hint" style="margin-right:auto" id="pcnt">Выбрано: ${picks.length}/4</span><button class="btn" id="pv">← Назад</button><button class="btn red" id="go">⚖️ Передать дело в суд</button></div>`;
        bindPicker(m, picks, 4);
        m.querySelector('#go').onclick = () => { if (!picks.length) { toast('Выберите хотя бы одну улику', 'err'); return; } judge(ans, picks); };
      }
      const cx = m.querySelector('#cx'); if (cx) cx.onclick = closeOv;
      const pv = m.querySelector('#pv'); if (pv) pv.onclick = () => { step--; draw(); };
    };
    draw();
  }
  function judge(ans, picks) {
    const A = C.accuse;
    let score = 0; const lines = [];
    A.questions.forEach((q, i) => { const ok = ans[i] === q.correct; if (ok) score += q.w; lines.push([ok, q.q, q.opts.find(o => o[0] === ans[i])[1]]); });
    const good = picks.filter(p => A.keyEvidence.includes(p));
    score += good.length * 5;
    const bonus = Object.keys(A.bonusFlags).filter(f => has(f));
    const lies = Object.keys(S.lies).length;
    const killerOk = ans[0] === A.questions[0].correct;
    score -= Math.min(20, (S.badDetain || 0) * 5);
    score = Math.max(0, score);
    if (!killerOk) score = Math.min(score, 30);
    score = Math.min(100, score);
    let rank = score >= 95 ? 'Легенда Туманска' : score >= 80 ? 'Старший следователь' : score >= 60 ? 'Следователь' : 'Стажёр';
    const xp0 = profXP();
    S.accused = { score, rank, lines, picks, good: good.length, bonus, lies, killerOk, time: S.play, badDetain: S.badDetain || 0 };
    const r0 = rankOf(xp0), r1 = rankOf(profXP());
    if (r1.xp > r0.xp) setTimeout(() => rankUp(r1), 900);
    if (killerOk) { setFlag('case_closed'); snd('win'); } else snd('err');
    persist();
    closeOv();
    showVerdict();
  }
  function showVerdict() {
    const R = S.accused, A = C.accuse;
    overlay(`<div class="modal" style="width:min(820px,94vw)"><div class="tag ${R.killerOk ? 'green' : 'red'}">${R.killerOk ? 'ВИНОВЕН · ПРИГОВОР ВЫНЕСЕН' : 'ДЕЛО РАЗВАЛИЛОСЬ В СУДЕ'}</div>
      <div class="score">${R.score}<span style="font-size:24px;color:var(--mut)">/100</span></div><h2 style="text-align:center">${esc(R.rank)}</h2>
      <div class="card" style="margin:14px 0">${R.lines.map(([ok, q, a]) => `<div style="padding:5px 0">${ok ? '✅' : '❌'} <b>${esc(q)}</b><br><span style="color:var(--mut)">${esc(a)}</span></div>`).join('')}
        <div style="padding:5px 0">📂 Сильных улик передано в суд: <b>${R.good}/${R.picks.length}</b></div><div style="padding:5px 0">⚠ Раскрыто ложных показаний: <b>${R.lies}</b></div>
        <div style="padding:5px 0">🚔 Отклонённых запросов на задержание: <b>${R.badDetain || 0}</b>${R.badDetain ? ` (−${Math.min(20, R.badDetain * 5)} баллов)` : ''}</div>
        <div style="padding:5px 0">⏱ Время расследования: <b>${Math.floor(R.time / 60)} мин</b></div>
        ${R.bonus.length ? `<div style="margin-top:6px">${R.bonus.map(f => `<span class="tag gold">🏅 ${esc(A.bonusFlags[f])}</span>`).join('')}</div>` : ''}</div>
      ${R.killerOk ? A.epilogue.map(p => `<p style="font-family:Georgia;line-height:1.6;font-size:15.5px">${esc(p)}</p>`).join('') : '<p style="font-family:Georgia;line-height:1.6">Адвокаты разнесли обвинение в пух и прах. Настоящий убийца на свободе. Громов молча забирает папку: «Пересмотри всё ещё раз».</p>'}
      <div class="row">${R.killerOk ? '' : '<button class="btn gold" id="retry">Пересмотреть дело</button>'}<button class="btn" id="cl">Закрыть</button></div></div>`);
    $('#cl').onclick = () => { closeOv(); renderView(); };
    const rt = $('#retry'); if (rt) rt.onclick = () => { S.accused = null; persist(); closeOv(); renderView(); };
  }

  // ---------- оверлеи ----------
  function overlay(html) {
    closeOv();
    const d = document.createElement('div'); d.className = 'ov'; d.innerHTML = html;
    document.body.appendChild(d);
    return d;
  }
  function closeOv() { ttsStop(); document.querySelectorAll('.ov').forEach(o => o.remove()); }
  // ---------- ОЗВУЧКА ----------
  const TTS_WEB = typeof window.speechSynthesis !== 'undefined' && typeof window.SpeechSynthesisUtterance !== 'undefined' && !/; wv\)/.test(navigator.userAgent);
  const TTS_NATIVE = /; wv\)/.test(navigator.userAgent) && /HPTTS/.test(navigator.userAgent);
  const PIPER = window.HPPiper || null;
  const piperOn = () => !!(PIPER && PIPER.status().ready && (!SAVE || !SAVE.settings || SAVE.settings.engine !== 'device'));
  const TTS_OK = () => TTS_NATIVE || TTS_WEB || !!(PIPER && PIPER.status().ready);
  const voiceOn = () => TTS_OK() && (!SAVE || !SAVE.settings || SAVE.settings.voice !== false);
  let RU_VOICES = [];
  function loadVoices() { if (!TTS_WEB) return; RU_VOICES = speechSynthesis.getVoices().filter(v => /^ru/i.test(v.lang)); }
  if (TTS_WEB) { loadVoices(); try { speechSynthesis.onvoiceschanged = loadVoices; } catch (e) { /* ignore */ } }
  function hashStr(t) { let h = 7; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) >>> 0; return h; }
  let NAT_VOICES = null;
  function voiceCatalog() {
    if (TTS_NATIVE) {
      if (SHELL_VER < 2) return [];
      if (!NAT_VOICES) { try { const r = window.prompt('hptts-voices', '') || ''; if (!r) return []; NAT_VOICES = r.split('|').filter(Boolean).map(x => { const [n, q, net] = x.split('~'); return { id: n, q: +q || 0, net: net === 'true' }; }); } catch (e) { NAT_VOICES = []; } }
      return NAT_VOICES.slice().sort((a, b) => (b.net - a.net) || (b.q - a.q)).map((v, i) => ({ id: v.id, label: `Голос ${i + 1}${v.net ? ' · онлайн, высокое качество' : v.q >= 400 ? ' · высокое качество' : ''} (${v.id})`, best: v.net || v.q >= 400 }));
    }
    if (TTS_WEB) { loadVoices(); return RU_VOICES.slice().sort((a, b) => (/natural|online/i.test(b.name) - /natural|online/i.test(a.name))).map(v => ({ id: v.name, label: v.name.replace(/^Microsoft /, '').replace(/ - Russian \(Russia\)/, ''), best: /natural|online/i.test(v.name) })); }
    return [];
  }
  function pickVoice(f) {
    const cat = voiceCatalog(); if (!cat.length) return null;
    const off = navigator.onLine === false;
    const usable = v => !off || !(TTS_NATIVE ? /network/i.test(v.id) : /online|natural/i.test(v.id));
    const saved = SAVE && SAVE.settings && SAVE.settings[f ? 'vFemale' : 'vMale'];
    if (saved && cat.some(v => v.id === saved && usable(v))) return saved;
    if (off) { const loc = cat.filter(usable); if (loc.length) cat.splice(0, cat.length, ...loc.map(v => Object.assign({}, v, { best: true }))); }
    const re = f ? /svetlana|dariya|daria|irina|ekaterina|milena|anna|alena|elena|female|жен/i : /dmitry|pavel|yuri|maxim|male|муж/i;
    const g = cat.filter(v => re.test(v.id) && !(f ? false : /female/i.test(v.id)));
    if (g.length) return (g.find(v => v.best) || g[0]).id;
    const best = cat.filter(v => v.best).length ? cat.filter(v => v.best) : cat;
    return (f ? best[0] : best[Math.min(1, best.length - 1)]).id;
  }
  function piperLine() {
    if (!PIPER) return '';
    const p = PIPER.status();
    if (p.ready) return '✅ Голоса Piper готовы — работают без интернета.';
    if (p.state === 'download') return `⏳ Скачиваются голоса Piper: <b>${Math.floor(p.done * 100)}%</b> (≈${Math.round(PIPER.TOTAL / 1048576)} МБ, один раз). Пока звучат голоса устройства.`;
    if (p.state === 'check' || p.state === 'start' || p.state === 'idle') return '⏳ Запускаются голоса Piper…';
    return '⚠️ Голоса Piper пока недоступны' + (p.error ? ` (${esc(p.error)})` : '') + '. Игра попробует ещё раз сама, а пока звучат голоса устройства.';
  }
  function openVoices() {
    const cat = voiceCatalog();
    if (PIPER && (PIPER.status().ready || !cat.length)) {
      const p = PIPER.status(), V = PIPER.VOICES;
      const sel = f => { const pool = V.filter(v => v.f === f); const cur = piperVoice(f ? 'vera' : 'gromov', f); return `<select class="inp" id="${f ? 'pvf' : 'pvm'}" style="margin:6px 0">${pool.map(v => `<option value="${v.id}" ${cur === v.id ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>`; };
      popup(`<h2>🗣️ Голоса персонажей</h2><p class="hint" style="line-height:1.5">${piperLine()}</p>
        ${p.ready ? `<label style="display:flex;gap:8px;align-items:center;margin:8px 0"><input type="checkbox" id="peng" ${SAVE.settings.engine !== 'device' ? 'checked' : ''}> Использовать голоса Piper</label>
        <b>Громов и мужчины</b>${sel(false)}<button class="btn sm" id="pm">▶ Послушать</button>
        <div style="height:14px"></div><b>Вера и женщины</b>${sel(true)}<button class="btn sm" id="pf">▶ Послушать</button>
        <div style="height:14px"></div><b>Ваш голос (детектив)</b><select class="inp" id="pvme" style="margin:6px 0">${V.map(v => `<option value="${v.id}" ${piperVoice('me', false) === v.id && SAVE.settings.pMe !== 'off' ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}<option value="off" ${SAVE.settings.pMe === 'off' ? 'selected' : ''}>Не озвучивать мои реплики</option></select><button class="btn sm" id="pme">▶ Послушать</button>
        <p class="hint">Остальные персонажи получают свой голос и тембр автоматически.</p><p class="hint" style="font-size:11.5px;opacity:.75">Голоса Piper: Дмитрий, Денис (NabuCasa, CC0), Ирина (RHVoice), Руслан (корпус RUSLAN, CC BY-NC-SA 4.0). Движок: sherpa-onnx, espeak-ng.</p>` : ''}
        ${cat.length ? '<div style="height:10px"></div><button class="btn sm" id="pdev">⚙️ Голоса устройства</button>' : ''}`, m => {
        const q = x => m.querySelector(x);
        const save = () => { if (q('#pvm')) { SAVE.settings.pMale = q('#pvm').value; SAVE.settings.pFemale = q('#pvf').value; } if (q('#pvme')) SAVE.settings.pMe = q('#pvme').value; if (q('#peng')) SAVE.settings.engine = q('#peng').checked ? 'piper' : 'device'; persist(); };
        if (q('#pme')) q('#pme').onclick = () => { save(); ttsStop(); const was = SAVE.settings.voice; SAVE.settings.voice = true; say('me', 'Комиссар, это детектив. Выезжаю на место.'); SAVE.settings.voice = was; };
        ['#pvm', '#pvf', '#pvme', '#peng'].forEach(x => { if (q(x)) q(x).onchange = save; });
        if (q('#pm')) q('#pm').onclick = () => { save(); ttsStop(); sayAs(false, 'Комиссар Громов на связи. Дело серьёзное, работаем.'); };
        if (q('#pf')) q('#pf').onclick = () => { save(); ttsStop(); sayAs(true, 'Здравствуйте. Я Вера Соколова, экспертиза готова.'); };
        if (q('#pdev')) q('#pdev').onclick = () => { save(); closeOv(); openDeviceVoices(); };
      });
      return;
    }
    openDeviceVoices();
  }
  function openDeviceVoices() {
    const cat = voiceCatalog();
    const pl = piperLine();
    if (!cat.length) { popup('<h2>🗣️ Голоса</h2><p>Русских голосов на устройстве не найдено. Нажмите «🎙️ Проверить озвучку» в меню — там подсказка, как их добавить.</p>'); return; }
    const sel = f => `<select class="inp" id="${f ? 'vf' : 'vm'}" style="margin:6px 0">${cat.map(v => `<option value="${esc(v.id)}" ${pickVoice(f) === v.id ? 'selected' : ''}>${v.best ? '⭐ ' : ''}${esc(v.label)}</option>`).join('')}</select>`;
    popup(`<h2>🗣️ Голоса персонажей</h2>${pl ? `<p class="hint" style="line-height:1.5">${pl}</p>` : ''}<p class="hint">⭐ — самые естественные голоса. Выберите и послушайте.</p>
      <b>Мужчины</b>${sel(false)}<button class="btn sm" id="pm">▶ Послушать</button>
      <div style="height:14px"></div><b>Женщины</b>${sel(true)}<button class="btn sm" id="pf">▶ Послушать</button>`, m => {
      const save = () => { SAVE.settings.vMale = m.querySelector('#vm').value; SAVE.settings.vFemale = m.querySelector('#vf').value; persist(); };
      m.querySelector('#vm').onchange = save; m.querySelector('#vf').onchange = save;
      m.querySelector('#pm').onclick = () => { save(); ttsStop(); sayAs(false, 'Комиссар Громов на связи. Дело серьёзное, работаем.', true); };
      m.querySelector('#pf').onclick = () => { save(); ttsStop(); sayAs(true, 'Здравствуйте. Я Вера Соколова, экспертиза готова.', true); };
    });
  }
  function sayAs(f, text, dev) { const was = SAVE.settings.voice; SAVE.settings.voice = true; if (dev) sayDevice(f ? 'vera' : 'gromov', clean(text), f); else say(f ? 'vera' : 'gromov', text, f); SAVE.settings.voice = was; }
  function voiceFor(pid) {
    const P = (C && C.people && C.people[pid]) || {};
    const f = !!P.f, h = hashStr(pid || 'x');
    const nat = voiceCatalog().length > 0;
    const pitch = nat ? 0.94 + (h % 12) / 100 : f ? 1.08 + (h % 20) / 100 : 0.78 + (h % 20) / 100;
    const rate = P.age > 62 ? 0.9 : P.age && P.age < 28 ? 1.1 : 1.0;
    let v = null, vid = pickVoice(f);
    if (TTS_WEB && vid) v = RU_VOICES.find(x => x.name === vid) || null;
    if (!v && RU_VOICES.length) {
      const fem = RU_VOICES.filter(x => /svetlana|dariya|daria|irina|ekaterina|milena|anna|alena|elena|female|жен/i.test(x.name));
      const mal = RU_VOICES.filter(x => /dmitry|pavel|yuri|maxim|male|муж/i.test(x.name) && !/female/i.test(x.name));
      const pool = (f ? fem : mal).length ? (f ? fem : mal) : RU_VOICES;
      const nat = pool.filter(x => /natural|online/i.test(x.name));
      const pp = nat.length ? nat : pool;
      v = pp[h % pp.length];
    }
    return { v, vid, pitch, rate };
  }
  function clean(t) { return String(t).replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').replace(/[«»]/g, '"').trim(); }
  function piperVoice(pid, f) {
    const V = PIPER.VOICES, fem = V.filter(v => v.f), mal = V.filter(v => !v.f);
    const pool = (f ? fem : mal).length ? (f ? fem : mal) : V;
    if (pid === 'me') { const me = SAVE.settings.pMe; if (V.some(v => v.id === me)) return me; return (V.find(v => v.id === 'denis') || V.find(v => !v.f) || V[0]).id; }
    const pick = SAVE.settings[f ? 'pFemale' : 'pMale'];
    if (pid === 'gromov' || pid === 'vera') return pool.some(v => v.id === pick) ? pick : pool[0].id;
    return pool[hashStr(pid || 'x') % pool.length].id;
  }
  function sayPiper(pid, t, fOverride) {
    const P = (C && C.people && C.people[pid]) || {};
    const f = fOverride !== undefined ? fOverride : (pid === 'vera' ? true : pid === 'gromov' ? false : !!P.f), h = hashStr(pid || 'x');
    let pitch = pid === 'gromov' || pid === 'vera' || fOverride !== undefined ? 1 : 0.95 + (h % 11) / 100;
    if (pid === 'me') { const v = piperVoice('me', false); pitch = v === piperVoice('gromov', false) ? 1.07 : 1; return PIPER.speak(t, { voice: v, pitch, speed: 1.04, onFail: () => { if (TTS_NATIVE || TTS_WEB) sayDevice(pid, t); } }); }
    const speed = P.age > 62 ? 0.9 : P.age && P.age < 28 ? 1.08 : 1.0;
    return PIPER.speak(t, { voice: piperVoice(pid, f), pitch, speed, onFail: () => { if (TTS_NATIVE || TTS_WEB) sayDevice(pid, t, fOverride); } });
  }
  function say(pid, text, fOverride) {
    const t = clean(text); if (!t || !voiceOn()) return 0;
    if (pid === 'me' && SAVE.settings.pMe === 'off') return 0;
    if (piperOn() && sayPiper(pid, t, fOverride)) { TTS_LAST = 'piper'; return Math.min(16000, 900 + t.length * 66); }
    if (!TTS_NATIVE && !TTS_WEB) return 0;
    return sayDevice(pid, t, fOverride);
  }
  function sayDevice(pid, t, fOverride) {
    const vf = voiceFor(pid); if (fOverride !== undefined) { vf.vid = pickVoice(fOverride); if (TTS_WEB) vf.v = RU_VOICES.find(x => x.name === vf.vid) || vf.v; }
    try {
      if (TTS_NATIVE) TTS_LAST = window.prompt('hptts:' + vf.pitch.toFixed(2) + (vf.vid && SHELL_VER >= 2 ? ':' + vf.vid : ''), t);
      else {
        if (!RU_VOICES.length) loadVoices();
        const u = new SpeechSynthesisUtterance(t); u.lang = 'ru-RU'; if (vf.v) u.voice = vf.v; u.pitch = vf.pitch; u.rate = vf.rate; u.volume = 1;
        u.onerror = e => { TTS_LAST = 'error:' + (e && e.error); if (vf.v && e && e.error !== 'interrupted' && e.error !== 'canceled') { const u2 = new SpeechSynthesisUtterance(t); u2.lang = 'ru-RU'; TTS_Q.push(u2); speechSynthesis.speak(u2); } };
        u.onstart = () => { TTS_LAST = 'ok'; };
        TTS_Q.push(u); if (TTS_Q.length > 30) TTS_Q.shift();
        try { speechSynthesis.resume(); } catch (e) { /* ignore */ }
        speechSynthesis.speak(u);
      }
    } catch (e) { return 0; }
    return Math.min(14000, 600 + t.length * 62);
  }
  let TTS_LAST = null; const TTS_Q = [];
  function ttsCheck() {
    const was = SAVE.settings.voice; SAVE.settings.voice = true; TTS_LAST = null;
    say('gromov', 'Проверка связи. Детектив, вы меня слышите?');
    SAVE.settings.voice = was;
    setTimeout(() => {
      let t;
      if (TTS_NATIVE) {
        const nv = voiceCatalog();
        t = (nv.length ? `Русских голосов: <b>${nv.length}</b>, лучших: ${nv.filter(v => v.best).length}.<br>` : '') + (TTS_LAST === '0' ? '✅ Синтезатор речи телефона принял фразу. Если голоса не слышно — проверьте громкость мультимедиа.' : TTS_LAST === '-1' ? '⚠️ Синтезатор речи телефона не готов. Откройте Настройки → Специальные возможности (или Язык и ввод) → Синтез речи: выберите «Синтезатор речи Google» и скачайте русский голос.' : '⚠️ Нет ответа от синтезатора речи. Установите последнюю версию HOME_POLICE.apk.');
      } else if (TTS_WEB) {
        loadVoices();
        const all = speechSynthesis.getVoices();
        t = `Русских голосов найдено: <b>${RU_VOICES.length}</b> из ${all.length}.${RU_VOICES.length ? '<br>' + RU_VOICES.slice(0, 6).map(v => esc(v.name)).join('<br>') : '<br>⚠️ В системе нет русского голоса. Windows: Параметры → Время и язык → Речь → «Добавить голоса» → Русский. В браузере Edge русские голоса есть сразу.'}${TTS_LAST && TTS_LAST.startsWith('error') ? '<br>Ошибка: ' + esc(TTS_LAST) : ''}`;
      } else t = '⚠️ На этом устройстве озвучка недоступна. Для Android установите последнюю версию HOME_POLICE.apk.';
      if (PIPER && TTS_LAST === 'piper') t = piperLine() + '<br>Фраза отправлена голосу Piper. Если голоса не слышно — проверьте громкость.';
      else if (PIPER) t = piperLine() + '<br><br>' + (TTS_NATIVE || TTS_WEB ? '<b>Голоса устройства:</b> ' + t : '');
      popup(`<h2>🗣️ Проверка озвучки</h2><p style="line-height:1.6">${t}</p>`);
    }, 1500);
  }
  // плашка загрузки голосов Piper
  if (PIPER) {
    let shown = false;
    const bar = () => { let b = document.getElementById('pipst'); if (!b) { b = document.createElement('div'); b.id = 'pipst'; b.style.cssText = 'position:fixed;left:50%;bottom:calc(10px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:50;background:rgba(11,14,19,.92);border:1px solid rgba(217,166,74,.5);color:#e8dcc4;border-radius:12px;padding:7px 14px;font-size:13px;pointer-events:none;box-shadow:0 4px 18px rgba(0,0,0,.5);white-space:nowrap'; document.body.appendChild(b); } return b; };
    PIPER.onChange(p => {
      if (p.state === 'download') { shown = true; bar().textContent = `🎙️ Скачиваются голоса персонажей: ${Math.floor(p.done * 100)}%`; }
      else if (p.state === 'start' && shown) bar().textContent = '🎙️ Запускаются голоса персонажей…';
      else if (p.ready) { const b = document.getElementById('pipst'); if (b) b.remove(); if (shown) { shown = false; try { toast('🎙️ Новые голоса персонажей готовы!'); } catch (e) { /* ignore */ } } }
      else if (p.state === 'error') { const b = document.getElementById('pipst'); if (b) b.remove(); }
    });
  }
  function ttsStop() { try { if (PIPER) PIPER.stop(); } catch (e) { /* ignore */ } try { if (TTS_NATIVE) window.prompt('hptts-stop', ''); else if (TTS_WEB) speechSynthesis.cancel(); } catch (e) { /* ignore */ } }
  // ---------- РУКОВОДСТВО ----------
  const GUIDE = [
    ['🎯 Цель', [
      'Вы — следователь полиции Туманска. В каждом деле есть преступление и пятеро подозреваемых. Виновен один.',
      'Нужно собрать улики, разоблачить ложь, задержать преступника, добиться признания и передать дело в суд.',
      'Врут не только виновные: у невиновных бывают свои секреты. Главное — понять, <b>почему</b> человек врёт.',
    ]],
    ['🧭 С чего начать', [
      '1. Ответьте на звонок Громова — он расскажет о деле.',
      '2. «🗺️ Выезд» → место происшествия: осмотрите всё, что отмечено 🔎.',
      '3. Найденное отправьте на экспертизу: «🧪 Улики» → выберите улику → «Отправить на экспертизу».',
      '4. Опросите свидетелей на улице, получите и разблокируйте телефон потерпевшего.',
      '5. Допросите подозреваемых: «👥 Люди» → карточка → «Допросить».',
      'Список задач по делу — в разделе «📁 Дело». Справа показан ход расследования.',
    ]],
    ['🗣️ Допросы', [
      'Задавайте вопросы из списка. Новые вопросы появляются по ходу дела.',
      'Самое важное — <b>«📂 Предъявить улику»</b>. Если показания расходятся с уликой, человек будет пойман на лжи.',
      'Чаще всего врут на вопросы «Где вы были?» и «Общались ли вы с потерпевшим?». Проверяйте именно их.',
      'Разоблачённая ложь записывается в журнал, а у человека появляется отметка.',
    ]],
    ['📱 Телефоны', [
      'В телефонах есть чаты, звонки, контакты, заметки, диктофон и фото. Важное закрепляйте кнопкой 📌 — так сообщение станет уликой.',
      'Телефон с PIN-кодом можно открыть самому: подсказка обычно спрятана в доме потерпевшего. Или отдать в техотдел — это дольше.',
      'Телефон задержанного вскрывает только техотдел. Иногда удалённое удаётся восстановить.',
    ]],
    ['🏦 Финансы и 📡 Запросы', [
      '«Финансы»: банковские выписки подозреваемых — где и когда человек платил картой. Неизвестный счёт можно «установить владельца».',
      '«Запросы»: оператор связи (где был телефон, кому принадлежит номер), такси, транспортные карты, дорожные камеры.',
      'Многие запросы дают только с основанием — например, после того как человек сказал, где был.',
      '«🎧 Прослушка» требует санкции суда и серьёзных оснований.',
    ]],
    ['🚔 Задержание', [
      'Задержать можно любого подозреваемого, но Громов подпишет, только если улики докажут две вещи:',
      '<b>1)</b> именно этот человек связывался с потерпевшим незадолго до преступления (переписка, звонок, запись);',
      '<b>2)</b> именно его можно поставить на место преступления (оплата, геолокация, поездка, камера, ложное алиби).',
      'Если не хватает — Громов скажет, какого пункта. Каждый отклонённый запрос снижает итоговую оценку.',
    ]],
    ['⚖️ Признание и суд', [
      'После задержания: образец ДНК, телефон задержанного, обыск. В каждом деле срабатывает свой путь — что-то из этого сломает преступника.',
      'Предъявите найденное на допросе — и задержанный признается.',
      '«📁 Дело» → «Предъявить обвинение»: кто, мотив, как запутывал следствие и до 4 сильнейших улик. Суд выставит оценку до 100.',
    ]],
    ['🎖️ Звания и помощники', [
      'За каждое раскрытое дело — очки (оценка суда + 20). Очки повышают звание.',
      'Лейтенант — напарник выполняет поручения. Старший лейтенант — кинолог. Капитан — срочные экспертизы. Майор — аналитик. Подполковник — право на ошибку. Полковник — опергруппа.',
      'Полный список — кнопка «🎖️ Звания» в главном меню.',
    ]],
    ['💡 Советы', [
      'Записывайте догадки в «📓 Журнал» → «Мои заметки».',
      'Если застряли — «📞 Позвонить Громову»: он подскажет следующий шаг, не называя виновного.',
      'Время экспертиз и запросов идёт, пока вы работаете: пока ждёте — допрашивайте.',
      'Прогресс сохраняется автоматически. Обновления игры загружаются при запуске.',
    ]],
  ];
  function openGuide() {
    let gi = 0;
    popup('<div id="gd"></div>', m => {
      const draw = () => {
        m.querySelector('#gd').innerHTML = `<h2>📖 Как играть</h2><div class="ptabs" style="margin-bottom:12px">${GUIDE.map((g, i) => `<button class="ptab ${i === gi ? 'on' : ''}" data-g="${i}">${g[0]}</button>`).join('')}</div>
          <div class="card">${GUIDE[gi][1].map(t => `<p style="margin:7px 0;line-height:1.55">${t}</p>`).join('')}</div>
          <div class="row" style="justify-content:space-between;margin-top:10px">${gi ? '<button class="btn sm" id="gp">← Назад</button>' : '<span></span>'}${gi < GUIDE.length - 1 ? '<button class="btn sm gold" id="gn">Далее →</button>' : ''}</div>`;
        m.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { gi = +b.dataset.g; draw(); });
        const gp = m.querySelector('#gp'); if (gp) gp.onclick = () => { gi--; draw(); };
        const gn = m.querySelector('#gn'); if (gn) gn.onclick = () => { gi++; draw(); };
      };
      draw();
    });
  }
  // ---------- ЗВАНИЯ ----------
  const RANKS = [
    { xp: 0, n: 'Стажёр', ic: '🔰' },
    { xp: 100, n: 'Лейтенант', ic: '⭐', perk: 'partner', pn: '🧑‍🤝‍🧑 Напарник', pd: 'Выполняет поручения: опрашивает свидетелей, осматривает места, отвозит улики на экспертизу, отправляет запросы.' },
    { xp: 250, n: 'Старший лейтенант', ic: '⭐⭐', perk: 'k9', pn: '🐕 Кинолог', pd: 'Раз в деле собака пройдёт по следу от места преступления и покажет, как ушёл преступник.' },
    { xp: 450, n: 'Капитан', ic: '⭐⭐⭐', perk: 'fast', pn: '⚡ Срочные экспертизы', pd: 'Экспертизы, техотдел, банк, запросы и прослушка работают вдвое быстрее.' },
    { xp: 700, n: 'Майор', ic: '🎖️', perk: 'analyst', pn: '🧠 Аналитик', pd: 'Разбирает материалы дела и показывает, что ещё не проверено.' },
    { xp: 1000, n: 'Подполковник', ic: '🎖️🎖️', perk: 'grace', pn: '🛡️ Право на ошибку', pd: 'Первый отклонённый запрос на задержание в каждом деле не снижает оценку.' },
    { xp: 1400, n: 'Полковник', ic: '🎖️🎖️🎖️', perk: 'squad', pn: '🚓 Опергруппа', pd: 'Напарник с опергруппой выполняет поручения втрое быстрее.' },
    { xp: 2000, n: 'Генерал', ic: '🏅', perk: 'legend', pn: '🏅 Легенда отдела', pd: 'Высшее звание. Громов отдаёт честь первым.' },
  ];
  function profXP() { return CASES.reduce((a, c) => { const s2 = caseSt(c); return a + (s2 && s2.accused && s2.accused.killerOk ? (s2.accused.score || 0) + 20 : 0); }, 0); }
  function rankOf(xp) { let r = RANKS[0]; RANKS.forEach(x => { if (xp >= x.xp) r = x; }); return r; }
  function perk(k) { const xp = profXP(); return RANKS.some(r => r.perk === k && xp >= r.xp); }
  function spd(t) { return Math.max(3, Math.ceil(t * (perk('fast') ? 0.5 : 1))); }
  function ranksHTML() {
    const xp = profXP(), cur = rankOf(xp), nx = RANKS.find(r => r.xp > xp);
    return `<h2>🎖️ Звания и помощники</h2><p class="hint">Очки дают за каждое раскрытое дело: оценка суда + 20. Сейчас: <b>${xp}</b>${nx ? ` · до звания «${esc(nx.n)}» — ${nx.xp - xp}` : ' · высшее звание'}.</p>
      ${nx ? `<div style="height:8px;border-radius:6px;background:rgba(255,255,255,.08);margin:6px 0 14px;overflow:hidden"><div style="height:100%;width:${Math.round((xp - cur.xp) / (nx.xp - cur.xp) * 100)}%;background:var(--gold)"></div></div>` : ''}
      ${RANKS.map(r => `<div class="card" style="margin-bottom:8px;${xp >= r.xp ? '' : 'opacity:.5'};${r === cur ? 'border-color:var(--gold)' : ''}"><b>${r.ic} ${esc(r.n)}</b> <span class="hint">· ${r.xp} оч.</span>${xp >= r.xp ? ' <span class="tag green">получено</span>' : ' <span class="tag">🔒</span>'}${r.pn ? `<div style="margin-top:4px"><b>${r.pn}</b> — <span class="hint">${esc(r.pd)}</span></div>` : ''}</div>`).join('')}`;
  }
  function rankUp(r) {
    const box = document.createElement('div'); box.className = 'ov'; box.style.zIndex = 80;
    box.innerHTML = `<div class="modal" style="width:min(520px,92vw);text-align:center"><div style="font-size:54px">${r.ic}</div><div class="tag gold">ПОВЫШЕНИЕ</div><h2 style="margin-top:8px">Новое звание: ${esc(r.n)}</h2><p>Громов: «Заслуженно. Поздравляю».</p>${r.pn ? `<div class="card" style="margin-top:10px;text-align:left"><b>Открыто: ${r.pn}</b><div class="hint" style="margin-top:4px">${esc(r.pd)}</div></div>` : ''}<div class="row" style="justify-content:center"><button class="btn gold" id="rux">Служу закону!</button></div></div>`;
    document.body.appendChild(box); snd('win');
    box.querySelector('#rux').onclick = () => { box.remove(); if ($('.desk')) renderDesk(); };
  }
  // ---------- напарник ----------
  function partnerJobs() {
    const visited = C.locations.filter(l => req(l.req) && has('v_' + l.id));
    const susp = new Set(Object.values(C.actions || {}).map(a => a.person));
    const ask = [];
    visited.forEach(l => (l.people || []).forEach(pid => { const T = C.talk[pid], P = C.people[pid]; if (!T || susp.has(pid) || P.victim || P.colleague) return; T.topics.forEach(t => { if (req(t.req) && !has('t_' + pid + '_' + t.id) && t.id !== 'confess') ask.push([pid, t]); }); }));
    const spots = []; visited.forEach(l => (l.spots || []).forEach(sp => { if (req(sp.req) && !S.spots[sp.id]) spots.push(sp); }));
    const labs = S.ev.filter(id => C.evidence[id].lab && !S.labs[id] && req(C.evidence[id].lab.req));
    const reqs = [];
    Object.keys(C.bank).forEach(k => { const b = C.bank[k]; if (has('k_' + b.owner) && !S.bankReq[k] && req(b.req)) reqs.push(['bank', k]); });
    Object.keys(C.records || {}).forEach(k => { const r = C.records[k]; if (recVisible(r) && !S.recReq[k] && req(r.req)) reqs.push(['rec', k]); });
    return { ask, spots, labs, reqs };
  }
  function openPartner() {
    const busy = S.queue.find(q => q.type === 'partner');
    const J = partnerJobs();
    const opts = [['ask', '💬 Опросить свидетелей и персонал', `${J.ask.length} вопр.`, J.ask.length], ['spots', '🔍 Доосмотреть посещённые места', `${J.spots.length} мест`, J.spots.length], ['labs', '🧪 Отвезти улики на экспертизу', `${J.labs.length} шт.`, J.labs.length], ['reqs', '📨 Отправить все доступные запросы', `${J.reqs.length} шт.`, J.reqs.length]];
    popup(`<h2>🧑‍🤝‍🧑 Напарник: ${esc(C.people.partner ? C.people.partner.name : 'Игорь Белов')}</h2><p class="hint">${busy ? `Сейчас занят поручением — освободится через ${Math.max(0, busy.due - S.play)} с.` : 'Что поручить? Подозреваемых напарник не допрашивает — это ваша работа.'}</p>
      ${opts.map(([k, t, n, c]) => `<button class="btn ${c && !busy ? 'gold' : ''}" data-o="${k}" style="display:flex;width:100%;justify-content:space-between;margin-top:8px" ${c && !busy ? '' : 'disabled'}><span>${t}</span><span>${n}</span></button>`).join('')}`, m => {
      m.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { S.queue.push({ due: S.play + (perk('squad') ? 10 : 30), type: 'partner', id: b.dataset.o }); persist(); closeOv(); toast('🧑‍🤝‍🧑 Напарник выехал выполнять поручение'); renderPending(); });
    });
  }
  function doOrder(o) {
    const J = partnerJobs(); let txt = '';
    if (o === 'ask') {
      const who = new Set();
      J.ask.forEach(([pid, t]) => {
        const T = C.talk[pid];
        if (!S.tlog[pid]) { S.tlog[pid] = []; addLines(pid, T.intro, false); }
        addLines(pid, ['* (Опрос провёл напарник)', '> ' + t.q].concat(t.lines), false);
        setFlag('k_' + pid); setFlag('t_' + pid + '_' + t.id); setFlags(t.set); (t.give || []).forEach(g => give(g)); if (t.note) journal(t.note);
        who.add(C.people[pid].name);
      });
      txt = who.size ? `Опросил: ${[...who].join(', ')}. Записи разговоров — в карточках людей, новые показания — в уликах.` : 'Опрашивать некого — все уже опрошены.';
    } else if (o === 'spots') {
      J.spots.forEach(sp => { S.spots[sp.id] = 1; setFlags(sp.set); (sp.give || []).forEach(g => give(g)); if (sp.note) journal(sp.note); });
      txt = J.spots.length ? `Осмотрел: ${J.spots.map(x => x.name).join(', ')}. Находки — в уликах.` : 'Всё уже осмотрено.';
    } else if (o === 'labs') {
      J.labs.forEach(id => { S.labs[id] = { done: false }; setFlag('lab_any'); S.queue.push({ due: S.play + spd(C.evidence[id].lab.time), type: 'lab', id }); });
      txt = J.labs.length ? `Отвёз на экспертизу: ${J.labs.map(id => C.evidence[id].name).join(', ')}.` : 'Нечего везти в лабораторию.';
    } else {
      J.reqs.forEach(([t, k]) => { if (t === 'bank') { S.bankReq[k] = { done: false }; S.queue.push({ due: S.play + spd(C.bank[k].delay), type: 'bank', id: k }); } else { S.recReq[k] = { done: false }; S.queue.push({ due: S.play + spd(C.records[k].delay || 20), type: 'rec', id: k }); } });
      txt = J.reqs.length ? `Отправил запросов: ${J.reqs.length}. Ответы придут в «Финансы» и «Запросы».` : 'Все доступные запросы уже отправлены.';
    }
    S.inbox.unshift({ id: 'prt_' + S.play, from: C.people.partner ? 'partner' : 'liza', time: clock(), read: false, text: txt });
    journal('Напарник: ' + txt); snd('msg'); toast('🧑‍🤝‍🧑 Напарник: поручение выполнено');
    renderPending();
  }
  // ---------- аналитик ----------
  function openAnalyst() {
    const sus = C.accuse.questions[0].opts.map(o => o[0]).filter(pid => has('k_' + pid));
    const unclear = sus.filter(pid => !(C.status[pid] || []).some(([f]) => has(f)));
    const locs = C.locations.filter(l => req(l.req) && !has('v_' + l.id)).length;
    const spots = C.locations.filter(l => req(l.req) && has('v_' + l.id)).reduce((a, l) => a + (l.spots || []).filter(sp => req(sp.req) && !S.spots[sp.id]).length, 0);
    const phones = Object.keys(C.phones).filter(k => req(C.phones[k].req) && !has(C.phones[k].openFlag)).length;
    const J = partnerJobs();
    const topics = Object.keys(C.talk).filter(pid => has('k_' + pid)).reduce((a, pid) => a + C.talk[pid].topics.filter(t => req(t.req) && !has('t_' + pid + '_' + t.id)).length, 0);
    const presentable = sus.filter(pid => !S.tlog[pid]).length;
    const L = [];
    if (unclear.length) L.push(`👥 Не исключены из подозреваемых: <b>${unclear.map(pid => esc(C.people[pid].name)).join(', ')}</b>. У каждого проверьте показания: где был, с кем общался.`);
    if (presentable) L.push(`🗣️ Ещё не допрошены: ${presentable}.`);
    if (topics) L.push(`❓ Незаданных вопросов: ${topics}.`);
    if (locs) L.push(`🗺️ Непосещённых адресов: ${locs}.`);
    if (spots) L.push(`🔍 Неосмотренных мест: ${spots}.`);
    if (phones) L.push(`📱 Закрытых телефонов: ${phones}.`);
    if (J.labs.length) L.push(`🧪 Улик, которые можно отправить на экспертизу: ${J.labs.length}.`);
    if (J.reqs.length) L.push(`📨 Доступных, но не отправленных запросов: ${J.reqs.length}.`);
    if (!L.length) L.push('Материалы изучены полностью. Сопоставьте показания с уликами — где-то слова не сходятся с фактами.');
    L.push('💡 Совет: ложь чаще всего видна, если предъявить человеку улику, которая противоречит его ответу на вопрос «где вы были» или «общались ли вы».');
    popup(`<h2>🧠 Аналитик</h2>${L.map(x => `<p style="margin:8px 0;line-height:1.5">${x}</p>`).join('')}`);
  }
  function popup(html, onMount, onClose) {
    const d = overlay(`<div class="modal">${html}<div class="row"><button class="btn" id="pc">Закрыть</button></div></div>`);
    $('#pc').onclick = () => { closeOv(); if (onClose) onClose(); };
    if (onMount) onMount(d.querySelector('.modal'));
    return d;
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && $('#qy')) { e.preventDefault(); $('#qy').click(); return; }
    if (e.key !== 'Escape') return;
    if (document.querySelector('.ov[style*="z-index"]')) { const top = [...document.querySelectorAll('.ov')].pop(); if (top && !top.querySelector('.talk') && !top.querySelector('.call')) { e.preventDefault(); top.remove(); } return; }
    if ($('.ov')) { if (!$('.talk') && !$('.call')) closeOv(); return; }
    if (NATIVE) { e.preventDefault(); askQuit(); }
  });

  // ---------- главное меню ----------
  async function quitGame() {
    if (!NATIVE) return;
    try { if (USER && STORE.profiles[USER]) STORE.profiles[USER].save = SAVE; await fetch('/api/save', { method: 'POST', body: JSON.stringify(STORE) }); } catch (e) { /* ignore */ }
    app.innerHTML = '<div class="title fade"><div class="logoimg">' + BADGE_SVG + '</div><p class="hint">Прогресс сохранён. До встречи, детектив!</p></div>';
    try { await fetch('/api/quit'); } catch (e) { /* ignore */ }
    setTimeout(() => window.close(), 400);
  }
  function askQuit() {
    popup('<h2>Выйти из игры?</h2><p>Прогресс сохранится автоматически.</p>', m => {
      const r = m.querySelector('.row');
      r.insertAdjacentHTML('afterbegin', '<button class="btn red" id="qy">⏻ Выйти</button>');
      r.insertAdjacentHTML('beforebegin', '<p class="hint" style="margin-top:-4px">Enter — выйти, Esc — остаться.</p>');
      m.querySelector('#qy').onclick = () => { closeOv(); quitGame(); };
      m.querySelector('#pc').textContent = 'Отмена';
    });
  }
  let FILT = 'all';
  function screenTitle() {
    if (S) armBack();
    S = null; C = null; clearInterval(tickT);
    app.innerHTML = `<div class="title mainmenu fade"><div class="topmenu"><button class="rankchip" id="ranksB">${rankOf(profXP()).ic} <b>${esc(rankOf(profXP()).n)}</b> ${esc(USER)}<small>${profXP()} оч.</small></button><div class="sp"></div><button class="btn" id="menuB">☰ Меню</button>
      <div class="menupanel" id="menuP" style="display:none">
        <button class="mi" id="guideB">📖 Как играть</button>
        <button class="mi" id="ranksB2">🎖️ Звания и помощники</button>
        <button class="mi" id="snd">${SAVE.settings.sound ? '🔊 Звук: включён' : '🔈 Звук: выключен'}</button>
        <button class="mi" id="musB">${musicWanted() ? '🎵 Музыка: включена' : '🎵 Музыка: выключена'}</button>
        <button class="mi" id="voiceT">🎙️ Проверить озвучку</button>
        <button class="mi" id="voiceS">🗣️ Голоса персонажей</button>
        ${TTS_OK() ? `<button class="mi" id="voiceB">${voiceOn() ? '🗣️ Озвучка: включена' : '🤐 Озвучка: выключена'}</button>` : ''}
        <button class="mi" id="lo">👤 Сменить детектива</button>
        ${NATIVE ? '<button class="mi red" id="quit">⏻ Выйти из игры</button>' : ''}
        <div class="mver">Версия ${window.HP_VERSION || 1} · ${NATIVE || WV ? (UPD_STATE || '—') : 'онлайн'}</div>
      </div></div><div class="logoimg">${BADGE_SVG}</div><h1 class="logo">HOME POLICE</h1><div class="sub">Детективные расследования туманного города</div>
      <div class="filters">${[['all', 'Все'], ['new', 'Новые'], ['prog', 'В процессе'], ['done', 'Раскрытые']].map(([k, l]) => `<button class="btn sm ${FILT === k ? 'gold' : ''}" data-f="${k}">${l}</button>`).join('')}<span class="chip">Раскрыто: <b>${CASES.filter(c => { const s2 = caseSt(c); return s2 && s2.accused && s2.accused.killerOk; }).length}</b> из ${CASES.length}</span></div>
      <div class="caselist">
      ${CASES.map((c, i) => { const st = caseSt(c); const done = st && st.accused && st.accused.killerOk; const k = done ? 'done' : st ? 'prog' : 'new'; if (FILT !== 'all' && FILT !== k) return ''; const ic = c._meta ? { murder: '🔪', poison: '🧪', theft: '💰', arson: '🔥' }[c._meta.crime] : '💎'; return `<div class="casecard${c.tutorial ? ' tut' : ''}" data-n="${c.tutorial ? 0 : c.num || i}" data-c="${c.id}"><span class="cic">${ic}</span><h3>${esc(c.title)}</h3><div class="m">${esc(c.subtitle)}</div><div style="margin-top:10px;font-weight:600;font-size:13.5px">${done ? `✅ ${st.accused.score}/100 · ${esc(st.accused.rank)}` : st ? '🔎 В процессе' : (c.tutorial ? '🎓 Начните с него: обучение с подсказками' : c.id === 'case1' || (!c._meta && !c.tutorial) ? '⭐ Авторское дело' : 'Новое дело')}</div></div>`; }).join('')}
      </div>${NATIVE ? '<div class="hint" style="margin-top:16px">F11 — переключить полноэкранный и оконный режим</div>' : ''}</div>`;
    document.querySelectorAll('.filters [data-f]').forEach(b => b.onclick = () => { FILT = b.dataset.f; screenTitle(); });
    document.querySelectorAll('.casecard[data-c]').forEach(d => d.onclick = () => {
      const id = d.dataset.c, st = SAVE.cases[id];
      if (!st) { openCase(id, true); return; }
      popup(`<h2>${esc(CASES.find(c => c.id === id).title)}</h2><p>Продолжить расследование или начать заново?</p>`, m => {
        const r = m.querySelector('.row');
        r.insertAdjacentHTML('afterbegin', '<button class="btn red" id="rs">Начать заново</button><button class="btn gold" id="ct">Продолжить</button>');
        m.querySelector('#ct').onclick = () => { closeOv(); openCase(id, false); };
        m.querySelector('#rs').onclick = () => { closeOv(); openCase(id, true); };
      });
    });
    $('#snd').onclick = () => { SAVE.settings.sound = !SAVE.settings.sound; persist(); screenTitle(); };
    const mb = $('#musB'); if (mb) mb.onclick = () => { SAVE.settings.music = !musicWanted(); persist(); if (SAVE.settings.music) musicStart(); else musicStop(); screenTitle(); setTimeout(() => { const m = $('#menuP'); if (m) m.style.display = ''; }, 0); };
    const vs = $('#voiceS'); if (vs) vs.onclick = () => { $('#menuP').style.display = 'none'; openVoices(); };
    const vt = $('#voiceT'); if (vt) vt.onclick = () => { $('#menuP').style.display = 'none'; ttsCheck(); };
    const vb = $('#voiceB'); if (vb) vb.onclick = () => { SAVE.settings.voice = !voiceOn(); persist(); if (SAVE.settings.voice) { C = null; say('gromov', 'Озвучка включена. Добро пожаловать в отдел, детектив.'); } screenTitle(); setTimeout(() => { const m = $('#menuP'); if (m) m.style.display = ''; }, 0); };
    $('#lo').onclick = logout;
    const rb = $('#ranksB'); if (rb) rb.onclick = () => popup(ranksHTML());
    const rb2 = $('#ranksB2'); if (rb2) rb2.onclick = () => popup(ranksHTML());
    const mp = $('#menuP'); $('#menuB').onclick = e => { e.stopPropagation(); mp.style.display = mp.style.display === 'none' ? '' : 'none'; };
    document.querySelector('.title.mainmenu').addEventListener('click', e => { if (!e.target.closest('#menuP') && !e.target.closest('#menuB')) mp.style.display = 'none'; });
    const gb = $('#guideB'); if (gb) gb.onclick = openGuide;
    const q = $('#quit'); if (q) q.onclick = askQuit;
  }

  // кнопка «Назад» в Android-приложении
  const WV = /; wv\)/.test(navigator.userAgent);
  function armBack() { if (WV) { try { history.pushState({ hp: 1 }, ''); } catch (e) { /* ignore */ } } }
  window.addEventListener('popstate', () => {
    if (!WV) return;
    const ovs = document.querySelectorAll('.ov');
    if (ovs.length) {
      const top = ovs[ovs.length - 1];
      const btn = ['#cx', '#dec', '#end', '#bye', '#pc', '#x', '#cl'].map(s => top.querySelector(s)).find(Boolean);
      if (btn) btn.click(); else top.remove();
      armBack(); return;
    }
    if (S && C) {
      const back = document.querySelector('#content #back');
      if (back) back.click();
      else if (S.view !== 'case') { S.view = 'case'; renderView(); }
      else { persist(); clearInterval(tickT); screenTitle(); }
      armBack(); return;
    }
    toast('Нажмите «Назад» ещё раз, чтобы выйти');
  });
  window.addEventListener('beforeunload', () => { try { if (USER) STORE.profiles[USER].save = SAVE; const d = JSON.stringify(STORE); if (NATIVE && navigator.sendBeacon) navigator.sendBeacon('/api/save', d); localStorage.setItem('homepolice_v4', d); } catch (e) { /* ignore */ } });
  document.addEventListener('visibilitychange', () => { if (document.hidden && USER) writeStore(); });
  // ---------- автообновление (Android) ----------
  const UPD = 'https://chipoffofficial-ship-it.github.io/home-police/game/';
  async function checkUpdate() {
    if (NATIVE) return checkUpdatePC();
    if (!WV) return;
    try {
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 8000);
      const v = await (await fetch(UPD + 'version.json?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal })).json();
      clearTimeout(tm);
      const cur = window.HP_VERSION || 0;
      let cached = null; try { cached = JSON.parse(localStorage.getItem('hp_game_cache') || 'null'); } catch (e) { /* ignore */ }
      if (!v || !(v.version > cur) || (cached && cached.ver >= v.version)) { if (cached && cached.ver > cur) offerReload(cached.ver); else updStatus('актуальная'); return; }
      const html = await (await fetch(UPD + 'game.html?v=' + v.version, { cache: 'no-store' })).text();
      if (html.indexOf('name="hp-version" content="' + v.version + '"') < 0 || html.length < 100000) return;
      localStorage.setItem('hp_game_cache', JSON.stringify({ ver: v.version, html }));
      offerReload(v.version);
    } catch (e) { updStatus('нет связи с сервером обновлений'); }
  }
  async function checkUpdatePC() {
    const cur = window.HP_VERSION || 0;
    try {
      const lv = parseInt(await (await fetch('/api/ver', { cache: 'no-store' })).text()) || 0;
      if (lv > cur) { offerReload(lv); return; }
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 15000);
      const v = await (await fetch(UPD + 'version.json?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal })).json();
      clearTimeout(tm);
      if (!v || !(v.version > cur)) { updStatus('актуальная'); return; }
      updStatus('загружается обновление…');
      const html = await (await fetch(UPD + 'game.html?v=' + v.version, { cache: 'no-store' })).text();
      if (html.indexOf('name="hp-version" content="' + v.version + '"') < 0 || html.length < 100000) return;
      const r = await (await fetch('/api/update', { method: 'POST', body: html })).text();
      if (r === 'ok' || (parseInt(await (await fetch('/api/ver', { cache: 'no-store' })).text()) || 0) > cur) offerReload(v.version);
    } catch (e) { updStatus('нет связи с сервером обновлений'); }
  }
  function updStatus(t) { const e = document.getElementById('updst'); if (e) e.textContent = t; }
  function offerReload(ver) {
    const d = document.createElement('div'); d.className = 'toast ev'; d.style.bottom = '22px';
    d.innerHTML = `🔄 Загружено обновление игры. <button class="btn sm gold" style="margin-left:8px">Обновить</button>`;
    document.body.appendChild(d);
    d.querySelector('button').onclick = () => { try { if (USER) writeStore(); } catch (e) { /* ignore */ } setTimeout(() => location.reload(), 300); };
    setTimeout(() => d.remove(), 30000);
  }

  // ---------- экран запуска: проверка и загрузка обновления ----------
  let UPD_STATE = '';
  let APK_NEED = false;
  const SHELL_VER = (() => { const m = navigator.userAgent.match(/HPTTS\/(\d+)/); return m ? +m[1] : 0; })();
  const APK_URL = 'https://chipoffofficial-ship-it.github.io/home-police/HOME_POLICE.apk';
  function apkBox() {
    return APK_NEED ? `<div class="card" style="margin-top:12px;text-align:left;border-color:rgba(217,166,74,.6)"><b>📲 Новая версия приложения</b><div class="hint" style="margin:6px 0 10px">В ней озвучка персонажей и напоминания. Игра обновляется сама, а приложение нужно скачать один раз и установить поверх — прогресс сохранится.</div><button class="bigbtn" id="apkB" style="font-size:15px;padding:12px"><span class="bi">⬇️</span><span>Скачать приложение</span></button></div>` : '';
  }
  async function findUpdate(step) {
    const cur = window.HP_VERSION || 0;
    try {
      if (NATIVE) { const lv = parseInt(await (await fetch('/api/ver', { cache: 'no-store' })).text()) || 0; if (lv > cur) return { state: 'ready', ver: lv }; }
      let cached = null; if (WV) { try { cached = JSON.parse(localStorage.getItem('hp_game_cache') || 'null'); } catch (e) { cached = null; } }
      step('Проверка обновлений…', null);
      const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 12000);
      const v = await (await fetch(UPD + 'version.json?t=' + Date.now(), { cache: 'no-store', signal: ctl.signal })).json();
      clearTimeout(tm);
      APK_NEED = WV && v && v.apk && SHELL_VER < v.apk;
      if (cached && cached.ver > cur && !(v && v.version > cached.ver)) return { state: 'ready', ver: cached.ver };
      if (!v || !(v.version > cur)) return { state: 'none' };
      step(`Найдена версия ${v.version}. Загрузка…`, 0);
      const r = await fetch(UPD + 'game.html?v=' + v.version, { cache: 'no-store' });
      const total = +(r.headers.get('content-length') || 0) || 400000;
      const rd = r.body.getReader(); const parts = []; let got = 0;
      for (;;) { const x = await rd.read(); if (x.done) break; parts.push(x.value); got += x.value.length; step(`Загрузка версии ${v.version}… ${Math.min(99, Math.round(got / total * 100))}%`, Math.min(0.99, got / total)); }
      const buf = new Uint8Array(got); let o = 0; parts.forEach(pt => { buf.set(pt, o); o += pt.length; });
      const html = new TextDecoder('utf-8').decode(buf);
      if (html.indexOf('name="hp-version" content="' + v.version + '"') < 0 || html.length < 100000) return { state: 'offline' };
      step('Установка обновления…', 1);
      if (NATIVE) await fetch('/api/update', { method: 'POST', body: html });
      else localStorage.setItem('hp_game_cache', JSON.stringify({ ver: v.version, html }));
      return { state: 'ready', ver: v.version };
    } catch (e) { return { state: 'offline' }; }
  }
  function startGame() { screenAuth(); }
  async function screenBoot() {
    const cur = window.HP_VERSION || 0;
    app.innerHTML = `<div class="title boot fade"><div class="logoimg">${BADGE_SVG}</div><h1 class="logo">HOME POLICE</h1><div class="sub">Версия ${cur}</div><div class="card" style="width:min(440px,92vw);margin-top:22px;text-align:center;padding:24px">
      <div id="bst" style="margin-top:22px;min-height:22px"><span class="spin"></span> Подключение к серверу…</div>
      <div style="height:8px;border-radius:6px;background:rgba(255,255,255,.08);margin:14px 0 4px;overflow:hidden"><div id="bpr" style="height:100%;width:0;background:var(--gold);transition:width .2s"></div></div>
      <div id="bbt" class="bootbtns"></div></div></div>`;
    const st = (t, f) => { const e = $('#bst'); if (e) e.innerHTML = `<span class="spin"></span> ${esc(t)}`; const b = $('#bpr'); if (b) b.style.width = f == null ? '35%' : Math.round(f * 100) + '%'; };
    const res = await findUpdate(st);
    const bst = $('#bst'), bbt = $('#bbt'), bpr = $('#bpr'); if (!bst) return;
    if (res.state === 'ready') {
      UPD_STATE = 'загружена версия ' + res.ver;
      bpr.style.width = '100%';
      bst.innerHTML = `🔄 Доступна новая версия <b>${res.ver}</b> (у вас ${cur}). Прогресс и профили сохранятся.`;
      bbt.innerHTML = `<button class="bigbtn blue" id="bup"><span class="bi">⬇️</span><span>Обновить<small>до версии ${res.ver} · займёт пару секунд</small></span></button><button class="linkbtn" id="bplay">Играть без обновления</button>`;
      $('#bup').onclick = () => { bst.innerHTML = '<span class="spin"></span> Перезапуск…'; setTimeout(() => location.reload(), 300); };
    } else if (res.state === 'none') {
      UPD_STATE = 'актуальная';
      bpr.style.width = '100%';
      bst.innerHTML = `✅ Установлена последняя версия (${cur}).`;
      bbt.innerHTML = '<button class="bigbtn" id="bplay"><span class="bi">▶</span><span>Играть</span></button>';
    } else {
      UPD_STATE = 'нет связи с сервером обновлений';
      bpr.style.width = '0';
      bst.innerHTML = '⚠️ Не удалось проверить обновления — нет связи с сервером. Можно играть в текущую версию.';
      bbt.innerHTML = '<button class="bigbtn" id="bplay"><span class="bi">▶</span><span>Играть</span></button><button class="linkbtn" id="bretry">↻ Проверить обновления ещё раз</button>';
      $('#bretry').onclick = screenBoot;
    }
    if (APK_NEED) { bbt.insertAdjacentHTML('afterend', apkBox()); $('#apkB').onclick = () => { location.href = APK_URL; setTimeout(() => popup('<h2>📲 Установка</h2><p style="line-height:1.6">Файл <b>HOME_POLICE.apk</b> скачивается в браузере. Когда загрузка закончится, откройте его и нажмите <b>«Обновить»</b> (или «Установить»). Если телефон спросит — разрешите установку из этого источника.</p>'), 600); }; }
    $('#bplay').onclick = () => { snd('click'); startGame(); };
  }

  loadSave().then(async () => {
    if (NATIVE) setInterval(() => fetch('/api/ping', { cache: 'no-store' }).catch(() => {}), 3000);
    armBack();
    if (NATIVE || WV) screenBoot(); else startGame();
  });
  window.__HP = { get S() { return S; }, get C() { return C; }, get SAVE() { return SAVE; }, profXP: () => profXP(), rerender: () => screenTitle() };
})();
