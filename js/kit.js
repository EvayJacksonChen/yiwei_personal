/* Building blocks for everything that lives in the water: one material that knows
   how light behaves at depth, and a few ways to make bodies, fins and shells. */

(function () {
  "use strict";

  const T = window.THREE;
  const D = window.DIVE;
  if (!T || !D || D.failed) return;

  const U = D.U;
  const lin = D.lin;

  /* ---------- colour helpers (linear rgb triples) ---------- */

  function C(hex) { const v = lin(hex); return [v.x, v.y, v.z]; }
  function mixC(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function mulC(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
  function sstep(a, b, v) { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); }
  // Small repeatable noise for skin patterns.
  function hash(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
  function noise(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y);
    let fx = x - xi, fy = y - yi;
    fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(x, y) { return noise(x, y) * 0.5 + noise(x * 2.1 + 5.3, y * 2.1 + 1.7) * 0.3 + noise(x * 4.3 + 9.1, y * 4.3 + 4.2) * 0.2; }

  // Dark back, pale belly: `ang` runs 0 at the spine to π at the keel.
  function shade(top, side, belly, edge) {
    const e = edge == null ? 0.34 : edge;
    return function (u, ang) {
      const k = Math.cos(ang);
      if (k > e) return mixC(side, top, sstep(e, e + 0.42, k));
      return mixC(belly, side, sstep(-0.62, e, k));
    };
  }

  /* ---------- the material ---------- */

  const VERT = [
    D.GLSL_COMMON,
    "attribute vec3 aCol; attribute vec3 aGlow;",
    "#ifdef USE_INSTANCING",
    "attribute vec4 aInst;",
    "#endif",
    "uniform int uMode; uniform float uAmp; uniform float uFreq; uniform float uPhase; uniform float uLen;",
    "varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol; varying vec3 vGlow;",
    "void main(){",
    "  vec3 p = position;",
    "  float ph = uPhase;",
    "  vec3 tint = vec3(1.0);",
    "  #ifdef USE_INSTANCING",
    "  ph += aInst.x; tint = mix(vec3(1.0), vec3(aInst.y, aInst.z, aInst.w), step(0.001, aInst.y + aInst.z + aInst.w));",
    "  #endif",
    "  if (uMode == 1) {", // fish: a wave that travels down the body and grows toward the tail
    "    float s = clamp(0.5 - p.x / uLen, 0.0, 1.3);",
    "    p.z += uAmp * uLen * (0.12 + s * s) * sin(uFreq * s * 6.2832 - ph);",
    "  } else if (uMode == 2) {", // whales beat up and down
    "    float s = clamp(0.5 - p.x / uLen, 0.0, 1.3);",
    "    p.y += uAmp * uLen * s * s * sin(uFreq * s * 6.2832 - ph);",
    "  } else if (uMode == 3) {", // wings and fins: the tip trails the root
    "    float w = abs(p.z) / uLen;",
    "    p.y += uAmp * uLen * w * w * sin(ph - w * uFreq);",
    "  } else if (uMode == 4) {", // a bell that squeezes and relaxes; whatever hangs under it follows late
    "    float h = max(-p.y / uLen, 0.0);",
    "    float c = pow(0.5 + 0.5 * sin(ph - min(h, 1.0) * 1.2), 2.2);",
    "    float lag = pow(0.5 + 0.5 * sin(ph - 1.2 - (h - 1.0) * uFreq), 2.2);",
    "    float k = h < 1.0 ? c * smoothstep(0.05, 1.0, h) : mix(c, lag, clamp(h - 1.0, 0.0, 1.0));",
    "    p.xz *= 1.0 - uAmp * k;",
    "    p.y += uAmp * 0.35 * uLen * c * smoothstep(0.2, 1.0, h);",
    "    float t2 = max(h - 1.0, 0.0);",
    "    p.x += sin(ph * 0.5 - t2 * 3.0 + p.z * 9.0) * t2 * uLen * 0.10;",
    "    p.z += cos(ph * 0.43 - t2 * 2.6 + p.x * 9.0) * t2 * uLen * 0.10;",
    "  } else if (uMode == 5) {", // rooted things lean with the surge
    "    float h = max(p.y, 0.0) / uLen;",
    "    p.x += uAmp * uLen * h * h * sin(uTime * uFreq + ph);",
    "    p.z += uAmp * uLen * h * h * 0.6 * cos(uTime * uFreq * 0.8 + ph * 1.7);",
    "  }",
    "  #ifdef USE_INSTANCING",
    "  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);",
    "  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);",
    "  #else",
    "  vec4 wp = modelMatrix * vec4(p, 1.0);",
    "  vNormal = normalize(mat3(modelMatrix) * normal);",
    "  #endif",
    "  vWorld = wp.xyz; vCol = aCol * tint; vGlow = aGlow;",
    "  gl_Position = projectionMatrix * viewMatrix * wp;",
    "}"
  ].join("\n");

  const FRAG = [
    D.GLSL_COMMON,
    "uniform vec3 uMask; uniform float uOpacity; uniform float uRim; uniform float uSheen; uniform float uGlowK; uniform float uSelfLit; uniform float uGrain; uniform float uMaskK;",
    "varying vec3 vWorld; varying vec3 vNormal; varying vec3 vCol; varying vec3 vGlow;",
    "void main(){",
    "  vec3 N = normalize(vNormal);",
    "  vec3 toCam = cameraPosition - vWorld; float dist = length(toCam); vec3 V = toCam / dist;",
    "  if (dot(N, V) < 0.0) N = -N;",
    "  float rim = pow(1.0 - max(dot(N, V), 0.0), 2.5);",
    "  vec3 col;",
    "  if (vWorld.y > 0.0 && uAbove > 0.5) {",
    // in air
    "    float ndl = max(dot(N, uSunDir), 0.0);",
    "    vec3 sky = mix(uSkyHor, uSkyZen, N.y * 0.5 + 0.5);",
    "    col = vCol * (uSunCol * ndl * 1.5 + sky * 0.75 + uSeaBody * 0.4 * max(-N.y, 0.0));",
    "    col += uSunCol * pow(max(dot(reflect(-uSunDir, N), V), 0.0), 30.0) * uSheen;",
    "    col = mix(col, uSkyHor, 1.0 - exp(-dist * 0.0012));",
    "    col = mix(col, uMask * (0.4 + dot(col, vec3(0.5))), 0.55 * uVision) + uMask * rim * 0.7 * uVision;",
    "    gl_FragColor = vec4(finish(col), uOpacity);",
    "    return;",
    "  }",
    // in water: what is left of the sun, coloured by the depth it crossed
    "  float deep = max(-vWorld.y, 0.0);",
    "  vec3 through = exp(-deep * vec3(0.024, 0.0065, 0.0025));",
    "  through = mix(through, vec3(dot(through, vec3(0.3333))), 0.45);",
    "  vec3 L = normalize(vec3(uSunDir.x * 0.6, max(uSunDir.y, 0.5) + 0.35, uSunDir.z * 0.6));",
    "  float ndl = max(dot(N, L), 0.0);",
    "  vec3 sun = uSunCol * uSun * through * (ndl * 0.8 + 0.2 * (N.y * 0.5 + 0.5)) * 1.15;",
    "  float ca = uCaustic > 0.01 ? caustic(vWorld.xz * 0.16 + vWorld.y * 0.03, uTime * 0.75) : 0.0;",
    "  sun *= 0.72 + ca * uCaustic * 5.0 * smoothstep(-0.3, 0.7, N.y);",
    "  vec3 amb = mix(uWaterDown, uWaterUp, N.y * 0.5 + 0.5) * 1.5 + uWaterHor * 0.55;",
    "  amb = mix(amb, vec3(dot(amb, vec3(0.2, 0.45, 0.35))), 0.5);",
    // the torch gives colour back, over a short path
    "  vec3 tl = vWorld - uTorchPos; float td = length(tl); tl /= max(td, 0.001);",
    "  float cone = smoothstep(0.86, 0.975, dot(tl, uTorchDir));",
    "  vec3 torch = vec3(1.0, 0.96, 0.88) * uTorch * cone * 2.7 / (1.0 + td * td * 0.008);",
    "  torch *= (max(dot(N, -tl), 0.0) * 0.85 + 0.15) * exp(-td * vec3(0.045, 0.012, 0.008));",
    "  vec3 lamps = vec3(0.0);",
    "  for (int i = 0; i < 4; i++) {",
    "    vec3 ld = uLightPos[i].xyz - vWorld; float lr = length(ld);",
    "    lamps += uLightCol[i] * (max(dot(N, ld / max(lr, 0.001)), 0.0) * 0.8 + 0.2) / (1.0 + lr * lr * uLightPos[i].w);",
    "  }",
    "  vec3 light = sun + amb + torch + lamps;",
    "  vec3 alb = vCol;",
    "  if (uGrain > 0.0) {",
    "    vec3 an = abs(N);",
    "    vec2 gp = an.y > 0.6 ? vWorld.xz : (an.x > an.z ? vWorld.zy : vWorld.xy);",
    "    float g1 = fbm(gp * 1.7 + 3.1), g2 = fbm(gp * 6.3 + 11.0);",
    "    float fadeG = 1.0 / (1.0 + dist * 0.05);",
    "    alb *= mix(1.0, 0.55 + 0.6 * g1 + 0.5 * (g2 - 0.5), uGrain * fadeG);",
    "    alb *= 1.0 - uGrain * 0.35 * smoothstep(0.55, 0.3, g1) * fadeG;",
    "  }",
    "  col = alb * light + alb * uSelfLit;",
    "  col += (sun + torch) * pow(max(dot(reflect(-L, N), V), 0.0), 22.0) * uSheen;",
    "  col += light * rim * uRim * 0.6;",
    "  col += vGlow * uGlowK;",
    "  float mk = uVision * uMaskK;",
    "  col = mix(col, uMask * (0.3 + dot(col, vec3(0.6))) + uMask * 0.12, 0.6 * mk) + uMask * rim * 0.8 * mk;",
    "  float f = 1.0 - exp(-dist * uFog);",
    "  col = mix(col, waterColor(-V), f) + vGlow * uGlowK * (1.0 - f) * 0.4;",
    "  float a = uOpacity + (1.0 - uOpacity) * clamp(rim * uRim * 1.4 + dot(vGlow, vec3(0.4)) + mk * 0.5, 0.0, 1.0);",
    "  gl_FragColor = vec4(finish(col), a);",
    "}"
  ].join("\n");

  function matter(o) {
    o = o || {};
    const clear = o.opacity != null && o.opacity < 1;
    return new T.ShaderMaterial({
      uniforms: Object.assign({
        uMode: { value: o.mode || 0 },
        uAmp: { value: o.amp || 0 },
        uFreq: { value: o.freq == null ? 1 : o.freq },
        uPhase: { value: o.phase || 0 },
        uLen: { value: o.len || 1 },
        uMask: { value: lin(o.mask || "#3df0d2") },
        uOpacity: { value: o.opacity == null ? 1 : o.opacity },
        uRim: { value: o.rim || 0 },
        uSheen: { value: o.sheen || 0 },
        uGlowK: { value: o.glow == null ? 1 : o.glow },
        uSelfLit: { value: o.selfLit || 0 },
        uGrain: { value: o.grain || 0 },
        uMaskK: { value: o.maskK == null ? 1 : o.maskK }
      }, U),
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: T.DoubleSide,
      transparent: clear,
      depthWrite: !clear
    });
  }

  /* ---------- geometry ---------- */

  function Piece() { this.pos = []; this.col = []; this.glow = []; this.idx = []; }
  Piece.prototype.v = function (x, y, z, c, g) {
    this.pos.push(x, y, z);
    this.col.push(c[0], c[1], c[2]);
    if (g) this.glow.push(g[0], g[1], g[2]); else this.glow.push(0, 0, 0);
    return this.pos.length / 3 - 1;
  };
  Piece.prototype.move = function (m) {
    const v = new T.Vector3();
    for (let i = 0; i < this.pos.length; i += 3) {
      v.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]).applyMatrix4(m);
      this.pos[i] = v.x; this.pos[i + 1] = v.y; this.pos[i + 2] = v.z;
    }
    return this;
  };
  // Convenience: scale, then rotate (Euler XYZ, radians), then move.
  Piece.prototype.at = function (x, y, z, rx, ry, rz, s) {
    const sc = s == null ? [1, 1, 1] : typeof s === "number" ? [s, s, s] : s;
    const m = new T.Matrix4().compose(new T.Vector3(x || 0, y || 0, z || 0), new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0)), new T.Vector3(sc[0], sc[1], sc[2]));
    return this.move(m);
  };
  Piece.prototype.paint = function (fn) {
    for (let i = 0; i < this.pos.length; i += 3) {
      const c = fn(this.pos[i], this.pos[i + 1], this.pos[i + 2], [this.col[i], this.col[i + 1], this.col[i + 2]]);
      this.col[i] = c[0]; this.col[i + 1] = c[1]; this.col[i + 2] = c[2];
    }
    return this;
  };
  Piece.prototype.light = function (g) {
    for (let i = 0; i < this.glow.length; i += 3) { this.glow[i] = g[0]; this.glow[i + 1] = g[1]; this.glow[i + 2] = g[2]; }
    return this;
  };

  function build(pieces) {
    let n = 0, ni = 0;
    pieces.forEach(function (p) { n += p.pos.length; ni += p.idx.length; });
    const pos = new Float32Array(n), col = new Float32Array(n), glow = new Float32Array(n);
    const idx = new Uint32Array(ni);
    let o = 0, oi = 0;
    pieces.forEach(function (p) {
      pos.set(p.pos, o); col.set(p.col, o); glow.set(p.glow, o);
      const base = o / 3;
      for (let i = 0; i < p.idx.length; i++) idx[oi + i] = p.idx[i] + base;
      o += p.pos.length; oi += p.idx.length;
    });
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.setAttribute("aCol", new T.BufferAttribute(col, 3));
    g.setAttribute("aGlow", new T.BufferAttribute(glow, 3));
    g.setIndex(new T.BufferAttribute(idx, 1));
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  // A skin stretched along a path. radii(u) → [up, side]; colour(u, ang, i) → rgb.
  // `ang` is 0 on the side facing `up`, π on the far side.
  function sweep(path, radii, colour, o) {
    o = o || {};
    const m = o.sides || 12;
    const P = new Piece();
    const n = path.length;
    const pts = path.map(function (q) { return new T.Vector3(q[0], q[1], q[2] || 0); });
    const tan = new T.Vector3(), nor = new T.Vector3(), bin = new T.Vector3();
    const up = o.up ? new T.Vector3(o.up[0], o.up[1], o.up[2]) : new T.Vector3(0, 1, 0);
    let prevN = null;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      tan.copy(pts[Math.min(n - 1, i + 1)]).sub(pts[Math.max(0, i - 1)]).normalize();
      if (!prevN) {
        nor.copy(up).addScaledVector(tan, -up.dot(tan));
        if (nor.lengthSq() < 1e-6) nor.set(0, 0, 1).addScaledVector(tan, -tan.z);
        nor.normalize();
      } else {
        nor.copy(prevN).addScaledVector(tan, -prevN.dot(tan)).normalize();
      }
      prevN = nor.clone();
      bin.crossVectors(tan, nor).normalize();
      const r = radii(u, i);
      for (let k = 0; k < m; k++) {
        const a = (k / m) * Math.PI * 2;
        const ca = Math.cos(a), sa = Math.sin(a);
        const ang = Math.acos(Math.max(-1, Math.min(1, ca)));
        P.v(
          pts[i].x + nor.x * ca * r[0] + bin.x * sa * r[1],
          pts[i].y + nor.y * ca * r[0] + bin.y * sa * r[1],
          pts[i].z + nor.z * ca * r[0] + bin.z * sa * r[1],
          typeof colour === "function" ? colour(u, ang, i, sa) : colour,
          o.glow ? o.glow(u, ang, i) : null
        );
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < m; k++) {
        const a = i * m + k, b = i * m + ((k + 1) % m), c = a + m, d = b + m;
        P.idx.push(a, c, b, b, c, d);
      }
    }
    if (o.cap !== false) {
      [0, n - 1].forEach(function (i) {
        const u = i / (n - 1);
        const c = P.v(pts[i].x, pts[i].y, pts[i].z, typeof colour === "function" ? colour(u, Math.PI / 2, i, 1) : colour, o.glow ? o.glow(u, 0, i) : null);
        for (let k = 0; k < m; k++) {
          const a = i * m + k, b = i * m + ((k + 1) % m);
          if (i === 0) P.idx.push(c, a, b); else P.idx.push(c, b, a);
        }
      });
    }
    return P;
  }

  // An ellipsoid. colour(nx, ny, nz) uses the unit direction of each vertex.
  function blob(rx, ry, rz, colour, o) {
    o = o || {};
    const lat = o.lat || 10, lon = o.lon || 14;
    const P = new Piece();
    for (let i = 0; i <= lat; i++) {
      const th = (i / lat) * Math.PI;
      for (let k = 0; k < lon; k++) {
        const ph = (k / lon) * Math.PI * 2;
        const nx = Math.sin(th) * Math.cos(ph), ny = Math.cos(th), nz = Math.sin(th) * Math.sin(ph);
        const b = o.bump ? 1 + o.bump(nx, ny, nz) : 1;
        const fy = o.flat != null && ny < 0 ? o.flat : 1;
        P.v(nx * rx * b, ny * ry * b * fy, nz * rz * b, typeof colour === "function" ? colour(nx, ny, nz) : colour, o.glow || null);
      }
    }
    for (let i = 0; i < lat; i++) {
      for (let k = 0; k < lon; k++) {
        const a = i * lon + k, b = i * lon + ((k + 1) % lon), c = a + lon, d = b + lon;
        P.idx.push(a, c, b, b, c, d);
      }
    }
    return P;
  }

  // A flat shape from an outline. plane: "xy" (upright, along the body) or "xz" (level).
  function plate(outline, colour, plane, o) {
    o = o || {};
    const P = new Piece();
    let cx = 0, cy = 0;
    outline.forEach(function (q) { cx += q[0]; cy += q[1]; });
    cx /= outline.length; cy /= outline.length;
    if (o.hub) { cx = o.hub[0]; cy = o.hub[1]; }
    const put = function (a, b, i) {
      const c = typeof colour === "function" ? colour(a, b, i) : colour;
      const w = o.bend ? o.bend(a, b) : 0;
      return plane === "xz" ? P.v(a, w, b, c, o.glow || null) : plane === "zy" ? P.v(w, b, a, c, o.glow || null) : P.v(a, b, w, c, o.glow || null);
    };
    const hub = put(cx, cy, -1);
    const ids = outline.map(function (q, i) { return put(q[0], q[1], i); });
    for (let i = 0; i < ids.length; i++) P.idx.push(hub, ids[i], ids[(i + 1) % ids.length]);
    return P;
  }

  // A surface turned around the Y axis. profile: [[radius, y], …]; scallop(angle, v) scales the radius.
  function lathe(profile, colour, o) {
    o = o || {};
    const seg = o.seg || 20;
    const P = new Piece();
    const n = profile.length;
    for (let i = 0; i < n; i++) {
      const v = i / (n - 1);
      for (let k = 0; k < seg; k++) {
        const a = (k / seg) * Math.PI * 2;
        const r = profile[i][0] * (o.scallop ? o.scallop(a, v) : 1);
        P.v(Math.cos(a) * r, profile[i][1], Math.sin(a) * r, typeof colour === "function" ? colour(v, a) : colour, o.glow ? o.glow(v, a) : null);
      }
    }
    for (let i = 0; i < n - 1; i++) {
      for (let k = 0; k < seg; k++) {
        const a = i * seg + k, b = i * seg + ((k + 1) % seg), c = a + seg, d = b + seg;
        P.idx.push(a, b, c, b, d, c);
      }
    }
    return P;
  }

  function box(w, h, d, colour, glow) {
    const P = new Piece();
    const x = w / 2, y = h / 2, z = d / 2;
    const faces = [
      [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]],
      [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]],
      [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]
    ];
    faces.forEach(function (f) {
      const a = P.v(f[0][0], f[0][1], f[0][2], colour, glow);
      const b = P.v(f[1][0], f[1][1], f[1][2], colour, glow);
      const c = P.v(f[2][0], f[2][1], f[2][2], colour, glow);
      const e = P.v(f[3][0], f[3][1], f[3][2], colour, glow);
      P.idx.push(a, b, c, a, c, e);
    });
    return P;
  }

  // A straight tapered rod between two points.
  function rod(a, b, r0, r1, colour, sides, glow) {
    return sweep([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ((a[2] || 0) + (b[2] || 0)) / 2], b], function (u) { const r = r0 + (r1 - r0) * u; return [r, r]; }, colour, { sides: sides || 6, glow: glow ? function () { return glow; } : null });
  }

  function mesh(pieces, mat) {
    const m = new T.Mesh(build(pieces), mat);
    m.frustumCulled = false;
    return m;
  }

  D.kit = { C: C, mixC: mixC, mulC: mulC, sstep: sstep, noise: noise, fbm: fbm, hash: hash, shade: shade, matter: matter, Piece: Piece, build: build, sweep: sweep, blob: blob, plate: plate, lathe: lathe, box: box, rod: rod, mesh: mesh };
})();
