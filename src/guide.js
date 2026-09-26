/* ================= Smart planner + Explore ================= */
const PHOTOS = __PHOTOS__;
const CITYN = Object.fromEntries(Object.entries(CITIES).map(([k, v]) => [k, v.n]));
const CKEY = { KUL:'kul', SGN:'sgn', HAN:'han', PVG:'sh' };
const TIER = { 3:['Top pick','top'], 2:['Worth it','worth'], 1:['If you have time','maybe'] };
const WHEN_LABEL = { morning:'Morning', afternoon:'Afternoon', evening:'Evening', any:'Any time', half:'Half day', full:'Full day' };
const PACE = { relaxed:6, balanced:8, packed:10 };
const ZONE_NEAR = { bund:['oldcity','pudong','center'], oldcity:['bund','french'], pudong:['bund'], center:['bund','french'], french:['center','oldcity'], lake:['hills'], hills:['lake'], north:['west'], west:['north'], oldq:['west'] };
const near = (a, b) => !a || a === b || (ZONE_NEAR[a] || []).includes(b);
const fmtHrs = h => LANG === 'zh' ? (h < 1 ? Math.round(h * 60) + '分钟' : (+h.toFixed(1)) + '小时') : (h < 1 ? Math.round(h * 60) + ' min' : (+h.toFixed(1)) + ' h');
const hasCJK = s => /[\u3400-\u9fff]/.test(s || '');
const nameOf = it => LANG === 'zh' && hasCJK(it.l) ? it.l : t(it.n);
const cityName = c => t(CITYN[c]);
const noteText = n => typeof n === 'string' ? t(n) : t(n.k, { city: n.city ? cityName(n.city) : '', day: n.d ? dayLabel(n.d) : '', list: (n.list || []).map(id => BY[id] ? nameOf(BY[id]) : id).join(LANG === 'zh' ? '、' : ', '), pace: n.pace ? t(n.pace[0].toUpperCase() + n.pace.slice(1)) : '', h: n.h || '' });
const dayLabel = d => F('Asia/Shanghai', { weekday:'short', day:'numeric', month:'short' }).format(at(2027, 2, d, 12, 0, 8));
const dayShort = d => F('Asia/Shanghai', { weekday:'short', day:'numeric' }).format(at(2027, 2, d, 12, 0, 8));
function bindSeg(sel, cb) { $$(sel + ' button').forEach(b => b.addEventListener('click', () => { $$(sel + ' button').forEach(x => x.setAttribute('aria-pressed', x === b)); cb(b.dataset.v); })); }
const tipIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/></svg>';

/* ---------- days ---------- */
const CHOOSABLE = [19, 20, 21, 22, 23];
const DAYS = [
  { d:17, slots:[['sgn','evening',.75]], fixed:[['VN678','KUL 19:50 → SGN 21:00']] },
  { d:18, slots:[['sh','evening',4]], fixed:[['VN524','SGN 09:20 → PVG 14:15']] },
  { d:19 }, { d:20, note:'Lantern Festival: lanterns and big crowds, especially around Yu Garden.' },
  { d:21, note:'Mido Homestay free cancellation ends at 18:00 today.' },
  { d:22, note:'Check in at Shanghai Mido Resort Homestay.' }, { d:23 },
  { d:24, slots:[['sh','morning',2.5],['han','evening',3]], fixed:[['VN533','PVG 15:25 → HAN 18:05']], note:'Leave for Pudong Airport by about 12:00.' },
  { d:25, slots:[['han','morning',2.75]], fixed:[['VN681','HAN 14:50 → KUL 19:10']], note:'Be back at Noi Bai by 12:20.' }
];
DAYS.forEach(x => {
  Object.defineProperty(x, 'cities', { get: () => daySlots(x).map(s => s[0]) });
  Object.defineProperty(x, 'free', { get: () => daySlots(x).reduce((a, s) => a + s[2], 0) });
});
const dayOf = d => DAYS.find(x => x.d === +d);
function daySlots(x) {
  if (x.slots) return x.slots;
  const b = plan.base[x.d] || 'sh', trip = CITIES[b].kind === 'daytrip';
  return [[b, 'full', PACE[plan.prefs.pace] - (trip ? CITIES[b].hrs : 0)]];
}

/* ---------- plan state ---------- */
const DEFAULT_PREFS = { pace:'balanced', interests:['history','views','food'], trips:['sz','hz'] };
let plan = store.get('plan2', null);
const savePlan = () => store.set('plan2', plan);
const getItem = id => BY[id] || plan.custom[id];
const sortKey = it => it.custom ? 5 : ({ morning: it.k === 'food' ? 0 : .5, half:1, full:1, any: it.k === 'food' ? 2.5 : 2, afternoon: it.k === 'food' ? 3.2 : 3, evening: it.k === 'food' ? 3.8 : 4 })[it.when] ?? 2;

function buildPlan(prefs) {
  const base = Object.fromEntries(CHOOSABLE.map(d => [d, 'sh']));
  const notes = [], used = new Set(), items = Object.fromEntries(DAYS.map(x => [x.d, []]));
  // Weekdays first for day trips; keep the Lantern Festival (20th) and the hotel move (22nd) in Shanghai.
  const tripDays = [19, 23, 21];
  prefs.trips.forEach((c, i) => { const d = tripDays[i]; if (!d) return; base[d] = c; notes.push({ k: d === 21 ? '{city} day trip on {day}.' : '{city} day trip on {day}, a weekday, so the famous sights are calmer.', city: c, d }); });
  plan = { ...plan, base, prefs, custom: plan?.custom || {} };
  const score = it => it.tier * 10 + it.tags.filter(t => prefs.interests.includes(t)).length * 4;
  const fits = (it, win, budget) => win === 'full' ? it.when !== 'full' && (it.when !== 'half' || budget >= 7) : win === 'evening' ? ['evening','any'].includes(it.when) : ['morning','any'].includes(it.when);
  const take = (d, it) => { used.add(it.id); items[d].push(it.id); };
  if (base[20] === 'sh') { take(20, BY.yuyuan); take(20, BY['f-tangyuan']); notes.push('Yu Garden on Sat 20 Feb for the Lantern Festival, with tangyuan, the festival dessert.'); }
  for (const x of DAYS) {
    for (const [city, win, budget] of daySlots(x)) {
      const meals = win === 'full' ? 2 : 1;
      // Reserve time for meals first, then fill the rest with sights.
      let left = budget - meals * .75 - items[x.d].filter(id => BY[id].c === city && BY[id].k === 'place').reduce((a, id) => a + BY[id].hrs, 0);
      let zone = items[x.d].map(id => BY[id]).find(i => i.c === city && i.k === 'place')?.zone || null;
      const pool = ITEMS.filter(i => i.c === city && i.k === 'place' && i.when !== 'full').sort((a, b) => score(b) - score(a));
      for (const pass of [0, 1]) for (const it of pool) {
        if (left < .75) break;
        if (used.has(it.id) || it.hrs > left + .1 || !fits(it, win, budget)) continue;
        if (pass === 0 && zone && !near(zone, it.zone)) continue;
        if (pass === 1 && left < 2) break;
        take(x.d, it); left -= it.hrs; zone = zone || it.zone;
      }
      const foods = ITEMS.filter(i => i.c === city && i.k === 'food' && !used.has(i.id) && fits(i, win, budget)).sort((a, b) => score(b) - score(a));
      foods.slice(0, meals - items[x.d].filter(id => BY[id].k === 'food' && BY[id].c === city).length).forEach(f => take(x.d, f));
    }
    items[x.d].sort((a, b) => sortKey(BY[a]) - sortKey(BY[b]));
  }
  const left = ITEMS.filter(i => i.c === 'sh' && i.k === 'place' && i.tier === 3 && !used.has(i.id));
  if (left.length) notes.push({ k: 'Not fitted in: {list}. Add it to a lighter day, or choose a faster pace.', list: left.map(i => i.id) });
  notes.push({ k: '{pace} pace: about {h} hours of sightseeing on full days.', pace: prefs.pace, h: PACE[prefs.pace] });
  plan.items = items; plan.notes = notes; plan.dirty = false;
  savePlan();
}
if (!plan || plan.v !== 2) { plan = { v:2, custom:{}, prefs: { ...DEFAULT_PREFS } }; buildPlan(plan.prefs); }

/* ---------- builder UI ---------- */
function renderBuilder() {
  const p = plan.prefs;
  $('#bPace').innerHTML = ['relaxed','balanced','packed'].map(k => `<button type="button" data-v="${k}" aria-pressed="${p.pace === k}">${t(k[0].toUpperCase() + k.slice(1))}<small>${t('{h} h/day', { h: PACE[k] })}</small></button>`).join('');
  $('#bInt').innerHTML = INTERESTS.map(([k, n]) => `<button type="button" class="pick" data-v="${k}" aria-pressed="${p.interests.includes(k)}">${t(n)}</button>`).join('');
  $('#bTrips').innerHTML = ['sz','hz'].map(k => `<button type="button" class="pick trip" data-v="${k}" aria-pressed="${p.trips.includes(k)}"><b>${t(CITIES[k].n)}</b> <span lang="zh-CN">${LANG === 'zh' ? '' : CITIES[k].l}</span><small>${t(k === 'sz' ? 'Gardens and canals · 30 min by train' : 'West Lake and tea hills · 1 h by train')}</small></button>`).join('');
  $('#bBuild').classList.toggle('pulse', !!plan.dirty);
  $('#bNotes').innerHTML = (plan.dirty ? ['Your choices have changed. Tap Build my plan to apply them. This replaces the current stops.'] : plan.notes || []).map(n => `<li>${esc(noteText(n))}</li>`).join('');
}
$('#bPace').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; plan.prefs.pace = b.dataset.v; plan.dirty = true; savePlan(); renderBuilder(); renderDays(); });
$('#bInt').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const s = new Set(plan.prefs.interests); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); plan.prefs.interests = [...s]; plan.dirty = true; savePlan(); renderBuilder(); });
$('#bTrips').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; const s = new Set(plan.prefs.trips); s.has(b.dataset.v) ? s.delete(b.dataset.v) : s.add(b.dataset.v); plan.prefs.trips = ['sz','hz'].filter(k => s.has(k)); plan.dirty = true; savePlan(); renderBuilder(); });
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
const planeIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>';
function addOptions(x) {
  const inPlan = new Set(Object.values(plan.items).flat());
  return x.cities.map(c => {
    const list = ITEMS.filter(i => i.c === c && !inPlan.has(i.id)).sort((a, b) => b.tier - a.tier);
    return list.length ? `<optgroup label="${esc(cityName(c))}">${list.map(i => `<option value="${i.id}">${i.tier === 3 ? '★ ' : ''}${esc(nameOf(i))}${i.k === 'food' ? ' · ' + t('Food') : ''} · ${fmtHrs(i.hrs)}</option>`).join('')}</optgroup>` : '';
  }).join('');
}
function renderDays() {
  const host = $('#days'); if (!host) return;
  let total = 0;
  host.innerHTML = DAYS.map(x => {
    const items = plan.items[x.d] || [], hrs = items.reduce((a, id) => a + (getItem(id)?.hrs || 0), 0); total += items.length;
    const cities = x.cities, nk = cities[cities.length - 1], w = dayWx(nk, x.d);
    const night = NIGHTS.find(n => n.d === x.d);
    const nightChip = !night ? '<span class="chip ret">Home tonight</span>' : night.kind === 'booked' ? '<span class="chip good">Night: Mido Homestay</span>' : night.kind === 'open' ? '<span class="chip warn">Night: not booked</span>' : `<span class="chip">Night: transfer</span>`;
    const over = hrs > x.free + .25, b = plan.base[x.d];
    const baseSel = x.slots ? `<span>${cities.map(cityName).join(' → ')}</span>` : `<label class="sr" for="base-${x.d}">${t('Where on {day}', { day: dayLabel(x.d) })}</label><select class="sel base" id="base-${x.d}" data-base="${x.d}">${['sh','sz','hz', ...Object.keys(plan.extra || {})].map(c => `<option value="${c}"${b === c ? ' selected' : ''}>${c === 'sh' ? t('Shanghai') : t('Day trip: {city}', { city: cityName(c) })}</option>`).join('')}</select>`;
    const trip = !x.slots && CITIES[b].kind === 'daytrip';
    const rainy = w.live && w.p >= 60 && items.some(id => { const it = getItem(id); return it && it.k === 'place' && !it.indoor; });
    const indoor = rainy ? ITEMS.filter(i => cities.includes(i.c) && i.indoor && !items.includes(i.id)).slice(0, 2).map(i => i.n) : [];
    return `<article class="dayc${trip ? ' trip' : ''}" aria-label="${dayLabel(x.d)}">
      <div class="day-h">
        <span class="dnum">${x.d}</span>
        <span class="dmeta"><b>${dayLabel(x.d)}</b>${baseSel}</span>
        <span class="wchip" title="${esc(w.label)}">${wIcon(w.code)}${w.hi}° / ${w.lo}°${w.live ? '' : ' <span style="color:var(--dim);font-weight:500">avg</span>'}</span>
        ${nightChip}
      </div>
      <div class="day-b">
        ${x.note ? `<div class="dnote">${esc(t(x.note))}</div>` : ''}
        ${rainy ? `<div class="dnote rain">${t('Rain is likely ({p}%).', { p: w.p })}${indoor.length ? ' ' + esc(t('Indoor ideas: {list}.', { list: indoor.map(n => t(n)).join(LANG === 'zh' ? '、' : ', ') })) : ''}</div>` : ''}
        ${(x.fixed || []).map(([no, r]) => `<div class="fixed">${planeIcon}<b>${no}</b><span>${r}</span></div>`).join('')}
        ${trip ? `<div class="fixed train">${trainIcon}<span><b>${esc(cityName(b))}</b> · ${esc(t(CITIES[b].train))} ${esc(t(CITIES[b].leave))} ${t('Book on Trip.com or 12306 and bring your passport to board.')}</span></div>` : ''}
        ${items.length ? items.map((id, i) => { const it = getItem(id); if (!it) return '';
          const away = !it.custom && !cities.includes(it.c);
          return `<div class="item${it.custom ? ' own' : ''}">
            ${PHOTOS[it.id] ? `<img class="thumb" src="${PHOTOS[it.id].src}" alt="" loading="lazy">` : `<span class="thumb ph" aria-hidden="true">${esc((it.l || it.n).slice(0, 2))}</span>`}
            <div class="imain"><div class="iname">${esc(it.custom ? it.n : nameOf(it))}${it.tier === 3 ? ' <span class="star" title="Top pick">★</span>' : ''}</div><div class="isub">${t(it.custom ? 'Your stop' : (it.k === 'food' ? 'Food' : WHEN_LABEL[it.when]))} · ${t('about {h}', { h: fmtHrs(it.hrs) })}${away ? ` · <span style="color:var(--warn)">${t('not in {city} this day', { city: esc(cityName(it.c)) })}</span>` : ''}</div></div>
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
        <div class="load${over ? ' over' : ''}"><span class="lb" aria-hidden="true"><i style="width:${Math.min(100, hrs / Math.max(.5, x.free) * 100)}%"></i></span><span>${over ? t('Too much for one day:') + ' ' : ''}${t('about {h} of {f} free', { h: fmtHrs(+hrs.toFixed(1)), f: fmtHrs(+x.free.toFixed(1)) })}</span></div>
      </div>
    </article>`;
  }).join('');
  $('#planSum').textContent = t('{n} stops across {d} days. Everything below can be changed.', { n: total, d: DAYS.length });
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
    plan.custom[id] = { id, n, l:'', hrs: +$('#ownH-' + d).value, custom:true, k:'place', when:'any' };
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
let xCity = 'sh', xKind = 'place';
const COVER = { sh:['#9B80F5','#FFE08A'], sz:['#8B6CF0','#FFD95A'], hz:['#A58BFF','#FFF0B8'], han:['#B39BFF','#FFD95A'], sgn:['#8B6CF0','#F5C542'], stay:['#B9A5FF','#FFF6D6'], skip:['#E28AA8','#FFE3EC'] };
function cover(it, kindKey) {
  const ph = PHOTOS[it.id];
  const [c1, c2] = COVER[kindKey || it.c] || COVER.stay;
  const cjk = /[㐀-鿿]/.test(it.l || '');
  const glyph = cjk ? it.l.slice(0, 4) : String(it.l || it.n).split(/[–,(&]/)[0].trim();
  const tier = it.tier ? `<span class="tier ${TIER[it.tier][1]}">${it.tier === 3 ? '★ ' : ''}${t(TIER[it.tier][0])}</span>` : '';
  const credit = ph ? `<details class="credit"><summary aria-label="Photo credit">i</summary><span>${t('Photo:')} <a href="${ph.page}" target="_blank" rel="noopener">${esc(ph.by)}</a> · ${esc(ph.license)}</span></details>` : '';
  return `<div class="cover${ph ? ' photo' : ''}" style="--c1:${c1};--c2:${c2}">${ph ? `<img src="${ph.src}" alt="${esc(it.tier ? nameOf(it) : t(it.n))}" loading="lazy" decoding="async">` : `<span class="glyph${cjk ? '' : ' latin'}" aria-hidden="true">${esc(glyph)}</span>`}${tier}${credit}</div>`;
}
function dayChoices(city) {
  if (CITIES[city].kind === 'daytrip') return CHOOSABLE.map(d => `<option value="${d}">${dayShort(d)}${plan.base[d] === city ? '' : ' · ' + t('make it a day trip')}</option>`).join('');
  return DAYS.filter(x => x.cities.includes(city)).map(x => `<option value="${x.d}">${dayShort(x.d)}</option>`).join('')
    || CHOOSABLE.map(d => `<option value="${d}">${dayShort(d)} · ${t('switch back to {city}', { city: cityName(city) })}</option>`).join('');
}
/* Food spots: local price with a ringgit estimate, a map link (Amap in China, where Google is blocked; Google Maps in Vietnam) */
const CUR = c => CITIES[c].lang === 'zh' ? 'CNY' : 'VND';
function priceText(c, [lo, hi]) {
  const cur = CUR(c), r = +rates[cur], k = n => n >= 1000 ? Math.round(n / 1000) + 'k' : n;
  const local = cur === 'CNY' ? `¥${lo}–${hi}` : `${k(lo)}–${k(hi)} ₫`;
  const rm = r > 0 ? ` · ≈ RM ${Math.round(lo / r)}–${Math.round(hi / r)}` : '';
  return t('{p} per person', { p: local + rm });
}
function mapUrl(c, s) {
  if (CITIES[c].lang === 'zh') return `https://uri.amap.com/search?keyword=${encodeURIComponent(s.l)}&city=${encodeURIComponent(CITIES[c].l)}&callnative=1`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.n + ', ' + s.a + ', ' + CITIES[c].n)}`;
}
function spotsHtml(it) {
  const zh = CITIES[it.c].lang === 'zh', pin = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';
  return `<div class="spots"><div class="spots-h">${t('Where to eat')}</div><ul>${it.spots.map((s, i) => {
    const name = LANG === 'zh' && zh ? s.l : s.n, sub = zh && LANG !== 'zh' ? s.l : '';
    const addr = LANG === 'zh' && zh ? s.al : t(s.a);
    return `<li class="spot">
      <div class="spot-top"><b>${esc(name)}</b>${sub ? `<span class="local" lang="zh-CN">${esc(sub)}</span>` : ''}</div>
      <div class="spot-addr">${pin}<span>${esc(addr)}</span></div>
      <div class="spot-meta"><span class="spot-price">${priceText(it.c, s.p)}</span>${s.note ? `<span class="spot-note">${esc(t(s.note))}</span>` : ''}</div>
      <div class="spot-acts"><a class="sbtn" href="${mapUrl(it.c, s)}" target="_blank" rel="noopener">${t(zh ? 'Open in Amap' : 'Open in Google Maps')}</a>${/\d|Rd|St|Lane/.test(s.a) ? `<button class="sbtn" type="button" data-spot="${it.id}:${i}">${t('Show to driver')}</button>` : ''}</div>
    </li>`; }).join('')}</ul><p class="spots-foot">${t('Prices are estimates. Rates from the Money tab.')}</p></div>`;
}
function renderExplore() {
  const kind = xKind;
  $('#xContext').innerHTML = kind === 'stay' ? esc(t(STAY_TIP[xCity])) : kind === 'skip' ? t('These are the tourist traps, scams and overrated spots we <b>don’t</b> recommend in {city}, and what to do instead.', { city: esc(cityName(xCity)) }) : t(CTX[xCity]);
  $('#xRank').hidden = kind === 'stay' || kind === 'skip';
  const g = $('#xGrid');
  if (kind === 'stay') {
    g.innerHTML = STAYS[xCity].map((s, i) => `<article class="xcard">${cover({ id:`stay-${xCity}-${i}`, n:s.n, l:s.n }, 'stay')}<div class="xbody"><h3>${esc(t(s.n))}</h3><div class="chips"><span class="chip good">${t('Best for: {x}', { x: esc(t(s.best)) })}</span></div>
      <dl class="dl"><dt>${t('Good')}</dt><dd>${esc(t(s.good))}</dd><dt>${t('Watch')}</dt><dd>${esc(t(s.watch))}</dd></dl><div class="how">${esc(t(s.how))}</div></div></article>`).join('');
    return;
  }
  if (kind === 'skip') {
    g.innerHTML = (SKIPS[xCity] || []).map(s => `<article class="xcard skip"><div class="xbody">
      <span class="chip bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M6 6l12 12"/></svg>${t('Not recommended')}</span>
      <h3>${esc(t(s.n))}</h3>${s.l ? `<div class="local" lang="${CITIES[xCity].lang === 'zh' ? 'zh-CN' : 'vi'}">${esc(s.l)}</div>` : ''}
      <p><b>${t('Why:')}</b> ${esc(t(s.why))}</p><div class="instead"><b>${t('Instead:')}</b> ${esc(t(s.instead))}</div></div></article>`).join('');
    return;
  }
  const inPlan = Object.entries(plan.items);
  const list = ITEMS.filter(i => i.c === xCity && i.k === kind).map((it, ix) => ({ it, ix })).sort((a, b) => b.it.tier - a.it.tier || a.ix - b.ix).map(o => o.it);
  g.innerHTML = list.map(it => {
    const on = inPlan.filter(([, ids]) => ids.includes(it.id)).map(([d]) => dayShort(+d));
    const lng = CITIES[it.c].lang === 'zh' ? 'zh-CN' : 'vi';
    return `<article class="xcard">${cover(it)}<div class="xbody">
      <div><h3>${esc(nameOf(it))}</h3>${LANG === 'zh' && hasCJK(it.l) ? `<div class="local">${esc(it.n)}</div>` : it.l !== it.n ? `<div class="local" lang="${lng}">${esc(it.l)}</div>` : ''}</div>
      <div class="chips">${it.k === 'place' ? `<span class="chip out">${t(WHEN_LABEL[it.when])}</span><span class="chip">${fmtHrs(it.hrs)}</span>` : it.spots?.length ? `<span class="chip gold">${priceText(it.c, [Math.min(...it.spots.map(s => s.p[0])), Math.max(...it.spots.map(s => s.p[1]))])}</span>` : ''}${on.length ? `<span class="chip good">${t('In plan · {days}', { days: on.join(', ') })}</span>` : ''}</div>
      <p class="why">${esc(t(it.why))}</p>
      <p>${esc(t(it.d))}</p>
      ${it.tip ? `<div class="tip">${tipIcon}<span>${esc(t(it.tip))}</span></div>` : ''}
      ${it.k === 'food' && it.spots?.length ? spotsHtml(it) : `<div class="how">${esc(it.k === 'food' ? t('Try: {w}', { w: t(it.where) }) : t(it.how))}</div>`}
      <div class="acts">
        <select class="sel" id="add-${it.id}" aria-label="${t('Day to add {n} to', { n: esc(nameOf(it)) })}">${dayChoices(it.c)}</select>
        <button class="sbtn primary" type="button" data-add="${it.id}">Add to plan</button>
        <button class="sbtn" type="button" data-show="${it.id}">${it.k === 'food' ? 'Show to order' : 'Show to driver'}</button>
        ${CITIES[it.c].lang === 'zh' ? `<button class="sbtn" type="button" data-copy="${it.id}" title="Copy the Chinese name to check live reviews">Reviews</button>` : ''}
      </div>
    </div></article>`;
  }).join('');
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
  if (s) {
    const it = BY[s.dataset.show], lg = CITIES[it.c].lang === 'zh' ? 'zh' : 'vi';
    const text = it.k === 'food' ? (lg === 'zh' ? '我想要这个：' : 'Cho tôi món này: ') + it.l : (lg === 'zh' ? '请带我去：' : 'Làm ơn đưa tôi đến: ') + it.l;
    openShow(text, '', t(it.k === 'food' ? 'I’d like this: {n}' : 'Please take me to: {n}', { n: nameOf(it) }), lg);
  }
  if (c) {
    const it = BY[c.dataset.copy];
    try { await navigator.clipboard.writeText(it.l); toast(t('Copied {n}. Paste it into Dianping or Trip.com for live reviews.', { n: it.l })); }
    catch { toast(t('Search {n} on Dianping (大众点评) or Trip.com for live reviews', { n: it.l })); }
  }
});
bindSeg('#xCity', v => { xCity = v; renderExplore(); });
bindSeg('#xKind', v => { xKind = v; renderExplore(); });
