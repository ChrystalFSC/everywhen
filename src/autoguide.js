/* ================= Guides for any city =================
   A city without a hand-picked guide gets one built from Wikivoyage, the free travel guide (CC BY-SA). Its listings
   become Explore cards and fill the day plan: sights ranked by how widely known they are (Wikipedia articles across
   languages, from Wikidata), with photos from Wikimedia Commons. It is built once per city while online and kept
   on this device, so Explore and the plan keep working offline. */
const AG_VER = 2; // raising this rebuilds every saved guide with the current rules
const AG_LL = {}, AG_PHOTOS = {}, AG_DETAILS = {}, AG_META = {};
const agKey = code => 'guide:' + code;
const AG_KEYS = STOP_KEYS.filter(k => !CTX[k]);

/* ---------- wikitext ---------- */
// The text inside a template or link, split on top-level pipes.
function agSplit(s) {
  const out = []; let depth = 0, cur = '';
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === '{{' || two === '[[') { depth++; cur += two; i++; continue; }
    if ((two === '}}' || two === ']]') && depth) { depth--; cur += two; i++; continue; }
    if (s[i] === '|' && !depth) { out.push(cur); cur = ''; continue; }
    cur += s[i];
  }
  out.push(cur); return out;
}
// Index just past the template that opens at i (which points at "{{").
function agEnd(w, i) {
  let depth = 0;
  for (let j = i; j < w.length - 1; j++) {
    if (w[j] === '{' && w[j + 1] === '{') { depth++; j++; }
    else if (w[j] === '}' && w[j + 1] === '}') { depth--; j++; if (!depth) return j + 1; }
  }
  return w.length;
}
function agParams(body) {
  const parts = agSplit(body), p = { _: parts[0].trim().toLowerCase() };
  parts.slice(1).forEach(x => { const e = x.indexOf('='); if (e > 0) p[x.slice(0, e).trim().toLowerCase()] = x.slice(e + 1).trim(); });
  return p;
}
// Wikitext to plain text: templates dropped (a few kept for their text), links reduced to their label.
function agText(s) {
  if (!s) return '';
  s = s.replace(/<!--[\s\S]*?-->/g, '').replace(/<ref[^>]*\/>/gi, '').replace(/<ref[\s\S]*?<\/ref>/gi, '');
  for (let n = 0; n < 6 && /\{\{/.test(s); n++) s = s.replace(/\{\{([^{}]*)\}\}/g, (m, b) => {
    const p = agSplit(b), name = p[0].trim().toLowerCase();
    if (name === '=') return '=';
    if (name === '!') return '|';
    if (/^(lang|lang-\w+|nowrap|nobr|w|wp|ruby|small|transl|ipa|unicode|smallcaps)$/.test(name)) return p.at(-1);
    if (name === 'convert' || name === 'cvt') return p.slice(1, 3).join(' ');
    if (name === 'ndash') return '–';
    if (name === 'mdash') return '—';
    return '';
  });
  s = s.replace(/\[\[(?:File|Image):[^\]]*\]\]/gi, '')
    .replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, '$2').replace(/\[\[([^\]]*)\]\]/g, (m, a) => a.split('#')[0])
    .replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/g, '$1').replace(/\[https?:\/\/[^\]]+\]/g, '')
    .replace(/'''?/g, '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return s.replace(/[ \t]+/g, ' ').replace(/ ([,.;:])/g, '$1').trim();
}
// Sentences end at . ! or ? followed by a space and a capital, so "8.5 km" and "Jl. Sudirman"-style text mostly stay whole.
const agSentences = s => String(s || '').split(/(?<=[.!?]["”’)]?)\s+(?=["“(]?[\p{Lu}\d])/u).map(x => x.trim()).filter(Boolean);
// The prose of a section: paragraphs and bullet points, listings and sub-sections left out.
function agProse(w, max = 3) {
  const out = []; let i = 0;
  while (i < w.length) {
    if (w.startsWith('{{', i)) { i = agEnd(w, i); continue; }
    // A listing after a bullet ("* {{buy | name=…") spans lines: skip the whole template, not just its first line.
    const lead = w.slice(i, i + 12).match(/^[*#:;]+\s*\{\{/);
    if (lead) { i = agEnd(w, i + lead[0].length - 2); continue; }
    const nl = w.indexOf('\n', i), line = w.slice(i, nl < 0 ? w.length : nl); i = nl < 0 ? w.length : nl + 1;
    if (/^=/.test(line)) break;
    const t = agText(line.replace(/^[*#:;]+\s*/, ''));
    if (t.length > 40) out.push(t);
    if (out.length >= max) break;
  }
  return out;
}
// Sections by heading: { 'see': text, 'see/palaces': text, ... } plus the lead, keyed ''.
function agSections(w) {
  const out = { '': '' }, path = [];
  let key = '', last = 0;
  w.replace(/^(={2,4})\s*([^=\n]+?)\s*\1\s*$/gm, (m, eq, h, at) => {
    out[key] = (out[key] || '') + w.slice(last, at);
    path.length = eq.length - 2; path[eq.length - 2] = h.trim().toLowerCase();
    key = path.filter(Boolean).join('/'); last = at + m.length; return m;
  });
  out[key] = (out[key] || '') + w.slice(last);
  return out;
}

/* ---------- listings ---------- */
const AG_KIND = { see:'see', do:'do', eat:'eat', drink:'drink', buy:'buy', sleep:'sleep' };
function agListings(w, page) {
  const out = [], secs = agSections(w);
  Object.entries(secs).forEach(([sec, text]) => {
    const re = /\{\{\s*(see|do|eat|drink|buy|sleep|listing)\s*(?=[|\n}])/gi; let m;
    while ((m = re.exec(text))) {
      const end = agEnd(text, m.index), p = agParams(text.slice(m.index + 2, end - 2)); re.lastIndex = end;
      const kind = AG_KIND[p._] || AG_KIND[(p.type || '').toLowerCase()] || AG_KIND[sec.split('/')[0]];
      const name = agText(p.name); if (!kind || !name || name.length > 90) continue;
      out.push({ kind, sec, page, name, alt: agText(p.alt), addr: agText(p.address), how: agText(p.directions), phone: agText(p.phone), hours: agText(p.hours),
        price: agText(p.price), url: (p.url || '').trim(), lat: +p.lat || 0, lon: +p.long || +p.lon || 0, image: (p.image || '').trim(), qid: /^Q\d+$/.test(p.wikidata || '') ? p.wikidata : '',
        wp: agText(p.wikipedia), text: agText(p.content) });
    }
  });
  return out;
}
// Areas to stay, from the districts box.
function agAreas(w, base) {
  const i = w.search(/\{\{\s*regionlist/i); if (i < 0) return [];
  const p = agParams(w.slice(i + 2, agEnd(w, i) - 2)), out = [];
  for (let n = 1; n < 30; n++) {
    const raw = p[`region${n}name`]; if (raw === undefined) continue;
    const link = (raw.match(/\[\[([^\]|#]+)/) || [])[1] || '', name = agText(raw);
    if (name) out.push({ n: name, d: agText(p[`region${n}description`] || ''), page: link.trim() });
  }
  return out.filter(a => a.page || a.d);
}

// Article links in a section, in order, without files or categories.
// Town markers ({{marker|type=city|name=[[George Town (Malaysia)|...]]}}) come first; other links only if there are none.
const agLinks = w => {
  const ok = t => !/^(File|Image|Category|w|wikipedia|:)/i.test(t);
  const marked = [...w.matchAll(/\{\{\s*marker[^{}]*?name\s*=\s*\[\[([^\]|#]+)/gi)].map(m => m[1].trim()).filter(ok);
  return [...new Set(marked.length ? marked : [...w.matchAll(/\[\[([^\]|#]+)/g)].map(m => m[1].trim()).filter(ok))];
};

/* ---------- what each listing becomes ---------- */
const AG_RULES = [
  [/theme park|amusement|disney|universal studios|water park|legoland/i, { hrs:8, when:'full', tags:[] }],
  [/museum|gallery|exhibition|aquarium/i, { hrs:2, indoor:true, tags:['history'] }],
  [/palace|castle|temple|shrine|pagoda|church|cathedral|mosque|basilica|monastery|fort\b|fortress|tomb|mausoleum|ruins?\b|historic|heritage|monument|old town|gate\b/i, { hrs:1.5, tags:['history'] }],
  [/tower|observation|observatory|skyline|lookout|viewpoint|sky ?deck|cable car/i, { hrs:1.25, tags:['views'], when:'afternoon' }],
  [/park\b|garden|lake|mountain|hill|beach|river|island|forest|waterfall|zoo|botanic|nature|trail|hike/i, { hrs:2, tags:['nature'] }],
  [/night market|bar\b|club|pub\b|nightlife|show\b|theatre|theater|concert|cabaret/i, { hrs:2, tags:['night'], when:'evening' }],
  [/market|mall|shopping|bazaar|arcade|street\b|district|quarter/i, { hrs:1.5, tags:['shopping'] }]
];
function agShape(x) {
  const hay = `${x.name} ${x.sec} ${x.text.slice(0, 200)}`;
  const r = AG_RULES.find(([re]) => re.test(hay))?.[1] || {};
  const o = { hrs: x.kind === 'do' ? 2 : 1.5, when: 'any', tags: [], ...r, tags: [...(r.tags || [])] };
  if (/view|panoram/i.test(x.text) && !o.tags.includes('views')) o.tags.push('views');
  if (/best (seen |visited )?(at|after) (night|dark|sunset)|at night|in the evening|after dark|lit up|light show|illuminated/i.test(x.text) && o.when === 'any') o.when = 'evening';
  return o;
}
const agPrice = sec => /budget|cheap|inexpensive|street food/.test(sec) ? 1 : /mid|moderate/.test(sec) ? 2 : /splurge|expensive|upscale|luxury|fine/.test(sec) ? 3 : 0;
// A name in the local script, if the listing gives one.
const agLocal = alt => alt.split(/[,;/(]/).map(s => s.replace(/\)/g, '').trim()).find(s => /[^\u0000-ɏḀ-ỿ\s\d\p{P}\p{S}]/u.test(s)) || '';
const agSlug = s => s.toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'x';

/* ---------- fetching ---------- */
const WV = 'https://en.wikivoyage.org/w/api.php?format=json&formatversion=2&origin=*&';
// Wikimedia asks busy clients to slow down (HTTP 429): wait and try again, twice.
async function agGet(url, ms = 20000) {
  for (let i = 0; ; i++) {
    try { return await jget(url, ms); }
    catch (e) { if (i >= 2 || !/429|503/.test(e.message)) throw e; await new Promise(r => setTimeout(r, 3000 * (i + 1))); }
  }
}
const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));
async function agFindArticle(code) {
  const c = CITY[code], [la, lo] = ptOf(code);
  const near = p => !p.coordinates?.[0] || km([p.coordinates[0].lat, p.coordinates[0].lon], [la, lo]) < 60;
  for (const title of [c.city, `${c.city} (${(() => { try { return new Intl.DisplayNames(['en'], { type:'region' }).of(c.cc); } catch { return c.cc; } })()})`]) {
    const j = await agGet(WV + `action=query&redirects=1&prop=pageprops|coordinates&ppprop=disambiguation&titles=${encodeURIComponent(title)}`);
    const p = j.query?.pages?.[0];
    if (p && !p.missing && !p.pageprops && near(p)) return p.title;
  }
  const g = await agGet(WV + `action=query&list=geosearch&gscoord=${la}|${lo}&gsradius=10000&gslimit=20&gsnamespace=0`);
  const hit = (g.query?.geosearch || [])[0];
  return hit ? hit.title.split('/')[0] : null;
}
async function agPages(titles) {
  const out = {};
  for (const part of chunk(titles, 8)) {
    const j = await agGet(WV + `action=query&prop=revisions&rvprop=content&rvslots=main&redirects=1&titles=${encodeURIComponent(part.join('|'))}`, 30000);
    (j.query?.pages || []).forEach(p => { const w = p.revisions?.[0]?.slots?.main?.content; if (w) out[p.title] = w; });
  }
  return out;
}
// Wikidata: how many Wikipedias cover each place (how widely known it is), its English article and local name.
async function agWikidata(qids, lang) {
  const out = {};
  for (const part of chunk(qids, 50)) {
    const j = await agGet(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*&props=sitelinks|labels&languages=${lang}&ids=${part.join('|')}`);
    Object.entries(j.entities || {}).forEach(([q, e]) => {
      const sl = e.sitelinks || {};
      out[q] = { n: Object.keys(sl).filter(k => /wiki$/.test(k) && k !== 'commonswiki' && k !== 'specieswiki').length, en: sl.enwiki?.title || '', local: e.labels?.[lang]?.value || '' };
    });
  }
  return out;
}
// English Wikipedia articles named like listings that have no Wikidata link, accepted only within 3 km of the listing.
async function agByName(list) {
  const out = new Map();
  for (const part of chunk(list, 50)) {
    const name = x => x.name.replace(/\s*\(.*?\)\s*/g, ' ').trim();
    const j = await agGet(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageprops|coordinates&ppprop=wikibase_item&titles=${encodeURIComponent(part.map(name).join('|'))}`);
    const fwd = {}; [...(j.query?.normalized || []), ...(j.query?.redirects || [])].forEach(r => fwd[r.from] = r.to);
    const pages = Object.fromEntries((j.query?.pages || []).filter(p => !p.missing).map(p => [p.title, p]));
    part.forEach(x => {
      let t = name(x); for (let i = 0; i < 3 && fwd[t]; i++) t = fwd[t];
      const p = pages[t], c = p?.coordinates?.[0];
      if (p?.pageprops?.wikibase_item && c && km([c.lat, c.lon], [x.lat, x.lon]) <= 3) out.set(x, { qid: p.pageprops.wikibase_item, wp: p.title });
    });
  }
  return out;
}
// Wikimedia Commons, for places with no Wikipedia article: a photo whose file name contains every distinctive word of
// the place's name ("Jalan Alor at night.jpg" for Jalan Alor), so a nearby but unrelated photo is never used.
const AG_PLAIN = new Set('the and restaurant restoran cafe café coffee kopitiam bar pub shop store mall centre center market food court house kitchen hotel'.split(' '));
async function agCommonsSearch(list, city) {
  const out = new Map(), cityWords = new Set(city.toLowerCase().split(/\s+/));
  const words = s => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !AG_PLAIN.has(w) && !cityWords.has(w));
  for (const part of chunk(list, 6)) await Promise.all(part.map(async x => {
    const need = words(x.name); if (!need.length) return;
    const j = await agGet(`https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&list=search&srnamespace=6&srlimit=8&srsearch=${encodeURIComponent(`${x.name} ${city}`)}`).catch(() => null);
    const hit = (j?.query?.search || []).map(r => r.title.replace(/^File:/, '')).find(f => /\.(jpe?g|png|webp)$/i.test(f) && !/logo/i.test(f) && need.every(w => f.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').includes(w)));
    if (hit) out.set(x, hit);
  }));
  return out;
}
// A restaurant with no photo of its own shows the dish it's known for, labelled as such. Most specific first.
const AG_DISHES = [
  [/banana[- ]leaf|daun pisang/i, 'Banana leaf rice'], [/food court|hawker|street food|food street|glutton|hutong/i, 'Hawker centre'], [/nasi lemak/i, 'Nasi lemak'], [/nasi kandar/i, 'Nasi kandar'], [/satay|\bsate\b/i, 'Satay'], [/laksa/i, 'Laksa'],
  [/dim ?sum|yum cha/i, 'Dim sum'], [/roti canai|roti prata/i, 'Roti canai'], [/char k[wu]e?y? teow/i, 'Char kway teow'], [/chicken rice/i, 'Hainanese chicken rice'],
  [/bak kut teh/i, 'Bak kut teh'], [/hokkien mee/i, 'Hokkien mee'], [/beef (noodle|ball)/i, 'Beef noodle soup'], [/wan ?ton|won ?ton/i, 'Wonton noodles'],
  [/dosa|thosai/i, 'Dosa'], [/biryani|briyani/i, 'Biryani'], [/kaya|kopitiam/i, 'Kaya toast'], [/ramen/i, 'Ramen'], [/sushi/i, 'Sushi'], [/\bpho\b|phở/i, 'Pho'],
  [/banh mi|bánh mì/i, 'Bánh mì'], [/bibimbap/i, 'Bibimbap'], [/korean (bbq|barbecue)|samgyeopsal|galbi/i, 'Korean barbecue'], [/mandu|dumpling|jiaozi|xiaolongbao/i, 'Dumpling'],
  [/hot ?pot|steamboat|shabu/i, 'Hot pot'], [/tapas/i, 'Tapas'], [/pizza/i, 'Pizza'], [/burger/i, 'Hamburger'], [/steak/i, 'Steak'], [/fried chicken|\bchicken\b(?! rice)/i, 'Fried chicken'],
  [/seafood|crab|prawn|lobster|oyster/i, 'Seafood'], [/curry/i, 'Curry'], [/noodle/i, 'Noodle'], [/bakery|pastr|cake|dessert/i, 'Pastry'], [/ice cream|gelato/i, 'Ice cream'],
  [/cocktail/i, 'Cocktail'], [/beer|brew/i, 'Beer'], [/wine/i, 'Wine'], [/vegetarian|vegan/i, 'Vegetarian cuisine'], [/coffee|café|cafe/i, 'Coffee'], [/\btea\b|teahouse/i, 'Tea']
];
// The name says most ("Super Noodle House"), so it is matched before the description.
const agDish = x => (AG_DISHES.find(([re]) => re.test(x.name)) || AG_DISHES.find(([re]) => re.test(x.text)))?.[1] || '';
// English Wikipedia: each article's lead photo (free licences only) and coordinates.
async function agWikipedia(titles) {
  const out = {};
  for (const part of chunk(titles, 50)) {
    const j = await agGet(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=pageimages|coordinates&piprop=name&pilicense=free&colimit=max&titles=${encodeURIComponent(part.join('|'))}`);
    const back = {}; [...(j.query?.normalized || []), ...(j.query?.redirects || [])].forEach(r => back[r.to] = r.from);
    (j.query?.pages || []).forEach(p => {
      let t = p.title; const seen = new Set();
      const v = { img: p.pageimage || '', ll: p.coordinates?.[0] ? [+p.coordinates[0].lat.toFixed(5), +p.coordinates[0].lon.toFixed(5)] : null, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}` };
      out[t] = v; while (back[t] && !seen.has(t)) { seen.add(t); t = back[t]; out[t] = v; }
    });
  }
  return out;
}
// Image details (Wikimedia Commons, or English Wikipedia for its own free files): a 480 px thumbnail, the author and the licence, for the photo credit.
async function agCommons(files) {
  const out = {};
  for (const part of chunk(files, 50)) {
    const j = await agGet(`https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&origin=*&redirects=1&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=480&iiextmetadatafilter=Artist|LicenseShortName&titles=${encodeURIComponent(part.map(f => 'File:' + f.replace(/^(File|Image):/i, '')).join('|'))}`);
    const back = {}; (j.query?.normalized || []).forEach(r => back[r.to] = r.from);
    (j.query?.pages || []).forEach(p => {
      const ii = p.imageinfo?.[0]; if (!ii?.thumburl) return;
      const md = ii.extmetadata || {}, v = { src: ii.thumburl.split('?')[0], page: ii.descriptionurl, by: agText(String(md.Artist?.value || 'Wikimedia Commons')).slice(0, 60) || 'Wikimedia Commons', license: md.LicenseShortName?.value || 'Free licence' };
      const f = p.title.replace(/^File:/, ''); out[f] = v; if (back[p.title]) out[back[p.title].replace(/^(File|Image):/i, '')] = v;
    });
  }
  return out;
}

/* ---------- building a city's guide ---------- */
const agStatus = {};
async function buildAutoGuide(k) {
  const code = KEY_CODE[k], c = CITY[code], lang = (langOf(c.cc) || 'en').toLowerCase();
  const title = await agFindArticle(code);
  if (!title) return { v: AG_VER, code, none: true, at: Date.now() };
  const main = (await agPages([title]))[title] || Object.values(await agPages([title]))[0] || '';
  const secs = agSections(main), areas = agAreas(main, title);
  const pages = { [title]: main };
  // A big city keeps its listings on district pages; a region (Penang, Bali) on its towns' pages.
  let subs = areas.map(a => a.page).filter(Boolean);
  if (!subs.length && agListings(main, title).length < 15) subs = agLinks(Object.keys(secs).filter(k => /^(cities|towns|districts)/.test(k)).map(k => secs[k]).join(' ')).slice(0, 6);
  if (subs.length) Object.assign(pages, await agPages(subs.slice(0, 16)));
  // A town page can itself be split into districts (George Town): follow those too, up to 16 pages in all.
  const more = Object.entries(pages).filter(([p, w]) => p !== title && agListings(w, p).length < 15).flatMap(([, w]) => agAreas(w).map(a => a.page)).filter(p => p && !pages[p]);
  if (more.length) Object.assign(pages, await agPages(more.slice(0, Math.max(0, 16 - Object.keys(pages).length + 1))));
  let all = Object.entries(pages).flatMap(([p, w]) => agListings(w, p));
  // Only places within reach of the city: a region's page links to towns far away.
  const centre = ptOf(code), reach = ll => km(ll, centre) <= 60;
  all = all.filter(x => x.lat ? reach([x.lat, x.lon]) : x.page === title || areas.length > 0);
  // Places that have closed are dropped, and the same place listed twice (on the city page and a district page) is kept once.
  all = all.filter(x => !/permanently closed|closed permanently|has (now )?closed|no longer (open|operat)|in renewal|closed for renovation/i.test(x.text + ' ' + x.hours));
  const seen = new Set(), norm = s => s.toLowerCase().replace(/^the\s+/, '').replace(/[^\p{L}\p{N}]+/gu, '');
  // When a place is listed twice, the fuller description wins.
  const kept = new Map();
  all = all.filter(x => { const keys = [x.qid, norm(x.name), agLocal(x.alt) && norm(agLocal(x.alt))].filter(Boolean).map(v => (x.kind === 'do' ? 'see' : x.kind) + ':' + v);
    const dup = keys.map(v => kept.get(v)).find(Boolean);
    if (dup) { if (x.text.length > dup.text.length) Object.assign(dup, x); return false; }
    keys.forEach(v => kept.set(v, x)); return true; });

  // Yearly events (a music festival in July) aren't places to visit on any date, so they're left out.
  let sights = all.filter(x => (x.kind === 'see' || x.kind === 'do') && !/festival|carnival|regatta|marathon|parade|fair/i.test(x.name)).slice(0, 220);
  (await agByName(sights.filter(x => !x.qid && !x.wp && x.lat).slice(0, 150)).catch(() => new Map())).forEach((v, x) => { x.qid = v.qid; x.wp = v.wp; });
  // Two listings that turn out to be the same Wikipedia article ("Kek Lok Si" and "Kek Lok Si Temple"): keep the fuller one.
  const byQ = new Map(); sights.forEach(x => { if (!x.qid) return; const o = byQ.get(x.qid); if (!o || x.text.length > o.text.length) byQ.set(x.qid, x); });
  sights = sights.filter(x => !x.qid || byQ.get(x.qid) === x);
  const wd = await agWikidata([...new Set(all.map(x => x.qid).filter(Boolean))].slice(0, 300), lang).catch(() => ({}));
  // Wikidata links are sometimes to the wrong thing (a broadcaster for its studio): only trust them when a name matches.
  const words = s => new Set(s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^\p{L}\p{N}]+/u).filter(w => w.length > 2 && !/^(the|and|of|de|la)$/.test(w)));
  const match = x => { const e = wd[x.qid]; if (!e) return false; const a = words(`${x.name} ${x.alt}`), b = words(`${e.en} ${e.local}`); return [...a].some(w => b.has(w) || [...b].some(v => v.length > 4 && (v.includes(w) || w.includes(v)))); };
  const links = x => match(x) ? (wd[x.qid]?.n || 0) : Math.min(4, wd[x.qid]?.n || 0);
  // Universities, stadiums and company offices have many Wikipedia articles but are rarely why people visit.
  const notSight = x => /universit|college|school|hospital|broadcast|headquarters|stadium|arena|station\b|airport|embassy|office/i.test(x.name + ' ' + x.text.slice(0, 80));
  const score = x => links(x) * (notSight(x) ? .3 : 1) + (x.text ? 2 : -6) + (x.wp || wd[x.qid]?.en ? 4 : 0) + (x.image ? 2 : 0) + (x.lat ? 1 : 0) + (x.kind === 'see' ? 1 : 0);
  const keepSights = sights.map((x, i) => ({ x, i, s: score(x) })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 40).map(o => o.x);
  const famous = x => links(x) >= 8 && !!x.text;
  const pick = (list, n) => list.map((x, i) => ({ x, i })).sort((a, b) => (famous(b.x) - famous(a.x)) || (!!b.x.lat - !!a.x.lat) || a.i - b.i).slice(0, n).map(o => o.x);
  const eats = pick(all.filter(x => x.kind === 'eat'), 28), drinks = pick(all.filter(x => x.kind === 'drink'), 8), buys = pick(all.filter(x => x.kind === 'buy'), 16), sleeps = pick(all.filter(x => x.kind === 'sleep'), 12);
  const keep = [...keepSights, ...eats, ...drinks, ...buys, ...(areas.length ? [] : sleeps)];

  // Restaurants, markets and shops can have Wikipedia articles too (Jalan Alor, Central Market).
  (await agByName(keep.filter(x => !x.qid && !x.wp && x.lat && !keepSights.includes(x))).catch(() => new Map())).forEach((v, x) => { x.qid = v.qid; x.wp = v.wp; });
  const eatery = x => x.kind === 'eat' || x.kind === 'drink';
  const wpTitles = [...new Set([...keep.map(x => x.wp || wd[x.qid]?.en), ...keep.filter(eatery).map(agDish)].filter(Boolean))];
  const wp = await agWikipedia(wpTitles).catch(() => ({}));
  // Logos make poor cover photos, so they count as no photo.
  const usable = f => f && !/logo|\.svg$/i.test(f) ? f : '';
  const fileOf = x => usable(wp[x.wp || wd[x.qid]?.en]?.img) || usable(x.image.replace(/^(File|Image):/i, ''));
  const found = await agCommonsSearch(keep.filter(x => !fileOf(x)).slice(0, 48), c.city).catch(() => new Map());
  found.forEach((f, x) => { x.image = f; });
  const dishOf = x => eatery(x) && !fileOf(x) && usable(wp[agDish(x)]?.img) ? agDish(x) : '';
  const cm = await agCommons([...new Set([...keep.map(fileOf), ...keep.map(dishOf).map(d => d && wp[d].img)].filter(Boolean))]).catch(() => ({}));

  const ids = new Set(), n = keepSights.length, t3 = Math.max(3, Math.min(8, Math.round(n * .15))), t2 = t3 + Math.round(n * .35);
  const items = keep.filter(x => { const w = wp[x.wp || wd[x.qid]?.en]; return x.lat || !w?.ll || reach(w.ll); }).map(x => {
    let id = `a-${code.toLowerCase()}-${agSlug(x.name)}`; while (ids.has(id)) id += '2'; ids.add(id);
    const w = wp[x.wp || wd[x.qid]?.en], ll = x.lat && x.lon ? [+x.lat.toFixed(5), +x.lon.toFixed(5)] : w?.ll || null;
    const sents = agSentences(x.text), sight = x.kind === 'see' || x.kind === 'do';
    const shape = sight ? agShape(x) : { hrs: x.kind === 'buy' ? .75 : x.kind === 'sleep' ? 0 : x.kind === 'drink' ? 1 : .75, when: x.kind === 'drink' ? 'evening' : 'any', tags: [x.kind === 'buy' ? 'shopping' : x.kind === 'drink' ? 'night' : 'food'] };
    const rank = keepSights.indexOf(x);
    return {
      id, k: sight ? 'place' : x.kind === 'buy' ? 'buy' : x.kind === 'sleep' ? 'sleep' : 'food', sub: x.kind,
      tier: sight ? (rank < t3 ? 3 : rank < t2 ? 2 : 1) : famous(x) ? 3 : 2,
      n: x.name, l: agLocal(x.alt) || (sameName(wd[x.qid]?.local, x.name) ? '' : wd[x.qid]?.local || ''), ...shape,
      why: sents[0] || '', d: sents.slice(1).join(' ').slice(0, 420), how: x.how.slice(0, 200), price: x.price.slice(0, 80), pc: agPrice(x.sec),
      area: x.page !== title ? x.page.split('/').pop() : '', ll,
      det: { addr: x.addr, hours: x.hours, phone: x.phone, web: x.url, wiki: w?.url ? { en: w.url } : null },
      img: cm[fileOf(x)] || (dishOf(x) && cm[wp[dishOf(x)].img] ? { ...cm[wp[dishOf(x)].img], dish: dishOf(x) } : null)
    };
  });
  const prose = (key, n = 2) => { const sub = Object.keys(secs).find(s => s.startsWith(key + '/') && agProse(secs[s], 1).length);
    return agSentences(agProse(secs[key] || '', 2).join(' ') || (sub ? agProse(secs[sub], 2).join(' ') : '')).slice(0, n).join(' '); };
  const safeKey = Object.keys(secs).find(s => s === 'stay safe') || '';
  const safe = safeKey ? agProse(secs[safeKey], 7) : [];
  ['stay safe/scams', 'stay safe/crime'].forEach(s => secs[s] && safe.push(...agProse(secs[s], 3)));
  return {
    v: AG_VER, code, title, at: Date.now(), items,
    lead: agSentences(agProse(secs[''] || '', 2).join(' ')).slice(0, 2).join(' '),
    buyTip: prose('buy'), stayTip: prose('sleep') || prose('districts'),
    areas: areas.map(a => ({ n: a.n, d: a.d.slice(0, 300), page: a.page })),
    safe: safe.slice(0, 8).map(s => s.slice(0, 500))
  };
}

/* ---------- merging a built guide into the app's guide data ---------- */
const wvUrl = t => `https://en.wikivoyage.org/wiki/${encodeURIComponent(t.replace(/ /g, '_')).replace(/%2F/g, '/')}`;
function agMerge(k, g, live) {
  if (!g || g.none || !g.items) return;
  for (let i = ITEMS.length - 1; i >= 0; i--) if (ITEMS[i].c === k && ITEMS[i].auto) { delete BY[ITEMS[i].id]; ITEMS.splice(i, 1); }
  g.items.forEach(x => {
    const it = { id: x.id, c: k, k: x.k, sub: x.sub, tier: x.tier, n: x.n, l: x.l || x.n, hrs: x.hrs, when: x.when, indoor: !!x.indoor, tags: x.tags || [], tip: '',
      zone: x.ll ? `@${x.ll[0]},${x.ll[1]}` : '', why: x.why, d: x.d, how: x.how, price: x.price, pc: x.pc, area: x.area, auto: true };
    if (x.k !== 'sleep') { ITEMS.push(it); BY[it.id] = it; }
    if (x.ll) AG_LL[x.id] = x.ll;
    if (x.img) AG_PHOTOS[x.id] = x.img;
    AG_DETAILS[x.id] = x.det || {};
  });
  const nights = NIGHT_BASE.filter(n => n.city === k && n.kind !== 'flight').length;
  CTX[k] = esc(g.lead || '') || esc(CITY[KEY_CODE[k]]?.city || k);
  AG_META[k] = { title: g.title, at: g.at, nights };
  BUY_TIP[k] = g.buyTip || '';
  STAY_TIP[k] = g.stayTip || '';
  STAYS[k] = g.areas?.length ? g.areas.map(a => ({ auto: true, n: a.n, d: a.d, wv: a.page ? wvUrl(a.page) : '' }))
    : g.items.filter(x => x.k === 'sleep').map(x => ({ auto: true, n: x.n, d: [x.why, x.d].filter(Boolean).join(' '), price: x.price, addr: x.det?.addr, web: x.det?.web }));
  SKIPS[k] = g.safe?.length ? [{ auto: true, paras: g.safe }] : [];
  // Once the app is running, the shared photo, detail and map tables take the new entries directly.
  if (live) { Object.assign(PHOTOS, AG_PHOTOS); Object.assign(DETAILS, AG_DETAILS); Object.assign(COORDS, AG_LL); }
}
AG_KEYS.forEach(k => { const g = store.get(agKey(KEY_CODE[k])); if (g && g.v === AG_VER) agMerge(k, g); });

// Builds missing guides when online, then fills the plan if it is still empty.
async function ensureAutoGuides(force) {
  for (const k of AG_KEYS) {
    const code = KEY_CODE[k], have = store.get(agKey(code));
    if (!force && have && have.v === AG_VER && !(have.none && Date.now() - have.at > 7 * D)) continue;
    if (navigator.onLine === false || agStatus[k] === 'busy') continue;
    agStatus[k] = 'busy'; if (xCity === k) renderExplore();
    try {
      const g = await buildAutoGuide(k);
      store.set(agKey(code), g); agMerge(k, g, true); agStatus[k] = g.none ? 'none' : 'ok';
      // A new guide fills that city's days that have nothing planned yet; Update leaves your plan alone.
      if (!g.none && !force) fillCity(k);
    } catch (e) { agStatus[k] = 'err'; }
    renderDays(); renderExplore();
  }
}
