/* ================= Move to another device =================
   Everything you entered (plan, hotels, your own places, notes, checklist, rates, language) packed into one link,
   QR code or file. Nothing is uploaded: the data travels inside the link's #fragment, which browsers never send to
   the server. Importing always asks first, and replaces this device's data only when you confirm. */
// Links point to the published app, or to wherever it is being served from while developing.
const XFER_URL = /\.github\.io$|^localhost$|^127\.0\.0\.1$/.test(location.hostname) ? location.origin + location.pathname.replace(/index\.html$/, '') : 'https://chrystalfsc.github.io/everywhen/';
const b64u = bytes => { let s = ''; bytes.forEach(b => s += String.fromCharCode(b)); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = s => { const t = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)); return Uint8Array.from(t, c => c.charCodeAt(0)); };
async function pipe(bytes, stream) { return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer()); }
// Everything saved, for every trip: trips, the open trip, and each trip's plan, stays, notes and so on.
// Caches that the app can rebuild (forecasts, translations, last year's weather) stay behind.
const XFER_SKIP = /(^|:)(wx|clim|trcache|tab)$|^guide:/;
function xferData() {
  const data = {};
  try { Object.keys(localStorage).filter(k => k.startsWith('everywhen:')).map(k => k.slice(10)).filter(k => !XFER_SKIP.test(k)).forEach(k => { const v = store.get(k, undefined); if (v !== undefined) data[k] = v; }); } catch {}
  if (PRE) data.stays = myStays; // includes the built-in Mido booking, which is only saved once a stay is edited
  return { app: 'everywhen', v: 1, at: Date.now(), data };
}
// "E1c." + deflated JSON, or "E1u." + plain JSON where the browser can't compress
async function xferEncode(obj) {
  const raw = new TextEncoder().encode(JSON.stringify(obj));
  if (typeof CompressionStream === 'function') { try { return 'E1c.' + b64u(await pipe(raw, new CompressionStream('deflate-raw'))); } catch {} }
  return 'E1u.' + b64u(raw);
}
async function xferDecode(text) {
  const s = String(text || '').trim();
  if (s.startsWith('{')) return JSON.parse(s);
  const m = s.match(/E1([cu])\.([A-Za-z0-9_-]+)/); if (!m) throw new Error('format');
  let bytes = unb64u(m[2]);
  if (m[1] === 'c') { if (typeof DecompressionStream !== 'function') throw new Error('old'); bytes = await pipe(bytes, new DecompressionStream('deflate-raw')); }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function xferSummary(data) {
  const each = k => Object.entries(data).filter(([key]) => key === k || key.endsWith(':' + k)).map(([, v]) => v);
  const plans = each('plan2'), stops = plans.reduce((a, p) => a + Object.values(p?.items || {}).flat().length, 0), own = plans.reduce((a, p) => a + Object.keys(p?.custom || {}).length, 0);
  const hotels = each('stays').reduce((a, v) => a + (v || []).length, 0), notes = each('notes').reduce((a, v) => a + Object.keys(v || {}).length, 0) + plans.reduce((a, p) => a + Object.values(p?.custom || {}).filter(x => x.note).length, 0);
  const done = each('prep').reduce((a, v) => a + (v || []).length, 0), trips = (data.trips || []).length;
  return [
    trips && t(trips === 1 ? '1 trip of your own' : '{n} trips of your own', { n: trips }),
    t(hotels === 1 ? '1 stay' : '{n} stays', { n: hotels }), t(stops === 1 ? '1 plan stop' : '{n} plan stops', { n: stops }),
    own && t(own === 1 ? '1 place of your own' : '{n} places of your own', { n: own }), notes && t(notes === 1 ? '1 note' : '{n} notes', { n: notes }),
    done && t('{n} checklist items done', { n: done })
  ].filter(Boolean).join(' · ');
}
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/* ---------- dialog ---------- */
const xferDlg = $('#xferDlg'); let xferLink = '', xferCode = '', incoming = null;
function qrSvg(text) {
  if (typeof qrcode !== 'function') return '';
  const q = qrcode(0, 'L'); q.addData(text, 'Byte'); q.make();
  const n = q.getModuleCount(), m = 2; let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + m * 2} ${n + m * 2}" role="img" aria-label="${t('QR code with your trip data')}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#2E2455"/></svg>`;
}
async function openXfer(preset) {
  incoming = null; $('#xferPreview').innerHTML = ''; $('#xferIn').value = preset || '';
  const obj = xferData(); xferCode = await xferEncode(obj); xferLink = XFER_URL + '#import=' + xferCode;
  $('#xferSum').textContent = t('On this device: {list}', { list: xferSummary(obj.data) || t('nothing yet') });
  // QR codes hold about 2,900 characters; past ~1,800 they get too dense for a phone camera to read off a screen.
  const fits = xferLink.length <= 1800;
  $('#xferQR').innerHTML = fits ? qrSvg(xferLink) : '';
  $('#xferQR').hidden = !fits;
  $('#xferQRNote').textContent = fits ? t('Scan this with your iPhone camera, or use Copy link and send it to yourself.') : t('Your trip is too big for one QR code. Use Copy link and send it to yourself (WhatsApp, Telegram or email), or Save as file.');
  $('#xferShare').hidden = !navigator.share;
  // Arriving from a link, the question is only whether to import: hide the sending half.
  $('#xferSend').hidden = !!preset; $('#xferT').textContent = t(preset ? 'Import trip data' : 'Move to another device');
  if (xferDlg.showModal) xferDlg.showModal(); else xferDlg.setAttribute('open', '');
  if (preset) previewIncoming(preset);
}
const closeXfer = () => { if (xferDlg.close) xferDlg.close(); else xferDlg.removeAttribute('open'); };
async function previewIncoming(text) {
  const host = $('#xferPreview');
  try {
    const obj = typeof text === 'string' ? await xferDecode(text) : text;
    if (obj?.app !== 'everywhen' || !obj.data) throw new Error('format');
    incoming = obj;
    const when = new Date(obj.at).toLocaleString(LOCALE(), { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
    const mine = xferSummary(xferData().data);
    const iosTip = isIOS() && !isStandalone() ? `<p class="xfer-tip">${t('On iPhone, the home-screen app keeps its own data, separate from Safari. To load this into the home-screen app instead, tap Copy code, open Everywhen from your home screen, choose Move to another device, and paste it there.')}</p><button class="sbtn" type="button" id="xferCopyCode">${t('Copy code')}</button>` : '';
    host.innerHTML = `<div class="xfer-in">
      <b>${t('Trip data saved {when}', { when: esc(when) })}</b>
      <p>${esc(xferSummary(obj.data) || t('No trip data in it.'))}</p>
      <p class="xfer-warn">${t('Importing replaces what’s on this device now:')} ${esc(mine || t('nothing yet'))}</p>
      <div class="acts"><button class="btn" type="button" id="xferApply">${t('Replace my data')}</button><button class="btn ghost" type="button" id="xferDiscard">${t('Cancel')}</button></div>
      ${iosTip}
    </div>`;
  } catch (e) {
    incoming = null;
    host.innerHTML = `<p class="form-err">${t(e.message === 'old' ? 'This browser is too old to read compressed trip data. Update iOS or use Save as file instead.' : 'That isn’t an Everywhen link or code. Copy the whole link and try again.')}</p>`;
  }
}
function applyIncoming() {
  if (!incoming) return;
  try { Object.keys(localStorage).filter(k => k.startsWith('everywhen:') && !XFER_SKIP.test(k.slice(10))).forEach(k => localStorage.removeItem(k)); } catch {}
  Object.entries(incoming.data).forEach(([k, v]) => { if (/^(t:[\w-]+:)?[\w:-]+$/.test(k) && !XFER_SKIP.test(k)) store.set(k, v); });
  try { sessionStorage.setItem('everywhen:imported', '1'); } catch {}
  history.replaceState(null, '', location.pathname + '#trip'); location.reload();
}
async function copyText(s, ok) {
  try { await navigator.clipboard.writeText(s); toast(ok); }
  catch { $('#xferIn').value = s; $('#xferIn').select(); toast(t('Copy didn’t work here. The text is selected below; copy it yourself.')); }
}
$('#xferCopy').addEventListener('click', () => copyText(xferLink, t('Link copied. Send it to yourself and open it on your phone.')));
$('#xferShare').addEventListener('click', async () => { try { await navigator.share({ title: 'Everywhen trip', text: t('My Everywhen trip data'), url: xferLink }); } catch {} });
$('#xferFile').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(xferData(), null, 1)], { type: 'application/json' }), a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `everywhen-trip-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(t('Saved. Open the file in Everywhen on the other device with Open a file.'));
});
$('#xferLoad').addEventListener('click', () => { const v = $('#xferIn').value.trim(); if (!v) { $('#xferIn').focus(); return; } previewIncoming(v); });
$('#xferFileIn').addEventListener('change', async e => { const f = e.target.files?.[0]; if (!f) return; try { previewIncoming(JSON.parse(await f.text())); } catch { previewIncoming('x'); } e.target.value = ''; });
$('#xferPreview').addEventListener('click', e => {
  if (e.target.closest('#xferApply')) applyIncoming();
  if (e.target.closest('#xferDiscard')) { incoming = null; $('#xferPreview').innerHTML = ''; }
  if (e.target.closest('#xferCopyCode')) copyText(xferCode, t('Code copied. Open Everywhen from your home screen and paste it in Move to another device.'));
});
$('#xferClose').addEventListener('click', closeXfer);
document.addEventListener('click', e => { if (e.target.closest('[data-xfer]')) openXfer(); });
// Opened from a transfer link: show what it contains and ask before replacing anything.
// Read the link now: the tab router replaces the #fragment with #trip as the app starts.
const IMPORT_HASH = location.hash;
function checkImportLink() {
  const m = IMPORT_HASH.match(/^#import=(.+)$/);
  if (m) { history.replaceState(null, '', location.pathname + '#trip'); openXfer(m[1]); }
  try { if (sessionStorage.getItem('everywhen:imported')) { sessionStorage.removeItem('everywhen:imported'); toast(t('Trip data imported.')); } } catch {}
}
