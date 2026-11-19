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
  let PW = null, TW = null;
  const loaded = []; // порядок использования голосов (для выгрузки старых)
  async function startEngine() {
    const [pj, pw, pd, tj, tw] = await Promise.all(['phon.js', 'phon.wasm', 'phon.data', 'tts.js', 'tts.wasm'].map(getFile));
    if (!pj || !pw || !pd || !tj || !tw) throw new Error('нет файлов движка');
    PW = mkWorker(); TW = mkWorker();
    await PW.call({ op: 'init', kind: 'phon', js: dec.decode(pj), wasm: pw, data: pd });
    await TW.call({ op: 'init', kind: 'tts', js: dec.decode(tj), wasm: tw });
  }
  let loadChain = Promise.resolve();
  function ensureVoice(id) {
    const job = loadChain.then(async () => {
      const i = loaded.indexOf(id);
      if (i >= 0) { loaded.splice(i, 1); loaded.push(id); return; }
      while (loaded.length >= MAX_LOADED) { const old = loaded.shift(); await TW.call({ op: 'unload', name: old }); }
      const [m, t] = await Promise.all([getFile(id + '.onnx'), getFile(id + '.txt')]);
      if (!m || !t) throw new Error('голос не скачан');
      await TW.call({ op: 'load', name: id, model: m, tokens: t });
      loaded.push(id);
    });
    loadChain = job.catch(() => {});
    return job;
  }

  // ---------- воспроизведение ----------
  let AC = null, gen = 0, playAt = 0, srcs = [], work = Promise.resolve();
  function ac() {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (AC && AC.state === 'suspended') AC.resume().catch(() => {}); }, { passive: true, capture: true }));
  function playSamples(samples, sr, rate) {
    const c = ac();
    const b = c.createBuffer(1, samples.length, sr); b.getChannelData(0).set(samples);
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate || 1;
    const g = c.createGain(); g.gain.value = 1; s.connect(g); g.connect(c.destination);
    const at = Math.max(c.currentTime + 0.03, playAt);
    s.start(at); playAt = at + samples.length / sr / (rate || 1) + 0.18;
    window.HPPiper.last = { n: samples.length, sr, rms: Math.sqrt(samples.reduce((a, x) => a + x * x, 0) / Math.max(1, samples.length)) };
    srcs.push(s); s.onended = () => { srcs = srcs.filter(x => x !== s); };
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
  // проговорить фразу; opts: { voice, speed, pitch }
  function speak(text, opts) {
    opts = opts || {};
    if (!st.ready) return false;
    const my = gen, id = opts.voice && VOICES.some(v => v.id === opts.voice) ? opts.voice : VOICES[0].id;
    const parts = splitText(text);
    try { ac(); } catch (e) { return false; }
    work = work.then(async () => {
      if (my !== gen) return;
      try {
        await ensureVoice(id);
        for (const p of parts) {
          if (my !== gen) return;
          const ph = (await PW.call({ op: 'phon', text: p })).res;
          for (const s of ph) {
            if (my !== gen) return;
            const r = await TW.call({ op: 'gen', name: id, ph: s, speed: opts.speed || 1 });
            if (my !== gen) return;
            playSamples(r.samples, r.sr, opts.pitch || 1);
          }
        }
      } catch (e) {
        st.error = String(e && e.message || e); st.fails = (st.fails || 0) + 1;
        if (st.fails >= 3) { st.ready = false; st.state = 'error'; emit(); }
        if (opts.onFail) try { opts.onFail(e); } catch (x) { /* ignore */ }
      }
    });
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
      await ensureVoice(VOICES[0].id);
      st.state = 'ready'; st.ready = true; st.done = 1; emit();
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
    start: run, speak, stop, speaking,
    test: async () => { await run(); return st; }
  };
  // скачивание и запуск — сами, через несколько секунд после старта игры
  setTimeout(run, 2500);
})();
