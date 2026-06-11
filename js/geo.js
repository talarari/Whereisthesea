
"use strict";
const GEO = (() => {
  const R = 6371; // km, Earth radius
  const rad = d => d * Math.PI / 180;
  const deg = r => r * 180 / Math.PI;

  // Mediterranean Sea polygon [lat, lng], traced: Gibraltar -> European
  // north shore (around Italy, around Greece incl. Adriatic + Aegean) ->
  // Turkish coast -> Levant -> North African coast -> back to Gibraltar.
  // Black Sea is excluded (boundary closes at the Dardanelles).
  // Major islands are treated as sea (acceptable for this game).
  const MED = [
    [36.00, -5.40],  // Gibraltar (Europe side)
    [36.55, -4.62],  // Marbella
    [36.72, -3.50],  // Motril
    [36.83, -2.40],  // Almeria
    [37.58, -0.90],  // Cartagena
    [38.55, -0.05],  // Alicante/Benidorm
    [39.45, -0.25],  // Valencia
    [40.45,  0.45],  // Ebro delta
    [41.30,  2.20],  // Barcelona
    [42.40,  3.15],  // Cap de Creus
    [43.25,  3.40],  // Sète
    [43.30,  5.35],  // Marseille
    [43.55,  7.05],  // Cannes
    [43.95,  8.15],  // Imperia
    [44.38,  8.90],  // Genoa
    [43.95,  10.20], // Viareggio
    [42.75,  10.95], // Tuscan coast
    [41.70,  12.30], // Rome coast (Ostia)
    [40.85,  14.15], // Naples
    [40.05,  15.40], // Cilento
    [38.95,  16.05], // Calabria west
    [38.20,  15.65], // Reggio Calabria (Strait of Messina)
    [37.95,  16.10], // toe of Italy (Ionian side)
    [38.90,  16.60], // Catanzaro gulf
    [39.05,  17.15], // Crotone
    [40.35,  17.20], // Taranto
    [39.80,  18.38], // Santa Maria di Leuca (heel)
    [40.65,  17.95], // Brindisi
    [41.13,  16.85], // Bari
    [41.92,  16.18], // Gargano
    [42.55,  14.10], // Pescara
    [43.62,  13.50], // Ancona
    [44.95,  12.55], // Po delta
    [45.43,  12.45], // Venice
    [45.70,  13.60], // Trieste
    [45.10,  13.65], // Istria (Rovinj)
    [44.05,  15.15], // Zadar
    [43.50,  16.40], // Split
    [42.64,  18.10], // Dubrovnik
    [42.05,  19.10], // Bar (Montenegro)
    [41.30,  19.40], // Durrës
    [40.15,  19.65], // Vlorë
    [39.65,  19.90], // Corfu
    [38.95,  20.75], // Preveza
    [38.30,  21.40], // Gulf of Patras mouth
    [37.65,  21.30], // Pyrgos coast
    [36.80,  21.70], // SW Peloponnese
    [36.40,  22.48], // Cape Tainaron
    [36.43,  23.20], // Cape Maleas
    [37.40,  23.20], // Hydra area
    [37.90,  23.55], // Athens (Piraeus)
    [38.85,  23.65], // Euboea inner coast
    [39.05,  22.70], // Gulf of Pagasae
    [39.95,  22.65], // Mt Olympus coast
    [40.50,  22.90], // Thessaloniki
    [40.30,  23.70], // Chalkidiki
    [40.75,  24.70], // Kavala
    [40.85,  25.85], // Alexandroupoli
    [40.45,  26.20], // Gallipoli peninsula
    [40.05,  26.20], // Dardanelles mouth (Black Sea excluded)
    [39.45,  26.10], // Edremit gulf
    [38.65,  26.75], // Çeşme/Izmir
    [37.95,  27.25], // Kuşadası
    [37.35,  27.20], // Bodrum
    [36.85,  28.25], // Marmaris
    [36.55,  29.10], // Fethiye
    [36.25,  29.95], // Kaş/Finike
    [36.85,  30.75], // Antalya
    [36.10,  32.30], // Alanya/Anamur
    [36.30,  33.50], // Silifke
    [36.75,  34.60], // Mersin
    [36.55,  35.55], // Adana coast (Yumurtalık)
    [36.60,  36.20], // Iskenderun
    [35.90,  35.90], // Syrian coast (north)
    [35.50,  35.75], // Latakia
    [34.85,  35.90], // Tartus
    [34.45,  35.83], // Tripoli (Lebanon)
    [33.90,  35.48], // Beirut
    [33.27,  35.20], // Tyre
    [32.92,  35.07], // Acre/Haifa bay
    [32.83,  34.96], // Haifa (Carmel head)
    [32.48,  34.88], // Netanya
    [32.08,  34.76], // Tel Aviv
    [31.67,  34.55], // Ashkelon
    [31.32,  34.22], // Gaza/Rafah
    [31.05,  33.10], // North Sinai coast
    [31.28,  32.30], // Port Said
    [31.50,  31.84], // Damietta (Nile delta tip)
    [31.45,  30.36], // Rosetta
    [31.20,  29.88], // Alexandria
    [30.85,  29.00], // El Alamein coast
    [31.35,  27.20], // Marsa Matruh
    [31.60,  25.15], // Sallum
    [32.08,  23.95], // Tobruk
    [32.92,  21.70], // Derna/Jebel Akhdar coast
    [32.75,  20.95], // Apollonia
    [32.10,  20.05], // Benghazi
    [30.75,  18.50], // Gulf of Sidra (south)
    [31.20,  16.60], // Sirte west
    [32.38,  15.10], // Misrata
    [32.90,  13.18], // Tripoli (Libya)
    [32.95,  12.10], // Zuwara
    [33.50,  11.05], // Djerba
    [33.90,  10.10], // Gabès
    [34.73,  10.77], // Sfax
    [35.78,  10.83], // Monastir
    [36.40,  10.55], // Cap Bon (inner)
    [37.08,  11.05], // Cap Bon tip
    [37.28,  10.25], // Tunis bay
    [37.35,   9.85], // Bizerte
    [37.10,   8.60], // Tabarka
    [36.95,   7.77], // Annaba
    [37.08,   6.55], // Skikda
    [36.82,   5.05], // Béjaïa
    [36.80,   3.05], // Algiers
    [36.52,   1.95], // Cherchell
    [36.13,   0.30], // Mostaganem
    [35.72,  -0.65], // Oran
    [35.32,  -2.95], // Melilla
    [35.25,  -3.95], // Al Hoceima
    [35.78,  -5.30], // Ceuta (Africa side of strait)
  ];

  // Ray-cast point-in-polygon on [lat,lng] pairs (planar approx is fine
  // at Mediterranean latitudes for a coarse polygon).
  function inMediterranean(lat, lng) {
    let inside = false;
    for (let i = 0, j = MED.length - 1; i < MED.length; j = i++) {
      const [yi, xi] = MED[i], [yj, xj] = MED[j];
      if ((yi > lat) !== (yj > lat) &&
          lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  }

  // Great-circle destination point: from (lat,lng), initial bearing (deg),
  // distance in km.
  function destination(lat, lng, bearing, distKm) {
    const f1 = rad(lat), l1 = rad(lng), brng = rad(bearing), dR = distKm / R;
    const f2 = Math.asin(Math.sin(f1) * Math.cos(dR) +
                         Math.cos(f1) * Math.sin(dR) * Math.cos(brng));
    const l2 = l1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(f1),
                               Math.cos(dR) - Math.sin(f1) * Math.sin(f2));
    return [deg(f2), ((deg(l2) + 540) % 360) - 180];
  }

  // Initial great-circle bearing from point 1 to point 2, degrees 0..360.
  function bearingTo(lat1, lng1, lat2, lng2) {
    const f1 = rad(lat1), f2 = rad(lat2), dl = rad(lng2 - lng1);
    const y = Math.sin(dl) * Math.cos(f2);
    const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
    return (deg(Math.atan2(y, x)) + 360) % 360;
  }

  function haversineKm(lat1, lng1, lat2, lng2) {
    const f1 = rad(lat1), f2 = rad(lat2);
    const dF = rad(lat2 - lat1), dL = rad(lng2 - lng1);
    const a = Math.sin(dF / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dL / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  const MAX_RANGE_KM = 3500, STEP_KM = 12;

  // Does a great-circle ray from (lat,lng) at `heading` reach the
  // Mediterranean within MAX_RANGE_KM?
  function rayHitsSea(lat, lng, heading) {
    if (inMediterranean(lat, lng)) return true; // standing in/on the sea
    for (let d = STEP_KM; d <= MAX_RANGE_KM; d += STEP_KM) {
      const [la, lo] = destination(lat, lng, heading, d);
      if (inMediterranean(la, lo)) return true;
    }
    return false;
  }

  const TOLERANCE_DEG = 25; // allowed error vs the nearest-coast bearing

  function angDist(a, b) {
    const d = Math.abs(((a - b) % 360 + 360) % 360);
    return d > 180 ? 360 - d : d;
  }

  // Game verdict: the player must point at the NEAREST stretch of coast.
  // A ray that merely grazes the sea far away (e.g. pointing up the
  // Israeli coastline toward Cyprus) does not count — from Israel this
  // means success requires pointing essentially west.
  function pointsAtSea(lat, lng, heading) {
    if (inMediterranean(lat, lng)) return true; // standing in/on the sea
    return angDist(heading, bearingToNearestSea(lat, lng).bearing) <= TOLERANCE_DEG;
  }

  // Bearing and distance to the closest point on the Mediterranean
  // coastline (nearest point on polygon edges, local planar approximation
  // with longitude scaled by cos(lat)). This is the true "the sea is that
  // way" direction, accurate even right next to the beach.
  function bearingToNearestSea(lat, lng) {
    const cos0 = Math.cos(rad(lat)) || 1e-9;
    let bestD2 = Infinity, bLat = 0, bLng = 0;
    for (let i = 0, j = MED.length - 1; i < MED.length; j = i++) {
      const ax = (MED[j][1] - lng) * cos0, ay = MED[j][0] - lat;
      const bx = (MED[i][1] - lng) * cos0, by = MED[i][0] - lat;
      const dx = bx - ax, dy = by - ay;
      const L2 = dx * dx + dy * dy;
      let t = L2 ? -(ax * dx + ay * dy) / L2 : 0;
      t = Math.max(0, Math.min(1, t));
      const qx = ax + dx * t, qy = ay + dy * t;
      const d2 = qx * qx + qy * qy;
      if (d2 < bestD2) { bestD2 = d2; bLat = lat + qy; bLng = lng + qx / cos0; }
    }
    return { bearing: bearingTo(lat, lng, bLat, bLng),
             distanceKm: haversineKm(lat, lng, bLat, bLng) };
  }

  function cardinal(b) {
    const names = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
    return names[Math.round(((b % 360) + 360) % 360 / 22.5) % 16];
  }


  // Angular error (degrees) vs the nearest-coast bearing — 0 when
  // standing in the sea. Matches the strict verdict.
  function degreesOffSea(lat, lng, heading) {
    if (inMediterranean(lat, lng)) return 0;
    return Math.round(angDist(heading, bearingToNearestSea(lat, lng).bearing));
  }

  return { MED, inMediterranean, destination, bearingTo, haversineKm,
           rayHitsSea, pointsAtSea, bearingToNearestSea, cardinal,
           degreesOffSea, TOLERANCE_DEG };
})();
if (typeof module !== "undefined") module.exports = GEO;
