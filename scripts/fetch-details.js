// Looks up practical details for every guide item and writes data/details.json, which is built into the app so it
// works offline and inside China:
//   places:            address in the local language, opening hours, phone, website (OpenStreetMap)
//   places/food/buy:   a short description in English and Simplified Chinese (Wikipedia, batched: 20 per request)
//   restaurant/shops:  opening hours, phone, website where OpenStreetMap has the same place near its pin
// Nominatim is called at most once per second, per its usage policy. Existing entries are kept; pass --force to redo.
// Usage: node scripts/fetch-details.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/guide-data.js'), 'utf8');
const { ITEMS, CITIES } = new Function(src + '; return { ITEMS, CITIES };')();
const COORDS = JSON.parse(fs.readFileSync(path.join(root, 'data/coords.json'), 'utf8'));
const outPath = path.join(root, 'data/details.json');
const out = fs.existsSync(outPath) && !process.argv.includes('--force') ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const save = () => fs.writeFileSync(outPath, JSON.stringify(out));
const UA = { 'User-Agent': 'Everywhen/1.0 build script (travel companion; github.com/ChrystalFSC/everywhen)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const km = (a, b) => { const R = 6371, r = Math.PI / 180, x = (b[0] - a[0]) * r, y = (b[1] - a[1]) * r; const h = Math.sin(x / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(y / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const LOCAL = { sh:'上海', sz:'苏州', hz:'杭州', han:'Hà Nội', sgn:'Hồ Chí Minh' };
const clean = o => Object.fromEntries(Object.entries(o).filter(([, v]) => v && (typeof v !== 'object' || Object.keys(v).length)));

/* ---------- OpenStreetMap ---------- */
let lastNom = 0;
async function nominatim(q, lang) {
  const wait = 1100 - (Date.now() - lastNom); if (wait > 0) await sleep(wait);
  lastNom = Date.now();
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&extratags=1&namedetails=1&addressdetails=1&accept-language=${lang}&q=${encodeURIComponent(q)}`, { headers: UA });
  return r.ok ? r.json() : [];
}
function localAddr(a, c, name) {
  if (!a) return '';
  if (CITIES[c].lang === 'vi') return [[a.house_number, a.road].filter(Boolean).join(' ') || name, a.quarter || a.suburb, a.city_district, a.city || a.state].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join(', ');
  const no = a.house_number ? a.house_number + (/^\d+[A-Za-z]?$/.test(a.house_number) ? '号' : '') : '';
  const top = /市$/.test(a.state || '') ? a.state : [a.city, a.state].find(x => /市$/.test(x || '')) || '';
  const district = [a.city_district, a.district, a.county, a.city, a.suburb].find(x => /[区县]$/.test(x || '')) || '';
  const road = a.road || a.pedestrian || a.footway || '';
  return [top, district, road, road ? no : name].filter(Boolean).filter((x, i, arr) => arr.indexOf(x) === i).join('');
}
const osmBits = o => { const ex = o.extratags || {}; return { hours: ex.opening_hours || '', phone: ex.phone || ex['contact:phone'] || '', web: ex.website || ex['contact:website'] || ex.url || '' }; };

/* ---------- Wikipedia, 20 articles per request ---------- */
async function wikiBatch(lang, titles) {
  const res = {};
  for (let i = 0; i < titles.length; i += 20) {
    const part = titles.slice(i, i + 20);
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1&prop=extracts|info|langlinks&inprop=url&exintro=1&explaintext=1&exlimit=20`
      + (lang === 'zh' ? '&exchars=360&variant=zh-cn&uselang=zh-cn' : '&exsentences=3&lllang=zh&lllimit=max') + `&titles=${encodeURIComponent(part.join('|'))}`;
    let j = null;
    for (let attempt = 0; attempt < 6 && !j; attempt++) {
      const r = await fetch(url, { headers: { ...UA, 'Accept-Language': lang === 'zh' ? 'zh-CN' : 'en' } });
      if (r.status === 429) { console.log('  wikipedia busy, waiting', 15 * (attempt + 1), 's'); await sleep(15000 * (attempt + 1)); continue; }
      j = await r.json();
    }
    if (!j) throw new Error('wikipedia rate limit');
    const alias = {}; [...(j.query.normalized || []), ...(j.query.redirects || [])].forEach(x => alias[x.from] = x.to);
    const pages = Object.fromEntries((j.query.pages || []).map(p => [p.title, p]));
    part.forEach(tl => { let k = tl; for (let n = 0; n < 3 && alias[k]; n++) k = alias[k]; const p = pages[k]; if (p && !p.missing) res[tl] = { ex: String(p.extract || '').replace(/\s+/g, ' ').trim().slice(0, 420), url: p.fullurl || '', zh: p.langlinks?.[0]?.title || '' }; });
    await sleep(1500);
  }
  return res;
}

(async () => {
  // 1. OpenStreetMap, once per item (an entry in details.json means it has been looked up)
  for (const it of ITEMS) {
    if (out[it.id]) continue;
    const c = it.c, lang = CITIES[c].lang === 'vi' ? 'vi' : 'zh-CN', d = {};
    try {
      if (it.k === 'place' && COORDS[it.id]) {
        const qs = CITIES[c].lang === 'zh' ? [`${it.l} ${LOCAL[c]}`, `${it.n}, ${CITIES[c].n}`] : [`${it.n}, ${CITIES[c].n}`, `${it.l}, ${LOCAL[c]}`];
        for (const q of qs) {
          const hit = (await nominatim(q, lang)).find(o => km([+o.lat, +o.lon], COORDS[it.id]) < 1.5);
          if (hit) { const nd = hit.namedetails || {}; Object.assign(d, clean({ addr: localAddr(hit.address, c, nd['name:zh'] || nd.name || it.l), ...osmBits(hit) })); break; }
        }
      }
      for (const [k, sp] of (it.spots || []).entries()) {
        const ll = COORDS[`s-${it.id}-${k}`]; if (!ll) continue;
        const hit = (await nominatim(CITIES[c].lang === 'zh' ? `${sp.l} ${LOCAL[c]}` : `${sp.n}, ${CITIES[c].n}`, lang)).find(o => km([+o.lat, +o.lon], ll) < .4);
        if (hit) { const b = clean(osmBits(hit)); if (Object.keys(b).length) out[`s-${it.id}-${k}`] = b; }
      }
      out[it.id] = d;
      console.log('osm', it.id, Object.keys(d).join(','));
    } catch (e) { console.log('fail', it.id, e.message); }
    save();
  }
  // 2. Wikipedia descriptions, English then Simplified Chinese
  const need = ITEMS.filter(it => it.wiki && !out[it.id]?.desc?.en);
  const titleOf = it => decodeURIComponent(it.wiki).replace(/_/g, ' ');
  const en = await wikiBatch('en', need.map(titleOf));
  const zhTitles = [...new Set(need.map(it => en[titleOf(it)]?.zh).filter(Boolean))];
  const zh = zhTitles.length ? await wikiBatch('zh', zhTitles) : {};
  need.forEach(it => {
    const e = en[titleOf(it)], z = e?.zh && zh[e.zh];
    out[it.id] = { ...out[it.id], ...clean({ desc: clean({ en: e?.ex, zh: z?.ex }), wiki: clean({ en: e?.url, zh: z?.url }) }) };
    console.log('wiki', it.id, e?.ex ? 'en' : '-', z?.ex ? 'zh' : '-');
  });
  save();
  console.log(Object.keys(out).length, 'entries');
})();
