/* ================= Colour themes =================
   One button switches the whole app's colours. Each theme sets the OKLCH hue and colourfulness of the main colour
   and of the accent (the stylesheet's :root reads them as --hp/--sp and --hy/--sy). Lightness never changes, so
   text keeps the same contrast in every theme. Colours drawn in code (the sky, the maps, card covers) go through
   tint(), which applies the same shift. */
const THEMES = [
  { id:'lilac',  n:'Lilac & Butter', hp:291, sp:1,   hy:92, sy:1 },
  { id:'ocean',  n:'Ocean & Coral',  hp:250, sp:.9,  hy:45, sy:.95 },
  { id:'lagoon', n:'Lagoon & Mango', hp:200, sp:.8,  hy:75, sy:1 },
  { id:'rose',   n:'Rose & Peach',   hp:358, sp:.8,  hy:62, sy:.85 },
  { id:'slate',  n:'Slate & Sand',   hp:262, sp:.32, hy:85, sy:.45 }
];
const THEME_BASE = THEMES[0];
let THEME = THEMES.find(x => x.id === store.get('theme')) || THEME_BASE;

/* ---------- sRGB ⇄ OKLCH ---------- */
const toLin = c => (c /= 255) <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4;
const toSrgb = c => 255 * (c <= .0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - .055);
function rgbToOklch([r, g, b]) {
  [r, g, b] = [r, g, b].map(toLin);
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const L = .2104542553 * l + .7936177850 * m - .0040720468 * s, A = 1.9779984951 * l - 2.4285922050 * m + .4505937099 * s, B = .0259040371 * l + .7827717662 * m - .8086757660 * s;
  return [L, Math.hypot(A, B), (Math.atan2(B, A) * 180 / Math.PI + 360) % 360];
}
function oklchToRgbRaw(L, C, H) {
  const a = C * Math.cos(H * Math.PI / 180), b = C * Math.sin(H * Math.PI / 180);
  const l = (L + .3963377774 * a + .2158037573 * b) ** 3, m = (L - .1055613458 * a - .0638541728 * b) ** 3, s = (L - .0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + .2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - .3413193965 * s, -.0041960863 * l - .7034186147 * m + 1.7076147010 * s];
}
// Out-of-gamut colours keep their lightness and hue and lose just enough colourfulness to fit.
function oklchToRgb(L, C, H) {
  const ok = c => oklchToRgbRaw(L, c, H).every(v => v >= -.0005 && v <= 1.0005);
  if (!ok(C)) { let lo = 0, hi = C; for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2; ok(mid) ? lo = mid : hi = mid; } C = lo; }
  return oklchToRgbRaw(L, C, H).map(v => Math.round(Math.min(255, Math.max(0, toSrgb(Math.min(1, Math.max(0, v)))))));
}

/* ---------- tint: a colour from the lilac design, in the current theme ---------- */
function colorFamily([r, g, b]) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255, l = (mx + mn) / 2, d = mx - mn;
  if (!d) return null;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = mx === r / 255 ? ((g - b) / 255 / d) % 6 : mx === g / 255 ? (b - r) / 255 / d + 2 : (r - g) / 255 / d + 4;
  h = (h * 60 + 360) % 360;
  return s >= .12 && h >= 215 && h <= 300 ? 'p' : s >= .35 && h >= 34 && h <= 62 ? 'y' : null;
}
function parseColor(c) {
  if (Array.isArray(c)) return [...c.slice(0, 3), c[3] ?? 1];
  c = String(c).trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) { const h = m[1].length === 3 ? [...m[1]].map(x => x + x).join('') : m[1]; return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)).concat(1); }
  m = c.match(/^rgba?\(([^)]+)\)$/i);
  if (m) { const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [v[0], v[1], v[2], v[3] ?? 1]; }
  m = c.match(/^oklch\(([^)]+)\)$/i);
  if (m) { const v = m[1].split(/[\s/]+/).filter(Boolean).map(x => x.endsWith('%') ? parseFloat(x) / 100 : Number(x)); return [...oklchToRgb(v[0], v[1], v[2]), v[3] ?? 1]; }
  return null;
}
const rgbStr = ([r, g, b, a = 1]) => a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${+a.toFixed(3)})`;
const tintCache = new Map();
function tint(c) {
  if (THEME === THEME_BASE) return Array.isArray(c) ? rgbStr(parseColor(c)) : c;
  const key = THEME.id + String(c);
  if (tintCache.has(key)) return tintCache.get(key);
  const v = parseColor(c), f = v && colorFamily(v);
  let out = Array.isArray(c) && v ? rgbStr(v) : c;
  if (f) {
    const [L, C, H] = rgbToOklch(v), shift = f === 'p' ? THEME.hp - THEME_BASE.hp : THEME.hy - THEME_BASE.hy;
    out = rgbStr([...oklchToRgb(L, C * (f === 'p' ? THEME.sp : THEME.sy), (H + shift + 360) % 360), v[3]]);
  }
  tintCache.set(key, out); return out;
}
// A CSS colour value (which may use the theme variables) as plain rgb(), for canvas drawing.
const colorProbe = document.createElement('i');
function cssColor(v) {
  if (!v) return v;
  colorProbe.style.color = ''; colorProbe.style.color = v;
  if (!colorProbe.style.color) return v;
  if (!colorProbe.isConnected) { colorProbe.hidden = true; document.body.appendChild(colorProbe); }
  const p = parseColor(getComputedStyle(colorProbe).color);
  return p ? rgbStr(p) : v;
}

/* ---------- applying a theme ---------- */
function applyTheme(t, quiet) {
  THEME = t; tintCache.clear();
  const r = document.documentElement;
  r.style.setProperty('--hp', t.hp); r.style.setProperty('--sp', t.sp); r.style.setProperty('--hy', t.hy); r.style.setProperty('--sy', t.sy);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tint('#FAF8FF'));
  r.dataset.theme = t.id; // the route map redraws itself when this changes
  if (quiet) return;
  store.set('theme', t.id);
  document.dispatchEvent(new CustomEvent('themechange'));
}
applyTheme(THEME, true);

/* ---------- the button and its picker ---------- */
const themeBtn = $('#themeBtn'), themePop = $('#themePop');
function tintFor(t, c) { const keep = THEME; THEME = t; tintCache.clear(); const v = tint(c); THEME = keep; tintCache.clear(); return v; }
function renderThemes() {
  themePop.innerHTML = `<p class="eyebrow">${t('Colour theme')}</p>` + THEMES.map(x => `<button type="button" role="radio" aria-checked="${x === THEME}" data-theme-id="${x.id}">
    <span class="tsw" aria-hidden="true"><i style="background:${tintFor(x, '#8B6CF0')}"></i><i style="background:${tintFor(x, '#FFD95A')}"></i></span><span>${t(x.n)}</span></button>`).join('');
}
function syncThemeBtn() { themeBtn.querySelector('.tsw').innerHTML = `<i style="background:${tint('#8B6CF0')}"></i><i style="background:${tint('#FFD95A')}"></i>`; themeBtn.setAttribute('aria-label', t('Colour theme: {n}', { n: t(THEME.n) })); }
function closeThemes(focus) { themePop.hidden = true; themeBtn.setAttribute('aria-expanded', 'false'); if (focus) themeBtn.focus(); }
themeBtn.addEventListener('click', () => {
  if (!themePop.hidden) { closeThemes(); return; }
  renderThemes(); themePop.hidden = false; themeBtn.setAttribute('aria-expanded', 'true');
  themePop.querySelector('[aria-checked="true"]')?.focus();
});
themePop.addEventListener('click', e => {
  const b = e.target.closest('[data-theme-id]'); if (!b) return;
  const tt = THEMES.find(x => x.id === b.dataset.themeId);
  document.documentElement.classList.add('theming');
  applyTheme(tt); syncThemeBtn(); renderThemes(); themePop.querySelector(`[data-theme-id="${tt.id}"]`)?.focus();
  setTimeout(() => document.documentElement.classList.remove('theming'), 450);
});
// Arrow keys move between themes, as in any radio group; Escape closes.
themePop.addEventListener('keydown', e => {
  const opts = [...themePop.querySelectorAll('[data-theme-id]')], i = opts.indexOf(document.activeElement);
  if (e.key === 'Escape') { e.preventDefault(); closeThemes(true); return; }
  if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key) && i >= 0) { e.preventDefault(); opts[(i + (/Down|Right/.test(e.key) ? 1 : -1) + opts.length) % opts.length].click(); }
});
document.addEventListener('click', e => { if (!themePop.hidden && !e.target.closest('#themePop, #themeBtn')) closeThemes(); });
syncThemeBtn();
document.addEventListener('langchange', syncThemeBtn);
