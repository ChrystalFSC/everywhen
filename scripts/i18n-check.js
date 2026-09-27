// Lists English strings in the source that have no Chinese entry in data/zh.tsv.
// Checks t('...') literals, quoted strings inside t(...) ternaries, and guide/places data text fields.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const zh = new Set(fs.readFileSync(path.join(root, 'data/zh.tsv'), 'utf8').split(/\r?\n/).filter(l => l && !l.startsWith('#')).map(l => l.split('\t')[0]));
const miss = new Set();
const add = s => { if (s && /[A-Za-z]{3}/.test(s) && !zh.has(s)) miss.add(s); };
for (const f of ['src/everywhen.html', 'src/guide.js', 'src/evaluate.js', 'src/translate.js', 'src/engine.js', 'src/map.js', 'src/mine.js']) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  for (const m of src.matchAll(/\bt\(((?:[^()]|\([^()]*\))*)\)/g)) {
    for (const q of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) add(q[1].replace(/\\'/g, "'"));
  }
}
const data = fs.readFileSync(path.join(root, 'src/guide-data.js'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'src/places-data.js'), 'utf8');
const D = new Function(data + '; return { ITEMS, SKIPS, STAYS, STAY_TIP, CTX, CITIES, INTERESTS, PLACES };')();
D.ITEMS.forEach(i => { add(i.n); ['why', 'd', 'tip', 'how', 'where'].forEach(k => add(i[k])); });
Object.values(D.SKIPS).flat().forEach(s => { add(s.n); add(s.why); add(s.instead); });
Object.values(D.STAYS).flat().forEach(s => ['n', 'best', 'good', 'watch', 'how'].forEach(k => add(s[k])));
Object.values(D.STAY_TIP).forEach(add);
Object.values(D.CTX).forEach(add);
Object.values(D.CITIES).forEach(c => { add(c.n); add(c.train); add(c.leave); });
D.INTERESTS.forEach(([, n]) => add(n));
D.PLACES.forEach(p => add(p.note));
console.log([...miss].join('\n') || 'All strings translated.');
console.log(`\n${miss.size} missing`);
