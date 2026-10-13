/* ================= Your trips: create, edit, switch =================
   A trip is entered as its flights, with the local times printed on the booking. Airports come from a list of
   every airport with an IATA code (data/airports.json, loaded only when this form opens), which supplies each
   airport's city, country, time zone and position. Saving or switching a trip reloads the app around it. */
let AP_DB = null, apLoading = null;
function loadAirports() {
  if (AP_DB) return Promise.resolve(AP_DB);
  return apLoading ||= fetch('data/airports.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(j => {
    AP_DB = j.a.map(([code, name, city, cc, lat, lon, tzi]) => ({ code, name, city, cc, lat, lon, tz: j.tz[tzi], key: fold(`${code} ${city} ${name}`) }));
    return AP_DB;
  }).catch(e => { apLoading = null; throw e; });
}
// Airports the app already knows (this trip and saved trips), for when the full list can't load.
const knownAirports = () => [PRESET, ...TRIPS].flatMap(x => Object.values(x.airports));
// The main international airport of a city should come first (Incheon before Gimpo, Narita before Ibaraki).
const MAJOR = new Set('ATL PEK PKX DXB LAX HND ORD LHR PVG CDG DFW CAN AMS FRA IST DEL ICN SIN DEN BKK JFK KUL SFO MAD CTU SZX LAS SEA MIA BCN MUC FCO LGW SYD MEL BNE PER AKL YYZ YVR HKG TPE TAO NRT KIX NGO CTS FUK CGK DPS MNL CEB SGN HAN DAD PNH REP RGN VTE KTM CMB MLE DAC BOM BLR MAA HYD CCU DOH AUH RUH JED CAI JNB CPT NBO ADD LOS GRU GIG EZE SCL LIM BOG MEX CUN YUL BOS IAD EWR PHL ZRH VIE CPH ARN OSL HEL DUB LIS ATH PRG WAW BUD BRU MXP VCE NAP MAN EDI KEF TLV AMM BAH MCT KWI CMN RAK PEN LGK BKI KCH HKT CNX USM CXR PQC HGH XIY CKG KMG XMN WUH NKG SHE DLC CJU PUS OKA GMP'.split(' '));
function searchAirports(q) {
  const s = fold(q), up = q.trim().toUpperCase(), db = AP_DB || knownAirports().map(a => ({ ...a, key: fold(`${a.code} ${a.city} ${a.name}`) }));
  if (!s) return [];
  const scored = [];
  for (const a of db) {
    let sc = 0;
    if (a.code === up) sc = 100;
    else if (fold(a.city).startsWith(s)) sc = 80;
    else if (a.key.includes(s)) sc = 50;
    if (sc) scored.push([sc + (/Intl/.test(a.name) ? 5 : 0), a]);
    if (sc && MAJOR.has(a.code)) scored[scored.length - 1][0] += 12 + (a.code === 'GMP' || a.code === 'HND' ? -4 : 0);
    if (scored.length > 400) break;
  }
  return scored.sort((x, y) => y[0] - x[0]).slice(0, 8).map(x => x[1]);
}
const regionName = cc => { try { return new Intl.DisplayNames([LOCALE()], { type:'region' }).of(cc); } catch { return cc; } };
const apLabel = a => `${a.code} · ${a.name}`;

/* ---------- trips list ---------- */
const tripsDlg = $('#tripsDlg'), wizDlg = $('#wizDlg');
const tripRange = tr => { try { const a = tr.airports[tr.legs[0].from], b = tr.airports[tr.legs.at(-1).to]; const t0 = zoned(tr.legs[0].dep, a.tz), t1 = tr.end ? zoned(tr.end + 'T12:00', b.tz) : zoned(tr.legs.at(-1).arr, b.tz); return dateRange(t0, t1, a.tz) + ' ' + new Date(t0).getUTCFullYear(); } catch { return ''; } };
const tripRoute = tr => [tr.legs[0].from, ...tr.legs.map(l => l.to)].join(' · ');
let delTrip = null;
function renderTrips() {
  const all = [PRESET, ...TRIPS];
  $('#tripList').innerHTML = all.map(tr => {
    const on = tr.id === TRIP.id;
    return `<div class="trip-row${on ? ' on' : ''}">
      <div class="trip-main"><b>${esc(tr.preset ? t(tr.name) : tr.name)}</b>${tr.preset ? `<span class="chip">${t('Example')}</span>` : ''}${on ? `<span class="chip good">${t('Open now')}</span>` : ''}
        <small>${esc(tripRoute(tr))} · ${esc(tripRange(tr))}</small></div>
      <div class="acts">${on ? '' : `<button class="sbtn primary" type="button" data-trip-open="${esc(tr.id)}">${t('Open')}</button>`}${tr.preset ? '' : `<button class="sbtn" type="button" data-trip-edit="${esc(tr.id)}">${t('Edit')}</button><button class="sbtn danger" type="button" data-trip-del="${esc(tr.id)}">${t(delTrip === tr.id ? 'Tap again to delete' : 'Delete')}</button>`}</div>
    </div>`;
  }).join('');
}
function openTrips() { delTrip = null; renderTrips(); tripsDlg.showModal ? tripsDlg.showModal() : tripsDlg.setAttribute('open', ''); }
function switchTrip(id) { store.set('activeTrip', id); location.replace(location.pathname + '#trip'); location.reload(); }
$('#tripList').addEventListener('click', e => {
  const o = e.target.closest('[data-trip-open]'); if (o) { switchTrip(o.dataset.tripOpen); return; }
  const ed = e.target.closest('[data-trip-edit]'); if (ed) { tripsDlg.close?.(); openWizard(TRIPS.find(x => x.id === ed.dataset.tripEdit)); return; }
  const dl = e.target.closest('[data-trip-del]');
  if (dl) {
    const id = dl.dataset.tripDel;
    if (delTrip !== id) { delTrip = id; renderTrips(); return; }
    const keep = TRIPS.filter(x => x.id !== id); store.set('trips', keep);
    try { Object.keys(localStorage).filter(k => k.startsWith(`everywhen:t:${id}:`)).forEach(k => localStorage.removeItem(k)); } catch {}
    if (id === TRIP.id) switchTrip(PRESET.id); else { TRIPS.splice(TRIPS.findIndex(x => x.id === id), 1); delTrip = null; renderTrips(); toast(t('Trip deleted')); }
  }
});
$('#tripNew').addEventListener('click', () => { tripsDlg.close?.(); openWizard(); });
$('#tripsClose').addEventListener('click', () => tripsDlg.close ? tripsDlg.close() : tripsDlg.removeAttribute('open'));
$('#tripPick').addEventListener('click', openTrips);

/* ---------- flight lookup ----------
   With a flight number and a departure date, the form asks Everywhen's flight-lookup Worker (worker/flight-lookup.js,
   which holds the AeroDataBox key) for the airline timetable, and fills in the airports and local times. */
const FLIGHT_API = 'https://everywhen-flights.chrystalfu123.workers.dev/';
const FLIGHT_NO = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])[A-Z]?\d{1,4}[A-Z]?$/;
const flightAsk = {}, flightPending = {};
const findMsg = (i, html, cls = '') => { wiz.find[i] = html ? `<p class="wleg-find ${cls}" id="w-find-${i}" aria-live="polite">${html}</p>` : ''; const el = $('#w-find-' + i); if (el) el.outerHTML = wiz.find[i] || `<p class="wleg-find" id="w-find-${i}" aria-live="polite"></p>`; };
async function lookupLeg(i) {
  const l = wiz.legs[i]; if (!FLIGHT_API || !l) return;
  const no = l.no.toUpperCase().replace(/[\s-]+/g, ''), date = l.depD;
  if (!FLIGHT_NO.test(no) || !date) { findMsg(i, ''); return; }
  const day = new Date(date + 'T12:00Z').toLocaleDateString(LOCALE(), { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' });
  findMsg(i, esc(t('Looking up {no} on {day}…', { no, day })), 'busy');
  let j;
  try { j = await (flightAsk[no + date] ||= jget(`${FLIGHT_API}?no=${encodeURIComponent(no)}&date=${date}`, 15000)); }
  catch (e) {
    delete flightAsk[no + date];
    if (wiz.legs[i] === l) findMsg(i, esc(t(navigator.onLine === false ? 'You’re offline, so the timetable can’t be checked. Type the times from your booking.' : /429/.test(e.message) ? 'This month’s free flight lookups are used up. Type the times from your booking.' : 'The flight timetable couldn’t be reached. Type the times from your booking.')), 'bad');
    return;
  }
  if (wiz.legs[i] !== l || l.no.toUpperCase().replace(/[\s-]+/g, '') !== no || l.depD !== date) return; // changed while we were asking
  const fl = j.flights || [];
  const f = fl.find(x => x.from.airport.code === l.from && x.from.time.startsWith(date)) || fl.find(x => x.from.time.startsWith(date)) || fl[0];
  if (!f) {
    // Many flights don't run every day: say which nearby days it does fly, so a wrong date is easy to spot.
    const shift = n => new Date(Date.parse(date) + n * D).toISOString().slice(0, 10);
    const near = (await Promise.all([-1, 1].map(n => (flightAsk[no + shift(n)] ||= jget(`${FLIGHT_API}?no=${encodeURIComponent(no)}&date=${shift(n)}`, 15000)).catch(() => null))))
      .flatMap(x => x?.flights || []).filter(x => x.from.time).map(x => new Date(x.from.time.slice(0, 10) + 'T12:00Z').toLocaleDateString(LOCALE(), { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' }) + ' ' + x.from.time.slice(11, 16));
    if (wiz.legs[i] !== l || l.depD !== date) return;
    findMsg(i, esc(near.length ? t('{no} isn’t listed on {day}, but it flies {list}. Check the date on your booking.', { no, day, list: [...new Set(near)].join(LANG === 'zh' ? '、' : ' and ') }) : t('No timetable found for {no} on {day}. Check the number, or type the times from your booking.', { no, day })), 'bad');
    return;
  }
  await loadAirports().catch(() => {});
  const ap = a => { const d = AP_DB?.find(x => x.code === a.code); return d ? { code: d.code, city: d.city || d.name, name: d.name, cc: d.cc, tz: d.tz, lat: d.lat, lon: d.lon } : a.tz ? { ...a, city: a.city || a.name } : null; };
  const A = ap(f.from.airport), B = ap(f.to.airport);
  if (!A || !B) { findMsg(i, esc(t('No timetable found for {no} on {day}. Check the number, or type the times from your booking.', { no, day })), 'bad'); return; }
  const next = { from: A.code, to: B.code, depD: f.from.time.slice(0, 10), depT: f.from.time.slice(11, 16), arrD: f.to.time.slice(0, 10), arrT: f.to.time.slice(11, 16), airline: f.airline };
  const route = `${A.code} ${next.depT} → ${B.code} ${next.arrT}${next.arrD !== next.depD ? ' (+1)' : ''}`;
  // Times you've already typed (from your booking) are never overwritten without asking.
  const differs = ['from', 'to', 'depT', 'arrD', 'arrT'].some(k => l[k] && l[k] !== next[k]);
  if (differs) {
    flightPending[i] = { next, A, B, l };
    findMsg(i, `${esc(t('The timetable says {route}, which differs from what you typed.', { route }))} <button class="linkbtn" type="button" data-wfill="${i}">${t('Use the timetable')}</button>`, 'warn');
    return;
  }
  applyFlight(i, next, A, B, route);
}
function applyFlight(i, next, A, B, route) {
  const l = wiz.legs[i];
  wiz.picked[A.code] = A; wiz.picked[B.code] = B;
  Object.assign(l, next, { airline: l.airline || next.airline || '' });
  wiz.find[i] = '';
  if (FLIGHT_API) $('#wHint').textContent = t('Add your flights in order. Type the flight number and departure date, and the airports and times fill in from the airline timetable. You can also type the times from your booking; each is local to its airport.');
  renderLegs(); syncWizard();
  findMsg(i, esc(t('Filled in from the airline timetable: {route}. Check it against your booking.', { route })), 'good');
}

/* ---------- create or edit a trip ---------- */
let wiz = null; // { id, legs: [{ from, to, depD, depT, arrD, arrT, no, airline }], picked: { code: airport } }
const blankLeg = from => ({ from: from || '', to: '', depD: '', depT: '', arrD: '', arrT: '', no: '', airline: '' });
function openWizard(trip) {
  wiz = trip ? { find: [], id: trip.id, name: trip.name, end: trip.end || '', cur: trip.homeCur || '', picked: { ...trip.airports }, legs: trip.legs.map(l => ({ from: l.from, to: l.to, depD: l.dep.slice(0, 10), depT: l.dep.slice(11, 16), arrD: l.arr.slice(0, 10), arrT: l.arr.slice(11, 16), no: l.no || '', airline: l.airline || '' })) }
    : { find: [], id: null, name: '', end: '', cur: '', picked: {}, legs: [blankLeg()] };
  $('#wizT').textContent = t(trip ? 'Edit trip' : 'Create a trip');
  $('#wSave').textContent = t(trip ? 'Save trip' : 'Create trip');
  $('#wName').value = wiz.name; $('#wEnd').value = wiz.end; $('#wErr').textContent = '';
  const curs = [...new Set(Object.values(COUNTRY).map(c => c[0]))].sort();
  $('#wCur').innerHTML = curs.map(c => `<option value="${c}">${c} · ${esc(curName(c))}</option>`).join('');
  renderLegs(); syncWizard();
  wizDlg.showModal ? wizDlg.showModal() : wizDlg.setAttribute('open', '');
  (trip ? $('#wName') : $('#w-from-0'))?.focus();
  loadAirports().then(() => $('#wApStatus').textContent = '').catch(() => $('#wApStatus').textContent = t('The airport list couldn’t load. You’re probably offline: only airports from your saved trips can be found.'));
  $('#wApStatus').textContent = AP_DB ? '' : t('Loading the airport list…');
}
function legHtml(l, i) {
  const ap = c => wiz.picked[c] ? apLabel(wiz.picked[c]) : '';
  // With the timetable lookup on, the flight number comes first: with a date, it's all the form needs.
  const NUMBER_ROW = `    <div class="wrow two">
      <div class="field"><label for="w-no-${i}">${t('Flight number')} <small>${t(FLIGHT_API ? 'fills in the times' : 'optional')}</small></label><input id="w-no-${i}" data-k="no" value="${esc(l.no)}" autocomplete="off" autocapitalize="characters" placeholder="MH88"></div>
      <div class="field"><label for="w-airline-${i}">${t('Airline')} <small>${t('optional')}</small></label><input id="w-airline-${i}" data-k="airline" value="${esc(l.airline)}" autocomplete="off"></div>
    </div>`;
  return `<fieldset class="wleg" data-i="${i}">
    <legend>${t('Flight {n}', { n: i + 1 })}</legend>
    ${wiz.legs.length > 1 ? `<button class="wleg-x" type="button" data-wdel="${i}" aria-label="${t('Remove flight {n}', { n: i + 1 })}">✕</button>` : ''}
    ${FLIGHT_API ? NUMBER_ROW : ''}
    <div class="wrow two">
      ${['from', 'to'].map(k => `<div class="field ap"><label for="w-${k}-${i}">${t(k === 'from' ? 'From' : 'To')}</label><input class="apq" id="w-${k}-${i}" data-k="${k}" value="${esc(ap(l[k]))}" placeholder="${t('City or airport code')}" autocomplete="off" spellcheck="false" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="w-${k}-${i}-list"><ul class="ac" id="w-${k}-${i}-list" role="listbox" hidden></ul></div>`).join('')}
    </div>
    <div class="wrow four">
      <div class="field"><label for="w-depD-${i}">${t('Departs')}</label><input type="date" id="w-depD-${i}" data-k="depD" value="${l.depD}"></div>
      <div class="field"><label for="w-depT-${i}">${t('Local time')}</label><input type="time" id="w-depT-${i}" data-k="depT" value="${l.depT}"></div>
      <div class="field"><label for="w-arrD-${i}">${t('Arrives')}</label><input type="date" id="w-arrD-${i}" data-k="arrD" value="${l.arrD}"></div>
      <div class="field"><label for="w-arrT-${i}">${t('Local time')}</label><input type="time" id="w-arrT-${i}" data-k="arrT" value="${l.arrT}"></div>
    </div>
    ${FLIGHT_API ? '' : NUMBER_ROW}
    ${wiz.find?.[i] || `<p class="wleg-find" id="w-find-${i}" aria-live="polite"></p>`}
    <p class="wleg-sum" id="w-sum-${i}" aria-live="polite"></p>
  </fieldset>`;
}
function renderLegs() { $('#wLegs').innerHTML = wiz.legs.map(legHtml).join(''); wiz.legs.forEach((_, i) => legSummary(i)); }
// Times as instants, using each airport's own time zone.
function legTimes(l) {
  const A = wiz.picked[l.from], B = wiz.picked[l.to];
  if (!A || !B || !l.depD || !l.depT || !l.arrD || !l.arrT) return null;
  return { dep: zoned(`${l.depD}T${l.depT}`, A.tz), arr: zoned(`${l.arrD}T${l.arrT}`, B.tz) };
}
function legSummary(i) {
  const l = wiz.legs[i], x = legTimes(l), el = $('#w-sum-' + i); if (!el) return;
  if (!x) { el.textContent = ''; return; }
  const h = (x.arr - x.dep) / H;
  el.className = 'wleg-sum' + (h <= 0 || h > 22 ? ' bad' : '');
  el.textContent = h <= 0 ? t('Arrives before it departs. Check the dates and times.') : h > 22 ? t('Lands {d} after it departs. Check the arrival date.', { d: dur(x.arr - x.dep) }) : t('{d} flight', { d: dur(x.arr - x.dep) }) + (l.arrD !== l.depD ? ' · ' + t('lands {day}', { day: new Date(l.arrD + 'T12:00Z').toLocaleDateString(LOCALE(), { weekday:'short', day:'numeric', month:'short', timeZone:'UTC' }) }) : '');
}
// One-way trips need an end date; round trips end when you land home.
function syncWizard() {
  const first = wiz.legs[0]?.from, last = wiz.legs.at(-1)?.to, back = first && last && (last === first || wiz.picked[last]?.city === wiz.picked[first]?.city);
  $('#wEndWrap').hidden = !last || back;
  $('#wReturn').hidden = !first || !last || back;
  const home = wiz.picked[first]; if (home && !wiz.cur) wiz.cur = curOf(home.cc);
  if (wiz.cur) $('#wCur').value = wiz.cur;
}
$('#wLegs').addEventListener('input', e => {
  const f = e.target.closest('[data-k]'), i = +e.target.closest('.wleg')?.dataset.i; if (!f || isNaN(i)) return;
  const l = wiz.legs[i], k = f.dataset.k;
  if (f.classList.contains('apq')) { l[k] = ''; showAp(f); syncWizard(); return; }
  const was = l[k]; l[k] = f.value.trim();
  // The arrival date follows the departure date unless it was set to a plausible next day (an overnight flight).
  const gap = l.depD && l.arrD ? (Date.parse(l.arrD) - Date.parse(l.depD)) / D : 0;
  if (k === 'depD' && l.depD && (!l.arrD || l.arrD === was || gap < 0 || gap > 1)) { l.arrD = l.depD; $(`#w-arrD-${i}`).value = l.arrD; }
  legSummary(i);
});
// Looking up the timetable once a flight number and a departure date are both in.
$('#wLegs').addEventListener('change', e => {
  const f = e.target.closest('[data-k="no"], [data-k="depD"]'), i = +e.target.closest('.wleg')?.dataset.i;
  if (f && !isNaN(i)) lookupLeg(i);
});
$('#wLegs').addEventListener('click', e => {
  const fill = e.target.closest('[data-wfill]');
  if (fill) { const p = flightPending[fill.dataset.wfill]; if (p && wiz.legs[+fill.dataset.wfill] === p.l) applyFlight(+fill.dataset.wfill, p.next, p.A, p.B, `${p.A.code} ${p.next.depT} → ${p.B.code} ${p.next.arrT}${p.next.arrD !== p.next.depD ? ' (+1)' : ''}`); return; }
  const x = e.target.closest('[data-wdel]'); if (x) { wiz.legs.splice(+x.dataset.wdel, 1); wiz.find = []; renderLegs(); syncWizard(); return; }
  const o = e.target.closest('[data-ap]'); if (o) pickAp(o.closest('.ap').querySelector('.apq'), o.dataset.ap);
});
$('#wLegs').addEventListener('keydown', e => {
  const f = e.target.closest('.apq'); if (!f) return;
  const list = f.nextElementSibling, opts = [...list.querySelectorAll('[data-ap]')], cur = opts.findIndex(o => o.getAttribute('aria-selected') === 'true');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = opts[(cur + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length]; opts.forEach(o => o.setAttribute('aria-selected', o === n)); n?.scrollIntoView({ block:'nearest' }); }
  if (e.key === 'Enter' && opts.length) { e.preventDefault(); pickAp(f, (opts[cur] || opts[0]).dataset.ap); }
  if (e.key === 'Escape' && !list.hidden) { e.stopPropagation(); e.preventDefault(); list.hidden = true; }
});
$('#wLegs').addEventListener('focusout', e => { const f = e.target.closest('.apq'); if (f) setTimeout(() => { if (!f.parentElement.contains(document.activeElement)) f.nextElementSibling.hidden = true; }, 150); });
let apShown = {};
function showAp(f) {
  const list = f.nextElementSibling, res = searchAirports(f.value);
  apShown[f.id] = res;
  list.innerHTML = res.map((a, j) => `<li role="option" id="${f.id}-o${j}" data-ap="${a.code}" aria-selected="${j === 0}"><b>${a.code}</b> <span>${esc(a.name)}</span><small>${esc([a.city, regionName(a.cc)].filter(Boolean).join(', '))}</small></li>`).join('');
  list.hidden = !res.length; f.setAttribute('aria-expanded', !!res.length);
}
function pickAp(f, code) {
  const a = (apShown[f.id] || []).find(x => x.code === code) || searchAirports(code)[0]; if (!a) return;
  const i = +f.closest('.wleg').dataset.i, k = f.dataset.k;
  wiz.picked[a.code] = { code: a.code, city: a.city || a.name, name: a.name, cc: a.cc, tz: a.tz, lat: a.lat, lon: a.lon };
  wiz.legs[i][k] = a.code; f.value = apLabel(a); f.nextElementSibling.hidden = true; f.setAttribute('aria-expanded', 'false');
  legSummary(i); syncWizard();
  const next = k === 'from' ? $(`#w-to-${i}`) : $(`#w-depD-${i}`); next?.focus();
}
$('#wAdd').addEventListener('click', () => { const prev = wiz.legs.at(-1); wiz.legs.push(blankLeg(prev?.to)); renderLegs(); syncWizard(); $(`#w-to-${wiz.legs.length - 1}`)?.focus(); });
$('#wReturn').addEventListener('click', () => { const prev = wiz.legs.at(-1); wiz.legs.push({ ...blankLeg(prev.to), to: wiz.legs[0].from }); renderLegs(); syncWizard(); $(`#w-depD-${wiz.legs.length - 1}`)?.focus(); });
$('#wCur').addEventListener('change', e => wiz.cur = e.target.value);
$('#wCancel').addEventListener('click', () => wizDlg.close ? wizDlg.close() : wizDlg.removeAttribute('open'));
// City centres make weather, travel times and maps more accurate than the airport position; best effort.
async function cityCentre(a) {
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=${a.cc.toLowerCase()}&q=${encodeURIComponent(a.city)}`, { signal: ctl.signal });
    clearTimeout(to);
    const h = (await r.json())[0]; if (!h) return null;
    const c = [+(+h.lat).toFixed(4), +(+h.lon).toFixed(4)];
    return Math.hypot(c[0] - a.lat, c[1] - a.lon) < 1.2 ? c : null;
  } catch { return null; }
}
$('#wizForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = (m, el) => { $('#wErr').textContent = m; el?.focus(); };
  let prevArr = null;
  for (const [i, l] of wiz.legs.entries()) {
    if (!l.from) return err(t('Choose where flight {n} leaves from.', { n: i + 1 }), $(`#w-from-${i}`));
    if (!l.to) return err(t('Choose where flight {n} lands.', { n: i + 1 }), $(`#w-to-${i}`));
    if (l.from === l.to) return err(t('Flight {n} leaves from and lands at the same airport.', { n: i + 1 }), $(`#w-to-${i}`));
    if (!l.depD || !l.depT) return err(t('Add when flight {n} departs.', { n: i + 1 }), $(`#w-depD-${i}`));
    if (!l.arrD || !l.arrT) return err(t('Add when flight {n} arrives.', { n: i + 1 }), $(`#w-arrD-${i}`));
    const x = legTimes(l);
    if (x.arr <= x.dep) return err(t('Flight {n} arrives before it departs. Times are local at each airport.', { n: i + 1 }), $(`#w-arrT-${i}`));
    if (x.arr - x.dep > 22 * H) return err(t('Flight {n} would take over 22 hours. Check the arrival date.', { n: i + 1 }), $(`#w-arrD-${i}`));
    if (prevArr && x.dep < prevArr) return err(t('Flight {n} departs before the flight before it lands. Put your flights in order.', { n: i + 1 }), $(`#w-depD-${i}`));
    prevArr = x.arr;
  }
  const first = wiz.legs[0], last = wiz.legs.at(-1), back = last.to === first.from || wiz.picked[last.to].city === wiz.picked[first.from].city;
  const end = !back ? $('#wEnd').value : '';
  if (end && end < last.arrD) return err(t('The last day can’t be before your last flight lands.'), $('#wEnd'));
  const btn = $('#wSave'); btn.disabled = true; btn.textContent = t('Saving…');
  const airports = {};
  for (const l of wiz.legs) for (const c of [l.from, l.to]) airports[c] = { ...wiz.picked[c] };
  // Look up city centres once per city, at most one request a second.
  const byCity = {};
  for (const a of Object.values(airports)) if (!a.centre && navigator.onLine !== false) { const k = a.city + a.cc; if (!(k in byCity)) { byCity[k] = await cityCentre(a); await new Promise(r => setTimeout(r, 1000)); } if (byCity[k]) a.centre = byCity[k]; }
  const stays = [...new Set(wiz.legs.slice(0, back ? -1 : undefined).map(l => airports[l.to].city))];
  const t0 = zoned(`${first.depD}T${first.depT}`, airports[first.from].tz);
  const name = $('#wName').value.trim() || `${stays.slice(0, 3).join(' & ') || airports[last.to].city}, ${new Date(t0).toLocaleDateString('en-GB', { month:'short', year:'numeric', timeZone: airports[first.from].tz })}`;
  const trip = { id: wiz.id || 't' + Date.now().toString(36), name, homeCur: $('#wCur').value || curOf(airports[first.from].cc), airports,
    legs: wiz.legs.map(l => ({ no: l.no.toUpperCase().replace(/\s+/g, ''), airline: l.airline, from: l.from, to: l.to, dep: `${l.depD}T${l.depT}`, arr: `${l.arrD}T${l.arrT}` })), ...(end ? { end } : {}) };
  const all = TRIPS.filter(x => x.id !== trip.id); all.push(trip);
  store.set('trips', all);
  switchTrip(trip.id);
});

/* ---------- first visit: the Shanghai trip is an example ---------- */
if (PRE && !TRIPS.length && !store.get('sampleOk', false)) {
  $('#sampleNote').hidden = false;
  $('#sampleCreate').addEventListener('click', () => openWizard());
  $('#sampleHide').addEventListener('click', () => { store.set('sampleOk', true); $('#sampleNote').hidden = true; });
}
$('#tripName').textContent = PRE ? t(TRIP.name) : TRIP.name;
