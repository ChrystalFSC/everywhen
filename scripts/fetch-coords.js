// Geocodes every guide item and gazetteer place with OpenStreetMap Nominatim (1 request/second, per its
// usage policy) and writes data/coords.json: { id: [lat, lon] }. Existing entries are kept.
// Usage: node scripts/fetch-coords.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/guide-data.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/places-data.js'), 'utf8');
const { ITEMS, CITIES, PLACES } = new Function(src + '; return { ITEMS, CITIES, PLACES };')();
const CENTRE = { sh:[31.2304,121.4737], sz:[31.2989,120.5853], hz:[30.2741,120.1551], han:[21.0285,105.8542], sgn:[10.7725,106.698] };
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r; const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const outPath = path.join(root, 'data/coords.json');
const out = fs.existsSync(outPath) ? JSON.parse(fs.readFileSync(outPath, 'utf8')) : {};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function geo(q) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=3&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': 'Everywhen/1.0 build script (travel companion)' } });
  await sleep(1100);
  return r.ok ? r.json() : [];
}
(async () => {
  const jobs = [
    ...ITEMS.filter(i => i.k === 'place').map(i => ({ id: i.id, qs: [`${i.l} ${CITIES[i.c].l}`, `${i.n}, ${CITIES[i.c].n}`], near: CENTRE[i.c], max: i.c === 'sh' ? 60 : 40 })),
    ...PLACES.map(p => ({ id: 'p-' + p.id, qs: [p.zh, p.n], near: null, max: 99999 })),
    // Restaurants and shops with a real address: s-<item id>-<spot index>
    ...ITEMS.filter(i => i.spots).flatMap(i => i.spots.map((sp, k) => ({ sp, k, i })).filter(({ sp }) => /\d|Rd|St|Lane|Street/.test(sp.a)).map(({ sp, k, i }) => ({
      id: `s-${i.id}-${k}`, near: CENTRE[i.c], max: i.c === 'sh' ? 60 : 40,
      qs: CITIES[i.c].lang === 'zh' ? [`${sp.l} ${CITIES[i.c].l}`, /\d/.test(sp.al) ? sp.al.replace(/ .*/, '') : null, `${sp.n}, ${CITIES[i.c].n}`].filter(Boolean) : [`${sp.n}, ${CITIES[i.c].n}`, `${sp.a}, ${CITIES[i.c].n}`]
    })))
  ];
  // Checked by hand: these matched the wrong branch or place, so they stay unpinned rather than wrong.
  const WRONG = new Set('s-f-eggcoffee-1 s-f-hongshao-0 s-f-lionhead-1 s-b-silk-hz-0 s-f-beggars-1 s-f-catear-0 s-f-ljshrimp-1 s-f-hongshao-1 s-f-banhcuon-0 s-f-kem-0 s-f-squirrel-1 s-b-duoyunxuan-0 s-f-sjb-1 s-f-cifan-0'.split(' '));
  for (const j of jobs) {
    if (out[j.id] || WRONG.has(j.id)) continue;
    let hit = null;
    for (const q of j.qs) {
      const res = await geo(q);
      hit = res.map(r => [+r.lat, +r.lon]).find(c => !j.near || km(c, j.near) <= j.max);
      if (hit) break;
    }
    if (hit) { out[j.id] = hit.map(n => +n.toFixed(5)); console.log('ok', j.id, out[j.id].join(',')); }
    else console.log('miss', j.id);
    fs.writeFileSync(outPath, JSON.stringify(out));
  }
  console.log(Object.keys(out).length, 'coordinates');
})();
