// Builds data/airports.json, the airport list behind "Create a trip": every airport with an IATA code, with city,
// country, coordinates and IANA time zone. Source: github.com/mwgg/Airports (MIT licence).
// Usage: curl -o airports-src.json https://raw.githubusercontent.com/mwgg/Airports/master/airports.json
//        node scripts/make-airports.js airports-src.json
const fs = require('fs'), path = require('path');
const src = JSON.parse(fs.readFileSync(process.argv[2] || 'airports-src.json', 'utf8'));
const tzs = [], tzi = tz => { let i = tzs.indexOf(tz); if (i < 0) { i = tzs.length; tzs.push(tz); } return i; };
const short = n => n.replace(/\bInternational\b/g, 'Intl').replace(/\s+Airport$/, '').replace(/\s+/g, ' ').trim();
const rows = Object.values(src).filter(a => a.iata && /^[A-Z]{3}$/.test(a.iata) && a.tz && isFinite(a.lat))
  // international airports first, so searches list the likely choice at the top
  .sort((a, b) => (/International/.test(b.name) - /International/.test(a.name)) || a.iata.localeCompare(b.iata))
  .map(a => [a.iata, short(a.name), a.city || '', a.country, +a.lat.toFixed(3), +a.lon.toFixed(3), tzi(a.tz)]);
fs.writeFileSync(path.join(__dirname, '..', 'data/airports.json'), JSON.stringify({ tz: tzs, a: rows }));
console.log(rows.length, 'airports,', tzs.length, 'time zones');
