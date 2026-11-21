/* v4 — The Dive, in real water.
   One WebGL world: sky and swell at the top of the page, then a single water column
   down to the seafloor. Scrolling is the descent. This file owns the renderer, the
   water and light model, and the camera; life.js adds everything that lives in it. */

(function () {
  "use strict";

  const T = window.THREE;
  const D = (window.DIVE = window.DIVE || {});
  const canvas = document.getElementById("ocean");
  if (!T || !canvas) return;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function smooth(a, b, v) { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }

  // Colours are authored as sRGB hex and lit in linear space; shaders tone-map on the way out.
  function lin(hex, out) {
    const n = parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (v) {
      v /= 255;
      return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return (out || new T.Vector3()).set(c[0], c[1], c[2]);
  }

  /* ---------- the water column ---------- */

  // World units are roughly metres near the camera; the page compresses real depth.
  const FLOOR_Y = -150;
  const BANDS = [
    { id: "top", y: 2.6, m: 0 },
    { id: "about", y: -6, m: 8 },
    { id: "publications", y: -44, m: 200 },
    { id: "news", y: -84, m: 1000 },
    { id: "experience", y: -118, m: 4000 },
    { id: "end", y: FLOOR_Y + 2.3, m: 4800 }
  ];

  // What the water looks like at each depth: colour looking level, up and down,
  // how far you can see, and how much of the sun is left.
  const WATER = [
    { y: 0, hor: "#1c8db4", up: "#86d6e8", down: "#0a4c7c", fog: 0.038, sun: 1, ray: 1, caus: 1, torch: 0 },
    { y: -20, hor: "#14729d", up: "#4eb2d5", down: "#083c68", fog: 0.04, sun: 0.74, ray: 0.85, caus: 0.55, torch: 0 },
    { y: -44, hor: "#0b4d78", up: "#1e7dac", down: "#052a4b", fog: 0.04, sun: 0.4, ray: 0.38, caus: 0.1, torch: 0.2 },
    { y: -64, hor: "#062f4e", up: "#0d4d76", down: "#03192f", fog: 0.038, sun: 0.18, ray: 0.08, caus: 0, torch: 0.6 },
    { y: -84, hor: "#03182b", up: "#062e4a", down: "#010b17", fog: 0.036, sun: 0.06, ray: 0, caus: 0, torch: 0.95 },
    { y: -118, hor: "#01080f", up: "#020e1b", down: "#000407", fog: 0.038, sun: 0, ray: 0, caus: 0, torch: 1 },
    { y: FLOOR_Y, hor: "#00050a", up: "#01080f", down: "#000305", fog: 0.04, sun: 0, ray: 0, caus: 0, torch: 1 }
  ].map(function (s) {
    return Object.assign({}, s, { hor: lin(s.hor), up: lin(s.up), down: lin(s.down) });
  });

  // The sky for each part of the day. `az` turns the sun around the viewer; `el` lifts it.
  const SKIES = {
    morning: { zen: "#5f9fd6", hor: "#f6dcc0", sun: "#ffd9a6", power: 1.0, el: 9, az: 14, cloudLit: "#fff3e4", cloudDark: "#b9a8b4", sea: "#0d4a66", night: 0, light: 0.92, tone: "light" },
    afternoon: { zen: "#3f86cc", hor: "#cfe6f2", sun: "#fff4dc", power: 1.15, el: 36, az: 16, cloudLit: "#ffffff", cloudDark: "#aab8c8", sea: "#0b4f73", night: 0, light: 1, tone: "light" },
    evening: { zen: "#2f4f86", hor: "#f2a66f", sun: "#ffb26b", power: 0.95, el: 5, az: 12, cloudLit: "#ffd0a6", cloudDark: "#5d5878", sea: "#123a56", night: 0.12, light: 0.7, tone: "dark" },
    night: { zen: "#050b18", hor: "#12203a", sun: "#c9d8f2", power: 0.22, el: 30, az: 18, cloudLit: "#3c4a66", cloudDark: "#0c1424", sea: "#04121f", night: 1, light: 0.16, tone: "dark" }
  };

  const U = {
    uTime: { value: 0 },
    uInvProj: { value: new T.Matrix4() },
    uCamWorld: { value: new T.Matrix4() },
    uAbove: { value: 1 },
    uSunDir: { value: new T.Vector3(0, 1, 0) },
    uSunCol: { value: new T.Vector3(1, 1, 1) },
    uSkyZen: { value: new T.Vector3() },
    uSkyHor: { value: new T.Vector3() },
    uCloudLit: { value: new T.Vector3() },
    uCloudDark: { value: new T.Vector3() },
    uSeaBody: { value: new T.Vector3() },
    uCloud: { value: 0.4 },
    uNight: { value: 0 },
    uWave: { value: 1 },
    uWaterHor: { value: new T.Vector3() },
    uWaterUp: { value: new T.Vector3() },
    uWaterDown: { value: new T.Vector3() },
    uFog: { value: 0.03 },
    uSun: { value: 1 },
    uRay: { value: 1 },
    uCaustic: { value: 1 },
    uTorchPos: { value: new T.Vector3() },
    uTorchDir: { value: new T.Vector3(0, 0, -1) },
    uTorch: { value: 0 },
    uLightPos: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] },
    uLightCol: { value: [new T.Vector3(), new T.Vector3(), new T.Vector3(), new T.Vector3()] },
    uVision: { value: 0 },
    uPx: { value: 1 },
    uTrail: { value: [new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4(), new T.Vector4()] },
    uTrailFrom: { value: new T.Vector3() }
  };

  /* ---------- shared GLSL ---------- */

  const GLSL_COMMON = [
    "uniform float uTime;",
    "uniform float uAbove;",
    "uniform vec3 uSunDir;",
    "uniform vec3 uSunCol;",
    "uniform vec3 uSkyZen;",
    "uniform vec3 uSkyHor;",
    "uniform vec3 uCloudLit;",
    "uniform vec3 uCloudDark;",
    "uniform vec3 uSeaBody;",
    "uniform float uCloud;",
    "uniform float uNight;",
    "uniform float uWave;",
    "uniform vec3 uWaterHor;",
    "uniform vec3 uWaterUp;",
    "uniform vec3 uWaterDown;",
    "uniform float uFog;",
    "uniform float uSun;",
    "uniform float uRay;",
    "uniform float uCaustic;",
    "uniform vec3 uTorchPos;",
    "uniform vec3 uTorchDir;",
    "uniform float uTorch;",
    "uniform vec4 uLightPos[4];",
    "uniform vec3 uLightCol[4];",
    "uniform float uVision;",

    "float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }",
    "float vnoise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); f = f*f*(3.0-2.0*f);",
    "  return mix(mix(hash12(i), hash12(i+vec2(1.,0.)), f.x), mix(hash12(i+vec2(0.,1.)), hash12(i+vec2(1.,1.)), f.x), f.y); }",
    "float fbm(vec2 p){ float a = .5; float s = 0.; for (int i = 0; i < 4; i++){ s += a*vnoise(p); p = p*2.03 + vec2(17.3, 9.1); a *= .5; } return s; }",

    // Sky: gradient, sun (or moon) with its halo, drifting cloud with a lit rim, stars at night.
    "vec3 skyColor(vec3 d){",
    "  float h = max(d.y, 0.0);",
    "  vec3 c = mix(uSkyHor, uSkyZen, 1.0 - exp(-h * 3.2));",
    "  float sd = max(dot(d, uSunDir), 0.0);",
    "  c += uSunCol * (pow(sd, 8.0) * 0.07 + pow(sd, 64.0) * 0.28);",
    "  float disc = smoothstep(0.99955, 0.99985, sd);",
    "  if (uNight > 0.5) {",
    "    vec2 g = d.xz / (d.y + 0.25) * 90.0;",
    "    float st = hash12(floor(g));",
    "    vec2 fp = fract(g) - 0.5;",
    "    c += vec3(0.9, 0.95, 1.0) * smoothstep(0.985, 1.0, st) * smoothstep(0.22, 0.0, length(fp)) * (0.6 + 0.4*sin(uTime*1.7 + st*40.0)) * smoothstep(0.0, 0.2, d.y);",
    "  }",
    "  if (d.y > 0.004) {",
    "    vec2 uv = d.xz / (d.y + 0.16) * 0.42 + uTime * vec2(0.0045, 0.0018);",
    "    float n = fbm(uv * 1.5) * 0.66 + fbm(uv * 4.6 + 3.7) * 0.24 + vnoise(uv * 13.0 - uTime * 0.01) * 0.10;",
    "    float lo = 0.70 - uCloud * 0.42;",
    "    float cl = smoothstep(lo, lo + 0.26, n) * smoothstep(0.0, 0.10, d.y);",
    "    float rim = cl * (1.0 - cl) * 4.0;",
    "    vec3 cc = mix(uCloudLit, uCloudDark, smoothstep(lo + 0.1, lo + 0.5, n) * (0.55 + 0.45 * uCloud));",
    "    cc += uSunCol * rim * pow(sd, 2.0) * 1.3;", // every cloud has a silver lining
    "    c = mix(c, cc, cl * 0.92);",
    "    disc *= 1.0 - cl * 0.85;",
    "  }",
    "  c += uSunCol * disc * mix(14.0, 2.4, uNight);",
    "  return c;",
    "}",

    // The colour of open water in a given direction.
    "vec3 waterColor(vec3 d){",
    "  float t = 1.0 - pow(1.0 - abs(d.y), 1.6);",
    "  t *= smoothstep(0.0, 0.16, abs(d.y)) * 0.35 + 0.65;",
    "  return mix(uWaterHor, d.y > 0.0 ? uWaterUp : uWaterDown, t);",
    "}",

    // Light patterns thrown onto things by the moving surface.
    "float caustic(vec2 uv, float t){",
    "  vec2 p = mod(uv * 6.28318, 6.28318) - 250.0;",
    "  vec2 i = p; float c = 1.0; const float inten = 0.005;",
    "  for (int n = 0; n < 4; n++){",
    "    float tt = t * (1.0 - (3.5 / float(n + 1)));",
    "    i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));",
    "    c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));",
    "  }",
    "  c /= 4.0; c = 1.17 - pow(c, 1.4);",
    "  return pow(abs(c), 8.0);",
    "}",

    // Six trains of swell. Returns the offset of a surface point; wavesNormal gives its slope.
    "const int NW = 6;",
    "vec4 wave(int i){",
    "  if (i == 0) return vec4(0.86, 0.51, 37.0, 0.085);",
    "  if (i == 1) return vec4(0.96, -0.28, 23.0, 0.085);",
    "  if (i == 2) return vec4(0.55, 0.83, 13.0, 0.08);",
    "  if (i == 3) return vec4(0.99, 0.12, 7.1, 0.075);",
    "  if (i == 4) return vec4(0.31, 0.95, 3.9, 0.07);",
    "  return vec4(0.74, -0.67, 2.3, 0.06);",
    "}",
    "vec3 wavesOffset(vec2 p, float fade){",
    "  vec3 o = vec3(0.0);",
    "  for (int i = 0; i < NW; i++){",
    "    vec4 w = wave(i); float k = 6.28318 / w.z; float c = sqrt(9.8 / k);",
    "    float a = w.w / k * uWave * clamp(fade * w.z, 0.0, 1.0);",
    "    float f = k * (dot(w.xy, p) - c * uTime);",
    "    o.xz += w.xy * a * cos(f); o.y += a * sin(f);",
    "  }",
    "  return o;",
    "}",
    "vec3 wavesNormal(vec2 p, float fade){",
    "  vec3 n = vec3(0.0, 1.0, 0.0);",
    "  for (int i = 0; i < NW; i++){",
    "    vec4 w = wave(i); float k = 6.28318 / w.z; float c = sqrt(9.8 / k);",
    "    float s = w.w * uWave * clamp(fade * w.z, 0.0, 1.0);",
    "    float f = k * (dot(w.xy, p) - c * uTime);",
    "    n.xz -= w.xy * s * cos(f); n.y -= s * sin(f) * 0.6;",
    "  }",
    "  return normalize(n);",
    "}",

    // Filmic curve, then display gamma.
    "vec3 finish(vec3 c){",
    "  c = max(c, 0.0);",
    "  c = (c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14);",
    "  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));",
    "}"
  ].join("\n");

  D.GLSL_COMMON = GLSL_COMMON;
  D.U = U;
  D.lin = lin;
  D.FLOOR_Y = FLOOR_Y;

  /* ---------- renderer ---------- */

  let renderer;
  try {
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch (err) {
    renderer = null;
  }
  if (!renderer || !renderer.capabilities.isWebGL2) {
    document.documentElement.classList.add("no-gl");
    D.failed = true;
    return;
  }
  T.ColorManagement.enabled = false;
  renderer.outputColorSpace = T.LinearSRGBColorSpace;
  renderer.setClearColor(0x04121f, 1);
  renderer.sortObjects = true;
  document.documentElement.classList.add("has-gl");

  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(50, 1, 0.12, 9000);
  camera.rotation.order = "YXZ";

  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  const S = {
    vw: 1, vh: 1, dpr: 1, scale: 1,
    t: 0, sy: 0, maxScroll: 1,
    anchors: [],
    camY: 2.6, targetY: 2.6,
    depthM: 0, zone: 0,
    pitch: 0.12, heroPitch: 0.12,
    part: "afternoon", sky: SKIES.afternoon,
    cloud: 0.4, waveK: 1, light: 1,
    under: false,
    reduced: reduceQuery.matches,
    pointer: { x: 0, y: 0, sx: 0, sy: 0, cx: -9999, cy: -9999, active: false, moved: 0 },
    vision: 0, visionOn: false,
    // free look: the visitor can turn the camera all the way round
    look: { yaw: 0, pitch: 0, held: false, at: -99, vy: 0, vp: 0, homing: false, w: 0, dir: 0, rest: 0 },
    spin: false, spinHold: false, edge: 0,
    explore: false,
    dirty: true
  };
  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener("change", function (e) { S.reduced = e.matches; S.dirty = true; });
  }
  D.S = S;

  /* ---------- backdrop: open water, or the sky ---------- */

  const backdrop = new T.Mesh(
    new T.BufferGeometry().setAttribute("position", new T.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3)),
    new T.ShaderMaterial({
      uniforms: U,
      depthTest: false,
      depthWrite: false,
      vertexShader: [
        "uniform mat4 uInvProj; uniform mat4 uCamWorld;",
        "varying vec3 vDir;",
        "void main(){",
        "  vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0);",
        "  vDir = mat3(uCamWorld) * (v.xyz / v.w);",
        "  gl_Position = vec4(position.xy, 1.0, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        GLSL_COMMON,
        "varying vec3 vDir;",
        "void main(){",
        "  vec3 d = normalize(vDir);",
        "  vec3 col;",
        "  if (uAbove > 0.5) {",
        "    col = skyColor(vec3(d.x, abs(d.y), d.z));",
        "  } else {",
        "    col = waterColor(d);",
        // A torch lights the water it passes through.
        "    float beam = pow(max(dot(d, uTorchDir), 0.0), 26.0);",
        "    col += vec3(0.2, 0.42, 0.6) * beam * uTorch * 0.03;",
        "  }",
        "  col = finish(col);",
        "  col += (hash12(gl_FragCoord.xy + fract(uTime) * 61.0) - 0.5) / 255.0;",
        "  gl_FragColor = vec4(col, 1.0);",
        "}"
      ].join("\n")
    })
  );
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1000;
  scene.add(backdrop);

  // Light shafts live in the water between the lens and everything else, so they are
  // laid over the scene rather than painted on the backdrop.
  const shaftsMesh = new T.Mesh(
    backdrop.geometry,
    new T.ShaderMaterial({
      uniforms: U,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: T.AdditiveBlending,
      vertexShader: backdrop.material.vertexShader,
      fragmentShader: [
        GLSL_COMMON,
        "varying vec3 vDir;",
        "void main(){",
        "  vec3 d = normalize(vDir);",
        "  vec3 col = vec3(0.0);",
        // Shafts of sunlight: parallel in the water, so they fan out from the sun's direction.
        "  vec3 L = normalize(vec3(uSunDir.x * 0.6, max(uSunDir.y, 0.5) + 0.35, uSunDir.z * 0.6));",
        "  vec3 a = normalize(cross(L, vec3(0.0, 0.0, 1.0))); vec3 b = cross(L, a);",
        "  float cz = dot(d, L);",
        "  float ang = atan(dot(d, b), dot(d, a));",
        "  float sway = cameraPosition.x * 0.05;",
        "  float s1 = 0.5 + 0.5 * sin(ang * 9.0 + uTime * 0.16 + sway);",
        "  float s2 = 0.5 + 0.5 * sin(ang * 17.0 - uTime * 0.11 + 1.7 + sway * 2.0);",
        "  float s3 = 0.5 + 0.5 * sin(ang * 31.0 + uTime * 0.23 + 4.1);",
        "  float s4 = 0.5 + 0.5 * sin(ang * 53.0 - uTime * 0.19 + 2.3);",
        "  float shafts = pow(s1 * s2, 1.6) * 1.5 + pow(s2 * s3, 2.0) * 0.9 + pow(s3 * s4, 2.4) * 0.5;",
        "  float reach = smoothstep(-0.55, 0.75, cz) * smoothstep(-0.35, 0.25, d.y);",
        "  col += uSunCol * uWaterUp * shafts * reach * uRay * 0.55;",
        "  col += uSunCol * uWaterUp * pow(max(cz, 0.0), 5.0) * uRay * 0.5;",
        "  gl_FragColor = vec4(col * mix(0.5, 0.3, smoothstep(0.2, 0.9, d.y)), 1.0);",
        "}"
      ].join("\n")
    })
  );
  shaftsMesh.frustumCulled = false;
  shaftsMesh.renderOrder = 40;
  scene.add(shaftsMesh);

  /* ---------- the sea surface, seen from both sides ---------- */

  function surfaceGeometry() {
    const rings = 120;
    const segs = 144;
    const pos = [];
    const idx = [];
    pos.push(0, 0, 0);
    for (let r = 0; r < rings; r++) {
      const radius = 0.35 * Math.pow(1.092, r) + r * 0.22;
      for (let s = 0; s < segs; s++) {
        const a = (s / segs) * Math.PI * 2;
        pos.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      }
    }
    for (let s = 0; s < segs; s++) idx.push(0, 1 + ((s + 1) % segs), 1 + s);
    for (let r = 0; r < rings - 1; r++) {
      for (let s = 0; s < segs; s++) {
        const a = 1 + r * segs + s;
        const b = 1 + r * segs + ((s + 1) % segs);
        const c = a + segs;
        const d = b + segs;
        idx.push(a, b, c, b, d, c);
      }
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(pos), 3));
    g.setIndex(idx);
    return g;
  }

  const surface = new T.Mesh(
    surfaceGeometry(),
    new T.ShaderMaterial({
      uniforms: U,
      side: T.DoubleSide,
      vertexShader: [
        GLSL_COMMON,
        "varying vec3 vWorld; varying vec2 vFlat; varying float vFade;",
        "void main(){",
        "  vec4 wp = modelMatrix * vec4(position, 1.0);",
        "  float dist = length(wp.xz - cameraPosition.xz);",
        "  vFade = 1.0 / (1.0 + dist * 0.018);",
        "  vFlat = wp.xz;",
        "  wp.xyz += wavesOffset(wp.xz, 1.0 / (1.0 + dist * 0.05) * 0.6);",
        "  vWorld = wp.xyz;",
        "  gl_Position = projectionMatrix * viewMatrix * wp;",
        "}"
      ].join("\n"),
      fragmentShader: [
        GLSL_COMMON,
        "varying vec3 vWorld; varying vec2 vFlat; varying float vFade;",
        "void main(){",
        "  vec3 toCam = cameraPosition - vWorld;",
        "  float dist = length(toCam);",
        "  vec3 V = toCam / dist;",
        "  vec3 N = wavesNormal(vFlat, 0.6 / (1.0 + dist * 0.02));",
        // Wind ripples on top of the swell, fading out before they turn to noise.
        "  float rf = 1.0 / (1.0 + dist * 0.03);",
        "  vec2 rp = vFlat * 1.7;",
        "  vec2 f1 = uTime * vec2(0.33, 0.21); vec2 f2 = uTime * vec2(-0.27, 0.36);",
        "  const float e = 0.09;",
        "  float n0 = fbm(rp + f1) + 0.5 * fbm(rp * 3.1 + f2);",
        "  float nx = fbm(rp + vec2(e, 0.0) + f1) + 0.5 * fbm((rp + vec2(e, 0.0)) * 3.1 + f2);",
        "  float nz = fbm(rp + vec2(0.0, e) + f1) + 0.5 * fbm((rp + vec2(0.0, e)) * 3.1 + f2);",
        "  vec3 rip = vec3(n0 - nx, 0.0, n0 - nz);",
        "  vec3 col;",
        "  if (uAbove > 0.5) {",
        "    N = normalize(N + rip * 0.85 * rf * uWave);",
        "    float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);",
        "    vec3 R = reflect(-V, N); R.y = abs(R.y);",
        "    vec3 refl = skyColor(R);",
        "    float crest = smoothstep(-0.05, 0.4, vWorld.y);",
        "    float facing = pow(max(dot(normalize(vec3(-V.x, 0.0, -V.z)), normalize(vec3(uSunDir.x, 0.0, uSunDir.z))), 0.0), 2.0);",
        "    vec3 body = uSeaBody * (0.5 + 0.5 * uSunCol);",
        "    body += uSeaBody * vec3(0.25, 1.25, 1.0) * crest * (0.25 + 0.6 * facing) * max(uSunDir.y, 0.2);", // light through the wave tops
        "    col = mix(body, refl, fres);",
        "    float sp = max(dot(R, uSunDir), 0.0);",
        "    col += uSunCol * (pow(sp, 900.0) * 40.0 + pow(sp, 140.0) * 1.1) * mix(1.0, 0.25, uNight) * (1.0 - uCloud * 0.6);",
        "    vec3 haze = mix(uSkyHor, uSeaBody, 0.22);",
        "    col = mix(col, haze, 1.0 - exp(-dist * 0.0009));",
        "  } else {",
        // From below: a bright window straight up, mirror-dark water beyond the critical angle.
        "    N = normalize(N + rip * 1.5 * rf);",
        "    vec3 Nd = -N;",
        "    float ci = max(dot(Nd, V), 0.0);",
        "    vec3 Tr = refract(-V, Nd, 1.333);",
        "    float window = smoothstep(0.56, 0.86, ci) * step(0.0001, dot(Tr, Tr));",
        "    vec3 skyDir = normalize(vec3(Tr.x, abs(Tr.y) + 0.02, Tr.z));",
        "    vec3 through = skyColor(skyDir) * 0.9 + uSunCol * pow(max(dot(skyDir, uSunDir), 0.0), 60.0) * 6.0;",
        "    vec3 Rd = reflect(-V, Nd);",
        "    vec3 mirror = waterColor(normalize(vec3(Rd.x, -abs(Rd.y) - 0.05, Rd.z))) * 1.05;",
        "    col = mix(mirror, through * vec3(0.62, 0.88, 0.95) * (0.75 + 0.5 * n0 - 0.375), window);",
        "    col = mix(col, waterColor(-V), 1.0 - exp(-dist * uFog * 1.15));",
        "  }",
        "  gl_FragColor = vec4(finish(col), 1.0);",
        "}"
      ].join("\n")
    })
  );
  surface.frustumCulled = false;
  surface.renderOrder = -900;
  scene.add(surface);

  // The same swell on the CPU, for anything that floats.
  const WAVES = [
    [0.86, 0.51, 37.0, 0.085], [0.96, -0.28, 23.0, 0.085], [0.55, 0.83, 13.0, 0.08],
    [0.99, 0.12, 7.1, 0.075], [0.31, 0.95, 3.9, 0.07], [0.74, -0.67, 2.3, 0.06]
  ];
  function seaHeight(x, z) {
    let y = 0;
    for (let i = 0; i < WAVES.length; i++) {
      const w = WAVES[i];
      const k = (Math.PI * 2) / w[2];
      const c = Math.sqrt(9.8 / k);
      y += (w[3] / k) * U.uWave.value * Math.min(0.6 * w[2], 1) * Math.sin(k * (w[0] * x + w[1] * z - c * U.uTime.value));
    }
    return y;
  }
  D.seaHeight = seaHeight;

  /* ---------- drifting particles: marine snow, and plankton that light up ---------- */

  function makeSnow(count) {
    const seed = new Float32Array(count * 4);
    for (let i = 0; i < count * 4; i++) seed[i] = Math.random();
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute("aSeed", new T.BufferAttribute(seed, 4));
    const m = new T.ShaderMaterial({
      uniforms: Object.assign({ uBox: { value: new T.Vector3(46, 34, 46) } }, U),
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: [
        GLSL_COMMON,
        "uniform vec3 uBox; uniform float uPx; uniform vec4 uTrail[6]; uniform vec3 uTrailFrom;",
        "attribute vec4 aSeed;",
        "varying vec3 vCol; varying float vSoft;",
        "void main(){",
        "  vec3 p = aSeed.xyz * uBox;",
        "  p.y -= uTime * (0.10 + aSeed.w * 0.22);",
        "  p.x += sin(uTime * 0.31 + aSeed.w * 40.0) * 0.5 + uTime * 0.07;",
        "  p.z += cos(uTime * 0.27 + aSeed.x * 31.0) * 0.5;",
        "  p = mod(p - cameraPosition, uBox) - uBox * 0.5 + cameraPosition;",
        "  vec4 mv = viewMatrix * vec4(p, 1.0);",
        "  float dist = -mv.z;",
        "  float size = mix(0.018, 0.06, aSeed.w * aSeed.w);",
        "  gl_PointSize = clamp(uPx * size / max(dist, 0.3), 1.0, 26.0);",
        "  float fade = smoothstep(0.5, 3.0, dist) * (1.0 - smoothstep(14.0, 23.0, dist)) * step(p.y, -0.15);",
        "  vSoft = smoothstep(4.0, 0.6, dist);",
        // lit by what is left of the sun, and by the torch
        "  vec3 tl = p - uTorchPos; float td = length(tl); tl /= max(td, 0.001);",
        "  float cone = smoothstep(0.90, 0.985, dot(tl, uTorchDir));",
        "  vec3 light = mix(uWaterUp, vec3(dot(uWaterUp, vec3(0.4))), 0.6) * (0.5 + 1.6 * uSun) + vec3(0.9, 1.0, 1.0) * cone * uTorch * 9.0 / (1.0 + td * td * 0.02);",
        // plankton answer a passing pointer with their own light
        "  float glow = 0.0;",
        "  if (aSeed.z > 0.72) {",
        "    for (int i = 0; i < 6; i++) {",
        "      vec3 rd = uTrail[i].xyz; vec3 q = p - uTrailFrom;",
        "      float along = dot(q, rd);",
        "      float off = length(q - rd * along);",
        "      glow += smoothstep(1.7, 0.0, off) * step(1.0, along) * uTrail[i].w;",
        "    }",
        "    glow *= (0.6 + 0.4 * sin(uTime * 6.0 + aSeed.w * 80.0));",
        "    glow += pow(0.5 + 0.5 * sin(uTime * (0.5 + aSeed.x) + aSeed.w * 90.0), 14.0) * 0.55;",
        "    glow *= uTorch;",
        "    gl_PointSize *= 1.0 + min(glow, 1.0) * 1.6;",
        "  }",
        "  vCol = light * 0.16 * fade + vec3(0.1, 0.85, 1.0) * glow * 1.3 * smoothstep(0.2, 2.0, dist) * (1.0 - smoothstep(18.0, 23.0, dist));",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        "precision highp float;",
        "varying vec3 vCol; varying float vSoft;",
        "void main(){",
        "  float r = length(gl_PointCoord - 0.5) * 2.0;",
        "  float a = smoothstep(1.0, mix(0.35, 0.0, vSoft), r);",
        "  gl_FragColor = vec4(vCol * a, 1.0);",
        "}"
      ].join("\n")
    });
    const pts = new T.Points(g, m);
    pts.frustumCulled = false;
    pts.renderOrder = 50;
    return pts;
  }
  const snow = makeSnow(COARSE ? 1500 : 3200);
  scene.add(snow);

  /* ---------- bubbles ---------- */

  const BUBBLE_MAX = 260;
  const bubbles = { n: 0, list: [] };
  const bubbleGeo = new T.BufferGeometry();
  const bubblePos = new Float32Array(BUBBLE_MAX * 3);
  const bubbleSize = new Float32Array(BUBBLE_MAX);
  bubbleGeo.setAttribute("position", new T.BufferAttribute(bubblePos, 3));
  bubbleGeo.setAttribute("aSize", new T.BufferAttribute(bubbleSize, 1));
  const bubbleMesh = new T.Points(bubbleGeo, new T.ShaderMaterial({
    uniforms: U,
    transparent: true,
    depthWrite: false,
    vertexShader: [
      GLSL_COMMON,
      "uniform float uPx; attribute float aSize; varying float vFog; varying vec3 vDirW;",
      "void main(){",
      "  vec4 mv = viewMatrix * vec4(position, 1.0);",
      "  float dist = -mv.z;",
      "  gl_PointSize = clamp(uPx * aSize / max(dist, 0.3), 0.0, 64.0);",
      "  vFog = exp(-dist * uFog);",
      "  vDirW = normalize(position - cameraPosition);",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      GLSL_COMMON,
      "varying float vFog; varying vec3 vDirW;",
      "void main(){",
      "  vec2 q = gl_PointCoord * 2.0 - 1.0; float r = length(q);",
      "  if (r > 1.0) discard;",
      "  float rim = smoothstep(0.55, 0.98, r);",
      "  float glint = smoothstep(0.34, 0.0, length(q - vec2(-0.36, -0.4)));",
      "  vec3 lit = uWaterUp * (0.7 + 1.8 * uSun) + vec3(0.7, 0.9, 1.0) * uTorch * 0.5;",
      "  vec3 col = lit * (rim * 0.9 + 0.08) + lit * glint * 2.2;",
      "  float a = (rim * 0.75 + glint * 0.9 + 0.06) * vFog;",
      "  gl_FragColor = vec4(finish(mix(waterColor(vDirW), col, vFog)), a);",
      "}"
    ].join("\n")
  }));
  bubbleMesh.frustumCulled = false;
  bubbleMesh.renderOrder = 60;
  scene.add(bubbleMesh);

  function spawnBubbles(x, y, z, n, spread, size) {
    for (let i = 0; i < n; i++) {
      if (bubbles.list.length >= BUBBLE_MAX) bubbles.list.shift();
      const s = (size || 0.09) * (0.45 + Math.random() * 0.9);
      bubbles.list.push({
        x: x + (Math.random() - 0.5) * (spread || 0.4),
        y: y + (Math.random() - 0.5) * (spread || 0.4) * 0.6,
        z: z + (Math.random() - 0.5) * (spread || 0.4),
        s: s, v: 0.7 + s * 9 + Math.random() * 0.5, ph: Math.random() * 6.3, life: 0
      });
    }
  }
  D.spawnBubbles = spawnBubbles;

  function stepBubbles(dt) {
    const list = bubbles.list;
    let w = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      b.life += dt;
      b.y += b.v * dt;
      b.x += Math.sin(b.life * 5 + b.ph) * dt * 0.35;
      b.z += Math.cos(b.life * 4.3 + b.ph) * dt * 0.25;
      if (b.y > -0.05 || b.life > 26) continue;
      list[w] = b;
      bubblePos[w * 3] = b.x; bubblePos[w * 3 + 1] = b.y; bubblePos[w * 3 + 2] = b.z;
      bubbleSize[w] = b.s * Math.min(1, b.life * 4);
      w++;
    }
    list.length = w;
    bubbleGeo.setDrawRange(0, w);
    bubbleGeo.attributes.position.needsUpdate = true;
    bubbleGeo.attributes.aSize.needsUpdate = true;
  }

  /* ---------- layout: where each section sits in the water column ---------- */

  const layoutHooks = [];
  function measure() {
    S.vw = window.innerWidth;
    S.vh = window.innerHeight;
    const cap = COARSE ? 1.5 : 2;
    S.dpr = Math.min(window.devicePixelRatio || 1, cap) * S.scale;
    renderer.setPixelRatio(S.dpr);
    renderer.setSize(S.vw, S.vh, false);
    camera.aspect = S.vw / S.vh;
    camera.fov = S.vw < S.vh ? 64 : S.vw < S.vh * 1.35 ? 56 : 50;
    camera.updateProjectionMatrix();
    U.uPx.value = (S.vh * S.dpr) / (2 * Math.tan((camera.fov * Math.PI) / 360));

    const sy = window.scrollY;
    S.maxScroll = Math.max(1, document.documentElement.scrollHeight - S.vh);
    const head = 64;
    const top = function (id) {
      const el = document.getElementById(id);
      return el ? el.getBoundingClientRect().top + sy : 0;
    };
    const about = Math.max(200, top("about") - head);
    S.anchors = [
      { s: 0, y: BANDS[0].y, m: 0 },
      { s: about * 0.42, y: 0.35, m: 0 },
      { s: about * 0.62, y: -1.6, m: 2 },
      { s: about, y: BANDS[1].y, m: BANDS[1].m },
      { s: top("publications") - head, y: BANDS[2].y, m: BANDS[2].m },
      { s: top("news") - head, y: BANDS[3].y, m: BANDS[3].m },
      { s: top("experience") - head, y: BANDS[4].y, m: BANDS[4].m },
      { s: S.maxScroll, y: BANDS[5].y, m: BANDS[5].m }
    ];
    for (let i = 1; i < S.anchors.length; i++) {
      if (S.anchors[i].s <= S.anchors[i - 1].s) S.anchors[i].s = S.anchors[i - 1].s + 1;
    }

    // Put the horizon just under the hero's last line, wherever that falls on this screen.
    const mark = document.querySelector("[data-horizon]");
    if (mark) {
      const y = clamp((mark.getBoundingClientRect().bottom + sy + 26) / S.vh, 0.5, 0.8);
      const half = Math.tan((camera.fov * Math.PI) / 360);
      S.heroPitch = Math.atan((y * 2 - 1) * half);
    }
    layoutHooks.forEach(function (fn) { fn(); });
    S.dirty = true;
  }
  D.onLayout = function (fn) { layoutHooks.push(fn); };

  function along(s, key) {
    const a = S.anchors;
    if (!a.length) return 0;
    if (s <= a[0].s) return a[0][key];
    for (let i = 1; i < a.length; i++) {
      if (s <= a[i].s) return lerp(a[i - 1][key], a[i][key], (s - a[i - 1].s) / (a[i].s - a[i - 1].s));
    }
    return a[a.length - 1][key];
  }
  // Depth in metres for a world height, used for labels on anything in the scene.
  function metresAt(y) {
    if (y >= 0) return 0;
    for (let i = 1; i < BANDS.length; i++) {
      if (y >= BANDS[i].y || i === BANDS.length - 1) {
        const a = BANDS[i - 1];
        const b = BANDS[i];
        const ay = i === 1 ? 0 : a.y;
        const am = i === 1 ? 0 : a.m;
        return lerp(am, b.m, clamp((ay - y) / (ay - b.y), 0, 1));
      }
    }
    return 4800;
  }
  D.metresAt = metresAt;
  D.scrollForY = function (y) {
    const a = S.anchors;
    for (let i = 1; i < a.length; i++) {
      if (y >= a[i].y) return lerp(a[i - 1].s, a[i].s, (a[i - 1].y - y) / (a[i - 1].y - a[i].y));
    }
    return S.maxScroll;
  };

  function waterAt(y) {
    const w = WATER;
    if (y >= w[0].y) return { a: w[0], b: w[0], t: 0 };
    for (let i = 1; i < w.length; i++) {
      if (y >= w[i].y) return { a: w[i - 1], b: w[i], t: (w[i - 1].y - y) / (w[i - 1].y - w[i].y) };
    }
    return { a: w[w.length - 1], b: w[w.length - 1], t: 0 };
  }

  /* ---------- sky and weather ---------- */

  const skyNow = { zen: new T.Vector3(), hor: new T.Vector3(), sun: new T.Vector3(), lit: new T.Vector3(), dark: new T.Vector3(), sea: new T.Vector3(), dir: new T.Vector3(), night: 0, light: 1, cloud: 0.4, wave: 1 };
  const skyGoal = { zen: new T.Vector3(), hor: new T.Vector3(), sun: new T.Vector3(), lit: new T.Vector3(), dark: new T.Vector3(), sea: new T.Vector3(), dir: new T.Vector3(), night: 0, light: 1, cloud: 0.4, wave: 1 };
  let skyInit = false;

  function aimSky() {
    const k = S.sky;
    const grey = clamp((S.cloud - 0.55) / 0.45, 0, 1);
    lin(k.zen, skyGoal.zen); lin(k.hor, skyGoal.hor); lin(k.sun, skyGoal.sun).multiplyScalar(k.power * (1 - grey * 0.55));
    lin(k.cloudLit, skyGoal.lit); lin(k.cloudDark, skyGoal.dark); lin(k.sea, skyGoal.sea);
    // Heavy cloud flattens the whole sky toward grey.
    const g = (skyGoal.zen.x + skyGoal.zen.y + skyGoal.zen.z) / 3;
    skyGoal.zen.lerp(new T.Vector3(g, g * 1.02, g * 1.06).multiplyScalar(1.5), grey * 0.75);
    skyGoal.sea.multiplyScalar(1 - grey * 0.25);
    const el = (k.el * Math.PI) / 180;
    const az = (k.az * Math.PI) / 180;
    skyGoal.dir.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
    skyGoal.night = k.night;
    skyGoal.light = k.light * (1 - grey * 0.3);
    skyGoal.cloud = S.cloud;
    skyGoal.wave = S.waveK;
    if (!skyInit) {
      skyInit = true;
      ["zen", "hor", "sun", "lit", "dark", "sea", "dir"].forEach(function (key) { skyNow[key].copy(skyGoal[key]); });
      skyNow.night = skyGoal.night; skyNow.light = skyGoal.light; skyNow.cloud = skyGoal.cloud; skyNow.wave = skyGoal.wave;
    }
    S.dirty = true;
  }

  D.setPart = function (part) {
    if (!SKIES[part]) return;
    S.part = part;
    S.sky = SKIES[part];
    aimSky();
  };
  D.setWeather = function (cloud, wave) {
    S.cloud = clamp(cloud, 0, 1);
    S.waveK = clamp(wave, 0.6, 2);
    aimSky();
  };
  D.skyTone = function () { return S.sky.tone; };

  function stepSky(dt) {
    const k = S.reduced ? 1 : 1 - Math.exp(-dt * 1.6);
    ["zen", "hor", "sun", "lit", "dark", "sea", "dir"].forEach(function (key) { skyNow[key].lerp(skyGoal[key], k); });
    skyNow.dir.normalize();
    skyNow.night = lerp(skyNow.night, skyGoal.night, k);
    skyNow.light = lerp(skyNow.light, skyGoal.light, k);
    skyNow.cloud = lerp(skyNow.cloud, skyGoal.cloud, k);
    skyNow.wave = lerp(skyNow.wave, skyGoal.wave, k);
    U.uSkyZen.value.copy(skyNow.zen);
    U.uSkyHor.value.copy(skyNow.hor);
    U.uSunCol.value.copy(skyNow.sun);
    U.uCloudLit.value.copy(skyNow.lit);
    U.uCloudDark.value.copy(skyNow.dark);
    U.uSeaBody.value.copy(skyNow.sea);
    U.uSunDir.value.copy(skyNow.dir);
    U.uNight.value = skyNow.night;
    U.uCloud.value = skyNow.cloud;
    U.uWave.value = skyNow.wave;
  }

  /* ---------- pointer: look around, and a torch for the dark ---------- */

  const ray = { origin: new T.Vector3(), dir: new T.Vector3(0, 0, -1) };
  const torchDir = new T.Vector3(0, 0, -1);
  const trail = [];
  D.ray = ray;

  function onPointer(e) {
    const p = S.pointer;
    p.cx = e.clientX; p.cy = e.clientY;
    p.x = (e.clientX / S.vw) * 2 - 1;
    p.y = -((e.clientY / S.vh) * 2 - 1);
    p.active = true;
    p.moved = S.t;
  }
  window.addEventListener("pointermove", onPointer, { passive: true });
  window.addEventListener("pointerdown", onPointer, { passive: true });
  document.addEventListener("pointerleave", function () { S.pointer.active = false; });

  function rayAt(nx, ny, out) {
    out.dir.set(nx, ny, 0.5).unproject(camera).sub(camera.position).normalize();
    out.origin.copy(camera.position);
    return out;
  }
  D.rayAt = rayAt;

  /* ---------- frame ---------- */

  const frameHooks = [];
  D.onFrame = function (fn) { frameHooks.push(fn); };
  D.scene = scene;
  D.camera = camera;
  D.renderer = renderer;

  const tmpV = new T.Vector3();
  D.project = function (v, out) {
    tmpV.copy(v).project(camera);
    out.x = (tmpV.x * 0.5 + 0.5) * S.vw;
    out.y = (-tmpV.y * 0.5 + 0.5) * S.vh;
    out.z = tmpV.z;
    out.behind = tmpV.z > 1 || tmpV.z < -1;
    return out;
  };

  let last = 0;
  let slow = 0;
  let fast = 0;
  let crossed = false;

  function frame(now) {
    requestAnimationFrame(frame);
    if (document.hidden) { last = now; return; }
    const raw = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const sy = window.scrollY;
    const moving = sy !== S.sy || S.dirty;
    if (S.reduced && !moving) return;
    const dt = S.reduced ? 0 : raw;
    S.dirty = false;
    S.sy = sy;
    S.t += dt;
    U.uTime.value = S.t;

    // Descent follows the scroll, with a little water resistance.
    S.targetY = along(sy, "y");
    S.depthM = along(sy, "m");
    S.camY = S.reduced ? S.targetY : lerp(S.camY, S.targetY, 1 - Math.exp(-raw * 7));
    const p = S.pointer;
    p.sx = lerp(p.sx, p.active ? p.x : 0, 1 - Math.exp(-raw * 3));
    p.sy = lerp(p.sy, p.active ? p.y : 0, 1 - Math.exp(-raw * 3));
    const sink = smooth(1.5, -4, S.camY);
    const nearFloor = smooth(FLOOR_Y + 22, FLOOR_Y + 3, S.camY);
    const pitch = lerp(S.heroPitch, -0.05, sink) - nearFloor * 0.075;
    camera.position.set(p.sx * 0.5, S.camY + (S.camY > 0 ? seaHeight(0, 0) * 0.25 : 0), 0);
    const breathe = S.reduced ? 0 : Math.sin(S.t * 0.35) * 0.006;
    // Free look. The view stays where it is put; it turns under the on-screen pad,
    // drifts round slowly when auto-rotation is on, and eases home when asked.
    const lk = S.look;
    if (lk.homing) {
      while (lk.yaw > Math.PI) lk.yaw -= Math.PI * 2;
      while (lk.yaw < -Math.PI) lk.yaw += Math.PI * 2;
      const back = S.reduced ? 1 : 1 - Math.exp(-raw * 3.2);
      lk.yaw = lerp(lk.yaw, 0, back);
      lk.pitch = lerp(lk.pitch, 0, back);
      if (Math.abs(lk.yaw) + Math.abs(lk.pitch) < 0.002) { lk.yaw = 0; lk.pitch = 0; lk.homing = false; }
    } else {
      if (lk.vy || lk.vp) {
        lk.yaw += lk.vy * raw;
        lk.pitch = clamp(lk.pitch + lk.vp * raw, -1.3, 1.3);
        lk.at = S.t;
      }
      // Auto-rotation: two degrees a second on its own. Leaning the pointer on the right
      // edge hurries it along; leaning on the left edge turns it back the other way.
      const SPIN = 0.0349, BOOST = 0.26;
      let target = 0;
      if (S.spin && !S.reduced && !lk.held && !S.spinHold) {
        if (S.edge > 0) target = SPIN + S.edge * BOOST;
        else if (S.edge < 0) target = S.edge * BOOST;
        else if (S.t - lk.at > 2.5) target = SPIN;
      }
      // A change of direction is never abrupt: slow to a stop, rest a moment, then set off.
      const sgn = target > 0 ? 1 : target < 0 ? -1 : 0;
      if (sgn && lk.dir && sgn !== lk.dir) {
        if (Math.abs(lk.w) > 0.004) { target = 0; lk.rest = 0.55; }
        else if (lk.rest > 0) { lk.rest -= raw; target = 0; }
        else lk.dir = sgn;
      } else if (sgn) {
        lk.dir = sgn;
      }
      lk.w = lerp(lk.w, target, 1 - Math.exp(-raw * (target === 0 ? 2.8 : 1.5)));
      if (target === 0 && Math.abs(lk.w) < 0.0005) lk.w = 0;
      if (lk.w) {
        lk.yaw -= lk.w * raw;
        lk.pitch = lerp(lk.pitch, 0, 1 - Math.exp(-raw * 0.4 * Math.min(1, Math.abs(lk.w) / SPIN)));
        S.dirty = true;
      }
    }
    const sway = lk.held ? 0 : 1;
    camera.rotation.set(clamp(pitch + lk.pitch + (p.sy * 0.028 + breathe) * sway, -1.45, 1.45), lk.yaw - p.sx * 0.045 * sway, S.camY > 0 ? Math.sin(S.t * 0.4) * 0.004 : 0);
    camera.updateMatrixWorld();
    U.uInvProj.value.copy(camera.projectionMatrixInverse);
    U.uCamWorld.value.copy(camera.matrixWorld);

    const under = camera.position.y < seaHeight(camera.position.x, 0) - 0.02;
    U.uAbove.value = under ? 0 : 1;
    if (under !== S.under) {
      S.under = under;
      if (crossed && !S.reduced) spawnBubbles(camera.position.x, -0.5, -2.4, under ? 46 : 14, 4.5, 0.11);
      crossed = true;
      if (D.onCross) D.onCross(under);
    }

    stepSky(raw);

    // Water at this depth.
    const w = waterAt(S.camY);
    const day = skyNow.light;
    U.uWaterHor.value.copy(w.a.hor).lerp(w.b.hor, w.t).multiplyScalar(0.14 + 0.86 * day);
    U.uWaterUp.value.copy(w.a.up).lerp(w.b.up, w.t).multiplyScalar(0.14 + 0.86 * day);
    U.uWaterDown.value.copy(w.a.down).lerp(w.b.down, w.t).multiplyScalar(0.14 + 0.86 * day);
    U.uFog.value = lerp(w.a.fog, w.b.fog, w.t);
    U.uSun.value = lerp(w.a.sun, w.b.sun, w.t) * day;
    U.uRay.value = lerp(w.a.ray, w.b.ray, w.t) * (0.25 + 0.75 * day) * (1 - skyNow.cloud * 0.45);
    U.uCaustic.value = lerp(w.a.caus, w.b.caus, w.t) * day;
    const torch = Math.max(lerp(w.a.torch, w.b.torch, w.t), under ? (1 - day) * 0.9 : 0);
    U.uTorch.value = under ? torch : 0;
    S.light = U.uSun.value;

    // Torch: held just off the lens, pointed wherever the pointer is.
    rayAt(p.active && !COARSE ? p.x : 0, p.active && !COARSE ? p.y : -0.15, ray);
    torchDir.lerp(ray.dir, 1 - Math.exp(-raw * 9)).normalize();
    U.uTorchDir.value.copy(torchDir);
    U.uTorchPos.value.copy(camera.position).add(tmpV.set(0.25, -0.3, 0.1));

    // A short memory of where the pointer has been, for the plankton.
    if (!trail.length || trail[0].dir.distanceToSquared(torchDir) > 0.0004) {
      trail.unshift({ dir: torchDir.clone(), t: S.t });
      if (trail.length > 6) trail.pop();
    }
    for (let i = 0; i < 6; i++) {
      const tr = trail[i];
      if (tr) U.uTrail.value[i].set(tr.dir.x, tr.dir.y, tr.dir.z, clamp(1 - (S.t - tr.t) / 2.6, 0, 1));
      else U.uTrail.value[i].set(0, 0, -1, 0);
    }
    U.uTrailFrom.value.copy(camera.position);

    S.vision = lerp(S.vision, S.visionOn ? 1 : 0, S.reduced ? 1 : 1 - Math.exp(-raw * 8));
    U.uVision.value = S.vision;

    surface.position.set(camera.position.x, 0, camera.position.z);
    surface.visible = S.camY > -34;
    snow.visible = under;
    shaftsMesh.visible = under && U.uRay.value > 0.002;
    stepBubbles(dt);

    for (let i = 0; i < frameHooks.length; i++) frameHooks[i](dt, S.t, raw);
    renderer.render(scene, camera);
    for (let i = 0; i < (D.afterHooks || []).length; i++) D.afterHooks[i](dt, S.t);

    // Keep the frame rate honest on slower machines by trading resolution.
    if (!S.reduced) {
      if (raw > 0.03) { slow++; fast = 0; } else { fast++; slow = Math.max(0, slow - 1); }
      if (slow > 45 && S.scale > 0.55) { S.scale = Math.max(0.55, S.scale - 0.15); slow = 0; measure(); }
    }
  }

  // Turn the camera by a drag of (dx, dy) pixels, as if pulling the scene around.
  D.lookBy = function (dx, dy) {
    const k = (camera.fov * Math.PI / 180) / S.vh;
    S.look.yaw += dx * k;
    S.look.pitch = clamp(S.look.pitch + dy * k, -1.3, 1.3);
    S.look.at = S.t;
    S.look.homing = false;
    S.dirty = true;
  };
  D.lookHome = function () { S.look.homing = true; S.look.vy = 0; S.look.vp = 0; S.dirty = true; };

  D.afterHooks = [];
  D.onAfter = function (fn) { D.afterHooks.push(fn); };

  D.start = function () {
    D.setPart(S.part);
    measure();
    S.camY = S.targetY = along(window.scrollY, "y");
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
    window.addEventListener("scroll", function () { S.dirty = true; }, { passive: true });
    document.addEventListener("visibilitychange", function () { S.dirty = true; });
    requestAnimationFrame(frame);
  };
  D.measure = measure;
})();
