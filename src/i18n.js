/* ================= Language: English / 简体中文 =================
   t(s, vars): looks up the English string s in ZH when Chinese is on, then fills {placeholders}.
   Static markup and exact-match dynamic text are translated by a DOM walker (and a MutationObserver
   while Chinese is on), so templates only need t() where they interpolate values. */
const ZH = __ZH__;
let LANG = (() => { const s = store.get('lang', null); return s === 'zh' || s === 'en' ? s : ((navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'); })();
const missing = new Set(); window.__i18nMissing = missing;
function t(s, v) {
  let o = s;
  if (LANG === 'zh') { if (ZH[s] != null) o = ZH[s]; else if (/[A-Za-z]{3}/.test(s)) missing.add(s); }
  if (v) o = o.replace(/\{(\w+)\}/g, (_, k) => v[k] ?? '');
  return o;
}
const I18N_ATTRS = ['placeholder', 'aria-label', 'title', 'alt', 'label'];
const originals = new Map();
function trText(n) {
  const raw = n.nodeValue, key = raw.trim();
  if (!key || !/[A-Za-z]/.test(key) || /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentNode?.nodeName)) return;
  const zh = ZH[key];
  if (zh == null) { if (/[A-Za-z]{3}/.test(key) && !/^[A-Z0-9 ·:→+–-]+$/.test(key)) missing.add(key); return; }
  if (!originals.has(n)) originals.set(n, raw);
  n.nodeValue = raw.replace(key, zh);
}
function trEl(el) {
  for (const a of I18N_ATTRS) {
    const v = el.getAttribute?.(a); if (!v || ZH[v] == null) continue;
    const k = el; const o = originals.get(k) || {}; if (!(a in o)) { o[a] = v; originals.set(k, o); }
    el.setAttribute(a, ZH[v]);
  }
}
function translateTree(root) {
  if (root.nodeType === 3) { trText(root); return; }
  if (root.nodeType !== 1 || /^(SCRIPT|STYLE|TEXTAREA|CANVAS)$/.test(root.tagName)) return;
  trEl(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement?.closest('script,style,textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  let n; while ((n = w.nextNode())) n.nodeType === 3 ? trText(n) : trEl(n);
}
const i18nObserver = new MutationObserver(ms => { for (const m of ms) { if (m.type === 'characterData') trText(m.target); else m.addedNodes.forEach(translateTree); } });
function i18nStart() {
  document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
  const b = $('#langBtn'); if (b) { b.textContent = LANG === 'zh' ? 'EN' : '中文'; b.setAttribute('aria-label', LANG === 'zh' ? 'Switch to English' : '切换到中文'); }
  if (LANG === 'zh') { translateTree(document.body); i18nObserver.observe(document.body, { childList: true, subtree: true, characterData: true }); }
}
function setLang(l) {
  if (l === LANG) return;
  i18nObserver.disconnect();
  if (l === 'en') originals.forEach((o, n) => { if (typeof o === 'string') { if (n.isConnected) n.nodeValue = o; } else Object.entries(o).forEach(([a, v]) => n.setAttribute(a, v)); });
  originals.clear();
  LANG = l; store.set('lang', l);
  for (const k in fmtCache) delete fmtCache[k];
  i18nStart();
  rerenderAll();
}
/* Locale-aware formatting helpers */
const LOCALE = () => LANG === "zh" ? "zh-CN" : "en-GB";
