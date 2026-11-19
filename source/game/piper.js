// HOME POLICE — нейросетевые голоса Piper (работают прямо в игре, без интернета после загрузки)
// Файлы голосов скачиваются сами при первом запуске и хранятся на устройстве (IndexedDB).
(function () {
  'use strict';
  const BASE = 'https://chipoffofficial-ship-it.github.io/home-police/voice/';
  const PACK = 1; // номер набора файлов: при замене файлов на сайте увеличить
  const MOBILE = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  // id, имя для меню, пол
  const ALL_VOICES = [
    { id: 'dmitri', name: 'Дмитрий', f: false },
    { id: 'irina', name: 'Ирина', f: true },
    { id: 'denis', name: 'Денис', f: false },
    { id: 'ruslan', name: 'Руслан', f: false }
  ];
  // на телефоне — два голоса (мужской и женский), чтобы не занимать много памяти
  const VOICES = MOBILE ? ALL_VOICES.slice(0, 2) : ALL_VOICES;
  const MAX_LOADED = MOBILE ? 2 : 3;
  const ENGINE = [
    { key: 'phon.js', size: 98000 }, { key: 'phon.wasm', size: 405867 }, { key: 'phon.data', size: 9201604 },
    { key: 'tts.js', size: 124000 }, { key: 'tts.wasm', size: 13403088 }
  ];
  const MODEL_SIZE = 63150000;
  const FILES = ENGINE.concat(...VOICES.map(v => [{ key: v.id + '.txt', size: 1000 }, { key: v.id + '.onnx', size: MODEL_SIZE }]));
  const TOTAL = FILES.reduce((a, f) => a + f.size, 0);

  const st = { state: 'idle', done: 0, error: '', have: {}, ready: false, enabled: true };
  const listeners = [];
  function emit() { listeners.forEach(f => { try { f(st); } catch (e) { /* ignore */ } }); }

  // ---------- хранилище ----------
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let r;
      try { r = indexedDB.open('hp-piper', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { r.result.createObjectStore('f'); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error || new Error('indexedDB'));
    });
    return dbp;
  }
  async function dbGet(k) {
    const d = await db();
    return new Promise((res, rej) => { const q = d.transaction('f', 'readonly').objectStore('f').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  }
  async function dbPut(k, v) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction('f', 'readwrite'); t.objectStore('f').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error('abort')); });
  }
  async function getFile(k) {
    const r = await dbGet(k);
    if (!r || r.pack !== PACK || !r.buf) return null;
    return r.buf;
  }

  // ---------- загрузка ----------
  async function download(f, onBytes) {
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const resp = await fetch(BASE + f.key + '?p=' + PACK, { cache: 'no-store' });
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        if (!resp.body || !resp.body.getReader) { const b = await resp.arrayBuffer(); onBytes(b.byteLength); return b; }
        const rd = resp.body.getReader(), parts = []; let n = 0;
        for (;;) { const { done, value } = await rd.read(); if (done) break; parts.push(value); n += value.length; onBytes(value.length); }
        const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
        return out.buffer;
      } catch (e) { lastErr = e; onBytes(-1); await new Promise(r => setTimeout(r, 3000 * (attempt + 1))); }
    }
    throw lastErr || new Error('download');
  }

  let started = false;
  async function ensureFiles() {
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ignore */ }
    let base = 0;
    for (const f of FILES) {
      const have = await getFile(f.key);
      if (have) { st.have[f.key] = true; base += f.size; st.done = base / TOTAL; continue; }
      st.state = 'download'; emit();
      let got = 0;
      const buf = await download(f, n => {
        if (n < 0) { got = 0; } else got += n;
        st.done = (base + Math.min(got, f.size)) / TOTAL;
        emitSoon();
      });
      if (f.key.endsWith('.onnx') && buf.byteLength < 1000000) throw new Error('файл ' + f.key + ' повреждён');
      await dbPut(f.key, { pack: PACK, buf });
      st.have[f.key] = true; base += f.size; st.done = base / TOTAL; emit();
    }
  }
  let emitT = 0;
  function emitSoon() { if (emitT) return; emitT = setTimeout(() => { emitT = 0; emit(); }, 400); }

  // ---------- движок в фоновых потоках ----------
  function workerMain() {
    let M = null, kind = '';
    const tts = {};
    const post = (o, t) => self.postMessage(o, t || []);
    const fail = (id, e) => post({ id, err: String((e && e.message) || e) });
    function rm(p) { try { M.FS_unlink(p); } catch (e) { /* ignore */ } }
    self.onmessage = e => {
      const d = e.data;
      try {
        if (d.op === 'init') {
          kind = d.kind;
          self.Module = M = {
            wasmBinary: d.wasm, locateFile: p => p, print() {}, printErr() {}, setStatus() {},
            getPreloadedPackage: () => d.data || new ArrayBuffer(0),
            onRuntimeInitialized() {
              try {
                if (kind === 'phon') { const r = self.piperPhonemizeInitialize(); if (r < 0) throw new Error('espeak ' + r); }
                post({ id: d.id, ok: true });
              } catch (err) { fail(d.id, err); }
            },
            onAbort(w) { fail(d.id, 'abort ' + w); }
          };
          const url = URL.createObjectURL(new Blob([d.js], { type: 'text/javascript' }));
          try { self.importScripts(url); } finally { URL.revokeObjectURL(url); }
          return;
        }
        if (d.op === 'phon') {
          const s = self.piperPhonemize(d.text, 'ru') || [];
          post({ id: d.id, res: s.filter(x => x && x.length) });
          return;
        }
        if (d.op === 'load') {
          const dir = '/v_' + d.name;
          try { M.FS_createPath('/', dir.slice(1), true, true); } catch (err) { /* уже есть */ }
          rm(dir + '/m.onnx'); rm(dir + '/tokens.txt');
          M.FS_createDataFile(dir, 'm.onnx', new Uint8Array(d.model), true, false, false);
          M.FS_createDataFile(dir, 'tokens.txt', new Uint8Array(d.tokens), true, false, false);
          try {
            tts[d.name] = self.createOfflineTts(M, {
              offlineTtsModelConfig: {
                offlineTtsVitsModelConfig: { model: dir + '/m.onnx', lexicon: '', tokens: dir + '/tokens.txt', dataDir: '', dictDir: '', noiseScale: 0.667, noiseScaleW: 0.8, lengthScale: 1.0 },
                numThreads: 1, debug: 0, provider: 'cpu'
              },
              ruleFsts: '', ruleFars: '', maxNumSentences: 1
            });
          } finally { rm(dir + '/m.onnx'); }
          if (!tts[d.name] || !tts[d.name].handle) { delete tts[d.name]; throw new Error('model'); }
          post({ id: d.id, ok: true });
          return;
        }
        if (d.op === 'mem') { post({ id: d.id, heap: M.HEAPF32 ? M.HEAPF32.buffer.byteLength : 0 }); return; }
        if (d.op === 'unload') {
          if (tts[d.name]) { tts[d.name].free(); delete tts[d.name]; }
          post({ id: d.id, ok: true });
          return;
        }
        if (d.op === 'gen') {
          const t = tts[d.name]; if (!t) throw new Error('no voice ' + d.name);
          const a = t.generateWithConfig('', { phonemeCodepoints: [d.ph], sid: 0, speed: d.speed || 1 });
          post({ id: d.id, samples: a.samples, sr: a.sampleRate }, [a.samples.buffer]);
        }
      } catch (err) { fail(d.id, err); }
    };
  }

  function mkWorker() {
    const src = '(' + workerMain.toString() + ')();';
    const w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
    const pend = {}; let seq = 0;
    w.onmessage = e => { const d = e.data, p = pend[d.id]; if (!p) return; delete pend[d.id]; if (d.err) p.rej(new Error(d.err)); else p.res(d); };
    w.onerror = e => { const err = new Error('worker: ' + (e && e.message)); Object.keys(pend).forEach(k => { pend[k].rej(err); delete pend[k]; }); e.preventDefault && e.preventDefault(); };
    return {
      call(msg, tr) { return new Promise((res, rej) => { const id = ++seq; pend[id] = { res, rej }; msg.id = id; w.postMessage(msg, tr || []); }); },
      kill() { try { w.terminate(); } catch (e) { /* ignore */ } }
    };
  }

  const dec = new TextDecoder();
  // один поток разбора текста и 1–2 потока синтеза (на многоядерных устройствах — два, вдвое быстрее)
  let PW = null;
  const TWS = [];
  let TJS = null, TWASM = null;
  async function mkTts() {
    const T = { w: mkWorker(), loaded: [], loadChain: Promise.resolve(), chain: Promise.resolve(), busy: 0, dead: false };
    await T.w.call({ op: 'init', kind: 'tts', js: TJS, wasm: TWASM.slice(0) });
    return T;
  }
  async function startEngine() {
    const [pj, pw, pd, tj, tw] = await Promise.all(['phon.js', 'phon.wasm', 'phon.data', 'tts.js', 'tts.wasm'].map(getFile));
    if (!pj || !pw || !pd || !tj || !tw) throw new Error('нет файлов движка');
    TJS = dec.decode(tj); TWASM = tw;
    PW = mkWorker();
    await PW.call({ op: 'init', kind: 'phon', js: dec.decode(pj), wasm: pw, data: pd });
    TWS.push(await mkTts());
  }
  // второй поток синтеза поднимаем в фоне; если не получилось (мало памяти) — работаем с одним
  async function startSecond() {
    // заранее загружаем и женский голос, чтобы первая реплика женщины не ждала загрузки
    try { const fv = VOICES.find(v => v.f); if (fv) await ensureVoice(TWS[0], fv.id); } catch (e) { /* ignore */ }
    // и голос детектива (на ПК — Денис)
    try { if (!MOBILE && VOICES.some(v => v.id === 'denis')) await ensureVoice(TWS[0], 'denis'); } catch (e) { /* ignore */ }
    if ((navigator.hardwareConcurrency || 2) < 4 || TWS.length > 1) return;
    try {
      const T = await mkTts();
      await ensureVoice(T, VOICES[0].id);
      TWS.push(T);
    } catch (e) { /* остаёмся на одном потоке */ }
  }
  function ensureVoice(T, id) {
    const job = T.loadChain.then(async () => {
      const i = T.loaded.indexOf(id);
      if (i >= 0) { T.loaded.splice(i, 1); T.loaded.push(id); return; }
      while (T.loaded.length >= MAX_LOADED) { const old = T.loaded.shift(); await T.w.call({ op: 'unload', name: old }); }
      const [m, t] = await Promise.all([getFile(id + '.onnx'), getFile(id + '.txt')]);
      if (!m || !t) throw new Error('голос не скачан');
      await T.w.call({ op: 'load', name: id, model: m, tokens: t });
      T.loaded.push(id);
    });
    T.loadChain = job.catch(() => {});
    return job;
  }
  // синтез одного предложения на наименее занятом потоке
  function synthOn(id, ph, speed, alive) {
    const live = TWS.filter(T => !T.dead);
    // предпочитаем поток, где этот голос уже загружен (загрузка голоса дольше синтеза фразы)
    const score = T => T.busy + (T.loaded.includes(id) ? 0 : 2);
    const T = live.reduce((a, b) => (score(b) < score(a) ? b : a), live[0]);
    T.busy++;
    const run = async () => {
      if (!alive()) return null;
      try {
        await ensureVoice(T, id);
        return await T.w.call({ op: 'gen', name: id, ph, speed });
      } catch (e) {
        if (T !== TWS[0]) { T.dead = true; await ensureVoice(TWS[0], id); return await TWS[0].w.call({ op: 'gen', name: id, ph, speed }); }
        throw e;
      }
    };
    const pr = T.chain.then(run);
    T.chain = pr.catch(() => {}).then(() => { T.busy--; });
    return pr;
  }

  // ---------- синтез заранее и воспроизведение ----------
  // Фразы синтезируются по очереди сразу, как только известны (prepare), а играются, когда их покажут (play).
  let AC = null, gen = 0, playAt = 0, srcs = [];
  function ac() {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); }, { passive: true, capture: true }));
  function trim(x, sr) {
    const th = 0.006, keep = Math.floor(sr * 0.02);
    let a = 0, z = x.length - 1;
    while (a < x.length && Math.abs(x[a]) < th) a++;
    while (z > a && Math.abs(x[z]) < th) z--;
    if (z <= a) return x;
    return x.subarray(Math.max(0, a - keep), Math.min(x.length, z + 1 + keep));
  }
  function splitText(t) {
    const out = [];
    String(t).replace(/\s+/g, ' ').split(/(?<=[.!?…])\s+/).forEach(s => {
      s = s.trim(); if (!s) return;
      while (s.length > 220) { let k = s.lastIndexOf(',', 200); if (k < 60) k = s.lastIndexOf(' ', 200); if (k < 30) k = 200; out.push(s.slice(0, k + 1).trim()); s = s.slice(k + 1).trim(); }
      if (s) out.push(s);
    });
    return out;
  }
  // подготовка фразы: разбор на звуки по очереди, синтез предложений — параллельно на свободных потоках
  let phonChain = Promise.resolve();
  function prepare(text, opts) {
    opts = opts || {};
    if (!st.ready || !TWS.length) return null;
    const id = opts.voice && VOICES.some(v => v.id === opts.voice) ? opts.voice : VOICES[0].id;
    const job = { gen, slots: [], total: null, waiters: [], failed: false, rate: opts.pitch || 1, onFail: opts.onFail };
    const wake = () => { const w = job.waiters; job.waiters = []; w.forEach(f => f()); };
    const alive = () => job.gen === gen;
    const fail = e => {
      job.failed = true;
      st.error = String(e && e.message || e); st.fails = (st.fails || 0) + 1;
      if (st.fails >= 3) { st.ready = false; st.state = 'error'; emit(); }
    };
    const parts = splitText(text);
    phonChain = phonChain.then(async () => {
      const all = [];
      try {
        if (alive()) for (const p of parts) (await PW.call({ op: 'phon', text: p })).res.forEach(x => all.push(x));
      } catch (e) { fail(e); }
      job.total = alive() ? all.length : 0; wake();
      all.forEach((ph, k) => {
        synthOn(id, ph, opts.speed || 1, alive).then(r => { job.slots[k] = r ? { s: trim(r.samples, r.sr), sr: r.sr } : null; wake(); })
          .catch(e => { fail(e); job.slots[k] = null; wake(); });
      });
    });
    return job;
  }
  const nextChunk = (job, k) => new Promise(res => {
    const chk = () => {
      if (job.total !== null && k >= job.total) return res(null);
      if (job.slots[k] !== undefined) return res(job.slots[k]);
      job.waiters.push(chk);
    };
    chk();
  });
  // играть подготовленную фразу: started — когда зазвучала, ended — когда закончилась
  function play(job) {
    let onStart, onEnd;
    const started = new Promise(r => (onStart = r)), ended = new Promise(r => (onEnd = r));
    if (!job) { onStart(false); onEnd(false); return { started, ended }; }
    (async () => {
      let k = 0, endAt = 0;
      for (;;) {
        const c = await nextChunk(job, k);
        if (!c || job.gen !== gen) break;
        const x = ac();
        const b = x.createBuffer(1, c.s.length, c.sr); b.getChannelData(0).set(c.s);
        const src = x.createBufferSource(); src.buffer = b; src.playbackRate.value = job.rate;
        src.connect(x.destination);
        const at = Math.max(x.currentTime + 0.01, playAt);
        const dur = c.s.length / c.sr / job.rate;
        src.start(at); srcs.push(src); src.onended = () => { srcs = srcs.filter(y => y !== src); };
        playAt = at + dur + 0.05; endAt = at + dur;
        window.HPPiper.last = { n: c.s.length, sr: c.sr, dur, rms: Math.sqrt(c.s.reduce((a, v) => a + v * v, 0) / Math.max(1, c.s.length)) };
        if (k === 0) setTimeout(() => onStart(true), Math.max(0, (at - x.currentTime) * 1000));
        k++;
      }
      if (k === 0) { onStart(false); onEnd(false); if (job.failed && job.onFail) try { job.onFail(); } catch (e) { /* ignore */ } return; }
      playAt += 0.08;
      setTimeout(() => onEnd(true), Math.max(0, (endAt - ac().currentTime) * 1000));
    })();
    return { started, ended };
  }
  // сказать сразу (без предварительной подготовки)
  function speak(text, opts) {
    const job = prepare(text, opts);
    if (!job) return false;
    play(job);
    return true;
  }
  function stop() {
    gen++; playAt = 0;
    srcs.forEach(s => { try { s.stop(); } catch (e) { /* ignore */ } }); srcs = [];
  }
  function speaking() { return !!AC && playAt > AC.currentTime; }

  async function run() {
    if (started) return; started = true;
    try {
      if (typeof WebAssembly !== 'object' || typeof Worker !== 'function' || !window.indexedDB) throw new Error('устройство не поддерживает');
      st.state = 'check'; emit();
      await ensureFiles();
      st.state = 'start'; emit();
      await startEngine();
      await ensureVoice(TWS[0], VOICES[0].id);
      st.state = 'ready'; st.ready = true; st.done = 1; emit();
      setTimeout(startSecond, 1500);
    } catch (e) {
      st.state = 'error'; st.error = String(e && e.message || e); st.ready = false; emit();
      started = false;
      // попробуем ещё раз позже (например, когда появится интернет)
      setTimeout(run, 5 * 60 * 1000);
    }
  }

  window.HPPiper = {
    VOICES, TOTAL, MOBILE,
    status: () => st,
    onChange: f => listeners.push(f),
    start: run, speak, prepare, play, stop, speaking,
    test: async () => { await run(); return st; },
    _mem: async () => (await TWS[0].w.call({ op: 'mem' })).heap,
    _workers: () => TWS.filter(T => !T.dead).length,
    _gen: async (t, v) => { const ph = (await PW.call({ op: 'phon', text: t })).res; const t0 = performance.now(); const rs = await Promise.all(ph.map(x => synthOn(v, x, 1, () => true))); const n = rs.reduce((a, r) => a + r.samples.length / r.sr, 0); return { synth: (performance.now() - t0) / 1000, audio: n }; }
  };
  // скачивание и запуск — сами, через несколько секунд после старта игры
  setTimeout(run, 2500);
})();
