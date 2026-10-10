/* ================= Trips =================
   A trip is plain data: flights with local times at each airport, plus a snapshot of each airport (city, country,
   time zone, position). Everything else (stops, nights, days and their free hours, map area, clocks, currencies,
   languages) is derived here when the app starts. Switching trips reloads the app with another trip.
   The Shanghai trip is the built-in example; its hand-written extras stay attached to it. */
const H = 3600e3, M = 60e3, D = 24 * H;
const at = (y, mo, d, h, mi, off) => Date.UTC(y, mo - 1, d, h - off, mi);

/* ---------- time zones ---------- */
const TZF = {};
// Milliseconds a time zone is ahead of UTC at instant t (DST-aware).
function tzOffset(t, tz) {
  const f = TZF[tz] || (TZF[tz] = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle:'h23', year:'numeric', month:'numeric', day:'numeric', hour:'numeric', minute:'numeric' }));
  const p = {}; f.formatToParts(t).forEach(x => p[x.type] = x.value);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - Math.floor(t / M) * M;
}
// "2027-02-17T19:50" read as wall-clock time in tz, as an instant.
function zoned(iso, tz) {
  const [ds, ts = '12:00'] = String(iso).split('T'), [y, mo, d] = ds.split('-').map(Number), [h, mi] = ts.split(':').map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi); let t = wall - tzOffset(wall, tz); return wall - tzOffset(t, tz);
}
const offHours = (t, tz) => Math.round(tzOffset(t, tz) / (15 * M)) / 4;
// Calendar days are numbered from 1970-01-01, so trips can cross months and years.
const eday = (t, tz) => Math.floor((t + tzOffset(t, tz)) / D);
const isoDay = d => new Date(d * D).toISOString().slice(0, 10);
const dayAt = (d, tz, hh = 12, mm = 0) => zoned(`${isoDay(d)}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, tz);
const PD = n => Math.floor(Date.UTC(2027, 1, n) / D); // the Shanghai trip's February dates as day numbers

/* ---------- countries: currency, main language, emergency numbers (police, ambulance) ---------- */
const COUNTRY = {
  MY:['MYR','ms',['999','999']], SG:['SGD','en',['999','995']], CN:['CNY','zh',['110','120']], HK:['HKD','zh-HK',['999','999']], MO:['MOP','zh-HK',['999','999']],
  TW:['TWD','zh-TW',['110','119']], JP:['JPY','ja',['110','119']], KR:['KRW','ko',['112','119']], VN:['VND','vi',['113','115']], TH:['THB','th',['191','1669']],
  ID:['IDR','id',['110','118']], PH:['PHP','en',['911','911']], KH:['KHR','km',['117','119']], LA:['LAK','lo',['191','195']], MM:['MMK','my',['199','192']],
  BN:['BND','ms',['993','991']], IN:['INR','hi',['112','112']], LK:['LKR','si',['119','1990']], NP:['NPR','ne',['100','102']], MV:['MVR','en',['119','102']],
  BD:['BDT','bn',['999','999']], PK:['PKR','ur',['15','1122']], AE:['AED','ar',['999','998']], QA:['QAR','ar',['999','999']], SA:['SAR','ar',['911','911']],
  OM:['OMR','ar',['9999','9999']], TR:['TRY','tr',['112','112']], EG:['EGP','ar',['122','123']], MA:['MAD','ar',['19','15']], JO:['JOD','ar',['911','911']],
  IL:['ILS','he',['100','101']], AU:['AUD','en',['000','000']], NZ:['NZD','en',['111','111']], US:['USD','en',['911','911']], CA:['CAD','en',['911','911']],
  MX:['MXN','es',['911','911']], BR:['BRL','pt',['190','192']], AR:['ARS','es',['911','107']], GB:['GBP','en',['999','999']], IE:['EUR','en',['112','112']],
  FR:['EUR','fr',['112','112']], DE:['EUR','de',['110','112']], IT:['EUR','it',['112','112']], ES:['EUR','es',['112','112']], PT:['EUR','pt',['112','112']],
  NL:['EUR','nl',['112','112']], BE:['EUR','fr',['112','112']], AT:['EUR','de',['112','112']], CH:['CHF','de',['117','144']], GR:['EUR','el',['112','112']],
  FI:['EUR','fi',['112','112']], SE:['SEK','sv',['112','112']], NO:['NOK','no',['112','113']], DK:['DKK','da',['112','112']], IS:['ISK','is',['112','112']],
  PL:['PLN','pl',['112','112']], CZ:['CZK','cs',['112','112']], HU:['HUF','hu',['112','112']], HR:['EUR','hr',['112','112']], RU:['RUB','ru',['112','112']],
  ZA:['ZAR','en',['10111','10177']], KE:['KES','en',['999','999']]
};
/* Languages: English name, native name, speech-synthesis voice, translation code, and the line a driver needs. */
const LANGS = {
  zh:['Mandarin','中文','zh-CN','zh-CN','请带我去这个地址：'], 'zh-TW':['Mandarin','中文（繁體）','zh-TW','zh-TW','請帶我去這個地址：'], 'zh-HK':['Cantonese','廣東話','zh-HK','zh-TW','請帶我去呢個地址：'],
  vi:['Vietnamese','Tiếng Việt','vi-VN','vi','Làm ơn đưa tôi đến địa chỉ này: '], ja:['Japanese','日本語','ja-JP','ja','この住所までお願いします：'], ko:['Korean','한국어','ko-KR','ko','이 주소로 가 주세요: '],
  th:['Thai','ภาษาไทย','th-TH','th','กรุณาพาฉันไปที่อยู่นี้: '], id:['Indonesian','Bahasa Indonesia','id-ID','id','Tolong antar saya ke alamat ini: '], ms:['Malay','Bahasa Melayu','ms-MY','ms','Tolong hantar saya ke alamat ini: '],
  fr:['French','Français','fr-FR','fr','Pouvez-vous m’emmener à cette adresse, s’il vous plaît : '], de:['German','Deutsch','de-DE','de','Bitte bringen Sie mich zu dieser Adresse: '],
  es:['Spanish','Español','es-ES','es','Por favor, lléveme a esta dirección: '], it:['Italian','Italiano','it-IT','it','Mi porti a questo indirizzo, per favore: '],
  pt:['Portuguese','Português','pt-PT','pt','Por favor, leve-me a este endereço: '], nl:['Dutch','Nederlands','nl-NL','nl','Wilt u mij naar dit adres brengen? '],
  tr:['Turkish','Türkçe','tr-TR','tr','Lütfen beni bu adrese götürün: '], ru:['Russian','Русский','ru-RU','ru','Отвезите меня, пожалуйста, по этому адресу: '],
  ar:['Arabic','العربية','ar-SA','ar','من فضلك خذني إلى هذا العنوان: '], hi:['Hindi','हिन्दी','hi-IN','hi','कृपया मुझे इस पते पर ले चलिए: '], el:['Greek','Ελληνικά','el-GR','el','Παρακαλώ πηγαίνετέ με σε αυτή τη διεύθυνση: '],
  en:['English','English','en-GB','en','Please take me to this address: ']
};
const langOf = cc => { const l = COUNTRY[cc]?.[1]; return LANGS[l] ? l : 'en'; };
const curOf = cc => COUNTRY[cc]?.[0] || '';
const sosOf = cc => COUNTRY[cc]?.[2] || ['112', '112'];

/* ---------- the built-in example: your Shanghai trip ---------- */
const PRESET = {
  id:'sh2027', preset:true, name:'Shanghai, Feb 2027', homeCur:'MYR',
  airports: {
    KUL:{ code:'KUL', city:'Kuala Lumpur', name:'Kuala Lumpur Intl', cc:'MY', tz:'Asia/Kuala_Lumpur', lat:2.7456, lon:101.7072 },
    SGN:{ code:'SGN', city:'Ho Chi Minh City', name:'Tan Son Nhat Intl', cc:'VN', tz:'Asia/Ho_Chi_Minh', lat:10.8188, lon:106.6519 },
    PVG:{ code:'PVG', city:'Shanghai', name:'Pudong Intl', cc:'CN', tz:'Asia/Shanghai', lat:31.1443, lon:121.8083 },
    HAN:{ code:'HAN', city:'Hanoi', name:'Noi Bai Intl', cc:'VN', tz:'Asia/Ho_Chi_Minh', lat:21.2212, lon:105.8072 }
  },
  legs: [
    { no:'VN678', airline:'Vietnam Airlines', from:'KUL', to:'SGN', fT:'T1', tT:'T2', dep:'2027-02-17T19:50', arr:'2027-02-17T21:00', ac:'Airbus A321', svc:'Meal' },
    { no:'VN524', airline:'Vietnam Airlines', from:'SGN', to:'PVG', fT:'T2', tT:'T1', dep:'2027-02-18T09:20', arr:'2027-02-18T14:15', ac:'Airbus A350-900', svc:'Meal' },
    { no:'VN533', airline:'Vietnam Airlines', from:'PVG', to:'HAN', fT:'T1', tT:'T2', dep:'2027-02-24T15:25', arr:'2027-02-24T18:05', ac:'Airbus A321', svc:'Snacks' },
    { no:'VN681', airline:'Vietnam Airlines', from:'HAN', to:'KUL', fT:'T2', tT:'T1', dep:'2027-02-25T14:50', arr:'2027-02-25T19:10', ac:'Airbus A321', svc:'Snacks' }
  ]
};

/* ---------- the active trip ---------- */
const TRIPS = (() => { const v = store.get('trips', []); return Array.isArray(v) ? v.filter(x => x && x.id && x.legs?.length && x.airports) : []; })();
const TRIP = (() => { const id = store.get('activeTrip', PRESET.id); return id === PRESET.id ? PRESET : TRIPS.find(x => x.id === id) || PRESET; })();
const PRE = !!TRIP.preset;
// Each trip keeps its own plan, stays, notes and so on. The Shanghai trip keeps the original key names.
const tkey = k => PRE ? k : `t:${TRIP.id}:${k}`;
const tstore = { get: (k, d) => store.get(tkey(k), d), set: (k, v) => store.set(tkey(k), v) };

/* ---------- airports, flights and stops ---------- */
const CITY = Object.fromEntries(Object.values(TRIP.airports).map(a => [a.code, { code:a.code, city:a.city, airport:a.name, cc:a.cc, tz:a.tz, lat:a.lat, lon:a.lon }]));
const LEGS = TRIP.legs.map(l => ({ ...l, dep: zoned(l.dep, CITY[l.from].tz), arr: zoned(l.arr, CITY[l.to].tz) }));
Object.values(CITY).forEach(c => c.off = offHours(LEGS[0].dep, c.tz));
const HOME = CITY[LEGS[0].from], LAST = LEGS[LEGS.length - 1];
const ROUND = LAST.to === HOME.code;
const HOME_CUR = TRIP.homeCur || curOf(HOME.cc) || 'USD';
// Stops between flights: a short one is a transfer, a long one a stay. A one-way trip can end with a stay.
const STOPS = LEGS.slice(0, -1).map((l, i) => ({ code: l.to, i, t0: l.arr, t1: LEGS[i + 1].dep, kind: LEGS[i + 1].dep - l.arr < 24 * H ? 'transfer' : 'stay' }));
if (!ROUND && TRIP.end) STOPS.push({ code: LAST.to, i: LEGS.length - 1, t0: LAST.arr, t1: Math.max(LAST.arr + 3 * H, zoned(TRIP.end + 'T11:00', CITY[LAST.to].tz)), kind: 'stay', final: true });
const MAIN = STOPS.length ? STOPS.reduce((a, b) => (b.t1 - b.t0) > (a.t1 - a.t0) ? b : a) : null;
LEGS.forEach((l, i) => l.dir = !MAIN || i <= MAIN.i ? 'out' : 'ret');
const MOTION_END = STOPS.at(-1)?.final ? STOPS.at(-1).t1 : LAST.arr;
const TRIP_START = LEGS[0].dep - 3 * H, TRIP_END = MOTION_END + 90 * M;
const SEGS = [{ kind:'ground', city: HOME.code, t0: TRIP_START, t1: LEGS[0].dep, w: 5, stage:'pre' }];
LEGS.forEach((l, i) => {
  SEGS.push({ kind:'air', leg: i, t0: l.dep, t1: l.arr, w: 14 });
  STOPS.filter(s => s.i === i).forEach(s => SEGS.push({ kind:'ground', city: s.code, t0: s.t0, t1: s.t1, w: s.kind === 'transfer' ? 11 : 17, stage: s.kind, stop: s }));
});
SEGS.push({ kind:'ground', city: STOPS.at(-1)?.final ? LAST.to : LAST.to, t0: MOTION_END, t1: TRIP_END, w: 0, stage: ROUND ? 'home' : 'end' });
{ const tot = SEGS.reduce((a, s) => a + s.w, 0); let c = 0; SEGS.forEach(s => { s.c0 = c / tot; c += s.w; s.c1 = c / tot; }); SEGS[SEGS.length - 2].c1 = 1; SEGS[SEGS.length - 1].c0 = SEGS[SEGS.length - 1].c1 = 1; }

/* ---------- city keys: guide cities keep their short names (sh, han, sgn); others use the airport code ---------- */
const GUIDE_KEY = { PVG:'sh', SHA:'sh', SGN:'sgn', HAN:'han', HGH:'hz' };
const ckey = code => GUIDE_KEY[code] || code.toLowerCase();
const CKEY = Object.fromEntries(Object.keys(CITY).map(c => [c, ckey(c)]));
const KEY_CODE = Object.fromEntries(Object.keys(CITY).map(c => [ckey(c), c]));
const STOP_KEYS = [...new Set(STOPS.map(s => ckey(s.code)))];
const BASE_KEYS = [...new Set(STOPS.filter(s => s.kind === 'stay').map(s => ckey(s.code)))];

/* ---------- nights: where you sleep each night ---------- */
const segAtTime0 = t => SEGS.find(s => t >= s.t0 && t < s.t1) || (t >= MOTION_END ? SEGS.at(-1) : SEGS[0]);
const NIGHT_BASE = [];
{
  const d0 = eday(LEGS[0].dep, HOME.tz), lastTz = CITY[STOPS.at(-1)?.final ? LAST.to : LAST.to].tz, d1 = eday(MOTION_END, lastTz);
  for (let d = d0; d < d1; d++) {
    let s = segAtTime0(dayAt(d, HOME.tz, 23, 30));
    if (s.kind === 'ground') s = segAtTime0(dayAt(d, CITY[s.city].tz, 23, 30));
    if (s.kind === 'air') { NIGHT_BASE.push({ d, code: LEGS[s.leg].to, city: ckey(LEGS[s.leg].to), place: 'Overnight flight', short: LEGS[s.leg].no || 'Flight', kind: 'flight', note: 'On an overnight flight' }); continue; }
    if (s.stage === 'pre' || s.stage === 'home' || s.stage === 'end') continue;
    const c = CITY[s.city];
    NIGHT_BASE.push({ d, code: s.city, city: ckey(s.city), place: c.city, short: c.city.length > 12 ? s.city : c.city, kind: s.stage === 'transfer' ? 'transit' : 'open', note: s.stage === 'transfer' ? 'Transfer night. Airside or a room nearby.' : 'Not booked yet' });
  }
}
if (PRE) NIGHT_BASE.forEach(n => { if (n.code === 'SGN') n.short = 'HCMC'; });

/* ---------- days: free hours in each city, from arrival and departure times ---------- */
// A stop's waking window each day: 08:00–22:00 local, starting 1.5 h after landing and ending before you must
// leave for the airport (2.5 h before an international flight, 1.5 h before a domestic one).
function dayWindows(d) {
  const out = [];
  STOPS.forEach(s => {
    const tz = CITY[s.code].tz, next = LEGS[s.i + 1], intl = next && CITY[next.from].cc !== CITY[next.to].cc;
    const a = Math.max(dayAt(d, tz, 8), s.t0 + 1.5 * H), b = Math.min(dayAt(d, tz, 22), s.final ? s.t1 : s.t1 - (intl ? 2.5 : 1.5) * H);
    const hrs = Math.floor((b - a) / (15 * M)) / 4;
    if (hrs >= .5) out.push({ s, key: ckey(s.code), hrs, full: a <= dayAt(d, tz, 9) && b >= dayAt(d, tz, 21), startH: (a - dayAt(d, tz, 0)) / H, endH: (b - dayAt(d, tz, 0)) / H });
  });
  return out;
}
const TRIP_DAYS = [];
{
  const d0 = eday(LEGS[0].dep, HOME.tz), d1 = eday(MOTION_END, CITY[LAST.to].tz);
  for (let d = d0; d <= d1; d++) {
    const w = dayWindows(d), fx = LEGS.filter(l => eday(l.dep, CITY[l.from].tz) === d).map(l => [l.no || t('Flight'), `${l.from} ${hmz(l.dep, CITY[l.from].tz)} → ${l.to} ${hmz(l.arr, CITY[l.to].tz)}`]);
    const full = w.length === 1 && w[0].full;
    TRIP_DAYS.push({ d, city: w[0]?.key || null, slots: full ? null : w.map(x => [x.key, x.startH >= 15 ? 'evening' : x.endH <= 14 ? 'morning' : 'afternoon', x.hrs]), fixed: fx.length ? fx : undefined });
  }
}
function hmz(t, tz) { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(t); }

/* ---------- small helpers other modules use ---------- */
const gmtOff = off => `GMT${off >= 0 ? '+' : '−'}${Math.floor(Math.abs(off))}${Math.abs(off) % 1 ? ':' + String(Math.round(Math.abs(off) % 1 * 60)).padStart(2, '0') : ''}`;
const TRIP_LANGS = [...new Set(STOPS.map(s => langOf(CITY[s.code].cc)))].filter(l => l !== 'en' || STOPS.every(s => langOf(CITY[s.code].cc) === 'en'));
const TRIP_CURS = [...new Set(STOPS.map(s => curOf(CITY[s.code].cc)).filter(c => c && c !== HOME_CUR))];
