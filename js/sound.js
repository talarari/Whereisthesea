"use strict";
const SOUND = (() => {
  let ctx = null, master = null, ambGain = null, ambFilter = null;
  let muted = false, started = false;

  function init() {
    if (started) return; started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = .9;
      master.connect(ctx.destination);
      // ocean ambience: looped noise -> lowpass, with a slow swell LFO
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      ambFilter = ctx.createBiquadFilter();
      ambFilter.type = "lowpass"; ambFilter.frequency.value = 420; ambFilter.Q.value = .4;
      ambGain = ctx.createGain(); ambGain.gain.value = .14;
      const lfo = ctx.createOscillator(); lfo.frequency.value = .09;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = .055;
      lfo.connect(lfoGain); lfoGain.connect(ambGain.gain);
      src.connect(ambFilter); ambFilter.connect(ambGain); ambGain.connect(master);
      src.start(); lfo.start();
      if (ctx.state === "suspended") ctx.resume();
    } catch { ctx = null; }
  }

  function env(node, t0, peak, attack, decay) {
    node.gain.setValueAtTime(0, t0);
    node.gain.linearRampToValueAtTime(peak, t0 + attack);
    node.gain.exponentialRampToValueAtTime(.0001, t0 + attack + decay);
  }

  function blip(freq, dur, type, peak, when = 0, glideTo = null) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    env(g, t0, peak, .012, dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + .1);
  }

  function noiseBurst(dur, peak, fromHz, toHz, type = "lowpass", when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const len = Math.ceil(ctx.sampleRate * (dur + .1));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = 1.1;
    f.frequency.setValueAtTime(fromHz, t0);
    f.frequency.exponentialRampToValueAtTime(toHz, t0 + dur);
    const g = ctx.createGain(); env(g, t0, peak, .02, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0); src.stop(t0 + dur + .1);
  }

  return {
    init,
    storm(level) { // 0..1 — ambience swells and hisses as it builds
      if (!ctx) return;
      const t = ctx.currentTime;
      ambFilter.frequency.setTargetAtTime(420 + level * 1100, t, .4);
      ambGain.gain.setTargetAtTime(.14 + level * .22, t, .4);
    },
    tick(urgency) { blip(620 + urgency * 600, .05, "square", .10 + urgency * .08); },
    launch() {
      noiseBurst(.55, .30, 320, 2600, "bandpass");
      blip(180, .5, "sawtooth", .12, 0, 700);
    },
    splash() { noiseBurst(.7, .34, 2800, 160); },
    success() {
      [523, 659, 784, 1046].forEach((f, i) => blip(f, .34, "triangle", .22, .12 * i));
      noiseBurst(.6, .2, 2400, 200, "lowpass", .1);
    },
    fail() {
      blip(380, .4, "sawtooth", .16, 0, 240);
      blip(290, .55, "sawtooth", .16, .3, 150);
      noiseBurst(.35, .18, 900, 120, "lowpass", .55);
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : .9;
      return muted;
    },
    get muted() { return muted; }
  };
})();
