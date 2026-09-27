/* ================= Your places =================
   Places you add yourself get the same kind of card as the guide's: details are looked up once, online, from
   OpenStreetMap (address in the local language, category, opening hours, website, phone) and Wikipedia (photo and
   a short description in English and Chinese), then saved with your plan so they stay available offline. */
const MINE_CITY = c => CITIES[c] ? c : 'sh';
const cityLocal = c => ({ sh:'上海', sz:'苏州', hz:'杭州', han:'Hà Nội', sgn:'Thành phố Hồ Chí Minh' })[c] || CITIES[c]?.l || '';
async function jget(url, ms = 9000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try { const r = await fetch(url, { signal: ctl.signal }); if (!r.ok) throw new Error('http ' + r.status); return await r.json(); }
  finally { clearTimeout(to); }
}
const osmRef = o => o ? ({ node:'N', way:'W', relation:'R' }[o.type] || o.type) + o.id : '';
// An address a driver can read: Chinese order for China, Vietnamese order for Vietnam.
function localAddr(a, c, name = '') {
  if (!a) return '';
  if (CITIES[c]?.lang === 'vi') return [[a.house_number, a.road].filter(Boolean).join(' ') || name, a.quarter || a.suburb, a.city_district, a.city || a.state].filter(Boolean).join(', ');
  const no = a.house_number ? a.house_number + (/[号號]$/.test(a.house_number) ? '' : '号') : '';
  // Shanghai is a province-level city (state 上海市); elsewhere the city is 苏州市 or 杭州市. Sub-districts (街道) are left out.
  const top = /市$/.test(a.state || '') ? a.state : [a.city, a.state].find(x => /市$/.test(x || '')) || '';
  const district = [a.city_district, a.district, a.county, a.city, a.suburb].find(x => /[区县]$/.test(x || '')) || '';
  const road = a.road || a.pedestrian || a.footway || '';
  // Parks, temples and the like often have no street: the district plus the place's own name is what a driver needs.
  return [top, district, road, road ? no : name].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join('');
}
const sameName = (a, b) => { const x = fold(a || ''), y = fold(b || ''); return !!x && !!y && (x.includes(y) || y.includes(x)); };
async function wikiSummary(lang, title) {
  const j = await jget(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
  if (j.type === 'disambiguation') return null;
  const ex = String(j.extract || '').split(/(?<=[.!?])\s+|(?<=[。！？])/).slice(0, 3).join(' ').slice(0, 420);
  const img = j.thumbnail?.source || ''; // Wikimedia only serves standard thumbnail widths, so use it as given
  return { ex, img, url: j.content_urls?.desktop?.page || '' };
}
const enriching = new Set();
async function enrichMine(id, force) {
  const it = plan.custom[id]; if (!it || enriching.has(id) || (!force && it.info?.fetched)) return;
  if (navigator.onLine === false) return;
  enriching.add(id); renderMineIfShown();
  const c = MINE_CITY(it.c), info = { ...(it.info || {}) }, [la, lo] = (MAP_CENTRE[c] || MAP_CENTRE.sh);
  const lang = CITIES[c]?.lang === 'vi' ? 'vi' : 'zh-CN';
  let failed = false;
  try {
    // 1. OpenStreetMap: the exact object if we know it, otherwise search by name near the city
    let o = null;
    if (it.osm) o = (await jget(`https://nominatim.openstreetmap.org/lookup?format=jsonv2&osm_ids=${osmRef(it.osm)}&extratags=1&namedetails=1&addressdetails=1&accept-language=${lang}`))[0] || null;
    if (!o) {
      const list = await jget(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&extratags=1&namedetails=1&addressdetails=1&accept-language=${lang}&q=${encodeURIComponent((it.l || it.n) + ' ' + cityLocal(c))}`);
      o = list.find(r => it.ll ? km([+r.lat, +r.lon], it.ll) < 1.5 : km([+r.lat, +r.lon], [la, lo]) < 60) || null;
    }
    if (o) {
      const nd = o.namedetails || {}, ex = o.extratags || {}, k = classify(o.category, o.type, o.place_rank ?? 30);
      it.ll = it.ll || [+(+o.lat).toFixed(5), +(+o.lon).toFixed(5)];
      it.osm = it.osm || { type: o.osm_type, id: o.osm_id };
      if (!it.l) it.l = nd['name:zh'] || nd['name:vi'] || (nd.name && nd.name !== it.n ? nd.name : '');
      if (!it.hrsSet && k.hrs && k.hrs < 12) it.hrs = k.hrs;
      it.indoor = it.indoor || !!k.indoor;
      Object.assign(info, { kind: k.kind || info.kind, addr: localAddr(o.address, c, nd['name:zh'] || nd['name:vi'] || nd.name || it.l || '') || info.addr || '', hours: ex.opening_hours || info.hours || '',
        web: ex.website || ex['contact:website'] || ex.url || '', phone: ex.phone || ex['contact:phone'] || '', cuisine: ex.cuisine || '', wikiTag: ex.wikipedia || '', wikidata: ex.wikidata || '' });
    }
    // 2. Wikipedia: the article OpenStreetMap links to, or one close by with a matching name
    const titles = {};
    if (info.wikidata) {
      const e = (await jget(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${info.wikidata}&props=sitelinks&sitefilter=enwiki|zhwiki&format=json&origin=*`)).entities?.[info.wikidata];
      if (e?.sitelinks?.enwiki) titles.en = e.sitelinks.enwiki.title;
      if (e?.sitelinks?.zhwiki) titles.zh = e.sitelinks.zhwiki.title;
    }
    if (info.wikiTag) { const [l, ...rest] = info.wikiTag.split(':'); if ((l === 'en' || l === 'zh') && !titles[l]) titles[l] = rest.join(':'); }
    if (!titles.en && !titles.zh && it.ll) {
      for (const l of ['en', 'zh']) {
        const g = await jget(`https://${l}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${it.ll[0]}|${it.ll[1]}&gsradius=1000&gslimit=10&format=json&origin=*`);
        const hit = (g.query?.geosearch || []).find(x => sameName(x.title, l === 'zh' ? (it.l || it.n) : it.n) || sameName(x.title, it.l));
        if (hit) titles[l] = hit.title;
      }
    }
    info.desc = info.desc || {}; info.wiki = info.wiki || {};
    for (const l of ['en', 'zh']) {
      if (!titles[l]) continue;
      const w = await wikiSummary(l, titles[l]).catch(() => null);
      if (w) { if (w.ex) info.desc[l] = w.ex; info.wiki[l] = w.url; if (w.img && (!info.img || l === 'en')) info.img = w.img; }
    }
    info.fetched = Date.now(); info.err = '';
  } catch (e) { failed = true; info.err = navigator.onLine === false ? 'offline' : 'net'; }
  it.info = info; enriching.delete(id);
  savePlan(); renderMineIfShown(); if (!failed) renderDays();
}
function renderMineIfShown() { if (xKind === 'mine') renderExplore(); }

/* ---------- cards ---------- */
const KIND_ZH = { 'museum':'博物馆', 'gallery':'美术馆', 'attraction':'景点', 'viewpoint':'观景点', 'restaurant':'餐厅', 'café':'咖啡馆', 'quick meal':'快餐', 'bar':'酒吧', 'food court':'美食广场', 'theatre':'剧院', 'cinema':'电影院', 'temple or church':'寺庙或教堂', 'market':'市场', 'park':'公园', 'garden':'园林', 'shop':'商店', 'shopping mall':'商场', 'department store':'百货公司', 'historic site':'古迹', 'nature':'自然景观', 'zoo':'动物园', 'aquarium':'水族馆', 'theme park':'主题公园', 'place':'地点', 'district':'街区', 'town':'城镇', 'village':'村庄', 'city':'城市', 'lake':'湖', 'mountain':'山', 'island':'岛', 'beach':'海滩', 'nature reserve':'自然保护区', 'library':'图书馆', 'stadium':'体育场', 'water park':'水上乐园', 'artwork':'艺术品', 'station or airport':'车站或机场', 'place to stay':'住宿' };
const kindLabel = k => LANG === 'zh' ? (KIND_ZH[k] || k) : k ? k[0].toUpperCase() + k.slice(1) : '';
function mineList() { return Object.values(plan.custom || {}).sort((a, b) => (b.added || 0) - (a.added || 0)); }
function mineCard(it, ix) {
  const info = it.info || {}, c = MINE_CITY(it.c), zh = CITIES[c]?.lang === 'zh';
  const days = Object.entries(plan.items).filter(([, ids]) => ids.includes(it.id)).map(([d]) => dayShort(+d));
  const name = LANG === 'zh' && it.l && hasCJK(it.l) ? it.l : it.n, sub = name === it.n ? (it.l && it.l !== it.n ? it.l : '') : it.n;
  const desc = info.desc?.[LANG] || info.desc?.en || info.desc?.zh || '', wiki = info.wiki?.[LANG] || info.wiki?.en || info.wiki?.zh || '';
  const busy = enriching.has(it.id), trip = info.trip;
  const cov = info.img
    ? `<div class="cover photo"><img src="${esc(info.img)}" alt="${esc(name)}" loading="lazy" decoding="async" crossorigin="anonymous"><span class="tier mine">${t('Yours')}</span>${wiki ? `<details class="credit"><summary aria-label="Photo credit">i</summary><span>${t('Photo and text:')} <a href="${esc(wiki)}" target="_blank" rel="noopener">Wikipedia</a></span></details>` : ''}</div>`
    : cover({ id: it.id, n: it.n, l: it.l || it.n }, 'stay').replace('</div>', `<span class="tier mine">${t('Yours')}</span></div>`);
  const v = it.verdict, vChip = v && LEVEL[v.level] ? `<span class="chip ${LEVEL[v.level][1]}">${t(LEVEL[v.level][0])}</span>` : '';
  const rows = [
    info.addr && [t('Address'), `<span lang="${zh ? 'zh-CN' : 'vi'}">${esc(info.addr)}</span>`],
    info.hours && [t('Opening hours'), `<span class="mono">${esc(info.hours)}</span>`],
    trip && [t('Getting there'), esc(trip.mode === 'walk' ? t('About {m} on foot from {from}', { m: fmtMins(trip.mins), from: cityName(trip.from || 'sh') }) : t('About {m} by {mode} from {from}', { m: fmtMins(trip.mins), mode: t(MODE[trip.mode] || trip.mode), from: cityName(trip.from || 'sh') }))],
    info.cuisine && [t('Cuisine'), esc(info.cuisine.replace(/;/g, ', ').replace(/_/g, ' '))],
    info.phone && [t('Phone'), `<a href="tel:${esc(info.phone.replace(/[^\d+]/g, ''))}">${esc(info.phone)}</a>`],
    info.web && [t('Website'), `<a href="${esc(/^https?:/.test(info.web) ? info.web : 'https://' + info.web)}" target="_blank" rel="noopener">${esc(info.web.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '').slice(0, 40))}</a>`]
  ].filter(Boolean);
  const status = busy ? t('Looking up details…') : info.err === 'offline' ? t('You’re offline. Details will load next time you have internet.') : info.err ? t('Couldn’t load details. Wikipedia is blocked in China, so try again before you fly or on roaming data.') : !info.fetched ? t('Details haven’t been looked up yet.') : !desc && !rows.length ? t('No public details found for this place. Add your own notes below.') : '';
  const mapHref = it.ll ? (zh ? `https://uri.amap.com/marker?position=${it.ll[1]},${it.ll[0]}&name=${encodeURIComponent(it.l || it.n)}&coordinate=wgs84&callnative=1` : `https://www.google.com/maps/search/?api=1&query=${it.ll[0]},${it.ll[1]}`)
    : (zh ? `https://uri.amap.com/search?keyword=${encodeURIComponent(it.l || it.n)}&callnative=1` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.n + ', ' + (CITYN[c] || ''))}`);
  return `<article class="xcard mine-card" data-id="${esc(it.id)}">${cov}<div class="xbody">
    <div><h3>${HAS_MAP && it.ll ? `<button class="xnum" type="button" data-fly="${esc(it.id)}" aria-label="${t('Show {n} on the map', { n: esc(name) })}">${ix + 1}</button>` : ''}${esc(name)}</h3>${sub ? `<div class="local">${esc(sub)}</div>` : ''}</div>
    <div class="chips">${info.kind ? `<span class="chip out">${esc(kindLabel(info.kind))}</span>` : ''}<span class="chip">${fmtHrs(it.hrs || 1.5)}</span><span class="chip">${esc(cityName(c))}</span>${it.indoor ? `<span class="chip">${t('Indoors')}</span>` : ''}${vChip}${days.length ? `<span class="chip good">${t('In plan · {days}', { days: days.join(', ') })}</span>` : `<span class="chip warn">${t('Not in your plan')}</span>`}</div>
    ${desc ? `<p>${esc(desc)}${wiki ? ` <a class="src" href="${esc(wiki)}" target="_blank" rel="noopener">Wikipedia</a>` : ''}</p>` : ''}
    ${v?.reasons?.length && (v.lang || 'en') === LANG ? `<div class="tip">${tipIcon}<span>${esc(v.reasons.join(' '))}</span></div>` : ''}
    ${rows.length ? `<dl class="dl">${rows.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('')}</dl>` : ''}
    ${status ? `<p class="mine-status${busy ? ' busy' : ''}" aria-live="polite">${status}</p>` : ''}
    <div class="field mine-note"><label for="note-${esc(it.id)}">${t('Your notes')}</label><textarea id="note-${esc(it.id)}" data-note="${esc(it.id)}" placeholder="${t('Tickets, who recommended it, what to order…')}">${esc(it.note || '')}</textarea></div>
    <div class="acts">
      <select class="sel" id="madd-${esc(it.id)}" aria-label="${t('Day to add {n} to', { n: esc(name) })}">${DAYS.map(x => `<option value="${x.d}">${dayShort(x.d)}</option>`).join('')}</select>
      <button class="sbtn primary" type="button" data-madd="${esc(it.id)}">${t('Add to plan')}</button>
      ${it.l || info.addr ? `<button class="sbtn" type="button" data-mshow="${esc(it.id)}">${t('Show to driver')}</button>` : ''}
      <a class="sbtn" href="${mapHref}" target="_blank" rel="noopener">${t(zh ? 'Open in Amap' : 'Open in Google Maps')}</a>
      ${zh ? `<button class="sbtn" type="button" data-copy-mine="${esc(it.id)}">${t('Reviews')}</button>` : ''}
      <button class="sbtn" type="button" data-menrich="${esc(it.id)}"${busy ? ' disabled' : ''}>${t(info.fetched ? 'Refresh details' : 'Look up details')}</button>
      <button class="sbtn danger" type="button" data-mdel="${esc(it.id)}">${t('Remove')}</button>
    </div>
  </div></article>`;
}
function renderMine() {
  const list = mineList(), g = $('#xGrid');
  $('#xContext').innerHTML = t('Places you added yourself, with details looked up from OpenStreetMap and Wikipedia and saved for offline use. Add more with <b>Can I go to…?</b> on the Plan tab.');
  $('#xRank').hidden = true;
  g.innerHTML = list.length ? list.map(mineCard).join('') : `<div class="mine-empty glass"><b>${t('No places of your own yet.')}</b><p>${t('Search any place with Can I go to…? on the Plan tab, or choose “Something else” on a day. It will appear here with its details.')}</p><button class="btn" type="button" data-goplan>${t('Go to Plan')}</button></div>`;
  renderExploreMap(list, 'mine');
  if (navigator.onLine !== false) list.filter(it => !it.info?.fetched && !it.info?.err && !enriching.has(it.id)).slice(0, 3).forEach(it => enrichMine(it.id));
}
let delArmedMine = null;
$('#xGrid').addEventListener('click', async e => {
  const a = e.target.closest('[data-madd]');
  if (a) {
    const id = a.dataset.madd, d = +$('#madd-' + id).value;
    if (!plan.items[d].includes(id)) plan.items[d].push(id);
    savePlan(); renderDays(); renderMine(); toast(t('{name} added to {day}', { name: plan.custom[id].n, day: dayLabel(d) })); return;
  }
  const sh = e.target.closest('[data-mshow]');
  if (sh) { const it = plan.custom[sh.dataset.mshow], zh = CITIES[MINE_CITY(it.c)]?.lang === 'zh'; openShow((zh ? '请带我去：' : 'Làm ơn đưa tôi đến: ') + (it.l || it.n), it.info?.addr || '', t('Please take me to: {n}', { n: it.n }), zh ? 'zh' : 'vi'); return; }
  const cp = e.target.closest('[data-copy-mine]');
  if (cp) { const it = plan.custom[cp.dataset.copyMine], n = it.l || it.n; try { await navigator.clipboard.writeText(n); toast(t('Copied {n}. Paste it into Dianping or Trip.com for live reviews.', { n })); } catch { toast(t('Search {n} on Dianping (大众点评) or Trip.com for live reviews', { n })); } return; }
  const en = e.target.closest('[data-menrich]'); if (en) { enrichMine(en.dataset.menrich, true); return; }
  const del = e.target.closest('[data-mdel]');
  if (del) {
    const id = del.dataset.mdel;
    if (delArmedMine !== id) { delArmedMine = id; del.textContent = t('Tap again to remove'); return; }
    const n = plan.custom[id]?.n; delete plan.custom[id]; Object.keys(plan.items).forEach(d => plan.items[d] = plan.items[d].filter(x => x !== id)); delArmedMine = null;
    savePlan(); renderDays(); renderMine(); toast(t('Removed {n}', { n })); return;
  }
  if (e.target.closest('[data-goplan]')) $('#tab-plan').click();
});
$('#xGrid').addEventListener('change', e => {
  const n = e.target.closest('[data-note]'); if (!n) return;
  const it = plan.custom[n.dataset.note]; if (it) { it.note = n.value.trim(); savePlan(); toast(t('Note saved')); }
});
