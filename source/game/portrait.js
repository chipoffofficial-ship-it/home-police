// ===== Портреты персонажей и «фотографии» =====
(function (root) {
  'use strict';
  const SKIN = [['#f3d2b6', '#d9a98a'], ['#e6b48e', '#c48a66'], ['#c98d62', '#a46a44'], ['#a26a44', '#7c4c2c'], ['#7a4a2c', '#5a341c']];
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * k))); g = Math.max(0, Math.min(255, Math.round(g * k))); b = Math.max(0, Math.min(255, Math.round(b * k)));
    return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }
  let uid = 0;
  function portrait(pt, opts) {
    pt = pt || {}; opts = opts || {};
    const id = 'p' + (++uid);
    const [sk, skD] = SKIN[pt.skin || 0];
    const hc = pt.hairC || '#3a2a1a', hcD = shade(hc, 0.7);
    const cl = pt.cloth || '#444', clD = shade(cl, 0.7), clL = shade(cl, 1.25);
    const bg = pt.bg || '#556';
    const age = pt.age || 0;
    const f = !!pt.f;
    let s = `<svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" class="portrait">
<defs><radialGradient id="${id}b" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${shade(bg, 1.35)}"/><stop offset="1" stop-color="${shade(bg, 0.55)}"/></radialGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${sk}"/><stop offset="1" stop-color="${skD}"/></linearGradient>
<linearGradient id="${id}c" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${clL}"/><stop offset="1" stop-color="${clD}"/></linearGradient></defs>
<rect width="100" height="120" fill="url(#${id}b)"/>`;
    if (opts.mug) {
      for (let y = 20; y < 120; y += 12) s += `<line x1="0" x2="100" y1="${y}" y2="${y}" stroke="rgba(255,255,255,.18)" stroke-width=".6"/><text x="3" y="${y - 1.5}" font-size="4" fill="rgba(255,255,255,.35)" font-family="monospace">${(200 - y) }</text>`;
    }
    // волосы сзади
    const H = pt.hair || 'short';
    if (H === 'long') s += `<path d="M27 46 Q25 18 50 16 Q75 18 73 46 L77 96 Q64 90 50 90 Q36 90 23 96Z" fill="${hc}"/>`;
    if (H === 'bob') s += `<path d="M28 44 Q27 18 50 17 Q73 18 72 44 L73 68 Q62 72 50 72 Q38 72 27 68Z" fill="${hc}"/>`;
    if (H === 'ponytail') s += `<path d="M66 30 Q86 40 80 74 Q76 60 70 50Z" fill="${hc}"/>`;
    if (H === 'curly') s += `<g fill="${hc}">${[[30, 30], [38, 21], [50, 18], [62, 21], [70, 30], [27, 42], [73, 42], [29, 54], [71, 54]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9"/>`).join('')}</g>`;
    if (H === 'bun') s += `<circle cx="50" cy="14" r="9" fill="${hc}"/>`;
    // одежда
    s += `<path d="M10 120 Q12 92 34 86 L50 92 L66 86 Q88 92 90 120Z" fill="url(#${id}c)"/>`;
    const C = pt.collar || 'shirt';
    if (C === 'suit' || C === 'tie') {
      s += `<path d="M40 86 L50 104 L60 86 L56 84 L50 92 L44 84Z" fill="#f2f2f2"/>`;
      if (C === 'tie' || pt.tie !== false) s += `<path d="M48.5 92 L51.5 92 L53 108 L50 113 L47 108Z" fill="${C === 'tie' ? '#7a2a2a' : '#2a3a5a'}"/>`;
      s += `<path d="M34 86 L46 110 L42 92Z M66 86 L54 110 L58 92Z" fill="${clD}"/>`;
    } else if (C === 'coat') {
      s += `<path d="M42 86 L50 100 L58 86Z" fill="#9ab"/><path d="M34 86 L47 120 L40 120 L30 90Z M66 86 L53 120 L60 120 L70 90Z" fill="#cfd3da"/>`;
    } else if (C === 'hoodie') {
      s += `<path d="M30 88 Q50 100 70 88 Q66 80 50 82 Q34 80 30 88Z" fill="${clD}"/><line x1="45" y1="96" x2="44" y2="110" stroke="#ddd" stroke-width="1"/><line x1="55" y1="96" x2="56" y2="110" stroke="#ddd" stroke-width="1"/>`;
    } else if (C === 'vest') {
      s += `<path d="M40 86 L50 98 L60 86Z" fill="#e8e0d0"/><path d="M36 86 L50 120 L64 86 L58 86 L50 104 L42 86Z" fill="${shade(cl, 0.55)}"/>`;
    } else if (C === 'scarf') {
      s += `<path d="M36 84 Q50 96 64 84 Q66 92 60 96 Q50 102 40 96 Q34 92 36 84Z" fill="#8a2a3a"/><path d="M56 96 L60 116 L54 116Z" fill="#7a1a2a"/>`;
    } else if (C === 'sweater') {
      s += `<path d="M38 86 Q50 94 62 86 Q60 90 50 92 Q40 90 38 86Z" fill="${clD}"/>`;
    } else if (C === 'leather') {
      s += `<path d="M40 86 L50 96 L60 86Z" fill="#222"/><path d="M34 86 L44 104 L40 120 M66 86 L56 104 L60 120" stroke="${shade(cl, 0.5)}" stroke-width="3" fill="none"/>`;
    } else if (C === 'apron') {
      s += `<path d="M38 96 L62 96 L64 120 L36 120Z" fill="${shade(cl, 1.4)}"/><path d="M38 96 L34 86 M62 96 L66 86" stroke="${shade(cl, 1.4)}" stroke-width="2"/>`;
    } else if (C === 'jacket') {
      s += `<path d="M36 84 L50 96 L64 84 L66 90 L50 102 L34 90Z" fill="${clD}"/><line x1="50" y1="102" x2="50" y2="120" stroke="${shade(cl, 0.5)}" stroke-width="1.5"/><rect x="58" y="106" width="12" height="5" rx="1" fill="#222" opacity=".6"/>`;
    } else if (C === 'shawl') {
      s += `<path d="M14 120 Q20 92 50 90 Q80 92 86 120 L70 120 Q60 100 50 100 Q40 100 30 120Z" fill="${shade(cl, 1.3)}"/>`;
    }
    // шея и голова
    s += `<path d="M42 70 L42 88 Q50 94 58 88 L58 70Z" fill="${skD}"/>`;
    if (pt.ears !== false) s += `<ellipse cx="29" cy="54" rx="4" ry="6.5" fill="${skD}"/><ellipse cx="71" cy="54" rx="4" ry="6.5" fill="${skD}"/>`;
    s += `<ellipse cx="50" cy="50" rx="21" ry="25" fill="url(#${id}s)"/>`;
    // морщины
    if (age >= 2) s += `<path d="M40 33 Q50 31 60 33" stroke="${skD}" stroke-width=".8" fill="none"/>`;
    if (age >= 3) s += `<path d="M42 36.5 Q50 35 58 36.5" stroke="${skD}" stroke-width=".7" fill="none"/><path d="M39 60 Q41 66 44 68 M61 60 Q59 66 56 68" stroke="${skD}" stroke-width=".8" fill="none"/>`;
    if (age >= 4) s += `<path d="M33 50 L36 51 M67 50 L64 51 M33 53 L36 53 M67 53 L64 53" stroke="${skD}" stroke-width=".6"/>`;
    // глаза
    const eyeY = 50;
    s += `<g><ellipse cx="41" cy="${eyeY}" rx="4.2" ry="2.6" fill="#fff"/><ellipse cx="59" cy="${eyeY}" rx="4.2" ry="2.6" fill="#fff"/>
<circle cx="41.5" cy="${eyeY}" r="2" fill="${pt.eyeC || '#3a2a1a'}"/><circle cx="59.5" cy="${eyeY}" r="2" fill="${pt.eyeC || '#3a2a1a'}"/>
<circle cx="42.2" cy="${eyeY - 0.7}" r=".6" fill="#fff"/><circle cx="60.2" cy="${eyeY - 0.7}" r=".6" fill="#fff"/></g>`;
    if (f) s += `<path d="M36.5 48.5 L35 47.5 M63.5 48.5 L65 47.5" stroke="#222" stroke-width=".8"/>`;
    // брови
    const bc = H === 'bald' ? shade(hc, 0.8) : hcD;
    s += `<path d="M36 ${eyeY - 5} Q41 ${eyeY - 7.5} 46 ${eyeY - 5.5}" stroke="${bc}" stroke-width="${f ? 1.2 : 2}" fill="none" stroke-linecap="round"/><path d="M54 ${eyeY - 5.5} Q59 ${eyeY - 7.5} 64 ${eyeY - 5}" stroke="${bc}" stroke-width="${f ? 1.2 : 2}" fill="none" stroke-linecap="round"/>`;
    // нос и рот
    s += `<path d="M50 52 L48 61 Q50 62.5 52.5 61.5" stroke="${skD}" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    s += `<path d="M44 67 Q50 ${pt.smile ? 71 : 69} 56 67" stroke="${pt.lips ? '#a8404a' : '#8a4a3a'}" stroke-width="${pt.lips ? 2.4 : 1.5}" fill="none" stroke-linecap="round"/>`;
    if (f) s += `<ellipse cx="38" cy="60" rx="3.5" ry="2" fill="#e88" opacity=".22"/><ellipse cx="62" cy="60" rx="3.5" ry="2" fill="#e88" opacity=".22"/>`;
    // борода
    const B = pt.beard;
    if (B === 'full') s += `<path d="M29 52 Q30 82 50 84 Q70 82 71 52 Q68 68 60 70 Q50 66 40 70 Q32 68 29 52Z" fill="${hc}"/><path d="M42 66 Q50 63 58 66 Q50 68.5 42 66Z" fill="${hcD}"/>`;
    if (B === 'stubble') s += `<path d="M31 58 Q32 80 50 82 Q68 80 69 58 Q66 72 50 74 Q34 72 31 58Z" fill="${hc}" opacity=".28"/>`;
    if (B === 'goatee') s += `<path d="M44 70 Q50 82 56 70 Q50 73 44 70Z" fill="${hc}"/><path d="M42 65.5 Q50 62.5 58 65.5 Q50 67 42 65.5Z" fill="${hc}"/>`;
    if (B === 'mustache') s += `<path d="M41 66 Q46 62 50 64 Q54 62 59 66 Q54 66 50 65.5 Q46 66 41 66Z" fill="${hc}"/>`;
    // волосы спереди
    if (H === 'short') s += `<path d="M29 46 Q28 22 50 22 Q72 22 71 46 Q68 32 58 31 Q48 34 38 31 Q31 34 29 46Z" fill="${hc}"/>`;
    if (H === 'buzz') s += `<path d="M30 42 Q30 24 50 24 Q70 24 70 42 Q64 30 50 30 Q36 30 30 42Z" fill="${hc}" opacity=".85"/>`;
    if (H === 'messy') s += `<path d="M28 48 Q24 22 46 19 Q54 14 62 20 Q76 22 72 48 Q70 34 64 32 L60 36 L56 30 L50 35 L46 29 L40 35 L36 31 Q30 36 28 48Z" fill="${hc}"/>`;
    if (H === 'slick') s += `<path d="M29 44 Q28 22 50 21 Q72 22 71 44 Q70 30 52 28 Q40 28 33 34 Q30 38 29 44Z" fill="${hc}"/><path d="M38 26 Q50 24 64 29" stroke="${shade(hc, 1.6)}" stroke-width=".8" fill="none"/>`;
    if (H === 'side') s += `<path d="M29 46 Q27 22 50 21 Q72 22 71 46 Q70 30 62 28 Q50 26 40 32 Q33 36 29 46Z" fill="${hc}"/>`;
    if (H === 'bald') s += `<path d="M29 50 Q28 40 32 38 L33 52Z M71 50 Q72 40 68 38 L67 52Z" fill="${hc}"/><ellipse cx="44" cy="32" rx="8" ry="3" fill="#fff" opacity=".15"/>`;
    if (H === 'long' || H === 'bob') s += `<path d="M29 48 Q28 20 50 19 Q72 20 71 48 Q66 30 50 30 Q40 30 34 38 Q31 42 29 48Z" fill="${hc}"/>`;
    if (H === 'ponytail' || H === 'bun') s += `<path d="M29 46 Q28 21 50 20 Q72 21 71 46 Q68 30 50 29 Q32 30 29 46Z" fill="${hc}"/>`;
    if (H === 'curly') s += `<g fill="${hc}">${[[34, 30], [42, 26], [50, 25], [58, 26], [66, 30]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}</g>`;
    if (H === 'beanie') s += `<path d="M27 42 Q27 14 50 14 Q73 14 73 42Z" fill="#2a4a6a"/><rect x="26" y="38" width="48" height="7" rx="3" fill="#1e3a56"/>`;
    // очки
    if (pt.glasses) s += `<g fill="rgba(200,220,255,.12)" stroke="#1a1a1a" stroke-width="1.3"><rect x="34" y="45" width="14" height="10" rx="3"/><rect x="52" y="45" width="14" height="10" rx="3"/><path d="M48 49 Q50 47.5 52 49" fill="none"/><path d="M34 49 L29 47 M66 49 L71 47" fill="none"/></g>`;
    if (opts.dead) s += `<rect width="100" height="120" fill="rgba(0,0,0,.35)"/><path d="M84 6 L94 6 L94 22 L84 22Z" fill="none"/><text x="50" y="116" font-size="7" text-anchor="middle" fill="#fff" font-family="Georgia" letter-spacing="1">† 16.11</text>`;
    s += '</svg>';
    return s;
  }

  // «Фотографии» для телефонов
  function photo(kind) {
    const W = 'viewBox="0 0 160 120" xmlns="http://www.w3.org/2000/svg" class="photo"';
    if (kind === 'uv') {
      let g = '';
      for (let i = 0; i < 22; i++) { const x = 25 + (i % 6) * 21 + (i % 2) * 4, y = 30 + Math.floor(i / 6) * 20; g += `<ellipse cx="${x}" cy="${y}" rx="6" ry="4.5" fill="#28305a" stroke="#4a5590" stroke-width=".8"/>`; }
      return `<svg ${W}><rect width="160" height="120" fill="#0d0820"/><radialGradient id="uvg"><stop offset="0" stop-color="#6a2ad0" stop-opacity=".55"/><stop offset="1" stop-color="#0d0820" stop-opacity="0"/></radialGradient><circle cx="80" cy="50" r="80" fill="url(#uvg)"/><rect x="15" y="18" width="130" height="90" rx="4" fill="none" stroke="#3a2a6a"/>${g}<text x="8" y="114" fill="#a080ff" font-size="7" font-family="monospace">UV 365nm</text></svg>`;
    }
    if (kind === 'cert') return `<svg ${W}><rect width="160" height="120" fill="#5a4a3a"/><g transform="rotate(-4 80 60)"><rect x="30" y="8" width="100" height="104" fill="#f6f1e4"/><text x="80" y="24" font-size="7" text-anchor="middle" font-family="Georgia" fill="#3a3020">СЕРТИФИКАТ</text><text x="80" y="33" font-size="5" text-anchor="middle" fill="#6a5a40">Уральские самоцветы · партия 17</text>${[44, 52, 60, 68, 76, 84].map(y => `<line x1="40" x2="${100 + (y % 3) * 8}" y1="${y}" y2="${y}" stroke="#bbb" stroke-width="1.5"/>`).join('')}<circle cx="110" cy="98" r="9" fill="none" stroke="#3a5aaa" stroke-width="1.5"/><text x="110" y="100" font-size="4" text-anchor="middle" fill="#3a5aaa">ПЕЧАТЬ</text></g></svg>`;
    if (kind === 'family') return `<svg ${W}><rect width="160" height="120" fill="#8ac0e8"/><rect y="70" width="160" height="50" fill="#5a9a4a"/><circle cx="130" cy="22" r="10" fill="#ffe680"/><path d="M10 70 L30 45 L50 70Z" fill="#7a4a3a"/>${[[70, '#5b4a3a'], [86, '#2d2d3a'], [102, '#1f1f22']].map(([x, c], i) => `<circle cx="${x}" cy="${62 - i}" r="6" fill="#e6b48e"/><rect x="${x - 6}" y="${68 - i}" width="12" height="22" rx="4" fill="${c}"/>`).join('')}</svg>`;
    if (kind === 'stones') {
      let g = '';
      for (let i = 0; i < 26; i++) { const x = 20 + ((i * 37) % 120), y = 25 + ((i * 53) % 75); g += `<path d="M${x} ${y - 5} L${x + 5} ${y} L${x} ${y + 5} L${x - 5} ${y}Z" fill="#2a5adf"/><path d="M${x} ${y - 5} L${x + 2} ${y} L${x} ${y + 5}Z" fill="#7aa8ff" opacity=".7"/>`; }
      return `<svg ${W}><rect width="160" height="120" fill="#0a0a0c"/><path d="M0 20 Q80 0 160 30 L160 120 L0 120Z" fill="#141418"/>${g}</svg>`;
    }
    return `<svg ${W}><rect width="160" height="120" fill="#333"/></svg>`;
  }
  root.Portrait = { portrait, photo };
})(window);
