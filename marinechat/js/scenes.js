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
// ---- surfers: proportioned figures (wetsuit, skin tones, tapered limbs), shaped boards, wave + shadow
const SKIN = ['#e0ac84', '#c68a62', '#9b6a47', '#f1c7a5'], SUIT = ['#151d26', '#1d2b3a', '#2a1f2e'], BOARD = [
  ['#fdfdfb', '#ff8a3d'], ['#f6f1e4', '#2fb3c9'], ['#ffffff', '#e94f64'], ['#fbf6ea', '#f5c242']];
const pickOf = (a) => a[Math.floor(Math.random() * a.length)];
function limb(ctx, pts, w0, w1, col) {         // tapered limb through 3 points (joint in the middle)
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.lineWidth = w0; ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); ctx.lineTo(pts[1][0], pts[1][1]); ctx.stroke();
  ctx.lineWidth = w1; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1]); ctx.lineTo(pts[2][0], pts[2][1]); ctx.stroke();
}
function board(ctx, s, len, col) {             // shortboard: pointed nose, rounded tail, stringer and fin
  const L = s * len, T = s * .2;
  const g = ctx.createLinearGradient(0, -T, 0, T);
  g.addColorStop(0, col[0]); g.addColorStop(1, col[1]);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(L * .55, 0);
  ctx.bezierCurveTo(L * .3, -T, -L * .35, -T * 1.05, -L * .48, -T * .2);
  ctx.quadraticCurveTo(-L * .52, 0, -L * .48, T * .2);
  ctx.bezierCurveTo(-L * .35, T * 1.05, L * .3, T, L * .55, 0); ctx.fill();
  ctx.strokeStyle = 'rgba(80,60,40,.45)'; ctx.lineWidth = Math.max(.5, s * .03);
  ctx.beginPath(); ctx.moveTo(L * .5, 0); ctx.lineTo(-L * .46, 0); ctx.stroke();         // stringer
  ctx.fillStyle = 'rgba(30,40,50,.7)';
  ctx.beginPath(); ctx.moveTo(-L * .4, T * .5); ctx.lineTo(-L * .32, T * .5); ctx.lineTo(-L * .42, T * 1.6); ctx.closePath(); ctx.fill();  // fin
}
function head(ctx, x, y, r, skin, hair, facing) {
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.fillStyle = hair; ctx.beginPath(); ctx.arc(x - facing * r * .15, y - r * .2, r * 1.02, Math.PI * .95, Math.PI * 2.05); ctx.fill();  // hair
}
const surfer = (riding) => ({ type: 'surfer', riding, d: riding ? rnd(.62, .78) : rnd(.45, .6), x: riding ? -40 : rnd(W * .55, W * .9),
  v: riding ? rnd(.7, 1.0) : 0, ph: rnd(0, TAU), spray: [], skin: pickOf(SKIN), suit: pickOf(SUIT), board: pickOf(BOARD),
  hair: pickOf(['#2a1d15', '#4a3426', '#c9a46a', '#111']), dir: riding ? 1 : (Math.random() < .5 ? 1 : -1),
  top: pickOf([null, null, '#1f78a8', '#d2483a', '#e8e3d6', '#f2a93b']) });   // rash guard (or plain wetsuit)

function drawSurfer(ctx, e, t, k) {
  const s = 6 + 22 * e.d, base = seaY(e.d);
  ctx.save();
  if (e.riding) {
    e.x += e.v * k;
    if (e.x > W + 80) Object.assign(e, surfer(true));
    const y = base + Math.sin(e.ph * 1.6) * s * .1;
    // wave face + foam crest travelling with the rider
    const face = ctx.createLinearGradient(0, y - s, 0, y + s * .8);
    face.addColorStop(0, 'rgba(14,62,104,.85)'); face.addColorStop(1, 'rgba(30,90,140,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = face;
    ctx.beginPath(); ctx.moveTo(e.x - s * 9, y + s * .6);
    ctx.quadraticCurveTo(e.x - s * 2, y - s * 1.0, e.x + s * 2.5, y + s * .25); ctx.lineTo(e.x + s * 2.5, y + s * .8); ctx.lineTo(e.x - s * 9, y + s * .8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = Math.max(1.2, s * .2); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(e.x - s * 8.5, y + s * .5); ctx.quadraticCurveTo(e.x - s * 2.5, y - s * .85, e.x + s * .4, y + s * .22); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.75)';
    for (let i = 0; i < 14; i++) {
      const u = i / 13, fx = e.x - s * 8.5 + u * s * 8.9, fy = y + s * .5 - Math.sin(u * Math.PI * .92) * s * .75;
      ctx.beginPath(); ctx.arc(fx + Math.sin(e.ph * 5 + i) * s * .1, fy + Math.cos(e.ph * 4 + i * 1.7) * s * .08, s * (.12 + .1 * Math.abs(Math.sin(i * 2.3 + e.ph * 3))), 0, TAU); ctx.fill();
    }
    if (Math.random() < .7) e.spray.push({ x: e.x - s * .9, y: y + s * .05, vx: -rnd(.4, 1.4), vy: -rnd(.3, 1.1), life: 1 });
    for (let i = e.spray.length - 1; i >= 0; i--) {
      const p = e.spray[i]; p.x += p.vx * k; p.y += p.vy * k; p.vy += .035 * k; p.life -= .028 * k;
      if (p.life <= 0) { e.spray.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * .85; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.6, s * .06), 0, TAU); ctx.fill();
    }
    // rider: low stance, knees bent, arms out for balance, slight lean into the turn
    const lean = -.14 + Math.sin(e.ph * 1.6) * .06, arm = Math.sin(e.ph * 2.2) * .12;
    ctx.translate(e.x, y); ctx.rotate(lean);
    ctx.globalAlpha = .28; ctx.fillStyle = '#062033';                                       // shadow on the wave face
    ctx.beginPath(); ctx.ellipse(-s * .1, s * .32, s * 1.1, s * .1, 0, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.save(); ctx.translate(0, s * .1); board(ctx, s, 2.4, e.board); ctx.restore();
    const hip = [-s * .05, -s * .62], sh = [s * .05, -s * 1.22];
    limb(ctx, [[-s * .55, s * .02], [-s * .5, -s * .38], hip], s * .2, s * .17, e.suit);      // back leg
    limb(ctx, [[s * .5, s * .02], [s * .32, -s * .4], hip], s * .2, s * .17, e.suit);         // front leg
    ctx.fillStyle = e.suit;                                                                    // feet
    ctx.beginPath(); ctx.ellipse(-s * .55, s * .02, s * .1, s * .05, 0, 0, TAU); ctx.ellipse(s * .5, s * .02, s * .1, s * .05, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = e.top || e.suit;                                                           // torso (wetsuit / rash guard)
    ctx.beginPath(); ctx.moveTo(hip[0] - s * .14, hip[1]); ctx.lineTo(sh[0] - s * .17, sh[1]); ctx.lineTo(sh[0] + s * .17, sh[1] + s * .04); ctx.lineTo(hip[0] + s * .14, hip[1] + s * .02); ctx.closePath(); ctx.fill();
    limb(ctx, [sh, [-s * .45, -s * (1.05 + arm)], [-s * .85, -s * (.85 + arm)]], s * .12, s * .1, e.suit);   // back arm
    limb(ctx, [sh, [s * .48, -s * (1.12 - arm)], [s * .92, -s * (1.02 - arm)]], s * .12, s * .1, e.suit);   // front arm
    ctx.fillStyle = e.skin;
    ctx.beginPath(); ctx.arc(-s * .87, -s * (.84 + arm), s * .07, 0, TAU); ctx.fill();           // hands
    ctx.beginPath(); ctx.arc(s * .94, -s * (1.01 - arm), s * .07, 0, TAU); ctx.fill();
    head(ctx, sh[0] + s * .08, sh[1] - s * .23, s * .15, e.skin, e.hair, 1);
  } else {
    // paddling out: lying on the board, arms stroking alternately, gentle bob
    const y = base + Math.sin(e.ph * 1.1) * s * .08, stroke = e.ph * 2.4;
    ctx.translate(e.x, y); ctx.scale(e.dir, 1); ctx.rotate(Math.sin(e.ph * 1.1) * .03);
    ctx.globalAlpha = .5; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;                      // wake ripples
    for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(-s * (.9 + i * .5), s * .18, s * (.3 + i * .25), s * .07, 0, 0, TAU); ctx.stroke(); }
    ctx.globalAlpha = 1;
    board(ctx, s, 2.3, e.board);
    ctx.fillStyle = e.top || e.suit;                                                           // body lying on the board
    ctx.beginPath(); ctx.ellipse(-s * .1, -s * .16, s * .62, s * .14, 0, 0, TAU); ctx.fill();
    limb(ctx, [[-s * .6, -s * .14], [-s * 1.0, -s * .12], [-s * 1.3, -s * .05]], s * .15, s * .12, e.suit); // legs trailing
    for (const [ph0, alpha] of [[0, 1], [Math.PI, .8]]) {                                     // paddling arms
      const a = stroke + ph0, reach = Math.cos(a), up = Math.max(0, Math.sin(a));
      ctx.globalAlpha = alpha;
      limb(ctx, [[s * .35, -s * .2], [s * (.55 + .25 * reach), -s * (.25 + .35 * up)], [s * (.65 + .45 * reach), -s * (.05 + .5 * up) + s * .18]], s * .11, s * .09, e.suit);
      if (up < .2) { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.arc(s * (.65 + .45 * reach), s * .16, s * .07, 0, TAU); ctx.fill(); }   // splash
    }
    ctx.globalAlpha = 1;
    head(ctx, s * .55, -s * .34, s * .14, e.skin, e.hair, 1);
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
