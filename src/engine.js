/* ================= Experience engine: sky, split-flap board, motion ================= */

/* ---------- split-flap departure board ---------- */
const FLAP_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function flapSet(el, str, quick) {
  if (!el) return;
  str = String(str).toUpperCase();
  if (el.dataset.v === str) return;
  el.dataset.v = str;
  if (el.children.length !== str.length) el.innerHTML = [...str].map(() => '<span class="c"></span>').join('');
  [...str].forEach((ch, i) => {
    const c = el.children[i];
    c.classList.toggle('sep', ch === ':' || ch === ' ');
    if (c.textContent === ch) return;
    clearInterval(c._t);
    const settle = () => { c.textContent = ch; c.classList.remove('go'); void c.offsetWidth; c.classList.add('go'); };
    if (reduced) { c.textContent = ch; return; }
    if (quick || ch === ':' || ch === ' ') { settle(); return; }
    let n = 2 + (i % 3);
    c._t = setInterval(() => {
      if (n-- <= 0) { clearInterval(c._t); settle(); return; }
      c.textContent = FLAP_CHARS[(Math.random() * FLAP_CHARS.length) | 0];
      c.classList.remove('go'); void c.offsetWidth; c.classList.add('go');
    }, 55);
  });
}

/* ---------- living sky: colours follow the local time at the scrubbed moment ---------- */
const SKY = [ // hour, top, bottom, sun glow, night (0..1) — very light: lilac mornings and nights, butter-yellow sunrise and sunset
  [0,   '#E6DEFF', '#F6F2FF', 'rgba(200,180,255,0)',   .25],
  [4.5, '#EAE3FF', '#F8F4FF', 'rgba(255,230,150,0)',   .2],
  [6,   '#EFE8FF', '#FFF4D2', 'rgba(255,225,140,.4)',  0],
  [7.5, '#F2EDFF', '#FFF9E6', 'rgba(255,235,170,.3)',  0],
  [10,  '#F1ECFF', '#FFFDF7', 'rgba(255,255,255,.3)',  0],
  [15,  '#F0EAFF', '#FFFDF6', 'rgba(255,255,255,.3)',  0],
  [17.3,'#EDE5FF', '#FFF2CC', 'rgba(255,220,130,.4)',  0],
  [18.6,'#E8DFFF', '#FFEBBA', 'rgba(255,210,120,.35)', .05],
  [20,  '#E5DDFF', '#F5F0FF', 'rgba(210,190,255,.15)', .2],
  [24,  '#E6DEFF', '#F6F2FF', 'rgba(200,180,255,0)',   .25]
];
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgbaP = s => s.match(/[\d.]+/g).map(Number);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
let skyLast = '';
function applySky(t, tz) {
  const p = F(tz, { hour:'numeric', minute:'numeric', hourCycle:'h23' }).formatToParts(t);
  const h = +p.find(x => x.type === 'hour').value + +p.find(x => x.type === 'minute').value / 60;
  let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
  const [h0, t0, b0, g0, n0] = SKY[i], [h1, t1, b1, g1, n1] = SKY[i + 1], k = (h - h0) / (h1 - h0);
  const top = mix(hex(t0), hex(t1), k).map(Math.round), bot = mix(hex(b0), hex(b1), k).map(Math.round), glow = mix(rgbaP(g0), rgbaP(g1), k);
  const night = n0 + (n1 - n0) * k;
  const sunUp = h > 5.6 && h < 18.8, sp = (h - 6) / 12;
  const key = top + '|' + bot + '|' + night.toFixed(2);
  if (key === skyLast) return;
  skyLast = key;
  const r = document.documentElement.style;
  r.setProperty('--sky-top', `rgb(${top})`); r.setProperty('--sky-bot', `rgb(${bot})`);
  r.setProperty('--sun-glow', `rgba(${glow.slice(0, 3).map(Math.round)},${glow[3].toFixed(2)})`);
  r.setProperty('--night', night.toFixed(2));
  r.setProperty('--sun-x', `${Math.round(12 + Math.min(1, Math.max(0, sp)) * 76)}%`);
  r.setProperty('--sun-y', `${Math.round(8 + Math.pow(Math.abs(sp - .5) * 2, 2) * 34)}%`);
  const phase = h < 5 || h >= 20 ? ['Night', 'moon'] : h < 7.5 ? ['Sunrise', 'rise'] : h < 17 ? ['Daylight', 'sun'] : h < 19 ? ['Sunset', 'rise'] : ['Evening', 'moon'];
  const ic = { sun:'<circle cx="12" cy="12" r="4.5" fill="#FFD27A"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="#FFD27A" stroke-width="1.8" stroke-linecap="round"/>',
    moon:'<path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" fill="#DDE3FF"/>',
    rise:'<path d="M5 17a7 7 0 0 1 14 0" fill="#FFB36B"/><path d="M2.5 17h19M12 4v3M5.5 8.5l2 2M18.5 8.5l-2 2" stroke="#FFB36B" stroke-width="1.8" stroke-linecap="round"/>' }[phase[1]];
  const sm = $('#sunmoon'); if (sm) sm.innerHTML = `<svg viewBox="0 0 24 24" fill="none">${ic}</svg>${phase[0]}`;
  if (!sunUp) r.setProperty('--sun-x', '78%');
}

/* ---------- star field ---------- */
function paintStars() {
  const c = $('#stars'); if (!c) return;
  const w = innerWidth, h = innerHeight, pr = Math.min(devicePixelRatio || 1, 2);
  c.width = w * pr; c.height = h * pr;
  const g = c.getContext('2d'); g.scale(pr, pr);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const n = Math.round(w * h / 5200);
  for (let i = 0; i < n; i++) {
    const x = rnd() * w, y = Math.pow(rnd(), 1.6) * h * .85, r = rnd() * 1.1 + .25;
    g.fillStyle = `rgba(${rnd() > .8 ? '255,236,246' : '255,255,255'},${(rnd() * .6 + .3).toFixed(2)})`;
    g.beginPath(); g.arc(x, y, r, 0, 6.2832); g.fill();
  }
  const sky = $('#sky');
  $$('.twinkle', sky).forEach(e => e.remove());
  for (let i = 0; i < 16; i++) {
    const e = document.createElement('i'); e.className = 'twinkle';
    e.style.left = (rnd() * 100).toFixed(1) + '%'; e.style.top = (Math.pow(rnd(), 1.4) * 60).toFixed(1) + '%';
    e.style.animationDelay = (-rnd() * 3.2).toFixed(2) + 's'; e.style.animationDuration = (2.4 + rnd() * 2.4).toFixed(2) + 's';
    sky.appendChild(e);
  }
}

/* ---------- boarding-pass barcode ---------- */
function barcode(str) {
  let h = 2166136261; const bars = []; let x = 0;
  for (let i = 0; x < 100; i++) {
    h = Math.imul(h ^ str.charCodeAt(i % str.length) ^ i, 16777619) >>> 0;
    const w = 0.6 + (h % 4) * 0.55, gap = 0.7 + ((h >> 3) % 3) * 0.6;
    bars.push(`rgba(91,63,196,.7) ${x.toFixed(1)}% ${(x + w).toFixed(1)}%`, `transparent ${(x + w).toFixed(1)}% ${(x + w + gap).toFixed(1)}%`);
    x += w + gap;
  }
  return `linear-gradient(90deg,${bars.join(',')})`;
}

/* ---------- pass tilt + sheen ---------- */
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  $('#journey').addEventListener('pointermove', e => {
    const p = e.target.closest('.pass'); if (!p || reduced) return;
    const r = p.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    p.style.setProperty('--mx', (x * 100).toFixed(1) + '%'); p.style.setProperty('--my', (y * 100).toFixed(1) + '%');
    p.style.transform = `perspective(900px) rotateX(${((.5 - y) * 6).toFixed(2)}deg) rotateY(${((x - .5) * 7).toFixed(2)}deg) translateY(-2px)`;
  });
  $('#journey').addEventListener('pointerout', e => { const p = e.target.closest('.pass'); if (p && !p.contains(e.relatedTarget)) p.style.transform = ''; });
}

/* ---------- number count-up ---------- */

let lastShown = 0;
function countUp(host) {
  const el = $('.num', host); if (!el) return;
  const to = +el.dataset.v, dec = +el.dataset.d, from = lastShown, fmt = dec ? nf2 : nf0;
  lastShown = to;
  if (reduced || !isFinite(from) || from === to) return;
  const t0 = performance.now(), dur = 520;
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt.format(dec ? from + (to - from) * e : Math.round(from + (to - from) * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- toast ---------- */
let toastT = 0;
function toast(msg) {
  const t = $('#toast');
  t.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>${esc(msg)}`;
  t.hidden = false; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- confetti ---------- */
function confetti() {
  if (reduced) return;
  const c = $('#fx'), g = c.getContext('2d'), pr = Math.min(devicePixelRatio || 1, 2);
  c.width = innerWidth * pr; c.height = innerHeight * pr; g.setTransform(pr, 0, 0, pr, 0, 0);
  const cols = ['#8B6CF0', '#FFD95A', '#B9A5FF', '#FFE58A', '#E8B21A'];
  const P = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight * .55, vx: (Math.random() - .5) * 14, vy: -Math.random() * 15 - 5, r: Math.random() * 6.28, vr: (Math.random() - .5) * .4, w: 5 + Math.random() * 6, c: cols[(Math.random() * cols.length) | 0] }));
  const t0 = performance.now();
  const step = now => {
    const k = (now - t0) / 1800;
    g.clearRect(0, 0, innerWidth, innerHeight);
    P.forEach(p => { p.vy += .42; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.globalAlpha = Math.max(0, 1 - k); g.fillStyle = p.c; g.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2); g.restore(); });
    if (k < 1) requestAnimationFrame(step); else g.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(step);
}

/* ---------- tab indicator ---------- */
function moveInd() {
  const ind = $('#tabInd'), on = $('.tab[aria-selected="true"]'); if (!ind || !on) return;
  ind.style.width = on.offsetWidth + 'px';
  ind.style.transform = `translateX(${on.offsetLeft}px)`;
  ind.style.top = on.offsetTop + 'px'; ind.style.height = on.offsetHeight + 'px';
}

/* ---------- weather scene ---------- */
const scene = { kind: 'rain', raf: 0, drops: [], t0: 0 };
const SCENE_BG = { rain: ['#F1EDFF', '#DCD3FA'], sun: ['#FFF3C4', '#EFE8FF'], cloud: ['#F4F1FF', '#E2DBF8'], storm: ['#E4DDF9', '#CBC0F0'], fog: ['#F6F4FF', '#E6E1F8'], snow: ['#FAF9FF', '#E8E3FA'] };
function setScene(code) {
  scene.kind = wKind(code);
  const [a, b] = SCENE_BG[scene.kind] || SCENE_BG.cloud, w = $('#wxHeroWrap');
  if (w) { w.style.setProperty('--w1', a); w.style.setProperty('--w2', b); }
  drawScene(performance.now());
}
function drawScene(now) {
  const c = $('#wxScene'); if (!c || !c.offsetWidth) return;
  const pr = Math.min(devicePixelRatio || 1, 2), w = c.offsetWidth, h = c.offsetHeight;
  if (c.width !== Math.round(w * pr) || c.height !== Math.round(h * pr)) { c.width = Math.round(w * pr); c.height = Math.round(h * pr); scene.drops = []; }
  const g = c.getContext('2d'); g.setTransform(pr, 0, 0, pr, 0, 0); g.clearRect(0, 0, w, h);
  const t = now / 1000, k = scene.kind;
  if (k === 'sun') {
    const cx = w * .82, cy = h * .2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832 + t * .08; g.strokeStyle = 'rgba(255,201,60,.28)'; g.lineWidth = 14; g.beginPath(); g.moveTo(cx + Math.cos(a) * 70, cy + Math.sin(a) * 70); g.lineTo(cx + Math.cos(a) * 240, cy + Math.sin(a) * 240); g.stroke(); }
    const sg = g.createRadialGradient(cx, cy, 0, cx, cy, 90); sg.addColorStop(0, 'rgba(255,240,190,1)'); sg.addColorStop(.35, 'rgba(255,200,110,.85)'); sg.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = sg; g.beginPath(); g.arc(cx, cy, 90, 0, 6.2832); g.fill();
  }
  if (k === 'cloud' || k === 'rain' || k === 'storm' || k === 'fog' || k === 'snow') {
    for (let i = 0; i < 5; i++) {
      const x = ((i * 173 + t * (8 + i * 3)) % (w + 300)) - 150, y = 30 + i * 26;
      g.fillStyle = `rgba(255,255,255,${k === 'fog' ? .5 : .38})`;
      [[0, 0, 60], [50, -18, 46], [96, 4, 52], [40, 16, 50]].forEach(([dx, dy, r]) => { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 6.2832); g.fill(); });
    }
  }
  if (k === 'rain' || k === 'storm' || k === 'snow') {
    if (!scene.drops.length) scene.drops = Array.from({ length: Math.round(w / 5) }, () => ({ x: Math.random() * w, y: Math.random() * h, v: 6 + Math.random() * 6, l: 10 + Math.random() * 12 }));
    g.strokeStyle = k === 'snow' ? 'rgba(255,255,255,.95)' : 'rgba(84,62,168,.38)'; g.lineWidth = k === 'snow' ? 2.4 : 1.2; g.lineCap = 'round';
    g.beginPath();
    scene.drops.forEach(d => { d.y += reduced ? 0 : d.v * (k === 'snow' ? .2 : 1); d.x -= reduced ? 0 : d.v * .18; if (d.y > h) { d.y = -d.l; d.x = Math.random() * (w + 40); } g.moveTo(d.x, d.y); g.lineTo(d.x - d.l * .18, d.y + (k === 'snow' ? .1 : d.l)); });
    g.stroke();
  }
  if (k === 'storm' && !reduced && (t % 5) < .12) { g.fillStyle = 'rgba(255,255,255,.45)'; g.fillRect(0, 0, w, h); }
}
function startScene() {
  if (scene.raf || reduced) { drawScene(performance.now()); return; }
  const loopS = now => { if ($('#panel-weather').hidden || document.hidden) { scene.raf = 0; return; } drawScene(now); scene.raf = requestAnimationFrame(loopS); };
  scene.raf = requestAnimationFrame(loopS);
}
function stopScene() { if (scene.raf) cancelAnimationFrame(scene.raf); scene.raf = 0; }

addEventListener('resize', () => { paintStars(); moveInd(); });
