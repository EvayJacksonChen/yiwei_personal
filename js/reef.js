/* The ground: a coral wall that falls away through the sunlit zone, and the abyssal
   floor at the end of the dive with its vent, tube worms and scattered rock. */

(function () {
  "use strict";

  const T = window.THREE;
  const D = window.DIVE;
  if (!T || !D || D.failed) return;

  const K = D.kit;
  const C = K.C, mixC = K.mixC, mulC = K.mulC, sstep = K.sstep;
  const S = D.S, U = D.U;
  const PI = Math.PI, TAU = PI * 2;
  const FLOOR_Y = D.FLOOR_Y;
  const LITE = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;

  // Repeatable randomness, so the reef is the same reef on every visit.
  let seed = 20240917;
  function rnd() { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function rand(a, b) { return a + rnd() * (b - a); }
  function pick(list) { return list[Math.floor(rnd() * list.length)]; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- the wall ---------- */

  // The reef is a horseshoe around the diver, open to the blue on one side.
  // s in [0, 1] runs along the front arm (near left, receding ahead); s in [-1, 0] runs
  // the other way from the same point, round behind the diver.
  const CTRL = [[-13, 2], [-10, -3], [-8.2, -9], [-7.2, -15], [-3, -23], [5, -31], [16, -38], [30, -44], [44, -50]];
  const CTRL_B = [[-8.2, -9], [-10, -3], [-13, 2], [-15.5, 9], [-14.5, 17], [-9, 24], [1, 27.5], [11, 25], [19, 18.5], [26, 11], [34, 6], [45, 4], [58, 5], [72, 7]];
  const INSIDE = [8, -4];
  const TOP = -8.6, BOTTOM = -104;

  function curve(s, out) {
    const C = s < 0 ? CTRL_B : CTRL;
    const n = C.length - 3;
    const f = Math.max(0, Math.min(0.9999, Math.abs(s))) * n;
    const i = Math.floor(f), t = f - i;
    const p0 = C[i], p1 = C[i + 1], p2 = C[i + 2], p3 = C[i + 3];
    const t2 = t * t, t3 = t2 * t;
    const b = function (k) {
      return 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3);
    };
    const d = function (k) {
      return 0.5 * ((-p0[k] + p2[k]) + 2 * (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t + 3 * (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t2);
    };
    out.x = b(0); out.z = b(1);
    const tx = d(0), tz = d(1), l = Math.hypot(tx, tz) || 1;
    // the face of the wall looks in, toward the open water the diver hangs in
    out.nx = -tz / l; out.nz = tx / l;
    if (out.nx * (INSIDE[0] - out.x) + out.nz * (INSIDE[1] - out.z) < 0) { out.nx = -out.nx; out.nz = -out.nz; }
    return out;
  }

  const cv = { x: 0, z: 0, nx: 0, nz: 0 };
  // q in [-1, 0): the reef flat, from its back edge to the crest. q in [0, 1]: down the face.
  function surf(s, q, out) {
    curve(s, cv);
    if (q < 0) {
      const back = -q;
      const o = -back * 17 + (1 - back) * 1.2;
      const y = TOP + 0.9 - back * 0.9 + (K.fbm(s * 23 + 4, back * 6) - 0.5) * 1.1 - sstep(0.75, 1, 1 + q) * 0.9;
      return out.set(cv.x + cv.nx * o, y, cv.z + cv.nz * o);
    }
    const y = lerp(TOP, BOTTOM, q);
    const lean = 1.2 + 1.7 * Math.pow(q, 0.8);
    const rough = (K.fbm(s * 11 + 1.3, y * 0.16) - 0.5) * 3.2 + (K.fbm(s * 37, y * 0.55 + 7) - 0.5) * 1.0;
    const o = lean + rough;
    return out.set(cv.x + cv.nx * o, y, cv.z + cv.nz * o);
  }
  const sA = new T.Vector3(), sB = new T.Vector3(), sC = new T.Vector3();
  function surfNormal(s, q, out) {
    surf(s, q, sA); surf(s + 0.004, q, sB); surf(s, q + 0.004, sC);
    out.crossVectors(sB.sub(sA), sC.sub(sA)).normalize();
    // the face looks out into open water; the flat looks up
    curve(s, cv);
    if (q >= 0 && out.x * cv.nx + out.z * cv.nz < 0) out.negate();
    if (q < 0 && out.y < 0) out.negate();
    return out;
  }
  // A point on the wall's face at a given depth, pushed off it by `lift`.
  D.wallAt = function (s, y, lift, out) {
    const q = (TOP - y) / (TOP - BOTTOM);
    surf(s, q, out);
    surfNormal(s, q, sC);
    return out.addScaledVector(sC, lift || 0);
  };

  function buildWall(dir, NS) {
    const NP = 10, NW = 96;
    const P = new K.Piece();
    const rock = C("#7d7a70"), rockDark = C("#3b3b3a"), pink = C("#8d6f7c"), turf = C("#667050"), deep = C("#2b2f33"), sand = C("#a9a28c");
    const v = new T.Vector3();
    const rows = [];
    for (let j = 0; j <= NP; j++) rows.push(-1 + j / NP);
    rows[NP] = -0.001;
    for (let j = 0; j <= NW; j++) rows.push(Math.pow(j / NW, 1.35));
    for (let r = 0; r < rows.length; r++) {
      const q = rows[r];
      for (let i = 0; i <= NS; i++) {
        const s = (i / NS) * dir;
        surf(s, q, v);
        // broad, slow colour only: fine grain comes from the shader
        const n1 = K.fbm(s * 13 + 2, v.y * 0.13 + q * 4), n2 = K.fbm(s * 21 + 9, v.y * 0.21 + q * 6), n3 = K.noise(s * 9 + 31, v.y * 0.09 + q * 3);
        let col = mixC(rockDark, rock, sstep(0.25, 0.75, n1));
        if (q < 0) col = mixC(col, sand, sstep(0.4, 0.7, n3) * 0.7);
        col = mixC(col, turf, sstep(0.5, 0.75, n2) * sstep(-30, -9, v.y) * 0.4);
        col = mixC(col, pink, sstep(0.6, 0.8, n3) * 0.3);
        col = mixC(col, deep, sstep(-40, -62, v.y) * 0.85);
        P.v(v.x, v.y, v.z, mulC(col, 0.7));
      }
    }
    const W = NS + 1;
    for (let r = 0; r < rows.length - 1; r++) {
      for (let i = 0; i < NS; i++) {
        const a = r * W + i, b = a + 1, c = a + W, d = c + 1;
        P.idx.push(a, c, b, b, c, d);
      }
    }
    const wall = K.mesh([P], K.matter({ sheen: 0.04, grain: 1, maskK: 0 }));
    D.scene.add(wall);
    D.onFrame(function () { wall.visible = S.under && S.camY > BOTTOM - 26; });
  }
  buildWall(1, 160);
  buildWall(-1, 150);

  /* ---------- corals ---------- */

  function staghorn() {
    const out = [];
    const base = C("#b9b2a2"), tipC = C("#f4f1e6");
    const grow = function (p, dir, len, r, depth) {
      const q = [p[0] + dir[0] * len, p[1] + dir[1] * len, p[2] + dir[2] * len];
      const mid = [p[0] + dir[0] * len * 0.5 + rand(-0.03, 0.03), p[1] + dir[1] * len * 0.5, p[2] + dir[2] * len * 0.5 + rand(-0.03, 0.03)];
      out.push(K.sweep([p, mid, q], function (u) { const k = lerp(r, r * 0.62, u); return [k, k]; }, function (u) { return depth === 0 ? mixC(base, tipC, u) : base; }, { sides: 4, cap: depth === 0 }));
      if (depth > 0) {
        const kids = depth > 1 ? 2 : (rnd() < 0.5 ? 2 : 1);
        for (let k = 0; k < kids; k++) {
          const d = [dir[0] + rand(-0.6, 0.6), dir[1] + rand(0.1, 0.5), dir[2] + rand(-0.6, 0.6)];
          const l = Math.hypot(d[0], d[1], d[2]);
          grow(q, [d[0] / l, d[1] / l, d[2] / l], len * rand(0.62, 0.85), r * 0.62, depth - 1);
        }
      }
    };
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU + rand(-0.3, 0.3), tilt = rand(0.25, 0.75);
      const d = [Math.cos(a) * tilt, 1, Math.sin(a) * tilt], l = Math.hypot(d[0], d[1], d[2]);
      grow([Math.cos(a) * 0.05, 0, Math.sin(a) * 0.05], [d[0] / l, d[1] / l, d[2] / l], rand(0.28, 0.42), 0.045, 2);
    }
    return out;
  }

  function table() {
    const body = C("#8f8a7c"), rim = C("#cfcab9"), shade = C("#4a4740");
    return [K.lathe([[0.06, -0.05], [0.08, 0.2], [0.26, 0.31], [0.7, 0.365], [0.84, 0.395], [0.86, 0.41], [0.8, 0.425], [0.5, 0.42], [0.2, 0.415], [0.001, 0.41]],
      function (v, a) { return v < 0.36 ? shade : mixC(body, rim, sstep(0.4, 0.62, v) * (0.35 + 0.65 * K.noise(a * 9, v * 14))); },
      { seg: 24, scallop: function (a, v) { return v > 0.25 ? 1 + 0.1 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 11) + 0.03 * Math.sin(a * 23) : 1; } })];
  }

  function massive() {
    const a1 = C("#6f6a5c"), a2 = C("#aaa493");
    return [K.blob(0.5, 0.36, 0.5, function (nx, ny, nz) {
      const m = Math.sin(nx * 22 + K.noise(nx * 5, nz * 5) * 7) * Math.sin(nz * 22 + K.noise(nz * 5 + 3, ny * 5) * 7);
      return mixC(a1, a2, sstep(-0.25, 0.35, m));
    }, { lat: 14, lon: 20, flat: 0.25, bump: function (nx, ny, nz) { return (K.fbm(nx * 2.2 + 5, nz * 2.2 + ny) - 0.5) * 0.3 + (K.noise(nx * 9, nz * 9 + ny * 6) - 0.5) * 0.06; } })];
  }

  function fan() {
    const out = [];
    const body = C("#c9c2b6");
    const grow = function (x, y, ang, len, r, depth) {
      const x2 = x + Math.sin(ang) * len, y2 = y + Math.cos(ang) * len;
      out.push(K.sweep([[x, y, 0], [(x + x2) / 2 + rand(-0.01, 0.01), (y + y2) / 2, rand(-0.012, 0.012)], [x2, y2, 0]], function (u) { const k = lerp(r, r * 0.7, u); return [k, k]; }, body, { sides: 4, cap: depth === 0, up: [0, 0, 1] }));
      if (depth > 0) {
        grow(x2, y2, ang - rand(0.28, 0.5), len * rand(0.68, 0.85), r * 0.7, depth - 1);
        grow(x2, y2, ang + rand(0.28, 0.5), len * rand(0.68, 0.85), r * 0.7, depth - 1);
        if (depth > 2 && rnd() < 0.5) grow(x2, y2, ang + rand(-0.12, 0.12), len * 0.8, r * 0.7, depth - 1);
      }
    };
    grow(0, -0.05, 0, 0.26, 0.024, 4);
    return out;
  }

  function sponge() {
    const a1 = C("#8d8377"), a2 = C("#c7bdaf");
    return [K.lathe([[0.16, -0.05], [0.28, 0.18], [0.36, 0.48], [0.33, 0.74], [0.27, 0.82], [0.22, 0.74], [0.2, 0.45], [0.13, 0.25], [0.001, 0.2]],
      function (v, a) { return mixC(a1, a2, (0.5 + 0.5 * Math.cos(a * 14)) * (v < 0.5 ? 1 : 0.3)); },
      { seg: 28, scallop: function (a, v) { return v < 0.5 ? 1 + 0.06 * Math.cos(a * 14) : 1; } })];
  }

  function whips() {
    const out = [];
    const body = C("#d6cfc2");
    for (let k = 0; k < 6; k++) {
      const a = rand(0, TAU), lean = rand(0.1, 0.45), h = rand(0.9, 1.7);
      const pts = [];
      for (let i = 0; i <= 5; i++) { const u = i / 5; pts.push([Math.cos(a) * lean * u * u * h, u * h, Math.sin(a) * lean * u * u * h]); }
      out.push(K.sweep(pts, function (u) { const r = lerp(0.02, 0.008, u); return [r, r]; }, body, { sides: 4 }));
    }
    return out;
  }

  function softTree() {
    const out = [];
    const stem = C("#e9e2d6"), puff = C("#cfc6c0");
    out.push(K.sweep([[0, -0.05, 0], [0.02, 0.25, 0.01], [0, 0.5, 0]], function (u) { const r = lerp(0.07, 0.04, u); return [r, r]; }, stem, { sides: 6 }));
    for (let k = 0; k < 9; k++) {
      const a = rand(0, TAU), y = rand(0.22, 0.72), r = rand(0.1, 0.3) * (1 - (y - 0.22) * 0.7);
      out.push(K.rod([0, y - 0.08, 0], [Math.cos(a) * r, y, Math.sin(a) * r], 0.025, 0.018, stem, 4));
      out.push(K.blob(rand(0.07, 0.11), rand(0.07, 0.1), rand(0.07, 0.11), puff, { lat: 6, lon: 8, bump: function (nx, ny, nz) { return (K.noise(nx * 5 + k, nz * 5 + ny * 3) - 0.5) * 0.5; } }).at(Math.cos(a) * r, y + 0.03, Math.sin(a) * r));
    }
    return out;
  }

  // Things a detector would call out on the reef and the floor (drawn in Vision mode).
  const detectables = [];
  D.detectables = detectables;

  const KINDS = [
    { make: staghorn, label: "Staghorn coral", n: 84, size: [1.0, 2.1], band: [-0.8, 0.3], sway: 0, tints: ["#c9a66b", "#8fa3d9", "#d9c27a", "#b98f7a", "#9c8fd0", "#7fb39a"] },
    { make: table, grain: 1, label: "Table coral", n: 40, size: [1.0, 2.3], band: [-0.7, 0.2], sway: 0, tints: ["#8f9a6a", "#b0996b", "#7d8f8a", "#a58a6f"] },
    { make: massive, grain: 0.9, label: "Brain coral", n: 64, size: [0.7, 2.2], band: [-0.9, 0.4], sway: 0, tints: ["#a89a4f", "#8d7fb0", "#7f9460", "#c2a15a", "#9a8c7a"] },
    { make: fan, label: "Sea fan", n: 54, size: [1.2, 2.8], band: [0.02, 0.42], sway: 0.022, tints: ["#c0392b", "#e0662a", "#8e44ad", "#d94f70", "#e8a23a"] },
    { make: sponge, grain: 0.8, label: "Barrel sponge", n: 22, size: [0.7, 1.6], band: [0.0, 0.46], sway: 0, tints: ["#7a3b2e", "#8a5a44", "#5b3a52", "#93603a"] },
    { make: whips, label: "Sea whip", n: 40, size: [0.9, 1.8], band: [0.08, 0.62], sway: 0.05, tints: ["#e0662a", "#e8e0d0", "#c0392b", "#d9b23a"] },
    { make: softTree, label: "Soft coral", n: 48, size: [0.7, 1.6], band: [0.03, 0.4], sway: 0.015, tints: ["#e56aa8", "#f08a4b", "#b06ad9", "#f2b8d0", "#e2536b"] }
  ];

  (function plantReef() {
    const pos = new T.Vector3(), nor = new T.Vector3(), up = new T.Vector3(0, 1, 0), grow = new T.Vector3();
    const qa = new T.Quaternion(), qb = new T.Quaternion(), m = new T.Matrix4(), sc = new T.Vector3();
    const groups = [];
    KINDS.forEach(function (kind) {
      // a few shapes of each kind, so no two neighbours are twins
      const variants = kind.make === table || kind.make === sponge ? 1 : 3;
      for (let vi = 0; vi < variants; vi++) {
        const count = Math.ceil(kind.n * (LITE ? 0.5 : 1.05) / variants);
        const geo = K.build(kind.make());
        const mat = K.matter({ mode: kind.sway ? 5 : 0, amp: kind.sway, freq: 0.9, len: 1, sheen: 0.06, grain: kind.grain || 0, mask: "#8ce99a" });
        const im = new T.InstancedMesh(geo, mat, count);
        const inst = new Float32Array(count * 4);
        for (let i = 0; i < count; i++) {
          const q = rand(kind.band[0], kind.band[1]);
          // crowd the part of the wall the camera actually passes
          const s = rnd() < 0.6 ? Math.pow(rnd(), 0.7) * 0.6 + 0.06 : -(Math.pow(rnd(), 1.25) * 0.8 + 0.03);
          surf(s, q, pos);
          surfNormal(s, q, nor);
          grow.copy(nor).multiplyScalar(0.75).addScaledVector(up, 0.7).normalize();
          qa.setFromUnitVectors(up, grow);
          qb.setFromAxisAngle(up, rand(0, TAU));
          qa.multiply(qb);
          const size = rand(kind.size[0], kind.size[1]);
          sc.set(size, size * rand(0.85, 1.15), size);
          pos.addScaledVector(nor, -0.06);
          m.compose(pos, qa, sc);
          im.setMatrixAt(i, m);
          if (i % 3 === 0) detectables.push({ pos: pos.clone().addScaledVector(grow, size * 0.42), r: size * 0.6, k: 0.85, label: kind.label, conf: rand(0.82, 0.96), col: "#8ce99a" });
          const t = C(pick(kind.tints));
          const k = rand(0.85, 1.25);
          inst[i * 4] = rand(0, TAU); inst[i * 4 + 1] = t[0] * k * 1.5; inst[i * 4 + 2] = t[1] * k * 1.5; inst[i * 4 + 3] = t[2] * k * 1.5;
        }
        geo.setAttribute("aInst", new T.InstancedBufferAttribute(inst, 4));
        im.frustumCulled = false;
        D.scene.add(im);
        groups.push(im);
      }
    });
    D.onFrame(function () {
      const on = S.under && S.camY > -76;
      for (let i = 0; i < groups.length; i++) groups[i].visible = on;
    });
  })();

  /* ---------- above the surface: islands on the horizon, and the boat we dived from ---------- */

  (function () {
    const green = C("#55703f"), green2 = C("#7a8f52"), rock = C("#8b8474"), sand = C("#cdbf9a");
    const lands = [[-1050, 520, 260, 95, 190, 1], [260, 1350, 420, 130, 240, 2], [1250, 380, 230, 80, 300, 3], [-1700, -980, 300, 110, 220, 4], [-420, 1500, 160, 55, 130, 5], [1500, -1300, 200, 70, 160, 6]];
    const pieces = lands.map(function (l) {
      return K.blob(l[2], l[3], l[4], function (nx, ny, nz) {
        const n = K.fbm(nx * 4 + l[5], nz * 4 + ny * 3);
        return ny < 0.12 ? mixC(sand, rock, n) : mixC(mixC(green, green2, n), rock, sstep(0.62, 0.8, K.noise(nx * 9 + l[5], nz * 9)) * 0.6);
      }, { lat: 14, lon: 26, flat: 0.1, bump: function (nx, ny, nz) { return (K.fbm(nx * 2.3 + l[5] * 3, nz * 2.3) - 0.45) * 0.9 * Math.max(ny, 0) + (K.fbm(nx * 6 + l[5], nz * 6) - 0.5) * 0.18; } }).at(l[0], -l[3] * 0.06, l[1]);
    });
    const land = K.mesh(pieces, K.matter({ maskK: 0 }));
    D.scene.add(land);

    // a small dive boat riding at anchor over the reef
    const white = C("#eef0ec"), navy = C("#16324a"), red = C("#8c2f25"), deckC = C("#b9a47e"), dark = C("#14181c"), steel = C("#9aa3a8");
    const P = new K.Piece();
    const xs = [4.7, 4.3, 3.4, 1.8, -0.6, -3.0, -4.2, -4.5];
    const hw = [0.03, 0.5, 1.0, 1.38, 1.45, 1.38, 1.25, 1.15];
    const prof = [[1, 0.95, white], [1.02, 0.5, white], [0.98, 0.12, navy], [0.9, -0.08, red], [0.55, -0.42, red], [0, -0.55, red]];
    xs.forEach(function (x, i) {
      const lift = 0.35 * Math.pow(Math.max(0, (x - 2) / 2.7), 2);
      for (let k = 0; k < prof.length * 2 - 1; k++) {
        const j = k < prof.length ? k : prof.length * 2 - 2 - k;
        const side = k < prof.length ? 1 : -1;
        P.v(x, prof[j][1] * (i === 0 ? 0.6 : 1) + lift + (j >= 4 ? lift * 0.8 : 0), side * hw[i] * prof[j][0], prof[j][2]);
      }
    });
    const ring = prof.length * 2 - 1;
    for (let i = 0; i < xs.length - 1; i++) for (let k = 0; k < ring - 1; k++) { const a = i * ring + k, b = a + 1, c = a + ring, d = c + 1; P.idx.push(a, c, b, b, c, d); }
    const boatPieces = [P,
      K.plate(xs.map(function (x, i) { return [x, hw[i] * 0.98]; }).concat(xs.slice().reverse().map(function (x, i) { return [x, -hw[xs.length - 1 - i] * 0.98]; })), deckC, "xz", { hub: [0, 0] }).at(0, 0.9, 0),
      K.box(0.12, 1.5, 2.6, white).at(-4.48, 0.3, 0),
      // wheelhouse, windows, roof
      K.box(2.3, 1.15, 2.0, white).at(1.3, 1.5, 0), K.box(2.34, 0.42, 2.04, dark).at(1.3, 1.68, 0), K.box(2.9, 0.09, 2.4, white).at(1.1, 2.12, 0),
      // mast with the diver-down flag
      K.rod([0.6, 2.1, 0], [0.6, 3.9, 0], 0.035, 0.025, steel, 6),
      K.plate([[0, 0], [0.75, 0], [0.75, 0.5], [0, 0.5]], function (a, b) { return Math.abs(a / 0.75 - (1 - b / 0.5)) < 0.22 ? white : C("#c8261c"); }, "xy", { hub: [0.375, 0.25] }).at(0.63, 3.3, 0),
      // tank rack and ladder at the stern
      K.rod([-3.9, 0.9, 1.2], [-3.9, 1.7, 1.2], 0.03, 0.03, steel, 5), K.rod([-3.9, 0.9, -1.2], [-3.9, 1.7, -1.2], 0.03, 0.03, steel, 5), K.rod([-3.9, 1.7, 1.2], [-3.9, 1.7, -1.2], 0.03, 0.03, steel, 5),
      K.rod([-4.6, 1.2, 0.45], [-4.75, -0.9, 0.45], 0.025, 0.025, steel, 5), K.rod([-4.6, 1.2, -0.45], [-4.75, -0.9, -0.45], 0.025, 0.025, steel, 5)
    ];
    for (let k = 0; k < 5; k++) boatPieces.push(K.sweep([[-3.3, 0.92, -0.9 + k * 0.45], [-3.3, 1.55, -0.9 + k * 0.45]], function () { return [0.09, 0.09]; }, k % 2 ? C("#d9c341") : C("#c9d0d4"), { sides: 8, up: [1, 0, 0] }));
    for (let k = 0; k < 3; k++) boatPieces.push(K.rod([-4.67, 0.3 - k * 0.45, 0.45], [-4.67, 0.3 - k * 0.45, -0.45], 0.02, 0.02, steel, 4));
    const boat = K.mesh(boatPieces, K.matter({ sheen: 0.35, mask: "#ffd8a8" }));
    boat.rotation.order = "YXZ";
    D.scene.add(boat);
    // anchor line, from the bow down to the reef crest
    const bx = -5.5, bz = 12.5;
    const hook = D.wallAt(-0.3, TOP - 0.4, 0.3, new T.Vector3());
    const line = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; line.push([lerp(bx + 3.6, hook.x, u), lerp(0.6, hook.y, u) - Math.sin(u * PI) * 1.4, lerp(bz - 2.6, hook.z, u)]); }
    const rope = K.mesh([K.sweep(line, function () { return [0.022, 0.022]; }, C("#c9c2ae"), { sides: 5 })], K.matter({ maskK: 0 }));
    D.scene.add(rope);
    detectables.push({ pos: new T.Vector3(bx, -0.2, bz), r: 4.6, k: 0.3, label: "Dive boat", conf: 0.97, col: "#ffd8a8" });
    D.onFrame(function (dt, t) {
      land.visible = !S.under;
      boat.visible = S.camY > -40;
      rope.visible = S.camY > -30;
      if (!boat.visible) return;
      const h = D.seaHeight(bx, bz);
      boat.position.set(bx, h + 0.05, bz);
      boat.rotation.set((D.seaHeight(bx, bz + 1.2) - D.seaHeight(bx, bz - 1.2)) * 0.35, 0.72 + Math.sin(t * 0.07) * 0.06, (D.seaHeight(bx + 3, bz) - D.seaHeight(bx - 3, bz)) * 0.12);
    });
  })();

  /* ---------- the abyssal floor ---------- */

  const VENT = { x: -7.5, z: -17.5 };
  function floorAt(x, z) {
    const mound = Math.exp(-((x - VENT.x) * (x - VENT.x) + (z - VENT.z) * (z - VENT.z)) / 30) * 1.3;
    return FLOOR_Y + (K.fbm(x * 0.05 + 3, z * 0.05) - 0.5) * 2.2 + (K.fbm(x * 0.22, z * 0.22 + 8) - 0.5) * 0.45 + mound - Math.max(0, -z - 30) * 0.02;
  }
  D.floorAt = floorAt;

  const deepThings = [];
  (function buildFloor() {
    const P = new K.Piece();
    const nx = 140, nz = 150, x0 = -70, x1 = 70, z0 = 74, z1 = -86;
    const mud = C("#7c776b"), mud2 = C("#575349"), ooze = C("#9a9484"), rust = C("#8a4a22");
    for (let j = 0; j <= nz; j++) {
      for (let i = 0; i <= nx; i++) {
        const x = lerp(x0, x1, i / nx), z = lerp(z0, z1, j / nz);
        const n = K.fbm(x * 0.3, z * 0.3), rip = 0.5 + 0.5 * Math.sin(x * 3.1 + K.noise(x * 0.4, z * 0.4) * 6 + z * 0.8);
        let col = mixC(mud2, mud, n);
        col = mixC(col, ooze, rip * 0.25);
        const dv = Math.hypot(x - VENT.x, z - VENT.z);
        col = mixC(col, rust, sstep(7, 1.5, dv) * 0.6);
        P.v(x, floorAt(x, z) + (rip - 0.5) * 0.03, z, col);
      }
    }
    const W = nx + 1;
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * W + i, b = a + 1, c = a + W, d = c + 1; P.idx.push(a, b, c, b, d, c); }
    const floor = K.mesh([P], K.matter({ sheen: 0.03, grain: 0.8, maskK: 0 }));
    D.scene.add(floor);
    deepThings.push(floor);

    // rock and nodules
    const basalt = C("#2c2d31"), basalt2 = C("#55545a");
    const rockGeo = K.build([K.blob(0.5, 0.36, 0.45, function (ax, ay, az) { return mixC(basalt, basalt2, K.fbm(ax * 3 + 1, az * 3 + ay * 2)); }, { lat: 8, lon: 11, flat: 0.5, bump: function (ax, ay, az) { return (K.fbm(ax * 2.4 + 7, az * 2.4 + ay * 3) - 0.5) * 0.7; } })]);
    rockGeo.setAttribute("aInst", new T.InstancedBufferAttribute(new Float32Array(190 * 4), 4));
    const rocks = new T.InstancedMesh(rockGeo, K.matter({ sheen: 0.1, grain: 1, maskK: 0 }), 190);
    const o = new T.Object3D();
    for (let i = 0; i < 190; i++) {
      const small = i > 56;
      const x = rand(-38, 38), z = small ? rand(18, -30) : rand(40, -55);
      const s = small ? rand(0.08, 0.22) : rand(0.4, 2.3);
      o.position.set(x, floorAt(x, z) + s * 0.05, z);
      o.rotation.set(rand(-0.3, 0.3), rand(0, TAU), rand(-0.3, 0.3));
      o.scale.set(s * rand(0.8, 1.4), s * rand(0.6, 1.1), s * rand(0.8, 1.3));
      o.updateMatrix();
      rocks.setMatrixAt(i, o.matrix);
    }
    rocks.frustumCulled = false;
    D.scene.add(rocks);
    deepThings.push(rocks);

    // the vent: mineral chimneys with warm water pouring out
    const stone = C("#2a2622"), sulf = C("#b08a2e"), ox = C("#7a3f1c");
    const chimney = function (h, r, x, z, lean) {
      const prof = [];
      for (let i = 0; i <= 9; i++) { const u = i / 9; prof.push([r * (1 - u * 0.78) * (1 + 0.16 * Math.sin(u * 17 + x)), u * h]); }
      prof.push([r * 0.12, h * 0.98]);
      return K.lathe(prof, function (v, a) { const n = K.fbm(a * 2 + x, v * 9); return mixC(mixC(stone, ox, sstep(0.45, 0.75, n)), sulf, sstep(0.72, 0.86, K.noise(a * 5, v * 22 + z)) * (0.3 + v * 0.7)); },
        { seg: 14, scallop: function (a, v) { return 1 + 0.14 * Math.sin(a * 3 + v * 7 + x) + 0.08 * Math.sin(a * 7 - v * 11); } }).at(x, floorAt(x, z) - 0.2, z, lean, 0, lean * 0.6);
    };
    const tops = [[VENT.x, VENT.z, 5.4, 1.15, 0.04], [VENT.x + 1.7, VENT.z + 0.7, 3.1, 0.75, -0.08], [VENT.x - 1.4, VENT.z + 1.2, 2.2, 0.6, 0.1]];
    const vent = K.mesh(tops.map(function (t) { return chimney(t[2], t[3], t[0], t[1], t[4]); }), K.matter({ sheen: 0.12, grain: 1, mask: "#ff922b" }));
    D.scene.add(vent);
    deepThings.push(vent);
    detectables.push({ pos: new T.Vector3(VENT.x, floorAt(VENT.x, VENT.z) + 2.6, VENT.z), r: 2.1, k: 1.4, label: "Hydrothermal vent", conf: 0.93, col: "#ff922b" });
    detectables.push({ pos: new T.Vector3(VENT.x + 1.2, floorAt(VENT.x, VENT.z) + 0.5, VENT.z + 2.6), r: 1.5, k: 0.5, label: "Giant tube worms", conf: 0.9, col: "#ff8787" });

    // a whale fall, behind the diver: a skeleton that feeds the floor for decades
    (function () {
      const bone = C("#cfc8b2"), bone2 = C("#8f8a78");
      const tint = function (u, ang, i, sa) { return mixC(bone2, bone, 0.4 + 0.6 * K.noise(u * 14 + i, sa * 3)); };
      const wf = [];
      // skull and jaws
      wf.push(K.sweep([[3.4, 0.25, 0], [2.6, 0.42, 0], [1.6, 0.6, 0], [0.9, 0.62, 0], [0.5, 0.5, 0]], function (u, i) { return [[0.07, 0.16, 0.3, 0.36, 0.26][i], [0.1, 0.3, 0.55, 0.62, 0.4][i]]; }, tint, { sides: 10 }));
      [-1, 1].forEach(function (sd) { wf.push(K.sweep([[3.3, 0.08, sd * 0.1], [2.2, 0.1, sd * 0.5], [0.9, 0.16, sd * 0.62]], function () { return [0.07, 0.06]; }, tint, { sides: 6 })); });
      // spine and ribs
      for (let i = 0; i < 26; i++) {
        const x = 0.35 - i * 0.36, r = 0.19 * (1 - i / 34);
        wf.push(K.blob(0.15, r, r, bone, { lat: 5, lon: 7 }).at(x, 0.32 - i * 0.008, 0));
        wf.push(K.rod([x, 0.35, 0], [x - 0.05, 0.6 - i * 0.012, 0], 0.035, 0.012, bone, 4));
        if (i > 0 && i < 13) {
          const span = 0.95 - Math.abs(i - 5) * 0.045, fall = i % 4 === 3 ? 0.55 : 1;
          [-1, 1].forEach(function (sd) {
            wf.push(K.sweep([[x, 0.36, sd * 0.12], [x - 0.04, 0.62 * fall, sd * span * 0.75], [x - 0.08, 0.3 * fall, sd * span], [x - 0.1, -0.05, sd * span * 0.86]], function (u) { const k = lerp(0.045, 0.02, u); return [k, k]; }, tint, { sides: 5 }));
          });
        }
      }
      const fx = 3, fz = 11;
      const whale = K.mesh(wf, K.matter({ sheen: 0.1, grain: 0.5, mask: "#f1f3f5" }));
      whale.position.set(fx, floorAt(fx, fz) + 0.05, fz);
      whale.rotation.set(0.03, 2.5, -0.04);
      D.scene.add(whale);
      deepThings.push(whale);
      detectables.push({ pos: new T.Vector3(fx + 2.5, floorAt(fx, fz) + 0.5, fz + 2), r: 4.2, k: 0.3, label: "Whale fall", conf: 0.91, col: "#f1f3f5" });
    })();

    // giant tube worms crowd the warm rock
    const tube = C("#e6e1d4"), plume = C("#b5261b");
    const worm = [
      K.sweep([[0, -0.1, 0], [0.02, 0.3, 0.01], [0.05, 0.62, 0.02], [0.06, 0.9, 0.02]], function () { return [0.036, 0.036]; }, function (u) { return mixC(mulC(tube, 0.7), tube, u); }, { sides: 6 }),
      K.blob(0.034, 0.09, 0.034, plume, { lat: 5, lon: 7 }).at(0.062, 0.98, 0.02)
    ];
    const wormGeo = K.build(worm);
    const NWORM = 84;
    const worms = new T.InstancedMesh(wormGeo, K.matter({ mode: 5, amp: 0.035, freq: 1.3, len: 1, sheen: 0.2, mask: "#ff8787" }), NWORM);
    const inst = new Float32Array(NWORM * 4);
    for (let i = 0; i < NWORM; i++) {
      const a = rand(0, TAU), r = rand(1.0, 3.4) * (i % 3 ? 1 : 0.8);
      const x = VENT.x + Math.cos(a) * r * 1.2, z = VENT.z + 0.8 + Math.sin(a) * r * 0.8;
      const s = rand(0.6, 1.5);
      o.position.set(x, floorAt(x, z), z);
      o.rotation.set(rand(-0.25, 0.25), rand(0, TAU), rand(-0.25, 0.25));
      o.scale.set(s, s * rand(0.8, 1.3), s);
      o.updateMatrix();
      worms.setMatrixAt(i, o.matrix);
      inst[i * 4] = rand(0, TAU);
    }
    wormGeo.setAttribute("aInst", new T.InstancedBufferAttribute(inst, 4));
    worms.frustumCulled = false;
    D.scene.add(worms);
    deepThings.push(worms);

    // the plume itself
    const N = 90;
    const pg = new T.BufferGeometry();
    const pp = new Float32Array(N * 3), pa = new Float32Array(N * 2);
    pg.setAttribute("position", new T.BufferAttribute(pp, 3));
    pg.setAttribute("aLife", new T.BufferAttribute(pa, 2));
    const smoke = new T.Points(pg, new T.ShaderMaterial({
      uniforms: U, transparent: true, depthWrite: false,
      vertexShader: [
        D.GLSL_COMMON,
        "uniform float uPx; attribute vec2 aLife; varying float vA; varying vec3 vLit;",
        "void main(){",
        "  vec4 mv = viewMatrix * vec4(position, 1.0);",
        "  float dist = -mv.z;",
        "  gl_PointSize = clamp(uPx * (0.5 + aLife.x * 2.6) / max(dist, 0.5), 0.0, 220.0);",
        "  vA = sin(min(aLife.x * 3.2, 3.14159)) * 0.8 * exp(-dist * uFog * 0.8);",
        "  vec3 tl = position - uTorchPos; float td = length(tl); tl /= max(td, 0.001);",
        "  float cone = smoothstep(0.86, 0.975, dot(tl, uTorchDir));",
        "  vLit = vec3(0.004, 0.005, 0.006) + vec3(0.16, 0.15, 0.14) * cone * uTorch / (1.0 + td * td * 0.01);",
        "  vec3 ld = uLightPos[0].xyz - position; vLit += uLightCol[0] * 0.06 / (1.0 + dot(ld, ld) * uLightPos[0].w);",
        "  vLit += vec3(0.5, 0.16, 0.04) * (1.0 - aLife.x) * (1.0 - aLife.x) * 0.5;",
        "  gl_Position = projectionMatrix * mv;",
        "}"
      ].join("\n"),
      fragmentShader: [
        D.GLSL_COMMON,
        "varying float vA; varying vec3 vLit;",
        "void main(){",
        "  float r = length(gl_PointCoord - 0.5) * 2.0;",
        "  float a = smoothstep(1.0, 0.1, r) * vA;",
        "  gl_FragColor = vec4(finish(vLit), a);",
        "}"
      ].join("\n")
    }));
    smoke.frustumCulled = false;
    smoke.renderOrder = 45;
    D.scene.add(smoke);
    deepThings.push(smoke);
    const parts = [];
    for (let i = 0; i < N; i++) parts.push({ life: rnd(), top: tops[i % 5 === 0 ? 1 : i % 7 === 0 ? 2 : 0], sx: rand(-1, 1), sz: rand(-1, 1), k: rand(0.7, 1.3) });
    D.onFrame(function (dt, t) {
      const on = S.camY < FLOOR_Y + 40;
      for (let i = 0; i < deepThings.length; i++) deepThings[i].visible = on;
      if (!on) { U.uLightCol.value[2].set(0, 0, 0); return; }
      for (let i = 0; i < N; i++) {
        const p = parts[i];
        p.life += dt * 0.085 * p.k;
        if (p.life > 1) p.life -= 1;
        const u = p.life, top = p.top;
        const y0 = floorAt(top[0], top[1]) + top[2] - 0.25;
        pp[i * 3] = top[0] + p.sx * u * 1.6 + Math.sin(t * 0.4 + i) * u * 0.5 + u * u * 2.2;
        pp[i * 3 + 1] = y0 + u * 9.5 * p.k;
        pp[i * 3 + 2] = top[1] + p.sz * u * 1.2 + Math.cos(t * 0.33 + i * 1.7) * u * 0.4;
        pa[i * 2] = u;
      }
      pg.attributes.position.needsUpdate = true;
      pg.attributes.aLife.needsUpdate = true;
      const y = floorAt(VENT.x, VENT.z) + 5.2;
      U.uLightPos.value[2].set(VENT.x, y, VENT.z, 0.5);
      U.uLightCol.value[2].set(1.0, 0.36, 0.1).multiplyScalar(0.55 + 0.12 * Math.sin(t * 3.1));
    });
  })();
})();
