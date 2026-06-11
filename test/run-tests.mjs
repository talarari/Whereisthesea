// Verification harness for the game logic.
// js/geo.js and js/compass.js are classic scripts with a CommonJS export
// shim, so they can be loaded directly.
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const require = createRequire(import.meta.url);
const GEO = require(join(root, "js/geo.js"));
const { COMPASS_MATH } = require(join(root, "js/compass.js"));

let pass = 0, fail = 0;
function check(name, cond, extra = "") {
  if (cond) { pass++; console.log(`  ✓ ${name}`); }
  else { fail++; console.error(`  ✗ ${name} ${extra}`); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log("— point-in-polygon: places that ARE the Mediterranean —");
check("open sea south of Italy (35.0, 18.0)", GEO.inMediterranean(35.0, 18.0));
check("sea off Tel Aviv (32.05, 34.3)", GEO.inMediterranean(32.05, 34.3));
check("Tyrrhenian Sea (40.0, 12.0)", GEO.inMediterranean(40.0, 12.0));
check("Adriatic Sea (43.0, 15.0)", GEO.inMediterranean(43.0, 15.0));
check("Aegean Sea (38.5, 25.0)", GEO.inMediterranean(38.5, 25.0));
check("sea south of Cyprus (33.5, 33.0)", GEO.inMediterranean(33.5, 33.0));
check("Balearic Sea (39.5, 2.0)", GEO.inMediterranean(39.5, 2.0));
check("Gulf of Lion (42.5, 4.5)", GEO.inMediterranean(42.5, 4.5));
check("Ionian Sea (37.5, 19.0)", GEO.inMediterranean(37.5, 19.0));
check("Alboran Sea (36.0, -3.0)", GEO.inMediterranean(36.0, -3.0));
check("Gulf of Sidra (32.5, 18.0)", GEO.inMediterranean(32.5, 18.0));

console.log("— point-in-polygon: places that are NOT the Mediterranean —");
check("Jerusalem (31.78, 35.22)", !GEO.inMediterranean(31.78, 35.22));
check("Cairo (30.05, 31.25)", !GEO.inMediterranean(30.05, 31.25));
check("central Italy / Apennines (42.5, 13.0)", !GEO.inMediterranean(42.5, 13.0));
check("Madrid (40.4, -3.7)", !GEO.inMediterranean(40.4, -3.7));
check("Black Sea (43.0, 34.0)", !GEO.inMediterranean(43.0, 34.0));
check("Sea of Marmara (40.7, 28.0)", !GEO.inMediterranean(40.7, 28.0));
check("Ankara / central Anatolia (39.9, 32.8)", !GEO.inMediterranean(39.9, 32.8));
check("Atlantic west of Gibraltar (36.0, -7.0)", !GEO.inMediterranean(36.0, -7.0));
check("Bay of Biscay (45.0, -4.0)", !GEO.inMediterranean(45.0, -4.0));
check("mainland Greece interior (39.5, 21.8)", !GEO.inMediterranean(39.5, 21.8));
check("Red Sea (27.0, 34.5)", !GEO.inMediterranean(27.0, 34.5));
check("Amman (31.95, 35.93)", !GEO.inMediterranean(31.95, 35.93));
check("Paris (48.85, 2.35)", !GEO.inMediterranean(48.85, 2.35));
check("Sahara south of Libya (25.0, 15.0)", !GEO.inMediterranean(25.0, 15.0));

console.log("— great-circle math sanity —");
{
  const b = GEO.bearingTo(32.08, 34.78, 32.08, 30.0); // Tel Aviv -> due west point
  check(`bearing Tel Aviv -> west point ≈ 270 (got ${b.toFixed(1)})`, near(b, 270, 3));
  const b2 = GEO.bearingTo(32.0, 34.0, 35.0, 34.0); // due north
  check(`bearing due north = 0 (got ${b2.toFixed(1)})`, near(b2, 0, 0.01) || near(b2, 360, 0.01));
  const [la, lo] = GEO.destination(32.0, 34.0, 0, 111.2); // ~1° north
  check(`destination 111km north ≈ +1° lat (got ${la.toFixed(2)})`, near(la, 33.0, 0.05) && near(lo, 34.0, 0.05));
  const d = GEO.haversineKm(32.08, 34.78, 31.78, 35.22); // TLV->JLM ≈ 54km
  check(`haversine TLV->Jerusalem ≈ 54km (got ${d.toFixed(1)})`, near(d, 54, 6));
}

console.log("— verdicts: rayHitsSea (exact heading, no tolerance) —");
const cases = [
  // [name, lat, lng, heading, expected]
  ["Jerusalem pointing W → sea", 31.78, 35.22, 270, true],
  ["Jerusalem pointing NW → sea", 31.78, 35.22, 315, true],
  ["Jerusalem pointing E → desert", 31.78, 35.22, 90, false],
  ["Jerusalem pointing S → desert", 31.78, 35.22, 180, false],
  ["Tel Aviv pointing W → sea", 32.08, 34.80, 270, true],
  ["Tel Aviv pointing E → land", 32.08, 34.80, 90, false],
  ["Haifa pointing N → sea (coast curves)", 32.79, 34.99, 350, true],
  ["Cairo pointing N → Nile delta coast", 30.05, 31.25, 0, true],
  ["Cairo pointing S → Sahara", 30.05, 31.25, 180, false],
  ["Amman pointing W → crosses Israel to sea", 31.95, 35.93, 270, true],
  ["Amman pointing E → Arabian desert", 31.95, 35.93, 90, false],
  ["Madrid pointing ESE → Valencia coast", 40.4, -3.7, 110, true],
  ["Madrid pointing N → Bay of Biscay (not Med)", 40.4, -3.7, 0, false],
  ["Rome pointing W → Tyrrhenian", 41.9, 12.5, 260, true],
  ["Rome pointing ENE → Adriatic", 41.9, 12.5, 70, true],
  ["Paris pointing S → Gulf of Lion", 48.85, 2.35, 180, true],
  ["Paris pointing N → English Channel (not Med)", 48.85, 2.35, 0, false],
  ["Ankara pointing N → Black Sea (not Med!)", 39.93, 32.85, 0, false],
  ["Ankara pointing S → Med coast", 39.93, 32.85, 185, true],
  ["Athens pointing SW → Saronic gulf", 37.98, 23.73, 225, true],
  ["Beirut pointing W → sea", 33.89, 35.50, 270, true],
  ["Beirut pointing E → Syria/desert", 33.89, 35.50, 90, false],
  ["On a boat S of Cyprus, any heading", 33.5, 33.0, 123, true],
  ["Munich pointing S → Adriatic", 48.14, 11.58, 175, true],
  ["Tunis pointing N → sea", 36.8, 10.18, 10, true],
];
for (const [name, la, lo, h, exp] of cases) {
  check(name, GEO.rayHitsSea(la, lo, h) === exp);
}

console.log("— verdicts: pointsAtSea (game rule, ±tolerance) —");
check("Tel Aviv 270° → success", GEO.pointsAtSea(32.08, 34.80, 270) === true);
check("Tel Aviv 90° → fail", GEO.pointsAtSea(32.08, 34.80, 90) === false);
check("Jerusalem 250° (W-ish, within tolerance) → success", GEO.pointsAtSea(31.78, 35.22, 250) === true);
check("Jerusalem 135° (SE) → fail", GEO.pointsAtSea(31.78, 35.22, 135) === false);
check("Beer Sheva 315° (NW) → success", GEO.pointsAtSea(31.25, 34.79, 315) === true);
check("Beer Sheva 90° (E) → fail", GEO.pointsAtSea(31.25, 34.79, 90) === false);

console.log("— bearingToNearestSea sanity —");
{
  const r = GEO.bearingToNearestSea(31.78, 35.22); // Jerusalem
  check(`Jerusalem nearest-sea bearing is westish (got ${r.bearing.toFixed(0)}°)`,
        r.bearing > 250 && r.bearing < 330);
  check(`Jerusalem nearest-sea distance ~50-70km (got ${r.distanceKm.toFixed(0)})`,
        r.distanceKm > 35 && r.distanceKm < 80);
  const c = GEO.bearingToNearestSea(30.05, 31.25); // Cairo
  check(`Cairo nearest-sea bearing is northish (got ${c.bearing.toFixed(0)}°)`,
        c.bearing < 45 || c.bearing > 315);
}

console.log("— strict pass/fail: no success when meaningfully off target —");
{
  // find headings that miss every sea direction by 12-19 degrees — under
  // the old ±20° tolerance these were "successes"; they must fail now
  let tested = 0;
  for (let h = 0; h < 360; h += 1) {
    const off = GEO.degreesOffSea(31.78, 35.22, h); // Jerusalem
    if (off >= 12 && off <= 19) {
      tested++;
      check(`Jerusalem heading ${h}° (${off}° off) → fail`, !GEO.pointsAtSea(31.78, 35.22, h));
      if (tested >= 2) break;
    }
  }
  check("found borderline headings to test", tested >= 1);
  check("small sensor slack still passes (8° off)", (() => {
    for (let h = 0; h < 360; h += 1) {
      const off = GEO.degreesOffSea(31.78, 35.22, h);
      if (off > 0 && off <= 8) return GEO.pointsAtSea(31.78, 35.22, h);
    }
    return true; // no such heading exists at this location — vacuously fine
  })());
}

console.log("— degreesOffSea (the 'you were N° off' reveal) —");
{
  const off = GEO.degreesOffSea;
  check(`Tel Aviv pointing W → 0° off (got ${off(32.08, 34.80, 270)})`, off(32.08, 34.80, 270) === 0);
  check(`Tel Aviv pointing E → way off (got ${off(32.08, 34.80, 90)})`, off(32.08, 34.80, 90) >= 55);
  check(`Jerusalem pointing 250 → small (got ${off(31.78, 35.22, 250)})`, off(31.78, 35.22, 250) <= 25);
  check(`on a boat → 0° off any direction (got ${off(33.5, 33.0, 123)})`, off(33.5, 33.0, 123) === 0);
  const a = off(31.78, 35.22, 290), b = off(31.78, 35.22, 200), c = off(31.78, 35.22, 110);
  check(`monotonic as you turn away from the sea (${a} <= ${b} <= ${c})`, a <= b && b <= c);
}

console.log("— cardinal names —");
check("0 → N", GEO.cardinal(0) === "N");
check("270 → W", GEO.cardinal(270) === "W");
check("359 → N", GEO.cardinal(359) === "N");
check("225 → SW", GEO.cardinal(225) === "SW");

console.log("— compass math: headingFromEuler —");
{
  const H = COMPASS_MATH.headingFromEuler;
  // Device flat, screen up. In the device orientation spec, alpha is the
  // rotation around the screen normal, counterclockwise; compass heading
  // of the device top = 360 - alpha.
  check(`flat, alpha=0 → 0/360 (got ${H(0,0,0).toFixed(1)})`, near(H(0,0,0) % 360, 0, 0.5));
  check(`flat, alpha=90 → 270 (got ${H(90,0,0).toFixed(1)})`, near(H(90,0,0), 270, 0.5));
  check(`flat, alpha=180 → 180 (got ${H(180,0,0).toFixed(1)})`, near(H(180,0,0), 180, 0.5));
  check(`flat, alpha=270 → 90 (got ${H(270,0,0).toFixed(1)})`, near(H(270,0,0), 90, 0.5));
  // Tilt the phone up toward vertical: heading must not change when only
  // pitch changes (tilt compensation), including fully upright (beta=90,
  // "camera-style" hold) where naive top-edge formulas blow up.
  for (const alpha of [0, 45, 137, 290]) {
    const flat = H(alpha, 0, 0);
    for (const beta of [20, 45, 70, 90]) {
      const tilted = H(alpha, beta, 0);
      check(`tilt-invariance alpha=${alpha} beta=${beta}: ${flat.toFixed(1)} vs ${tilted.toFixed(1)}`,
            near(((flat - tilted + 540) % 360) - 180, 0, 1));
    }
  }
  // Roll (gamma) must not corrupt the heading in a flat compass hold
  for (const g of [-15, -4, 8, 20]) {
    const h = H(0, 5, g), err = Math.abs(((h + 180) % 360) - 180);
    check(`flat hold immune to roll gamma=${g} (heading ${h.toFixed(1)})`, err < 2.5);
  }
  {
    const h = H(90, 10, -15); // pointing west, slightly tilted and rolled
    check(`west + roll stays ≈270 (got ${h.toFixed(1)})`, near(h, 270, 3));
  }
  // Slight downward pitch (beta<0) keeps the top-edge heading
  check(`beta=-20 keeps heading (got ${H(45,-20,0).toFixed(1)})`, near(H(45,-20,0), 315, 1));
  // Output range
  for (const [a,b,g] of [[0,0,0],[359,80,-30],[123,-45,60],[200,10,10]]) {
    const h = H(a,b,g);
    check(`range 0..360 for (${a},${b},${g}) (got ${h.toFixed(1)})`, h >= 0 && h < 360);
  }
}

console.log("— compass math: screen angle + smoothing —");
{
  const A = COMPASS_MATH.applyScreenAngle;
  check("heading 350 + angle 90 = 80", A(350, 90) === 80);
  check("heading 10 + angle 0 = 10", A(10, 0) === 10);
  check("heading 10 + angle -90 = 280", A(10, -90) === 280);
  const s = COMPASS_MATH.makeSmoother(0.5);
  s(358); s(2); s(358); const v = s(2);
  check(`smoother stays near 0 across wraparound (got ${v.toFixed(1)})`, v < 5 || v > 355);
  const s2 = COMPASS_MATH.makeSmoother(0.25);
  let out; for (let i = 0; i < 50; i++) out = s2(123);
  check(`smoother converges to input (got ${out.toFixed(1)})`, near(out, 123, 0.5));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
