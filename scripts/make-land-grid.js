// Rasterises Natural Earth land (world-atlas land-50m.json) into the world dot-grid bitmap used by the trip map.
// Usage: curl -o land.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json && node scripts/make-land-grid.js > data/land-grid.json
const t = require(require('path').resolve('land.json'));
const [sx, sy] = t.transform.scale, [tx, ty] = t.transform.translate;
const arcs = t.arcs.map(a => { let x = 0, y = 0; return a.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; }); });
const ring = r => { const pts = []; r.forEach(i => { const a = i < 0 ? arcs[~i].slice().reverse() : arcs[i]; pts.push(...(pts.length ? a.slice(1) : a)); }); return pts; };
const polys = []; const g = t.objects.land;
(g.geometries || [g]).forEach(o => { if (o.type === 'Polygon') polys.push(o.arcs.map(ring)); if (o.type === 'MultiPolygon') o.arcs.forEach(p => polys.push(p.map(ring))); });
// bounding box per polygon so each grid point only tests the few polygons that could contain it
const boxed = polys.map(p => { const xs = p[0].map(q => q[0]), ys = p[0].map(q => q[1]); return { p, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }; });
function inRing(x, y, r) { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
const W = [-180, 180], H = [-60, 84], st = 0.4;
const cols = Math.round((W[1] - W[0]) / st), rows = Math.round((H[1] - H[0]) / st);
const bytes = Buffer.alloc(Math.ceil(cols * rows / 8)); let n = 0;
for (let r = 0; r < rows; r++) {
  const lat = H[1] - (r + .5) * st, row = boxed.filter(b => lat >= b.y0 && lat <= b.y1);
  for (let c = 0; c < cols; c++) {
    const lon = W[0] + (c + .5) * st;
    if (row.some(b => lon >= b.x0 && lon <= b.x1 && inRing(lon, lat, b.p[0]) && !b.p.slice(1).some(h => inRing(lon, lat, h)))) { const i = r * cols + c; bytes[i >> 3] |= 1 << (i & 7); n++; }
  }
}
console.log(JSON.stringify({ cols, rows, st, W, H, land: n, b64: bytes.toString('base64') }));
