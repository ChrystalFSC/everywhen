/* ================= Type-or-speak translator =================
   1. Phrasebook first: verified phrases, works offline.
   2. Otherwise machine translation from MyMemory (free, no key) when online; results are cached for offline reuse.
   3. Voice input through the browser's speech recognition where available. */
const TR_LANGS = { 'en':['English','en-GB'], 'zh-CN':['中文','zh-CN'], 'vi':['Tiếng Việt','vi-VN'] };
let trDir = 'en|zh-CN', trTimer = 0, trSeq = 0, trLast = null;
const trCache = store.get('trcache', {});
const norm = s => s.toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set(['the','a','an','please','i','to','is','me','my','this','it','of','do','you','can']);
const toks = s => norm(s).split(' ').filter(w => w && !STOP.has(w));
function phrasebook(tgt) { const key = tgt === 'zh-CN' ? 'zh' : 'vi'; return PHRASES[key].groups.flatMap(g => g[1]).map(([en, lo, ro]) => ({ en, lo, ro, lang: key })); }
function matchPhrase(text, src, tgt) {
  const pool = src === 'en' ? phrasebook(tgt) : phrasebook(src);
  const q = src === 'en' ? toks(text) : null, qs = norm(text);
  return pool.map(p => {
    let sc;
    if (src === 'en') { const t = toks(p.en); const inter = t.filter(w => q.includes(w)).length; sc = inter / Math.max(1, new Set([...t, ...q]).size); }
    else { const lo = norm(p.lo); sc = lo === qs ? 1 : (lo.includes(qs) || qs.includes(lo)) ? .8 * Math.min(lo.length, qs.length) / Math.max(lo.length, qs.length) : 0; }
    return { ...p, sc };
  }).filter(p => p.sc > .25).sort((a, b) => b.sc - a.sc);
}
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
function trRender(state) {
  const out = $('#trOut'), [src, tgt] = trDir.split('|');
  if (state.kind === 'empty') {
    const ex = src === 'en' ? ['Where is the metro station?', 'How much is this?', 'Not spicy, please.', 'I lost my passport.'] : src === 'zh-CN' ? ['这个多少钱？', '请打表。', '洗手间在哪里？'] : ['Bao nhiêu tiền?', 'Nhà vệ sinh ở đâu?'];
    out.innerHTML = `<div class="tr-ex"><span class="eyebrow">Try</span>${ex.map(x => `<button class="pill" type="button" data-ex="${esc(x)}">${esc(x)}</button>`).join('')}</div>`;
    return;
  }
  if (state.kind === 'loading') { out.innerHTML = `<div class="tr-res loading"><span class="shimmer"></span><span class="shimmer short"></span><span class="status">Translating…</span></div>`; return; }
  if (state.kind === 'error') {
    out.innerHTML = `<p class="status err">${esc(state.msg)}</p>${state.sugg?.length ? `<div class="tr-ex"><span class="eyebrow">Closest phrases</span>${state.sugg.map((p, i) => `<button class="pill" type="button" data-sugg="${i}">${esc(src === 'en' ? p.en : p.lo)}</button>`).join('')}</div>` : ''}`;
    trLast = { sugg: state.sugg };
    return;
  }
  trLast = state;
  const tl = tgt === 'zh-CN' ? 'zh-CN' : tgt === 'vi' ? 'vi' : 'en';
  out.innerHTML = `<div class="tr-res">
    <div class="tr-badges">${state.verified ? '<span class="chip good">✓ Phrasebook · works offline</span>' : state.cached ? '<span class="chip">Saved translation</span>' : state.byClaude ? '<span class="chip good">Translated by Claude</span>' : '<span class="chip warn">Machine translation · check key details</span>'}</div>
    <div class="tr-text" lang="${tl}">${esc(state.text)}</div>
    ${state.ro ? `<div class="tr-ro">${esc(state.ro)}</div>` : ''}
    <div class="tr-acts">
      ${tgt !== 'en' ? '<button class="btn" type="button" id="trShow">Show full screen</button>' : ''}
      <button class="sbtn" type="button" id="trSpeak">Read aloud</button>
      <button class="sbtn" type="button" id="trCopy">Copy</button>
    </div>
    ${state.sugg?.length ? `<div class="tr-ex"><span class="eyebrow">Also in your phrasebook</span>${state.sugg.map((p, i) => `<button class="pill" type="button" data-sugg="${i}">${esc(src === 'en' ? p.en : p.lo)}</button>`).join('')}</div>` : ''}
  </div>`;
}
async function translateNow() {
  const text = $('#trText').value.trim(), [src, tgt] = trDir.split('|'), seq = ++trSeq;
  if (!text) { trRender({ kind:'empty' }); return; }
  const m = matchPhrase(text, src, tgt);
  if (m[0] && m[0].sc >= .75) {
    const p = m[0];
    trRender(src === 'en' ? { text: p.lo, ro: p.ro, verified: true, sugg: m.slice(1, 3) } : { text: p.en, verified: true, sugg: [] });
    return;
  }
  const key = trDir + '|' + norm(text);
  if (trCache[key]) { trRender({ text: trCache[key], cached: true, sugg: m.slice(0, 3) }); return; }
  if (navigator.onLine === false) { trRender({ kind:'error', msg:'You’re offline, so only phrasebook phrases can be translated. Pick the closest one below, or try again when you have signal.', sugg: m.slice(0, 4) }); return; }
  trRender({ kind:'loading' });
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 480))}&langpair=${encodeURIComponent(trDir)}`, { signal: ctl.signal });
    clearTimeout(to);
    const j = await res.json();
    if (seq !== trSeq) return;
    if (j.quotaFinished) throw new Error('quota');
    const out = decode(j.responseData?.translatedText || '');
    if (!out || j.responseStatus !== 200 || /MYMEMORY WARNING/i.test(out)) throw new Error('bad');
    trCache[key] = out; const keys = Object.keys(trCache); if (keys.length > 200) delete trCache[keys[0]]; store.set('trcache', trCache);
    trRender({ text: out, sugg: m.slice(0, 3) });
  } catch (e) {
    if (seq !== trSeq) return;
    if (sampleFn && e.message !== 'quota') {
      // On claude.ai the page cannot reach outside services, so Claude translates instead.
      try {
        trRender({ kind:'loading' });
        const names = { 'en':'English', 'zh-CN':'Simplified Chinese', 'vi':'Vietnamese' };
        const r = await sampleFn(`Translate this ${names[src]} text into natural, polite ${names[tgt]} that a traveller can show to a local person. Reply with only the translation, nothing else.

${text.slice(0, 480)}`, { modelTier:'quick' });
        if (seq !== trSeq) return;
        const out = r.text.trim();
        trCache[key] = out; store.set('trcache', trCache);
        trRender({ text: out, byClaude: true, sugg: m.slice(0, 3) });
        return;
      } catch {}
    }
    trRender({ kind:'error', msg: e.message === 'quota' ? 'The free translation limit for today has been reached. Phrasebook phrases still work.' : 'The translation service couldn’t be reached (it may be blocked on this network or page). Phrasebook phrases still work.', sugg: m.slice(0, 4) });
  }
}
function speakText(text, code, done) {
  if (!('speechSynthesis' in window)) { toast('This browser can’t read text aloud'); return; }
  const vs = speechSynthesis.getVoices(), lc = code.toLowerCase();
  const v = vs.find(x => x.lang.replace('_', '-').toLowerCase() === lc) || vs.find(x => x.lang.toLowerCase().startsWith(lc.slice(0, 2)));
  if (!v && vs.length) { toast('No voice for this language on this device'); return; }
  const u = new SpeechSynthesisUtterance(text); u.lang = code; if (v) u.voice = v; u.rate = .88; if (done) u.onend = done;
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
$('#trText').addEventListener('input', () => { clearTimeout(trTimer); trTimer = setTimeout(translateNow, 650); });
$('#trText').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); clearTimeout(trTimer); translateNow(); } });
bindSeg('#trDir', v => { trDir = v; const [src] = v.split('|'); $('#trText').placeholder = src === 'en' ? t('Type what you want to say…') : src === 'zh-CN' ? '输入或说出中文…' : 'Nhập hoặc nói tiếng Việt…'; $('#trText').lang = TR_LANGS[src][1]; translateNow(); });
$('#trOut').addEventListener('click', async e => {
  const ex = e.target.closest('[data-ex]'), sg = e.target.closest('[data-sugg]');
  if (ex) { $('#trText').value = ex.dataset.ex; translateNow(); return; }
  if (sg) { const p = trLast.sugg[+sg.dataset.sugg]; const [src] = trDir.split('|'); $('#trText').value = src === 'en' ? p.en : p.lo; translateNow(); return; }
  const [src, tgt] = trDir.split('|');
  if (e.target.id === 'trShow') openShow(trLast.text, trLast.ro || '', $('#trText').value.trim(), tgt === 'zh-CN' ? 'zh' : 'vi');
  if (e.target.id === 'trSpeak') speakText(trLast.text, TR_LANGS[tgt][1]);
  if (e.target.id === 'trCopy') { try { await navigator.clipboard.writeText(trLast.text); toast('Copied'); } catch { toast('Copy isn’t allowed here. Press and hold the text to copy it.'); } }
});
/* voice input */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SR) {
  const mic = $('#trMic'); mic.hidden = false;
  let rec = null;
  mic.addEventListener('click', () => {
    if (rec) { rec.stop(); return; }
    const [src] = trDir.split('|');
    rec = new SR(); rec.lang = TR_LANGS[src][1]; rec.interimResults = true; rec.continuous = false;
    mic.classList.add('on'); mic.setAttribute('aria-label', 'Stop listening');
    rec.onresult = e => { const r = [...e.results].map(x => x[0].transcript).join(' '); $('#trText').value = r; if (e.results[e.results.length - 1].isFinal) translateNow(); };
    rec.onerror = e => toast(e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access is blocked here. Allow it in your browser settings, or type instead.' : 'Couldn’t hear that. Try again, or type instead.');
    rec.onend = () => { rec = null; mic.classList.remove('on'); mic.setAttribute('aria-label', 'Speak instead of typing'); };
    try { rec.start(); } catch { rec = null; mic.classList.remove('on'); toast('Voice input isn’t available here. Type instead.'); }
  });
}
trRender({ kind:'empty' });
