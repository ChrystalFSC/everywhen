/* ================= Smart planner + Explore ================= */
const PHOTOS = __PHOTOS__;
Object.assign(PHOTOS, AG_PHOTOS);
// Cities in this trip that the guide doesn't cover yet get a plain entry, so every tab can name them.
Object.values(CITY).forEach(c => { const k = ckey(c.code); if (!CITIES[k]) CITIES[k] = { n: c.city, l: c.city, lang: /^zh/.test(langOf(c.cc)) ? 'zh' : langOf(c.cc), kind: 'base', cc: c.cc, own: true }; });
const CITYN = Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [k, v.n]));
const TIER = { 3:['Top pick','top'], 2:['Worth it','worth'], 1:['If you have time','maybe'] };
const WHEN_LABEL = { morning:'Morning', afternoon:'Afternoon', evening:'Evening', any:'Any time', half:'Half day', full:'Full day' };
const PACE = { relaxed:6, balanced:8, packed:10 };
const ZONE_NEAR = { bund:['oldcity','pudong','center'], oldcity:['bund','french'], pudong:['bund'], center:['bund','french'], french:['center','oldcity'], lake:['hills'], hills:['lake'], north:['west'], west:['north'], oldq:['west'] };
// Guides built from Wikivoyage give each place its position as its zone ("@lat,lon"): near means within 3 km.
const zoneLL = z => z.slice(1).split(',').map(Number);
const near = (a, b) => {
  if (a?.[0] === '@' && b?.[0] === '@') { const [p, q] = [zoneLL(a), zoneLL(b)]; return Math.hypot(p[0] - q[0], (p[1] - q[1]) * Math.cos(p[0] * Math.PI / 180)) * 111 <= 3; }
  return !a || a === b || (ZONE_NEAR[a] || []).includes(b);
};
const fmtHrs = h => LANG === 'zh' ? (h < 1 ? Math.round(h * 60) + '分钟' : (+h.toFixed(1)) + '小时') : (h < 1 ? Math.round(h * 60) + ' min' : (+h.toFixed(1)) + ' h');
const hasCJK = s => /[\u3400-\u9fff]/.test(s || '');
const nameOf = it => LANG === 'zh' && hasCJK(it.l) ? it.l : t(it.n);
const cityName = c => t(CITYN[c]);
const noteText = n => typeof n === 'string' ? t(n) : t(n.k, { city: n.city ? cityName(n.city) : '', day: n.d ? dayLabel(n.d) : '', list: (n.list || []).map(id => BY[id] ? nameOf(BY[id]) : id).join(LANG === 'zh' ? '、' : ', '), pace: n.pace ? t(n.pace[0].toUpperCase() + n.pace.slice(1)) : '', h: n.h || '' });
const dayLabel = d => { const tz = tzOfDay(d); return F(tz, { weekday:'short', day:'numeric', month:'short' }).format(dayAt(d, tz)); };
const dayShort = d => { const tz = tzOfDay(d); return F(tz, { weekday:'short', day:'numeric' }).format(dayAt(d, tz)); };
/* Practical details for guide items, looked up at build time (scripts/fetch-details.js) so they work offline and in China. */
const DETAILS = __DETAILS__;
Object.assign(DETAILS, AG_DETAILS);
const CARD_NOTES = tstore.get('notes', {});
// OpenStreetMap opening hours ("Tu-Su 09:00-17:15; Mo off") in plain words.
function fmtHours(h) {
  if (!h) return '';
  const D = LANG === 'zh' ? { Mo:'周一', Tu:'周二', We:'周三', Th:'周四', Fr:'周五', Sa:'周六', Su:'周日', PH:'节假日' } : { Mo:'Mon', Tu:'Tue', We:'Wed', Th:'Thu', Fr:'Fri', Sa:'Sat', Su:'Sun', PH:'Public holidays' };
  if (/^24\/7$/.test(h.trim())) return t('Open 24 hours');
  return h.split(/\s*;\s*/).filter(Boolean).map(part => part
    .replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, m => D[m])
    .replace(/(\S+)-(\S+?)(?=[\s,]|$)/g, (m, a, b) => /\d/.test(a) ? m.replace('-', '–') : `${a}${LANG === 'zh' ? '至' : '–'}${b}`)
    .replace(/\boff\b|\bclosed\b/gi, t('closed'))).join(LANG === 'zh' ? '；' : '; ');
}
function detailRows(rows) {
  const r = rows.filter(x => x && x[1]);
  return r.length ? `<dl class="dl">${r.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>` : '';
}
const webLink = w => `<a href="${esc(/^https?:/.test(w) ? w : 'https://' + w)}" target="_blank" rel="noopener">${esc(w.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 40))}</a>`;
const telLink = p => `<a href="tel:${esc(p.split(/[;,]/)[0].replace(/[^\d+]/g, ''))}">${esc(p.split(/[;,]/)[0])}</a>`;
function aboutHtml(desc, wiki, open) {
  const text = desc?.[LANG] || desc?.en || desc?.zh, url = wiki?.[LANG] || wiki?.en || wiki?.zh;
  if (!text) return '';
  return `<details class="about"${open ? ' open' : ''}><summary>${t('About')}${url ? ' · Wikipedia' : ''}</summary><p>${esc(text)}${url ? ` <a class="src" href="${esc(url)}" target="_blank" rel="noopener">${t('Read more')}</a>` : ''}</p></details>`;
}
function notesHtml(id, val) {
  return `<details class="notes"${val ? ' open' : ''}><summary>${t(val ? 'Your notes' : 'Add a note')}</summary><textarea id="note-${esc(id)}" data-note="${esc(id)}" aria-label="${t('Your notes')}" placeholder="${t('Tickets, who recommended it, what to order…')}">${esc(val || '')}</textarea></details>`;
}
function bindSeg(sel, cb) { $$(sel + ' button').forEach(b => b.addEventListener('click', () => { $$(sel + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); cb(b.dataset.v); })); }
const tipIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>';

/* ---------- days ---------- */
const DAYS = PRE ? [
  { d:PD(17), slots:[['sgn','evening',.75]], fixed:[['VN678','KUL 19:50 → SGN 21:00']] },
  { d:PD(18), slots:[['sh','evening',4]], fixed:[['VN524','SGN 09:20 → PVG 14:15']] },
  { d:PD(19), city:'sh' }, { d:PD(20), city:'sh', note:'Lantern Festival: lanterns and big crowds, especially around Yu Garden.' },
  { d:PD(21), city:'sh' }, { d:PD(22), city:'sh' }, { d:PD(23), city:'sh' },
  { d:PD(24), slots:[['sh','morning',2.5],['han','evening',3]], fixed:[['VN533','PVG 15:25 → HAN 18:05']], note:'Leave for Pudong Airport by about 12:00.' },
  { d:PD(25), slots:[['han','morning',2.75]], fixed:[['VN681','HAN 14:50 → KUL 19:10']], note:'Be back at Noi Bai by 12:20.' }
] : TRIP_DAYS.filter(x => x.city || x.slots?.length || x.fixed);
// Days that are free from morning to night in one place: the ones that can become day trips.
const CHOOSABLE = PRE ? [19, 20, 21, 22, 23].map(PD) : DAYS.filter(x => !x.slots && x.city).map(x => x.d);
// Day-trip towns the guide knows, for the base cities in this trip.
const DAYTRIP_KEYS = Object.keys(CITIES).filter(k => CITIES[k].kind === 'daytrip' && BASE_KEYS.includes('sh'));
DAYS.forEach(x => {
  Object.defineProperty(x, 'cities', { get: () => daySlots(x).map(s => s[0]) });
  Object.defineProperty(x, 'free', { get: () => daySlots(x).reduce((a, s) => a + s[2], 0) });
});
const dayOf = d => DAYS.find(x => x.d === +d);
function daySlots(x) {
  // A long arrival or departure day is still held to the chosen pace.
  if (x.slots) return x.slots.map(([c, w, h]) => [c, w, Math.min(h, PACE[plan.prefs.pace])]);
  const b = plan.base[x.d] || x.city || 'sh', trip = CITIES[b]?.kind === 'daytrip';
  return [[b, 'full', PACE[plan.prefs.pace] - (trip ? CITIES[b].hrs : 0)]];
}

/* ---------- plan state ---------- */
const DEFAULT_PREFS = { pace:'balanced', interests:['history','views','food'], trips:['sz','hz'] };
let plan = tstore.get('plan2', null);
const savePlan = () => tstore.set('plan2', plan);
// The Shanghai trip used February dates (17–25) as day keys; move them to the calendar day numbers used now.
if (PRE && plan && plan.items && Object.keys(plan.items).some(k => +k < 1000)) {
  const mv = o => Object.fromEntries(Object.entries(o || {}).map(([k, v]) => [+k < 1000 ? PD(+k) : +k, v]));
  plan.items = mv(plan.items); plan.base = mv(plan.base);
  (plan.notes || []).forEach(n => { if (n && n.d && n.d < 1000) n.d = PD(n.d); });
  savePlan();
}
const getItem = id => BY[id] || plan.custom[id];
const sortKey = it => it.custom ? 5 : ({ morning: it.k === 'food' ? 0 : .5, half:1, full:1, any: it.k === 'food' ? 2.5 : 2, afternoon: it.k === 'food' ? 3.2 : 3, evening: it.k === 'food' ? 3.8 : 4 })[it.when] ?? 2;

// Plan scoring, shared by the full planner and by filling in one city when its guide arrives.
const planScore = (it, prefs) => it.tier * 10 + it.tags.filter(t => prefs.interests.includes(t)).length * 4;
const planFits = (it, win, budget) => win === 'full' ? it.when !== 'full' && (it.when !== 'half' || budget >= 7) : win === 'evening' ? ['evening','any'].includes(it.when) : ['morning','any'].includes(it.when);
// One city's share of one day: meals first, then sights, near each other where possible.
function fillSlot(x, city, win, budget, items, used, prefs) {
  const score = it => planScore(it, prefs), fits = planFits, take = it => { used.add(it.id); items[x.d].push(it.id); };
  const meals = win === 'full' || budget >= 6 ? 2 : 1;
  let left = budget - meals * .75 - items[x.d].filter(id => BY[id]?.c === city && BY[id].k === 'place').reduce((a, id) => a + BY[id].hrs, 0);
  let zone = items[x.d].map(id => BY[id]).find(i => i && i.c === city && i.k === 'place')?.zone || null;
  const pool = ITEMS.filter(i => i.c === city && i.k === 'place' && i.when !== 'full').sort((a, b) => score(b) - score(a));
  for (const pass of [0, 1]) for (const it of pool) {
    if (left < .75) break;
    if (used.has(it.id) || it.hrs > left + .1 || !fits(it, win, budget)) continue;
    if (pass === 0 && zone && !near(zone, it.zone)) continue;
    if (pass === 1 && left < 2) break;
    take(it); left -= it.hrs; zone = zone || it.zone;
  }
  const foods = ITEMS.filter(i => i.c === city && i.k === 'food' && !used.has(i.id) && fits(i, win, budget)).sort((a, b) => (near(zone, b.zone) - near(zone, a.zone)) || score(b) - score(a));
  foods.slice(0, meals - items[x.d].filter(id => BY[id]?.k === 'food' && BY[id].c === city).length).forEach(take);
}
// When a city's guide arrives after the plan exists (a trip with several cities), fill that city's empty days only.
function fillCity(k) {
  const used = new Set(Object.values(plan.items).flat());
  let added = 0;
  for (const x of DAYS) {
    plan.items[x.d] ||= [];
    if (plan.items[x.d].some(id => BY[id]?.c === k)) continue;
    for (const [city, win, budget] of daySlots(x)) if (city === k) { const n = plan.items[x.d].length; fillSlot(x, city, win, budget, plan.items, used, plan.prefs); added += plan.items[x.d].length - n; }
    plan.items[x.d].sort((a, b) => sortKey(getItem(a) || {}) - sortKey(getItem(b) || {}));
  }
  if (added) savePlan();
  return added;
}
function buildPlan(prefs) {
  const base = Object.fromEntries(CHOOSABLE.map(d => [d, dayOf(d).city || 'sh']));
  const notes = [], used = new Set(), items = Object.fromEntries(DAYS.map(x => [x.d, []]));
  // Weekdays first for day trips; keep the Lantern Festival (20th) and the hotel move (22nd) in Shanghai.
  const weekday = d => { const w = new Date(d * D).getUTCDay(); return w > 0 && w < 6; };
  const tripDays = PRE ? [19, 23, 21].map(PD) : CHOOSABLE.filter(d => dayOf(d).city === 'sh').sort((a, b) => weekday(b) - weekday(a));
  prefs.trips.filter(c => DAYTRIP_KEYS.includes(c)).forEach((c, i) => { const d = tripDays[i]; if (!d) return; base[d] = c; notes.push({ k: weekday(d) ? '{city} day trip on {day}, a weekday, so the famous sights are calmer.' : '{city} day trip on {day}.', city: c, d }); });
  plan = { ...plan, base, prefs, custom: plan?.custom || {} };
  const take = (d, it) => { used.add(it.id); items[d].push(it.id); };
  if (PRE && base[PD(20)] === 'sh') { take(PD(20), BY.yuyuan); take(PD(20), BY['f-tangyuan']); notes.push('Yu Garden on Sat 20 Feb for the Lantern Festival, with tangyuan, the festival dessert.'); }
  for (const x of DAYS) {
    for (const [city, win, budget] of daySlots(x)) fillSlot(x, city, win, budget, items, used, prefs);
    items[x.d].sort((a, b) => sortKey(BY[a]) - sortKey(BY[b]));
  }
  const left = ITEMS.filter(i => BASE_KEYS.includes(i.c) && i.k === 'place' && i.tier === 3 && !used.has(i.id));
  if (left.length) notes.push({ k: 'Not fitted in: {list}. Add it to a lighter day, or choose a faster pace.', list: left.map(i => i.id) });
  notes.push({ k: '{pace} pace: about {h} hours of sightseeing on full days.', pace: prefs.pace, h: PACE[prefs.pace] });
  plan.items = items; plan.notes = notes; plan.dirty = false;
  savePlan();
}
if (!plan || plan.v !== 2) { plan = { v:2, custom:{}, prefs: { ...DEFAULT_PREFS, trips: DAYTRIP_KEYS.slice() } }; buildPlan(plan.prefs); }
DAYS.forEach(x => { plan.items[x.d] ||= []; });

/* ---------- builder UI ---------- */
function renderBuilder() {
  const p = plan.prefs;
  $('#bPace').innerHTML = ['relaxed','balanced','packed'].map(k => `<button type="button" data-v="${k}" aria-pressed="${p.pace === k}">${t(k[0].toUpperCase() + k.slice(1))}<small>${t('{h} h/day', { h: PACE[k] })}</small></button>`).join('');
  $('#bInt').innerHTML = INTERESTS.map(([k, n]) => `<button type="button" class="pick" data-v="${k}" aria-pressed="${p.interests.includes(k)}">${t(n)}</button>`).join('');
  $('#bTripsWrap').hidden = !DAYTRIP_KEYS.length;
  $('#bTrips').innerHTML = DAYTRIP_KEYS.map(k => `<button type="button" class="pick trip" data-v="${k}" aria-pressed="${p.trips.includes(k)}"><b>${t(CITIES[k].n)}</b> <span lang="zh-CN">${LANG === 'zh' ? '' : CITIES[k].l}</span><small>${t(k === 'sz' ? 'Gardens and canals · 30 min by train' : 'West Lake and tea hills · 1 h by train')}</small></button>`).join('');
  $('#bBuild').classList.toggle('pulse', !!plan.dirty);
  $('#bNotes').innerHTML = (plan.dirty ? ['Your choices have changed. Tap Build my plan to apply them. This replaces the current stops.'] : plan.notes || []).map(n => `<li>${esc(noteText(n))}</li>`).join('');
}
$('#bPace').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; plan.prefs.pace = b.dataset.v; plan.dirty = true; savePlan(); renderBuilder(); renderDays(); });
$('#bInt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const s = new Set(plan.prefs.interests); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); plan.prefs.interests = [...s]; plan.dirty = true; savePlan(); renderBuilder(); });
$('#bTrips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const s = new Set(plan.prefs.trips); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); plan.prefs.trips = DAYTRIP_KEYS.filter(k => s.has(k)); plan.dirty = true; savePlan(); renderBuilder(); });
$('#bBuild').addEventListener('click', () => {
  buildPlan(plan.prefs); renderBuilder(); renderDays(); renderExplore();
  const n = Object.values(plan.items).flat().length;
  toast(t('Built a {pace} plan with {n} stops', { pace: t(plan.prefs.pace), n }));
  if (!reduced) $$('#days .dayc').forEach((c, i) => { c.style.animation = 'none'; void c.offsetWidth; c.style.animation = `rise .55s var(--ease) ${i * 60}ms both`; });
});
let clearArm = 0;
$('#planClear').addEventListener('click', e => {
  const b = e.currentTarget;
  if (!clearArm) { b.textContent = t('Tap again to clear'); clearArm = setTimeout(() => { clearArm = 0; b.textContent = t('Clear all stops'); }, 3000); return; }
  clearTimeout(clearArm); clearArm = 0; b.textContent = t('Clear all stops');
  DAYS.forEach(x => plan.items[x.d] = []); plan.notes = ['Plan cleared. Add stops from Explore, or build a new plan.']; savePlan(); renderBuilder(); renderDays(); renderExplore();
});

/* ---------- day cards ---------- */
const trainIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="14" rx="4"/><path d="M5 11h14M9 21l-2 0M8 17l-2 4M16 17l2 4M9 14h.01M15 14h.01"/></svg>';
const mapIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4L3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/></svg>';
const clockIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
const planeIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
function addOptions(x) {
  const inPlan = new Set(Object.values(plan.items).flat());
  return x.cities.map(c => {
    const list = ITEMS.filter(i => i.c === c && !inPlan.has(i.id)).sort((a, b) => b.tier - a.tier);
    return list.length ? `<optgroup label="${esc(cityName(c))}">${list.map(i => `<option value="${i.id}">${i.tier === 3 ? '★ ' : ''}${esc(nameOf(i))}${i.k === 'food' ? ' · ' + t('Food') : i.k === 'buy' ? ' · ' + t('Souvenirs') : ''} · ${fmtHrs(i.hrs)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function stayNotes(d) {
  const n = [];
  myStays.forEach(x => {
    const first = DAYS[0].d, last = DAYS.at(-1).d;
    if (x.from === d && d !== first) n.push(t('Check in at {name}.', { name: x.name }));
    if (x.to === d && d !== last && !myStays.some(y => y.from === d)) n.push(t('Check out of {name}. Bring your bags or ask the hotel to hold them.', { name: x.name }));
  });
  if (PRE && d === PD(21) && myStays.some(x => x.id === 'mido')) n.push(t('Mido Homestay free cancellation ends at 18:00 today.'));
  return n;
}
function renderDays() {
  const host = $('#days'); if (!host) return;
  let total = 0;
  host.innerHTML = DAYS.map(x => {
    const items = plan.items[x.d] || [], hrs = items.reduce((a, id) => a + (getItem(id)?.hrs || 0), 0); total += items.length;
    const cities = x.cities, nk = cities[cities.length - 1], w = dayWx(nk, x.d);
    const night = NIGHTS.find(n => n.d === x.d);
    const nightChip = !night ? (x.d === DAYS[0].d && x.d < DAYS.at(-1).d ? `<span class="chip out">${t('You fly out today')}</span>` : `<span class="chip ret">${t(ROUND ? 'Home tonight' : 'Trip ends')}</span>`) : night.kind === 'flight' ? `<span class="chip">${t('Night: on a flight')}</span>` : night.kind === 'booked' ? `<span class="chip good">${t('Night: {n}', { n: esc(night.short) })}</span>` : night.kind === 'open' ? '<span class="chip warn">Night: not booked</span>' : `<span class="chip">Night: transfer</span>`;
    const over = hrs > x.free + .25, b = plan.base[x.d];
    const baseSel = x.slots ? `<span>${cities.map(cityName).join(' → ')}</span>` : `<label class="sr" for="base-${x.d}">${t('Where on {day}', { day: dayLabel(x.d) })}</label><select class="sel base" id="base-${x.d}" data-base="${x.d}">${[x.city || 'sh', ...(x.city === 'sh' ? DAYTRIP_KEYS : []), ...Object.keys(plan.extra || {})].map(c => `<option value="${esc(c)}"${b === c ? ' selected' : ''}>${c === x.city || (!x.city && c === 'sh') ? esc(cityName(c)) : t('Day trip: {city}', { city: cityName(c) })}</option>`).join('')}</select>`;
    const trip = !x.slots && CITIES[b].kind === 'daytrip';
    const rainy = w.live && w.p >= 60 && items.some(id => { const it = getItem(id); return it && it.k === 'place' && !it.indoor; });
    const indoor = rainy ? ITEMS.filter(i => cities.includes(i.c) && i.indoor && !items.includes(i.id)).slice(0, 2).map(i => i.n) : [];
    return `<article class="dayc${trip ? ' trip' : ''}" aria-label="${dayLabel(x.d)}">
      <div class="day-h">
        <span class="dnum">${+isoDay(x.d).slice(8)}</span>
        <span class="dmeta"><b>${dayLabel(x.d)}</b>${baseSel}</span>
        ${w.hi === '–' ? '' : `<span class="wchip" title="${esc(w.label)}">${wIcon(w.code)}${w.hi}° / ${w.lo}°${w.live ? '' : ` <span style="color:var(--dim);font-weight:500">${t(PRE ? 'avg' : 'last yr')}</span>`}</span>`}
        ${nightChip}
      </div>
      <div class="day-b">
        ${[x.note && t(x.note), ...stayNotes(x.d)].filter(Boolean).map(n => `<div class="dnote">${esc(n)}</div>`).join('')}
        ${rainy ? `<div class="dnote rain">${t('Rain is likely ({p}%).', { p: w.p })}${indoor.length ? ' ' + esc(t('Indoor ideas: {list}.', { list: indoor.map(n => t(n)).join(LANG === 'zh' ? '、' : ', ') })) : ''}</div>` : ''}
        ${(x.fixed || []).map(([no, r]) => `<div class="fixed">${planeIcon}<b>${no}</b><span>${r}</span></div>`).join('')}
        ${trip ? `<div class="fixed train">${trainIcon}<span><b>${esc(cityName(b))}</b> · ${esc(t(CITIES[b].train))} ${esc(t(CITIES[b].leave))} ${t('Book on Trip.com or 12306 and bring your passport to board.')}</span></div>` : ''}
        ${items.length ? items.map((id, i) => { const it = getItem(id); if (!it) return '';
          const away = !it.custom && !cities.includes(it.c);
          return `<div class="item${it.custom ? ' own' : ''}">
            ${PHOTOS[it.id] ? `<img class="thumb" src="${PHOTOS[it.id].src}" alt="" loading="lazy">` : it.info?.img ? `<img class="thumb" src="${esc(it.info.img)}" alt="" loading="lazy" crossorigin="anonymous">` : `<span class="thumb ph" aria-hidden="true">${esc((it.l || it.n).slice(0, 2))}</span>`}
            <div class="imain"><div class="iname">${esc(it.custom ? it.n : nameOf(it))}${it.tier === 3 ? ' <span class="star" title="Top pick">★</span>' : ''}</div><div class="isub">${t(it.custom ? 'Your stop' : (it.k === 'food' ? 'Food' : it.k === 'buy' ? 'Souvenirs' : WHEN_LABEL[it.when]))} · ${t('about {h}', { h: fmtHrs(it.hrs) })}${away ? ` · <span style="color:var(--warn)">${t('not in {city} this day', { city: esc(cityName(it.c)) })}</span>` : ''}</div></div>
            <div class="ictl">
              <button class="ib" type="button" data-act="up" data-d="${x.d}" data-i="${i}" aria-label="${t('Move {n} earlier', { n: esc(it.n) })}"${i ? '' : ' disabled'}>↑</button>
              <button class="ib" type="button" data-act="down" data-d="${x.d}" data-i="${i}" aria-label="${t('Move {n} later', { n: esc(it.n) })}"${i < items.length - 1 ? '' : ' disabled'}>↓</button>
              <select class="sel mv" data-act="move" data-d="${x.d}" data-i="${i}" aria-label="${t('Move {n} to another day', { n: esc(it.n) })}"><option value="">Move…</option>${DAYS.filter(y => y.d !== x.d).map(y => `<option value="${y.d}">${dayShort(y.d)}</option>`).join('')}</select>
              <button class="ib" type="button" data-act="rm" data-d="${x.d}" data-i="${i}" aria-label="${t('Remove {n}', { n: esc(it.n) })}">✕</button>
            </div></div>`; }).join('') : `<p class="empty">Nothing planned yet.</p>`}
        <div class="addrow">
          <label class="sr" for="add-d${x.d}">${t('Add a stop to {day}', { day: dayLabel(x.d) })}</label>
          <select class="sel grow" id="add-d${x.d}" data-addsel="${x.d}"><option value="">+ Add a stop…</option>${addOptions(x)}<option value="__own">Something else (type your own)…</option></select>
          <span class="own-in" id="own-${x.d}" hidden><input class="txt" id="ownN-${x.d}" placeholder="e.g. Meet friends for dinner" aria-label="Your stop"><select class="sel" id="ownH-${x.d}" aria-label="How long">${[.5,1,1.5,2,3,4].map(h => `<option value="${h}"${h === 1.5 ? ' selected' : ''}>${fmtHrs(h)}</option>`).join('')}</select><button class="sbtn primary" type="button" data-own="${x.d}">Add</button></span>
        </div>
        <div class="ck-inline" id="cki-${x.d}" aria-live="polite"></div>
        ${HAS_MAP ? `<button class="sbtn daymap-btn" type="button" data-daymap="${x.d}" aria-expanded="${openDays.has(x.d)}" aria-controls="dm-${x.d}">${mapIcon}${t(openDays.has(x.d) ? 'Hide map' : 'Map & distances')}</button>
        ${openDays.has(x.d) ? `<div class="daymap" id="dm-${x.d}" role="region" aria-label="${t('Map of {day}', { day: dayLabel(x.d) })}"></div><div class="legs" id="dl-${x.d}" aria-live="polite"></div>` : ''}` : ''}
        <div class="load${over ? ' over' : ''}"><span class="lb" aria-hidden="true"><i style="width:${Math.min(100, hrs / Math.max(.5, x.free) * 100)}%"></i></span><span>${over ? t('Too much for one day:') + ' ' : ''}${t('about {h} of {f} free', { h: fmtHrs(+hrs.toFixed(1)), f: fmtHrs(+x.free.toFixed(1)) })}</span></div>
      </div>
    </article>`;
  }).join('');
  $('#planSum').textContent = t('{n} stops across {d} days. Everything below can be changed.', { n: total, d: DAYS.length });
  if (HAS_MAP && host.offsetParent !== null) restoreDayMaps();
}
function insertSorted(d, id) {
  const L = plan.items[d], k = sortKey(getItem(id));
  let i = L.findIndex(x => sortKey(getItem(x)) > k); if (i < 0) i = L.length;
  L.splice(i, 0, id);
}
$('#days').addEventListener('click', e => {
  const own = e.target.closest('[data-own]');
  if (own) {
    const d = own.dataset.own, n = $('#ownN-' + d).value.trim();
    if (!n) { $('#ownN-' + d).focus(); toast(t('Type a name for your stop first')); return; }
    if (findPlace(n)) { check(n, 'cki-' + d, d); return; }
    const id = 'u-' + Date.now().toString(36);
    plan.custom[id] = { id, n, l:'', hrs: +$('#ownH-' + d).value, hrsSet: true, custom:true, k:'place', when:'any', c: dayOf(d).cities.slice(-1)[0], added: Date.now(), info: {} };
    if (typeof enrichMine === 'function') setTimeout(() => enrichMine(id), 0);
    plan.items[d].push(id); savePlan(); renderDays(); toast(t('{name} added to {day}', { name: n, day: dayLabel(d) })); return;
  }
  const b = e.target.closest('button[data-act]'); if (!b) return;
  const act = b.dataset.act, d = +b.dataset.d, i = +b.dataset.i, L = plan.items[d];
  if (act === 'rm') L.splice(i, 1);
  if (act === 'up' && i > 0) [L[i - 1], L[i]] = [L[i], L[i - 1]];
  if (act === 'down' && i < L.length - 1) [L[i + 1], L[i]] = [L[i], L[i + 1]];
  savePlan(); renderDays(); renderExplore();
  const ni = act === 'up' ? i - 1 : act === 'down' ? i + 1 : Math.min(i, L.length - 1);
  ($(`#days button[data-act="${act}"][data-d="${d}"][data-i="${ni}"]:not([disabled])`) || $(`#add-d${d}`)).focus();
});
$('#days').addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.base) {
    const d = +t.dataset.base, c = t.value; plan.base[d] = c;
    plan.items[d] = plan.items[d].filter(id => { const it = getItem(id); return it.custom || it.c === c; });
    savePlan(); renderDays(); renderExplore();
    toast(c === 'sh' ? t('{day}: back in Shanghai', { day: dayLabel(d) }) : t('{day} is now a {city} day trip. Add stops below.', { day: dayLabel(d), city: cityName(c) }));
    return;
  }
  if (t.dataset.addsel) {
    const d = +t.dataset.addsel, v = t.value;
    if (v === '__own') { $('#own-' + d).hidden = false; $('#ownN-' + d).focus(); return; }
    if (!v) return;
    insertSorted(d, v); savePlan(); renderDays(); renderExplore(); toast(t('{name} added to {day}', { name: nameOf(BY[v]), day: dayLabel(d) })); $(`#add-d${d}`)?.focus(); return;
  }
  if (t.dataset.act === 'move' && t.value) {
    const d = +t.dataset.d, id = plan.items[d].splice(+t.dataset.i, 1)[0];
    if (!plan.items[t.value].includes(id)) insertSorted(t.value, id);
    savePlan(); renderDays(); toast(t('Moved to {day}', { day: dayLabel(t.value) }));
  }
});

/* ---------- Explore ---------- */
// Explore covers every city in the trip, plus the day-trip towns near a base city.
const EXPLORE_KEYS = PRE ? ['sh', 'sz', 'hz', 'han', 'sgn'] : [...BASE_KEYS, ...DAYTRIP_KEYS, ...STOP_KEYS.filter(k => !BASE_KEYS.includes(k))];
let xCity = EXPLORE_KEYS[0] || 'sh', xKind = 'place';
const hasGuide = k => !!CTX[k];
const PRICE_CLASS = ['', 'Budget', 'Mid-range', 'Splurge'];
const RANK_HTML = $('#xRank').innerHTML;
// Explore's header for a city whose guide comes from Wikivoyage: where it came from, and a way to rebuild it.
function autoSource(k) {
  const m = AG_META[k], el = $('#xSource');
  el.hidden = !m; if (!m) return;
  el.innerHTML = t('Guide from <a href="{url}" target="_blank" rel="noopener">Wikivoyage</a> (CC BY-SA) with photos from Wikimedia Commons, built {date}.', { url: wvUrl(m.title), date: new Date(m.at).toLocaleDateString(LOCALE(), { day:'numeric', month:'short', year:'numeric' }) })
    + ` <button class="linkbtn" type="button" data-agrefresh="${esc(k)}"${agStatus[k] === 'busy' ? ' disabled' : ''}>${t(agStatus[k] === 'busy' ? 'Updating…' : 'Update')}</button>`;
}
$('#xSource').addEventListener('click', e => { const b = e.target.closest('[data-agrefresh]'); if (b) { b.disabled = true; b.textContent = t('Updating…'); ensureAutoGuides(true); } });
function autoContext(k) {
  const st = agStatus[k], city = esc(cityName(k));
  if (st === 'busy') return `<span class="ag-busy">${t('Building a guide for {city} from Wikivoyage, the free travel guide. This takes about 20 seconds.', { city })}</span>`;
  if (st === 'none') return t('Wikivoyage has no guide for {city} yet. Add places with <b>Can I go to…?</b> on the Plan tab and they appear here with photos and details.', { city });
  if (st === 'err') return t('Couldn’t build a guide for {city}. Wikivoyage may be blocked on this network, as it is in China. It will try again next time you’re online.', { city });
  if (navigator.onLine === false) return t('A guide for {city} is built the first time you open Everywhen with internet. Until then, add places with <b>Can I go to…?</b> on the Plan tab.', { city });
  return '';
}
const COVER = { sh:['#9B80F5','#FFE08A'], sz:['#8B6CF0','#FFD95A'], hz:['#A58BFF','#FFF0B8'], han:['#B39BFF','#FFD95A'], sgn:['#8B6CF0','#F5C542'], stay:['#B9A5FF','#FFF6D6'], skip:['#E28AA8','#FFE3EC'] };
function cover(it, kindKey) {
  const ph = PHOTOS[it.id];
  const [c1, c2] = COVER[kindKey || it.c] || COVER.stay;
  const cjk = /[㐀-鿿]/.test(it.l || '');
  const glyph = cjk ? it.l.slice(0, 4) : String(it.l || it.n).split(/[–,(&]/)[0].trim();
  const tier = it.tier ? `<span class="tier ${TIER[it.tier][1]}">${it.tier === 3 ? '★ ' : ''}${t(TIER[it.tier][0])}</span>` : '';
  // A dish photo stands in for a restaurant with no photo of its own, and says so.
  const dish = ph?.dish ? `<span class="dishtag">${esc(t('Dish photo: {d}', { d: t(ph.dish) }))}</span>` : '';
  const credit = ph ? `<details class="credit"><summary aria-label="Photo credit">i</summary><span>${t('Photo:')} <a href="${ph.page}" target="_blank" rel="noopener">${esc(ph.by)}</a> · ${esc(ph.license)}</span></details>` : '';
  return `<div class="cover${ph ? ' photo' : ''}" style="--c1:${c1};--c2:${c2}">${ph ? `<img src="${ph.src}" alt="${esc(it.tier ? nameOf(it) : t(it.n))}" loading="lazy" decoding="async">` : `<span class="glyph${cjk ? '' : ' latin'}" aria-hidden="true">${esc(glyph)}</span>`}${tier}${dish}${credit}</div>`;
}
function dayChoices(city) {
  if (CITIES[city].kind === 'daytrip') return CHOOSABLE.map(d => `<option value="${d}">${dayShort(d)}${plan.base[d] === city ? '' : ' · ' + t('make it a day trip')}</option>`).join('');
  return DAYS.filter(x => x.cities.includes(city)).map(x => `<option value="${x.d}">${dayShort(x.d)}</option>`).join('')
    || CHOOSABLE.map(d => `<option value="${d}">${dayShort(d)} · ${t('switch back to {city}', { city: cityName(city) })}</option>`).join('');
}
/* Food spots: local price with a ringgit estimate, a map link (Amap in China, where Google is blocked; Google Maps in Vietnam) */
const CUR = c => CITIES[c].lang === 'zh' ? 'CNY' : 'VND';
function priceText(c, [lo, hi], unit = 'per person') {
  const cur = CUR(c), r = cur === HOME_CUR ? 1 : +rates[cur], k = n => n >= 1000 ? Math.round(n / 1000) + 'k' : n;
  const local = cur === 'CNY' ? `¥${lo}–${hi}` : `${k(lo)}–${k(hi)} ₫`;
  const rm = cur !== HOME_CUR && r > 0 ? ` · ≈ ${HOME_SYM} ${Math.round(lo / r)}–${Math.round(hi / r)}` : '';
  return t('{p} ' + unit, { p: local + rm });
}
function mapUrl(c, s) {
  if (CITIES[c].lang === 'zh') return `https://uri.amap.com/search?keyword=${encodeURIComponent(s.l)}&city=${encodeURIComponent(CITIES[c].l)}&callnative=1`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.n + ', ' + s.a + ', ' + CITIES[c].n)}`;
}
function spotsHtml(it) {
  const zh = CITIES[it.c].lang === 'zh', pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  return `<div class="spots"><div class="spots-h">${t(it.k === 'buy' ? 'Where to buy' : 'Where to eat')}</div><ul>${it.spots.map((s, i) => {
    const name = LANG === 'zh' && zh ? s.l : s.n, sub = zh && LANG !== 'zh' ? s.l : '';
    const addr = LANG === 'zh' && zh ? s.al : t(s.a);
    return `<li class="spot">
      <div class="spot-top"><b>${esc(name)}</b>${sub ? `<span class="local" lang="zh-CN">${esc(sub)}</span>` : ''}</div>
      <div class="spot-addr">${pin}<span>${esc(addr)}</span></div>
      <div class="spot-meta"><span class="spot-price">${priceText(it.c, s.p, it.unit)}</span>${s.note ? `<span class="spot-note">${esc(t(s.note))}</span>` : ''}</div>
      ${(dx => dx.hours || dx.phone ? `<div class="spot-extra">${dx.hours ? `<span>${clockIcon}${esc(fmtHours(dx.hours))}</span>` : ''}${dx.phone ? `<span>${telLink(dx.phone)}</span>` : ''}</div>` : '')(DETAILS[`s-${it.id}-${i}`] || {})}
      <div class="spot-acts"><a class="sbtn" href="${mapUrl(it.c, s)}" target="_blank" rel="noopener">${t(zh ? 'Open in Amap' : 'Open in Google Maps')}</a>${/\d|Rd|St|Lane/.test(s.a) ? `<button class="sbtn" type="button" data-spot="${it.id}:${i}">${t('Show to driver')}</button>` : ''}</div>
    </li>`; }).join('')}</ul><p class="spots-foot">${t('Prices are estimates. Rates from the Money tab.')}</p></div>`;
}
function renderExplore() {
  const kind = xKind;
  syncCityButtons();
  const own = !hasGuide(xCity), auto = !!AG_META[xCity];
  autoSource(xCity);
  $('#xRank').innerHTML = auto ? t('Sights are sorted by how widely known they are around the world: ★ Top pick, then Worth it, then If you have time. Restaurants and shops keep the order Wikivoyage’s writers gave them. Places you added yourself come first, marked Yours.') : RANK_HTML;
  const nights = AG_META[xCity]?.nights;
  $('#xContext').innerHTML = own ? autoContext(xCity) || (plan.extra?.[xCity] ? t('Your own day trip to {city}. Places you add there appear here with their details.', { city: esc(cityName(xCity)) }) : t('There’s no hand-picked guide for {city} yet. Add places with <b>Can I go to…?</b> on the Plan tab and they appear here with photos and details.', { city: esc(cityName(xCity)) })) : auto ? (kind === 'buy' ? esc(BUY_TIP[xCity] || t('Markets, malls and shops picked by Wikivoyage’s writers.')) : kind === 'stay' ? esc(STAY_TIP[xCity] || t('Areas of {city} to stay in.', { city: cityName(xCity) })) : kind === 'skip' ? t('Safety advice and common scams in {city}, from Wikivoyage.', { city: esc(cityName(xCity)) })
      : (nights ? t(nights === 1 ? 'You have <b>1 night</b> in {city}.' : 'You have <b>{n} nights</b> in {city}.', { n: nights, city: esc(cityName(xCity)) }) + ' ' : '') + CTX[xCity])
    : kind === 'buy' ? esc(t(BUY_TIP[xCity])) : kind === 'stay' ? esc(t(STAY_TIP[xCity])) : kind === 'skip' ? t('These are the tourist traps, scams and overrated spots we <b>don’t</b> recommend in {city}, and what to do instead.', { city: esc(cityName(xCity)) }) : t(CTX[xCity]);
  $('#xRank').hidden = kind === 'stay' || kind === 'skip';
  const g = $('#xGrid');
  if (kind === 'stay' || kind === 'skip') renderExploreMap([], kind);
  if (kind === 'stay') {
    g.innerHTML = (STAYS[xCity] || []).map((s, i) => s.auto ? `<article class="xcard">${cover({ id:`stay-${xCity}-${i}`, n:s.n, l:s.n }, 'stay')}<div class="xbody"><h3>${esc(s.n)}</h3>
      ${s.price ? `<div class="chips"><span class="chip gold">${esc(s.price.slice(0, 60))}</span></div>` : ''}${s.d ? `<p>${esc(s.d)}</p>` : ''}
      ${detailRows([[t('Address'), s.addr && esc(s.addr)], [t('Website'), s.web && webLink(s.web)]])}
      ${s.wv ? `<div class="acts"><a class="sbtn" href="${esc(s.wv)}" target="_blank" rel="noopener">${t('Read the area guide')}</a></div>` : ''}</div></article>` : `<article class="xcard">${cover({ id:`stay-${xCity}-${i}`, n:s.n, l:s.n }, 'stay')}<div class="xbody"><h3>${esc(t(s.n))}</h3><div class="chips"><span class="chip good">${t('Best for: {x}', { x: esc(t(s.best)) })}</span></div>
      <dl class="dl"><dt>${t('Good')}</dt><dd>${esc(t(s.good))}</dd><dt>${t('Watch')}</dt><dd>${esc(t(s.watch))}</dd></dl><div class="how">${esc(t(s.how))}</div></div></article>`).join('');
    return;
  }
  if (kind === 'skip') {
    g.innerHTML = (SKIPS[xCity] || []).map(s => s.auto ? `<article class="xcard skip safe"><div class="xbody"><h3>${t('Stay safe in {city}', { city: esc(cityName(xCity)) })}</h3>${s.paras.map(p => `<p>${esc(p)}</p>`).join('')}</div></article>` : `<article class="xcard skip"><div class="xbody">
      <span class="chip bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/></svg>${t('Not recommended')}</span>
      <h3>${esc(t(s.n))}</h3>${s.l ? `<div class="local" lang="${CITIES[xCity].lang === 'zh' ? 'zh-CN' : 'vi'}">${esc(s.l)}</div>` : ''}
      <p><b>${t('Why:')}</b> ${esc(t(s.why))}</p><div class="instead"><b>${t('Instead:')}</b> ${esc(t(s.instead))}</div></div></article>`).join('');
    return;
  }
  const inPlan = Object.entries(plan.items);
  const list = ITEMS.filter(i => i.c === xCity && i.k === kind).map((it, ix) => ({ it, ix })).sort((a, b) => b.it.tier - a.it.tier || a.ix - b.ix).map(o => o.it);
  const mine = mineList().filter(m => MINE_CITY(m.c) === xCity && mineKind(m) === kind), off = mine.length;
  $('#xRank').hidden = !list.length;
  if (!list.length && !mine.length) {
    g.innerHTML = `<div class="mine-empty glass"><b>${t('Nothing here yet.')}</b><p>${t('Places you add in {city} with Can I go to…? on the Plan tab will appear here with their details.', { city: esc(cityName(xCity)) })}</p></div>`;
    renderExploreMap([], kind); return;
  }
  g.innerHTML = mine.map(mineCard).join('') + list.map((it, i) => {
    const ix = i + off, dt = DETAILS[it.id] || {};
    const pinned = kind === 'place' || it.auto ? !!COORDS[it.id] : (it.spots || []).some((s, k) => spotLL(it, k));
    const on = inPlan.filter(([, ids]) => ids.includes(it.id)).map(([d]) => dayShort(+d));
    const lng = CITIES[it.c].lang === 'zh' ? 'zh-CN' : it.auto ? phr(langOf(ccOfKey(it.c))).speech : 'vi';
    return `<article class="xcard" data-id="${it.id}">${cover(it)}<div class="xbody">
      <div><h3>${HAS_MAP && pinned ? `<button class="xnum" type="button" data-fly="${it.id}" title="${t('Show on map')}" aria-label="${t('Show {n} on the map', { n: esc(nameOf(it)) })}">${ix + 1}</button>` : ''}${esc(nameOf(it))}</h3>${LANG === 'zh' && hasCJK(it.l) ? `<div class="local">${esc(it.n)}</div>` : it.l !== it.n ? `<div class="local" lang="${lng}">${esc(it.l)}</div>` : ''}</div>
      <div class="chips">${it.k === 'place' ? `<span class="chip out">${t(WHEN_LABEL[it.when])}</span><span class="chip">${fmtHrs(it.hrs)}</span>` : it.auto ? (it.pc ? `<span class="chip gold">${t(PRICE_CLASS[it.pc])}</span>` : '') + (it.price ? `<span class="chip">${esc(it.price.slice(0, 40))}</span>` : '') : it.spots?.length ? `<span class="chip gold">${priceText(it.c, [Math.min(...it.spots.map(s => s.p[0])), Math.max(...it.spots.map(s => s.p[1]))], it.unit)}</span>` : ''}${it.area ? `<span class="chip">${esc(it.area)}</span>` : ''}${on.length ? `<span class="chip good">${t('In plan · {days}', { days: on.join(', ') })}</span>` : ''}</div>
      ${it.why ? `<p class="why">${esc(t(it.why))}</p>` : ''}
      ${it.d ? `<p>${esc(t(it.d))}</p>` : ''}
      ${it.tip ? `<div class="tip">${tipIcon}<span>${esc(t(it.tip))}</span></div>` : ''}
      ${aboutHtml(dt.desc, dt.wiki)}
      ${it.auto ? detailRows([
        [t('Address'), dt.addr && `<span lang="${lng}">${esc(dt.addr)}</span>`],
        [t('Opening hours'), dt.hours && esc(dt.hours)],
        [t('Getting there'), it.how && esc(it.how)],
        [t('Entry'), it.k === 'place' && it.price && esc(it.price)],
        [t('Phone'), dt.phone && telLink(dt.phone)],
        [t('Website'), dt.web && webLink(dt.web)],
        [t('Read more'), dt.wiki?.en && `<a href="${esc(dt.wiki.en)}" target="_blank" rel="noopener">Wikipedia</a>`]
      ]) : it.k === 'place' ? detailRows([
        [t('Address'), dt.addr && `<span lang="${lng}">${esc(dt.addr)}</span>`],
        [t('Opening hours'), dt.hours && esc(fmtHours(dt.hours))],
        [t('Getting there'), it.how && esc(t(it.how))],
        [t('Phone'), dt.phone && telLink(dt.phone)],
        [t('Website'), dt.web && webLink(dt.web)]
      ]) : it.spots?.length ? spotsHtml(it) : `<div class="how">${esc(t('Try: {w}', { w: t(it.where) }))}</div>`}
      ${notesHtml(it.id, CARD_NOTES[it.id])}
      <div class="acts">
        <select class="sel" id="add-${it.id}" aria-label="${t('Day to add {n} to', { n: esc(nameOf(it)) })}">${dayChoices(it.c)}</select>
        <button class="sbtn primary" type="button" data-add="${it.id}">Add to plan</button>
        <button class="sbtn" type="button" data-show="${it.id}">${it.auto ? t('Show to driver') : it.k === 'food' ? 'Show to order' : it.k === 'buy' ? 'Show to shop' : 'Show to driver'}</button>
        ${CITIES[it.c].lang === 'zh' ? `<button class="sbtn" type="button" data-copy="${it.id}" title="Copy the Chinese name to check live reviews">Reviews</button>` : ''}
      </div>
    </div></article>`;
  }).join('');
  renderExploreMap([...mine, ...list], kind);
  enrichVisible(mine);
}
$('#xGrid').addEventListener('click', async e => {
  const a = e.target.closest('[data-add]'), s = e.target.closest('[data-show]'), c = e.target.closest('[data-copy]'), sp = e.target.closest('[data-spot]');
  if (sp) {
    const [id, ix] = sp.dataset.spot.split(':'), it = BY[id], x = it.spots[+ix], lg = CITIES[it.c].lang === 'zh' ? 'zh' : 'vi';
    const addr = lg === 'zh' ? x.al : x.a;
    openShow((lg === 'zh' ? '请带我去：' : 'Làm ơn đưa tôi đến: ') + x.l, addr, t('Please take me to: {n}', { n: x.n + ' · ' + x.a }), lg);
    return;
  }
  if (a) {
    const id = a.dataset.add, d = +$('#add-' + id).value, it = BY[id];
    if (!dayOf(d).slots && plan.base[d] !== it.c) { plan.base[d] = it.c; plan.items[d] = plan.items[d].filter(x => { const y = getItem(x); return y.custom || y.c === it.c; }); }
    if (!plan.items[d].includes(id)) insertSorted(d, id);
    savePlan(); renderExplore(); renderDays();
    toast(CITIES[it.c].kind === 'daytrip' ? t('{name} added. {day} is a {city} day trip.', { name: nameOf(it), day: dayLabel(d), city: cityName(it.c) }) : t('{name} added to {day}', { name: nameOf(it), day: dayLabel(d) }));
    $(`[data-add="${id}"]`)?.focus();
  }
  if (s && BY[s.dataset.show]?.auto) {
    const it = BY[s.dataset.show], lg = langOf(ccOfKey(it.c));
    openShow((lg === 'zh' ? '请带我去：' : lg === 'vi' ? 'Làm ơn đưa tôi đến: ' : phr(lg).lead) + (it.l || it.n), DETAILS[it.id]?.addr || '', t('Please take me to: {n}', { n: it.n }), lg);
  } else if (s) {
    const it = BY[s.dataset.show], lg = CITIES[it.c].lang === 'zh' ? 'zh' : 'vi';
    const text = it.k === 'food' ? (lg === 'zh' ? '我想要这个：' : 'Cho tôi món này: ') + it.l : it.k === 'buy' ? (lg === 'zh' ? '我想买这个：' : 'Tôi muốn mua cái này: ') + it.l : (lg === 'zh' ? '请带我去：' : 'Làm ơn đưa tôi đến: ') + it.l;
    openShow(text, it.k === 'place' ? DETAILS[it.id]?.addr || '' : '', t(it.k === 'food' ? 'I’d like this: {n}' : it.k === 'buy' ? 'I’d like to buy this: {n}' : 'Please take me to: {n}', { n: nameOf(it) }), lg);
  }
  if (c) {
    const it = BY[c.dataset.copy];
    try { await navigator.clipboard.writeText(it.l); toast(t('Copied {n}. Paste it into Dianping or Trip.com for live reviews.', { n: it.l })); }
    catch { toast(t('Search {n} on Dianping (大众点评) or Trip.com for live reviews', { n: it.l })); }
  }
});
$('#xCity').addEventListener('click', e => {
  const b = e.target.closest('button[data-v]'); if (!b) return;
  $$('#xCity button').forEach(x => x.setAttribute('aria-pressed', x === b)); xCity = b.dataset.v; renderExplore();
});
// Day trips you added yourself (e.g. Wuzhen) get their own city button once you have places there.
function syncCityButtons() {
  const host = $('#xCity'), want = Object.keys(plan.extra || {}).filter(c => mineList().some(m => m.c === c));
  if (!host.querySelector('button:not([data-extra])')) host.innerHTML = EXPLORE_KEYS.map(k => `<button type="button" data-v="${esc(k)}" aria-pressed="${k === xCity}">${esc(cityName(k))}</button>`).join('');
  $$('#xCity button[data-extra]').forEach(b => { if (!want.includes(b.dataset.v)) { if (xCity === b.dataset.v) { xCity = EXPLORE_KEYS[0]; $(`#xCity [data-v="${CSS.escape(xCity)}"]`)?.setAttribute('aria-pressed', 'true'); } b.remove(); } });
  want.forEach(c => { if (!host.querySelector(`[data-v="${CSS.escape(c)}"]`)) host.insertAdjacentHTML('beforeend', `<button type="button" data-v="${esc(c)}" data-extra="1" aria-pressed="${xCity === c}">${esc(cityName(c))}</button>`); });
}
bindSeg('#xKind', v => { xKind = v; renderExplore(); });
