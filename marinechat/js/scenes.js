// Living creatures over the backdrops. Everything is small, translucent and slow so it never competes with the UI.
//   dark  -> "Deep sea":    procedural abyss + anglerfish (glowing lure), lanternfish with photophores, glowing jellies
//   light -> "Maritime":    real sea/sky photo + gulls gliding and a far sail on the (computed) horizon
//   ocean -> "Sunlit reef": real reef photo + schools of chromis matching the photo, a distant turtle
const rnd = (a, b) => a + Math.random() * (b - a);
const TAU = Math.PI * 2;

let W = 0, H = 0, theme = 'dark', calm = false, hzY = 0, ents = [];

/** horizon: screen-fraction of the photo horizon (Maritime) */
export function setupScene(w, h, th, isCalm, horizon = .7) {
  W = w; H = h; theme = th; calm = isCalm; hzY = horizon * h; ents = [];
  const k = calm ? 0.5 : 1;
  if (theme === 'dark') {
    for (let i = 0; i < Math.max(1, Math.round(2 * k)); i++) ents.push(angler());
    for (let i = 0; i < Math.round(3 * k) + 1; i++) ents.push(lanternSchool());
  } else if (theme === 'light') {
    for (let i = 0; i < Math.round(3 * k) + 1; i++) ents.push(gullFlock(true));
    ents.push({ type: 'ship', x: rnd(W * .1, W * .4), v: .012, ph: 0 });          // cargo ship on the horizon
    for (let i = 0; i < (calm ? 1 : 3); i++) ents.push(sail(i));
    if (!calm) ents.push(motorboat());
    ents.push(surfer(true));
    if (!calm) ents.push(surfer(false));
  } else {
    for (let i = 0; i < Math.round(4 * k) + 1; i++) ents.push(chromis(i % 3 === 2));
    if (!calm) ents.push(turtle());
  }
}

export function drawScene(ctx, t, k, px, py) {
  for (const e of ents) {
    e.ph = (e.ph || 0) + 0.016 * k;
    DRAW[e.type](ctx, e, t, k, px, py);
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.filter = 'none';
}

// ============================================================== deep sea
const angler = () => ({ type: 'angler', x: rnd(0, W), y: rnd(H * .18, H * .55), dir: Math.random() < .5 ? 1 : -1,
  v: rnd(.08, .16), s: rnd(14, 20), ph: rnd(0, TAU) });
const lanternSchool = () => {
  const dir = Math.random() < .5 ? 1 : -1;
  return { type: 'lantern', x: dir > 0 ? rnd(-150, W * .6) : rnd(W * .4, W + 150), y: rnd(H * .08, H * .6), dir,
    v: rnd(.25, .45), s: rnd(5, 7), ph: rnd(0, TAU),
    fish: Array.from({ length: Math.round(rnd(4, 9)) }, () => ({ ox: rnd(-35, 35), oy: rnd(-16, 16), ph: rnd(0, TAU) })) };
};
const jelly = () => ({ type: 'jelly', x: rnd(0, W), y: rnd(H * .2, H * 1.1), r: rnd(5, 9), v: rnd(.07, .15),
  ph: rnd(0, TAU), hue: rnd(170, 290) });

function drawAngler(ctx, e, t, k) {
  e.x += e.v * e.dir * k; const y = e.y + Math.sin(e.ph * .35) * 8, s = e.s;
  if (e.x < -80 || e.x > W + 80) Object.assign(e, angler(), { x: e.dir > 0 ? -60 : W + 60 });
  ctx.save(); ctx.translate(e.x, y); ctx.scale(e.dir, 1);
  ctx.globalAlpha = .7; ctx.fillStyle = '#1b3b55';
  ctx.beginPath(); ctx.ellipse(0, 0, s, s * .72, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(120,200,230,.35)'; ctx.lineWidth = .8; ctx.stroke();  // faint rim light
  ctx.beginPath(); ctx.moveTo(-s * .8, 0); ctx.lineTo(-s * 1.6, -s * .5 + Math.sin(e.ph * 4) * 2); ctx.lineTo(-s * 1.6, s * .5 + Math.sin(e.ph * 4) * 2); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(160,200,220,.35)'; ctx.lineWidth = .7;
  ctx.beginPath(); ctx.moveTo(s * .3, s * .25); ctx.lineTo(s * 1.02, s * .05); ctx.stroke();
  for (let i = 0; i < 4; i++) { const tx = s * (.45 + i * .15); ctx.beginPath(); ctx.moveTo(tx, s * .2 - i * .04 * s); ctx.lineTo(tx + 1, s * .32 - i * .04 * s); ctx.stroke(); }
  ctx.globalAlpha = .7; ctx.fillStyle = '#9fd8ff'; ctx.beginPath(); ctx.arc(s * .45, -s * .22, 1.1, 0, TAU); ctx.fill();
  const lx = s * 1.35 + Math.sin(e.ph * 1.3) * 2, ly = -s * 1.05 + Math.cos(e.ph * 1.1) * 2;     // illicium + esca (lure)
  ctx.globalAlpha = .45; ctx.strokeStyle = '#1d4a66'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(s * .2, -s * .6); ctx.quadraticCurveTo(s * .9, -s * 1.5, lx, ly); ctx.stroke();
  const pulse = .6 + .4 * Math.sin(e.ph * 2.4);
  const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, 9);
  g.addColorStop(0, `rgba(170,255,240,${.85 * pulse})`); g.addColorStop(1, 'rgba(120,255,230,0)');
  ctx.globalAlpha = 1; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(lx, ly, 9, 0, TAU); ctx.fill();
  ctx.restore();
}

function drawLantern(ctx, e, t, k) {
  e.x += e.v * e.dir * k; const yy = e.y + Math.sin(e.ph * .4) * 10;
  if ((e.dir > 0 && e.x > W + 120) || (e.dir < 0 && e.x < -120)) Object.assign(e, lanternSchool());
  for (const f of e.fish) {
    const x = e.x + f.ox, y = yy + f.oy + Math.sin(e.ph * 2 + f.ph) * 2, s = e.s;
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1);
    ctx.globalAlpha = .5; ctx.fillStyle = '#2b5876';
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * .35, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-s * .8, 0); ctx.lineTo(-s * 1.4, -s * .35); ctx.lineTo(-s * 1.4, s * .35); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7fd8ff';                                    // photophores twinkling along the belly
    for (let i = 0; i < 4; i++) {
      ctx.globalAlpha = .55 + .45 * Math.max(0, Math.sin(e.ph * 3 + f.ph + i));
      ctx.beginPath(); ctx.arc(-s * .5 + i * s * .35, s * .22, .9, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}

function drawJelly(ctx, e, t, k) {
  const pulse = .5 + .5 * Math.sin(e.ph * 2.2);
  e.y -= e.v * (.4 + pulse) * k; e.x += Math.sin(e.ph * .5) * .15 * k;
  if (e.y < -40) { e.y = H + 30; e.x = rnd(0, W); }
  const r = e.r, sy = .75 + .25 * pulse;
  ctx.globalAlpha = .32; ctx.shadowColor = `hsla(${e.hue},100%,70%,.9)`; ctx.shadowBlur = 10;
  ctx.fillStyle = `hsla(${e.hue},90%,70%,.75)`;
  ctx.beginPath(); ctx.ellipse(e.x, e.y, r * (1.1 - .15 * pulse), r * sy, 0, Math.PI, 0); ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = `hsla(${e.hue},90%,75%,.6)`; ctx.lineWidth = .8;
  for (let i = 0; i < 4; i++) {
    const tx = e.x - r * .7 + i * r * .47;
    ctx.beginPath(); ctx.moveTo(tx, e.y);
    ctx.quadraticCurveTo(tx + Math.sin(e.ph * 1.5 + i) * 3, e.y + r * 1.4, tx + Math.sin(e.ph + i) * 4, e.y + r * (2.4 + .5 * pulse));
    ctx.stroke();
  }
}

// ============================================================== maritime (over the sea / sky photo)
const gullFlock = (init) => {
  const n = Math.round(rnd(1, 3.4)), y = rnd(H * .08, Math.max(H * .12, hzY - H * .22));
  return { type: 'gulls', x: init ? rnd(-50, W) : -60, y, v: rnd(.35, .6), s: rnd(8, 12),
    birds: Array.from({ length: n }, (_, i) => ({ ox: -i * rnd(18, 30), oy: rnd(-10, 10), ph: rnd(0, TAU), glide: rnd(0, TAU) })) };
};
// distance on the sea: 0 = at the horizon, 1 = bottom of the screen; size grows with nearness (perspective)
const seaY = (d) => hzY + (H - hzY) * d;
const sail = (i = 0) => ({ type: 'sail', d: [.03, .12, .3][i % 3] + rnd(0, .05), x: rnd(W * .05, W * .95),
  v: rnd(.03, .08) * (Math.random() < .5 ? -1 : 1), ph: rnd(0, TAU) });
const motorboat = () => ({ type: 'motor', d: rnd(.2, .35), x: -60, v: rnd(.5, .8), ph: 0, trail: [] });
const surfer = (riding) => ({ type: 'surfer', riding, d: riding ? rnd(.62, .78) : rnd(.45, .6), x: riding ? -40 : rnd(W * .55, W * .9),
  v: riding ? rnd(.7, 1.0) : 0, ph: rnd(0, TAU), spray: [] });

function drawGulls(ctx, e, t, k) {
  e.x += e.v * k;
  if (e.x > W + 80) Object.assign(e, gullFlock(false));
  for (const b of e.birds) {
    // mostly gliding, with occasional flapping bursts
    const flapping = Math.sin(e.ph * .35 + b.glide) > .35;
    const wing = flapping ? Math.sin(e.ph * 7 + b.ph) : .25 + .1 * Math.sin(e.ph + b.ph);
    const x = e.x + b.ox, y = e.y + b.oy + Math.sin(e.ph * .6 + b.ph) * 4, s = e.s, lift = wing * s * .55;
    ctx.globalAlpha = .82; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f4f7fa'; ctx.lineWidth = s * .28;                          // white-grey wings
    ctx.beginPath(); ctx.moveTo(x - s * 1.25, y - lift); ctx.quadraticCurveTo(x - s * .5, y - s * .45 - lift * .4, x, y);
    ctx.quadraticCurveTo(x + s * .5, y - s * .45 - lift * .4, x + s * 1.25, y - lift); ctx.stroke();
    ctx.strokeStyle = '#3a4650'; ctx.lineWidth = s * .2;                           // dark wing tips
    ctx.beginPath(); ctx.moveTo(x - s * 1.25, y - lift); ctx.lineTo(x - s * .95, y - lift * .85 - s * .12); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + s * 1.25, y - lift); ctx.lineTo(x + s * .95, y - lift * .85 - s * .12); ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x + s * .08, y + s * .05, s * .32, s * .14, 0, 0, TAU); ctx.fill();  // body
  }
}
function drawSail(ctx, e, t, k) {
  e.x += e.v * (.4 + e.d * 2) * k; if (e.x < -40) e.x = W + 40; if (e.x > W + 40) e.x = -40;
  const s = 3 + 26 * e.d, y = seaY(e.d) + Math.sin(e.ph * .7) * s * .04, tilt = Math.sin(e.ph * .5) * .04;
  ctx.save(); ctx.translate(e.x, y); ctx.rotate(tilt);
  ctx.globalAlpha = .85;
  ctx.fillStyle = '#fbfdff';                                      // mainsail + jib
  ctx.beginPath(); ctx.moveTo(0, -s * 2.4); ctx.quadraticCurveTo(s * .9, -s * 1.2, s * 1.1, -s * .25); ctx.lineTo(0, -s * .25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#e9eef3';
  ctx.beginPath(); ctx.moveTo(-.06 * s, -s * 2.0); ctx.lineTo(-.06 * s, -s * .3); ctx.lineTo(-s * .85, -s * .3); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#6b7a88'; ctx.lineWidth = Math.max(.6, s * .05); ctx.beginPath(); ctx.moveTo(0, -s * 2.45); ctx.lineTo(0, -s * .2); ctx.stroke();
  ctx.fillStyle = '#20384d';                                      // hull
  ctx.beginPath(); ctx.moveTo(-s * 1.15, -s * .22); ctx.lineTo(s * 1.25, -s * .22); ctx.quadraticCurveTo(s * .9, s * .2, -s * .9, s * .18); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = .35; ctx.fillStyle = '#ffffff';               // little bow wave
  ctx.beginPath(); ctx.ellipse(0, s * .2, s * 1.3, s * .1, 0, 0, TAU); ctx.fill();
  ctx.restore();
}
function drawShip(ctx, e, t, k) {
  e.x += e.v * k; if (e.x > W + 60) e.x = -60;
  const y = hzY + .5, s = Math.max(2.5, H * .004);
  ctx.globalAlpha = .55; ctx.fillStyle = '#3d5568';
  ctx.fillRect(e.x - s * 7, y - s * .9, s * 14, s * .9);        // hull
  ctx.fillRect(e.x + s * 3.5, y - s * 2.4, s * 2.2, s * 1.5);   // bridge
  ctx.fillStyle = '#7e8f9c'; ctx.fillRect(e.x - s * 5.5, y - s * 1.7, s * 7.5, s * .8);   // containers
}
function drawMotor(ctx, e, t, k) {
  e.x += e.v * k;
  if (e.x > W + 80) Object.assign(e, motorboat());
  const s = 3 + 22 * e.d, y = seaY(e.d) + Math.sin(e.ph * 2) * s * .03;
  e.trail.unshift([e.x - s * 1.1, y]); if (e.trail.length > 60) e.trail.pop();
  ctx.globalAlpha = 1;
  for (let i = 1; i < e.trail.length; i++) {                    // V-shaped white wake that fades and spreads
    const [x, y0] = e.trail[i], w = i * s * .045, a = (1 - i / e.trail.length) * .55;
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.fillRect(x - 1, y0 - w * .3 - 1, 3, 1.4); ctx.fillRect(x - 1, y0 + w * .3, 3, 1.4);
    if (i < 18) { ctx.fillStyle = `rgba(255,255,255,${a * .8})`; ctx.fillRect(x - 2, y0 - .7, 4, 1.4); }
  }
  ctx.save(); ctx.translate(e.x, y);
  ctx.globalAlpha = .9; ctx.fillStyle = '#f4f6f8';
  ctx.beginPath(); ctx.moveTo(-s * 1.2, -s * .3); ctx.lineTo(s * .9, -s * .3); ctx.quadraticCurveTo(s * 1.4, -s * .25, s * 1.5, -s * .05); ctx.lineTo(-s * 1.1, s * .12); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#2a4258'; ctx.fillRect(-s * .5, -s * .7, s * .8, s * .42);       // cabin
  ctx.fillStyle = '#9fc6e0'; ctx.fillRect(-s * .35, -s * .62, s * .5, s * .22);     // windscreen
  ctx.restore();
}
function drawSurfer(ctx, e, t, k) {
  const s = 4 + 18 * e.d, base = seaY(e.d);
  ctx.save();
  if (e.riding) {
    e.x += e.v * k;
    if (e.x > W + 60) Object.assign(e, surfer(true));
    const y = base + Math.sin(e.ph * 1.6) * s * .12;
    // the breaking wave he is riding: a foam crest + darker face, travelling with him
    const face = ctx.createLinearGradient(0, y - s, 0, y + s * .8);       // darker, glassy wave face
    face.addColorStop(0, 'rgba(14,62,104,.85)'); face.addColorStop(1, 'rgba(30,90,140,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = face;
    ctx.beginPath(); ctx.moveTo(e.x - s * 9, y + s * .6);
    ctx.quadraticCurveTo(e.x - s * 2, y - s * 1.0, e.x + s * 2.5, y + s * .25); ctx.lineTo(e.x + s * 2.5, y + s * .8); ctx.lineTo(e.x - s * 9, y + s * .8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1.2, s * .22); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.x - s * 8.5, y + s * .5); ctx.quadraticCurveTo(e.x - s * 2.5, y - s * .85, e.x + s * .4, y + s * .2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';                              // frothy whitewater along the crest
    for (let i = 0; i < 14; i++) {
      const u = i / 13, fx = e.x - s * 8.5 + u * s * 8.9, fy = y + s * .5 - Math.sin(u * Math.PI * .92) * s * .75;
      ctx.beginPath(); ctx.arc(fx + Math.sin(e.ph * 5 + i) * s * .1, fy + Math.cos(e.ph * 4 + i * 1.7) * s * .08, s * (.12 + .1 * Math.abs(Math.sin(i * 2.3 + e.ph * 3))), 0, TAU); ctx.fill();
    }
    if (Math.random() < .6) e.spray.push({ x: e.x - s * .4, y: y + s * .1, vx: -rnd(.3, 1.2), vy: -rnd(.2, .9), life: 1 });
    for (let i = e.spray.length - 1; i >= 0; i--) {                // spray from the board
      const p = e.spray[i]; p.x += p.vx * k; p.y += p.vy * k; p.vy += .03 * k; p.life -= .03 * k;
      if (p.life <= 0) { e.spray.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * .8; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.6, s * .07), 0, TAU); ctx.fill();
    }
    ctx.translate(e.x, y); ctx.rotate(-.12 + Math.sin(e.ph * 1.6) * .05);
    ctx.globalAlpha = .95;
    ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(0, s * .12, s * 1.15, s * .14, 0, 0, TAU); ctx.fill();   // board
    ctx.strokeStyle = '#1c2a36'; ctx.lineWidth = Math.max(1, s * .16); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .45, 0); ctx.lineTo(-s * .2, -s * .55); ctx.lineTo(.05 * s, -s * .35); ctx.lineTo(s * .35, 0); ctx.stroke();   // bent legs
    ctx.beginPath(); ctx.moveTo(-s * .12, -s * .5); ctx.lineTo(-s * .02, -s * 1.15); ctx.stroke();                                              // torso
    ctx.beginPath(); ctx.moveTo(-s * .7, -s * .95); ctx.lineTo(-s * .05, -s * 1.0); ctx.lineTo(s * .6, -s * .8); ctx.stroke();                 // arms out
    ctx.fillStyle = '#1c2a36'; ctx.beginPath(); ctx.arc(.02 * s, -s * 1.35, s * .17, 0, TAU); ctx.fill();                                     // head
  } else {
    // a surfer waiting for a set: sitting on the board, bobbing
    const y = base + Math.sin(e.ph * 1.1) * s * .1;
    ctx.translate(e.x, y); ctx.rotate(Math.sin(e.ph * 1.1) * .06);
    ctx.globalAlpha = .4; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, s * .16, s * (1.4 + .2 * Math.sin(e.ph * 2)), s * .14, 0, 0, TAU); ctx.stroke();                     // ripple ring
    ctx.globalAlpha = .92; ctx.fillStyle = '#7fd3ff'; ctx.beginPath(); ctx.ellipse(0, s * .1, s * 1.05, s * .12, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#1c2a36'; ctx.lineWidth = Math.max(1, s * .16); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-s * .05, 0); ctx.lineTo(.02 * s, -s * .6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-s * .05, 0); ctx.lineTo(s * .35, s * .18); ctx.stroke();
    ctx.fillStyle = '#1c2a36'; ctx.beginPath(); ctx.arc(.04 * s, -s * .8, s * .16, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// ============================================================== sunlit reef (over the reef photo)
// pale-blue chromis like the ones in the photo; far schools are smaller, bluer and hazier (aerial perspective)
const chromis = (far) => {
  const dir = Math.random() < .5 ? 1 : -1;
  return { type: 'chromis', far, x: dir > 0 ? rnd(-220, W * .5) : rnd(W * .5, W + 220), y: rnd(H * .08, H * .55), dir,
    v: rnd(.22, .45) * (far ? .55 : 1), size: rnd(6, 10) * (far ? .55 : 1), ph: rnd(0, TAU),
    fish: Array.from({ length: Math.round(rnd(5, 12)) }, () => ({ ox: rnd(-55, 55), oy: rnd(-22, 22), ph: rnd(0, TAU), s: rnd(.8, 1.15) })) };
};
const turtle = () => ({ type: 'turtle', x: -70, y: rnd(H * .15, H * .4), v: .16, ph: 0, s: rnd(.9, 1.2) });

function fishBody(ctx, s, wig, body, belly) {
  const g = ctx.createLinearGradient(0, -s * .45, 0, s * .45);   // counter-shading: darker back, light belly
  g.addColorStop(0, body); g.addColorStop(1, belly);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(s, 0);
  ctx.quadraticCurveTo(s * .4, -s * .55, -s * .7, -s * .12); ctx.lineTo(-s * 1.45, -s * .5 + wig); ctx.lineTo(-s * 1.2, 0);
  ctx.lineTo(-s * 1.45, s * .5 + wig); ctx.lineTo(-s * .7, s * .12); ctx.quadraticCurveTo(s * .4, s * .55, s, 0); ctx.fill();
}
function drawChromis(ctx, e, t, k, px, py) {
  e.x += e.v * e.dir * k;
  const yy = e.y + Math.sin(e.ph * .35) * 12, dx = e.x - px, dy = yy - py, dd = Math.hypot(dx, dy);
  if (dd < 120) e.y += (dy / (dd || 1)) * .45 * k;                // shy of the pointer
  ctx.globalAlpha = e.far ? .32 : .62;
  if (e.far) ctx.filter = 'blur(.8px)';
  const body = e.far ? '#7fb7cf' : '#9fd6ea', belly = e.far ? '#b6dbe8' : '#e9fbff';
  for (const f of e.fish) {
    const x = e.x + f.ox, y = yy + f.oy + Math.sin(e.ph * 2 + f.ph) * 2.5, s = e.size * f.s;
    ctx.save(); ctx.translate(x, y); ctx.scale(e.dir, 1); ctx.rotate(Math.sin(e.ph * 1.3 + f.ph) * .08);
    fishBody(ctx, s, Math.sin(e.ph * 7 + f.ph) * s * .2, body, belly);
    ctx.restore();
  }
  ctx.filter = 'none';
  if ((e.dir > 0 && e.x > W + 160) || (e.dir < 0 && e.x < -160)) Object.assign(e, chromis(e.far));
}
function drawTurtle(ctx, e, t, k) {
  e.x += e.v * k; const y = e.y + Math.sin(e.ph * .3) * 10, s = 10 * e.s, fl = Math.sin(e.ph * 1.4) * .5;
  if (e.x > W + 90) Object.assign(e, turtle());
  ctx.globalAlpha = .34; ctx.filter = 'blur(.7px)'; ctx.fillStyle = '#3f6f78';   // hazy: far away in blue water
  ctx.save(); ctx.translate(e.x, y);
  for (const [fx, fy, sg] of [[s * .5, -s * .55, -1], [s * .5, s * .55, 1], [-s * .6, -s * .45, -1], [-s * .6, s * .45, 1]]) {
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(sg * (.5 + fl)); ctx.beginPath(); ctx.ellipse(0, sg * s * .35, s * .22, s * .55, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  ctx.beginPath(); ctx.ellipse(s * 1.05, 0, s * .3, s * .24, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#56868b'; ctx.beginPath(); ctx.ellipse(0, 0, s, s * .74, 0, 0, TAU); ctx.fill();
  ctx.restore(); ctx.filter = 'none';
}

const DRAW = { angler: drawAngler, lantern: drawLantern, jelly: drawJelly, gulls: drawGulls, sail: drawSail,
  ship: drawShip, motor: drawMotor, surfer: drawSurfer,
  chromis: drawChromis, turtle: drawTurtle };
