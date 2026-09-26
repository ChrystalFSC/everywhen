// Finds freely licensed Wikimedia Commons photos by search query for items whose Wikipedia article
// has no usable lead image. Candidates go to images/cand/<id>-<n>.img for review; approve with
// `node scripts/search-photos.js pick <id> <n>` (writes images/raw/<id>.img and the credit).
// Usage: node scripts/search-photos.js search
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const UA = { 'User-Agent': 'Everywhen/1.0 (travel companion) node-fetch' };
const FREE = /^(cc0|cc[ -]by|public domain|pd\b|pd-|attribution)/i;
const strip = h => String(h || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
const QUERIES = {
  'disney': 'Shanghai Disneyland castle', 'f-noodle': 'scallion oil noodles', 'f-cifan': '粢饭团', 'pingjiang': 'Pingjiang Road Suzhou',
  'f-squirrel': 'squirrel mandarin fish', 'f-sznoodle': 'Suzhou noodles', 'hefang': 'Hefang Street Hangzhou', 'f-ljshrimp': 'Longjing shrimp',
  'f-pianerchuan': 'Pianerchuan', 'trainst': 'Hanoi train street', 'buivien': 'Bui Vien street', 'f-phosgn': 'Pho Saigon bowl',
  'stay-sh-0': 'Nanjing Road East night', 'stay-sh-1': "People's Square Shanghai", 'stay-sh-2': "Jing'an Shanghai skyline", 'stay-sh-3': 'Former French Concession Shanghai street', 'stay-sh-4': 'Lujiazui skyline night',
  'stay-sz-0': 'Pingjiang Road canal', 'stay-sz-1': 'Suzhou railway station', 'stay-hz-0': 'West Lake Hangzhou sunrise', 'stay-hz-1': 'Hangzhou East railway station',
  'stay-han-0': 'Hanoi Old Quarter street', 'stay-han-1': 'Noi Bai International Airport terminal', 'stay-sgn-0': 'Tan Son Nhat International Airport', 'stay-sgn-1': 'Ho Chi Minh City skyline night'
};
const cand = path.join(root, 'images/cand'), credPath = path.join(root, 'data/photos.json');
const [, , cmd, id, n] = process.argv;
(async () => {
  if (cmd === 'pick') {
    const meta = JSON.parse(fs.readFileSync(path.join(cand, 'meta.json'), 'utf8'))[`${id}-${n}`];
    fs.mkdirSync(path.join(root, 'images/raw'), { recursive: true });
    fs.copyFileSync(path.join(cand, `${id}-${n}.img`), path.join(root, 'images/raw', id + '.img'));
    const credits = JSON.parse(fs.readFileSync(credPath, 'utf8'));
    credits[id] = { src: `images/photos/${id}.jpg`, by: meta.by, license: meta.license, page: meta.page };
    fs.writeFileSync(credPath, JSON.stringify(credits, null, 1));
    return console.log('picked', id, n);
  }
  fs.mkdirSync(cand, { recursive: true });
  const metaPath = path.join(cand, 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  for (const [key, q] of Object.entries(QUERIES)) {
    if (Object.keys(meta).some(m => m.startsWith(key + '-'))) continue;
    await sleep(2500);
    const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(q + ' filetype:bitmap')}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=800`;
    let body = await (await fetch(url, { headers: UA })).text();
    if (body[0] !== '{') { await sleep(20000); body = await (await fetch(url, { headers: UA })).text(); }
    if (body[0] !== '{') { console.log(key, 'rate limited, try again later'); break; }
    const pages = Object.values(JSON.parse(body).query?.pages || {}).sort((a, b) => a.index - b.index);
    let k = 0;
    for (const p of pages) {
      const ii = p.imageinfo?.[0]; if (!ii) continue;
      const lic = strip(ii.extmetadata?.LicenseShortName?.value);
      if (!FREE.test(lic) || ii.width < 900 || ii.width < ii.height) continue;
      const img = await fetch(ii.thumburl, { headers: UA }); if (!img.ok) continue;
      fs.writeFileSync(path.join(cand, `${key}-${k}.img`), Buffer.from(await img.arrayBuffer()));
      meta[`${key}-${k}`] = { by: strip(ii.extmetadata?.Artist?.value).slice(0, 80) || 'Unknown author', license: lic, page: ii.descriptionurl, title: p.title };
      if (++k >= 3) break;
      await sleep(600);
    }
    console.log(key, k, 'candidates');
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 1));
  }
})();
