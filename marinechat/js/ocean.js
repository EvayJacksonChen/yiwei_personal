// Animated ocean backdrop.
//  * WebGL layer: depth gradient, slowly flowing (domain-warped) caustics, god rays, a soft eased "torch" light.
//  * 2D layer: marine snow / bubbles, very subtle pointer sparks (never over UI), and - in the Ocean theme -
//    tiny translucent organisms (fish schools, jellyfish, a turtle and a manta far away).
// Themes: 'dark' (deep sea), 'light' (calm, nearly static), 'ocean' (sunlit reef, vivid light blue).

import { setupScene, drawScene } from './scenes.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { depth: 0, target: 0, mx: 0.5, my: 0.35, tmx: 0.5, tmy: 0.35, sparks: [], theme: 'dark', calm: false };

export const setDepth = (d) => { state.target = Math.max(0, Math.min(1, d)); };
export const setCalm = (c) => { state.calm = !!c; populate(); };
export function setTheme(t) { state.theme = t; populate(); }

// palette per theme: [top colour at depth 0, top at depth 1, bottom at depth 0, bottom at depth 1], effect strengths
const THEMES = {
  dark: { top0: [.03, .27, .42], top1: [.01, .07, .16], bot0: [.01, .07, .16], bot1: [.003, .012, .035],
    caustic: [.005, .02, .05, 0], rays: .0, torch: .0, vignette: 1, photo: 3, img: [2560, 1704], pos: .5 },
  light: { top0: [.80, .91, .99], top1: [.80, .91, .99], bot0: [.86, .93, .97], bot1: [.86, .93, .97],
    caustic: [1, .98, .9, 0], rays: .0, torch: .0, vignette: .03, photo: 2,
    img: [2560, 1375], pos: .58, horizon: .695 },
  ocean: { top0: [.62, .92, 1.0], top1: [.45, .83, .98], bot0: [.25, .70, .92], bot1: [.12, .56, .84],
    caustic: [.92, 1, 1, .26], rays: .22, torch: .0, vignette: .12, photo: 1, img: [2400, 1800], pos: .72 },
};

const FRAG = `
precision highp float;
uniform vec2 r; uniform float t; uniform float depth; uniform vec2 m;
uniform vec3 top0; uniform vec3 top1; uniform vec3 bot0; uniform vec3 bot1;
uniform vec4 cc; uniform float rays; uniform float torch; uniform float vig; uniform float photo; uniform float hz;
uniform sampler2D tex; uniform vec2 tsz; uniform float tpos;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
float caustic(vec2 p){
  float c = 0.;
  for(int i=0;i<3;i++){ float fi=float(i);
    vec2 q = p*(1.4+fi*0.6) + vec2(t*0.035*(fi+1.), -t*0.028);
    vec2 w = vec2(n(q+vec2(0., t*.07)), n(q+vec2(5.2, -t*.06)));
    c += pow(1.-abs(sin((q.x+w.x*2.)*3.)+sin((q.y+w.y*2.)*3.))*.5, 6.) / (fi+1.);
  } return c; }
void main(){
  vec2 uv = gl_FragCoord.xy / r; vec2 p = uv * vec2(r.x/r.y, 1.);
  // slow currents: warp the whole field with low-frequency flowing noise
  vec2 flow = photo > 3.5 ? vec2(n(p*1.2 + vec2(t*.02, 0.)), n(p*1.2 + vec2(0., t*.017) + 7.3)) - .5
                          : vec2(fbm(p*1.2 + vec2(t*.02, 0.)), fbm(p*1.2 + vec2(0., t*.017) + 7.3)) - .5;
  vec2 pw = p + flow * .22;
  float d = depth;
  if (photo > 3.5) {
    // Deep sea home page: the photo itself is drawn here so it can flow like seen through moving water
    float ra = r.x / r.y, ta = tsz.x / tsz.y;
    vec2 vis = ra > ta ? vec2(1., ta / ra) : vec2(ra / ta, 1.);                 // cover-fit window
    vis /= 1.05 + .025 * sin(t * .045);                                          // slow breathing zoom
    vec2 c = vec2(.5 + (m.x - .5) * .014, mix(vis.y * .5, 1. - vis.y * .5, tpos) - (m.y - .5) * .01);
    vec2 q = vec2(uv.x, 1. - uv.y);
    // refraction: a slow large current + a finer shimmer
    vec2 dsp = (vec2(n(p * 2.3 + vec2(t * .09, t * .06)), n(p * 2.3 + vec2(-t * .07, t * .09) + 3.7)) - .5) * .016;
    dsp += (vec2(n(p * 7. + t * .3), n(p * 7. - t * .27 + 5.)) - .5) * .003;
    // ripples trailing the (eased) pointer
    vec2 dm = (uv - m) * vec2(ra, 1.); float dd = length(dm);
    dsp += (dm / (dd + 1e-4)) * sin(dd * 65. - t * 2.4) * exp(-dd * 8.) * .004;
    vec3 col = texture2D(tex, clamp(c + (q - .5) * vis + vec2(dsp.x, -dsp.y), .002, .998)).rgb;
    // faint light shafts drifting from above, and a slow luminance shimmer
    float ang = (uv.x - .5 + flow.x * .12) * 5. + (1. - uv.y) * .5;
    float sh = pow(max(0., sin(ang * 2.7 + t * .05) * .5 + .5), 10.) + .6 * pow(max(0., sin(ang * 4.3 - t * .04) * .5 + .5), 14.);
    col += vec3(.22, .48, .7) * sh * smoothstep(.25, 1., uv.y) * .13;
    col *= .94 + .08 * n(pw * 1.5 + vec2(t * .05, 0.));
    // readability veil (mirrors the CSS one) + vignette
    float vx = q.x < .45 ? mix(.72, .38, q.x / .45) : mix(.38, .1, clamp((q.x - .45) / .3, 0., 1.));
    float vt = .25 * (1. - smoothstep(0., .3, q.y)), vb = .35 * smoothstep(.6, 1., q.y);
    float v = 1. - (1. - vx) * (1. - vt) * (1. - vb);
    col = mix(col, vec3(.008, .03, .08), v);
    // original MarineChat water: flowing caustic network + sun rays (full-quality fbm currents for this layer)
    // it moves on its own (like the reef theme): faster currents, a drifting pattern, glints on the crests
    vec2 fl = vec2(fbm(p*1.2 + vec2(t*.06, t*.02)), fbm(p*1.2 + vec2(-t*.03, t*.05) + 7.3)) - .5;
    vec2 pc = p + fl * .26;
    float cz = caustic(pc * 2.2 + vec2(t * .05, -t * .025)) * smoothstep(.05, 1., uv.y + .2);
    col = mix(col, vec3(.35, .85, .95), clamp(cz * .22, 0., .55));
    float glint = pow(cz, 3.) * (.55 + .45 * sin(t * 1.6 + pc.x * 9. + pc.y * 5.));
    col += vec3(.6, .95, 1.) * glint * .14;
    float sway = .07 * sin(t * .11) + .04 * sin(t * .047 + 1.3);
    float ang0 = (uv.x - .5 + sway + (m.x - .5) * .04 + fl.x * .1) * 6. + (1. - uv.y) * .6;
    float ry0 = pow(max(0., sin(ang0 * 3.1 + t * .16) * .5 + .5), 8.) + pow(max(0., sin(ang0 * 5.3 - t * .12) * .5 + .5), 12.) * .6;
    col += vec3(.75, .95, 1.) * ry0 * smoothstep(.15, 1., uv.y) * (.13 + .05 * sin(t * .3));
    col *= 1. - .3 * pow(length(uv - .5) * 1.2, 2.);
    gl_FragColor = vec4(col, 1.);
    return;
  }
  if (photo > 0.5) {
    // photo backdrop underneath: only add light, as alpha over the picture
    float ang2 = (uv.x - .5 + (m.x-.5)*.08 + flow.x*.1) * 6. + (1.-uv.y)*.6;
    float ry2 = pow(max(0., sin(ang2*3.1 + t*.09)*.5+.5), 8.) + pow(max(0., sin(ang2*5.3 - t*.07)*.5+.5), 12.)*.6;
    float light = 0.;
    if (photo < 1.5) {                                  // sunlit reef: dancing caustics + sun shafts
      float c = caustic(pw*1.7);
      light += c * cc.a * (.25 + .75*smoothstep(.0, .85, uv.y));
      light += ry2 * rays * smoothstep(.1, 1., uv.y);
    } else {                                            // maritime: sparkling sun glints on the sea below the horizon
      float below = 1. - smoothstep(hz - .004, hz + .002, uv.y);
      float dist = max(hz - uv.y, 0.);
      vec2 gp = vec2(uv.x * r.x / r.y * (70. + 260. * (1. - dist)), dist * 900. / (dist + .12));
      float g = pow(n(gp + vec2(t * .9, -t * .6)), 22.) + pow(n(gp * 1.7 + vec2(-t * .7, t * .4)), 26.);
      light += g * below * (.35 + .9 * smoothstep(.0, .25, dist)) * 2.2;
    }
    if (photo > 2.5) {                                  // deep sea: drifting dark haze, deeper at the edges
      float fog = fbm(pw * 1.6 + vec2(t * .015, -t * .01));
      float edge = pow(length(uv - .5) * 1.25, 2.);
      gl_FragColor = vec4(cc.rgb, clamp(.08 + .22 * fog + .35 * edge * vig, 0., .6));
      return;
    }
    gl_FragColor = vec4(cc.rgb, clamp(light, 0., .8));
    return;
  }
  vec3 top = mix(top0, top1, smoothstep(0.,.6,d));
  vec3 bot = mix(bot0, bot1, smoothstep(.1,1.,d));
  vec3 col = mix(bot, top, pow(clamp(uv.y + flow.y*.08, 0., 1.), 1.3));
  float ang = (uv.x - .5 + (m.x-.5)*.12 + flow.x*.1) * 6. + (1.-uv.y)*.6;
  float ry = pow(max(0., sin(ang*3.1 + t*.09)*.5+.5), 8.) + pow(max(0., sin(ang*5.3 - t*.07)*.5+.5), 12.)*.6;
  ry *= smoothstep(.15, 1., uv.y) * (1.-smoothstep(0., .55, d));
  col += vec3(.75,.95,1.) * ry * rays;
  float c = caustic(pw*2.2) * smoothstep(.3, 1., uv.y + .15) * (1.-smoothstep(0., .5, d));
  col = mix(col, cc.rgb, clamp(c * cc.a, 0., 1.));
  float tl = exp(-length((uv - m) * vec2(r.x/r.y, 1.)) * 7.0);
  col += vec3(.05,.35,.4) * tl * torch * (1. + 2.*smoothstep(.3, 1., d));
  col *= 1. - vig*pow(length(uv-.5)*1.2, 2.);
  gl_FragColor = vec4(col, 1.);
}`;

function startGL(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false, alpha: true });
  if (!gl) { canvas.style.background = 'linear-gradient(#06304a,#020814)'; return null; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}'));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error('[MarineChat] background shader failed:', gl.getProgramInfoLog(prog), gl.getShaderInfoLog(gl.getAttachedShaders(prog)[1]));
    canvas.style.background = 'linear-gradient(#06304a,#020814)'; return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = {};
  for (const k of ['r', 't', 'depth', 'm', 'top0', 'top1', 'bot0', 'bot1', 'cc', 'rays', 'torch', 'vig', 'photo', 'hz', 'tex', 'tsz', 'tpos']) U[k] = gl.getUniformLocation(prog, k);
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  for (const [k, v] of [[gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE], [gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
  gl.uniform1i(U.tex, 0);
  return { gl, U, texture, tex: null };
}

// ------------------------------------------------------------------ scene creatures live in scenes.js
let W = 0, H = 0, snow = [], photoEl = null;
function photoHorizon() {
  const th = THEMES[state.theme];
  if (!th?.horizon) return .7;
  const bw = W * 1.1, bh = H * 1.1, s = Math.max(bw / th.img[0], bh / th.img[1]);   // #bgPhoto i is inset -5%
  const dh = th.img[1] * s, top = -H * .05 + (bh - dh) * th.pos;
  return (top + th.horizon * dh) / H;
}
function populate() { if (!W) return; state.horizon = photoHorizon(); setupScene(W, H, state.theme, state.calm, state.horizon); }

function makeSnow() {
  const n = Math.round(Math.min(140, (W * H) / 13000));
  snow = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * .8 + .2,
    vx: (Math.random() - .5) * .1, vy: Math.random() * .22 + .04, ph: Math.random() * 6.28 }));
}

const DEEP_POS = { a: .45, b: .55 };
function loadDeepTexture(G) {
  if (!G || G.loading) return;
  const v = document.documentElement.dataset.deep || 'a', src = `bg/deep-${v}${innerWidth < 900 ? '-m' : ''}.jpg`;
  if (G.tex?.src === src) return;
  G.loading = true;
  const img = new Image();
  img.onload = () => {
    const { gl } = G;
    gl.bindTexture(gl.TEXTURE_2D, G.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
    G.tex = { src, w: img.naturalWidth, h: img.naturalHeight, pos: DEEP_POS[v] ?? .5 };
    G.loading = false;
  };
  img.onerror = () => { G.loading = false; };
  img.src = src;
}

const UI_SEL = '.glass, button, a, input, textarea, select, label, canvas#stageCanvas, .chip, .msg, .hero-demo, .nav';

export function initOcean() {
  const cgl = document.getElementById('ocean'), csn = document.getElementById('snow');
  photoEl = document.querySelector('#bgPhoto i');
  const ctx = csn.getContext('2d');
  const G = startGL(cgl);
  // the fluid photo needs full resolution; the procedural effects are soft and run at half resolution
  let scale = .5;
  const glScale = () => (fluid() ? (innerWidth < 900 ? .75 : 1) : .5);
  const fluid = () => !!(G && G.tex && state.theme === 'dark' && !state.calm && !reduced && !state.tooSlow);
  const resize = () => {
    W = innerWidth; H = innerHeight;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    scale = glScale();
    cgl.width = Math.round(W * scale); cgl.height = Math.round(H * scale);
    csn.width = Math.round(W * dpr); csn.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeSnow(); populate();
  };
  resize(); addEventListener('resize', resize);
  addEventListener('pointermove', (e) => {
    state.mx = e.clientX / W; state.my = 1 - e.clientY / H;
    // sparks: rare, faint, only over open background (never while working on the UI), never in calm views
    if (reduced || state.calm || state.theme === 'light' || state.sparks.length > 16 || Math.random() > .07) return;
    if (e.target.closest?.(UI_SEL)) return;
    state.sparks.push({ x: e.clientX + rnd(-14, 14), y: e.clientY + rnd(-14, 14), life: 1, r: rnd(.6, 1.4), hue: state.theme === 'ocean' ? 190 : (Math.random() < .8 ? 170 : 250) });
  }, { passive: true });

  let t0 = performance.now(), last = t0, visible = true;
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; if (visible) requestAnimationFrame(frame); });
  function frame(now) {
    if (!visible) return;
    const rawDt = now - last, dt = Math.min(50, rawDt); last = now; const k = dt / 16.7;
    // performance guard: if frames stay slow while the fluid photo runs, fall back to the static one
    if (document.body.classList.contains('fluid-bg') && rawDt < 1000) {
      state.slowAvg = (state.slowAvg ?? 16) * .95 + rawDt * .05;
      if (state.slowAvg > 45 && !state.tooSlow) { state.tooSlow = true; console.info('[MarineChat] fluid background disabled: device too slow'); }
    }
    state.depth += (state.target - state.depth) * .05;
    state.tmx += (state.mx - state.tmx) * .03; state.tmy += (state.my - state.tmy) * .03;  // eased torch
    if (photoEl && !reduced) { photoEl.style.setProperty('--px', `${(.5 - state.tmx) * 14}px`); photoEl.style.setProperty('--py', `${(state.tmy - .5) * 10}px`); }
    const th = THEMES[state.theme] || THEMES.dark;
    const t = reduced ? 0 : (now - t0) / 1000;
    if (state.theme === 'dark' && !reduced) loadDeepTexture(G);
    const isFluid = fluid();
    document.body.classList.toggle('fluid-bg', isFluid);   // CSS hides the static photo while the shader draws it
    if (glScale() !== scale) resize();
    if (G) {
      const { gl, U } = G;
      gl.viewport(0, 0, cgl.width, cgl.height);
      gl.uniform2f(U.r, cgl.width, cgl.height); gl.uniform1f(U.t, state.theme === 'light' ? t * .4 : t);
      gl.uniform1f(U.depth, state.theme === 'light' ? 0 : state.depth); gl.uniform2f(U.m, state.tmx, state.tmy);
      gl.uniform3fv(U.top0, th.top0); gl.uniform3fv(U.top1, th.top1); gl.uniform3fv(U.bot0, th.bot0); gl.uniform3fv(U.bot1, th.bot1);
      gl.uniform1f(U.photo, isFluid ? 4 : (th.photo || 0)); gl.uniform1f(U.hz, 1 - (state.horizon || .7));
      if (isFluid) { gl.uniform2f(U.tsz, G.tex.w, G.tex.h); gl.uniform1f(U.tpos, G.tex.pos); }
      gl.uniform4fv(U.cc, th.caustic); gl.uniform1f(U.rays, th.rays); gl.uniform1f(U.torch, th.torch * (state.calm ? .2 : 1)); gl.uniform1f(U.vig, th.vignette);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    ctx.clearRect(0, 0, W, H);
    const ocean = state.theme === 'ocean', light = state.theme === 'light';
    for (const p of light ? [] : snow) {
      if (!reduced) {
        p.x += (p.vx + Math.sin(t * .5 + p.ph) * .07) * k * p.z;
        p.y += (ocean ? -1.4 : 1) * p.vy * k * p.z * (.6 + state.depth);    // ocean: bubbles rise
        if (p.y > H + 4) { p.y = -4; p.x = Math.random() * W; }
        if (p.y < -6) { p.y = H + 4; p.x = Math.random() * W; }
        if (p.x < -4) p.x = W + 4; if (p.x > W + 4) p.x = -4;
      }
      if (ocean) {
        ctx.globalAlpha = .18 + p.z * .3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .7;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.z * 1.8, 0, 6.283); ctx.stroke();
      } else {
        ctx.globalAlpha = light ? .06 + p.z * .14 : .1 + p.z * .3;
        ctx.fillStyle = light ? '#3a7fb8' : '#cfefff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.z * (light ? 1.1 : 1.3), 0, 6.283); ctx.fill();
      }
    }
    if (!reduced) drawScene(ctx, t, k, state.tmx * W, (1 - state.tmy) * H);
    for (let i = state.sparks.length - 1; i >= 0; i--) {
      const s = state.sparks[i];
      s.life -= .009 * k; s.y -= .18 * k; s.x += Math.sin(s.life * 6) * .15;
      if (s.life <= 0) { state.sparks.splice(i, 1); continue; }
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
      g.addColorStop(0, `hsla(${s.hue},100%,78%,${s.life * .45})`); g.addColorStop(1, `hsla(${s.hue},100%,60%,0)`);
      ctx.globalAlpha = 1; ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 5, 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
