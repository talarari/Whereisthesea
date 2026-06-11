# Where is the Sea? 🌊🧭

A WhatsApp challenge game: you get **30 seconds** to point your phone at the
**Mediterranean Sea** from wherever you are. No maps, no hints — just your
sense of direction.

Play → send the result screenshot back → challenge them back.

## How it works

- Plain static site, **no build step, no CDN, no server logic** — deploys
  straight to GitHub Pages:
  - `index.html` + `css/style.css` — markup and HUD styling
  - `js/geo.js` — Mediterranean polygon, great-circle math, verdict logic
  - `js/compass.js` — tilt-compensated heading math
  - `js/scene3d.js` — the Three.js ocean scene
  - `js/sound.js` — synthesized WebAudio
  - `js/app.js` — game flow and sharing
  - `vendor/three.min.js` (r149), `assets/face.jpg`
- **Full 3D presentation**: shader-animated ocean with sailboats, seagulls,
  clouds and a bobbing buoy, time-of-day palettes (day/sunset/night —
  preview with `?tod=night`), a storm that builds as the timer runs out, a
  launch cinematic when you commit, and a stamped pass/fail verdict.
  Synthesized WebAudio sound — no audio assets.
- It reads your location (with a fallback) and your phone's compass, then
  checks whether a great-circle ray in the direction you pointed actually
  reaches the Mediterranean, using a ~120-vertex polygon of the sea
  (Adriatic and Aegean included, Black Sea and Atlantic excluded).
- Compass handling is platform-correct:
  - **iOS**: `DeviceOrientationEvent.requestPermission()` inside the tap
    gesture, then `webkitCompassHeading` (never `alpha`, which is unreliable
    on iOS).
  - **Android**: `deviceorientationabsolute` with a tilt-compensated
    rotation-matrix conversion that works held flat or upright, with screen
    rotation compensation and circular smoothing.
- Results are shared as a generated screenshot via the native share sheet
  (`navigator.share` with files), falling back to a `wa.me` text link.

## Deploy (GitHub Pages)

1. Repo → **Settings → Pages**.
2. Source: **Deploy from a branch**, branch `main` (or this branch), folder `/ (root)`.
3. Your game is live at `https://<user>.github.io/<repo>/`.

HTTPS is required for the compass and geolocation APIs — GitHub Pages
provides it out of the box.

## Challenge someone

Open the game → **Challenge a friend** → it composes a WhatsApp message with
a link like `...?by=YourName`, so the opening screen shows who dared them.

## Tests

The geo/compass logic in `js/` is loaded directly by the test harness:

```bash
node test/run-tests.mjs    # 100+ geography & compass-math assertions
node test/e2e-smoke.mjs    # Playwright: plays the game in Chromium with
                           # mocked geolocation + synthetic sensor events
```
