/* ================= Maps for Explore and Plan =================
   Leaflet (bundled) with OpenStreetMap tiles, which load in China. The service worker keeps every tile you
   have viewed, so maps you've looked at once still work offline; pins and routes always draw, tiles or not. */
const HAS_MAP = typeof L !== 'undefined';
const MAP_CENTRE = { sh:[31.2304, 121.4737, 12], sz:[31.3100, 120.6100, 13], hz:[30.2500, 120.1500, 12], han:[21.0300, 105.8450, 14], sgn:[10.7760, 106.7000, 14] };
const CITY_ZH = { sh:'上海', sz:'苏州', hz:'杭州' };
const spotLL = (it, k) => COORDS[`s-${it.id}-${k}`] || null;
// Where an item sits on the map: a place's own point, or a dish or souvenir's best-ranked shop.
function itemPoint(it) {
  if (!it) return null;
  if (it.custom) return it.ll || null;
  if (it.k === 'place') return COORDS[it.id] || null;
  const k = (it.spots || []).findIndex((s, i) => spotLL(it, i));
  return k < 0 ? null : { ll: spotLL(it, k), spot: it.spots[k] };
}
const med = a => { const b = a.slice().sort((x, y) => x - y); return b[b.length >> 1]; };
const pointLL = p => !p ? null : Array.isArray(p) ? p : p.ll;
const houseSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z"/></svg>';
const mkPin = (label, cls = '') => L.divIcon({ className: 'pin ' + cls, html: `<span><b>${label}</b></span>`, iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] });
function baseMap(el) {
  const m = L.map(el, { scrollWheelZoom: false, zoomSnap: .5, attributionControl: true });
  m.attributionControl.setPrefix(false);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, crossOrigin: 'anonymous', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(m);
  return m;
}
const mapLink = (c, name, ll) => CITIES[c]?.lang === 'zh'
  ? `https://uri.amap.com/marker?position=${ll[1]},${ll[0]}&name=${encodeURIComponent(name)}&coordinate=wgs84&callnative=1`
  : `https://www.google.com/maps/search/?api=1&query=${ll[0]},${ll[1]}`;
const staysIn = c => myStays.filter(x => x.ll && x.city === c);
function hotelMarker(x, layer) {
  const mk = L.marker(x.ll, { icon: mkPin(houseSvg, 'hotel'), title: x.name, keyboard: true, zIndexOffset: 500 }).addTo(layer);
  mk.bindPopup(`<div class="pop"><span class="pop-k">${t('Your stay')}</span><b>${esc(x.name)}</b><a href="${mapLink(x.city, x.name, x.ll)}" target="_blank" rel="noopener">${t(stayLang(x.city) === 'zh' ? 'Open in Amap' : 'Open in Google Maps')}</a></div>`);
  return x.ll;
}

/* ---------- Explore: numbered pins that match the numbered cards ---------- */
let xMap = null, xLayer = null, xMarkers = {};
function renderExploreMap(list, kind) {
  const wrap = $('#xMapWrap'); if (!wrap) return;
  const show = HAS_MAP && (kind === 'place' || kind === 'food' || kind === 'buy') && list.length > 0;
  wrap.hidden = !show; if (!show || wrap.offsetParent === null) return;
  if (!xMap) { xMap = baseMap($('#xMap')); xLayer = L.layerGroup().addTo(xMap); }
  xMap.invalidateSize();
  xLayer.clearLayers(); xMarkers = {};
  const planned = new Set(Object.values(plan.items).flat()), pts = [];
  list.forEach((it, i) => {
    const spots = it.custom ? [[it.ll, null]] : kind === 'place' ? [[COORDS[it.id], null]] : (it.spots || []).map((s, k) => [spotLL(it, k), s]);
    spots.filter(([ll]) => ll).forEach(([ll, s], j) => {
      const mk = L.marker(ll, { icon: mkPin(i + 1, `${it.custom ? 'mine' : 't' + it.tier}${planned.has(it.id) ? ' planned' : ''}${j ? ' alt' : ''}`), title: `${i + 1}. ${it.custom ? it.n : nameOf(it)}`, keyboard: true, riseOnHover: true }).addTo(xLayer);
      const nm = it.custom ? (LANG === 'zh' && it.l && hasCJK(it.l) ? it.l : it.n) : nameOf(it), ic = it.custom ? MINE_CITY(it.c) : it.c;
      const sub = it.custom ? esc(it.info?.kind ? kindLabel(it.info.kind) : t('Your place')) + ' · ' + fmtHrs(it.hrs || 1.5) : s ? `${esc(LANG === 'zh' && it.c !== 'han' && it.c !== 'sgn' ? s.l : s.n)} · ${priceText(it.c, s.p, it.unit)}` : esc(t(WHEN_LABEL[it.when])) + ' · ' + fmtHrs(it.hrs);
      mk.bindPopup(`<div class="pop"><b>${i + 1}. ${esc(nm)}</b><span>${sub}</span><div class="pop-acts"><button type="button" data-card="${esc(it.id)}">${t('See details')}</button><a href="${mapLink(ic, s ? s.l : (it.l || it.n), ll)}" target="_blank" rel="noopener">${t(CITIES[ic]?.lang === 'vi' ? 'Open in Google Maps' : 'Open in Amap')}</a></div></div>`);
      (xMarkers[it.id] ||= []).push(mk); pts.push(ll);
    });
  });
  staysIn(xCity).forEach(x => pts.push(hotelMarker(x, xLayer)));
  const [la, lo, z] = MAP_CENTRE[xCity] || MAP_CENTRE.sh;
  // Frame the main cluster; far-out picks (a water town, Disneyland) keep their pins but don't zoom the map out.
  const mid = [med(pts.map(p => p[0])), med(pts.map(p => p[1]))], core = pts.filter(p => km(p, mid) <= 9);
  const view = core.length >= 2 ? core : pts;
  if (view.length > 1) xMap.fitBounds(view, { padding: [28, 28], maxZoom: 15 }); else if (view.length) xMap.setView(view[0], 15); else xMap.setView([la, lo], z);
  $('#xMapNote').textContent = t(kind === 'place' ? 'Numbers match the cards below. Gold pins are top picks; a green ring means it’s in your plan.' : 'Each pin is a recommended shop or restaurant; the number matches the card below.');
}
function flyTo(id) {
  const m = xMarkers[id]?.[0]; if (!m || !xMap) return;
  $('#xMapWrap').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
  xMap.setView(m.getLatLng(), Math.max(xMap.getZoom(), 15)); m.openPopup();
}
function flashCard(id) {
  const c = document.querySelector(`.xcard[data-id="${CSS.escape(id)}"]`); if (!c) return;
  xMap?.closePopup();
  c.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
  c.classList.remove('flash'); void c.offsetWidth; c.classList.add('flash');
}
document.addEventListener('click', e => {
  const f = e.target.closest('[data-fly]'); if (f) { flyTo(f.dataset.fly); return; }
  const c = e.target.closest('.pop [data-card]'); if (c) flashCard(c.dataset.card);
});
$('#xMapToggle')?.addEventListener('click', () => {
  const host = $('#xMap'), open = host.hidden;
  host.hidden = !open; $('#xMapNote').hidden = !open;
  $('#xMapToggle').textContent = t(open ? 'Hide map' : 'Show map');
  $('#xMapToggle').setAttribute('aria-expanded', open);
  if (open) { xMap?.invalidateSize(); renderExplore(); }
});

/* ---------- Plan: each day's stops in order, with distances and a shorter-route suggestion ---------- */
const dayMaps = {}, openDays = new Set();
const legKm = (a, b) => km(a, b) * 1.3; // straight line to rough street distance
function legText(d) {
  if (d <= 1.4) return t('{km} · about {m} min walk', { km: fmtKm(d), m: Math.max(3, Math.round(d / 4.8 * 60 / 5) * 5) });
  return t('{km} · about {m} min by metro or taxi', { km: fmtKm(d), m: Math.round((10 + d / 22 * 60) / 5) * 5 });
}
// Hotels at each end of the day: where you woke up, and where you sleep tonight.
function dayEnds(d) {
  const wake = myStays.find(x => x.from < d && d <= x.to && x.ll), sleep = myStays.find(x => x.from <= d && d < x.to && x.ll);
  return { start: wake || null, end: sleep || null };
}
const whenRank = it => it.custom ? 1 : it.when === 'morning' ? 0 : it.when === 'evening' ? 2 : 1;
function routeLen(pts) { let s = 0; for (let i = 1; i < pts.length; i++) s += legKm(pts[i - 1], pts[i]); return s; }
// Try every order of up to 7 stops, keeping mornings first and evenings last, with the hotels fixed.
function bestOrder(d) {
  const ids = plan.items[d] || [], its = ids.map(getItem), lls = its.map(it => pointLL(itemPoint(it)));
  if (ids.length < 3 || ids.length > 7 || lls.some(x => !x)) return null;
  const { start, end } = dayEnds(d), wrap = seq => [start?.ll, ...seq.map(i => lls[i]), end?.ll].filter(Boolean);
  const cur = routeLen(wrap(ids.map((_, i) => i)));
  let best = null, bestLen = cur;
  const perm = (arr, used) => {
    if (arr.length === ids.length) { const L2 = routeLen(wrap(arr)); if (L2 < bestLen - .01) { bestLen = L2; best = arr.slice(); } return; }
    for (let i = 0; i < ids.length; i++) if (!used[i] && (!arr.length || whenRank(its[arr[arr.length - 1]]) <= whenRank(its[i]))) { used[i] = 1; arr.push(i); perm(arr, used); arr.pop(); used[i] = 0; }
  };
  perm([], []);
  return best && cur - bestLen >= 1.5 && (cur - bestLen) / cur >= .15 ? { ids: best.map(i => ids[i]), save: cur - bestLen } : null;
}
function drawDayMap(d) {
  const host = $('#dm-' + d), legs = $('#dl-' + d); if (!host || !HAS_MAP) return;
  dayMaps[d]?.remove();
  const m = dayMaps[d] = baseMap(host), layer = L.layerGroup().addTo(m);
  const ids = plan.items[d] || [], { start, end } = dayEnds(d), route = [], rows = [];
  let prev = start ? { ll: start.ll, label: esc(start.name) } : null, stops = 0;
  if (start) route.push(hotelMarker(start, layer));
  ids.forEach((id, i) => {
    const it = getItem(id), p = itemPoint(it), ll = pointLL(p); if (!ll) return;
    const name = it.custom ? it.n : nameOf(it) + (p.spot ? ' · ' + (LANG === 'zh' && CITIES[it.c]?.lang === 'zh' ? p.spot.l : p.spot.n) : '');
    L.marker(ll, { icon: mkPin(i + 1, `t${it.tier || 1}`), title: `${i + 1}. ${name}`, keyboard: true }).addTo(layer)
      .bindPopup(`<div class="pop"><b>${i + 1}. ${esc(name)}</b><a href="${mapLink(it.c || 'sh', p.spot ? p.spot.l : (it.l || it.n), ll)}" target="_blank" rel="noopener">${t(CITIES[it.c]?.lang === 'vi' ? 'Open in Google Maps' : 'Open in Amap')}</a></div>`);
    if (prev) rows.push(`<li><span class="lg-n">${prev.label} → ${i + 1}</span><span>${legText(legKm(prev.ll, ll))}</span></li>`);
    prev = { ll, label: String(i + 1) }; route.push(ll); stops++;
  });
  if (end && end !== start) route.push(hotelMarker(end, layer));
  else if (end) route.push(end.ll);
  if (end && stops) rows.push(`<li><span class="lg-n">${prev.label} → ${esc(end.name)}</span><span>${legText(legKm(prev.ll, end.ll))}</span></li>`);
  if (route.length > 1) L.polyline(route, { color: '#8B6CF0', weight: 3, opacity: .8, dashArray: '6 7' }).addTo(m);
  const missing = ids.filter(id => !pointLL(itemPoint(getItem(id)))).length;
  if (route.length > 1) m.fitBounds(route, { padding: [26, 26], maxZoom: 15 });
  else { const c = MAP_CENTRE[plan.base[d] || DAYS.find(x => x.d === d).cities.slice(-1)[0]] || MAP_CENTRE.sh; route.length ? m.setView(route[0], 14) : m.setView([c[0], c[1]], c[2]); }
  const total = routeLen(route), opt = bestOrder(d);
  legs.innerHTML = (rows.length ? `<ol class="legs-l">${rows.join('')}</ol><p class="legs-t">${t('Total about {km} between stops.', { km: fmtKm(total) })}</p>` : `<p class="legs-t">${t(ids.length ? 'Add another stop to see distances between them.' : 'Add stops to see them on the map.')}</p>`)
    + (missing ? `<p class="legs-t">${t(missing === 1 ? '1 stop has no map location.' : '{n} stops have no map location.', { n: missing })}</p>` : '')
    + (!start && !end && !DAYS.find(x => x.d === d).slots ? `<p class="legs-t">${t('Pin your hotel on the Trip tab to start and end the day there.')}</p>` : '')
    + (opt ? `<button class="sbtn primary" type="button" data-optimize="${d}">${t('Use a shorter order (saves about {km})', { km: fmtKm(opt.save) })}</button>` : '');
  requestAnimationFrame(() => m.invalidateSize());
}
function restoreDayMaps() { Object.keys(dayMaps).forEach(d => { if (!openDays.has(+d) || !$('#dm-' + d)?.isConnected) { dayMaps[d].remove(); delete dayMaps[d]; } }); openDays.forEach(drawDayMap); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-daymap]');
  if (b) { const d = +b.dataset.daymap; openDays.has(d) ? openDays.delete(d) : openDays.add(d); renderDays(); return; }
  const o = e.target.closest('[data-optimize]');
  if (o) { const d = +o.dataset.optimize, best = bestOrder(d); if (!best) return; plan.items[d] = best.ids; savePlan(); renderDays(); toast(t('Reordered {day} to save about {km}', { day: dayLabel(d), km: fmtKm(best.save) })); }
});

/* ---------- your stays: found from the address, or placed by tapping the map ---------- */
// OpenStreetMap rarely knows Chinese house numbers, so fall back to the street, then the name.
async function findStayPlace(x) {
  const city = CITY_ZH[x.city] || CITY_N[x.city], [la, lo] = MAP_CENTRE[x.city] || MAP_CENTRE.sh;
  const road = (x.addr || '').replace(/^(上海市?|苏州市?|杭州市?)/, '').replace(/^[^区县]{1,4}[区县]/, '').match(/^(.+?[路街道巷弄])/)?.[1];
  const qs = [[x.addr, true], [road && road + ' ' + city, false], [x.name && x.name + ' ' + city, true]].filter(q => q[0]);
  for (const [q, exact] of qs) {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(q)}`);
    const hit = (await r.json()).map(h => [+h.lat, +h.lon]).find(ll => km(ll, [la, lo]) < 70);
    if (hit) return { ll: hit.map(n => +n.toFixed(5)), exact };
  }
  return null;
}
async function locateStay(x) {
  if (!navigator.onLine) return;
  try { const f = await findStayPlace(x); if (f && !x.ll) { x.ll = f.ll; store.set('stays', myStays); renderDays(); renderExplore(); } } catch {}
}
let sMap = null, sMark = null, sLL = null;
function stayMapOpen(ll, city) {
  if (!HAS_MAP) { $('#sMapField').hidden = true; return; }
  sLL = ll || null;
  requestAnimationFrame(() => {
    if (!sMap) {
      sMap = baseMap($('#sMap'));
      sMap.on('click', e => setStayPin([+e.latlng.lat.toFixed(5), +e.latlng.lng.toFixed(5)], t('Pinned where you tapped. Drag the pin to adjust.')));
    }
    sMap.invalidateSize();
    if (sMark) { sMark.remove(); sMark = null; }
    if (sLL) { setStayPin(sLL, t('This is where your stay is pinned. Tap the map or drag the pin to move it.')); sMap.setView(sLL, 15); }
    else { const c = MAP_CENTRE[city] || MAP_CENTRE.sh; sMap.setView([c[0], c[1]], c[2]); $('#sMapHint').textContent = t('Tap the map to pin your stay, or use Find on map.'); }
  });
}
function setStayPin(ll, msg) {
  sLL = ll;
  if (!sMark) { sMark = L.marker(ll, { icon: mkPin(houseSvg, 'hotel'), draggable: true }).addTo(sMap); sMark.on('dragend', () => { const p = sMark.getLatLng(); sLL = [+p.lat.toFixed(5), +p.lng.toFixed(5)]; }); }
  else sMark.setLatLng(ll);
  $('#sMapHint').textContent = msg;
}
$('#sFind')?.addEventListener('click', async () => {
  const b = $('#sFind'), x = { name: $('#sName').value.trim(), addr: $('#sAddr').value.trim(), city: $('#sCity').value };
  if (!x.name && !x.addr) { $('#sMapHint').textContent = t('Type the name or address first.'); return; }
  b.disabled = true; $('#sMapHint').textContent = t('Looking it up…');
  try {
    const f = await findStayPlace(x);
    if (f) { setStayPin(f.ll, t(f.exact ? 'Found it. Check the pin and drag it if it’s off.' : 'Found the street only. Drag the pin to the exact spot.')); sMap.setView(f.ll, f.exact ? 16 : 15); }
    else $('#sMapHint').textContent = t('Couldn’t find it. Tap the map where your stay is instead.');
  } catch { $('#sMapHint').textContent = t(navigator.onLine === false ? 'You’re offline. Tap the map to pin it instead.' : 'Couldn’t reach the map search. Tap the map to pin it instead.'); }
  b.disabled = false;
});
$('#sCity')?.addEventListener('change', () => { if (!sLL && sMap) { const c = MAP_CENTRE[$('#sCity').value]; sMap.setView([c[0], c[1]], c[2]); } });
