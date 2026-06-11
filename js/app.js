"use strict";
(() => {
  const $ = id => document.getElementById(id);
  const screens = ["intro", "create", "game", "result"];
  function show(name) {
    for (const s of screens) $("screen-" + s).classList.toggle("active", s === name);
    SCENE3D.setPhase(name);
  }

  if (SCENE3D.init()) document.body.classList.add("gl");

  // ---------- sound toggle ----------
  $("muteBtn").addEventListener("click", () => {
    $("muteBtn").textContent = SOUND.toggle() ? "🔇" : "🔊";
  });

  // ---------- challenge link ----------
  const params = new URLSearchParams(location.search);
  const challenger = (params.get("by") || "").slice(0, 30).trim();
  if (challenger) {
    $("challengerLine").textContent = `⚔️ ${challenger} challenged you!`;
  }
  const pageUrl = () => location.origin + location.pathname;

  // ---------- compass sensor ----------
  let heading = null;          // smoothed, screen-compensated, 0..360
  let sensorOk = false;
  let lastSensorTs = 0;
  let usingAbsolute = false;
  const smooth = COMPASS_MATH.makeSmoother(0.3);
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) ||
                (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function screenAngle() {
    if (screen.orientation && typeof screen.orientation.angle === "number")
      return screen.orientation.angle;
    return (typeof window.orientation === "number") ? window.orientation : 0;
  }

  function onOrientation(e) {
    SCENE3D.setTilt(e.beta, e.gamma);
    let raw = null;
    if (isIOS && typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) {
      raw = e.webkitCompassHeading; // already tilt-compensated, magnetic north
      if (typeof e.webkitCompassAccuracy === "number" &&
          (e.webkitCompassAccuracy < 0 || e.webkitCompassAccuracy > 50)) {
        setStatus("🧲 Compass needs calibration — wave your phone in a figure-8");
      }
    } else if (usingAbsolute || e.absolute === true) {
      if (e.alpha !== null && e.alpha !== undefined) {
        raw = COMPASS_MATH.headingFromEuler(e.alpha, e.beta, e.gamma);
      }
    }
    if (raw === null) return;
    heading = smooth(COMPASS_MATH.applyScreenAngle(raw, screenAngle()));
    sensorOk = true;
    lastSensorTs = Date.now();
    renderHeading();
  }

  function renderHeading() {
    if (heading === null) return;
    // Blind mode: never show the heading to the player. The value is kept
    // on <body> as a data attribute for the verdict pipeline tests only.
    document.body.dataset.heading = Math.round(heading);
    $("aimArrow").classList.add("ready");
    SCENE3D.arrowReady();
    $("compassState").textContent = "🧭 Compass locked — you're flying blind. Trust your gut!";
  }

  let compassStarted = false;
  async function startCompass() {
    if (compassStarted) return; // replays reuse the live sensor stream
    compassStarted = true;
    // iOS 13+: must request permission inside a user gesture
    if (typeof DeviceOrientationEvent !== "undefined" &&
        typeof DeviceOrientationEvent.requestPermission === "function") {
      try {
        const resp = await DeviceOrientationEvent.requestPermission();
        if (resp !== "granted") {
          setStatus("⚠️ Compass permission denied — using demo mode.");
          enableDemoMode();
          return;
        }
      } catch {
        setStatus("⚠️ Couldn't access the compass — using demo mode.");
        enableDemoMode();
        return;
      }
      window.addEventListener("deviceorientation", onOrientation, true);
    } else if ("ondeviceorientationabsolute" in window) {
      // Android Chrome: absolute orientation (true compass frame)
      usingAbsolute = true;
      window.addEventListener("deviceorientationabsolute", onOrientation, true);
    } else if (typeof DeviceOrientationEvent !== "undefined") {
      window.addEventListener("deviceorientation", onOrientation, true);
    }
    // If nothing arrives shortly, fall back to demo mode (desktop etc.)
    setTimeout(() => { if (!sensorOk) enableDemoMode(); }, 2500);
  }

  function enableDemoMode() {
    if (sensorOk) return;
    $("demoControls").style.display = "flex";
    const slider = $("demoSlider");
    const apply = () => { heading = Number(slider.value); renderHeading(); };
    slider.addEventListener("input", apply);
    apply();
  }

  function setStatus(msg) { $("statusMsg").textContent = msg; }

  // ---------- geolocation ----------
  const FALLBACK_LOC = { lat: 32.08, lng: 34.78, fallback: true }; // Tel Aviv
  let playerLoc = null;
  function getLocation() {
    return new Promise(resolve => {
      if (!navigator.geolocation) return resolve(FALLBACK_LOC);
      navigator.geolocation.getCurrentPosition(
        p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, fallback: false }),
        () => resolve(FALLBACK_LOC),
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    });
  }

  // ---------- game ----------
  const GAME_SECONDS = 30;
  const RING_C = 326.7; // 2πr of the timer ring
  let timeLeft = GAME_SECONDS, timerId = null, result = null;
  let cineSkip = null, verdictTimer = null;

  function setRing() {
    const f = Math.max(0, timeLeft) / GAME_SECONDS;
    $("ringFg").style.strokeDashoffset = (RING_C * (1 - f)).toFixed(1);
    $("ringFg").classList.toggle("low", timeLeft <= 10);
  }

  async function startGame() {
    SOUND.init();
    cineSkip = null; clearTimeout(verdictTimer);
    $("verdictStamp").style.display = "none";
    show("game");
    setStatus("📍 Finding where on Earth you are…");
    startCompass(); // must be in the same user-gesture call stack for iOS
    playerLoc = await getLocation();
    setStatus(playerLoc.fallback
      ? "⚠️ No location — assuming you're in Israel. Point at the Mediterranean!"
      : "Point the top of your phone at the Mediterranean Sea, then press the button!");
    timeLeft = GAME_SECONDS;
    $("timer").textContent = timeLeft;
    $("timer").classList.remove("low");
    setRing();
    clearInterval(timerId);
    timerId = setInterval(() => {
      timeLeft--;
      $("timer").textContent = Math.max(0, timeLeft);
      setRing();
      // the storm gathers as time runs out
      if (timeLeft <= 12) {
        const f = (12 - timeLeft) / 12;
        SCENE3D.setStorm(f);
        SOUND.storm(f);
      }
      if (timeLeft <= 10) {
        $("timer").classList.add("low");
        SOUND.tick((10 - timeLeft) / 10);
      }
      if (timeLeft <= 0) finish(null); // time's up
    }, 1000);
  }

  function finish(pointedHeading) {
    clearInterval(timerId);
    SCENE3D.setStorm(0);
    SOUND.storm(0);
    const loc = playerLoc || FALLBACK_LOC;
    const near = GEO.bearingToNearestSea(loc.lat, loc.lng);
    let success = false, detail = "";
    const timedOut = pointedHeading === null;
    if (timedOut) {
      detail = `⏰ Time's up! You never pressed the button. The sea was to the ${GEO.cardinal(near.bearing)} (${Math.round(near.bearing)}°), about ${Math.round(near.distanceKm)} km away.`;
    } else {
      success = GEO.pointsAtSea(loc.lat, loc.lng, pointedHeading);
      const pc = GEO.cardinal(pointedHeading);
      if (success) {
        detail = `You pointed ${pc} (${Math.round(pointedHeading)}°) — straight at the Mediterranean! Nearest shore ≈ ${Math.round(near.distanceKm)} km away.`;
      } else {
        detail = `You pointed ${pc} (${Math.round(pointedHeading)}°)… that's not the sea 🏜️. It was to the ${GEO.cardinal(near.bearing)} (${Math.round(near.bearing)}°), about ${Math.round(near.distanceKm)} km away.`;
      }
    }
    result = { success, detail, pointedHeading, timedOut,
               timeUsed: GAME_SECONDS - Math.max(0, timeLeft) };
    if (SCENE3D.enabled) show("cine"); // hide the HUD while the cinematic plays

    const showResultPanel = () => {
      cineSkip = null;
      clearTimeout(verdictTimer);
      $("verdictStamp").style.display = "none";
      if (navigator.vibrate) navigator.vibrate(success ? [80, 60, 80] : 300);
      $("resultEmoji").textContent = success ? "🌊🎉" : "🏜️😅";
      $("resultTitle").textContent = success ? "You found the sea!" : "Lost on dry land!";
      $("resultDetail").textContent = detail;
      drawResultCard();
      show("result");
      if (success) SCENE3D.celebrate();
    };

    const goVerdict = () => {
      SOUND[success ? "success" : "fail"]();
      const stamp = $("verdictStamp");
      stamp.className = success ? "win" : "lose";
      $("verdictText").textContent =
        timedOut ? "TIME'S UP! ⏰" : success ? "FOUND IT! 🌊" : "MISSED! 🏜️";
      stamp.style.display = "flex";
      cineSkip = showResultPanel;
      verdictTimer = setTimeout(showResultPanel, 1500);
    };

    if (!SCENE3D.enabled) { showResultPanel(); return; }
    if (timedOut) { goVerdict(); return; }
    let inFlight = true;
    const launchDone = () => { if (!inFlight) return; inFlight = false; goVerdict(); };
    SOUND.launch();
    setTimeout(() => { if (inFlight) SOUND.splash(); }, 2200);
    setTimeout(() => { if (inFlight) SCENE3D.skip(); }, 4200); // watchdog if rendering stalls
    cineSkip = () => { SCENE3D.skip(); }; // SCENE3D.launch's callback fires launchDone
    SCENE3D.launch(success, launchDone);
  }

  // tap to skip cinematics
  window.addEventListener("pointerdown", () => {
    if (!cineSkip) return;
    const f = cineSkip; cineSkip = null; f();
  });

  $("btnReady").addEventListener("click", () => {
    if (heading === null) { setStatus("⏳ Compass not ready yet — hold your phone flat."); return; }
    // Stale sensor guard (real sensors only): no data for >3s means we
    // can't trust the heading.
    if (sensorOk && Date.now() - lastSensorTs > 3000) {
      setStatus("⚠️ Compass stopped responding — move your phone a little.");
      return;
    }
    finish(heading);
  });

  // ---------- result card (canvas screenshot) ----------
  function paintCard(bg) {
    const c = $("resultCanvas"), ctx = c.getContext("2d");
    const W = c.width, H = c.height;
    if (bg) {
      const s = Math.max(W / bg.width, H / bg.height);
      ctx.drawImage(bg, (W - bg.width * s) / 2, (H - bg.height * s) / 2, bg.width * s, bg.height * s);
      ctx.fillStyle = "rgba(2,18,32,.55)"; ctx.fillRect(0, 0, W, H);
    } else {
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "#021c30"); grad.addColorStop(1, "#0a6e93");
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    }
    ctx.textAlign = "center"; ctx.fillStyle = "#eaf6fb";
    ctx.font = "bold 52px sans-serif";
    ctx.fillText("Where is the Sea? 🌊", W / 2, 110);
    ctx.font = "120px sans-serif";
    ctx.fillText(result.success ? "🌊🎉" : "🏜️😅", W / 2, 300);
    ctx.font = "bold 60px sans-serif";
    ctx.fillStyle = result.success ? "#7CFC9A" : "#ff8a80";
    ctx.fillText(result.success ? "FOUND THE SEA!" : "LOST ON LAND!", W / 2, 420);
    ctx.fillStyle = "#eaf6fb"; ctx.font = "34px sans-serif";
    wrapText(ctx, result.detail, W / 2, 510, W - 120, 48);
    if (!result.timedOut) {
      ctx.font = "30px sans-serif"; ctx.fillStyle = "#ffd966";
      ctx.fillText(`Answered in ${result.timeUsed}s of 30s`, W / 2, 760);
    }
    if (challenger) {
      ctx.font = "30px sans-serif"; ctx.fillStyle = "#ffd966";
      ctx.fillText(`Challenged by ${challenger}`, W / 2, 810);
    }
    ctx.font = "26px sans-serif"; ctx.fillStyle = "rgba(234,246,251,.6)";
    ctx.fillText("Think you can do better? Take the challenge!", W / 2, 860);
  }

  function drawResultCard() {
    paintCard(null); // always have a card ready
    const shot = SCENE3D.snapshot(); // then upgrade it with the live 3D frame
    if (!shot) return;
    const img = new Image();
    img.onload = () => paintCard(img);
    img.src = shot;
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    const words = text.split(" ");
    let line = "";
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, y); y += lineH; line = w;
      } else line = test;
    }
    if (line) ctx.fillText(line, x, y);
  }

  function shareText() {
    const verdict = result.success ? "I found the Mediterranean! 🌊🎉" : "I totally missed the sea 🏜️😅";
    const back = challenger ? ` ${challenger}, your move…` : "";
    return `Where is the Sea? — ${verdict}${back}\nTry it yourself: ${pageUrl()}`;
  }

  $("btnShare").addEventListener("click", async () => {
    const canvas = $("resultCanvas");
    try {
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      const file = new File([blob], "where-is-the-sea.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText() });
        return;
      }
    } catch (err) {
      if (err && err.name === "AbortError") return; // user closed share sheet
    }
    // Fallback: plain WhatsApp text share
    location.href = "https://wa.me/?text=" + encodeURIComponent(shareText());
  });

  // ---------- challenge creation ----------
  function challengeLink(name) {
    return pageUrl() + (name ? "?by=" + encodeURIComponent(name) : "");
  }
  $("btnChallenge").addEventListener("click", () => { SOUND.init(); show("create"); });
  $("btnBackIntro").addEventListener("click", () => show("intro"));
  $("btnSendChallenge").addEventListener("click", () => {
    const name = $("nameInput").value.trim();
    const msg = `🌊 I challenge you: find the Mediterranean Sea in 30 seconds! 🧭\n${challengeLink(name)}`;
    location.href = "https://wa.me/?text=" + encodeURIComponent(msg);
  });
  $("btnChallengeBack").addEventListener("click", () => {
    $("nameInput").value = "";
    show("create");
  });

  $("btnStart").addEventListener("click", startGame);
  $("btnRetry").addEventListener("click", startGame);
})();
