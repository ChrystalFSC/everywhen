# Everywhen

**Every place on your trip, at every moment of it.** Everywhen is an offline travel companion that works behind the Great Firewall. It ships as a single HTML file with no dependencies and needs no connection to run.

Everywhen was built for a real trip: Kuala Lumpur → Ho Chi Minh City → Shanghai, returning through Hanoi, on four Vietnam Airlines flights with two overnight transfers. It puts everything a traveller needs on that route into one page that still works when Google, WhatsApp and most CDNs are blocked.

## The wow feature: a map you can scrub through time

When the page opens, the route draws itself across a dot-matrix map of Southeast Asia. Drag the scrubber, or press play, and a plane flies each leg in order. As it moves:

- the local clock switches between GMT+8 and GMT+7
- the current city pulses
- the readout says where you are and what happens next, for example "VN524 leaves 09:20 from T2, in 5h 3m" or "Tonight: no hotel yet"

The scrubber bar is deliberately not to scale. The flights are stretched so a 2-hour flight stays visible next to a 6-day stay.

## What's inside

| Tab | What it does |
|---|---|
| **Trip** | Animated route map with a time scrubber, live clocks for KL, Vietnam and Shanghai, boarding-pass cards with local times and time-change notes, layover guidance with "be back by" times, and a night-by-night strip showing which nights are booked. **Your stays**: tap any night to add or edit a hotel (name, dates, local-language address, booking reference, price, free-cancellation date, notes). Stays fill the strip, the Plan tab's check-in and check-out notes and the Say tab's driver card, and are saved on the device. |
| **Plan** | A smart trip builder. Pick a pace (relaxed, balanced or packed), your interests, and day trips to **Suzhou** or **Hangzhou**. It then plans every day: day trips go on weekdays when the sights are calmer, Yu Garden is pinned to the Lantern Festival, meal time is reserved, and stops are grouped by neighbourhood and ordered morning to evening. Any Shanghai day can switch to a day trip. You can add ranked stops or your own, and reorder, move or remove anything. Days warn when they are overpacked, and suggest indoor alternatives when the live forecast says rain. The pre-trip checklist sits underneath. **Map & distances** on each day shows the stops in order on a map, from and back to your pinned hotel, with the distance and rough walk or metro/taxi time between each, and offers a shorter order when the day zig-zags (mornings stay first, evenings last). |
| **Explore** | Photo cards for Shanghai, Suzhou, Hangzhou, Hanoi and Ho Chi Minh City, **sorted best first** (★ Top pick, Worth it, If you have time), each with a one-line reason it ranks where it does. A **Skip these** tab lists tourist traps, scams and overrated spots, each with a better alternative. Every card offers Add to plan, Show to driver or order, and Reviews, which copies the Chinese name for Dianping or Trip.com. **Food cards list where to eat**: named restaurants with address, estimated spend per person in yuan or dong with a ringgit estimate (from the Money tab rates), an Open in Amap (China) or Google Maps (Vietnam) link, and Show to driver. **Souvenirs** lists what's worth bringing home from each city, ranked best first, with shops, price per item, buying tips (fakes, sizing, tea seasons) and the same map and Show buttons. A **map** above the cards pins every place, restaurant or shop with numbers that match the cards; tap a pin for details, or a card number to jump to its pin. |
| **Can I go to…?** | Type any place, in English or Chinese: a sight, town, restaurant, mall or hotel. Suggestions appear as you type. The app judges the place against this trip: **Great fit**, **Good fit**, **Possible but a long day**, **Needs a night away**, **Not a good fit**, or **We don’t recommend it**. It weighs travel time and mode (including bullet-train hubs like Suzhou, Hangzhou and Nanjing), time needed for that type of place, free hours per day, stops already planned nearby ("1.2 km from Wukang Road, already on Sun 21"), weekends, the Lantern Festival, the hotel-move day, Monday closures and the short Hanoi and Saigon stops. Hotels get a location check (distance to People’s Square, the Bund, Pudong and Hongqiao) and can fill in the driver card. It searches in three layers: the built-in guide (with aliases and typo tolerance, offline), live OpenStreetMap search (Photon while typing, Nominatim on Check, with “Did you mean” for ambiguous names), and Claude on the claude.ai version, where outside services are blocked. |
| **Weather** | Typical February weather and a packing list for every city, including Suzhou and Hangzhou, plus a live 16-day forecast from Open-Meteo drawn as low-to-high range bars. |
| **Say** | Type or speak to translate between English and Chinese or Vietnamese, in both directions. Verified phrasebook matches come first and work offline; anything else is machine-translated (MyMemory) and labelled so, with results cached for offline reuse. Every result can go full screen for a driver or be read aloud. |
| **Money** | A VND/CNY ↔ MYR converter that understands how prices are written locally: `350k`, `1.5tr`, `350.000`. It dims trailing `,000` groups so you can't misread 20,000 as 200,000, and has quick banknote buttons. |
| **Prep** | A checklist written for this route: hotel booking deadlines with live countdowns, entry rules, mobile payments, maps and data that work in China, and ride-hailing apps. |

## Design: Lilac & Butter

A light, clean theme in soft purple and pale yellow, with no dark surfaces. White cards sit on a faint lilac page. The route map is a pale lavender panel with violet (outbound) and golden (return) routes. The split-flap clock flips purple digits on butter-yellow tiles. Light lilac marks what is selected, and sunflower yellow marks what you can act on: main buttons, play and “Top pick”.

- **Living sky.** A very light wash behind the app follows the local time at whatever moment you're looking at: butter yellow at sunrise and sunset, near-white by day, soft lilac at night. A sun/moon badge on the map names the phase.
- **Split-flap departure board.** The clock and flight code in the map readout flip like an airport Solari board.
- **Glowing routes.** Sparks drift along each route, the plane leaves a contrail, and each city has a halo.
- **Boarding passes that feel like tickets.** Notched edges, a barcode generated from the flight number, and a 3D tilt with a light sheen that follows your pointer.
- **Cover art from local script.** Explore cards carry covers built from each place's own name, for example 外滩 or Phở bò, on city palettes: lantern red and gold for Shanghai, jade and lotus for Hanoi, neon dusk for Saigon.
- **Details that respond.** A floating glass dock with a sliding indicator, staggered panel entrances, animated weather scenes (rain, sun rays, drifting clouds), money results that count up, toasts, and confetti when the checklist is complete.
- **Typography.** Big Shoulders Display (condensed, signage-style) and JetBrains Mono, both SIL Open Font License, are embedded in the page as base64. They look the same offline and inside China.

Every animation is skipped when the device asks for reduced motion.

## Tech highlights

- **No third-party requests at runtime.** No hosted fonts, no map tiles, no CDN scripts. The two Latin fonts are embedded, and Chinese and Vietnamese text uses the system CJK stack (PingFang SC, Microsoft YaHei, Noto Sans CJK), so it renders the same in Shanghai as anywhere else.
- **The map is built into the file.** Natural Earth 50m land polygons ([world-atlas](https://github.com/topojson/world-atlas)) were turned into a 90 × 105 land mask at build time with point-in-polygon tests. The mask is stored as a 1.5 KB base64 bitset and drawn on Canvas 2D with device-pixel-ratio scaling, and the edges fade out with `destination-out` gradients.
- **Correct time zones.** All times are stored as UTC timestamps and displayed with `Intl.DateTimeFormat` in each airport's IANA zone. Durations, "be back by" times and night-of-stay lookups are calculated, not typed in by hand.
- **Non-linear scrubber.** It maps a weighted piecewise-linear slider onto real trip time and back again. Flights move along quadratic Bézier arcs, and the plane's heading comes from the curve's derivative.
- **Smooth, efficient motion.** A single `requestAnimationFrame` loop draws a cached bitmap of the land dots plus a few paths each frame. It stops completely when nothing is moving or the map is off screen.
- **Accessibility.** Tabs follow the ARIA tablist pattern with arrow, Home and End keys. The scrubber is a native `<input type=range>` with a descriptive `aria-valuetext`. The phrase dialog traps focus and closes with Esc. Focus rings are visible. With `prefers-reduced-motion`, the draw-in animation and pulsing are skipped. Light and dark themes both meet contrast requirements.
- **Every state is handled.** It covers missing speech voices, a disabled "Show to driver" button until an address exists, unreadable amounts, missing rates, and being offline or unable to reach the rate service. Checklist ticks, the hotel address and rates are saved in `localStorage` when it's available, and the app still works fully when it isn't.

## Install it on a phone

Everywhen is an installable web app. A service worker (`sw.js`) caches the page and its icons on the first visit, so after that it opens with no connection.

1. Push this repo to GitHub, then go to **Settings → Pages**, set **Source** to *Deploy from a branch*, and choose `main` and `/ (root)`.
2. On the phone, open `https://<your-username>.github.io/<repo>/` in Safari (iPhone) or Chrome (Android).
3. On iPhone, tap **Share → Add to Home Screen**. On Android, choose **Install app**.
4. Open it once from the home screen while online. From then on it works offline.

`scripts/build.js` versions the offline cache from a hash of the page and photos, so installed copies update automatically the next time they open online.

## Develop

```bash
node scripts/build.js
python -m http.server 8765
```

Then open http://localhost:8765. The service worker also runs on `localhost`.

| Path | What it is |
|---|---|
| `src/everywhen.html` | App markup, trip data and core logic |
| `src/guide-data.js` | Cities, ranked places and food, things to skip, where to stay |
| `src/guide.js` | Smart planner and Explore |
| `src/translate.js` | Type-or-speak translator |
| `src/evaluate.js`, `src/places-data.js` | “Can I go to…?” place checker and its offline destination list |
| `src/i18n.js`, `data/zh.tsv` | English/Chinese switching and the Chinese dictionary |
| `images/photos/`, `data/photos.json` | Card photos and their credits |
| `src/styles.css` | The visual system: tokens, glass, sky, components |
| `src/engine.js` | Experience layer: sky, split-flap board, motion, cover art, weather scenes |
| `data/fonts/` | Embedded fonts (SIL Open Font License) |
| `data/land-grid.json` | Pre-built land bitmap for the map (regenerate with `scripts/make-land-grid.js`) |
| `scripts/build.js` | Injects the map data and writes `index.html` with the web-app manifest and service worker |
| `index.html` | The built app that GitHub Pages serves |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline cache, install metadata and home-screen icons (`icons/make.py` draws them) |

Two optional network features use free endpoints that need no key. No API keys or environment variables are required.
- **Update rates** calls `https://open.er-api.com/v6/latest/MYR`.
- **Weather** calls `https://api.open-meteo.com/v1/forecast` with all six cities in one request.
- **Translate** calls `https://api.mymemory.translated.net/get` for anything not in the phrasebook. The typed text is sent to MyMemory.
- **Place search** calls `https://photon.komoot.io` for suggestions while typing and `https://nominatim.openstreetmap.org` on Check (OpenStreetMap data, ODbL). Guide coordinates are pre-fetched with `node scripts/fetch-coords.js`.
- **Maps** load tiles from `https://tile.openstreetmap.org` (© OpenStreetMap contributors). The service worker keeps tiles you have viewed, up to 2,500, so maps you have looked at once work offline; pins, routes and distances work without tiles. Leaflet 1.9.4 (BSD-2-Clause) is bundled into the page. Restaurant and shop pins come from `node scripts/fetch-coords.js`, checked by hand against each address's district; ones that matched the wrong branch are left unpinned. Stays are located with Nominatim when saved, or pinned by tapping the map in the stay form.
- **On claude.ai** the page cannot reach outside services, so place checks and translations fall back to Claude through the artifact `sample` capability, on the viewer's own Claude account and only after they allow it.

If either can't be reached, the app falls back to the last saved data, or to the built-in defaults and February averages.

## Language

Everywhen switches between **English** and **简体中文** from the button in the header, instantly and without reloading. It starts in Chinese when the phone's language is Chinese. Every screen is translated: guide descriptions, verdicts, dates (2月19日周五), durations (2小时30分), and Chinese number words for Vietnamese prices (35万越南盾). In Chinese mode, places show their Chinese names first. Translations live in `data/zh.tsv`, one line per string, and `node scripts/i18n-check.js` lists anything untranslated.

## Photos and rankings

Place and food photos are the lead images of the matching Wikipedia articles, downloaded from Wikimedia Commons only when freely licensed (CC0, CC BY, CC BY-SA or public domain). Each card credits the author and licence and links to the file page. Refresh them with `node scripts/fetch-photos.js` and then `python scripts/shrink-photos.py`. For places whose article has no usable lead image, `node scripts/search-photos.js search` finds freely licensed candidates on Commons for review, and `node scripts/search-photos.js pick <id> <n>` approves one.

Rankings are editorial, based on how widely travellers regard each place. They are not live star ratings, and the app never shows invented scores. For live reviews, use the Reviews button to search the Chinese name on Dianping or Trip.com.

## Notes

- Entry rules, visa-free arrangements and app availability change over time. The checklist says so, and you should confirm with official sources before flying.
- The flights and hotel in the demo are one real itinerary. To reuse Everywhen for another trip, change `LEGS`, `NIGHTS` and `CITY` at the top of the script.
