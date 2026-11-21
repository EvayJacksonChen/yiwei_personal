/* Everything that swims, drifts, walks or flies. Each named animal is built from
   swept skins and flat fins (kit.js), moves on its own, and can be picked for a chat. */

(function () {
  "use strict";

  const T = window.THREE;
  const D = window.DIVE;
  if (!T || !D || D.failed) return;

  const K = D.kit;
  const C = K.C, mixC = K.mixC, mulC = K.mulC, sstep = K.sstep, shade = K.shade;
  const sweep = K.sweep, blob = K.blob, plate = K.plate, lathe = K.lathe, box = K.box, rod = K.rod, mesh = K.mesh, matter = K.matter;
  const S = D.S, U = D.U;
  const PI = Math.PI, TAU = PI * 2;
  function rand(a, b) { return a + Math.random() * (b - a); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  const LITE = window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 720;
  const BLACK = C("#07090b");
  const WHITE = C("#f2f4f1");

  /* ---------- creature framework ---------- */

  const creatures = [];
  const byId = {};
  D.creatures = creatures;
  D.creature = function (id) { return byId[id]; };

  function Creature(id, o) {
    this.id = id;
    this.spec = (D.data && D.data.cast[id]) || { id: id, name: id, common: id, latin: "", conf: "0.90" };
    this.group = new T.Group();
    this.group.rotation.order = "YZX";
    this.home = new T.Vector3(o.home[0], o.home[1], o.home[2]);
    this.range = o.range || [0, 0, 0];
    this.speed = o.speed || 0.1;
    this.kind = o.kind || "cruise";
    this.a = o.phase == null ? rand(0, TAU) : o.phase;
    this.reach = o.reach || 30;
    this.size = o.size || 1;
    this.slow = 1;
    this.talking = false;
    this.hover = false;
    this.mats = [];
    this.pos = this.group.position;
    this.rect = { l: 0, t: 0, r: 0, b: 0, cx: 0, cy: 0, ok: false, dist: 0 };
    this.box = new T.Box3();
    this.tick = o.tick || null;
    this.yaw = 0;
    this.bank = 0;
    this.maskHex = o.mask || "#3df0d2";
    // being moved by the visitor: `offset` is how far it has been pulled off its own path
    this.offset = new T.Vector3();
    this.base = new T.Vector3();
    this.baseScale = new T.Vector3(1, 1, 1);
    this.ownOffset = true;
    this.held = false;
    this.pop = 0;
    this.boost = 0;
    this.onPoke = null;
    this.pos.copy(this.home);
    D.scene.add(this.group);
    creatures.push(this);
    byId[id] = this;
  }
  Creature.prototype.mat = function (o) {
    const m = matter(Object.assign({ mask: this.maskHex }, o || {}));
    this.mats.push(m);
    return m;
  };
  Creature.prototype.add = function (pieces, mat, parent) {
    const m = mesh(pieces, mat);
    (parent || this.group).add(m);
    return m;
  };
  // Call once the body is assembled: remembers its extent for picking and boxes.
  Creature.prototype.done = function () {
    this.group.updateMatrixWorld(true);
    const inv = new T.Matrix4().copy(this.group.matrixWorld).invert();
    const b = this.box.makeEmpty();
    const tmp = new T.Box3();
    this.group.traverse(function (n) {
      if (!n.isMesh || n.userData.skipBox) return;
      tmp.copy(n.geometry.boundingBox).applyMatrix4(new T.Matrix4().multiplyMatrices(inv, n.matrixWorld));
      b.union(tmp);
    });
    this.baseScale.copy(this.group.scale);
    return this;
  };

  const pA = new T.Vector3(), pB = new T.Vector3();
  function pathAt(c, a, out) {
    const r = c.range;
    if (c.kind === "cruise") {
      // a long figure-of-eight: animals cross the view, turn in the haze and come back
      return out.set(c.home.x + r[0] * Math.sin(a), c.home.y + r[1] * Math.sin(a * 1.7 + 1.3), c.home.z + r[2] * Math.sin(a * 2));
    }
    if (c.kind === "circle") {
      return out.set(c.home.x + r[0] * Math.cos(a), c.home.y + r[1] * Math.sin(a * 2.3), c.home.z + r[2] * Math.sin(a));
    }
    return out.set(c.home.x + r[0] * Math.sin(a), c.home.y + r[1] * Math.sin(a * 1.31 + 2), c.home.z + r[2] * Math.sin(a * 0.77 + 1));
  }

  const corner = new T.Vector3();
  const scr = { x: 0, y: 0, z: 0, behind: false };
  function screenRect(c) {
    const b = c.box, r = c.rect;
    let l = 1e9, t = 1e9, rr = -1e9, bb = -1e9, ok = true;
    for (let i = 0; i < 8; i++) {
      corner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(c.group.matrixWorld);
      D.project(corner, scr);
      if (scr.behind) { ok = false; break; }
      if (scr.x < l) l = scr.x; if (scr.x > rr) rr = scr.x;
      if (scr.y < t) t = scr.y; if (scr.y > bb) bb = scr.y;
    }
    r.dist = c.pos.distanceTo(D.camera.position);
    r.ok = ok && rr > 0 && l < S.vw && bb > 0 && t < S.vh && r.dist < 62 && (rr - l) < S.vw * 1.2;
    r.l = l; r.t = t; r.r = rr; r.b = bb; r.cx = (l + rr) / 2; r.cy = (t + bb) / 2;
  }

  function stepCreature(c, dt, t) {
    const near = Math.abs(c.home.y - S.camY) < c.reach;
    c.group.visible = near;
    c.rect.ok = false;
    if (!near) { c.held = false; return; }
    const goal = c.held ? 0.05 : c.talking ? 0.12 : c.hover ? 0.45 : 1;
    c.slow = lerp(c.slow, goal, 1 - Math.exp(-dt * 3));
    c.boost *= Math.exp(-dt * 1.3);
    c.a += dt * c.speed * (c.slow + c.boost);
    if (c.kind !== "fixed") {
      pathAt(c, c.a, pA);
      pathAt(c, c.a + 0.02, pB);
      c.pos.copy(pA);
      if (c.kind === "cruise" || c.kind === "circle") {
        const dx = pB.x - pA.x, dy = pB.y - pA.y, dz = pB.z - pA.z;
        const yaw = Math.atan2(-dz, dx);
        let dy2 = yaw - c.yaw;
        while (dy2 > PI) dy2 -= TAU;
        while (dy2 < -PI) dy2 += TAU;
        c.bank = lerp(c.bank, clamp(dy2 / Math.max(dt, 0.001) * 0.35, -0.5, 0.5), 1 - Math.exp(-dt * 2));
        c.yaw = yaw;
        c.group.rotation.set(c.bank * (c.kind === "circle" ? 1.4 : 1), yaw, Math.atan2(dy, Math.hypot(dx, dz)) * 0.8);
      }
    } else {
      c.pos.copy(c.home);
    }
    // let go, an animal swims back to where it was going
    if (!c.held) c.offset.multiplyScalar(Math.exp(-dt * 0.8));
    if (c.ownOffset) c.pos.add(c.offset);
    c.group.scale.copy(c.baseScale);
    if (c.tick) c.tick(c, dt, t);
    c.base.copy(c.pos).sub(c.offset);
    if (c.held) c.group.rotation.x += Math.sin(t * 12) * 0.09;
    if (c.pop > 0) {
      c.pop = Math.max(0, c.pop - dt * 1.6);
      const k = Math.sin(PI * (1 - c.pop));
      c.group.scale.multiplyScalar(1 + 0.13 * k);
    }
    c.group.updateMatrixWorld(true);
    screenRect(c);
  }

  // Pull an animal toward a point in the water (while the visitor drags it).
  const lim = new T.Vector3();
  D.dragTo = function (c, target) {
    lim.copy(target);
    if (c.home.y < 0) lim.y = Math.min(lim.y, -0.7); else lim.y = Math.max(lim.y, 0.6);
    if (D.floorAt) lim.y = Math.max(lim.y, D.floorAt(lim.x, lim.z) + 0.25);
    c.offset.copy(lim).sub(c.base);
    c.held = true;
  };
  // A nudge: a start, a burst of speed, a puff of bubbles, and whatever else that animal does.
  D.poke = function (c) {
    c.pop = 1;
    c.boost = c.kind === "cruise" || c.kind === "circle" ? 2.4 : 0.8;
    if (c.pos.y < -0.5) D.spawnBubbles(c.pos.x, c.pos.y, c.pos.z, 7, 0.5, 0.07);
    if (c.onPoke) c.onPoke(c);
  };

  /* ---------- halos: the soft bloom around anything that makes its own light ---------- */

  const HALO_MAX = 24;
  const halos = [];
  const haloGeo = new T.BufferGeometry();
  const haloPos = new Float32Array(HALO_MAX * 3), haloCol = new Float32Array(HALO_MAX * 4);
  haloGeo.setAttribute("position", new T.BufferAttribute(haloPos, 3));
  haloGeo.setAttribute("aHalo", new T.BufferAttribute(haloCol, 4));
  const haloMesh = new T.Points(haloGeo, new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    vertexShader: [
      D.GLSL_COMMON,
      "uniform float uPx; attribute vec4 aHalo; varying vec3 vC;",
      "void main(){",
      "  vec4 mv = viewMatrix * vec4(position, 1.0);",
      "  float dist = -mv.z;",
      "  gl_PointSize = clamp(uPx * aHalo.w / max(dist, 0.4), 0.0, 420.0);",
      "  vC = aHalo.rgb * exp(-dist * uFog * 1.3);",
      "  gl_Position = projectionMatrix * mv;",
      "}"
    ].join("\n"),
    fragmentShader: [
      "precision highp float; varying vec3 vC;",
      "void main(){",
      "  float r = length(gl_PointCoord - 0.5) * 2.0;",
      "  float a = pow(max(1.0 - r, 0.0), 2.6) + pow(max(1.0 - r * 3.5, 0.0), 2.0) * 1.5;",
      "  gl_FragColor = vec4(vC * a, 1.0);",
      "}"
    ].join("\n")
  }));
  haloMesh.frustumCulled = false;
  haloMesh.renderOrder = 55;
  D.scene.add(haloMesh);
  // owner: a creature; at: local position; rgb: colour; size: metres across
  function halo(owner, at, rgb, size) {
    const h = { owner: owner, at: new T.Vector3(at[0], at[1], at[2]), rgb: rgb, size: size, k: 1 };
    halos.push(h);
    return h;
  }
  const hv = new T.Vector3();
  function stepHalos() {
    let n = 0;
    for (let i = 0; i < halos.length && n < HALO_MAX; i++) {
      const h = halos[i];
      if (!h.owner.group.visible || h.k <= 0) continue;
      hv.copy(h.at).applyMatrix4(h.owner.group.matrixWorld);
      if (hv.y > -0.2) continue;
      haloPos[n * 3] = hv.x; haloPos[n * 3 + 1] = hv.y; haloPos[n * 3 + 2] = hv.z;
      haloCol[n * 4] = h.rgb[0] * h.k; haloCol[n * 4 + 1] = h.rgb[1] * h.k; haloCol[n * 4 + 2] = h.rgb[2] * h.k; haloCol[n * 4 + 3] = h.size;
      n++;
    }
    haloGeo.setDrawRange(0, n);
    haloGeo.attributes.position.needsUpdate = true;
    haloGeo.attributes.aHalo.needsUpdate = true;
  }

  /* ---------- fish, in general ---------- */

  // o: len, h, w, colour(u, ang), tail {len, span, fork, low, col}, dorsal [u0, u1, height, col], anal, pect, eye
  function fishPieces(o) {
    const L = o.len, H = o.h, W = o.w;
    const tl = o.tail.len * L;
    const bodyL = L - tl;
    const N = o.stations || 18;
    const prof = o.profile || function (u) {
      const a = Math.pow(Math.sin(PI * Math.pow(u, o.nose || 0.62)), o.round || 0.82);
      return Math.max(a, (o.ped || 0.14) * sstep(0.45, 0.9, u), 0.12 * (1 - u) * (1 - u));
    };
    const X = function (u) { return L / 2 - u * bodyL; };
    const path = [];
    for (let i = 0; i <= N; i++) path.push([X(i / N), (o.keel || 0) * Math.sin(PI * i / N) * H, 0]);
    const out = [sweep(path, function (u) { const p = prof(u); return [H / 2 * p, W / 2 * p]; }, o.colour, { sides: o.sides || 12 })];
    const xT = X(1);
    const pr = H / 2 * prof(1);
    const t = o.tail;
    const sp = t.span * H / 2;
    const low = t.low == null ? 1 : t.low;
    const tc = t.col;
    out.push(plate([
      [xT + 0.04 * L, pr], [xT - tl * 0.5, sp * 0.72], [xT - tl, sp], [xT - tl * (1 - t.fork), sp * 0.12],
      [xT - tl * (1 - t.fork), -sp * 0.12 * low], [xT - tl * (t.lowLen || 1), -sp * low], [xT - tl * 0.5, -sp * 0.72 * low], [xT + 0.04 * L, -pr]
    ], typeof tc === "function" ? tc : function () { return tc; }, "xy", { hub: [xT - tl * 0.25, 0] }));
    const top = function (u) { return H / 2 * prof(u) + (o.keel || 0) * Math.sin(PI * u) * H; };
    const bot = function (u) { return -H / 2 * prof(u) + (o.keel || 0) * Math.sin(PI * u) * H; };
    (o.dorsal || []).forEach(function (d) {
      const x0 = X(d[0]), x1 = X(d[1]);
      const lean = d[4] == null ? 0.3 : d[4];
      out.push(plate([[x0, top(d[0]) * 0.86], [lerp(x0, x1, lean), top(lerp(d[0], d[1], lean)) + d[2] * H], [lerp(x0, x1, 0.82), top(lerp(d[0], d[1], 0.82)) + d[2] * H * (d[5] == null ? 0.45 : d[5])], [x1, top(d[1]) * 0.86]], d[3], "xy"));
    });
    (o.anal || []).forEach(function (d) {
      const x0 = X(d[0]), x1 = X(d[1]);
      out.push(plate([[x0, bot(d[0]) * 0.86], [lerp(x0, x1, 0.35), bot(lerp(d[0], d[1], 0.35)) - d[2] * H], [lerp(x0, x1, 0.85), bot(lerp(d[0], d[1], 0.85)) - d[2] * H * 0.4], [x1, bot(d[1]) * 0.86]], d[3], "xy"));
    });
    if (o.pect) {
      const p = o.pect; // [u, length, width, colour, droop]
      [-1, 1].forEach(function (s) {
        const z = W / 2 * prof(p[0]) * 0.92;
        out.push(plate([[0, 0], [-p[1] * L * 0.45, p[2] * L * 0.5], [-p[1] * L, p[2] * L * 0.15], [-p[1] * L * 0.75, -p[2] * L * 0.4]], p[3], "xy")
          .at(X(p[0]), -H * 0.16, s * z, s * (p[4] == null ? 1.15 : p[4]), s * 0.35, 0));
      });
    }
    if (o.eye !== false) {
      const eu = o.eyeU || 0.11;
      const er = (o.eye || 0.055) * H;
      [-1, 1].forEach(function (s) {
        const ed = o.eyeLod || 5;
        if (o.eyeRing !== false) out.push(blob(er * 1.25, er * 1.25, er * 0.5, o.eyeRing || C("#c9c7ae"), { lat: ed, lon: ed + 3 }).at(X(eu), H * 0.08, s * W / 2 * prof(eu) * 0.9));
        out.push(blob(er * 0.8, er * 0.8, er * 0.5, BLACK, { lat: ed, lon: ed + 3 }).at(X(eu), H * 0.08, s * (W / 2 * prof(eu) * 0.9 + er * 0.22)));
      });
    }
    return out;
  }

  /* ---------- schools ---------- */

  const schools = [];
  D.schools = schools;

  // A loose ball of fish around a wandering centre. Each fish keeps its own small orbit.
  function School(id, geo, mat, o) {
    this.id = id;
    this.n = o.n;
    this.home = new T.Vector3(o.home[0], o.home[1], o.home[2]);
    this.range = o.range;
    this.spread = o.spread;
    this.speed = o.speed;
    this.fishLen = o.fishLen;
    this.label = o.label;
    this.latin = o.latin;
    this.mask = o.mask;
    this.tight = o.tight || 0;
    this.a = rand(0, TAU);
    this.centre = new T.Vector3();
    this.mesh = new T.InstancedMesh(geo, mat, o.n);
    this.mesh.frustumCulled = false;
    const inst = new Float32Array(o.n * 4);
    this.fish = [];
    for (let i = 0; i < o.n; i++) {
      inst[i * 4] = rand(0, TAU);
      const v = rand(0.86, 1.12);
      inst[i * 4 + 1] = v; inst[i * 4 + 2] = v * rand(0.96, 1.04); inst[i * 4 + 3] = v;
      this.fish.push({
        ox: rand(-1, 1), oy: rand(-1, 1) * 0.55, oz: rand(-1, 1), ph: rand(0, TAU), k: rand(0.6, 1.4), s: rand(0.8, 1.15),
        x: 0, y: 0, z: 0, px: 0, py: 0, pz: 0, fx: 0, fy: 0, fz: 0, init: false
      });
    }
    geo.setAttribute("aInst", new T.InstancedBufferAttribute(inst, 4));
    this.picks = [];
    D.scene.add(this.mesh);
    schools.push(this);
  }

  const dummy = new T.Object3D();
  dummy.rotation.order = "YZX";
  const q1 = new T.Vector3();

  function stepSchool(s, dt, t) {
    const near = Math.abs(s.home.y - S.camY) < 34;
    s.mesh.visible = near;
    s.picks.length = 0;
    if (!near) return;
    s.a += dt * s.speed;
    const a = s.a;
    s.centre.set(s.home.x + s.range[0] * Math.sin(a), s.home.y + s.range[1] * Math.sin(a * 1.9 + 1), s.home.z + s.range[2] * Math.sin(a * 2));
    if (s.shift) s.centre.add(s.shift);
    const hx = s.range[0] * Math.cos(a), hz = s.range[2] * 2 * Math.cos(a * 2);
    const hl = Math.hypot(hx, hz) || 1;
    // the pointer parts the school: fish slide away from the line of sight under it
    const ray = D.ray;
    const scare = S.pointer.active ? 1 : 0;
    for (let i = 0; i < s.n; i++) {
      const f = s.fish[i];
      const w = t * 0.5 * f.k + f.ph;
      let x = s.centre.x + (f.ox + Math.sin(w) * 0.35) * s.spread[0] + (s.tight ? 0 : hx / hl * f.oz * s.spread[0] * 0.6);
      let y = s.centre.y + (f.oy + Math.sin(w * 1.3 + 2) * 0.25) * s.spread[1];
      let z = s.centre.z + (f.oz + Math.cos(w * 0.8) * 0.35) * s.spread[2];
      if (scare) {
        q1.set(x - ray.origin.x, y - ray.origin.y, z - ray.origin.z);
        const along = q1.dot(ray.dir);
        if (along > 0.5) {
          const cx = q1.x - ray.dir.x * along, cy = q1.y - ray.dir.y * along, cz = q1.z - ray.dir.z * along;
          const off = Math.hypot(cx, cy, cz) || 0.001;
          const R = 0.9 + along * 0.05;
          if (off < R) {
            const push = (1 - off / R) * 1.3;
            f.fx += (cx / off * push - f.fx) * Math.min(1, dt * 9);
            f.fy += (cy / off * push - f.fy) * Math.min(1, dt * 9);
            f.fz += (cz / off * push - f.fz) * Math.min(1, dt * 9);
          }
        }
      }
      const ease = Math.exp(-dt * 1.1);
      f.fx *= ease; f.fy *= ease; f.fz *= ease;
      x += f.fx; y += f.fy; z += f.fz;
      if (!f.init) { f.px = x - hx / hl * 0.01; f.py = y; f.pz = z - hz / hl * 0.01; f.init = true; }
      const dx = x - f.px, dy = y - f.py, dz = z - f.pz;
      const sp = Math.hypot(dx, dz);
      dummy.position.set(x, y, z);
      if (sp > 1e-5) {
        f.yaw = Math.atan2(-dz, dx);
        f.pitch = Math.atan2(dy, sp) * 0.7;
      }
      dummy.rotation.set(0, f.yaw || 0, f.pitch || 0);
      dummy.scale.setScalar(f.s);
      dummy.updateMatrix();
      s.mesh.setMatrixAt(i, dummy.matrix);
      f.px = x; f.py = y; f.pz = z; f.x = x; f.y = y; f.z = z;
    }
    s.mesh.instanceMatrix.needsUpdate = true;
    s.mesh.material.uniforms.uPhase.value = t * (s.beat || 9);
  }

  /* ---------- the cast ---------- */

  // Dropout — herring gull, wheeling over the swell.
  (function () {
    const c = new Creature("dropout", { home: [3.5, 4.4, -17], range: [8, 0.5, 4.5], speed: 0.33, kind: "circle", reach: 14, mask: "#ffd166" });
    const grey = C("#9aa4ad"), white = C("#f4f5f2"), tip = C("#15171a"), bill = C("#e8b730");
    const mat = c.mat({ sheen: 0.05 });
    c.add([
      sweep([[0.3, 0.02, 0], [0.2, 0.03, 0], [0.05, 0.0, 0], [-0.12, -0.01, 0], [-0.28, 0.0, 0], [-0.36, 0.01, 0]],
        function (u) { const r = Math.pow(Math.sin(PI * Math.pow(u, 0.7)), 0.8) * 0.085 + 0.012; return [r, r * 0.92]; },
        function (u, ang) { return u > 0.25 && Math.cos(ang) > 0.25 ? grey : white; }, { sides: 10 }),
      blob(0.06, 0.055, 0.052, white).at(0.3, 0.045, 0),
      sweep([[0.34, 0.04, 0], [0.4, 0.03, 0], [0.45, 0.018, 0]], function (u) { const r = 0.02 * (1 - u * 0.75); return [r, r * 0.8]; }, bill, { sides: 6 }),
      blob(0.009, 0.009, 0.006, BLACK, { lat: 4, lon: 6 }).at(0.325, 0.062, 0.045),
      blob(0.009, 0.009, 0.006, BLACK, { lat: 4, lon: 6 }).at(0.325, 0.062, -0.045),
      plate([[-0.3, 0.07], [-0.48, 0.11], [-0.5, 0], [-0.48, -0.11], [-0.3, -0.07]], white, "xz")
    ], mat);
    const wings = [];
    [-1, 1].forEach(function (s) {
      const inner = new T.Group();
      inner.position.set(0.04, 0.045, s * 0.06);
      c.group.add(inner);
      c.add([plate([[0.12, 0], [0.13, 0.36], [-0.02, 0.4], [-0.13, 0.36], [-0.14, 0]], grey, "xz")], mat, inner).scale.z = s;
      const outer = new T.Group();
      outer.position.set(0, 0, s * 0.37);
      inner.add(outer);
      c.add([plate([[0.13, 0], [0.06, 0.3], [-0.05, 0.42], [-0.12, 0.26], [-0.13, 0]], function (a, b) { return b > 0.26 ? tip : grey; }, "xz")], mat, outer).scale.z = s;
      wings.push({ inner: inner, outer: outer, s: s });
    });
    c.tick = function (cr, dt, t) {
      const beat = Math.sin(t * 5.2);
      const glide = sstep(-0.2, 0.5, Math.sin(t * 0.55 + 1));
      wings.forEach(function (w) {
        w.inner.rotation.x = -w.s * (beat * 0.42 * (1 - glide) + 0.1 * glide);
        w.outer.rotation.x = -w.s * (Math.sin(t * 5.2 - 0.9) * 0.38 * (1 - glide) - 0.14 * glide);
      });
    };
    c.done();
  })();

  /* ---------- people ---------- */

  const SKIN = C("#c08a66"), SKIN_DARK = C("#a8724f"), HAIR = C("#15100c");

  // A tapered limb through a list of [x, y, z, radius] stations.
  function limb(st, colour, sides, up) {
    return sweep(st.map(function (q) { return [q[0], q[1], q[2]]; }), function (u, i) { return [st[i][3], st[i][3] * (st[i][4] || 1)]; }, colour, { sides: sides || 9, up: up || [0, 0, 1] });
  }

  // A head about 23 cm tall, facing +x, centred on the skull.
  function headPieces(o) {
    o = o || {};
    const out = [];
    out.push(blob(0.098, 0.118, 0.086, function (nx, ny) { return ny > 0.4 - nx * 0.55 || nx < -0.5 ? HAIR : mixC(SKIN_DARK, SKIN, 0.5 + nx * 0.5); }, {
      lat: 14, lon: 18,
      bump: function (nx, ny, nz) {
        let b = 0;
        if (ny < -0.1) b -= (-ny - 0.1) * 0.24 * (0.35 + Math.abs(nz)); // the jaw narrows
        if (nx > 0.2 && ny < -0.45) b += 0.07 * (nx - 0.2);             // chin
        if (nx > 0.5 && ny > 0.05 && ny < 0.35) b += 0.02;              // brow
        if (nx < -0.3 && ny > -0.1) b += 0.035;                          // back of the skull
        return b;
      }
    }));
    if (o.hair !== false) {
      // short hair, pushed up at the front
      out.push(blob(0.1, 0.066, 0.09, HAIR, { lat: 9, lon: 14, bump: function (nx, ny, nz) { return (K.noise(nx * 7 + 2, nz * 7) - 0.5) * 0.2 + (nx > 0.2 ? 0.22 * Math.max(ny, 0) : 0); } }).at(-0.004, 0.068, 0));
    }
    out.push(sweep([[0.082, 0.022, 0], [0.108, -0.014, 0], [0.09, -0.034, 0]], function (u) { return [0.011 + u * 0.004, 0.013]; }, SKIN, { sides: 5, up: [0, 0, 1] }));
    [-1, 1].forEach(function (sd) {
      out.push(blob(0.015, 0.027, 0.009, SKIN_DARK, { lat: 4, lon: 6 }).at(-0.008, -0.004, sd * 0.088));
      if (o.glasses) {
        out.push(blob(0.01, 0.024, 0.032, C("#0b0d10"), { lat: 5, lon: 8 }).at(0.089, 0.018, sd * 0.04));
        out.push(rod([0.084, 0.024, sd * 0.07], [-0.006, 0.02, sd * 0.09], 0.005, 0.004, BLACK, 4));
      } else if (o.eyes !== false) {
        out.push(blob(0.006, 0.008, 0.012, BLACK, { lat: 4, lon: 6 }).at(0.088, 0.018, sd * 0.038));
      }
    });
    if (o.glasses) out.push(box(0.008, 0.008, 0.05, BLACK).at(0.094, 0.026, 0));
    return out;
  }

  // Det — a surfer sitting out past the break, waiting for the right set.
  // Dark quiff, sunglasses, black top: borrowed from the portrait at the top of the page.
  (function () {
    const c = new Creature("det", { home: [2.4, 0, -13.5], kind: "fixed", reach: 12, mask: "#ff8fab" });
    const suit = C("#101418"), suit2 = C("#1b2229"), trim = C("#1f9c8c"), board = C("#efece1"), rail = C("#cfcab8");
    const mat = c.mat({ sheen: 0.3 });
    const g = new T.Group();
    c.group.add(g);
    const wet = function (u, ang) { return Math.cos(ang) < -0.25 ? suit2 : suit; };

    // the board: nose rocker, a stripe down the deck, three fins and a leash
    const bx = [1.02, 0.9, 0.6, 0.2, -0.3, -0.7, -0.92, -0.99];
    const bw = [0.02, 0.12, 0.215, 0.262, 0.258, 0.2, 0.12, 0.05];
    const bt = [0.008, 0.022, 0.03, 0.034, 0.034, 0.03, 0.022, 0.01];
    const pieces = [
      sweep(bx.map(function (x) { return [x, 0.02 + 0.1 * Math.pow(Math.max(0, (x - 0.45) / 0.57), 2), 0]; }), function (u, i) { return [bt[i], bw[i]]; },
        function (u, ang, i, sa) { return Math.cos(ang) > 0.2 ? (Math.abs(sa) < 0.16 ? trim : Math.abs(sa) > 0.9 ? rail : board) : rail; }, { sides: 16, up: [0, 1, 0] }),
      plate([[-0.72, 0], [-0.9, -0.2], [-0.8, -0.02]], suit, "xy").at(0, -0.01, 0),
      plate([[-0.6, 0], [-0.74, -0.15], [-0.66, -0.02]], suit, "xy").at(0, -0.01, 0.17, 0.25, 0, 0),
      plate([[-0.6, 0], [-0.74, -0.15], [-0.66, -0.02]], suit, "xy").at(0, -0.01, -0.17, -0.25, 0, 0),
      sweep([[-0.93, 0.04, 0.03], [-0.95, -0.08, 0.1], [-0.7, -0.24, 0.26], [-0.2, -0.33, 0.36], [0.2, -0.35, 0.345]], function () { return [0.006, 0.006]; }, suit, { sides: 4 })
    ];
    // torso: pelvis, waist, ribs, chest, shoulders, neck (front of the body faces +x)
    const ty = [0.1, 0.2, 0.32, 0.44, 0.55, 0.62, 0.665, 0.7, 0.735];
    const tx = [-0.03, -0.025, -0.01, 0.01, 0.03, 0.045, 0.055, 0.062, 0.07];
    const td = [0.1, 0.095, 0.09, 0.1, 0.108, 0.098, 0.07, 0.047, 0.044];
    const tw = [0.165, 0.155, 0.138, 0.152, 0.178, 0.186, 0.12, 0.052, 0.048];
    pieces.push(sweep(ty.map(function (y, i) { return [tx[i], y, 0]; }), function (u, i) { return [td[i], tw[i]]; },
      function (u, ang, i, sa) { return i >= 7 ? SKIN : Math.abs(sa) > 0.82 && i > 1 && i < 5 ? trim : wet(u, ang); }, { sides: 14, up: [1, 0, 0] }));
    [-1, 1].forEach(function (sd) {
      pieces.push(blob(0.062, 0.06, 0.062, suit).at(0.045, 0.6, sd * 0.185));
      // legs astride the board: thigh along the rail, knee bent, shin and foot trailing in the water
      pieces.push(limb([[-0.03, 0.11, sd * 0.1, 0.092], [0.1, 0.12, sd * 0.2, 0.09], [0.24, 0.1, sd * 0.29, 0.075], [0.31, 0.04, sd * 0.325, 0.058]], wet, 10, [0, 1, 0]));
      pieces.push(limb([[0.31, 0.05, sd * 0.325, 0.056], [0.3, -0.1, sd * 0.34, 0.056], [0.26, -0.26, sd * 0.345, 0.042], [0.235, -0.36, sd * 0.345, 0.033]],
        function (u) { return u < 0.3 ? suit : SKIN; }, 9, [1, 0, 0]));
      pieces.push(limb([[0.225, -0.365, sd * 0.345, 0.03], [0.27, -0.4, sd * 0.345, 0.03, 1.3], [0.36, -0.43, sd * 0.35, 0.02, 1.9], [0.41, -0.44, sd * 0.35, 0.012, 1.8]], SKIN, 7, [0, 1, 0]));
    });
    c.add(pieces, mat, g);

    // head and arms move on their own
    const head = new T.Group();
    head.position.set(0.085, 0.835, 0);
    g.add(head);
    c.add(headPieces({ glasses: true }), mat, head);
    const arms = [-1, 1].map(function (sd) {
      const sh = new T.Group();
      sh.position.set(0.045, 0.6, sd * 0.19);
      g.add(sh);
      // upper arm, elbow, forearm, hand: at rest the hand sits on the thigh
      c.add([
        limb([[0, 0, 0, 0.052], [0.04, -0.11, sd * 0.03, 0.05], [0.09, -0.24, sd * 0.05, 0.04], [0.16, -0.33, sd * 0.03, 0.037], [0.24, -0.4, sd * 0.0, 0.03]],
          function (u) { return u < 0.36 ? suit : u < 0.4 ? trim : SKIN; }, 9, [1, 0, 0]),
        blob(0.05, 0.018, 0.034, SKIN, { lat: 5, lon: 8 }).at(0.285, -0.42, sd * -0.005, 0, 0, -0.35),
        rod([0.26, -0.41, sd * -0.035], [0.31, -0.415, sd * -0.055], 0.011, 0.008, SKIN, 5)
      ], mat, sh);
      return sh;
    });

    let wave = 0, look = 0;
    c.onPoke = function () { wave = 3.2; };
    c.tick = function (cr, dt, t) {
      cr.group.visible = !S.under;
      const x = cr.home.x + cr.offset.x + Math.sin(t * 0.05) * 1.2, z = cr.home.z + cr.offset.z;
      const h = D.seaHeight(x, z);
      const hx = D.seaHeight(x + 0.6, z) - D.seaHeight(x - 0.6, z);
      const hz = D.seaHeight(x, z + 0.3) - D.seaHeight(x, z - 0.3);
      cr.pos.set(x, h - 0.03, z);
      const yaw = 0.5 + Math.sin(t * 0.13) * 0.25;
      cr.group.rotation.set(-Math.atan2(hz, 0.6) * 0.8, yaw, Math.atan2(hx, 1.2) * 0.8);
      // scan the horizon for sets; turn to whoever is paying attention
      const cam = D.camera.position;
      const toCam = Math.atan2(-(cam.z - z), cam.x - x) - yaw;
      let want = Math.sin(t * 0.31) * 0.6 + Math.sin(t * 0.13 + 2) * 0.3;
      if (cr.hover || cr.talking || cr.held || wave > 0) { want = Math.atan2(Math.sin(toCam), Math.cos(toCam)); want = clamp(want, -1.25, 1.25); }
      look = lerp(look, want, 1 - Math.exp(-dt * 3));
      head.rotation.set(0, look, Math.sin(t * 0.4) * 0.04);
      g.rotation.y = look * 0.18;
      wave = Math.max(0, wave - dt);
      const up = sstep(0, 0.4, wave) * sstep(0, 0.5, Math.min(wave, 3.2 - wave + 0.5));
      const breathe = Math.sin(t * 1.1) * 0.015;
      arms[0].rotation.set(0, 0, breathe);
      arms[1].rotation.set(Math.sin(t * 9) * 0.28 * up, 0, breathe + up * 2.25);
    };
    c.done();
  })();

  // Git — a school of blue-green chromis holding over one coral head.
  (function () {
    const top = C("#2f9a8f"), side = C("#7fe0cf"), belly = C("#d9f5ea");
    const geo = K.build(fishPieces({
      len: 0.2, h: 0.092, w: 0.034, nose: 0.5, round: 0.72, ped: 0.2, colour: shade(top, side, belly),
      tail: { len: 0.26, span: 1.2, fork: 0.6, col: mulC(side, 0.85) },
      dorsal: [[0.26, 0.82, 0.2, mulC(top, 0.9), 0.25, 0.7]], anal: [[0.56, 0.84, 0.16, mulC(side, 0.9)]],
      pect: [0.3, 0.16, 0.1, mulC(side, 1.1)], eye: 0.11, eyeLod: 3, sides: 8, stations: 10
    }));
    const mat = matter({ mode: 1, amp: 0.09, freq: 0.9, len: 0.2, sheen: 0.5, mask: "#58e6ff" });
    const spot = D.wallAt ? D.wallAt(0.3, -22.4, 1.7, new T.Vector3()) : new T.Vector3(-8.2, -22.6, -9.2);
    const s = new School("git", geo, mat, { n: 46, home: [spot.x, spot.y, spot.z], range: [0.5, 0.35, 0.4], spread: [1.3, 0.9, 1.0], speed: 0.18, fishLen: 0.2, tight: 1, label: "Blue-green chromis", latin: "Chromis viridis", mask: "#58e6ff" });
    s.beat = 13;
    // The school answers as one animal.
    const c = new Creature("git", { home: [spot.x, spot.y, spot.z], kind: "fixed", reach: 30, mask: "#58e6ff" });
    c.box.set(new T.Vector3(-1.5, -1.0, -1.2), new T.Vector3(1.5, 1.0, 1.2));
    c.school = s;
    c.ownOffset = false;
    s.shift = c.offset;
    c.tick = function (cr) { cr.pos.copy(s.centre); };
    c.onPoke = function () { s.fish.forEach(function (f) { f.fx += rand(-1, 1) * 1.6; f.fy += rand(-1, 1) * 0.9; f.fz += rand(-1, 1) * 1.6; }); };
  })();

  // Fusiliers — the open-water school that parts around the pointer.
  (function () {
    const top = C("#2a7fb8"), side = C("#8fc4e6"), belly = C("#eef4f4"), gold = C("#e8c33a");
    const geo = K.build(fishPieces({
      len: 0.36, h: 0.095, w: 0.05, nose: 0.6, round: 0.78, ped: 0.16,
      colour: function (u, ang) { const k = Math.cos(ang); return k > 0.72 ? gold : k > 0.4 ? mixC(side, top, sstep(0.4, 0.72, k)) : mixC(belly, side, sstep(-0.6, 0.4, k)); },
      tail: { len: 0.24, span: 1.5, fork: 0.72, col: gold }, dorsal: [[0.3, 0.8, 0.14, top, 0.2, 0.6]], anal: [[0.6, 0.84, 0.1, belly]],
      pect: [0.27, 0.13, 0.07, side], eye: 0.1, eyeLod: 3, eyeRing: false, sides: 7, stations: 9
    }));
    const mat = matter({ mode: 1, amp: 0.07, freq: 1.0, len: 0.36, sheen: 0.8, mask: "#ffd166" });
    const s = new School("fusiliers", geo, mat, { n: LITE ? 60 : 120, home: [4.5, -15.5, -13], range: [8, 2.2, 3.5], spread: [3.4, 1.4, 2.2], speed: 0.085, fishLen: 0.36, label: "Yellowback fusilier", latin: "Caesio xanthonota", mask: "#ffd166" });
    s.beat = 10;
  })();

  // Anthias — the orange cloud that hangs over every healthy reef crest.
  (function () {
    if (!D.wallAt) return;
    const top = C("#d9632a"), side = C("#f08a3c"), belly = C("#f7c58a"), fin = C("#c2478c");
    const geo = K.build(fishPieces({
      len: 0.15, h: 0.052, w: 0.022, nose: 0.55, round: 0.75, ped: 0.2, colour: shade(top, side, belly),
      tail: { len: 0.3, span: 1.6, fork: 0.7, col: fin }, dorsal: [[0.25, 0.8, 0.22, fin, 0.15, 0.6]], anal: [[0.6, 0.82, 0.14, fin]],
      eye: 0.14, eyeLod: 3, eyeRing: false, sides: 6, stations: 8
    }));
    const mat = matter({ mode: 1, amp: 0.09, freq: 0.9, len: 0.15, sheen: 0.4, mask: "#ff922b" });
    const spot = D.wallAt(0.36, -10.5, 3.2, new T.Vector3());
    const s = new School("anthias", geo, mat, { n: LITE ? 40 : 80, home: [spot.x, spot.y, spot.z], range: [1.2, 0.5, 0.8], spread: [5.5, 1.5, 3.2], speed: 0.11, fishLen: 0.15, tight: 1, label: "Sea goldie", latin: "Pseudanthias squamipinnis", mask: "#ff922b" });
    s.beat = 14;
  })();

  // Python — green sea turtle.
  (function () {
    const c = new Creature("python", { home: [0.6, -12.5, -9.5], range: [6, 2.2, 3], speed: 0.085, mask: "#9be564" });
    const shell = C("#5b4a2c"), shellDark = C("#2b2414"), shellLight = C("#8a7a45"), skinC = C("#6d6a4c"), scale = C("#2f3323"), under = C("#d9cf9d");
    const mat = c.mat({ sheen: 0.25 });
    const scute = function (nx, ny, nz) {
      if (ny < -0.05) return under;
      const a = Math.atan2(nz, nx), r = Math.hypot(nx, nz);
      const seam = Math.min(Math.abs(Math.sin(a * 2.5)), Math.abs(Math.sin(r * 7.5)));
      const base = mixC(shell, shellLight, K.fbm(nx * 5 + 3, nz * 5) * 0.9);
      return mixC(shellDark, base, sstep(0.05, 0.3, seam));
    };
    const skin = function (nx, ny, nz) { return ny < -0.3 ? under : mixC(scale, skinC, sstep(0.25, 0.6, K.noise(nx * 9 + 1, nz * 9 + ny * 7))); };
    c.add([
      blob(0.5, 0.2, 0.41, scute, { lat: 20, lon: 34, flat: 0.45 }),
      blob(0.13, 0.1, 0.1, skin).at(0.6, 0.02, 0),
      sweep([[0.42, 0, 0], [0.52, 0.01, 0]], function () { return [0.075, 0.085]; }, skinC, { sides: 8 }),
      blob(0.014, 0.014, 0.008, BLACK, { lat: 4, lon: 6 }).at(0.65, 0.045, 0.088),
      blob(0.014, 0.014, 0.008, BLACK, { lat: 4, lon: 6 }).at(0.65, 0.045, -0.088),
      plate([[-0.46, 0.03], [-0.62, 0], [-0.46, -0.03]], skinC, "xz")
    ], mat);
    const flip = function (x, z, s, long, wide, rear) {
      const g = new T.Group();
      g.position.set(x, -0.03, s * z);
      c.group.add(g);
      // a paddle: thick at the leading edge, swept back toward the tip
      const pts = rear
        ? [[0, 0, 0], [-long * 0.35, 0, wide * 0.5], [-long * 0.8, 0, wide * 0.75], [-long, 0, wide * 0.7]]
        : [[0, 0, 0], [0.04, 0, long * 0.3], [-0.02, 0, long * 0.65], [-0.16, 0, long * 0.92], [-0.24, 0, long]];
      const chord = rear ? [0.05, 0.085, 0.07, 0.02] : [0.07, 0.11, 0.1, 0.06, 0.015];
      c.add([K.sweep(pts, function (u, i) { return [0.016 * (1 - u * 0.6), chord[i]]; }, function (u, ang, i, sa) { return Math.cos(ang) < -0.3 ? under : mixC(scale, skinC, K.noise(u * 12, sa * 3 + 2)); }, { sides: 8, up: [0, 1, 0] })], mat, g).scale.z = s;
      return g;
    };
    const fl = [flip(0.3, 0.3, 1, 0.62, 0.2), flip(0.3, 0.3, -1, 0.62, 0.2)];
    const rr = [flip(-0.36, 0.26, 1, 0.26, 0.17, true), flip(-0.36, 0.26, -1, 0.26, 0.17, true)];
    c.tick = function (cr, dt, t) {
      const w = t * 1.5;
      fl.forEach(function (g, i) { const s = i ? -1 : 1; g.rotation.x = -s * Math.sin(w) * 0.6; g.rotation.y = s * (0.25 + Math.cos(w) * 0.28); });
      rr.forEach(function (g, i) { const s = i ? -1 : 1; g.rotation.x = -s * Math.sin(w + 1.2) * 0.14; });
      cr.pos.y += Math.sin(w - 0.6) * 0.035;
    };
    c.done();
  })();

  // GAN — blacktip reef shark on patrol.
  (function () {
    const c = new Creature("gan", { home: [9, -29.5, -4], range: [13, 2.6, 11.5], speed: 0.085, kind: "circle", mask: "#ff6b6b" });
    const top = C("#6f6a58"), side = C("#8d8672"), belly = C("#eeeadf"), ink = C("#0c0d0e");
    const L = 1.75;
    const mat = c.mat({ mode: 1, amp: 0.06, freq: 0.85, len: L, sheen: 0.3 });
    const body = fishPieces({
      len: L, h: 0.31, w: 0.25, nose: 0.5, round: 0.62, ped: 0.13, stations: 24, sides: 14,
      colour: function (u, ang) { const k = Math.cos(ang); const band = sstep(-0.05, 0.12, k); return k > 0.12 ? mixC(side, top, sstep(0.12, 0.7, k)) : mixC(belly, side, band * 0.5); },
      tail: { len: 0.2, span: 2.3, fork: 0.55, low: 0.48, lowLen: 0.6, col: function (a, b) { return b < -0.1 || b > 0.3 ? ink : side; } },
      dorsal: [[0.36, 0.52, 0.62, function (a, b) { return b > 0.27 ? ink : top; }, 0.75, 0.25], [0.78, 0.86, 0.18, top, 0.7, 0.3]],
      anal: [[0.8, 0.87, 0.16, belly]], eye: 0.045, eyeU: 0.09, eyeRing: C("#b8b39a")
    });
    [-1, 1].forEach(function (s) {
      body.push(plate([[0.14, 0], [-0.1, 0.42], [-0.22, 0.4], [-0.12, 0]], function (a, b) { return b > 0.33 ? ink : side; }, "xz").at(L / 2 - 0.34 * L, -0.08, s * 0.1, s * 0.5, 0, 0, [1, 1, s]));
      body.push(plate([[0.06, 0], [-0.05, 0.16], [-0.12, 0.14], [-0.07, 0]], belly, "xz").at(L / 2 - 0.66 * L, -0.07, s * 0.06, s * 0.6, 0, 0, [1, 1, s]));
    });
    c.add(body, mat);
    c.tick = function (cr, dt, t) { mat.uniforms.uPhase.value += dt * 4.2 * (0.5 + cr.slow * 0.5); };
    c.done();
  })();

  // Seg — a scuba diver with a camera, working along the reef.
  (function () {
    const c = new Creature("seg", { home: [1.4, -19.2, -11], range: [5.8, 1.8, 2.4], speed: 0.062, mask: "#c792ea" });
    const suit = C("#12161a"), suit2 = C("#1e252c"), trim = C("#19a39a"), tank = C("#c9d0d4"), steel = C("#8e989d"), glass = C("#0a1a24"), fin = C("#19a39a"), bcd = C("#22292f");
    const mat = c.mat({ sheen: 0.3 });
    const g = c.group;
    const wet = function (u, ang) { return Math.cos(ang) > 0.35 ? suit2 : suit; };
    // prone, head toward +x: hips, waist, chest, shoulders, neck
    const sx = [-0.38, -0.26, -0.1, 0.08, 0.24, 0.34, 0.41, 0.46];
    const sh = [0.1, 0.098, 0.092, 0.105, 0.112, 0.1, 0.06, 0.05];
    const sw = [0.165, 0.158, 0.142, 0.158, 0.182, 0.185, 0.085, 0.055];
    const pieces = [
      sweep(sx.map(function (x, i) { return [x, i > 5 ? 0.02 : 0, 0]; }), function (u, i) { return [sh[i], sw[i]]; },
        function (u, ang, i, sa) { return Math.abs(sa) > 0.85 && i > 0 && i < 5 ? trim : wet(u, ang); }, { sides: 14 }),
      // buoyancy jacket and tank
      sweep([[0.3, 0.07, 0], [0.12, 0.085, 0], [-0.12, 0.075, 0]], function (u) { return [0.07, lerp(0.19, 0.17, u)]; }, bcd, { sides: 12 }),
      sweep([[0.36, 0.215, 0], [0.33, 0.22, 0], [0.1, 0.225, 0], [-0.24, 0.225, 0], [-0.29, 0.22, 0], [-0.31, 0.21, 0]], function (u, i) { const r = [0.03, 0.085, 0.092, 0.092, 0.08, 0.03][i]; return [r, r]; }, tank, { sides: 14 }),
      blob(0.035, 0.04, 0.035, steel).at(0.385, 0.215, 0),
      box(0.03, 0.02, 0.2, steel).at(0.1, 0.13, 0), box(0.03, 0.02, 0.2, steel).at(-0.18, 0.13, 0),
      // hood, face, mask and regulator
      blob(0.112, 0.118, 0.1, function (nx, ny) { return nx > 0.5 && ny > -0.55 && ny < 0.45 ? SKIN : suit; }, { lat: 12, lon: 16 }).at(0.56, 0.04, 0),
      box(0.045, 0.085, 0.165, glass).at(0.66, 0.055, 0),
      box(0.02, 0.105, 0.19, trim).at(0.642, 0.055, 0),
      box(0.012, 0.03, 0.215, BLACK).at(0.6, 0.06, 0),
      blob(0.04, 0.036, 0.046, steel).at(0.665, -0.035, 0),
      sweep([[0.665, -0.04, 0.035], [0.57, -0.1, 0.15], [0.36, 0.06, 0.19], [0.36, 0.2, 0.05]], function () { return [0.011, 0.011]; }, BLACK, { sides: 5 }),
      sweep([[0.36, 0.2, -0.05], [0.3, 0.05, -0.2], [0.2, -0.08, -0.18]], function () { return [0.01, 0.01]; }, BLACK, { sides: 5 }),
      // camera housing with two strobes, held out in front
      box(0.2, 0.15, 0.2, C("#20262c")).at(1.0, -0.1, 0),
      blob(0.075, 0.075, 0.075, glass).at(1.1, -0.1, 0),
      rod([0.97, -0.03, 0.1], [1.02, 0.1, 0.3], 0.012, 0.012, steel), rod([0.97, -0.03, -0.1], [1.02, 0.1, -0.3], 0.012, 0.012, steel),
      blob(0.04, 0.034, 0.034, C("#2a3036")).at(1.04, 0.1, 0.3), blob(0.012, 0.028, 0.028, C("#dfe6ea"), { glow: [0.35, 0.4, 0.42] }).at(1.08, 0.1, 0.3),
      blob(0.04, 0.034, 0.034, C("#2a3036")).at(1.04, 0.1, -0.3), blob(0.012, 0.028, 0.028, C("#dfe6ea"), { glow: [0.35, 0.4, 0.42] }).at(1.08, 0.1, -0.3)
    ];
    [-1, 1].forEach(function (sd) {
      pieces.push(blob(0.062, 0.058, 0.06, suit).at(0.33, 0, sd * 0.185));
      pieces.push(limb([[0.33, -0.01, sd * 0.19, 0.052], [0.46, -0.08, sd * 0.215, 0.049], [0.6, -0.13, sd * 0.2, 0.04], [0.76, -0.115, sd * 0.14, 0.036], [0.89, -0.1, sd * 0.11, 0.03]],
        function (u) { return u > 0.93 ? suit2 : wet(u, 1); }, 9, [0, 1, 0]));
      pieces.push(blob(0.045, 0.03, 0.034, suit2, { lat: 5, lon: 8 }).at(0.92, -0.1, sd * 0.105));
    });
    c.add(pieces, mat);
    const legs = [-1, 1].map(function (sd) {
      const hip = new T.Group();
      hip.position.set(-0.36, -0.01, sd * 0.09);
      g.add(hip);
      c.add([limb([[0, 0, 0, 0.09], [-0.2, 0.01, 0, 0.088], [-0.42, 0.015, 0, 0.066], [-0.5, 0.01, 0, 0.058], [-0.66, 0, 0, 0.056], [-0.84, -0.005, 0, 0.04], [-0.9, -0.005, 0, 0.036]],
        function (u, ang, i) { return i === 2 ? trim : wet(u, ang); }, 10, [0, 1, 0])], mat, hip);
      const blade = new T.Group();
      blade.position.set(-0.9, 0, 0);
      hip.add(blade);
      c.add([
        limb([[0.04, 0, 0, 0.04, 1.2], [-0.1, 0, 0, 0.03, 1.8]], suit, 8, [0, 1, 0]),
        plate([[-0.06, 0.06], [-0.3, 0.1], [-0.7, 0.13], [-0.74, 0], [-0.7, -0.13], [-0.3, -0.1], [-0.06, -0.06]], function (a, b) { return a < -0.55 || Math.abs(b) > 0.085 ? mulC(fin, 0.55) : fin; }, "xz", { hub: [-0.3, 0] })
      ], mat, blade);
      return { hip: hip, blade: blade, s: sd };
    });
    let breath = rand(0, 3);
    const mouth = new T.Vector3();
    c.onPoke = function (cr) { mouth.set(0.68, 0.02, 0).applyMatrix4(cr.group.matrixWorld); D.spawnBubbles(mouth.x, mouth.y, mouth.z, 16, 0.2, 0.09); };
    c.tick = function (cr, dt, t) {
      const w = t * 2.6;
      legs.forEach(function (l) {
        l.hip.rotation.z = Math.sin(w + (l.s > 0 ? 0 : PI)) * 0.26 * (0.4 + cr.slow * 0.6);
        l.blade.rotation.z = Math.sin(w + (l.s > 0 ? 0 : PI) - 1.1) * 0.5;
      });
      breath -= dt;
      if (breath < 0) {
        breath = rand(3.2, 4.6);
        mouth.set(0.68, 0.02, 0).applyMatrix4(cr.group.matrixWorld);
        D.spawnBubbles(mouth.x, mouth.y, mouth.z, 9, 0.16, 0.085);
      }
    };
    c.done();
  })();

  // Pip — a yellow seahorse, tail around a sea whip on the wall.
  (function () {
    const spot = D.wallAt ? D.wallAt(0.235, -35.4, 0.75, new T.Vector3()) : new T.Vector3(-5.6, -35.2, -6.6);
    const c = new Creature("pip", { home: [spot.x, spot.y, spot.z], kind: "fixed", reach: 30, mask: "#ffe66d" });
    const y1 = C("#e0a81c"), y2 = C("#f7d657"), y3 = C("#9a6d10");
    const mat = c.mat({ sheen: 0.25 });
    // side view, facing +x: bowed head, arched neck, round belly, tail curled forward
    const path = [[0.075, 0.6, 0], [0.045, 0.625, 0], [0.0, 0.61, 0], [-0.04, 0.55, 0], [-0.065, 0.47, 0], [-0.055, 0.39, 0], [-0.02, 0.31, 0], [0.02, 0.23, 0], [0.035, 0.14, 0], [0.015, 0.05, 0], [-0.03, -0.04, 0], [-0.065, -0.13, 0], [-0.075, -0.22, 0], [-0.05, -0.3, 0], [0.005, -0.34, 0], [0.06, -0.32, 0], [0.085, -0.265, 0], [0.07, -0.215, 0], [0.035, -0.205, 0], [0.02, -0.235, 0]];
    const rad = [0.03, 0.052, 0.06, 0.05, 0.036, 0.04, 0.058, 0.078, 0.088, 0.074, 0.054, 0.042, 0.034, 0.028, 0.023, 0.019, 0.015, 0.012, 0.009, 0.005];
    const body = function (u, ang, i) { return mixC(i % 2 ? y1 : y3, y2, Math.cos(ang) > -0.2 ? 0.75 : 0.35); };
    c.add([
      sweep(path, function (u, i) { return [rad[i], rad[i] * 0.72]; }, body, { sides: 9, up: [0, 0, 1] }),
      // the long snout, angled down
      sweep([[0.06, 0.6, 0], [0.13, 0.565, 0], [0.2, 0.53, 0], [0.225, 0.52, 0]], function (u) { return [u > 0.9 ? 0.02 : 0.017, 0.015]; }, y1, { sides: 6, up: [0, 0, 1] }),
      // coronet and brow spines
      sweep([[0.0, 0.655, 0], [-0.015, 0.7, 0], [-0.005, 0.72, 0]], function (u) { return [0.022 * (1 - u * 0.5), 0.02 * (1 - u * 0.5)]; }, y3, { sides: 5, up: [0, 0, 1] }),
      blob(0.014, 0.014, 0.009, BLACK, { lat: 4, lon: 6 }).at(0.055, 0.625, 0.04), blob(0.014, 0.014, 0.009, BLACK, { lat: 4, lon: 6 }).at(0.055, 0.625, -0.04),
      plate([[-0.09, 0.36], [-0.155, 0.335], [-0.17, 0.27], [-0.15, 0.21], [-0.095, 0.2]], mulC(y2, 1.15), "xy"),
      plate([[0.03, 0.57], [0.02, 0.535], [0.045, 0.545]], y2, "xy").at(0, 0, 0.045)
    ], mat);
    // its holdfast
    const whip = matter({ mode: 5, amp: 0.012, freq: 0.9, len: 2.2, mask: "#ffe66d" });
    const stalk = mesh([
      sweep([[0.02, -1.3, 0.0], [0.05, -0.8, 0], [0.055, -0.28, 0.0], [0.05, 0.3, 0], [0.08, 0.8, 0.02], [0.13, 1.2, 0.04]], function (u) { const r = lerp(0.02, 0.008, u); return [r, r]; }, function (u, a, i, sa) { return mixC(C("#8e2f2a"), C("#d8693f"), K.noise(u * 40, sa * 3)); }, { sides: 6 })
    ], whip);
    stalk.userData.skipBox = true;
    c.group.add(stalk);
    c.group.scale.setScalar(1.3);
    c.tick = function (cr, dt, t) { cr.group.rotation.set(0, 0.25 + Math.sin(t * 0.4) * 0.22, Math.sin(t * 0.7) * 0.05); };
    c.done();
  })();

  // Docker — a sperm whale passing in the distance.
  (function () {
    const c = new Creature("docker", { home: [22, -59, -14], range: [26, 3.5, 15], speed: 0.026, kind: "circle", reach: 34, mask: "#74c0fc" });
    const L = 15;
    const skin = C("#3d444d"), dark = C("#22272e"), pale = C("#9aa0a2");
    const mat = c.mat({ mode: 2, amp: 0.045, freq: 0.55, len: L, sheen: 0.12 });
    const ry = [0.55, 0.9, 1, 1.02, 1, 0.97, 0.9, 0.8, 0.66, 0.5, 0.36, 0.25, 0.17, 0.12];
    const rz = [0.5, 0.74, 0.8, 0.8, 0.82, 0.84, 0.8, 0.7, 0.56, 0.42, 0.3, 0.2, 0.13, 0.09];
    const n = ry.length - 1;
    const path = [];
    for (let i = 0; i <= n; i++) path.push([L / 2 - (i / n) * L * 0.9 - (i === 0 ? 0 : 0.2), i < 3 ? 0.12 : 0, 0]);
    const pieces = [
      sweep(path, function (u, i) { return [ry[i] * 1.5, rz[i] * 1.5]; }, function (u, ang, i, sa) {
        const k = Math.cos(ang);
        const wr = u > 0.33 ? K.noise(u * 60, sa * 4 + ang * 3) : 0.5;
        const base = mixC(dark, skin, 0.35 + wr * 0.65);
        return k < -0.75 && u < 0.3 ? mixC(base, pale, 0.6) : mixC(mulC(base, 0.8), base, sstep(-0.6, 0.4, k));
      }, { sides: 18 }),
      // narrow lower jaw
      sweep([[L / 2 - 0.9, -1.35, 0], [L / 2 - 2.6, -1.5, 0], [L / 2 - 4.2, -1.42, 0]], function (u) { return [0.12, lerp(0.16, 0.34, u)]; }, pale, { sides: 8 }),
      // flukes
      plate([[0.5, 0], [-0.3, 1.9], [-1.25, 2.15], [-0.95, 0.9], [-0.7, 0], [-0.95, -0.9], [-1.25, -2.15], [-0.3, -1.9]], dark, "xz", { hub: [-0.3, 0] }).at(-L / 2 + 1.6, 0, 0),
      // dorsal hump and flippers
      plate([[0.9, 0], [0.1, 0.5], [-0.5, 0.42], [-1.1, 0]], skin, "xy").at(-L * 0.16, 1.02, 0),
      blob(0.07, 0.07, 0.03, BLACK, { lat: 4, lon: 6 }).at(L / 2 - 3.6, -0.5, 1.22), blob(0.07, 0.07, 0.03, BLACK, { lat: 4, lon: 6 }).at(L / 2 - 3.6, -0.5, -1.22)
    ];
    [-1, 1].forEach(function (s) {
      pieces.push(plate([[0.5, 0], [0.2, 1.0], [-0.5, 1.15], [-0.75, 0.2], [-0.5, 0]], skin, "xz").at(L / 2 - 4.6, -0.95, s * 1.05, s * 0.7, 0, 0, [1, 1, s]));
    });
    c.add(pieces, mat);
    c.tick = function (cr, dt) { mat.uniforms.uPhase.value += dt * 1.1; };
    c.done();
  })();

  // Jellies: Conda the moon jelly, and the bloom it drifts with.
  function jellyPieces(R, tint) {
    const bell = C("#bfe6f2"), edge = C("#e9fbff"), gon = tint || C("#d9a6e8");
    const prof = [];
    for (let i = 0; i <= 10; i++) { const a = (i / 10) * PI * 0.5; prof.push([Math.sin(a) * R, (Math.cos(a) - 1) * R * 0.52]); }
    prof.push([R * 0.93, -R * 0.56], [R * 0.6, -R * 0.4], [R * 0.2, -R * 0.33], [0.001, -R * 0.31]);
    const out = [lathe(prof, function (v) { return v > 0.6 && v < 0.75 ? edge : bell; }, { seg: 24, scallop: function (a, v) { return v > 0.6 && v < 0.75 ? 1 + 0.03 * Math.cos(a * 8) : 1; } })];
    // four horseshoe gonads, the moon jelly's signature
    for (let q = 0; q < 4; q++) {
      const a0 = q * PI / 2 + PI / 4;
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const a = -2.2 + (k / 8) * 4.4;
        pts.push([Math.cos(a0) * R * 0.34 + Math.cos(a + a0) * R * 0.17, -R * 0.2, Math.sin(a0) * R * 0.34 + Math.sin(a + a0) * R * 0.17]);
      }
      out.push(sweep(pts, function () { return [R * 0.035, R * 0.035]; }, gon, { sides: 5, glow: function () { return mulC(gon, 0.22); } }));
    }
    // marginal fringe and four oral arms
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * TAU + rand(-0.03, 0.03);
      const len = R * rand(0.25, 0.5);
      out.push(rod([Math.cos(a) * R * 0.96, -R * 0.55, Math.sin(a) * R * 0.96], [Math.cos(a) * R * 1.0, -R * 0.55 - len, Math.sin(a) * R * 1.0], R * 0.012, R * 0.004, edge, 3));
    }
    for (let q = 0; q < 4; q++) {
      const a = q * PI / 2;
      out.push(plate([[0, 0], [R * 0.09, -R * 0.3], [R * 0.05, -R * 0.6], [R * 0.1, -R * 0.9], [R * 0.01, -R * 1.15], [-R * 0.05, -R * 0.75], [-R * 0.03, -R * 0.3]], edge, "xy", { bend: function (x, y) { return Math.sin(y * 9 / R) * R * 0.05; } }).at(0, -R * 0.34, 0, 0, a, 0).at(Math.cos(a) * R * 0.08, 0, -Math.sin(a) * R * 0.08));
    }
    return out;
  }
  (function () {
    const c = new Creature("conda", { home: [-3.4, -52, -7.6], range: [1.0, 1.1, 0.8], speed: 0.07, kind: "drift", reach: 30, mask: "#f783ac" });
    const R = 0.42;
    const mat = c.mat({ mode: 4, amp: 0.2, freq: 3.2, len: R * 0.56, opacity: 0.34, rim: 1.4, sheen: 0.3, selfLit: 0.05 });
    c.add(jellyPieces(R), mat);
    c.tick = function (cr, dt, t) {
      mat.uniforms.uPhase.value += dt * 2.1;
      cr.group.rotation.set(Math.sin(t * 0.21) * 0.22, t * 0.05, Math.cos(t * 0.17) * 0.22);
      cr.pos.y += Math.pow(0.5 + 0.5 * Math.sin(mat.uniforms.uPhase.value - 0.8), 2) * 0.06;
    };
    c.done();
    // the rest of the bloom, further off
    const geo = K.build(jellyPieces(0.3, C("#b8c9f2")));
    const bm = matter({ mode: 4, amp: 0.2, freq: 3.2, len: 0.3 * 0.56, opacity: 0.3, rim: 1.4, selfLit: 0.05, mask: "#f783ac" });
    const bloom = new T.InstancedMesh(geo, bm, 16);
    const inst = new Float32Array(16 * 4);
    const spots = [];
    for (let i = 0; i < 16; i++) {
      inst[i * 4] = rand(0, TAU);
      { const a = rand(0, TAU), r = rand(7, 22); spots.push({ x: Math.cos(a) * r, y: rand(-47, -70), z: Math.sin(a) * r, s: rand(0.7, 1.6), ph: rand(0, TAU), r: rand(-0.3, 0.3) }); }
    }
    geo.setAttribute("aInst", new T.InstancedBufferAttribute(inst, 4));
    bloom.frustumCulled = false;
    D.scene.add(bloom);
    D.onFrame(function (dt, t) {
      bloom.visible = S.camY < -30 && S.camY > -92;
      if (!bloom.visible) return;
      bm.uniforms.uPhase.value = t * 1.9;
      spots.forEach(function (p, i) {
        dummy.position.set(p.x + Math.sin(t * 0.07 + p.ph) * 1.2, p.y + Math.sin(t * 0.11 + p.ph * 2) * 0.9, p.z);
        dummy.rotation.set(p.r + Math.sin(t * 0.2 + p.ph) * 0.2, p.ph, p.r);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        bloom.setMatrixAt(i, dummy.matrix);
      });
      bloom.instanceMatrix.needsUpdate = true;
    });
  })();

  // Neuron — veined squid, jetting mantle-first.
  (function () {
    const c = new Creature("neuron", { home: [2.2, -69, -9], range: [5.5, 2.4, 2.5], speed: 0.13, mask: "#ffa94d" });
    const L = 0.95;
    const pale = C("#e9cfc6"), red = C("#a8452f"), eye = C("#d8dde0");
    const mat = c.mat({ mode: 1, amp: 0.035, freq: 1.1, len: L * 1.7, sheen: 0.6, opacity: 0.9, rim: 0.6 });
    const speck = function (u, ang, i, sa) { const n = K.noise(u * 46, sa * 7 + ang * 5); return mixC(pale, red, sstep(0.45, 0.75, n) * (Math.cos(ang) > -0.2 ? 0.9 : 0.35)); };
    const pieces = [
      sweep([[L * 0.5, 0, 0], [L * 0.4, 0, 0], [L * 0.2, 0, 0], [0, 0, 0], [-L * 0.16, 0, 0], [-L * 0.2, 0, 0]], function (u) { const r = [0.012, 0.06, 0.1, 0.115, 0.105, 0.08][Math.round(u * 5)]; return [r, r]; }, speck, { sides: 12 }),
      blob(0.085, 0.075, 0.08, speck.bind(null, 0.5, 1, 0)).at(-L * 0.27, 0, 0),
      blob(0.034, 0.034, 0.016, eye, { lat: 5, lon: 8 }).at(-L * 0.28, 0.005, 0.074), blob(0.034, 0.034, 0.016, eye, { lat: 5, lon: 8 }).at(-L * 0.28, 0.005, -0.074),
      blob(0.018, 0.018, 0.012, BLACK, { lat: 4, lon: 6 }).at(-L * 0.28, 0.005, 0.086), blob(0.018, 0.018, 0.012, BLACK, { lat: 4, lon: 6 }).at(-L * 0.28, 0.005, -0.086)
    ];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const dy = Math.cos(a) * 0.035, dz = Math.sin(a) * 0.035;
      pieces.push(sweep([[-L * 0.33, dy, dz], [-L * 0.48, dy * 1.5, dz * 1.5], [-L * 0.62, dy * 1.3, dz * 1.3], [-L * 0.72, dy * 0.8, dz * 0.8]], function (u) { const r = lerp(0.02, 0.004, u); return [r, r]; }, pale, { sides: 5 }));
    }
    [-1, 1].forEach(function (s) {
      pieces.push(sweep([[-L * 0.33, -0.01, s * 0.02], [-L * 0.6, -0.03, s * 0.03], [-L * 0.92, -0.01, s * 0.02], [-L * 1.02, 0, s * 0.02]], function (u) { return u > 0.8 ? [0.014, 0.02] : [0.008, 0.008]; }, pale, { sides: 5 }));
    });
    c.add(pieces, mat);
    const finMat = c.mat({ mode: 3, amp: 0.5, freq: 5, len: 0.22, sheen: 0.4, opacity: 0.85, rim: 0.5 });
    c.add([plate([[L * 0.5, 0], [L * 0.33, 0.17], [L * 0.16, 0.22], [-L * 0.02, 0.1], [-L * 0.06, 0], [-L * 0.02, -0.1], [L * 0.16, -0.22], [L * 0.33, -0.17]], function (a, b) { return mixC(pale, red, 0.25 + Math.abs(b) * 1.2); }, "xz", { hub: [L * 0.2, 0] })], finMat);
    c.tick = function (cr, dt, t) {
      finMat.uniforms.uPhase.value += dt * 7;
      mat.uniforms.uPhase.value += dt * 2.4;
      const jet = Math.pow(0.5 + 0.5 * Math.sin(t * 1.7), 3);
      cr.a += dt * cr.speed * jet * 0.9 * cr.slow;
      cr.group.scale.set(1 + jet * 0.03, 1 - jet * 0.05, 1 - jet * 0.05);
    };
    c.done();
  })();

  // Lanternfish — a small school carrying its own lights.
  (function () {
    const dark = C("#1c2530"), side = C("#55687a"), glow = [0.25, 0.75, 1.0];
    const pieces = fishPieces({
      len: 0.22, h: 0.06, w: 0.034, nose: 0.5, round: 0.75, ped: 0.18, colour: shade(dark, side, mulC(side, 1.2)),
      tail: { len: 0.22, span: 1.3, fork: 0.6, col: dark }, dorsal: [[0.36, 0.6, 0.2, dark]], eye: 0.2, eyeLod: 3, eyeRing: C("#aab8c0"), sides: 6, stations: 8
    });
    for (let i = 0; i < 6; i++) pieces.push(blob(0.006, 0.006, 0.006, WHITE, { lat: 3, lon: 5, glow: glow }).at(0.07 - i * 0.026, -0.022, 0.012), blob(0.006, 0.006, 0.006, WHITE, { lat: 3, lon: 5, glow: glow }).at(0.07 - i * 0.026, -0.022, -0.012));
    const mat = matter({ mode: 1, amp: 0.08, freq: 1, len: 0.22, sheen: 0.6, glow: 1.6, mask: "#74c0fc" });
    const s = new School("lantern", K.build(pieces), mat, { n: 60, home: [6, -75, -11], range: [9, 2, 3], spread: [2.6, 1.1, 1.6], speed: 0.07, fishLen: 0.22, label: "Lanternfish", latin: "Myctophidae", mask: "#74c0fc" });
    s.beat = 11;
  })();

  // Torch — humpback anglerfish, with the only light for a long way.
  (function () {
    const c = new Creature("torch", { home: [-2.6, -96, -6.6], range: [0.8, 0.7, 0.7], speed: 0.09, kind: "drift", reach: 26, mask: "#ffe066" });
    const skin = C("#1c1611"), skin2 = C("#3a2c20"), tooth = C("#e9e3d0"), lure = [0.5, 1.5, 2.2];
    const mat = c.mat({ mode: 1, amp: 0.03, freq: 0.7, len: 0.62, sheen: 0.18, glow: 1 });
    const wart = function (nx, ny, nz) { return mixC(skin, skin2, K.noise(nx * 7 + 2, ny * 7 + nz * 5)); };
    const pieces = [
      blob(0.3, 0.25, 0.2, wart, { lat: 12, lon: 16, bump: function (nx, ny, nz) { return (K.noise(nx * 6, ny * 6 + nz * 4) - 0.5) * 0.08 - (nx > 0.55 && Math.abs(ny + 0.1) < 0.4 ? (nx - 0.55) * 0.5 : 0); } }),
      // gaping, upturned jaws: a dark throat with the lower jaw jutting past it
      blob(0.13, 0.15, 0.17, C("#060404"), { lat: 8, lon: 12 }).at(0.2, -0.02, 0, 0, 0, 0.5),
      sweep([[0.08, -0.22, 0], [0.24, -0.25, 0], [0.37, -0.17, 0], [0.41, -0.08, 0]], function (u) { return [0.04, lerp(0.19, 0.11, u)]; }, wart.bind(null, 0.3, 0.2, 0.1), { sides: 8 }),
      sweep([[0.16, 0.2, 0], [0.28, 0.14, 0], [0.34, 0.07, 0]], function (u) { return [0.035, lerp(0.17, 0.11, u)]; }, wart.bind(null, 0.5, 0.1, 0.3), { sides: 8 }),
      plate([[-0.22, 0.1], [-0.34, 0.16], [-0.42, 0.03], [-0.4, -0.12], [-0.3, -0.14], [-0.22, -0.08]], skin2, "xy"),
      plate([[-0.02, 0.22], [-0.1, 0.34], [-0.2, 0.3], [-0.18, 0.2]], skin2, "xy"),
      blob(0.014, 0.014, 0.008, C("#9fb7c0"), { lat: 4, lon: 6 }).at(0.2, 0.09, 0.15), blob(0.014, 0.014, 0.008, C("#9fb7c0"), { lat: 4, lon: 6 }).at(0.2, 0.09, -0.15),
      // the fishing rod and its lamp
      sweep([[0.14, 0.2, 0], [0.2, 0.38, 0], [0.34, 0.47, 0], [0.47, 0.42, 0], [0.5, 0.35, 0]], function (u) { const r = lerp(0.012, 0.005, u); return [r, r]; }, skin2, { sides: 5 }),
      blob(0.03, 0.03, 0.03, WHITE, { lat: 6, lon: 8, glow: lure }).at(0.5, 0.33, 0)
    ];
    for (let k = 0; k < 9; k++) {
      const z = -0.12 + k * 0.03;
      const up = 0.08 + Math.abs(Math.sin(k * 2.4)) * 0.08;
      const bx = 0.4 - Math.abs(z) * 0.9;
      pieces.push(rod([bx, -0.1 - Math.abs(z) * 0.3, z], [bx - 0.03, -0.1 + up, z * 0.9], 0.008, 0.001, tooth, 4));
      pieces.push(rod([bx - 0.07, 0.07, z], [bx - 0.05, 0.07 - up * 0.75, z * 0.9], 0.007, 0.001, tooth, 4));
    }
    [-1, 1].forEach(function (s) { pieces.push(plate([[0, 0], [-0.1, 0.08], [-0.16, 0.02], [-0.1, -0.05]], skin2, "xy").at(-0.02, -0.06, s * 0.19, s * 1.0, s * 0.4, 0)); });
    c.add(pieces, mat);
    const lamp = new T.Vector3();
    const bloom = halo(c, [0.5, 0.33, 0], [0.16, 0.5, 0.7], 0.75);
    c.tick = function (cr, dt, t) {
      mat.uniforms.uPhase.value += dt * 2.2;
      cr.group.rotation.set(0, 0.35 + Math.sin(t * 0.16) * 0.5, Math.sin(t * 0.3) * 0.06);
      const flick = 0.75 + 0.25 * Math.sin(t * 2.3) * Math.sin(t * 0.7);
      mat.uniforms.uGlowK.value = flick;
      bloom.k = flick;
      lamp.set(0.5, 0.33, 0).applyMatrix4(cr.group.matrixWorld);
      U.uLightPos.value[1].set(lamp.x, lamp.y, lamp.z, 1.6);
      U.uLightCol.value[1].set(0.25, 0.8, 1.1).multiplyScalar(flick * 1.3);
    };
    c.done();
  })();

  // Softmax — gulper eel: mostly mouth, then a long whip of a tail with a light at the end.
  (function () {
    const c = new Creature("softmax", { home: [0.5, -107, -9], range: [9, 1.8, 2.6], speed: 0.075, mask: "#b197fc" });
    const L = 2.3;
    const skin = C("#0d0c10"), skin2 = C("#231f2b"), pink = [1.6, 0.35, 0.6];
    const mat = c.mat({ mode: 1, amp: 0.07, freq: 1.9, len: L, sheen: 0.35, glow: 1 });
    const n = 30, path = [];
    for (let i = 0; i <= n; i++) path.push([L / 2 - 0.28 - (i / n) * (L - 0.3), 0, 0]);
    c.add([
      sweep(path, function (u) { const r = lerp(0.055, 0.006, Math.pow(u, 0.6)); return [r, r * 0.8]; }, function (u, ang) { return Math.cos(ang) > 0 ? skin : skin2; }, { sides: 8 }),
      // the pouch: an open scoop of jaw
      sweep([[L / 2, -0.02, 0], [L / 2 - 0.1, -0.1, 0], [L / 2 - 0.22, -0.12, 0], [L / 2 - 0.32, -0.05, 0]], function (u) { return [lerp(0.19, 0.05, u), lerp(0.16, 0.05, u)]; }, function (u, ang) { return mixC(skin2, skin, u); }, { sides: 12, cap: false }),
      sweep([[L / 2 + 0.01, 0.14, 0], [L / 2 - 0.12, 0.08, 0], [L / 2 - 0.3, 0.03, 0]], function (u) { return [0.022, lerp(0.14, 0.05, u)]; }, skin, { sides: 8 }),
      blob(0.01, 0.01, 0.008, C("#8fa3ad"), { lat: 4, lon: 6 }).at(L / 2 - 0.01, 0.165, 0.05), blob(0.01, 0.01, 0.008, C("#8fa3ad"), { lat: 4, lon: 6 }).at(L / 2 - 0.01, 0.165, -0.05),
      plate([[L * 0.2, 0.04], [0, 0.085], [-L * 0.3, 0.05], [-L * 0.3, 0.01], [L * 0.2, 0.01]], skin2, "xy"),
      blob(0.022, 0.022, 0.022, WHITE, { lat: 5, lon: 7, glow: pink }).at(-L / 2 + 0.02, 0, 0)
    ], mat);
    const tip = new T.Vector3();
    const ember = halo(c, [-L / 2 + 0.02, 0, 0], [0.7, 0.14, 0.26], 0.5);
    c.tick = function (cr, dt, t) {
      mat.uniforms.uPhase.value += dt * 3.1 * (0.4 + cr.slow * 0.6);
      tip.set(-L / 2, 0, 0).applyMatrix4(cr.group.matrixWorld);
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
      U.uLightPos.value[3].set(tip.x, tip.y, tip.z, 4);
      U.uLightCol.value[3].set(0.9, 0.2, 0.4).multiplyScalar(pulse * 0.6);
      mat.uniforms.uGlowK.value = 0.4 + pulse * 0.8;
      ember.k = 0.3 + pulse * 0.7;
    };
    c.done();
  })();

  // Head — dumbo octopus, rowing with its ears.
  (function () {
    const c = new Creature("head", { home: [-3.4, -146.6, -8.2], range: [1.8, 1.0, 1.0], speed: 0.06, kind: "drift", reach: 30, mask: "#ffa8a8" });
    const a1 = C("#c9714f"), a2 = C("#e3a583"), a3 = C("#8f4433");
    const mat = c.mat({ mode: 4, amp: 0.16, freq: 2.2, len: 0.42, sheen: 0.3, rim: 0.5, opacity: 0.96 });
    const spots = function (v, a) { return mixC(a1, a2, K.noise(a * 3, v * 9)); };
    const body = [
      lathe([[0.001, 0.3], [0.1, 0.285], [0.19, 0.22], [0.235, 0.1], [0.24, 0], [0.22, -0.1], [0.2, -0.18]], spots, { seg: 18 }),
      // web between the arms, scalloped into eight points
      lathe([[0.2, -0.18], [0.27, -0.3], [0.36, -0.42], [0.4, -0.5], [0.3, -0.46], [0.14, -0.36], [0.001, -0.33]], function (v, a) { return v > 0.5 ? a3 : mixC(a1, a3, v * 2 * (0.5 + 0.5 * Math.cos(a * 8))); }, { seg: 32, scallop: function (a, v) { return 1 + (v > 0.2 && v < 0.6 ? 0.2 * Math.cos(a * 8) * sstep(0.2, 0.5, v) : 0); } }),
      blob(0.05, 0.055, 0.03, C("#f4ead8"), { lat: 6, lon: 8 }).at(0.2, -0.02, 0.1), blob(0.05, 0.055, 0.03, C("#f4ead8"), { lat: 6, lon: 8 }).at(0.2, -0.02, -0.1),
      blob(0.03, 0.035, 0.02, BLACK, { lat: 5, lon: 7 }).at(0.225, -0.02, 0.105), blob(0.03, 0.035, 0.02, BLACK, { lat: 5, lon: 7 }).at(0.225, -0.02, -0.105)
    ];
    c.add(body, mat);
    const earMat = c.mat({ sheen: 0.3, rim: 0.4 });
    const ears = [-1, 1].map(function (s) {
      const g = new T.Group();
      g.position.set(-0.02, 0.17, s * 0.2);
      c.group.add(g);
      c.add([plate([[0.06, 0], [0.1, 0.12], [0.04, 0.22], [-0.07, 0.2], [-0.1, 0.08], [-0.05, 0]], function (x, y) { return mixC(a1, a2, y * 3); }, "xz")], earMat, g).scale.z = s;
      return { g: g, s: s };
    });
    c.tick = function (cr, dt, t) {
      mat.uniforms.uPhase.value += dt * 1.5;
      ears.forEach(function (e) { e.g.rotation.x = -e.s * (0.2 + Math.sin(t * 2.1) * 0.55); });
      cr.group.rotation.set(Math.sin(t * 0.23) * 0.12, 0.3 + Math.sin(t * 0.11) * 0.7, Math.cos(t * 0.19) * 0.1);
    };
    c.done();
  })();

  // Backbone — red deep-sea crab, working its way across the sediment.
  (function () {
    const c = new Creature("backbone", { home: [0.6, D.FLOOR_Y + 0.2, -6.4], kind: "fixed", reach: 30, mask: "#ff8787" });
    const red = C("#b7432b"), red2 = C("#d8714a"), pale = C("#e9c9a8");
    const mat = c.mat({ sheen: 0.35 });
    c.add([
      blob(0.2, 0.085, 0.27, function (nx, ny, nz) { return ny < -0.2 ? pale : mixC(red, red2, K.noise(nx * 6, nz * 6) * 0.8 + (ny > 0.7 ? 0.2 : 0)); }, { lat: 8, lon: 14, flat: 0.6, bump: function (nx, ny, nz) { return nx > 0.6 ? 0.06 * Math.cos(nz * 9) : 0; } }),
      rod([0.17, 0.03, 0.07], [0.21, 0.09, 0.08], 0.01, 0.008, red), rod([0.17, 0.03, -0.07], [0.21, 0.09, -0.08], 0.01, 0.008, red),
      blob(0.014, 0.014, 0.014, BLACK, { lat: 4, lon: 6 }).at(0.215, 0.1, 0.08), blob(0.014, 0.014, 0.014, BLACK, { lat: 4, lon: 6 }).at(0.215, 0.1, -0.08)
    ], mat);
    const legs = [];
    [-1, 1].forEach(function (s) {
      for (let k = 0; k < 4; k++) {
        const g = new T.Group();
        g.position.set(0.1 - k * 0.075, 0, s * 0.22);
        g.rotation.y = s * (0.35 - k * 0.24);
        c.group.add(g);
        const len = 0.3 - Math.abs(k - 1.2) * 0.03;
        c.add([sweep([[0, 0, 0], [0, 0.14, s * len * 0.5], [0, 0.02, s * len], [0, -0.2, s * (len + 0.12)]], function (u) { const r = lerp(0.028, 0.008, u); return [r, r]; }, function (u) { return u > 0.8 ? pale : red; }, { sides: 5, up: [1, 0, 0] })], mat, g);
        legs.push({ g: g, s: s, k: k, base: g.rotation.y });
      }
      const claw = new T.Group();
      claw.position.set(0.16, 0, s * 0.17);
      c.group.add(claw);
      c.add([
        sweep([[0, 0, 0], [0.12, 0.06, s * 0.1], [0.26, 0.02, s * 0.05]], function (u) { const r = lerp(0.035, 0.05, u); return [r, r]; }, red2, { sides: 6, up: [0, 1, 0] }),
        sweep([[0.26, 0.04, s * 0.05], [0.38, 0.05, s * 0.0]], function (u) { return [lerp(0.03, 0.006, u), lerp(0.03, 0.006, u)]; }, pale, { sides: 5, up: [0, 1, 0] }),
        sweep([[0.26, -0.005, s * 0.05], [0.37, -0.01, s * 0.0]], function (u) { return [lerp(0.022, 0.005, u), lerp(0.022, 0.005, u)]; }, pale, { sides: 5, up: [0, 1, 0] })
      ], mat, claw);
      legs.push({ g: claw, s: s, k: -1, base: 0 });
    });
    c.group.scale.setScalar(1.35);
    let x = 0.6, dir = 1, rest = 0;
    c.tick = function (cr, dt, t) {
      // crabs walk sideways; this one trundles back and forth with pauses
      if (rest > 0) rest -= dt;
      else {
        x += dir * dt * 0.22 * cr.slow;
        if (x > 4.5 || x < -3.5 || Math.random() < dt * 0.05) { dir = x > 4.5 ? -1 : x < -3.5 ? 1 : -dir; rest = rand(1.5, 4); }
      }
      const walk = rest > 0 ? 0 : 1;
      const z = cr.home.z + Math.sin(x * 0.7) * 0.5;
      const cx = x + cr.offset.x, cz = z + cr.offset.z;
      cr.pos.set(cx, (D.floorAt ? D.floorAt(cx, cz) + 0.2 : cr.home.y) + Math.max(0, cr.offset.y), cz);
      cr.group.rotation.y = PI / 2 + Math.sin(x * 0.4) * 0.2;
      legs.forEach(function (l) {
        if (l.k < 0) { l.g.rotation.z = Math.sin(t * 0.9 + l.s) * 0.12 + (cr.held || cr.pop > 0 ? 0.7 : 0); return; }
        const w = t * 7 * dir + l.k * 1.6 + (l.s > 0 ? 0 : PI);
        l.g.rotation.y = l.base + Math.sin(w) * 0.16 * walk;
        l.g.rotation.x = -l.s * Math.max(0, Math.cos(w)) * 0.22 * walk;
      });
    };
    c.done();
  })();

  // Jetson — a small work-class ROV, lights on, holding station over the floor.
  (function () {
    const c = new Creature("jetson", { home: [4.3, D.FLOOR_Y + 1.25, -8.6], range: [0.9, 0.25, 0.7], speed: 0.11, kind: "drift", reach: 34, mask: "#ffd43b" });
    const foam = C("#e2a81f"), frame = C("#2a2f35"), steel = C("#8f999f"), glass = C("#0a1a24"), lampC = [3.2, 3.0, 2.5];
    const mat = c.mat({ sheen: 0.4, glow: 1 });
    const W = 0.9, Hh = 0.5, Dd = 0.62;
    const pieces = [
      box(W, 0.2, Dd, foam).at(0, Hh / 2 + 0.06, 0),
      box(W * 0.6, 0.03, Dd * 1.02, C("#111417")).at(0, Hh / 2 + 0.165, 0),
      blob(0.13, 0.13, 0.13, glass).at(W / 2 - 0.02, 0.02, 0),
      box(0.2, 0.2, 0.26, frame).at(W / 2 - 0.16, 0.02, 0),
      box(0.42, 0.16, 0.3, steel).at(-0.08, -0.08, 0),
      // manipulator
      sweep([[W / 2 - 0.1, -0.18, 0.2], [W / 2 + 0.16, -0.26, 0.22], [W / 2 + 0.36, -0.16, 0.2]], function () { return [0.022, 0.022]; }, steel, { sides: 6 }),
      rod([W / 2 + 0.36, -0.16, 0.2], [W / 2 + 0.46, -0.13, 0.23], 0.012, 0.006, steel), rod([W / 2 + 0.36, -0.16, 0.2], [W / 2 + 0.46, -0.2, 0.17], 0.012, 0.006, steel)
    ];
    [-1, 1].forEach(function (sx) {
      [-1, 1].forEach(function (sz) {
        pieces.push(box(0.035, Hh, 0.035, frame).at(sx * (W / 2 - 0.02), 0, sz * (Dd / 2 - 0.02)));
      });
      pieces.push(box(0.035, 0.035, Dd, frame).at(sx * (W / 2 - 0.02), -Hh / 2, 0));
    });
    [-1, 1].forEach(function (sz) {
      pieces.push(box(W, 0.035, 0.035, frame).at(0, -Hh / 2, sz * (Dd / 2 - 0.02)));
      pieces.push(box(W * 1.05, 0.04, 0.06, frame).at(0, -Hh / 2 - 0.05, sz * (Dd / 2 - 0.02)));
      // thrusters
      pieces.push(sweep([[-W / 2 + 0.02, -0.02, sz * 0.2], [-W / 2 - 0.16, -0.02, sz * 0.2]], function () { return [0.07, 0.07]; }, frame, { sides: 10 }));
      pieces.push(sweep([[0, 0.05, sz * (Dd / 2 + 0.02)], [0, -0.14, sz * (Dd / 2 + 0.02)]], function () { return [0.065, 0.065]; }, frame, { sides: 10, up: [1, 0, 0] }));
      // lamps
      pieces.push(sweep([[W / 2 - 0.02, 0.2, sz * 0.2], [W / 2 + 0.05, 0.2, sz * 0.2]], function () { return [0.05, 0.05]; }, frame, { sides: 8 }));
      pieces.push(blob(0.02, 0.042, 0.042, WHITE, { lat: 5, lon: 8, glow: lampC }).at(W / 2 + 0.055, 0.2, sz * 0.2));
    });
    // tether, running up into the dark
    const tether = [];
    for (let i = 0; i <= 14; i++) tether.push([-0.3 - i * 0.5 - Math.sin(i * 0.5) * 0.6, 0.3 + i * 1.6, Math.sin(i * 0.4) * 0.5]);
    const tm = mesh([sweep(tether, function () { return [0.014, 0.014]; }, C("#c9a227"), { sides: 4 })], mat);
    tm.userData.skipBox = true;
    c.group.add(tm);
    c.add(pieces, mat);
    const lamp = new T.Vector3();
    halo(c, [W / 2 + 0.07, 0.2, 0.2], [0.75, 0.72, 0.6], 1.3);
    halo(c, [W / 2 + 0.07, 0.2, -0.2], [0.75, 0.72, 0.6], 1.3);
    c.tick = function (cr, dt, t) {
      cr.group.rotation.set(Math.sin(t * 0.7) * 0.02, -0.5 + Math.sin(t * 0.09) * 0.55, -0.1 + Math.sin(t * 0.5) * 0.02);
      lamp.set(1.6, -0.25, 0).applyMatrix4(cr.group.matrixWorld);
      U.uLightPos.value[0].set(lamp.x, lamp.y, lamp.z, 0.07);
      U.uLightCol.value[0].set(1.0, 0.95, 0.82).multiplyScalar(2.6);
    };
    c.done();
  })();

  /* ---------- out in the blue: what you find when you turn away from the reef ---------- */

  (function () {
    // a manta ray, usually overhead and against the light
    const top = C("#1b2026"), belly = C("#e6e8e4");
    const W = 1.9;
    const zs = [-1, -0.82, -0.6, -0.36, -0.14, 0, 0.14, 0.36, 0.6, 0.82, 1];
    const pieces = [
      sweep(zs.map(function (k) { const a = Math.abs(k); return [-a * a * 0.55, 0, k * W]; }), function (u, i) { const a = Math.abs(zs[i]); return [0.14 * Math.pow(1 - a, 1.4) + 0.008, 0.78 * Math.pow(1 - a, 0.75) + 0.03]; },
        function (u, ang, i, sa) { return Math.cos(ang) > -0.1 ? top : (Math.abs(zs[i]) > 0.75 ? mixC(belly, top, 0.6) : belly); }, { sides: 12, up: [0, 1, 0] }),
      sweep([[-0.6, 0, 0], [-1.5, 0.02, 0], [-2.5, 0, 0]], function (u) { const r = lerp(0.03, 0.004, u); return [r, r]; }, top, { sides: 5 })
    ];
    [-1, 1].forEach(function (sd) { pieces.push(sweep([[0.62, -0.02, sd * 0.2], [0.85, -0.05, sd * 0.24], [0.98, -0.1, sd * 0.2]], function (u) { return [lerp(0.07, 0.03, u), 0.025]; }, top, { sides: 6 })); });
    const mat = matter({ mode: 3, amp: 0.2, freq: 1.6, len: W, sheen: 0.2, mask: "#a5d8ff" });
    const manta = mesh(pieces, mat);
    manta.rotation.order = "YZX";
    D.scene.add(manta);
    const centre = new T.Vector3(9, -10.5, 0);
    D.detectables && D.detectables.push({ pos: manta.position, r: 2.0, k: 0.4, label: "Reef manta ray", conf: 0.94, col: "#a5d8ff" });
    let a = rand(0, TAU);
    D.onFrame(function (dt, t) {
      manta.visible = S.under && S.camY > -44;
      if (!manta.visible) return;
      a += dt * 0.07;
      const x = centre.x + Math.cos(a) * 12, z = centre.z + Math.sin(a) * 10;
      manta.position.set(x, centre.y + Math.sin(a * 2.3) * 2.2, z);
      manta.rotation.set(0.12, Math.atan2(-Math.cos(a) * 10, -Math.sin(a) * 12), Math.cos(a * 2.3) * 0.12);
      mat.uniforms.uPhase.value = t * 1.5;
    });

    // a turning ball of jacks, well out from the wall
    const jt = C("#55636e"), js = C("#b9c6cf"), jb = C("#eef2f2");
    const geo = K.build(fishPieces({
      len: 0.6, h: 0.2, w: 0.075, nose: 0.52, round: 0.72, ped: 0.11, colour: shade(jt, js, jb),
      tail: { len: 0.24, span: 1.5, fork: 0.75, col: jt }, dorsal: [[0.34, 0.8, 0.2, jt, 0.12, 0.35]], anal: [[0.5, 0.82, 0.16, js]],
      pect: [0.27, 0.16, 0.06, js], eye: 0.09, eyeLod: 3, sides: 8, stations: 10
    }));
    const jm = matter({ mode: 1, amp: 0.06, freq: 1.0, len: 0.6, sheen: 0.9, mask: "#ced4da" });
    const s = new School("jacks", geo, jm, { n: LITE ? 40 : 90, home: [12, -16, 6], range: [4, 3, 3.5], spread: [3.2, 2.6, 3.2], speed: 0.16, fishLen: 0.6, label: "Bigeye trevally", latin: "Caranx sexfasciatus", mask: "#ced4da" });
    s.beat = 7;
  })();

  /* ---------- deep drifters: animals that are mostly light ---------- */

  (function () {
    function hue(h) { const f = function (n) { const k = (n + h * 6) % 6; return 1 - Math.max(0, Math.min(k, 4 - k, 1)); }; return [f(5), f(3), f(1)]; }
    // comb jellies: clear bodies with eight rows of cilia that scatter light into colour
    const body = C("#9fc4d6");
    const pieces = [blob(0.11, 0.17, 0.11, body, { lat: 10, lon: 12 })];
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const pts = [];
      for (let i = 0; i <= 10; i++) { const th = 0.25 + (i / 10) * (PI - 0.5); pts.push([Math.cos(a) * Math.sin(th) * 0.114, Math.cos(th) * 0.175, Math.sin(a) * Math.sin(th) * 0.114]); }
      pieces.push(sweep(pts, function () { return [0.006, 0.006]; }, WHITE, { sides: 4, glow: function (u) { return mulC(hue(u * 1.6 + k * 0.13), 0.9); } }));
    }
    const geo = K.build(pieces);
    const mat = matter({ opacity: 0.16, rim: 1.6, glow: 1, mask: "#e599f7" });
    const N = 14;
    const combs = new T.InstancedMesh(geo, mat, N);
    geo.setAttribute("aInst", new T.InstancedBufferAttribute(new Float32Array(N * 4), 4));
    combs.frustumCulled = false;
    D.scene.add(combs);
    const spots = [];
    for (let i = 0; i < N; i++) { const a = rand(0, TAU), r = rand(5, 16); spots.push({ x: Math.cos(a) * r, y: rand(-87, -132), z: Math.sin(a) * r, s: rand(0.9, 2.1), ph: rand(0, TAU) }); }

    // a siphonophore: a colony strung out like a lit rope
    const L = 9;
    const chain = [];
    const n = 70, path = [];
    for (let i = 0; i <= n; i++) path.push([L / 2 - (i / n) * L, 0, 0]);
    chain.push(sweep(path, function (u) { const r = 0.02 * (1 - u * 0.6); return [r, r]; }, C("#cfe3ee"), { sides: 5, glow: function () { return [0.03, 0.09, 0.14]; } }));
    for (let i = 0; i < 46; i++) {
      const x = L / 2 - 0.25 - i * 0.185, big = i < 9;
      const g = big ? [0.15, 0.55, 0.85] : i % 3 ? [0.1, 0.4, 0.6] : [0.7, 0.25, 0.45];
      chain.push(blob(big ? 0.07 : 0.03, big ? 0.06 : 0.045, big ? 0.07 : 0.03, C("#dceef5"), { lat: 5, lon: 7, glow: mulC(g, big ? 0.5 : 0.8) }).at(x, big ? 0 : -0.05, (i % 2 ? 1 : -1) * (big ? 0.03 : 0.02)));
      if (!big && i % 2) chain.push(rod([x, -0.05, 0], [x - 0.1, -0.45 - (i % 5) * 0.08, 0.02], 0.004, 0.002, C("#dceef5"), 3, [0.05, 0.14, 0.2]));
    }
    const sm = matter({ mode: 1, amp: 0.02, freq: 2.2, len: L, opacity: 0.5, rim: 1.0, glow: 1, mask: "#66d9e8" });
    const rope = mesh(chain, sm);
    rope.rotation.order = "YZX";
    D.scene.add(rope);

    D.onFrame(function (dt, t) {
      const on = S.camY < -70;
      combs.visible = on;
      rope.visible = on && S.camY > -140;
      if (!on) return;
      mat.uniforms.uGlowK.value = 0.75 + 0.25 * Math.sin(t * 1.7);
      spots.forEach(function (p, i) {
        dummy.position.set(p.x + Math.sin(t * 0.05 + p.ph) * 1.5, p.y + Math.sin(t * 0.08 + p.ph * 2) * 1.1, p.z + Math.cos(t * 0.04 + p.ph) * 0.8);
        dummy.rotation.set(Math.sin(t * 0.13 + p.ph) * 0.5, t * 0.07 + p.ph, Math.cos(t * 0.11 + p.ph) * 0.5);
        dummy.scale.setScalar(p.s);
        dummy.updateMatrix();
        combs.setMatrixAt(i, dummy.matrix);
      });
      combs.instanceMatrix.needsUpdate = true;
      sm.uniforms.uPhase.value = t * 0.8;
      rope.position.set(7 + Math.sin(t * 0.021) * 5, -101 + Math.sin(t * 0.03) * 3, -13 + Math.cos(t * 0.017) * 2.5);
      rope.rotation.set(0, 0.5 + Math.sin(t * 0.02) * 0.4, 0.75 + Math.sin(t * 0.04) * 0.12);
    });
  })();

  /* ---------- per-frame ---------- */

  D.onFrame(function (dt, t) {
    for (let i = 0; i < creatures.length; i++) stepCreature(creatures[i], dt, t);
    for (let i = 0; i < schools.length; i++) stepSchool(schools[i], dt, t);
    stepHalos();
    // lights that belong to animals out of range go dark
    if (!byId.torch.group.visible) U.uLightCol.value[1].set(0, 0, 0);
    if (!byId.softmax.group.visible) U.uLightCol.value[3].set(0, 0, 0);
    if (!byId.jetson.group.visible) U.uLightCol.value[0].set(0, 0, 0);
  });

  // Which creature is under a screen point, if any.
  D.pick = function (x, y) {
    let best = null, score = 1e9;
    for (let i = 0; i < creatures.length; i++) {
      const c = creatures[i], r = c.rect;
      if (!r.ok || !c.group.visible) continue;
      const pad = Math.max(0, 26 - (r.r - r.l) / 2);
      const padY = Math.max(0, 26 - (r.b - r.t) / 2);
      if (x < r.l - pad || x > r.r + pad || y < r.t - padY || y > r.b + padY) continue;
      const d = Math.hypot(x - r.cx, y - r.cy) + r.dist * 2;
      if (d < score) { score = d; best = c; }
    }
    return best;
  };
})();
