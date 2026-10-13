/* Everywhen flight lookup: a Cloudflare Worker between the app and AeroDataBox (via RapidAPI).
   The app asks  GET /?no=AK5203&date=2027-02-17  and gets back the timetable for that flight number on that
   local departure date, trimmed to what the trip form needs. The RapidAPI key stays here, as the secret
   RAPIDAPI_KEY, and never reaches the page. Answers are cached for 12 hours to save the free quota.

   Deploy: Cloudflare dashboard → Workers & Pages → Create → Worker, paste this file, Deploy.
   Then Settings → Variables and Secrets → add a Secret named RAPIDAPI_KEY with your RapidAPI key. */
const ALLOWED = /^https:\/\/chrystalfsc\.github\.io$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const json = (body, status, headers) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
// "2027-02-17 09:25+08:00" → "2027-02-17T09:25" (local time at that airport)
const local = s => (s || '').replace(' ', 'T').slice(0, 16);
const airport = a => a && a.iata ? {
  code: a.iata, name: a.name || a.shortName || a.iata, city: a.municipalityName || a.shortName || a.name || '',
  cc: a.countryCode || '', tz: a.timeZone || '', lat: a.location?.lat ?? null, lon: a.location?.lon ?? null
} : null;
const end = x => ({ airport: airport(x?.airport), time: local(x?.scheduledTime?.local || x?.scheduledTimeLocal), terminal: x?.terminal || '' });

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get('Origin') || '';
    const ok = ALLOWED.test(origin);
    const cors = { 'Access-Control-Allow-Origin': ok ? origin : 'https://chrystalfsc.github.io', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Vary': 'Origin' };
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'GET') return json({ error: 'method' }, 405, cors);
    if (!ok) return json({ error: 'origin' }, 403, cors);
    if (!env.RAPIDAPI_KEY) return json({ error: 'setup', message: 'Add the RAPIDAPI_KEY secret to this Worker.' }, 500, cors);

    const u = new URL(req.url);
    const no = (u.searchParams.get('no') || '').toUpperCase().replace(/[\s-]+/g, '');
    const date = u.searchParams.get('date') || '';
    if (!/^([A-Z]{2}|[A-Z]\d|\d[A-Z])[A-Z]?\d{1,4}[A-Z]?$/.test(no) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'input' }, 400, cors);

    const cache = caches.default, key = new Request(`https://everywhen-flights.cache/${no}/${date}`);
    const hit = await cache.match(key);
    if (hit) return json(await hit.json(), 200, cors);

    const r = await fetch(`https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(no)}/${date}?withAircraftImage=false&withLocation=false&dateLocalRole=Departure`, {
      headers: { 'X-RapidAPI-Key': env.RAPIDAPI_KEY, 'X-RapidAPI-Host': 'aerodatabox.p.rapidapi.com' }
    });
    let out;
    if (r.status === 204 || r.status === 404) out = { flights: [] };
    else if (r.status === 429) return json({ error: 'quota' }, 429, cors);
    else if (!r.ok) return json({ error: 'upstream', status: r.status }, 502, cors);
    else {
      const data = await r.json();
      out = { flights: (Array.isArray(data) ? data : []).map(f => ({
        no: (f.number || no).replace(/\s+/g, ''), airline: f.airline?.name || '', status: f.status || '',
        from: end(f.departure), to: end(f.arrival)
      })).filter(f => f.from.airport && f.to.airport && f.from.time && f.to.time) };
    }
    ctx.waitUntil(cache.put(key, new Response(JSON.stringify(out), { headers: { 'Cache-Control': `max-age=${out.flights.length ? 43200 : 21600}` } })));
    return json(out, 200, cors);
  }
};
