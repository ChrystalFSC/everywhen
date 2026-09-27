// Builds Everywhen from src/ (markup, styles, modules) with fonts, map data and photo credits inlined:
//   index.html                    installable, offline-capable web app (GitHub Pages)
//   sw.js                         offline cache, versioned by content hash, precaching every photo
//   build/everywhen.artifact.html page body only, for hosts that supply their own <head>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const b64 = f => fs.readFileSync(path.join(root, f)).toString('base64');
const inject = (s, marker, value) => s.split(marker).join(value);

const styles = inject(inject(read('src/styles.css'),
  '__FONT_DISPLAY__', b64('data/fonts/big-shoulders-display.woff2')),
  '__FONT_MONO__', b64('data/fonts/jetbrains-mono.woff2'));
let src = read('src/everywhen.html');
// Leaflet (BSD-2-Clause) is bundled so maps need no CDN; its CSS goes first so ours can override it.
src = inject(src, '__STYLES__', read('data/vendor/leaflet.css') + '\n' + styles);
src = inject(src, '/* __LEAFLET__ */', read('data/vendor/leaflet.js').replace(/\/\/# sourceMappingURL=.*$/m, ''));
src = inject(src, '/* __GUIDE_DATA__ */', read('src/guide-data.js'));
src = inject(src, '/* __GUIDE__ */', read('src/guide.js'));
src = inject(src, '/* __ENGINE__ */', read('src/engine.js'));
src = inject(src, '/* __I18N__ */', read('src/i18n.js'));
src = inject(src, '/* __PLACES__ */', read('src/places-data.js'));
src = inject(src, '/* __EVALUATE__ */', read('src/evaluate.js'));
src = inject(src, '/* __MAP__ */', read('src/map.js'));
src = inject(src, '/* __MINE__ */', read('src/mine.js'));
const zh = {};
read('data/zh.tsv').split(/\r?\n/).forEach(line => { if (!line || line.startsWith('#')) return; const i = line.indexOf('\t'); if (i > 0) zh[line.slice(0, i)] = line.slice(i + 1); });
src = inject(src, '__ZH__', JSON.stringify(zh));
src = inject(src, '/* __TRANSLATE__ */', read('src/translate.js'));
src = inject(src, '__PHOTOS__', read('data/photos.json').trim());
src = inject(src, '__COORDS__', read('data/coords.json').trim());
src = inject(src, '__DETAILS__', fs.existsSync(path.join(root, 'data/details.json')) ? read('data/details.json').trim() : '{}');
src = inject(src, '__GRID__', read('data/land-grid.json').trim());
if (/__[A-Z_]+__/.test(src.replace(/__proto__/g, ''))) throw new Error('Unreplaced marker: ' + src.match(/__[A-Z_]+__/)[0]);

fs.mkdirSync(path.join(root, 'build'), { recursive: true });
fs.writeFileSync(path.join(root, 'build/everywhen.artifact.html'), src);

const head = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FAF8FF">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Everywhen">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<link rel="manifest" href="manifest.webmanifest">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
<style>:root{padding-top:env(safe-area-inset-top,0px)}[hidden]{display:none!important}img{max-width:100%}</style>
`;
const swReg = `
<script>
// Cache the app on first visit so it opens with no connection (e.g. on Chinese networks).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
</script>`;
const page = head + src.replace('</style>\n', '</style>\n</head>\n<body>\n') + swReg + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(root, 'index.html'), page);

// Service worker: precache the page, icons and every photo; the version changes whenever any of them does.
const photos = fs.readdirSync(path.join(root, 'images/photos')).filter(f => f.endsWith('.jpg')).map(f => `./images/photos/${f}`);
const assets = ['./', './index.html', './manifest.webmanifest', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', ...photos];
const hash = crypto.createHash('sha256').update(page);
photos.forEach(p => hash.update(fs.readFileSync(path.join(root, p))));
let sw = read('sw.js')
  .replace(/const VERSION = '[^']*';/, `const VERSION = 'everywhen-${hash.digest('hex').slice(0, 10)}';`)
  .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = ${JSON.stringify(assets)};`);
fs.writeFileSync(path.join(root, 'sw.js'), sw);
console.log(`index.html ${(page.length / 1024).toFixed(0)} KB, ${photos.length} photos precached`);
