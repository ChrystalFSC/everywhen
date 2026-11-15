/* ================= On the trip: today, near me, drag to reorder, sharing, calendar, spending, install, offline check =================
   Everything here reads the trip and plan that the modules above keep; nothing is sent anywhere. */
const stopName = it => it.custom ? it.n : nameOf(it);

/* ---------- Today: what's on now, while the trip is under way ---------- */
let todayHtml = '', planScrolled = false;
function renderToday() {
  const host = $('#todayCard'); if (!host) return;
  const now = liveNow();
  if (now == null) { host.hidden = true; todayHtml = ''; return; }
  const s = segAtTime(now), air = s.kind === 'air', C = CITY[air ? LEGS[s.leg].to : s.city], tz = C.tz, d = eday(now, tz);
  const x = dayOf(d), nowH = (now - dayAt(d, tz, 0)) / H, next = LEGS.find(l => l.dep > now);
  let lead;
  if (air) lead = t('In the air to {city}. You land at {time} local time, in {d}.', { city: t(C.city), time: hm(LEGS[s.leg].arr, tz), d: dur(LEGS[s.leg].arr - now) });
  else if (next && next.dep - now < 26 * H) {
    const A = CITY[next.from], intl = A.cc !== CITY[next.to].cc;
    lead = t('{no} to {city} leaves {time}, in {d}.', { no: next.no, city: t(CITY[next.to].city), time: hm(next.dep, A.tz), d: dur(next.dep - now) }) + ' ' + t('Be at the airport by {time}.', { time: hm(next.dep - (intl ? 150 : 90) * M, A.tz) });
  } else if (next) lead = t('{no} to {city} leaves {day} {time}, in {d}.', { no: next.no, city: t(CITY[next.to].city), day: day(next.dep, CITY[next.from].tz), time: hm(next.dep, CITY[next.from].tz), d: dur(next.dep - now) });
  else lead = t('Your trip ends here.');
  const sch = x ? daySchedule(x) : [], ids = x ? plan.items[d] || [] : [];
  const nextI = sch.findIndex(r => r && r.end > nowH);
  const stops = ids.map((id, i) => { const it = getItem(id), r = sch[i]; if (!it || !r) return '';
    const state = nextI < 0 || i < nextI ? 'past' : i === nextI ? 'next' : '';
    return `<li class="${state}"><span class="mono">${hhmm(r.start)}</span><span class="tn">${esc(stopName(it))}${r.warn ? `<small class="tw">${esc(r.warn)}</small>` : ''}</span>${state === 'next' ? `<span class="chip gold">${t(r.start <= nowH ? 'Now' : 'Next')}</span>` : ''}</li>`; }).join('');
  const n = NIGHTS.find(n => n.d === d), st = n?.stay;
  const night = !n ? '' : st ? `<div class="today-night"><span class="eyebrow">${t('Tonight')}</span><b>${esc(st.name)}</b><div class="acts">${st.addr ? `<button class="sbtn primary" type="button" data-stay-show="${esc(st.id)}">${t('Show to driver')}</button>` : `<button class="sbtn" type="button" data-stay-edit="${esc(st.id)}">${t('Add the address')}</button>`}<a class="sbtn" href="${stayMap(st)}" target="_blank" rel="noopener">${t(ccOfKey(st.city) === 'CN' ? 'Open in Amap' : 'Open in Google Maps')}</a></div></div>`
    : n.kind === 'open' ? `<div class="today-night"><span class="eyebrow">${t('Tonight')}</span><b class="warn">${t('No hotel booked for tonight.')}</b><div class="acts"><button class="sbtn" type="button" data-stay-add="${n.d}">${t('Add a stay')}</button></div></div>`
    : `<div class="today-night"><span class="eyebrow">${t('Tonight')}</span><b>${esc(t(n.note))}</b></div>`;
  const key = x?.cities?.at(-1) || ckey(C.code), w = dayWx(key, d);
  const html = `<div class="today-top"><div><span class="eyebrow">${t('Today')} · ${esc(day(now, tz))}</span><h2>${esc(t(C.city))}</h2></div>${w.hi === '–' ? '' : `<span class="wchip" title="${esc(w.label)}">${wIcon(w.code)}${w.hi}° / ${w.lo}°${w.live && w.p >= 40 ? ` · ${w.p}%` : ''}</span>`}</div>
    <p class="today-lead">${esc(lead)}</p>
    ${stops ? `<ol class="today-stops">${stops}</ol>` : `<p class="hint">${t(air ? 'Your plan picks up when you land.' : 'Nothing planned today.')}</p>`}
    ${night}
    ${x ? `<div class="acts"><button class="sbtn" type="button" data-today-plan>${t('Open today’s plan')}</button></div>` : ''}`;
  host.hidden = false;
  if (html !== todayHtml) { todayHtml = html; host.innerHTML = html; }
}
function scrollToToday(force) {
  if (planScrolled && !force) return;
  const d = todayD(), el = d && $('#day-' + d); if (!el) return;
  planScrolled = true;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' }));
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-today-plan]')) { selectTab('plan'); scrollToToday(true); return; }
  if (e.target.closest('#countdown') && liveNow() != null) { selectTab('trip'); requestAnimationFrame(() => $('#todayCard').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' })); }
});

/* ---------- Near me: your position on the maps, and distances from it ---------- */
let locating = null;
// Finds where you are. Resolves true when that is within reach of the city (key k), so distances mean something.
function locateMe(k = xCity) {
  if (!navigator.geolocation) { toast(t('This device can’t share its location.')); return Promise.resolve(false); }
  if (locating) return locating;
  toast(t('Finding where you are…'));
  return locating = new Promise(res => navigator.geolocation.getCurrentPosition(p => {
    locating = null;
    const ll = [+p.coords.latitude.toFixed(5), +p.coords.longitude.toFixed(5)], c = centreOf(k), far = km(ll, [c[0], c[1]]);
    if (far > 150) { myLL = null; toast(t('You’re about {km} from {city}. Near me works once you’re there.', { km: fmtKm(far), city: cityName(k) })); res(false); return; }
    myLL = ll; toast(t('Showing distances from where you are.')); res(true);
  }, err => {
    locating = null;
    toast(t(err.code === 1 ? 'Location is switched off for Everywhen. Allow it in your browser’s site settings.' : 'Couldn’t find where you are. Try again outdoors.'));
    res(false);
  }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }));
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-locate]'); if (!b) return;
  const legs = b.closest('.legs');
  if (legs) { // on a day's map
    const d = +legs.id.slice(3), k = plan.base[d] || dayOf(d).cities.at(-1);
    if (await locateMe(k)) { drawDayMap(d); try { dayMaps[d].panTo(myLL); } catch {} }
    return;
  }
  if (await locateMe(xCity)) { renderExplore(); try { xMap.setView(myLL, Math.max(xMap.getZoom(), 14)); } catch {} }
  else if (xF.near) { xF.near = false; syncFilters(); renderExplore(); }
});

/* ---------- drag a stop by its handle: within a day, or to another day ---------- */
let drag = null;
function dragTarget(y) {
  const cards = $$('#days .dayc');
  const card = cards.find(c => { const r = c.getBoundingClientRect(); return y >= r.top && y <= r.bottom; }) || (cards.length && y < cards[0].getBoundingClientRect().top ? cards[0] : cards.at(-1));
  if (!card) return null;
  const items = $$('.item', card).filter(el => el !== drag.item);
  return { card, items, d: +card.id.slice(4), i: items.filter(el => { const r = el.getBoundingClientRect(); return r.top + r.height / 2 < y; }).length };
}
function dragMove() {
  if (!drag) return;
  drag.item.style.transform = `translateY(${drag.y - drag.y0 + scrollY - drag.sy}px)`;
  const tg = dragTarget(drag.y); if (!tg) return;
  drag.to = { d: tg.d, i: tg.i };
  const body = $('.day-b', tg.card), ref = tg.items[tg.i], last = tg.items.at(-1), add = $('.addrow', tg.card);
  if (drag.line.parentNode !== body) body.appendChild(drag.line);
  drag.line.style.top = (ref ? ref.offsetTop - 4 : last ? last.offsetTop + last.offsetHeight + 3 : add.offsetTop - 4) + 'px';
}
function dragLoop() {
  if (!drag) return;
  const edge = drag.y < 90 ? -1 : drag.y > innerHeight - 130 ? 1 : 0;
  if (edge) { scrollBy(0, edge * 12); dragMove(); }
  requestAnimationFrame(dragLoop);
}
function dragEnd(commit) {
  if (!drag) return;
  const { item, d, i, to, line } = drag; drag = null;
  item.classList.remove('dragging'); item.style.transform = ''; line.remove(); document.body.classList.remove('dragging-stop');
  if (!commit || !to || (to.d === d && to.i === i)) return;
  const snap = planSnap(), id = plan.items[d].splice(i, 1)[0];
  if (to.d !== d && plan.items[to.d].includes(id)) { planRestore(snap); toast(t('That stop is already on {day}', { day: dayLabel(to.d) })); return; }
  plan.items[to.d].splice(to.i, 0, id); savePlan(); renderDays(); renderExplore();
  if (to.d !== d) undoToast(t('Moved to {day}', { day: dayLabel(to.d) }), () => planRestore(snap));
}
$('#days').addEventListener('pointerdown', e => {
  const g = e.target.closest('[data-grip]'); if (!g || (e.pointerType === 'mouse' && e.button)) return;
  const item = g.closest('.item'); e.preventDefault();
  drag = { item, d: +item.dataset.d, i: +item.dataset.i, y0: e.clientY, y: e.clientY, sy: scrollY, id: e.pointerId, to: null, line: Object.assign(document.createElement('div'), { className: 'dropline' }) };
  try { g.setPointerCapture(e.pointerId); } catch {}
  item.classList.add('dragging'); document.body.classList.add('dragging-stop');
  requestAnimationFrame(dragLoop);
});
$('#days').addEventListener('pointermove', e => { if (drag && e.pointerId === drag.id) { drag.y = e.clientY; dragMove(); } });
$('#days').addEventListener('pointerup', e => { if (drag && e.pointerId === drag.id) dragEnd(true); });
$('#days').addEventListener('pointercancel', e => { if (drag && e.pointerId === drag.id) dragEnd(false); });

/* ---------- the itinerary as plain text: to share a day or the whole trip, or to print ---------- */
const stopLine = (it, r) => `${r ? hhmm(r.start) : '--:--'}  ${stopName(it)}${LANG !== 'zh' && !it.custom && it.l && it.l !== it.n ? ` (${it.l})` : ''}`;
function dayRows(x) { const sch = daySchedule(x); return (plan.items[x.d] || []).map((id, i) => { const it = getItem(id); return it ? stopLine(it, sch[i]) : ''; }).filter(Boolean); }
const nightLine = d => { const n = NIGHTS.find(n => n.d === d); return !n ? '' : n.stay ? t('Night: {n}', { n: n.stay.name }) + (n.stay.addr ? ' · ' + n.stay.addr : '') : n.kind === 'open' ? t('Night: not booked') : n.kind === 'flight' ? t('Night: on a flight') : t('Night: transfer'); };
const dayHead = x => `${dayLabel(x.d)} · ${x.cities.map(cityName).join(' → ')}`;
const flightLine = L => { const A = CITY[L.from], B = CITY[L.to]; return `${L.no || t('Flight')} · ${day(L.dep, A.tz)} · ${A.code} ${hm(L.dep, A.tz)} → ${B.code} ${hm(L.arr, B.tz)}`; };
const stayLine = x => `${dayShort(x.from)} – ${dayShort(x.to)} · ${x.name}${x.addr ? ' · ' + x.addr : ''}`;
function dayText(x) { return [dayHead(x), ...(x.fixed || []).map(([no, r]) => `  ${no} ${r}`), ...dayRows(x).map(r => '  ' + r), nightLine(x.d) && '  ' + nightLine(x.d)].filter(Boolean).join('\n'); }
const tripTitle = () => $('#tripName').textContent.trim() || ROUTE_LABEL;
function tripText() {
  const stays = myStays.slice().sort((a, b) => a.from - b.from);
  return [tripTitle(), ROUTE_LABEL, '', t('Your flights').toUpperCase(), ...LEGS.map(flightLine), '',
    ...(stays.length ? [t('Where you sleep').toUpperCase(), ...stays.map(stayLine), ''] : []),
    t('Your days').toUpperCase(), ...DAYS.map(x => dayText(x) + '\n'), t('Times are local and approximate. Made with Everywhen.')].join('\n');
}
async function shareText(text, title) {
  if (navigator.share) { try { await navigator.share({ title, text }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(text); toast(t('Copied. Paste it into a message.')); }
  catch { toast(t('Couldn’t copy here. Use Print or save as PDF instead.')); }
}
document.addEventListener('click', e => {
  const sd = e.target.closest('[data-shareday]');
  if (sd) { const x = dayOf(sd.dataset.shareday); shareText(dayText(x), dayHead(x)); return; }
  if (e.target.closest('#shareTrip')) { shareText(tripText(), tripTitle()); return; }
  if (e.target.closest('#printTrip')) {
    const stays = myStays.slice().sort((a, b) => a.from - b.from);
    $('#printDoc').innerHTML = `<h1>${esc(tripTitle())}</h1><p class="pd-route">${esc(ROUTE_LABEL)}</p>
      <h2>${t('Your flights')}</h2><ul>${LEGS.map(L => `<li>${esc(flightLine(L))}</li>`).join('')}</ul>
      ${stays.length ? `<h2>${t('Where you sleep')}</h2><ul>${stays.map(x => `<li>${esc(stayLine(x))}</li>`).join('')}</ul>` : ''}
      <h2>${t('Your days')}</h2>${DAYS.map(x => `<section><h3>${esc(dayHead(x))}</h3><ul>${[...(x.fixed || []).map(([no, r]) => `${no} ${r}`), ...dayRows(x), nightLine(x.d)].filter(Boolean).map(r => `<li>${esc(r)}</li>`).join('')}</ul></section>`).join('')}
      <p class="pd-foot">${t('Times are local and approximate. Made with Everywhen.')}</p>`;
    window.print();
  }
});

/* ---------- calendar: flights, stays and cancellation deadlines as an .ics file ---------- */
const icsEsc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/([;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
const icsUtc = ms => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
const icsDay = d => isoDay(d).replace(/-/g, '');
// Lines are folded at 75 bytes, as the format asks; continuation lines start with a space.
function icsFold(line) {
  const enc = new TextEncoder(); let out = '', cur = '', n = 0;
  for (const ch of line) { const b = enc.encode(ch).length; if (n + b > 73) { out += cur + '\r\n '; cur = ''; n = 1; } cur += ch; n += b; }
  return out + cur;
}
const MON = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// "21 Feb, 18:00", "Feb 21 6:00" or "2月21日 18:00" as an instant in the stay's time zone; null when it can't be read.
function cancelAt(x) {
  if (PRE && x.id === 'mido') return MIDO_DEADLINE;
  const s = String(x.cancel || '').toLowerCase();
  let dd, mo, m;
  if ((m = s.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日?/))) { mo = +m[1]; dd = +m[2]; }
  else if ((m = s.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3})/)) && MON.includes(m[2])) { dd = +m[1]; mo = MON.indexOf(m[2]) + 1; }
  else if ((m = s.match(/([a-z]{3})[a-z]*\.?\s+(\d{1,2})/)) && MON.includes(m[1])) { mo = MON.indexOf(m[1]) + 1; dd = +m[2]; }
  if (!mo || !dd || dd > 31) return null;
  const tm = s.match(/(\d{1,2})[:.](\d{2})/), tz = tzOfKey(x.city), p2 = n => String(n).padStart(2, '0');
  const at = y => zoned(`${y}-${p2(mo)}-${p2(dd)}T${tm ? p2(+tm[1] % 24) : '23'}:${tm ? tm[2] : '59'}`, tz);
  const y = +isoDay(x.from).slice(0, 4), v = at(y);
  return v > dayAt(x.from, tz, 23, 59) ? at(y - 1) : v;
}
function buildIcs(withPlans) {
  const stamp = icsUtc(Date.now()), ev = [], id = TRIP.id || 'trip';
  const add = (uid, lines, alarms = []) => ev.push(['BEGIN:VEVENT', `UID:${uid}-${id}@everywhen`, `DTSTAMP:${stamp}`, ...lines, ...alarms.flatMap(a => ['BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEsc(a[1])}`, `TRIGGER:${a[0]}`, 'END:VALARM']), 'END:VEVENT']);
  LEGS.forEach((L, i) => {
    const A = CITY[L.from], B = CITY[L.to], title = `${L.no || t('Flight')} ${A.code} → ${B.code}`;
    add('flight' + i, [`DTSTART:${icsUtc(L.dep)}`, `DTEND:${icsUtc(L.arr)}`, `SUMMARY:${icsEsc('✈ ' + title)}`, `LOCATION:${icsEsc(t(A.airport) + (L.fT ? ' ' + L.fT : ''))}`,
      `DESCRIPTION:${icsEsc(t('Leaves {a} at {t1} ({c1} time). Lands {b} at {t2} ({c2} time).', { a: A.code + (L.fT ? ' ' + L.fT : ''), t1: hm(L.dep, A.tz), c1: t(A.city), b: B.code + (L.tT ? ' ' + L.tT : ''), t2: hm(L.arr, B.tz), c2: t(B.city) }))}`], [['-PT3H', title]]);
  });
  myStays.forEach(x => {
    add('stay' + x.id, [`DTSTART;VALUE=DATE:${icsDay(x.from)}`, `DTEND;VALUE=DATE:${icsDay(x.to)}`, `SUMMARY:${icsEsc('🏨 ' + x.name)}`, x.addr && `LOCATION:${icsEsc(x.addr)}`,
      `DESCRIPTION:${icsEsc([x.ref && t('Booking ref') + ': ' + x.ref, x.cancel && t('Free cancellation until {when}', { when: x.cancel }), x.note].filter(Boolean).join('\n'))}`, 'TRANSP:TRANSPARENT'].filter(Boolean));
    const c = cancelAt(x);
    if (c) { const title = t('Free cancellation ends: {name}', { name: x.name }); add('cancel' + x.id, [`DTSTART:${icsUtc(c - H)}`, `DTEND:${icsUtc(c)}`, `SUMMARY:${icsEsc('⏰ ' + title)}`], [['-P1D', title], ['-PT3H', title]]); }
  });
  if (withPlans) DAYS.forEach(x => {
    const rows = dayRows(x); if (!rows.length) return;
    add('day' + x.d, [`DTSTART;VALUE=DATE:${icsDay(x.d)}`, `DTEND;VALUE=DATE:${icsDay(x.d + 1)}`, `SUMMARY:${icsEsc(x.cities.map(cityName).join(' → ') + ': ' + t(rows.length === 1 ? '1 stop' : '{n} stops', { n: rows.length }))}`, `DESCRIPTION:${icsEsc(rows.join('\n'))}`, 'TRANSP:TRANSPARENT']);
  });
  return { n: ev.length, text: ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Everywhen//Trip//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${icsEsc(tripTitle())}`, ...ev.flat(), 'END:VCALENDAR'].map(icsFold).join('\r\n') + '\r\n' };
}
function saveFile(name, mime, text) {
  const file = new File([text], name, { type: mime });
  // On iPhone a home-screen app can't download; the share sheet hands the file to Calendar instead.
  if (isIOS() && navigator.canShare?.({ files: [file] })) { navigator.share({ files: [file] }).catch(() => {}); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#icsBtn').addEventListener('click', () => {
  const c = buildIcs($('#icsPlans').checked);
  saveFile(`everywhen-${String(TRIP.id || 'trip').replace(/[^\w-]/g, '')}.ics`, 'text/calendar', c.text);
  toast(t('Calendar file ready with {n} events. Open it to add them to your calendar.', { n: c.n }));
});

/* ---------- trip spending: a running total in your home currency ---------- */
const SPEND_CATS = [['food', 'Food and drink'], ['move', 'Getting around'], ['see', 'Sights and tickets'], ['shop', 'Shopping'], ['stay', 'Where you stay'], ['other', 'Other']];
let spend = (v => Array.isArray(v) ? v : [])(tstore.get('spend', []));
const saveSpend = () => tstore.set('spend', spend);
// Each payment keeps its value in home currency at the rate of the day, so later rate changes don't rewrite history.
const toHome = (a, c) => c === HOME_CUR ? a : +rates[c] > 0 ? a / +rates[c] : null;
const fmtCur = (a, c) => `${curDec(c) ? nf2.format(a) : nf0.format(Math.round(a))} ${c}`;
const fmtHome = a => `${HOME_SYM} ${nf2.format(a)}`;
function spendSetup() {
  $('#spCur').innerHTML = [...CURS, HOME_CUR].map(c => `<option value="${c}"${c === cur ? ' selected' : ''}>${c}</option>`).join('');
  $('#spSplit').innerHTML = [1, 2, 3, 4, 5, 6, 8, 10].map(n => `<option value="${n}">${n === 1 ? t('Just me') : t('{n} people', { n })}</option>`).join('');
  $('#spCat').innerHTML = SPEND_CATS.map(([k, n]) => `<option value="${k}">${t(n)}</option>`).join('');
}
function spendLive() {
  const el = $('#spLive'), raw = $('#spAmt').value, v = parseAmt(raw), c = $('#spCur').value, n = +$('#spSplit').value;
  el.className = 'spend-live';
  if (v === null) { el.textContent = ''; return null; }
  if (Number.isNaN(v) || !(v > 0)) { el.className = 'spend-live err'; el.textContent = t('That doesn’t look like an amount. Try 350k or 42.50.'); return null; }
  const share = v / n, home = toHome(share, c);
  if (home === null) { el.className = 'spend-live err'; el.textContent = t('Set the {cur} exchange rate above first.', { cur: c }); return null; }
  el.textContent = n > 1 ? t('Your share: {a}, about {h}.', { a: fmtCur(share, c), h: fmtHome(home) }) : c === HOME_CUR ? '' : t('About {h}.', { h: fmtHome(home) });
  return { amt: share, cur: c, home, n };
}
function renderSpend() {
  const host = $('#spendOut'); if (!host) return;
  const sel = [$('#spCur').value, $('#spSplit').value, $('#spCat').value]; spendSetup();
  if (sel[0]) { $('#spCur').value = sel[0]; $('#spSplit').value = sel[1]; $('#spCat').value = sel[2]; }
  if (!spend.length) { host.innerHTML = `<p class="hint">${t('Nothing noted yet. Add your first payment above.')}</p>`; return; }
  const total = spend.reduce((a, e) => a + e.home, 0), dayOfE = e => new Date(e.at).toLocaleDateString(LOCALE(), { weekday: 'short', day: 'numeric', month: 'short' });
  const days = [...new Set(spend.map(dayOfE))], cats = SPEND_CATS.map(([k, n]) => [n, spend.filter(e => e.cat === k).reduce((a, e) => a + e.home, 0)]).filter(c => c[1] > 0).sort((a, b) => b[1] - a[1]);
  host.innerHTML = `<div class="spend-total"><span class="eyebrow">${t('Spent so far')}</span><b>${esc(fmtHome(total))}</b><span class="hint">${t(spend.length === 1 ? '1 payment' : '{n} payments', { n: spend.length })} · ${t(days.length === 1 ? 'about {a} a day over 1 day' : 'about {a} a day over {d} days', { a: fmtHome(total / days.length), d: days.length })}</span></div>
    <ul class="spend-cats">${cats.map(([n, v]) => `<li><span>${t(n)}</span><span class="bar" aria-hidden="true"><i style="width:${Math.max(3, v / cats[0][1] * 100)}%"></i></span><span class="mono">${esc(fmtHome(v))}</span></li>`).join('')}</ul>
    ${days.map(dn => { const list = spend.filter(e => dayOfE(e) === dn).sort((a, b) => b.at - a.at);
      return `<div class="spend-day"><div class="spend-dh"><span class="eyebrow">${esc(dn)}</span><span class="mono">${esc(fmtHome(list.reduce((a, e) => a + e.home, 0)))}</span></div>${list.map(e => `<div class="spend-e"><span class="sw">${esc(e.what || t(SPEND_CATS.find(c => c[0] === e.cat)?.[1] || 'Other'))}${e.n > 1 ? `<small>${t('your share of {n}', { n: e.n })}</small>` : ''}</span><span class="sa mono">${e.cur === HOME_CUR ? '' : `<small>${esc(fmtCur(e.amt, e.cur))}</small>`}${esc(fmtHome(e.home))}</span><button class="ib" type="button" data-spdel="${esc(e.id)}" aria-label="${esc(t('Remove {n}', { n: e.what || fmtCur(e.amt, e.cur) }))}">✕</button></div>`).join('')}</div>`; }).join('')}`;
}
$('#spendForm').addEventListener('input', spendLive);
$('#spendForm').addEventListener('change', spendLive);
$('#spendForm').addEventListener('submit', e => {
  e.preventDefault();
  if (parseAmt($('#spAmt').value) === null) { $('#spLive').className = 'spend-live err'; $('#spLive').textContent = t('Type the amount first.'); $('#spAmt').focus(); return; }
  const v = spendLive(); if (!v) { $('#spAmt').focus(); return; }
  spend.push({ id: 'p' + Date.now().toString(36), at: Date.now(), what: $('#spWhat').value.trim(), cat: $('#spCat').value, ...v });
  saveSpend(); $('#spAmt').value = ''; $('#spWhat').value = ''; $('#spLive').textContent = ''; renderSpend();
  toast(t('Added {a}', { a: fmtCur(v.amt, v.cur) }));
});
$('#spendOut').addEventListener('click', e => {
  const b = e.target.closest('[data-spdel]'); if (!b) return;
  const before = spend.slice(), x = spend.find(s => s.id === b.dataset.spdel);
  spend = spend.filter(s => s.id !== b.dataset.spdel); saveSpend(); renderSpend();
  undoToast(t('Removed {n}', { n: x?.what || (x ? fmtCur(x.amt, x.cur) : '') }), () => { spend = before; saveSpend(); renderSpend(); });
});
renderSpend();

/* ---------- install: offer the home-screen app once, where the browser allows it ---------- */
let installEvt = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; renderInstall(); });
addEventListener('appinstalled', () => { installEvt = null; store.set('installHide', 1); renderInstall(); });
function renderInstall() {
  const host = $('#installNote'); if (!host) return;
  const ios = isIOS() && !isStandalone();
  host.hidden = isStandalone() || !!store.get('installHide', 0) || !(installEvt || ios);
  if (host.hidden) return;
  host.innerHTML = `<div><b>${t('Keep Everywhen on your home screen')}</b><p>${t(ios ? 'In Safari, tap Share, then Add to Home Screen. It then opens like an app, even with no internet.' : 'Install it to open like an app, even with no internet.')}</p></div>
    <div class="acts">${installEvt ? `<button class="btn" type="button" data-install="go">${t('Install')}</button>` : ''}<button class="btn ghost" type="button" data-install="hide">${t('Not now')}</button></div>`;
}
$('#installNote').addEventListener('click', async e => {
  const b = e.target.closest('[data-install]'); if (!b) return;
  if (b.dataset.install === 'go' && installEvt) { const ev = installEvt; installEvt = null; try { ev.prompt(); await ev.userChoice; } catch {} }
  else store.set('installHide', 1);
  renderInstall();
});
renderInstall();

/* ---------- ready for no internet? what is already saved on this device ---------- */
const tileLL = (z, x, y) => { const n = 2 ** z; return [Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + .5) / n))) * 180 / Math.PI, (x + .5) / n * 360 - 180]; };
async function runOffCheck() {
  const out = [], row = (ok, title, detail) => out.push(`<li class="${ok ? 'ok' : 'todo'}"><span class="oc-ic" aria-hidden="true">${ok ? '✓' : '!'}</span><span><b>${esc(title)}</b><small>${esc(detail)}</small></span></li>`);
  const list = a => a.join(LANG === 'zh' ? '、' : ', ');
  let keys = [], tiles = [];
  try { keys = await caches.keys(); if (keys.includes('everywhen-tiles')) tiles = (await (await caches.open('everywhen-tiles')).keys()).map(r => r.url); } catch {}
  const app = keys.some(k => /^everywhen-[0-9a-f]+$/.test(k));
  row(app, t('The app itself'), t(app ? 'Saved. It opens with no connection.' : 'Not saved on this device yet. Open Everywhen from its web address once while online.'));
  const noGuide = EXPLORE_KEYS.filter(k => !hasGuide(k)).map(cityName);
  row(!noGuide.length, t('City guides'), noGuide.length ? t('Not built yet: {list}. Open Explore once while online.', { list: list(noGuide) }) : t(EXPLORE_KEYS.length === 1 ? 'Saved for your city.' : 'Saved for all {n} cities.', { n: EXPLORE_KEYS.length }));
  // Street-level map squares (zoom 12 and closer) saved within 30 km of each city's centre.
  const pts = tiles.map(u => u.match(/\/(\d+)\/(\d+)\/(\d+)\.png/)).filter(m => m && +m[1] >= 12).map(m => tileLL(+m[1], +m[2], +m[3]));
  const noMap = EXPLORE_KEYS.filter(k => { const c = centreOf(k); return pts.filter(p => km(p, [c[0], c[1]]) <= 30).length < 8; }).map(cityName);
  row(!noMap.length, t('Maps'), noMap.length ? t('Not viewed yet: {list}. Open each city’s map in Explore and zoom in on the areas you’ll visit.', { list: list(noMap) }) : t('The areas you have looked at are saved.'));
  if (CURS.length) { const ok = CURS.every(c => +rates[c] > 0) && (rates.src === 'live' || rates.src === 'manual'); row(ok, t('Exchange rates'), rates.src === 'live' ? t('Live rates from {when}. Saved for offline use.', { when: rates.when }) : rates.src === 'manual' ? t('Using your own rates.') : rates.when ? t('Rates from {when}. Update them before you fly.', { when: rates.when }) : t('Not updated yet. Tap Update rates on the Money tab.')); }
  const soon = LEGS[0].dep - Date.now() < 16 * D && Date.now() < MOTION_END;
  if (soon) row(!!wx && Date.now() - wx.at < 2 * D, t('Weather forecast'), wx ? t('Forecast saved on {u}.', { u: new Date(wx.at).toLocaleString(LOCALE(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) }) : t('No forecast saved yet. Open the Weather tab while online.'));
  const noAddr = myStays.filter(x => !x.addr).map(x => x.name), open = NIGHTS.filter(n => n.kind === 'open').length;
  row(!noAddr.length && !open, t('Hotel addresses for drivers'), noAddr.length ? t('No address in the local language yet for: {list}.', { list: list(noAddr) }) : open ? t(open === 1 ? '1 night has no stay yet.' : '{n} nights have no stay yet.', { n: open }) : t('Every stay has its address.'));
  row(true, t('Phrasebook, driver cards and money'), t('Always work offline. New translations need a connection.'));
  const el = $('#offList'); el.innerHTML = out.join(''); el.hidden = false;
  $('#offBtn').textContent = t('Check again');
}
$('#offBtn').addEventListener('click', runOffCheck);
