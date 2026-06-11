"use strict";
const SCENE3D = (() => {
  let on = false, renderer, scene, camera, clock;
  let water, skyU, waterU, arrow, arrowMat, glow, stars;
  let burst = null, burstData = null, splashRing = null, splashT0 = 0;
  let phase = "intro", tiltX = 25, tiltY = 0, isReady = false;
  const PITCH = .45; // nose-up tilt shows the chevron's face to the camera
  let storm = 0, stormTarget = 0, shake = 0;
  let cine = null;            // launch cinematic state {t0, success, cb, splashed}
  const boats = [], gulls = [], clouds = [];
  let buoy = null, kayaker = null, kPaddle = null, kHead = null;
  const FACE_SRC = "assets/face.jpg";

  // time-of-day palettes (?tod=day|sunset|night to preview)
  const PAL = {
    day:    { top: [.015,.17,.36], hor: [.56,.79,.91], sun: [1,.92,.66],
              deep: [.012,.20,.33], shal: [.05,.48,.60], dir: [.25,.2,-1], stars: 0, cloud: .42 },
    sunset: { top: [.06,.09,.28],  hor: [.98,.60,.34], sun: [1,.58,.28],
              deep: [.03,.11,.26], shal: [.28,.22,.32], dir: [.5,.07,-1], stars: .3, cloud: .3 },
    night:  { top: [.004,.015,.06], hor: [.05,.10,.22], sun: [.8,.88,1],
              deep: [.004,.03,.09], shal: [.02,.09,.18], dir: [-.3,.45,-1], stars: 1, cloud: .12 },
  };
  function pickPalette() {
    const q = new URLSearchParams(location.search).get("tod");
    if (PAL[q]) return PAL[q];
    const h = new Date().getHours();
    if (h >= 20 || h < 6) return PAL.night;
    if (h < 8 || h >= 17) return PAL.sunset;
    return PAL.day;
  }
  const v3 = a => new THREE.Vector3(a[0], a[1], a[2]);
  const c3 = a => new THREE.Color(a[0], a[1], a[2]);

  function makeSprite(inner = "255,255,255") {
    const c = document.createElement("canvas"); c.width = c.height = 64;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(32, 32, 2, 32, 32, 30);
    g.addColorStop(0, `rgba(${inner},1)`);
    g.addColorStop(.5, `rgba(${inner},.55)`);
    g.addColorStop(1, `rgba(${inner},0)`);
    x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  // shared wave field — vertex displaces, fragment re-derives normals
  const WAVES = `
    float wv(vec2 p, vec2 d, float f, float s, float a){ return sin(dot(p,d)*f + uTime*s)*a; }
    float height(vec2 p){
      float amp = 1. + uStorm * 1.15;
      return (wv(p, vec2(1.,.3), .28, 1.2, .45) + wv(p, vec2(-.7,.7), .42, 1.6, .30)
            + wv(p, vec2(.2,-1.), .80, 2.2, .14) + wv(p, vec2(-.4,-.6), 1.7, 2.8, .07)) * amp;
    }`;

  function init() {
    if (typeof THREE === "undefined") return false;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance",
                                           preserveDrawingBuffer: true });
      renderer.getContext();
    } catch { return false; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.id = "gl";
    document.body.prepend(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, .1, 2000);
    clock = new THREE.Clock();
    const pal = pickPalette();
    const sunDir = v3(pal.dir).normalize();
    scene.fog = new THREE.Fog(c3(pal.hor), 70, 330);

    // --- sky dome ---
    skyU = {
      uSunDir: { value: sunDir }, uStorm: { value: 0 },
      uTop: { value: c3(pal.top) }, uHor: { value: c3(pal.hor) }, uSunCol: { value: c3(pal.sun) }
    };
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(900, 24, 12),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, uniforms: skyU,
        vertexShader: `varying vec3 vDir;
          void main(){ vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
        fragmentShader: `varying vec3 vDir;
          uniform vec3 uSunDir, uTop, uHor, uSunCol; uniform float uStorm;
          void main(){
            float h = clamp(vDir.y, 0., 1.);
            vec3 top = mix(uTop, vec3(.09,.11,.15), uStorm * .75);
            vec3 hor = mix(uHor, vec3(.30,.34,.40), uStorm * .75);
            vec3 col = mix(hor, top, pow(h, .55));
            float d = max(dot(normalize(vDir), uSunDir), 0.);
            col += uSunCol * pow(d, 700.) * 2.2 * (1. - uStorm * .85);
            col += uSunCol * pow(d, 7.) * .5 * (1. - uStorm * .6);
            gl_FragColor = vec4(col, 1.);
          }`
      })));

    // --- stars (night palette) ---
    if (pal.stars > 0) {
      const N = 700, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI * .48 + .04;
        pos.set([Math.cos(a) * Math.cos(e) * 850, Math.sin(e) * 850, Math.sin(a) * Math.cos(e) * 850], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      stars = new THREE.Points(g, new THREE.PointsMaterial({
        color: 0xdde9ff, size: 2.2, sizeAttenuation: false,
        transparent: true, opacity: .85 * pal.stars, depthWrite: false }));
      scene.add(stars);
    }

    // --- ocean ---
    waterU = {
      uTime: { value: 0 }, uStorm: { value: 0 }, uSunDir: { value: sunDir },
      uSunCol: { value: c3(pal.sun) }, uCam: { value: new THREE.Vector3() },
      uDeep: { value: c3(pal.deep) }, uShal: { value: c3(pal.shal) }, uHor: { value: c3(pal.hor) }
    };
    water = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 700, 140, 140),
      new THREE.ShaderMaterial({
        uniforms: waterU,
        vertexShader: `uniform float uTime, uStorm; varying vec2 vP; varying vec3 vWorld; varying float vH;
          ${WAVES}
          void main(){
            vec3 pos = position;
            vH = height(pos.xy); pos.z += vH; vP = position.xy;
            vec4 w = modelMatrix * vec4(pos, 1.); vWorld = w.xyz;
            gl_Position = projectionMatrix * viewMatrix * w;
          }`,
        fragmentShader: `uniform float uTime, uStorm; uniform vec3 uSunDir, uSunCol, uCam, uDeep, uShal, uHor;
          varying vec2 vP; varying vec3 vWorld; varying float vH;
          ${WAVES}
          void main(){
            float e = .35;
            vec3 n = normalize(vec3(
              height(vP - vec2(e, 0.)) - height(vP + vec2(e, 0.)), 2. * e,
              -(height(vP - vec2(0., e)) - height(vP + vec2(0., e)))));
            vec3 V = normalize(uCam - vWorld);
            vec3 deep = mix(uDeep, vec3(.05,.09,.11), uStorm * .6);
            vec3 shal = mix(uShal, vec3(.16,.22,.24), uStorm * .6);
            vec3 horC = mix(uHor, vec3(.30,.34,.40), uStorm * .75);
            vec3 col = mix(deep, shal, clamp(vH * .7 + .5, 0., 1.));
            float fres = pow(1. - max(dot(n, V), 0.), 3.);
            col = mix(col, horC, fres * .55);
            vec3 R = reflect(-uSunDir, n);
            col += uSunCol * pow(max(dot(R, V), 0.), 90.) * .9 * (1. - uStorm * .7);
            float foam = smoothstep(.55 - uStorm * .12, .95,
              vH + sin(vP.x * 7. + uTime * 2.) * sin(vP.y * 6. - uTime * 1.7) * .12);
            col = mix(col, vec3(.92,.98,1.), foam * (.32 + uStorm * .1));
            float dist = length(vWorld.xz - uCam.xz);
            col = mix(col, horC, smoothstep(60., 320., dist));
            gl_FragColor = vec4(col, 1.);
          }`
      }));
    water.rotation.x = -Math.PI / 2;
    scene.add(water);

    // --- lights ---
    const sun = new THREE.DirectionalLight(0xfff1d6, 1.7);
    sun.position.copy(sunDir).multiplyScalar(200);
    // fill from the player's side so camera-facing surfaces aren't in shadow
    const fill = new THREE.DirectionalLight(0xdfeeff, .65);
    fill.position.set(-30, 80, 160);
    scene.add(sun, fill, new THREE.HemisphereLight(0xbfe3ff, 0x0a3a55, 1.0));

    // --- sailboats drifting on the horizon ---
    const hullMat = new THREE.MeshStandardMaterial({ color: 0xdde4ea, roughness: .55 });
    const sailMat = new THREE.MeshStandardMaterial({ color: 0xf7f2e6, roughness: .85,
                                                     side: THREE.DoubleSide });
    const mastMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: .7 });
    const sailGeo = (w, h) => {
      const sp = new THREE.Shape();
      sp.moveTo(0, 0); sp.quadraticCurveTo(w * .25, h * .45, 0, h);
      sp.lineTo(0, h); sp.moveTo(0, 0);
      const tri = new THREE.Shape();
      tri.moveTo(0, .1); tri.quadraticCurveTo(w * .55, h * .42, .04, h);
      tri.lineTo(0, .1);
      return new THREE.ShapeGeometry(tri, 12);
    };
    const mkBoat = (scale, z, speed, offset) => {
      const b = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), hullMat);
      hull.scale.set(1.9, .42, .62);
      hull.position.y = .25;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(.045, .06, 3.1, 10), mastMat);
      mast.position.y = 1.8;
      const main = new THREE.Mesh(sailGeo(1.5, 2.6), sailMat);
      main.position.set(-.05, .55, 0); main.rotation.y = Math.PI; // boom aft
      const jib = new THREE.Mesh(sailGeo(1.1, 2.1), sailMat);
      jib.position.set(.08, .55, 0);
      b.add(hull, mast, main, jib);
      b.scale.setScalar(scale);
      b.position.z = z;
      b.userData = { speed, offset };
      scene.add(b);
      boats.push(b);
    };
    mkBoat(3.2, -130, 1.1, 0);
    mkBoat(1.8, -190, -.7, 60);
    mkBoat(2.4, -90, .5, 110);

    // --- seagulls: two flapping wing planes each, circling the sky ---
    const gullMat = new THREE.MeshBasicMaterial({ color: 0xe8eef4, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      const wingGeo = new THREE.PlaneGeometry(1.6, .42);
      const L = new THREE.Mesh(wingGeo, gullMat); L.position.x = -.78;
      const R = new THREE.Mesh(wingGeo, gullMat); R.position.x = .78;
      const lp = new THREE.Group(), rp = new THREE.Group();
      lp.add(L); rp.add(R); g.add(lp, rp);
      g.userData = {
        lp, rp,
        r: 16 + Math.random() * 26,         // circle radius
        h: 9 + Math.random() * 8,           // altitude
        w: (.10 + Math.random() * .12) * (i % 2 ? 1 : -1), // angular speed
        ph: Math.random() * Math.PI * 2,    // phase
        flap: 4 + Math.random() * 3,
        cz: -45 - Math.random() * 50
      };
      scene.add(g);
      gulls.push(g);
    }

    // --- soft clouds ---
    const cloudTex = makeSprite("255,255,255");
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, opacity: pal.cloud * (.7 + Math.random() * .5),
        depthWrite: false }));
      s.scale.set(90 + Math.random() * 80, 22 + Math.random() * 14, 1);
      s.position.set(-200 + Math.random() * 400, 55 + Math.random() * 45, -350 - Math.random() * 120);
      s.userData = { v: .5 + Math.random() * .9 };
      scene.add(s);
      clouds.push(s);
    }

    // --- striped buoy bobbing nearby ---
    buoy = new THREE.Group();
    const bBase = new THREE.Mesh(new THREE.CylinderGeometry(.5, .65, .8, 24),
      new THREE.MeshStandardMaterial({ color: 0xd84339, roughness: .6 }));
    const bTop = new THREE.Mesh(new THREE.CylinderGeometry(.32, .5, .7, 24),
      new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: .6 }));
    bTop.position.y = .7;
    const bLight = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe28a }));
    bLight.position.y = 1.2;
    buoy.add(bBase, bTop, bLight);
    buoy.position.set(-7.5, .4, -14);
    scene.add(buoy);

    // --- the kayaker: the challenger himself, paddling across the bay ---
    kayaker = new THREE.Group();
    const kHull = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18),
      new THREE.MeshStandardMaterial({ color: 0xe06a28, roughness: .45 }));
    kHull.scale.set(2.7, .35, .6);
    kHull.position.y = .15;
    const kRim = new THREE.Mesh(new THREE.TorusGeometry(.52, .07, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0x9c4517, roughness: .6 }));
    kRim.rotation.x = -Math.PI / 2;
    kRim.scale.set(1.5, 1, 1);
    kRim.position.y = .42;
    const kTorso = new THREE.Mesh(new THREE.CylinderGeometry(.26, .36, .85, 18),
      new THREE.MeshStandardMaterial({ color: 0x39404f, roughness: .8 })); // the tank top
    kTorso.position.y = .8;
    const kShoulders = new THREE.Mesh(new THREE.SphereGeometry(.27, 18, 12),
      kTorso.material);
    kShoulders.position.y = 1.2; kShoulders.scale.set(1.15, .6, .9);
    const skin = new THREE.MeshStandardMaterial({ color: 0xc9905e, roughness: .7 });
    const mkArm = side => {
      const a = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .62, 8), skin);
      a.position.set(.28, 1.05, side * .3);
      a.rotation.z = -1.1; a.rotation.y = side * .25;
      return a;
    };
    // round head: the face is painted onto the front of an equirect canvas
    // (hair tone everywhere else), so it wraps a sphere naturally
    // South Park-style 3D head: an ellipsoid with the whole face on the
    // visible front, blended into skin/hair tones sampled from the photo
    // itself so the seams are invisible.
    const faceCanvas = document.createElement("canvas");
    faceCanvas.width = 256; faceCanvas.height = 128;
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    {
      const fx = faceCanvas.getContext("2d");
      fx.fillStyle = "#c08e66"; fx.fillRect(0, 0, 256, 128); // until photo loads
      const im = new Image();
      im.onload = () => {
        // sample real skin and hair tones from the photo
        const probe = document.createElement("canvas");
        probe.width = im.naturalWidth; probe.height = im.naturalHeight;
        const px = probe.getContext("2d");
        px.drawImage(im, 0, 0);
        const grab = (u, v) => {
          const d = px.getImageData(Math.round(u * probe.width),
                                    Math.round(v * probe.height), 1, 1).data;
          return [d[0], d[1], d[2]];
        };
        const avg = pts => {
          const c = pts.map(p => grab(p[0], p[1]))
            .reduce((a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], [0, 0, 0]);
          return c.map(v => Math.round(v / pts.length));
        };
        const skin = avg([[.30, .52], [.70, .52], [.50, .70]]); // cheeks + chin
        const hair = avg([[.42, .07], [.58, .07], [.50, .04]]); // top of head
        const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
        const cssA = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
        // base skin everywhere
        fx.fillStyle = css(skin); fx.fillRect(0, 0, 256, 128);
        // hair: crown band + back of the head, feathered
        fx.fillStyle = css(hair);
        fx.fillRect(0, 0, 256, 20);
        fx.fillRect(0, 0, 58, 58); fx.fillRect(198, 0, 58, 58);
        let g = fx.createLinearGradient(0, 20, 0, 36);
        g.addColorStop(0, cssA(hair, 1)); g.addColorStop(1, cssA(hair, 0));
        fx.fillStyle = g; fx.fillRect(0, 20, 256, 16);
        g = fx.createLinearGradient(58, 0, 80, 0);
        g.addColorStop(0, cssA(hair, 1)); g.addColorStop(1, cssA(hair, 0));
        fx.fillStyle = g; fx.fillRect(58, 0, 22, 58);
        g = fx.createLinearGradient(198, 0, 176, 0);
        g.addColorStop(0, cssA(hair, 1)); g.addColorStop(1, cssA(hair, 0));
        fx.fillStyle = g; fx.fillRect(176, 0, 22, 58);
        // the whole face across the front, oval-feathered
        const t = document.createElement("canvas");
        t.width = 104; t.height = 112;
        const tx = t.getContext("2d");
        tx.drawImage(im, 10, 2, 108, 142, 0, 0, 104, 112); // trim photo edges (curtain)
        tx.globalCompositeOperation = "destination-in";
        tx.save();
        tx.translate(52, 56); tx.scale(1, 112 / 104);
        const m = tx.createRadialGradient(0, 0, 27, 0, 0, 49);
        m.addColorStop(0, "rgba(0,0,0,1)");
        m.addColorStop(.74, "rgba(0,0,0,1)");
        m.addColorStop(1, "rgba(0,0,0,0)");
        tx.fillStyle = m; tx.fillRect(-52, -56, 104, 112);
        tx.restore();
        // Pre-warp with the inverse spherical (arcsin) mapping so the face
        // appears flat from the front instead of fish-eyed: texture pixels
        // are packed toward the silhouette and relaxed at the center,
        // cancelling the sphere's bulge.
        const phiMax = (104 / 256) * Math.PI;        // half horizontal span
        const thMax = (112 / 128) * (Math.PI / 2);   // half vertical span
        const wa = document.createElement("canvas");
        wa.width = 104; wa.height = 112;
        const wax = wa.getContext("2d");
        for (let i = 0; i < 104; i++) {
          const phi = (i / 103 - .5) * 2 * phiMax;
          const sx = (.5 + .5 * Math.sin(phi) / Math.sin(phiMax)) * 103;
          wax.drawImage(t, sx, 0, 1, 112, i, 0, 1, 112);
        }
        const wb = document.createElement("canvas");
        wb.width = 104; wb.height = 112;
        const wbx = wb.getContext("2d");
        for (let j = 0; j < 112; j++) {
          const th = (j / 111 - .5) * 2 * thMax;
          const sy = (.5 + .5 * Math.sin(th) / Math.sin(thMax)) * 111;
          wbx.drawImage(wa, 0, sy, 104, 1, 0, j, 104, 1);
        }
        fx.drawImage(wb, 76, 8);
        faceTex.needsUpdate = true;
      };
      im.src = FACE_SRC;
    }
    kHead = new THREE.Mesh(new THREE.SphereGeometry(.36, 32, 24),
      new THREE.MeshStandardMaterial({
        map: faceTex, roughness: .85,
        // emissive lift keeps the face readable even on the shadow side
        emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: .3 }));
    kHead.scale.set(.88, 1.18, .92); // ellipsoid head
    kHead.position.y = 1.62;
    kPaddle = new THREE.Group();
    const kShaft = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.7, 8),
      new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: .6 }));
    kShaft.rotation.x = Math.PI / 2; // across the kayak (z), blades over each side
    const kBladeGeo = new THREE.BoxGeometry(.06, .56, .32);
    const kBladeMat = new THREE.MeshStandardMaterial({ color: 0xd9952f, roughness: .55 });
    const kb1 = new THREE.Mesh(kBladeGeo, kBladeMat); kb1.position.z = 1.45;
    const kb2 = new THREE.Mesh(kBladeGeo, kBladeMat); kb2.position.z = -1.45;
    kPaddle.add(kShaft, kb1, kb2);
    kPaddle.position.set(.3, 1.15, 0);
    kayaker.add(kHull, kRim, kTorso, kShoulders, mkArm(1), mkArm(-1), kHead, kPaddle);
    kayaker.scale.setScalar(2.0);
    kayaker.userData.yaw = -.45; // angled so the paddle and face read on screen
    kayaker.rotation.y = -.45;
    kayaker.position.set(0, .2, -15);
    scene.add(kayaker);

    // --- the aim arrow: big flat chevron pointing away from the player ---
    arrowMat = new THREE.MeshStandardMaterial({
      color: 0xc9d6e2, metalness: .75, roughness: .3, emissive: 0x232c36, emissiveIntensity: .6
    });
    const sh = new THREE.Shape();
    sh.moveTo(0, 2.2);
    sh.lineTo(1.35, .55); sh.lineTo(.55, .55); sh.lineTo(.55, -1.6);
    sh.lineTo(0, -1.15); sh.lineTo(-.55, -1.6); sh.lineTo(-.55, .55);
    sh.lineTo(-1.35, .55); sh.closePath();
    const arrowMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sh, { depth: .22, bevelEnabled: true,
        bevelThickness: .08, bevelSize: .08, bevelSegments: 4 }), arrowMat);
    arrowMesh.rotation.x = -Math.PI / 2; // lay flat: shape +y -> world -z
    glow = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeSprite("255,210,100"), color: 0xffd966, transparent: true,
      opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(5.5);
    arrow = new THREE.Group();
    arrow.add(arrowMesh, glow);
    arrow.position.set(0, 1.3, 1.5);
    arrow.scale.setScalar(1.1);
    arrow.rotation.x = PITCH;
    arrow.visible = false;
    scene.add(arrow);

    window.addEventListener("resize", () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
    renderer.setAnimationLoop(tick);
    on = true;
    return true;
  }

  // ---------- particle bursts (splash / dust / confetti) ----------
  function spawnBurst(origin, palette, count, upMin, upMax, out) {
    clearBurst();
    const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), vel = [];
    for (let i = 0; i < count; i++) {
      pos.set([origin.x, origin.y, origin.z], i * 3);
      const a = Math.random() * Math.PI * 2, r = Math.random() * out;
      vel.push([Math.cos(a) * r, upMin + Math.random() * (upMax - upMin), Math.sin(a) * r]);
      col.set(palette[i % palette.length], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    burst = new THREE.Points(g, new THREE.PointsMaterial({
      size: .26, map: makeSprite(), transparent: true, vertexColors: true,
      depthWrite: false }));
    burstData = { vel, born: clock.getElapsedTime() };
    scene.add(burst);
  }
  function stepBurst() {
    const dt = 1 / 60, age = clock.getElapsedTime() - burstData.born;
    const p = burst.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = burstData.vel[i];
      v[1] -= 9.8 * dt * .9;
      p.array[i * 3] += v[0] * dt; p.array[i * 3 + 1] += v[1] * dt; p.array[i * 3 + 2] += v[2] * dt;
    }
    p.needsUpdate = true;
    burst.material.opacity = Math.max(0, 1 - age / 2.6);
    if (age > 2.6) clearBurst();
  }
  function clearBurst() {
    if (!burst) return;
    scene.remove(burst);
    burst.geometry.dispose(); burst.material.dispose();
    burst = null; burstData = null;
  }

  function splashAt(pos, success) {
    const pal = success
      ? [[.85, .95, 1], [.55, .85, 1], [1, 1, 1]]
      : [[.78, .62, .38], [.6, .48, .3], [.9, .8, .6]]; // dust of shame
    spawnBurst(pos, pal, 240, 3, 9, 5);
    if (splashRing) { scene.remove(splashRing); splashRing.geometry.dispose(); splashRing.material.dispose(); }
    splashRing = new THREE.Mesh(
      new THREE.RingGeometry(.7, .95, 48),
      new THREE.MeshBasicMaterial({ color: success ? 0xbfeaff : 0xc9b089,
        transparent: true, opacity: .95, side: THREE.DoubleSide, depthWrite: false }));
    splashRing.rotation.x = -Math.PI / 2;
    splashRing.position.set(pos.x, .7, pos.z);
    splashT0 = clock.getElapsedTime();
    scene.add(splashRing);
  }

  // ---------- launch cinematic ----------
  function cineTick(t, cam) {
    const e = t - cine.t0;
    if (e < .45) {                       // windup: pull back, glow flare
      arrow.position.z = 1.5 + (e / .45) * 1.1;
      glow.material.opacity = .4 + e * 1.3;
    } else if (e < 2.4) {                // flight
      const p = (e - .45) / 1.95, q = p * p;
      arrow.position.z = 2.6 - q * 100;
      if (cine.success) {
        arrow.position.y = 1.3 + Math.sin(p * Math.PI) * 1.6;
        arrow.rotation.x = PITCH - p * .75;
      } else {
        arrow.position.y = 1.3 + Math.sin(p * Math.PI * .8) * 1.1 - Math.max(0, p - .5) * 9;
        arrow.rotation.x = PITCH - p * 2.4;
      }
      if (!cine.splashed &&
          ((cine.success && p > .9) || (!cine.success && arrow.position.y < .2))) {
        cine.splashed = true;
        splashAt(arrow.position.clone(), cine.success);
        arrow.visible = false;
        shake = cine.success ? .35 : .55;
      }
    } else if (e >= 2.75) { endCine(); return; }
    // chase camera
    const az = Math.max(arrow.position.z, -55);
    cam.cx = arrow.position.x; cam.cy = Math.max(arrow.position.y, .8) + 2.4; cam.cz = az + 10;
    cam.lx = arrow.position.x; cam.ly = arrow.position.y; cam.lz = az - 6;
  }
  function endCine() {
    if (!cine) return;
    const cb = cine.cb;
    arrow.visible = false;
    glow.material.opacity = 0;
    cine = null;
    if (cb) cb();
  }

  // ---------- main loop ----------
  function tick() {
    const t = clock.getElapsedTime();
    storm += (stormTarget - storm) * .04;
    skyU.uStorm.value = storm;
    waterU.uStorm.value = storm;
    waterU.uTime.value = t;
    waterU.uCam.value.copy(camera.position);

    for (const b of boats) {
      const u = b.userData;
      b.position.x = -75 + (((t * u.speed + u.offset) % 150) + 150) % 150;
      b.position.y = .25 + Math.sin(t * .8 + u.offset) * .25;
      b.rotation.z = Math.sin(t * .8 + u.offset) * .05;
    }
    for (const g of gulls) {
      const u = g.userData, a = t * u.w + u.ph;
      g.position.set(Math.cos(a) * u.r, u.h + Math.sin(t * .7 + u.ph) * 1.2,
                     u.cz + Math.sin(a) * u.r * .5);
      g.rotation.y = -a - (u.w > 0 ? 0 : Math.PI);
      const f = Math.sin(t * u.flap + u.ph) * .55;
      u.lp.rotation.z = f; u.rp.rotation.z = -f;
    }
    for (const c of clouds) {
      c.position.x += c.userData.v * (1 / 60) * 4;
      if (c.position.x > 260) c.position.x = -260;
    }
    buoy.position.y = .25 + Math.sin(t * 1.1 + 2) * .35;
    buoy.rotation.z = Math.sin(t * .9) * .08;
    buoy.rotation.x = Math.sin(t * .7 + 1) * .06;

    {
      // ping-pong across the view: sin path, smooth U-turns at the edges
      const T = 22, A = 8.5, ph = t * Math.PI * 2 / T;
      kayaker.position.x = Math.sin(ph) * A;
      const dir = Math.cos(ph) >= 0 ? 1 : -1;
      const targetYaw = dir > 0 ? -.45 : Math.PI + .45;
      let dy = targetYaw - kayaker.userData.yaw;
      dy = ((dy + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
      kayaker.userData.yaw += dy * .04;
      kayaker.rotation.y = kayaker.userData.yaw;
      kayaker.position.y = .2 + Math.sin(t * 1.3) * .25;
      kayaker.rotation.x = Math.sin(t * 2.4) * .07;   // roll with each stroke
      kayaker.rotation.z = Math.sin(t * 1.1) * .04;   // pitch over the swell
      kPaddle.rotation.x = Math.sin(t * 2.4) * .55;   // alternate blade dips
      // keep his face on the player whichever way he's heading
      kHead.rotation.y = -1.62 - kayaker.userData.yaw;
    }

    const cam = { cx: 0, cy: 3.1, cz: 8.5, lx: 0, ly: 1.5, lz: -40 };
    if (phase === "intro" || phase === "create") {
      cam.cy = 2.5 + Math.sin(t * .4) * .3; cam.cx = Math.sin(t * .15) * 1.6; cam.cz = 9;
    }

    if (cine) {
      cineTick(t, cam);
    } else if (arrow.visible) {
      arrow.position.y = 1.3 + Math.sin(t * 1.6) * .12;
      arrow.position.z = 1.5;
      arrow.rotation.z = Math.sin(t * .9) * .05;
      arrow.rotation.x = PITCH + Math.sin(t * 1.2) * .04;
      if (isReady) {
        arrowMat.emissiveIntensity = .55 + (.5 + .5 * Math.sin(t * 3)) * .5;
        glow.material.opacity = .25 + (.5 + .5 * Math.sin(t * 3)) * .25;
      }
    }

    // tilt parallax — pitch/roll only, never the compass heading
    cam.cx += tiltY * .015;
    cam.cy += (tiltX - 25) * .006;
    if (shake > 0) {
      cam.cx += (Math.random() - .5) * shake; cam.cy += (Math.random() - .5) * shake;
      shake *= .9; if (shake < .005) shake = 0;
    }
    camera.position.set(cam.cx, cam.cy, cam.cz);
    camera.lookAt(cam.lx, cam.ly, cam.lz);

    if (splashRing) {
      const age = t - splashT0;
      splashRing.scale.setScalar(1 + age * 9);
      splashRing.material.opacity = Math.max(0, .95 * (1 - age / .9));
      if (age > .9) {
        scene.remove(splashRing);
        splashRing.geometry.dispose(); splashRing.material.dispose();
        splashRing = null;
      }
    }
    if (burst) stepBurst();
    renderer.render(scene, camera);
  }

  return {
    init,
    get enabled() { return on; },
    setPhase(p) {
      phase = p;
      if (!on) return;
      if (p === "game") {
        if (cine) cine.cb = null; // a stale cinematic must not fire its callback
        clearBurst(); endCine();
        arrow.visible = true;
        arrow.position.set(0, 1.3, 1.5);
        arrow.rotation.set(PITCH, 0, 0);
        stormTarget = 0; shake = 0;
      } else if (p === "intro" || p === "create") {
        arrow.visible = false; stormTarget = 0;
      }
    },
    setTilt(beta, gamma) {
      if (!on) return;
      tiltX = Math.max(-40, Math.min(85, beta || 0));
      tiltY = Math.max(-45, Math.min(45, gamma || 0));
    },
    setStorm(f) { stormTarget = Math.max(0, Math.min(1, f)); },
    arrowReady() {
      if (!on || isReady) return;
      isReady = true;
      arrowMat.color.set(0xffc94d);
      arrowMat.emissive.set(0x7a4e08);
    },
    launch(success, cb) {
      if (!on) { if (cb) cb(); return; }
      stormTarget = 0;
      cine = { t0: clock.getElapsedTime(), success, cb, splashed: false };
    },
    skip() { endCine(); },
    celebrate() {
      if (!on) return;
      spawnBurst(new THREE.Vector3(0, 1.5, 2), [[1, .85, .3], [.4, .9, 1], [1, 1, 1], [.3, 1, .6]], 260, 4, 9, 3.5);
    },
    snapshot() {
      if (!on) return null;
      try {
        renderer.render(scene, camera);
        return renderer.domElement.toDataURL("image/jpeg", .82);
      } catch { return null; }
    }
  };
})();
