// Downloads the lead photo of each guide item's Wikipedia article, keeping only freely licensed
// Wikimedia Commons files, and records author + licence for on-card credits.
// Usage: node scripts/fetch-photos.js   (then: python scripts/shrink-photos.py)
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'src/guide-data.js'), 'utf8');
const { ITEMS } = new Function(code + '; return { ITEMS };')();
const UA = { 'User-Agent': 'Everywhen/1.0 (travel companion; https://github.com/) node-fetch' };
const FREE = /^(cc0|cc[ -]by|public domain|pd\b|pd-|attribution)/i;
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const outDir = path.join(root, 'images', 'raw');
fs.mkdirSync(outDir, { recursive: true });
const credPath = path.join(root, 'data/photos.json');
const credits = fs.existsSync(credPath) ? JSON.parse(fs.readFileSync(credPath, 'utf8')) : {};

(async () => {
  for (const it of ITEMS.filter(i => i.wiki && !credits[i.id])) {
    try {
      const sum = await (await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${it.wiki}`, { headers: UA })).json();
      const src = sum.originalimage?.source || sum.thumbnail?.source;
      if (!src || !/\/commons\//.test(src)) { console.log('skip (no commons image)', it.id); continue; }
      const m = src.match(/\/commons\/(?:thumb\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?]+)/);
      const file = decodeURIComponent(m[1]);
      if (/\.svg$/i.test(file)) { console.log('skip (svg)', it.id); continue; }
      const q = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=800&titles=${encodeURIComponent('File:' + file)}`;
      const info = Object.values((await (await fetch(q, { headers: UA })).json()).query.pages)[0].imageinfo?.[0];
      const lic = strip(info?.extmetadata?.LicenseShortName?.value);
      if (!info || !FREE.test(lic)) { console.log('skip (licence)', it.id, lic); continue; }
      const img = await fetch(info.thumburl, { headers: UA });
      if (!img.ok) { console.log('skip (download)', it.id, img.status); continue; }
      fs.writeFileSync(path.join(outDir, it.id + '.img'), Buffer.from(await img.arrayBuffer()));
      credits[it.id] = { src: `images/photos/${it.id}.jpg`, by: strip(info.extmetadata?.Artist?.value).slice(0, 80) || 'Unknown author', license: lic, page: info.descriptionurl };
      console.log('ok', it.id, lic);
      await new Promise(r => setTimeout(r, 250));
    } catch (e) { console.log('fail', it.id, e.message); }
  }
  fs.writeFileSync(credPath, JSON.stringify(credits, null, 1));
  console.log(Object.keys(credits).length, 'photos');
})();
