/* ================= "Can I go to…?" — judges any place against this trip =================
   1. Our guide, the Skip list and the gazetteer, matched by name, alias or near-miss spelling (offline).
   2. Live search: Photon suggestions while typing, OpenStreetMap Nominatim on Check, with "did you mean"
      when a name is ambiguous. Place type, coordinates and opening hours drive the estimate.
   3. Claude (claude.ai viewer only, through the `sample` capability) when live search is blocked or finds
      nothing, and as a second opinion on demand.
   Verdicts weigh travel time, time needed, free hours per day, stops already planned nearby, weekends,
   the Lantern Festival, the hotel move, opening days and the short Hanoi / Ho Chi Minh City stops. */
const COORDS = __COORDS__;
const LL = { sh:[31.2304, 121.4737], han:[21.0285, 105.8542], sgn:[10.7725, 106.698] };
const SPOTS = { bund:[31.2400, 121.4900], pvg:[31.1443, 121.8083], hongqiao:[31.1945, 121.3207] };
const HUBS = [ // bullet-train cities: typical door-to-door minutes from central Shanghai
  ['Suzhou','苏州',31.2989,120.5853,75], ['Kunshan','昆山',31.385,120.98,60], ['Wuxi','无锡',31.4912,120.3119,80], ['Changzhou','常州',31.8107,119.9741,95],
  ['Nanjing','南京',32.0603,118.7969,120], ['Zhenjiang','镇江',32.188,119.424,125], ['Yangzhou','扬州',32.3942,119.4129,150], ['Jiaxing','嘉兴',30.7461,120.7555,60],
  ['Hangzhou','杭州',30.2741,120.1551,100], ['Shaoxing','绍兴',30.03,120.58,130], ['Ningbo','宁波',29.8683,121.544,150], ['Huzhou','湖州',30.8927,120.0868,110]
];
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fmtKm = d => d < 1 ? t('{n} m', { n: Math.round(d * 100) * 10 }) : t('{n} km', { n: d < 10 ? d.toFixed(1) : Math.round(d) });
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd')
  .replace(/\b(the|water town|ancient town|old town)\b/g, ' ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const isCJK = s => /[㐀-鿿]/.test(s || '');
const fmtMins = m => m < 60 ? t('{n} min', { n: Math.max(5, Math.round(m / 5) * 5) }) : fmtHrs(Math.round(m / 30) / 2);
const MODE = { train:'bullet train', metro:'metro', bus:'bus or tour coach', car:'car or DiDi', ferry:'bus and ferry', flight:'flight', walk:'on foot' };
const LEVEL = {
  great:['Great fit','good'], good:['Good fit','good'], long:['Possible, but a long day','warn'], overnight:['Needs a night away','warn'],
  no:['Not a good fit for this trip','bad'], skip:['We don’t recommend it','bad'], unknown:['Not found','']
};
Object.assign(CITIES, plan.extra || {});
Object.entries(plan.extra || {}).forEach(([k, v]) => CITYN[k] = v.n);

/* ---------- offline matching: exact, alias, contains, near-miss spelling ---------- */
function lev(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 9;
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
  }
  return m[a.length][b.length];
}
function offlinePool() {
  return [
    ...Object.entries(SKIPS).flatMap(([c, list]) => list.map(s => ({ kind:'skip', c, s, names:[s.n, s.l] }))),
    ...ITEMS.map(it => ({ kind:'item', it, names:[it.n, it.l, ...(it.aka || [])] })),
    ...PLACES.map(p => ({ kind:'place', p, names:[p.n, p.zh, ...(p.aka || [])] }))
  ];
}
function findPlace(q) {
  const raw = q.trim(), f = fold(raw); if (!raw) return null;
  const pool = offlinePool();
  const eq = a => a && (fold(a) === f || a === raw);
  const part = a => a && (isCJK(raw) ? (a.includes(raw) || (raw.length >= 2 && raw.includes(a))) : f.length >= 3 && (fold(a).includes(f) || (fold(a).length >= 4 && f.includes(fold(a)))));
  const near = a => { if (!a || isCJK(a) || f.length < 4) return false; const g = fold(a); return lev(f, g) <= (f.length >= 7 ? 2 : 1); };
  return pool.find(x => x.names.some(eq)) || pool.find(x => x.kind === 'place' && x.names.some(part)) || pool.find(x => x.names.some(part)) || pool.find(x => x.names.some(near)) || null;
}
function suggestOffline(q, n = 6) {
  const f = fold(q); if (f.length < 2 && !isCJK(q)) return [];
  const score = x => Math.max(...x.names.filter(Boolean).map(a => { const g = fold(a); if (isCJK(q)) return a.includes(q) ? 3 : 0; if (g.startsWith(f)) return 3; if (g.split(' ').some(w => w.startsWith(f))) return 2; if (g.includes(f)) return 1.5; return f.length >= 4 && lev(f, g.slice(0, f.length)) <= 1 ? 1 : 0; }));
  return offlinePool().map(x => [x, score(x)]).filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1]).slice(0, n).map(([x]) => x);
}
const offlineLabel = x => x.kind === 'item' ? { name: nameOf(x.it), sub: `${t(TIER[x.it.tier][0])} · ${cityName(x.it.c)}` } : x.kind === 'skip' ? { name: t(x.s.n), sub: t('Not recommended') } : { name: LANG === 'zh' ? x.p.zh : t(x.p.n), sub: LANG === 'zh' ? x.p.n : x.p.zh };

/* ---------- live data: Photon (typing) and Nominatim (check) ---------- */
function classify(cat, type, rank) {
  const T = {
    'tourism:theme_park':[8,'theme park'], 'tourism:zoo':[4,'zoo'], 'tourism:aquarium':[3,'aquarium',1], 'tourism:museum':[2.5,'museum',1], 'tourism:gallery':[1.5,'gallery',1],
    'tourism:attraction':[1.5,'attraction'], 'tourism:viewpoint':[.75,'viewpoint'], 'tourism:artwork':[.5,'artwork'],
    'amenity:restaurant':[1.25,'restaurant',1], 'amenity:cafe':[.75,'café',1], 'amenity:fast_food':[.5,'quick meal',1], 'amenity:bar':[1.5,'bar',1], 'amenity:pub':[1.5,'bar',1],
    'amenity:food_court':[.75,'food court',1], 'amenity:theatre':[2.5,'theatre',1], 'amenity:cinema':[2.5,'cinema',1], 'amenity:place_of_worship':[1,'temple or church'],
    'amenity:marketplace':[1.5,'market'], 'amenity:library':[1,'library',1], 'leisure:park':[1.5,'park'], 'leisure:garden':[1.5,'garden'], 'leisure:nature_reserve':[3,'nature reserve'],
    'leisure:water_park':[5,'water park'], 'leisure:stadium':[3,'stadium'], 'shop:mall':[2.5,'shopping mall',1], 'shop:department_store':[2,'department store',1],
    'place:city':[8,'city'], 'place:town':[6,'town'], 'place:village':[4,'village'], 'place:island':[6,'island'], 'natural:peak':[5,'mountain'], 'natural:water':[3,'lake'], 'natural:beach':[3,'beach']
  };
  const k = `${cat}:${type}`;
  if (/^tourism:(hotel|guest_house|hostel|apartment|motel|chalet)$/.test(k)) return { stay:true, hrs:0, kind:'place to stay' };
  if (/^(aeroway|railway)/.test(cat) || /station|aerodrome/.test(type)) return { hrs:.5, kind:'station or airport', transport:true };
  if (T[k]) return { hrs:T[k][0], kind:T[k][1], indoor:!!T[k][2] };
  if (cat === 'boundary' || cat === 'place') return rank <= 12 ? { hrs:24, kind:'region' } : rank <= 16 ? { hrs:8, kind:'city' } : { hrs:2, kind:'district' };
  if (cat === 'shop') return { hrs:.75, kind:'shop', indoor:true };
  if (cat === 'historic') return { hrs:1.5, kind:'historic site' };
  if (cat === 'natural') return { hrs:3, kind:'nature' };
  return { hrs:1.5, kind:'place' };
}
function travelFrom(ll) {
  let [from, d] = Object.entries(LL).map(([k, v]) => [k, km(ll, v)]).sort((a, b) => a[1] - b[1])[0];
  if (from !== 'sh' && d > 300) { from = 'sh'; d = km(ll, LL.sh); }
  if (from !== 'sh') return { from, dist:d, mins: d <= 30 ? 15 + d * 2.5 : 30 + d * 1.3, mode:'car' };
  if (d <= 35) return { from, dist:d, mins: d <= 1.2 ? 15 : 15 + d * 2, mode: d <= 1.2 ? 'walk' : 'metro' };
  const hub = HUBS.map(h => [h, km(ll, [h[2], h[3]])]).sort((a, b) => a[1] - b[1])[0];
  if (hub && hub[1] <= 30) return { from, dist:d, mins: hub[0][4] + 10 + hub[1] * 2.2, mode:'train', hub: hub[0] };
  if (d <= 180) return { from, dist:d, mins: 25 + d * 1.25, mode: d <= 70 ? 'car' : 'bus' };
  if (d <= 1300) return { from, dist:d, mins: 60 + d / 220 * 60, mode:'train' };
  return { from, dist:d, mins: 210 + d / 750 * 60, mode:'flight' };
}
function fromOSM(r) {
  const lat = +(r.lat ?? r.geometry?.coordinates?.[1]), lon = +(r.lon ?? r.geometry?.coordinates?.[0]);
  const p = r.properties || {};
  const nd = r.namedetails || {}, name = r.name || p.name || (r.display_name || '').split(',')[0];
  const zh = nd['name:zh'] || nd['name:zh-Hans'] || (isCJK(nd.name) ? nd.name : '') || (isCJK(name) ? name : '');
  const en = nd['name:en'] || (!isCJK(name) ? name : '') || name;
  const c = classify(r.category || r.class || p.osm_key, r.type || p.osm_value, r.place_rank ?? 30);
  const tr = travelFrom([lat, lon]);
  const where = r.address ? [r.address.city || r.address.town || r.address.county || r.address.state, r.address.country].filter(Boolean).join(', ') : [p.city || p.county || p.state, p.country].filter(Boolean).join(', ');
  return { n: en, zh, ll:[lat, lon], mins: Math.round(tr.mins), mode: tr.mode, from: tr.from, dist: tr.dist, hub: tr.hub, hrs: c.hrs, indoor: c.indoor, stay: c.stay, transport: c.transport, osmKind: c.kind, where, hours: r.extratags?.opening_hours || '', importance: r.importance || 0,
    osm: (r.osm_type || p.osm_type) && (r.osm_id || p.osm_id) ? { type: r.osm_type || p.osm_type, id: r.osm_id || p.osm_id } : null };
}
async function geocode(q) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&addressdetails=1&namedetails=1&extratags=1&accept-language=en&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal: ctl.signal }); clearTimeout(to);
  if (!res.ok) throw new Error('http');
  const list = (await res.json()).map(fromOSM).filter(p => isFinite(p.ll[0]));
  // Prefer places near the trip, then by importance; drop near-duplicates.
  list.sort((a, b) => ((b.dist < 400) - (a.dist < 400)) || (b.importance - a.importance));
  return list.filter((p, i) => list.findIndex(o => km(o.ll, p.ll) < 1) === i);
}
let acCtl = null;
async function photon(q) {
  acCtl?.abort(); acCtl = new AbortController();
  const res = await fetch(`https://photon.komoot.io/api/?limit=6&lat=31.23&lon=121.47&q=${encodeURIComponent(q)}`, { signal: acCtl.signal });
  return (await res.json()).features.map(f => fromOSM({ ...f, properties: f.properties, geometry: f.geometry, category: f.properties.osm_key, type: f.properties.osm_value, place_rank: f.properties.type === 'city' ? 16 : 30 }));
}

/* ---------- judging ---------- */
const freeLeft = d => { const x = dayOf(d); return x.free - (plan.items[d] || []).reduce((a, id) => a + (getItem(id)?.hrs || 0), 0); };
const itemLL = id => COORDS[id] || plan.custom[id]?.ll || null;
function nearbyPlanned(ll, city = 'sh') {
  if (!ll) return [];
  return DAYS.filter(x => x.cities.includes(city)).flatMap(x => (plan.items[x.d] || []).map(id => { const c = itemLL(id); return c ? { d: x.d, it: getItem(id), dist: km(ll, c) } : null; })).filter(Boolean).sort((a, b) => a.dist - b.dist);
}
function bestShanghaiDay(need, pref, ll, avoid = []) {
  const days = [18, ...CHOOSABLE, 24].filter(d => dayOf(d).cities.includes('sh') && !avoid.includes(d));
  if (pref && days.includes(+pref) && freeLeft(pref) >= need - .25) return { day: +pref };
  const close = nearbyPlanned(ll).find(n => n.dist <= 2.5 && days.includes(n.d) && freeLeft(n.d) >= need - .25);
  if (close) return { day: close.d, near: close };
  const penalty = d => (d === 22 ? 3 : 0) + (d === 20 ? 1 : 0) + (d === 18 || d === 24 ? 1.5 : 0);
  return { day: days.map(d => [d, Math.min(freeLeft(d), need + 2) - penalty(d)]).sort((a, b) => b[1] - a[1])[0]?.[0] || 19 };
}
function bestTripDay(pref, avoid = []) {
  const order = [19, 23, 21, 22, 20].filter(d => !avoid.includes(d)), free = order.filter(d => (plan.base[d] || 'sh') === 'sh');
  if (pref && CHOOSABLE.includes(+pref)) return +pref;
  return free.sort((a, b) => (plan.items[a].length - plan.items[b].length) || (order.indexOf(a) - order.indexOf(b)))[0] || order[0] || 19;
}
function dayNotes(d, outdoor) {
  const n = [];
  if (d === 20) n.push(t('Sat 20 Feb is the Lantern Festival, so expect big crowds everywhere.'));
  else if (d === 21) n.push(t('Sunday: popular sights are much busier at weekends.'));
  myStays.filter(x => x.from === d).forEach(x => n.push(t('You check in at {name} that day, so allow time for it.', { name: x.name })));
  const w = dayWx('sh', d); if (outdoor && w.live && w.p >= 60) n.push(t('Rain is likely that day ({p}%).', { p: w.p }));
  return n;
}
const closedMonday = h => /\bMo\b[^;]*\b(off|closed)\b/i.test(h) || /^\s*Tu-Su\b/i.test(h);
function assess(m, pref) {
  if (m.kind === 'skip') return { level:'skip', name: m.s.n, local: m.s.l, city: m.c, reasons:[t(m.s.why)], instead: m.s.instead, src:'guide' };
  if (m.kind === 'item') {
    const it = m.it, c = it.c;
    if (c === 'han' || c === 'sgn') {
      const d = dayOf(c === 'han' ? (it.when === 'morning' ? 25 : 24) : 17), slot = daySlots(d).find(s => s[0] === c), ok = it.hrs <= slot[2];
      return { level: ok ? 'good' : 'no', name: it.n, local: it.l, city: c, item: it, day: d.d, src:'guide', reasons: [ok ? t('Fits your {city} stop on {day}.', { city: cityName(c), day: dayLabel(d.d) }) : t('Your {city} stop is too short for this.', { city: cityName(c) })] };
    }
    const planned = DAYS.find(x => (plan.items[x.d] || []).includes(it.id));
    if (planned) return { level: 'great', name: it.n, local: it.l, city: c, item: it, day: planned.d, src:'guide', already: true, reasons: [t(TIER[it.tier][0]) + ' · ' + t(it.why), t('Already in your plan on {day}.', { day: dayLabel(planned.d) })] };
    const trip = CITIES[c].kind === 'daytrip';
    const pick = trip ? { day: Object.keys(plan.base).map(Number).find(d => plan.base[d] === c) || bestTripDay(pref) } : bestShanghaiDay(it.hrs, pref, COORDS[it.id]);
    const reasons = [t(TIER[it.tier][0]) + ' · ' + t(it.why), trip ? t('A day trip from Shanghai: {train}', { train: t(CITIES[c].train) }) : t('In Shanghai, so it fits into any day with time to spare.')];
    if (pick.near && pick.near.it.id !== it.id) reasons.push(t('{dist} from {place}, already on {day}, so do them together.', { dist: fmtKm(pick.near.dist), place: nameOf(pick.near.it), day: dayLabel(pick.near.d) }));
    return { level: it.tier === 3 || trip ? 'great' : 'good', name: it.n, local: it.l, city: c, item: it, day: pick.day, need: it.hrs, src:'guide', reasons: [...reasons, ...dayNotes(pick.day, !it.indoor)] };
  }
  const p = m.p || m.live, live = !!m.live;
  if (live && p.stay) return assessStay(p);
  const each = p.mins, round = each * 2 / 60, need = round + p.hrs, pace = PACE[plan.prefs.pace];
  const base = { name: p.n, local: p.zh || '', city: p.from, place: p, facts: { each, hrs: p.hrs, mode: p.mode }, src: live ? 'live' : 'guide', note: p.note, hours: p.hours, where: p.where, kindLabel: p.osmKind };
  const avoid = p.hours && closedMonday(p.hours) ? [22] : [];
  const extra = [];
  if (avoid.length) extra.push(t('Its listed opening hours suggest it is closed on Mondays, so we avoided Mon 22.'));
  if (p.transport) extra.push(t('This looks like a station or airport rather than a sight.'));
  if (p.from === 'han' || p.from === 'sgn') {
    const stop = p.from === 'han' ? t('Your Hanoi stop is one evening and one morning, about 6 waking hours in total.') : t('Your Ho Chi Minh City stop is a short night: you land at 21:00 and leave the city by 06:50.');
    const ok = each <= 40 && p.hrs <= 2 && p.from === 'han';
    return { ...base, level: ok ? 'good' : 'no', day: ok ? 24 : null, need, reasons: [stop, t('This needs about {need} including {each} each way.', { need: fmtHrs(Math.round(need * 2) / 2), each: fmtMins(each) }), ...extra], instead: ok ? '' : t('Save it for a future trip, or see what fits in Explore.') };
  }
  if (each <= 60 && p.hrs <= 4) {
    const pick = bestShanghaiDay(need, pref, p.ll, avoid);
    const r = [p.mode === 'walk' ? t('Right in central Shanghai, walkable from the main sights.') : t('Inside Shanghai, {each} each way by {mode}.', { each: fmtMins(each), mode: t(MODE[p.mode]) })];
    if (pick.near) r.push(t('{dist} from {place}, already on {day}, so do them together.', { dist: fmtKm(pick.near.dist), place: nameOf(pick.near.it), day: dayLabel(pick.near.d) }));
    return { ...base, level: each <= 45 ? 'great' : 'good', day: pick.day, need, inCity: true, reasons: [...r, ...extra, ...dayNotes(pick.day, !p.indoor)] };
  }
  if (p.from === 'sh' && each <= 75 && p.hrs >= 4) {
    const pick = bestShanghaiDay(p.hrs + round, pref, p.ll, [22, 20, ...avoid]);
    return { ...base, level:'good', day: pick.day, need, inCity: true, reasons: [t('A full day out inside Shanghai: {each} each way by {mode}.', { each: fmtMins(each), mode: t(MODE[p.mode]) }), pick.day === 20 || pick.day === 21 ? t('Your free weekdays already have day trips, so the weekend is the best fit.') : t('A weekday, so it will be calmer.'), ...extra, ...dayNotes(pick.day, !p.indoor)] };
  }
  const day = bestTripDay(pref, avoid);
  const via = p.hub ? ' ' + t('(bullet train via {city})', { city: LANG === 'zh' ? p.hub[1] : p.hub[0] }) : '';
  if (each <= 100 && need <= pace + 2) return { ...base, level:'good', day, need, trip:true, reasons: [t('A comfortable day trip: {each} each way by {mode}.', { each: fmtMins(each), mode: t(MODE[p.mode]) }) + via, ...extra, ...dayNotes(day, true)] };
  if (each <= 160 && need <= 13) return { ...base, level:'long', day, need, trip:true, reasons: [t('{each} each way by {mode}, so about {round} of travel in one day.', { each: fmtMins(each), mode: t(MODE[p.mode]), round: fmtHrs(Math.round(round * 2) / 2) }) + via, t('Leave by about 07:30 and expect to be back late.'), ...extra, ...dayNotes(day, true)] };
  if (each <= 300) {
    const open = NIGHTS.filter(n => n.kind === 'open').map(n => n.d);
    return { ...base, level:'overnight', day, need, trip:true, reasons: [t('{each} each way by {mode}. That is too much travel for one day.', { each: fmtMins(each), mode: t(MODE[p.mode]) }), open.length ? t('You still have {n} unbooked nights ({days} Feb), so you could spend one of them there instead.', { n: open.length, days: open.join(', ') }) : '', ...extra].filter(Boolean) };
  }
  if (p.dist > 1500) return { ...base, level:'no', need, reasons: [t('About {km} from Shanghai, roughly {each} each way by air including airports.', { km: fmtKm(p.dist), each: fmtMins(each) }), t('This belongs to a different trip.')] };
  return { ...base, level:'no', need, reasons: [t('About {each} each way by {mode}.', { each: fmtMins(each), mode: t(MODE[p.mode]) }), t('It would take at least 2 of your 6 Shanghai days just to get there and back.')], instead: t('Closer alternatives with a similar feel: Suzhou, Hangzhou or Nanjing.') };
}
function assessStay(p) {
  const base = { name: p.n, local: p.zh || '', place: p, src:'live', stay:true, where: p.where, kindLabel: p.osmKind };
  if (p.from !== 'sh') return { ...base, level: p.dist <= 5 ? 'good' : 'long', reasons: [t('{dist} from the centre of {city}.', { dist: fmtKm(p.dist), city: cityName(p.from) })] };
  const ps = km(p.ll, LL.sh), bund = km(p.ll, SPOTS.bund), pvg = km(p.ll, SPOTS.pvg), hq = km(p.ll, SPOTS.hongqiao);
  const level = ps <= 6 ? 'great' : ps <= 15 ? 'good' : ps <= 30 ? 'long' : 'no';
  return { ...base, level, reasons: [
    t('{a} from People’s Square and {b} from the Bund.', { a: fmtKm(ps), b: fmtKm(bund) }),
    t('{a} to Pudong Airport (your flights) and {b} to Hongqiao Station (day-trip trains).', { a: fmtKm(pvg), b: fmtKm(hq) }),
    level === 'great' ? t('A central base: most sights are a short metro ride away.') : level === 'good' ? t('Fine as a base, with some longer metro rides.') : t('Far from the sights. Expect long rides every day.'),
    t('Check the listing says it can register foreign guests.')
  ] };
}

/* ---------- Claude (claude.ai viewer only) ---------- */
let sampleFn = null;
(window.claude?.use ? window.claude.use('sample') : Promise.resolve(null)).then(s => { sampleFn = s; if (s) $$('.v-claude').forEach(b => b.hidden = false); }).catch(() => {});
function tripContext() {
  const days = DAYS.map(x => `${dayLabel(x.d)}: ${x.cities.map(c => CITYN[c]).join(' → ')}, ${(+x.free.toFixed(1))} h free, ${Math.max(0, +freeLeft(x.d).toFixed(1))} h still unplanned${x.note ? ' (' + x.note + ')' : ''}`).join('\n');
  return `Trip (2027): fly Kuala Lumpur → Ho Chi Minh City 17 Feb (land 21:00, overnight, fly on at 09:20), Shanghai 18 Feb 14:15 → 24 Feb 15:25 (Lantern Festival 20 Feb; ${myStays.map(x => `staying at ${x.name} ${x.from}–${x.to} Feb`).join('; ') || 'no hotels booked'}; nights not booked yet: ${NIGHTS.filter(n => n.kind === 'open').map(n => n.d + ' Feb').join(', ') || 'none'}), Hanoi 24 Feb 18:05 → 25 Feb 14:50 (must be back at the airport 12:20), home to Kuala Lumpur. Traveller holds a Malaysian passport, uses public transport and DiDi/Grab, pace about ${PACE[plan.prefs.pace]} h of sightseeing a day.\nDays:\n${days}`;
}
async function askClaude(q, pref, host, hostId) {
  if (!sampleFn) throw { code:'not_available' };
  const ctl = new AbortController();
  host.innerHTML = `<div class="tr-res loading"><span class="shimmer"></span><span class="shimmer short"></span><span class="status">${t('Asking Claude…')}</span><button class="sbtn" type="button" id="stop-${hostId}">${t('Stop')}</button></div>`;
  $('#stop-' + hostId).onclick = () => ctl.abort();
  const lang = LANG === 'zh' ? 'Simplified Chinese' : 'English';
  const prompt = `You are a careful travel planner. Decide whether a place the traveller typed suits THIS trip, and when to go.\n\n${tripContext()}\n\nPlace typed: "${q.slice(0, 200)}"${pref ? `\nThe traveller is looking at ${dayLabel(pref)}.` : ''}\n\nRules: identify the most likely real place (the traveller is probably asking about somewhere near Shanghai, Suzhou, Hangzhou, Hanoi or Ho Chi Minh City). Estimate realistic door-to-door travel time from the relevant trip city by the best public option. level: "great" or "good" (fits easily), "long" (possible as a long day trip), "overnight" (needs a night there), "no" (too far or doesn't fit), "skip" (a known tourist trap or scam). best_day: the day-of-month number (17–25) that fits best, or null. Keep reasons short, concrete and honest; if you are unsure of opening days or prices, say so. Write names and reasons in ${lang}.\n\nReply with only this JSON: {"found":true,"name":"English name","local_name":"Chinese or Vietnamese name","where":"city, country","kind":"museum|temple|park|town|city|restaurant|hotel|…","from":"sh|han|sgn","minutes_each_way":60,"mode":"metro|car|bus|train|ferry|flight|walk","hours_needed":2,"level":"good","best_day":21,"reasons":["…","…"],"tip":"…","instead":""}\nIf you cannot identify the place, reply {"found":false,"suggestions":["up to 3 likely places"]}.`;
  const j = await sampleFn.json(prompt, { signal: ctl.signal });
  if (!j || j.found === false) return { level:'unknown', name: q, reasons: [t('Claude couldn’t identify this place.')], suggestions: (j?.suggestions || []).slice(0, 3).map(String), src:'claude' };
  const lv = ['great','good','long','overnight','no','skip'].includes(j.level) ? j.level : 'good';
  const from = ['sh','han','sgn'].includes(j.from) ? j.from : 'sh', mins = Math.max(5, +j.minutes_each_way || 30), hrs = Math.max(.5, Math.min(24, +j.hours_needed || 2));
  const mode = MODE[j.mode] ? j.mode : 'car', day = DAYS.some(x => x.d === +j.best_day) ? +j.best_day : null;
  const place = { n: String(j.name || q), zh: String(j.local_name || ''), from, mins, mode, hrs };
  return { level: lv, name: place.n, local: place.zh, city: from, place, facts: { each: mins, hrs, mode }, day, need: mins / 30 + hrs, trip: from === 'sh' && mins > 60 && !['no','skip'].includes(lv), inCity: from === 'sh' && mins <= 60,
    reasons: (Array.isArray(j.reasons) ? j.reasons : []).slice(0, 5).map(String), note: j.tip ? String(j.tip) : '', instead: j.instead ? String(j.instead) : '', where: j.where ? String(j.where) : '', kindLabel: j.kind ? String(j.kind) : '', src:'claude' };
}

/* ---------- UI ---------- */
const VIcon = { good:'<path d="M5 12.5l4.5 4.5L19 7.5"/>', warn:'<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.01"/>', bad:'<circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/>', '':'<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5M12 17v.01"/>' };
const SRC = { guide:'From our guide', live:'Live from OpenStreetMap · travel times are estimates', claude:'Checked by Claude · confirm details before you go' };
let lastVerdict = {};
function verdictHtml(v, hostId, alts = []) {
  lastVerdict[hostId] = { v, alts };
  const [label, tone] = LEVEL[v.level], canAdd = !['skip','no','unknown'].includes(v.level) && v.day && !v.stay && !v.already;
  const dayOpts = (v.trip || (v.item && CITIES[v.item.c].kind === 'daytrip') ? CHOOSABLE : DAYS.map(x => x.d)).map(d => `<option value="${d}"${d === v.day ? ' selected' : ''}>${dayShort(d)}</option>`).join('');
  const f = v.facts;
  const title = LANG === 'zh' && isCJK(v.local) ? `<b>${esc(v.local)}</b> <span>${esc(v.name)}</span>` : `<b>${esc(t(v.name))}</b>${v.local && v.local !== v.name ? ` <span lang="${isCJK(v.local) ? 'zh-CN' : 'vi'}">${esc(v.local)}</span>` : ''}`;
  return `<div class="verdict ${tone}">
    <div class="v-head"><span class="v-badge ${tone}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${VIcon[tone]}</svg>${t(label)}</span>${v.src ? `<span class="chip">${t(SRC[v.src])}</span>` : ''}</div>
    <div class="v-name">${title}${v.where || v.kindLabel ? `<small>${esc([v.kindLabel ? t(v.kindLabel) : '', v.where].filter(Boolean).join(' · '))}</small>` : ''}</div>
    ${alts.length ? `<div class="tr-ex"><span class="eyebrow">${t('Did you mean')}</span>${alts.map((a, i) => `<button class="pill" type="button" data-alt="${hostId}:${i}">${esc(LANG === 'zh' && a.zh ? a.zh : a.n)}${a.where ? ` · ${esc(a.where)}` : ''}</button>`).join('')}</div>` : ''}
    ${f ? `<div class="v-facts"><span><small>${t('Each way')}</small><b>${fmtMins(f.each)}</b></span><span><small>${t('Time there')}</small><b>${fmtHrs(f.hrs >= 24 ? 24 : f.hrs)}${f.hrs >= 24 ? '+' : ''}</b></span><span><small>${t('By')}</small><b>${t(MODE[f.mode])}</b></span>${v.day ? `<span><small>${t('Best day')}</small><b>${dayShort(v.day)}</b></span>` : ''}</div>` : ''}
    <ul class="v-why">${v.reasons.map(r => `<li>${esc(r)}</li>`).join('')}${v.note ? `<li>${esc(t(v.note))}</li>` : ''}${v.hours ? `<li>${esc(t('Opening hours listed on OpenStreetMap: {h}', { h: v.hours }))}</li>` : ''}</ul>
    ${v.instead ? `<div class="instead"><b>${t('Instead:')}</b> ${esc(t(v.instead))}</div>` : ''}
    ${v.suggestions?.length ? `<div class="tr-ex"><span class="eyebrow">${t('Did you mean')}</span>${v.suggestions.map(s => `<button class="pill" type="button" data-q="${esc(s)}" data-host="${hostId}">${esc(s)}</button>`).join('')}</div>` : ''}
    <div class="v-acts">
      ${canAdd ? `<label class="sr" for="vd-${hostId}">${t('Day')}</label><select class="sel" id="vd-${hostId}">${dayOpts}</select><button class="btn" type="button" data-vadd="${hostId}">${t('Add to plan')}</button>` : ''}
      ${!canAdd && !v.stay && v.level !== 'skip' ? `<label class="sr" for="vd-${hostId}">${t('Day')}</label><select class="sel" id="vd-${hostId}">${DAYS.map(x => `<option value="${x.d}">${dayShort(x.d)}</option>`).join('')}</select><button class="sbtn" type="button" data-vadd="${hostId}" data-anyway="1">${t('Add anyway')}</button>` : ''}
      ${v.stay && v.place?.from === 'sh' ? `<button class="btn" type="button" data-hotel="${hostId}">${t('Use for my driver card')}</button>` : ''}
      ${v.src !== 'claude' ? `<button class="sbtn v-claude" type="button" data-claude="${hostId}"${sampleFn ? '' : ' hidden'}>${t('Ask Claude')}</button>` : ''}
    </div>
  </div>`;
}
const lastQuery = {};
async function check(q, hostId, pref, preset) {
  const host = $('#' + hostId); if (!host) return;
  lastQuery[hostId] = { q, pref };
  const m = preset ? null : findPlace(q);
  if (m) { host.innerHTML = verdictHtml(assess(m, pref), hostId); return; }
  let list = preset ? [preset] : null;
  if (!list && navigator.onLine !== false) {
    host.innerHTML = `<div class="tr-res loading"><span class="shimmer"></span><span class="shimmer short"></span><span class="status">${t('Searching live…')}</span></div>`;
    try { list = await geocode(q); } catch { list = null; }
  }
  if (list?.length) {
    const top = list[0], alts = list.slice(1, 4).filter(a => km(a.ll, top.ll) > 30);
    host.innerHTML = verdictHtml(assess({ kind:'live', live: top }, pref), hostId, alts);
    lastVerdict[hostId].all = list;
    return;
  }
  if (sampleFn) {
    try { host.innerHTML = verdictHtml(await askClaude(q, pref, host, hostId), hostId); return; }
    catch (e) { if (e?.code === 'cancelled') { host.innerHTML = ''; return; } }
  }
  const sugg = suggestOffline(q, 3).map(x => offlineLabel(x).name);
  host.innerHTML = verdictHtml({ level:'unknown', name: q, reasons: [navigator.onLine === false ? t('You’re offline and this place isn’t in our offline guide.') : list === null ? t('Live search isn’t reachable from here. Try again with internet, or add it as your own stop.') : t('We couldn’t find this place. Check the spelling, or add it as your own stop.')], suggestions: sugg, day: pref ? +pref : null }, hostId);
}
function addVerdict(hostId, anyway) {
  const { v } = lastVerdict[hostId], d = +$('#vd-' + hostId).value, x = dayOf(d);
  if (v.item) {
    const it = v.item;
    if (!x.slots && plan.base[d] !== it.c && CITIES[it.c].kind === 'daytrip') { plan.base[d] = it.c; plan.items[d] = plan.items[d].filter(id => { const y = getItem(id); return y.custom || y.c === it.c; }); }
    if (!plan.items[d].includes(it.id)) insertSorted(d, it.id);
  } else {
    const p = v.place || {}, id = 'u-' + Date.now().toString(36);
    let c = v.inCity ? 'sh' : p.from || 'sh';
    if (v.trip && !x.slots) {
      c = 'x-' + (p.id || fold(p.n).replace(/\s+/g, '-').slice(0, 30));
      plan.extra = plan.extra || {};
      plan.extra[c] = { n: p.n, l: p.zh || p.n, lang:'zh', kind:'daytrip', train: t('{mode} from Shanghai, about {each} each way.', { mode: t(MODE[p.mode]).replace(/^./, s => s.toUpperCase()), each: fmtMins(p.mins) }), leave: t('Leave early.'), hrs: Math.round(p.mins * 4 / 60) / 2 };
      CITIES[c] = plan.extra[c]; CITYN[c] = p.n;
      plan.base[d] = c; plan.items[d] = plan.items[d].filter(i => getItem(i).custom);
    }
    plan.custom[id] = { id, n: LANG === 'zh' && p.zh ? p.zh : v.name, l: p.zh || v.local || '', hrs: Math.min(p.hrs || 2, 8), custom: true, k:'place', when:'any', c, indoor: !!p.indoor, ll: p.ll || null,
      osm: p.osm || null, added: Date.now(), verdict: { level: v.level, lang: LANG, reasons: (v.reasons || []).filter(Boolean).slice(0, 3) },
      info: { kind: p.osmKind || '', hours: p.hours || '', where: p.where || '', trip: p.mins ? { mins: p.mins, mode: p.mode, from: p.from } : null } };
    plan.items[d].push(id);
    if (typeof enrichMine === 'function') enrichMine(id);
  }
  savePlan(); renderDays(); renderExplore();
  toast(t('{name} added to {day}', { name: LANG === 'zh' && v.local && isCJK(v.local) ? v.local : t(v.name), day: dayLabel(d) }) + (anyway ? ' · ' + t('Check the timing carefully') : ''));
  $('#' + hostId).innerHTML = '';
}
async function useAsHotel(hostId) {
  const p = lastVerdict[hostId].v.place;
  let name = p.zh || p.n, text = '';
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=zh-CN&lat=${p.ll[0]}&lon=${p.ll[1]}`);
    const j = await r.json(); text = (j.display_name || '').split(', ').reverse().filter(s => !/^\d{6}$/.test(s) && s !== '中国').join('');
  } catch {}
  const free = NIGHTS.find(n => n.kind === 'open');
  openStay(null, { name, addr: text, city: 'sh', from: free ? free.d : 18 });
}
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-vadd]'); if (b) { addVerdict(b.dataset.vadd, !!b.dataset.anyway); return; }
  const a = e.target.closest('[data-alt]');
  if (a) { const [hostId, i] = a.dataset.alt.split(':'); const st = lastVerdict[hostId]; const pick = st.alts[+i]; const rest = (st.all || []).filter(x => x !== pick).slice(0, 3); $('#' + hostId).innerHTML = verdictHtml(assess({ kind:'live', live: pick }, lastQuery[hostId]?.pref), hostId, rest); lastVerdict[hostId].all = st.all; return; }
  const c = e.target.closest('[data-claude]');
  if (c) { const hostId = c.dataset.claude, host = $('#' + hostId), lq = lastQuery[hostId]; try { host.innerHTML = verdictHtml(await askClaude(lq.q, lq.pref, host, hostId), hostId); } catch (err) { host.innerHTML = verdictHtml(lastVerdict[hostId].v, hostId); if (err?.code && err.code !== 'cancelled') toast(t(err.code === 'rate_limited' ? 'Claude is busy. Try again in a moment.' : err.code === 'not_granted' ? 'Claude wasn’t allowed for this page.' : 'Claude couldn’t answer this time.')); } return; }
  const h = e.target.closest('[data-hotel]'); if (h) { useAsHotel(h.dataset.hotel); return; }
  const sq = e.target.closest('[data-q][data-host]'); if (sq) { $('#ckQ').value = sq.dataset.q; check(sq.dataset.q, sq.dataset.host); }
});

/* ---------- search box with live suggestions ---------- */
const ckQ = $('#ckQ'), ckList = $('#ckList');
let acItems = [], acIdx = -1, acTimer = 0;
function renderAC() {
  ckList.hidden = !acItems.length; ckQ.setAttribute('aria-expanded', String(!!acItems.length));
  ckList.innerHTML = acItems.map((x, i) => `<li role="option" id="ac-${i}" aria-selected="${i === acIdx}" data-ac="${i}"><span class="ac-ic ${x.live ? 'live' : 'guide'}" aria-hidden="true"></span><span><b>${esc(x.label)}</b><small>${esc(x.sub || '')}</small></span></li>`).join('');
  if (acIdx >= 0) ckQ.setAttribute('aria-activedescendant', 'ac-' + acIdx); else ckQ.removeAttribute('aria-activedescendant');
}
function closeAC() { acItems = []; acIdx = -1; renderAC(); }
function pickAC(i) {
  const x = acItems[i]; if (!x) return;
  ckQ.value = x.label; closeAC();
  if (x.live) check(x.label, 'ckOut', null, x.live); else check(x.q, 'ckOut');
}
ckQ.addEventListener('input', () => {
  clearTimeout(acTimer);
  const q = ckQ.value.trim();
  if (q.length < 2 && !isCJK(q)) { closeAC(); return; }
  const off = suggestOffline(q, 5).map(x => { const l = offlineLabel(x); return { label: l.name, sub: l.sub, q: x.kind === 'item' ? x.it.n : x.kind === 'skip' ? x.s.n : x.p.n }; });
  acItems = off; acIdx = -1; renderAC();
  acTimer = setTimeout(async () => {
    if (navigator.onLine === false) return;
    try {
      const live = (await photon(q)).filter(p => p.n && !off.some(o => fold(o.label) === fold(p.n)));
      if (ckQ.value.trim() !== q) return;
      acItems = [...off, ...live.slice(0, 6 - Math.min(off.length, 3)).map(p => ({ label: LANG === 'zh' && p.zh ? p.zh : p.n, sub: [t(p.osmKind), p.where].filter(Boolean).join(' · '), live: p }))].slice(0, 8);
      renderAC();
    } catch {}
  }, 320);
});
ckQ.addEventListener('keydown', e => {
  if (!acItems.length) return;
  if (e.key === 'ArrowDown') { e.preventDefault(); acIdx = (acIdx + 1) % acItems.length; renderAC(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); acIdx = (acIdx - 1 + acItems.length) % acItems.length; renderAC(); }
  else if (e.key === 'Enter' && acIdx >= 0) { e.preventDefault(); pickAC(acIdx); }
  else if (e.key === 'Escape') closeAC();
});
ckList.addEventListener('mousedown', e => { const li = e.target.closest('[data-ac]'); if (li) { e.preventDefault(); pickAC(+li.dataset.ac); } });
ckQ.addEventListener('blur', () => setTimeout(closeAC, 150));
$('#ckForm').addEventListener('submit', e => { e.preventDefault(); closeAC(); const q = ckQ.value.trim(); if (!q) { ckQ.focus(); return; } check(q, 'ckOut'); });
$('#ckEx').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (!b) return; ckQ.value = b.dataset.q; check(b.dataset.q, 'ckOut'); });
