// Rasterises Natural Earth land (world-atlas land-50m.json) into the dot-grid bitmap used by the map.
// Usage: curl -o land.json https://cdn.jsdelivr.net/npm/world-atlas@2/land-50m.json && node scripts/make-land-grid.js > data/land-grid.json
const t=require(require('path').resolve('land.json'));const [sx,sy]=t.transform.scale,[tx,ty]=t.transform.translate;
const arcs=t.arcs.map(a=>{let x=0,y=0;return a.map(([dx,dy])=>{x+=dx;y+=dy;return [x*sx+tx,y*sy+ty]})});
const ring=r=>{let pts=[];r.forEach(i=>{let a=i<0?arcs[~i].slice().reverse():arcs[i];pts.push(...(pts.length?a.slice(1):a))});return pts};
const polys=[];const g=t.objects.land;(g.geometries||[g]).forEach(o=>{if(o.type==='Polygon')polys.push(o.arcs.map(ring));if(o.type==='MultiPolygon')o.arcs.forEach(p=>polys.push(p.map(ring)))});
const W=[94,130],H=[-4,38],st=0.4;
// bbox filter
const cand=polys.filter(p=>{let r=p[0];return r.some(([x,y])=>x>W[0]-5&&x<W[1]+5&&y>H[0]-5&&y<H[1]+5)});
function inRing(x,y,r){let c=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const[xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!=(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)c=!c}return c}
const inLand=(x,y)=>cand.some(p=>inRing(x,y,p[0])&&!p.slice(1).some(h=>inRing(x,y,h)));
const cols=Math.round((W[1]-W[0])/st),rows=Math.round((H[1]-H[0])/st);let bits=[],n=0;
for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const lon=W[0]+(c+.5)*st,lat=H[1]-(r+.5)*st;const v=inLand(lon,lat)?1:0;bits.push(v);n+=v}
const bytes=Buffer.alloc(Math.ceil(bits.length/8));bits.forEach((b,i)=>{if(b)bytes[i>>3]|=1<<(i&7)});
console.log(JSON.stringify({cols,rows,st,W,H,land:n,b64:bytes.toString('base64')}));
