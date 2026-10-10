import { initOcean, setDepth, setTheme, setCalm } from './ocean.js';
import { Stage } from './stage.js';
import { $, $$, h, icon, api, streamText, md, parseCaption, toast, burst, countUp, store, API_BASE } from './util.js';
import { initContribute } from './contribute.js';
import { initSpecies, openForInstance } from './species.js';
import { hoverCard, infoCard } from './hovercard.js';
import { feedbackBar, verdictOf } from './feedback.js';
import { profile } from './profile.js';
import { renderAnnotate, leaveAnnotate } from './annotate.js';
import { renderMedia } from './media.js';

window.MC_MODEL = () => S.model;   // the chosen model, for pages outside the Explore view
const S = {
  cfg: null, status: {}, mode: 'learn', model: null, image: null, inst: [], byId: new Map(), sel: [],
  captions: new Map(), review: new Map(), messages: [], busy: false, segBusy: false,
};
const MODEL = (id) => S.cfg?.models.find((m) => m.id === id) || { label: id };

// ====================================================================== boot
initOcean();
const stage = new Stage($('#stageCanvas'), {
  onSelect: (ids) => setSelection(ids, false),
  onHover: (r, e) => showTip(r, e),
  onPreview: (pts) => previewPoints(pts),
});

(async function boot() {
  try {
    S.cfg = await api('/api/config');
  } catch (e) {
    toast('Cannot reach the MarineChat server. Is the backend running?', 'err', 8000);
    S.cfg = { models: [], demos: [], stats: {}, max_upload_mb: 15 };
  }
  S.model = store.get('model', S.cfg.default_model);
  if (!S.cfg.models.some((m) => m.id === S.model)) S.model = S.cfg.default_model;
  $('#maxMb').textContent = S.cfg.max_upload_mb;
  renderStats(S.cfg.stats);
  renderModelGrid();
  renderModelMenu();
  renderGallery();
  renderSuggests();
  heroDemo();
  fetch('bg/credits.json').then((r) => r.json()).then((list) => {
    const el = $('#photoCredits'); if (!el) return;
    el.append('Background photos: ');
    list.forEach((c, i) => el.append(i ? ' · ' : '', h('a', { href: c.source, target: '_blank', rel: 'noopener' }, c.title.replace(/\.(jpg|jpeg|png)$/i, '')),
      ` (${c.artist || 'unknown'}, ${c.license})`));
  }).catch(() => {});
  pollStatus();
  initContribute((stats) => renderStats(stats));
  initSpecies({
    image: () => S.image, mode: () => S.mode, model: () => S.model, contributor: () => contributor(), instNo: (r) => instNo(r),
    modelLabel: (id) => MODEL(id).label, review: (id) => S.review.get(id),
    onSpeciesPicked: (r, name, confirmed) => {
      S.review.set(r.id, { ...(S.review.get(r.id) || {}), species: name, species_confirmed: confirmed });
      renderInstCard(r); renderChips(); renderReview();
      if (!confirmed) toast(`#${instNo(r)} set to ${name}`, 'ok');
    },
    onCaptionCorrected: (r, text) => {
      S.review.set(r.id, { ...(S.review.get(r.id) || {}), correction: text });
      renderInstCard(r); renderReview();
    },
  });
  route();
})();

// ====================================================================== router
addEventListener('hashchange', route);
function route() {
  const [path, q] = (location.hash.slice(1) || '/').split('?');
  const top = path.startsWith('/annotate') ? '/annotate' : path;
  const name = { '/': 'home', '/explore': 'explore', '/contribute': 'contribute', '/about': 'about', '/annotate': 'annotate', '/media': 'media' }[top] || 'home';
  const params = new URLSearchParams(q || '');
  $$('.view').forEach((v) => { v.hidden = v.id !== `view-${name}`; });
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === name));
  document.body.dataset.route = name;
  document.body.classList.remove('menu');
  if (name !== 'annotate') leaveAnnotate();
  if (name === 'annotate') renderAnnotate($('#view-annotate'), path, params);
  if (name === 'media') renderMedia($('#view-media'), params);
  if (name === 'explore') {
    setMode(params.get('mode') || store.get('mode', 'learn'));
    setDepth(0.5); setCalm(true); requestAnimationFrame(() => { stage.fit(); moveInk(); });
    const pend = sessionStorage.getItem('mc.pendingImage');      // a photo sent here from an image set
    if (pend) { sessionStorage.removeItem('mc.pendingImage'); openImage(async () => JSON.parse(pend)); }
  } else if (name === 'home') { setCalm(false); onScroll(); }
  else { setCalm(true); setDepth(name === 'contribute' ? 0.75 : 0.65); }
  scrollTo({ top: 0, behavior: 'instant' });
  observeReveals();
}

const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
function observeReveals() { $$('.reveal:not(.in)').forEach((el) => io.observe(el)); }

$('#burger').onclick = () => document.body.classList.toggle('menu');

// ---------- depth gauge & shader depth on the landing page
const ZONES = $$('#view-home .zone');
addEventListener('scroll', onScroll, { passive: true });
function onScroll() {
  $('#nav').classList.toggle('solid', scrollY > 30 || document.body.dataset.route !== 'home');
  if (document.body.dataset.route !== 'home') return;
  const max = document.documentElement.scrollHeight - innerHeight;
  const f = max > 0 ? scrollY / max : 0;
  setDepth(f * 0.95);
  $('#gaugeFill').style.height = `${f * 100}%`;
  // interpolate metres between zone anchors
  const mid = scrollY + innerHeight * 0.5;
  let depth = 0, zone = 'Sunlight zone';
  for (let i = 0; i < ZONES.length; i++) {
    const z = ZONES[i], top = z.offsetTop, next = ZONES[i + 1];
    if (mid >= top) {
      zone = z.dataset.zone;
      const d0 = +z.dataset.depth, d1 = next ? +next.dataset.depth : d0;
      const span = next ? next.offsetTop - top : 1;
      depth = d0 + (d1 - d0) * Math.min(1, (mid - top) / span);
    }
  }
  $('#gaugeDepth').textContent = Math.round(depth).toLocaleString();
  $('#gaugeZone').textContent = zone;
}

// ====================================================================== status
async function pollStatus() {
  try {
    S.status = await api('/api/status'); S.statusAt = performance.now();
    const pill = $('#gpuPill'), st = S.status;
    const label = st.active ? MODEL(st.active).label : '';
    pill.dataset.s = st.state;
    pill.querySelector('span').textContent = st.state === 'ready' ? `${label} ready`
      : st.state === 'loading' ? `Loading ${label} · ${loadProgress().text}` : st.state === 'error' ? 'Model error' : 'GPU idle · MarineInst ready';
    pill.title = `Free VRAM ${st.free_vram_gb} GB · ${st.busy} running · ${st.waiting} waiting`;
    $('.mp-dot').dataset.s = st.active === S.model ? st.state : '';
    $$('.mp-item').forEach((b) => { const l = b.querySelector('.live'); if (l) l.textContent = st.active === b.dataset.id && st.state === 'ready' ? '● loaded' : ''; });
  } catch {
    $('#gpuPill').dataset.s = 'error'; $('#gpuPill span').textContent = 'offline';
  }
  setTimeout(pollStatus, document.hidden ? 10000 : S.busy || S.capBusy ? 1500 : 4000);
}

function renderStats(st = {}) {
  $$('[data-count]').forEach((el) => countUp(el, st[el.dataset.count] || 0));
}

// ====================================================================== home: models + hero
function badge(m) { return h('span', { class: `mc-badge ${m.badge}` }, m.badge === 'domain' ? 'marine domain' : m.badge); }
function renderModelGrid() {
  const g = $('#modelGrid'); g.innerHTML = '';
  for (const m of S.cfg.models) {
    const card = h('article', { class: 'model-card glass reveal' },
      badge(m), h('h3', {}, m.label), h('div', { class: 'tl' }, m.tagline), h('p', {}, m.detail),
      h('div', { class: 'meta' }, h('span', {}, m.params), h('span', {}, String(m.year)), h('span', {}, `~${m.vram_gb} GB VRAM`)),
      h('div', { class: 'vbar', title: 'share of a 24 GB GPU' }, h('i', { style: `--w:${Math.min(100, (m.vram_gb / 24) * 100)}%` })));
    card.onclick = () => { pickModel(m.id); location.hash = '#/explore'; };
    card.style.cursor = 'pointer';
    g.append(card);
  }
  observeReveals();
}

// ---------- landing-page showcase: slow, cross-fading scenes of real MarineInst masks + VLM captions
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const HERO = { paused: false, jump: null, cur: -1 };
async function heroDemo() {
  const frame = $('.demo-frame'), svg = $('#heroSvg'), cap = $('#heroCaption .txt'), tag = $('#heroCaption .tag');
  let data;
  try { const r = await fetch('demo/hero.json'); data = r.ok ? await r.json() : null; } catch { data = null; }
  const scenes = data?.scenes || (data?.image ? [data] : []);
  if (!scenes.length) { frame.classList.remove('loading'); typeLoop(cap, ['Upload a photo and MarineInst will find every creature in it.']); return; }
  const imgs = [$('#heroImg'), $('#heroImg2')];
  const dots = $('#heroDots');
  scenes.forEach((_, i) => dots.append(h('button', { 'aria-label': `Show example ${i + 1}`, onclick: () => { HERO.jump = i; } })));
  frame.addEventListener('mouseenter', () => { HERO.paused = true; });
  frame.addEventListener('mouseleave', () => { HERO.paused = false; });
  // preload every scene image so a switch never shows a half-loaded picture
  await Promise.all(scenes.map((sc) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = res; im.src = sc.image; })));
  const waitWhile = async (ms) => {
    for (let t = 0; t < ms || HERO.paused; t += 100) { if (HERO.jump != null) return true; await sleep(100); }
    return false;
  };
  let front = 0;
  for (let k = 0; ; k = HERO.jump != null ? HERO.jump : (k + 1) % scenes.length) {
    HERO.jump = null;
    const sc = scenes[k];
    // cross-fade to the next photo
    const back = 1 - front;
    imgs[back].src = sc.image;
    await imgs[back].decode().catch(() => {});
    imgs[back].classList.add('on'); imgs[front].classList.remove('on');
    front = back;
    frame.classList.remove('loading');
    [...dots.children].forEach((d, i) => d.classList.toggle('on', i === k));
    // masks draw themselves one after another
    svg.innerHTML = '';
    svg.setAttribute('viewBox', `0 0 ${sc.width} ${sc.height}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    const paths = sc.instances.map((r, i) => {
      const d = r.polys.map((p) => 'M' + p.pts.reduce((acc, v, j) => acc + (j % 2 ? ',' : j ? 'L' : '') + v, '') + 'Z').join('');
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', d); el.setAttribute('fill-rule', 'evenodd');
      svg.append(el);
      el.style.setProperty('--len', el.getTotalLength?.() || 2000);
      el.style.animationDelay = `${0.4 + i * 0.35}s`;
      return el;
    });
    cap.textContent = ''; tag.textContent = '…'; $('#heroModel').textContent = 'MarineInst ViT-H';
    if (await waitWhile(1800 + paths.length * 350)) continue;
    // captions: typed slowly, each held long enough to read
    let jumped = false;
    for (const c of sc.captions || []) {
      paths.forEach((p, i) => p.classList.toggle('sel', i === c.index));
      tag.textContent = `#${c.index + 1}`;
      $('#heroModel').textContent = c.model;
      await typeText(cap, c.text);
      if ((jumped = await waitWhile(5200))) break;
    }
    if (!jumped) await waitWhile(1200);
  }
}
function typeText(el, text) {
  return new Promise((res) => {
    let i = 0; el.textContent = '';
    const step = () => { i += 1; el.textContent = text.slice(0, i); if (i < text.length) setTimeout(step, 22); else res(); };
    step();
  });
}
async function typeLoop(el, arr) { for (let k = 0; ; k++) { await typeText(el, arr[k % arr.length]); await new Promise((r) => setTimeout(r, 4000)); } }

// ====================================================================== mode + model
$$('#modeSwitch button').forEach((b) => (b.onclick = () => setMode(b.dataset.mode)));
function setMode(mode) {
  S.mode = mode === 'research' ? 'research' : 'learn';
  store.set('mode', S.mode);
  document.body.dataset.mode = S.mode;
  $$('#modeSwitch button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  const on = $(`#modeSwitch button[data-mode="${S.mode}"]`), th = $('.seg-thumb');
  if (on && on.offsetWidth) { th.style.left = `${on.offsetLeft}px`; th.style.width = `${on.offsetWidth}px`; }
  else requestAnimationFrame(() => { if (on.offsetWidth) setMode(S.mode); });
  if (S.mode === 'learn' && $('.tab.on')?.dataset.tab === 'review') switchTab('chat');
  if (S.mode === 'learn') { stage.showNeg = false; $('#toolNeg').setAttribute('aria-pressed', 'false'); setTool('select'); }
  renderSuggests(); renderInstList(); moveInk();
  $('#prompt').placeholder = S.mode === 'learn' ? 'Ask about this image… e.g. “What is this animal?”' : 'Ask for an identification, features, comparisons…';
}

function renderModelMenu() {
  const menu = $('#mpMenu'); menu.innerHTML = '';
  for (const m of S.cfg.models) {
    const b = h('button', { class: `mp-item ${m.id === S.model ? 'on' : ''}`, 'data-id': m.id, role: 'option' },
      h('b', {}, m.label), badge(m), h('small', {}, `${m.tagline} · ${m.params} · ~${m.vram_gb} GB · first load ~${m.load_s || 30} s`), h('span', { class: 'live' }));
    b.onclick = () => { pickModel(m.id); $('#modelPicker').classList.remove('open'); };
    menu.append(b);
  }
  $('.mp-name').textContent = MODEL(S.model).label;
}
function pickModel(id) {
  S.model = id; store.set('model', id); renderModelMenu();
  if (S.image) api('/api/warm', { body: { model: id } }).catch(() => {});
  toast(`Captions & chat will use ${MODEL(id).label}`, '', 2500);
}
$('#mpBtn').onclick = (e) => { e.stopPropagation(); $('#modelPicker').classList.toggle('open'); };
document.addEventListener('click', (e) => { if (!e.target.closest('#modelPicker')) $('#modelPicker').classList.remove('open'); if (!e.target.closest('#paramsPop,#toolParams')) $('#paramsPop').hidden = true; });

// ====================================================================== image loading
const DEMO_ALT = {   // screen-reader names for the bundled demo photos
  '300433442_e797096db5_b.jpg': 'sea otters floating in a kelp bay', '304298721_59acb776a4_b.jpg': 'sea otters resting on a dock',
  '5145863905_486d8113a2_b.jpg': 'a camouflaged animal on a sandy seabed', '5160855772_a8bf945853_b.jpg': 'a sea slug on a rocky reef',
  '5189739663_9d5a7874e1_b.jpg': 'a blue-spotted stingray' };
function renderGallery() {
  const g = $('#gallery'); g.innerHTML = '';
  for (const [i, name] of (S.cfg.demos || []).entries()) {
    const what = DEMO_ALT[name] || `example photo ${i + 1}`;
    const b = h('button', { title: `Try this example: ${what}`, 'aria-label': `Try this example: ${what}` }, h('img', { src: `demo/${name}`, alt: '', loading: 'lazy' }));
    b.onclick = () => loadDemo(name);
    g.append(b);
  }
}
async function loadDemo(name) { await openImage(() => api(`/api/images/demo/${encodeURIComponent(name)}`, { method: 'POST' })); }
async function uploadFile(file) {
  if (!file || !file.type.startsWith('image/')) return toast('Please choose an image file', 'err');
  if (file.size > S.cfg.max_upload_mb * 2 ** 20) return toast(`Image is larger than ${S.cfg.max_upload_mb} MB`, 'err');
  const fd = new FormData(); fd.append('file', file);
  await openImage(() => api('/api/images', { form: fd }));
}
async function openImage(req) {
  try {
    $('#drop').style.opacity = 0.5;
    const info = await req();
    stopAll();
    const img = new Image();
    if (API_BASE) img.crossOrigin = 'anonymous';   // API on another origin: keep the canvas untainted
    img.src = info.url;
    await img.decode();
    S.image = info; S.inst = []; S.byId.clear(); S.sel = []; S.captions.clear(); S.review.clear(); S.messages = [];
    $('#drop').hidden = true; $('#canvasWrap').hidden = false; $('#stageTools').hidden = false; $('#strip').hidden = true;
    stage.setImage(img);
    renderMessages(); renderInstList(); renderReview(); updateCtx(); renderSuggests();
    api('/api/warm', { body: { model: S.model } }).catch(() => {});
    segment();
  } catch (e) { toast(e.message, 'err'); }
  finally { $('#drop').style.opacity = ''; }
}
$('#fileInput').onchange = (e) => uploadFile(e.target.files[0]);
$('#newImageBtn').onclick = () => { $('#drop').hidden = false; $('#canvasWrap').hidden = true; $('#stageTools').hidden = true; $('#strip').hidden = true; $('#addBar').hidden = true; };
const drop = $('#stage');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); $('#drop').classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); $('#drop').classList.remove('over'); }));
drop.addEventListener('drop', (e) => { const f = e.dataTransfer.files[0]; if (f) uploadFile(f); });
addEventListener('paste', (e) => {
  if (document.body.dataset.route !== 'explore') return;
  const f = [...(e.clipboardData?.files || [])].find((x) => x.type.startsWith('image/'));
  if (f) uploadFile(f);
});

// ====================================================================== segmentation
$('#toolSegment').onclick = () => segment();
$('#reSegment').onclick = () => { $('#paramsPop').hidden = true; segment(); };
$('#toolParams').onclick = (e) => { e.stopPropagation(); $('#paramsPop').hidden = !$('#paramsPop').hidden; };
[['iouThr', 'iouVal'], ['staThr', 'staVal'], ['pps', 'ppsVal']].forEach(([i, o]) => { $(`#${i}`).oninput = (e) => { $(`#${o}`).textContent = e.target.value; }; });

async function segment() {
  if (!S.image || S.segBusy) return;
  S.segBusy = true; $('#toolSegment').disabled = true; $('#scan').hidden = false;
  const t0 = performance.now(), tick = setInterval(() => { $('#scanTime').textContent = ((performance.now() - t0) / 1000).toFixed(1); }, 100);
  try {
    const r = await api('/api/segment', { body: { image_id: S.image.image_id, iou_thr: +$('#iouThr').value, sta_thr: +$('#staThr').value, points_per_side: +$('#pps').value } });
    S.inst = r.instances; S.byId = new Map(S.inst.map((x) => [x.id, x])); S.sel = []; S.captions.clear(); S.review.clear();
    numberInstances();
    stage.setInstances(S.inst);
    S.inst.forEach((x) => { x.color = stage.inst.find((q) => q.id === x.id)?.color; });
    const pos = S.inst.filter((x) => x.cate === 1).length;
    $('#segTime').textContent = `· ${r.seconds}s · ${S.inst.length - pos} non-instance filtered`;
    $('#strip').hidden = false;
    renderChips(); renderInstList(); renderReview(); updateCtx();
    renderSuggests();
    if (!pos) toast('No instances found. Try lowering the thresholds in Research mode, or add one by hand.', '', 6000);
    else if ($('#autoDescribe').checked) autoDescribe();
  } catch (e) { toast(e.message, 'err'); }
  finally { clearInterval(tick); S.segBusy = false; $('#toolSegment').disabled = false; $('#scan').hidden = true; }
}

const visibleInst = () => S.inst.filter((r) => r.cate === 1 || r.origin === 'user' || (S.mode === 'research' && stage.showNeg));
const instName = (r) => {
  const c = (S.captions.get(r.id) || []).find((x) => x.parsed?.label);
  return c ? c.parsed.label : r.origin === 'user' ? 'Added instance' : r.cate === 0 ? 'Non-instance' : `Instance`;
};
const instNo = (r) => r?.no ?? '?';
function numberInstances() {
  let k = 1;
  for (const r of S.inst.filter((x) => x.cate === 1 && x.origin !== 'user')) r.no = k++;
  for (const r of S.inst.filter((x) => x.origin === 'user')) r.no = k++;
  for (const r of S.inst.filter((x) => x.cate === 0 && x.origin !== 'user')) r.no = k++;
}

function renderSpInst() {
  const box = $('#spInst'), list = visibleInst();
  box.hidden = !list.length; box.innerHTML = '';
  list.forEach((r) => {
    const sr = stage.inst.find((q) => q.id === r.id);
    const c = h('button', { class: `chip ${S.sel.includes(r.id) ? 'sel' : ''}`, title: 'Explore this instance' }, sr ? stage.thumb(sr, 26) : '', h('span', { class: 'nm' }, `#${instNo(r)} ${instName(r)}`));
    c.onclick = () => { setSelection([r.id]); openSpeciesFor(r, true); };
    instHover(c, r, sr);
    box.append(c);
  });
}

function renderChips() {
  renderSpInst();
  const box = $('#chips'); box.innerHTML = '';
  const list = visibleInst();
  $('#instCount').textContent = list.length; $('#instBadge').textContent = list.length;
  list.forEach((r, i) => {
    const sr = stage.inst.find((q) => q.id === r.id);
    const v = S.review.get(r.id)?.mask;
    const chip = h('button', { class: `chip ${S.sel.includes(r.id) ? 'sel' : ''}`, style: `animation-delay:${i * 30}ms` },
      sr ? stage.thumb(sr, 34) : '', h('span', { class: 'nm' }, `#${instNo(r)} ${instName(r)}`),
      v ? h('span', { class: `v ${v === 'correct' ? 'ok' : 'bad'}` }, v === 'correct' ? '✓' : '✗') : '');
    chip.onclick = (e) => setSelection(e.shiftKey ? toggle(S.sel, r.id) : (S.sel.length === 1 && S.sel[0] === r.id ? [] : [r.id]));
    chip.onmouseenter = () => { stage.hover = r.id; stage.dirty = true; };
    chip.onmouseleave = () => { stage.hover = null; stage.dirty = true; };
    instHover(chip, r, sr);
    box.append(chip);
  });
}
/** Hover preview for an instance chip: larger crop, the model's label and description, review state. */
function instHover(el, r, sr) {
  hoverCard(el, () => {
    const c = (S.captions.get(r.id) || []).find((x) => !x.error && x.text), q = c?.parsed || {}, rv = S.review.get(r.id) || {};
    let img = null;
    try { img = sr ? stage.thumb(sr, 200).toDataURL('image/jpeg', 0.85) : null; } catch { img = null; }
    const desc = rv.correction || q.desc || c?.text || '';
    return infoCard({ img, wide: true, title: `#${instNo(r)} ${instName(r)}`, lines: [
      q.sci ? h('p', {}, h('i', {}, q.sci), q.conf ? ` · ${q.conf} confidence` : '') : '',
      desc ? `${desc.slice(0, 180)}${desc.length > 180 ? '…' : ''}` : 'Not described yet.',
      [`${(100 * r.area / (S.image.width * S.image.height)).toFixed(1)}% of image`, rv.species ? `species set to ${rv.species}` : '',
        rv.mask ? `mask marked ${rv.mask}` : '', rv.correction ? 'description corrected' : ''].filter(Boolean).join(' · ')] });
  });
}

const toggle = (arr, id) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

function setSelection(ids, fromUi = true) {
  S.sel = ids; if (fromUi) stage.select(ids);
  renderChips(); updateCtx();
  $$('.icard').forEach((c) => { const on = S.sel.includes(+c.dataset.id); c.classList.toggle('sel', on); c.setAttribute('aria-pressed', on); });
  const card = $(`.icard[data-id="${ids[ids.length - 1]}"]`);
  if (card && $('.tab.on')?.dataset.tab === 'inst') card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  renderSuggests();
  if ($('.tab.on')?.dataset.tab === 'species' && ids.length) openSpeciesFor(S.byId.get(ids[ids.length - 1]));
}

let speciesFor = null;
function openSpeciesFor(r, force = false) {
  if (!r || (!force && speciesFor === r.id && S.image?.image_id === speciesFor_img)) return;
  speciesFor = r.id; speciesFor_img = S.image?.image_id;
  openForInstance(r, S.captions.get(r.id) || []);
}
let speciesFor_img = null;

function showTip(r, e) {
  const tip = $('#hoverTip');
  if (!r || !e) { tip.hidden = true; return; }
  const wrap = $('#canvasWrap').getBoundingClientRect();
  tip.hidden = false;
  tip.style.left = `${e.clientX - wrap.left}px`; tip.style.top = `${e.clientY - wrap.top}px`;
  const c = (S.captions.get(r.id) || [])[0];
  tip.innerHTML = '';
  tip.append(h('b', {}, `#${instNo(S.byId.get(r.id) || r)} `), instName(S.byId.get(r.id) || r),
    S.mode === 'research' ? h('span', { class: 'muted mono' }, `  IoU ${r.iou.toFixed(2)}${r.stability != null ? ` · stab ${r.stability.toFixed(2)}` : ''}`) : '',
    !c ? h('span', { class: 'muted' }, ' · click to select') : '');
}

// ---------- tools
$('#toolSelect').onclick = () => setTool('select');
$('#toolAdd').onclick = () => setTool(stage.tool === 'add' ? 'select' : 'add');
$('#toolMasks').onclick = (e) => { stage.showMasks = !stage.showMasks; e.currentTarget.setAttribute('aria-pressed', stage.showMasks); stage.dirty = true; };
$('#toolNeg').onclick = (e) => { stage.showNeg = !stage.showNeg; e.currentTarget.setAttribute('aria-pressed', stage.showNeg); stage.dirty = true; renderChips(); renderInstList(); };
$('#opacity').oninput = (e) => { stage.opacity = +e.target.value; stage.dirty = true; };
function setTool(t) {
  stage.tool = t; document.body.dataset.tool = t; stage.clearPoints();
  $('#toolSelect').classList.toggle('on', t === 'select'); $('#toolAdd').classList.toggle('on', t === 'add');
  $('#addBar').hidden = t !== 'add'; $('#addCommit').disabled = true;
  if (t === 'add') toast('Click on a missed creature. Right-click marks areas to exclude.', '', 3500);
}
setTool('select');

let prevTimer = null, prevSeq = 0;
function previewPoints(pts) {
  clearTimeout(prevTimer);
  if (!pts.length) { stage.setPreview(null); $('#addCommit').disabled = true; return; }
  prevTimer = setTimeout(async () => {
    const seq = ++prevSeq;
    try {
      const r = await api('/api/segment/point', { body: { image_id: S.image.image_id, points: pts.map((p) => [p.x, p.y]), labels: pts.map((p) => p.l) } });
      if (seq === prevSeq) { stage.setPreview(r); $('#addCommit').disabled = false; }
    } catch (e) { toast(e.message, 'err'); }
  }, 120);
}
$('#addUndo').onclick = () => { stage.points.pop(); stage.dirty = true; previewPoints(stage.points); };
$('#addCancel').onclick = () => setTool('select');
$('#addCommit').onclick = async () => {
  const pts = stage.points;
  try {
    const r = await api('/api/segment/point', { body: { image_id: S.image.image_id, points: pts.map((p) => [p.x, p.y]), labels: pts.map((p) => p.l), commit: true } });
    const sr = stage.addInstance(r); r.color = sr.color;
    S.inst.push(r); S.byId.set(r.id, r); r.no = Math.max(0, ...S.inst.map((x) => x.no || 0)) + 1;
    S.review.set(r.id, { ...(S.review.get(r.id) || {}), mask: 'correct', added: true });
    stage.clearPoints(); $('#addCommit').disabled = true;
    renderChips(); renderInstList(); renderReview(); setSelection([r.id]);
    toast(`Added instance #${instNo(r)}. Give it a label in the Instances tab.`, 'ok');
  } catch (e) { toast(e.message, 'err'); }
};

// ====================================================================== tabs
$$('.tab').forEach((t) => (t.onclick = () => switchTab(t.dataset.tab)));
function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  $$('.tabpane').forEach((p) => p.classList.toggle('on', p.dataset.pane === name));
  moveInk();
  if (name === 'species' && S.sel.length) openSpeciesFor(S.byId.get(S.sel[S.sel.length - 1]));
}
function moveInk() {
  const t = $('.tab.on'), ink = $('.tab-ink');
  if (t && t.offsetWidth) { ink.style.left = `${t.offsetLeft}px`; ink.style.width = `${t.offsetWidth}px`; }
}
addEventListener('resize', () => { moveInk(); setMode(S.mode); });

// ====================================================================== captions
async function caption(r, model = S.model) {
  const list = S.captions.get(r.id) || [];
  const entry = { model, text: '', parsed: null, pending: true, abort: new AbortController() };
  list.unshift(entry); S.captions.set(r.id, list);
  renderInstCard(r);
  S.capBusy = true;
  const tick = setInterval(() => { if (!entry.text && S.status.state === 'loading') renderInstCard(r); }, 1000);
  entry.abort.signal.addEventListener('abort', () => clearInterval(tick));
  try {
    await streamText('/api/caption', { image_id: S.image.image_id, instance_id: r.id, model }, (t) => {
      entry.text = t; entry.parsed = model === 'marinegpt' ? null : parseCaption(t); throttleCard(r);
    }, entry.abort.signal);
  } catch (e) { entry.error = e.message; }
  clearInterval(tick);
  entry.pending = false; S.capBusy = false;
  if (entry.abort.signal.aborted) {
    entry.stopped = true;
    if (!entry.text) list.splice(list.indexOf(entry), 1);  // nothing produced: drop the empty card
  }
  renderInstCard(r); renderChips(); updateCtx();
  return entry;
}
/** Stop button on a pending caption; also ends a running "Describe all" / auto-describe batch. */
function stopCaption(entry) { S.capBatchStop = true; entry.abort.abort(); }
const cardRaf = new Map();
function throttleCard(r) { if (!cardRaf.has(r.id)) cardRaf.set(r.id, requestAnimationFrame(() => { cardRaf.delete(r.id); renderInstCard(r); })); }

// After segmentation, caption the largest few instances one by one so chips get real names.
async function autoDescribe() {
  const img = S.image?.image_id;
  const list = S.inst.filter((r) => r.cate === 1).slice(0, 5);
  S.capBatchStop = false;
  for (const r of list) {
    if (S.image?.image_id !== img || S.busy || S.capBatchStop) break;
    if ((S.captions.get(r.id) || []).length) continue;
    await caption(r);
  }
}
$('#autoDescribe').checked = store.get('autoDescribe', true);
$('#autoDescribe').onchange = (e) => store.set('autoDescribe', e.target.checked);

$('#captionAll').onclick = async () => {
  const list = visibleInst().filter((r) => !(S.captions.get(r.id) || []).some((c) => c.model === S.model && !c.error)).slice(0, 16);
  if (!list.length) return toast('Every visible instance already has a caption from this model.');
  switchTab('inst');
  S.capBatchStop = false;
  for (const r of list) { if (S.capBatchStop) break; await caption(r); }
};

function renderInstList() {
  const box = $('#instList');
  if (!box) return;
  const list = visibleInst();
  if (!list.length) { box.innerHTML = '<p class="muted pad">Run segmentation to see instances.</p>'; return; }
  box.innerHTML = '';
  for (const r of list) box.append(h('div', { class: 'icard', 'data-id': r.id }));
  list.forEach(renderInstCard);
}

function verdictBtns(r, key, label) {
  const rv = S.review.get(r.id) || {};
  const set = (v) => {
    S.review.set(r.id, { ...rv, [key]: rv[key] === v ? undefined : v }); stage.verdict.set(r.id, S.review.get(r.id).mask); stage.dirty = true;
    renderInstCard(r); renderChips(); renderReview();
    if (key === 'mask' && v === 'wrong' && rv[key] !== v) toast('Thanks! You can fix it yourself with “Edit mask”.', '', 4000);
  };
  return [
    h('button', { class: `ib ${rv[key] === 'correct' ? 'on-ok' : ''}`, title: `${label} is correct`, onclick: () => set('correct') }, icon('check'), label),
    h('button', { class: `ib ${rv[key] === 'wrong' ? 'on-bad' : ''}`, title: `${label} is wrong`, onclick: () => set('wrong') }, icon('x')),
  ];
}

function renderInstCard(r) {
  const card = $(`.icard[data-id="${r.id}"]`);
  if (!card) return;
  const sr = stage.inst.find((q) => q.id === r.id);
  const caps = S.captions.get(r.id) || [];
  const area = S.image ? (100 * r.area / (S.image.width * S.image.height)).toFixed(1) : '?';
  card.className = `icard ${S.sel.includes(r.id) ? 'sel' : ''}`;
  card.innerHTML = '';
  card.onclick = (e) => {
    if (e.target.closest('button, a, input, textarea, select, .fb-box, .fix')) return;
    setSelection(e.shiftKey ? toggle(S.sel, r.id) : (S.sel.length === 1 && S.sel[0] === r.id ? [] : [r.id]));
  };
  card.tabIndex = 0; card.setAttribute('aria-pressed', S.sel.includes(r.id));          // keyboard: Tab to a card, Enter/Space selects
  card.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); card.onclick(e); } };
  card.onmouseenter = () => { if (!stage.edit) { stage.hover = r.id; stage.dirty = true; } };
  card.onmouseleave = () => { if (!stage.edit) { stage.hover = null; stage.dirty = true; } };
  const th = sr ? stage.thumb(sr, 64) : h('div');
  th.onclick = () => setSelection([r.id]);
  const pick = capPick(r);
  const done = caps.filter((c) => !c.pending && c.text && !c.error);
  const choosing = done.length >= 2 || done.some((c) => c.edited);
  const capEls = caps.map((c) => {
    const shown = c.edited || c.text, p = c.edited ? parseCaption(c.edited) : c.parsed;
    c.key = c.key || `cap:${S.image?.image_id}:${r.id}:${c.model}:${Math.random().toString(36).slice(2, 8)}`;
    const finished = !c.pending && c.text && !c.error;
    const isBest = finished && pick.best === c.key;
    const failing = choosing && finished && pick.best && !isBest && verdictOf(c.key) !== 'correct';
    let body = c.error ? h('div', { class: 'err' }, c.error)
      : !c.text ? (S.status.state === 'loading' ? updateLoadingNote(loadingNote()) : h('span', { class: 'thinking' }, h('i'), h('i'), h('i')))
        : p && p.label ? h('div', {}, h('b', {}, p.label), p.sci && p.sci.toLowerCase() !== 'uncertain' ? h('i', { class: 'muted' }, ` · ${p.sci}`) : '', h('div', {}, p.desc))
          : h('div', {}, shown);
    if (pick.editing === c.key) body = capEditor(r, c);
    const tools = finished && pick.editing !== c.key ? h('span', { class: 'cap-tools' },
      h('button', { class: `ib ${isBest ? 'on-best' : ''}`, type: 'button', title: isBest ? 'This is the best caption' : 'Choose this as the best caption',
        onclick: () => { pick.best = isBest ? null : c.key; pick.saved = false; renderInstCard(r); } }, '★', isBest ? 'Best' : 'Best?'),
      h('button', { class: 'ib', type: 'button', title: 'Edit this caption', onclick: () => { pick.editing = c.key; renderInstCard(r); } }, icon('edit'), 'Edit')) : '';
    const fbk = !c.pending && c.text && !c.error ? feedbackBar({
      key: c.key, compact: true, question: choosing ? 'Acceptable?' : 'Caption right?',
      onVerdict: (v) => { S.review.set(r.id, { ...(S.review.get(r.id) || {}), caption: v }); renderReview(); if (choosing) renderInstCard(r); },
      payload: () => ({ target: 'caption', image_id: S.image.image_id, instance_id: r.id, model: c.model, original: c.text,
        role: S.mode, contributor: contributor(), context: { prompt: 'instance caption', label: p?.label || '', sci: p?.sci || '' } }),
    }) : '';
    return h('div', { class: `cap-item ${c.model === 'marinegpt' ? 'mg' : ''} ${isBest ? 'best' : ''} ${failing ? 'fail' : ''}` },
      h('div', { class: 'cm' }, MODEL(c.model).label, p?.conf ? h('span', { class: 'muted' }, `· ${p.conf} confidence`) : '',
        c.edited ? h('span', { class: 'origin user', title: `Original: ${c.text}` }, 'edited') : '',
        c.stopped ? h('span', { class: 'muted' }, '· stopped') : '',
        c.pending ? h('button', { class: 'ib stop-ib', title: 'Stop this caption', onclick: () => stopCaption(c) }, icon('stop'), 'Stop') : '', tools),
      body, failing ? h('div', { class: 'fail-note' }, 'Will be saved as a failure case unless you tick ✓') : '', fbk);
  });
  const capFoot = choosing ? h('div', { class: 'cap-choose' },
    h('span', { class: 'fine' }, pick.saved ? 'Choice saved. Thank you!' : pick.best ? 'Tick ✓ any other caption that is also acceptable, then save.' : 'Several captions: choose the best one (★), edit it if needed.'),
    h('button', { class: 'btn btn-xs btn-glow', type: 'button', disabled: !pick.best || pick.saved, onclick: () => saveCapChoice(r) }, icon('check'), 'Save choice')) : '';
  const maskWrong = S.review.get(r.id)?.mask === 'wrong';
  const acts = h('div', { class: 'acts' },
    h('button', { class: 'ib', onclick: () => caption(r), disabled: caps[0]?.pending }, icon('spark'), caps.length ? 'Describe again' : 'Describe'),
    h('button', { class: 'ib', onclick: () => { setSelection([r.id]); switchTab('chat'); $('#prompt').focus(); } }, icon('chat'), 'Ask'),
    h('button', { class: 'ib', title: 'Similar species, habits, habitats, clips', onclick: () => { setSelection([r.id]); switchTab('species'); openSpeciesFor(r, true); } }, icon('tree'), 'Species'),
    S.mode === 'research' ? [...verdictBtns(r, 'mask', 'Mask'),
      h('button', { class: `ib ${maskWrong ? 'attn' : ''}`, title: 'Refine this mask with brush, eraser or smart clicks', onclick: () => startMaskEdit(r) }, icon('brush'), 'Edit mask'),
      h('button', { class: 'ib', onclick: () => openFix(r, card) }, icon('edit'), 'Fix'),
      r.origin === 'user' ? h('button', { class: 'ib', onclick: () => deleteInst(r) }, icon('trash')) : ''] : '');
  card.append(th,
    h('div', {},
      h('div', { class: 'ih' }, h('b', {}, `#${instNo(r)} ${instName(r)}`),
        r.origin === 'user' ? h('span', { class: 'origin user' }, 'added') : r.cate === 0 ? h('span', { class: 'origin neg' }, 'non-instance') : ''),
      S.mode === 'research' ? h('div', { class: 'scores' }, h('span', {}, `IoU ${r.iou.toFixed(3)}`), r.stability != null ? h('span', {}, `stab ${r.stability.toFixed(3)}`) : '', h('span', {}, `${area}% area`)) :
        h('div', { class: 'scores' }, h('span', {}, `${area}% of image`)),
      S.review.get(r.id)?.species ? h('div', { class: 'scores' }, h('span', { style: 'color:var(--ok)' }, `✎ ${S.review.get(r.id).species}`)) : '',
      r.edited ? h('div', { class: 'scores' }, h('span', { class: 'origin user' }, 'mask refined')) : ''),
    caps.length ? h('div', { class: 'cap' }, capEls, capFoot) : '', acts);
}

// ---- choosing the best caption: one best (optionally edited), ✓ = also acceptable, the rest are failure cases
const capPicks = new Map();
function capPick(r) {
  const k = `${S.image?.image_id}:${r.id}`;
  if (!capPicks.has(k)) capPicks.set(k, { best: null, editing: null, saved: false });
  return capPicks.get(k);
}
function capEditor(r, c) {
  const pick = capPick(r);
  const ta = h('textarea', { rows: 5, maxlength: 4000, 'aria-label': 'Edit caption' }); ta.value = c.edited || c.text;
  ta.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') cancel.click(); if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) save.click(); });
  const save = h('button', { class: 'btn btn-xs btn-glow', type: 'button' }, icon('check'), 'Use my edit');
  const cancel = h('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Cancel');
  save.onclick = () => {
    const v = ta.value.trim();
    c.edited = v && v !== c.text ? v : null;
    pick.editing = null; pick.saved = false;
    if (c.edited) pick.best = c.key;                         // the edited caption becomes the chosen one
    renderInstCard(r);
    if (c.edited && (S.captions.get(r.id) || []).filter((x) => !x.pending && x.text && !x.error).length < 2) saveCapChoice(r);
  };
  cancel.onclick = () => { pick.editing = null; renderInstCard(r); };
  requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); });
  return h('div', { class: 'cap-edit' }, ta, h('div', { class: 'row gap' }, h('span', { class: 'fine' }, 'Keep the Label / Scientific name / Description lines if you can.'), cancel, save));
}
async function saveCapChoice(r) {
  const pick = capPick(r), caps = (S.captions.get(r.id) || []).filter((x) => !x.pending && x.text && !x.error);
  const best = caps.find((c) => c.key === pick.best) || (caps.length === 1 ? caps[0] : null);
  if (!best) return;
  const final = best.edited || best.text;
  const others = caps.filter((c) => c !== best);
  const brief = (c) => ({ model: c.model, text: c.text.slice(0, 700) });
  const accepted = others.filter((c) => verdictOf(c.key) === 'correct').map(brief), rejected = others.filter((c) => verdictOf(c.key) !== 'correct').map(brief);
  try {
    await api('/api/feedback', { body: { target: 'caption', verdict: best.edited ? 'corrected' : 'preferred', image_id: S.image.image_id, instance_id: r.id,
      model: best.model, original: best.text, correction: best.edited || '', role: S.mode, contributor: contributor(),
      context: { prompt: 'instance caption', choice: 'best of ' + caps.length, best_model: best.model, best_text: final.slice(0, 3000),
        accepted: JSON.stringify(accepted.slice(0, 5)), rejected: JSON.stringify(rejected.slice(0, 5)) } } });
    const pp = parseCaption(final);
    S.review.set(r.id, { ...(S.review.get(r.id) || {}), caption: best.edited ? 'corrected' : 'correct', correction: best.edited ? (pp.desc || final) : (S.review.get(r.id)?.correction || ''),
      best_model: best.model, ...(pp.sci && !S.review.get(r.id)?.species && pp.sci.toLowerCase() !== 'uncertain' && best.edited ? { species: pp.sci } : {}) });
    pick.saved = true;
    toast(rejected.length ? `Saved: 1 best${accepted.length ? `, ${accepted.length} acceptable` : ''}, ${rejected.length} failure case${rejected.length > 1 ? 's' : ''}` : 'Caption saved. Thank you!', 'ok');
    renderInstCard(r); renderReview(); renderChips();
  } catch (e) { toast(e.message, 'err'); }
}

function openFix(r, card) {
  if (card.querySelector('.fix')) return card.querySelector('.fix').remove();
  const rv = S.review.get(r.id) || {};
  const cap = (S.captions.get(r.id) || [])[0];
  const lab = h('input', { placeholder: 'Correct name / taxon, e.g. Amphiprion ocellaris', value: rv.species || '' });
  const txt = h('textarea', { rows: 3, placeholder: 'Corrected description (optional)' }); txt.value = rv.correction || '';
  const notes = h('input', { placeholder: 'Notes (optional)', value: rv.notes || '' });
  const save = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, 'Save & send');
  save.onclick = async () => {
    S.review.set(r.id, { ...rv, species: lab.value.trim(), correction: txt.value.trim(), notes: notes.value.trim() });
    try {
      await api('/api/feedback', { body: { image_id: S.image.image_id, instance_id: r.id, target: 'caption', verdict: rv.caption || (txt.value || lab.value ? 'corrected' : ''), model: cap?.model, original: cap?.text, correction: txt.value.trim(), species: lab.value.trim(), notes: notes.value.trim(), role: S.mode, contributor: contributor() } });
      toast('Thanks! Your correction was recorded.', 'ok');
      const b = save.getBoundingClientRect(); burst(b.left + b.width / 2, b.top);
    } catch (e) { toast(e.message, 'err'); }
    renderInstCard(r); renderChips(); renderReview();
  };
  card.append(h('div', { class: 'fix' }, lab, txt, notes, h('div', { class: 'row gap' }, save)));
  lab.focus();
}

async function deleteInst(r) {
  await api('/api/instances/delete', { body: { image_id: S.image.image_id, instance_id: r.id } }).catch(() => {});
  S.inst = S.inst.filter((x) => x.id !== r.id); S.byId.delete(r.id); S.review.delete(r.id);
  stage.removeInstance(r.id); setSelection(S.sel.filter((x) => x !== r.id)); renderInstList(); renderReview();
}

// ====================================================================== chat
const SUGG = {
  learn: { none: ['What lives in this scene?', 'What habitat is this?', 'Explain it like I\'m 10'], inst: ['What is this creature?', 'Where does it live?', 'What does it eat?', 'A fun fact about it', 'Is it endangered?'] },
  research: { none: ['List the taxa you can see', 'Estimate benthic cover types', 'Image quality issues?'], inst: ['Identify with confidence level', 'Diagnostic features?', 'Possible confusions?', 'Compare the selected instances'] },
};
function renderSuggests() {
  const box = $('#suggests'); box.innerHTML = '';
  if (!S.image) return;
  const set = SUGG[S.mode][S.sel.length ? 'inst' : 'none'];
  set.forEach((s, i) => box.append(h('button', { class: 'sugg', style: `animation-delay:${i * 40}ms`, onclick: () => send(s) }, s)));
  if (S.mode === 'learn') box.append(h('button', { class: 'sugg quiz', onclick: () => send('Quiz me!', { quiz: true }) }, icon('quiz'), ' Quiz me'));
}

function updateCtx() {
  const l = $('#ctxLabel');
  if (!S.sel.length) { l.textContent = 'the whole image'; l.className = 'ctx-chip'; $('#ctxClear').hidden = true; }
  else { l.textContent = S.sel.map((id) => `#${instNo(S.byId.get(id))} ${instName(S.byId.get(id))}`).join(', '); l.className = 'ctx-chip inst'; $('#ctxClear').hidden = false; }
}
$('#ctxClear').onclick = () => setSelection([]);

const prompt = $('#prompt');
prompt.addEventListener('input', () => { prompt.style.height = 'auto'; prompt.style.height = `${Math.min(140, prompt.scrollHeight)}px`; });
prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#composer').requestSubmit(); }
  if (e.key === 'Escape' && S.busy) { e.preventDefault(); stopChat(); }
});
$('#composer').onsubmit = (e) => {
  e.preventDefault();
  if (S.busy) return stopChat();  // while streaming, the send button is the Stop button
  const t = prompt.value.trim();
  if (t) { prompt.value = ''; prompt.style.height = 'auto'; send(t); }
};

function setStreaming(on) {
  const b = $('#sendBtn');
  b.classList.toggle('stop', on);
  b.title = on ? 'Stop generating (Esc)' : 'Send';
  b.setAttribute('aria-label', on ? 'Stop generating' : 'Send');
}
function stopChat() { S.chatAbort?.abort(); }
/** Abort everything streaming for the current image (used when a new image is opened). */
function stopAll() {
  stopChat(); S.capBatchStop = true;
  for (const list of S.captions.values()) for (const c of list) if (c.pending) c.abort?.abort();
}

async function send(text, { quiz = false } = {}) {
  if (!S.image) return toast('Load an image first', 'err');
  if (S.busy) return toast('Still answering. Press Stop (or Esc) to interrupt.');
  S.messages.push({ role: 'user', text });
  const bot = { role: 'assistant', text: '', model: S.model, pending: true, context: S.sel.slice(), id: `chat:${Date.now()}:${Math.random().toString(36).slice(2, 7)}` };
  S.messages.push(bot);
  renderMessages();
  S.busy = true; S.chatAbort = new AbortController(); setStreaming(true);
  const el = $('#messages').lastElementChild;
  const watch = setInterval(() => {
    if (!bot.text && S.status.state === 'loading') {
      let n = el.querySelector('.loading-note');
      if (!n) el.append(n = loadingNote());
      updateLoadingNote(n);
    } else if (!bot.text && S.status.waiting > 0 && S.status.active && S.status.active !== S.model) {
      let n = el.querySelector('.loading-note');
      if (!n) el.append(n = h('div', { class: 'loading-note' }));
      n.textContent = `Queued: another visitor is using ${MODEL(S.status.active).label}; switching soon.`;
    }
  }, 700);
  let raf = 0;
  try {
    await streamText('/api/chat', {
      image_id: S.image.image_id, model: S.model, mode: S.mode, instance_ids: S.sel, quiz,
      messages: S.messages.filter((m) => !m.pending && !m.error && m.text).map((m) => ({ role: m.role, text: m.text })),
    }, (t) => { bot.text = t; if (!raf) raf = requestAnimationFrame(() => { raf = 0; paintBot(el, bot); }); }, S.chatAbort.signal);
  } catch (e) { bot.error = e.message; }
  clearInterval(watch);
  if (S.chatAbort.signal.aborted) bot.stopped = true;
  bot.pending = false; S.busy = false; setStreaming(false);
  el.querySelector('.loading-note')?.remove();
  cancelAnimationFrame(raf); paintBot(el, bot, true);
}

function renderMessages() {
  const box = $('#messages'); box.innerHTML = '';
  if (!S.messages.length) {
    box.append(h('div', { class: 'empty-chat' }, h('div', { class: 'bubble-art' }, h('i'), h('i'), h('i')),
      h('p', {}, S.image ? 'Tap a creature to focus on it, or ask about the whole scene.' : 'Load an image, tap a creature, then ask away.')));
    return;
  }
  for (const m of S.messages) {
    if (m.role === 'user') box.append(h('div', { class: 'msg user' }, m.text));
    else { const el = h('div', { class: 'msg bot' }); box.append(el); paintBot(el, m, !m.pending); }
  }
  box.scrollTop = box.scrollHeight;
}

function paintBot(el, m, final = false) {
  const box = $('#messages'), stick = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
  el.innerHTML = '';
  el.append(h('div', { class: 'who' }, h('span', { class: 'm' }, MODEL(m.model).label),
    m.context?.length ? h('span', {}, `· about ${m.context.map((id) => '#' + instNo(S.byId.get(id) || { })).join(' ')}`) : ''));
  const body = h('div', { class: 'body' });
  if (m.error) body.append(h('div', { class: 'err' }, m.error));
  else if (!m.text && m.stopped) body.append(h('span', { class: 'muted' }, 'Stopped before the model answered.'));
  else if (!m.text) body.append(h('span', { class: 'thinking' }, h('i'), h('i'), h('i')));
  else { body.innerHTML = md(m.text); if (!final) body.lastElementChild?.append(h('i', { class: 'caret' })); }
  if (m.stopped && m.text) body.append(h('div', { class: 'stopped-note' }, icon('stop'), 'Stopped'));
  el.append(body);
  if (final && !m.error && m.text) {
    const q = S.messages[S.messages.indexOf(m) - 1];
    const cp = h('button', { class: 'ib', title: 'Copy' }, icon('copy'));
    cp.onclick = () => navigator.clipboard?.writeText(m.text).then(() => toast('Copied', '', 1500));
    const bar = feedbackBar({
      key: m.id || `chat:${S.messages.indexOf(m)}`, question: 'Helpful & correct?',
      payload: () => ({ target: 'chat', image_id: S.image.image_id, model: m.model, original: `Q: ${q?.text}\nA: ${m.text}`,
        role: S.mode, contributor: contributor(),
        context: { question: q?.text || '', answer: m.text, instance_ids: (m.context || []).join(','), mode: S.mode, stopped: m.stopped ? 'yes' : '' } }),
    });
    el.append(h('div', { class: 'msg-actions' }, bar, cp));
  }
  if (stick) box.scrollTop = box.scrollHeight;
}

// ====================================================================== review & export
function contributor() {
  const c = { name: $('#revName').value.trim(), affiliation: $('#revAff').value.trim(), email: $('#revEmail').value.trim() };
  if (c.name || c.affiliation || c.email || !store.get('contributor', null)) store.set('contributor', c);
  const saved = store.get('contributor', {});
  return { name: c.name || saved.name || '', affiliation: c.affiliation || saved.affiliation || '', email: c.email || saved.email || '', uid: profile().uid };
}
(function restoreContributor() {
  const c = store.get('contributor', {});
  $('#revName').value = c.name || ''; $('#revAff').value = c.affiliation || ''; $('#revEmail').value = c.email || '';
})();

function renderReview() {
  const vals = [...S.review.values()];
  const checked = vals.filter((v) => v.mask || v.caption || v.species).length;
  const wrong = vals.filter((v) => v.mask === 'wrong' || v.caption === 'wrong').length;
  const added = vals.filter((v) => v.added).length;
  $('#reviewBadge').textContent = checked;
  $('#reviewSum').innerHTML = '';
  $('#reviewSum').append(
    h('div', {}, h('b', {}, String(checked)), h('span', {}, 'reviewed')),
    h('div', {}, h('b', { style: 'color:var(--bad)' }, String(wrong)), h('span', {}, 'marked wrong')),
    h('div', {}, h('b', { style: 'color:#cfc8ff' }, String(added)), h('span', {}, 'added')));
}

function reviewPayload() {
  return S.inst.map((r) => {
    const v = S.review.get(r.id) || {}, cap = (S.captions.get(r.id) || []).find((c) => !c.error && c.text);
    return { instance_id: r.id, origin: r.origin, cate: r.cate, bbox: r.bbox, iou: r.iou, mask_verdict: v.mask || null, caption_verdict: v.caption || null,
      caption_model: cap?.model || null, caption: cap?.text || null, species: v.species || null, correction: v.correction || null, notes: v.notes || null };
  }).filter((x) => x.mask_verdict || x.caption_verdict || x.species || x.correction || x.origin === 'user');
}

$('#submitReview').onclick = async (e) => {
  if (!S.image) return toast('Load an image first', 'err');
  const reviews = reviewPayload();
  if (!reviews.length && !$('#reviewNotes').value.trim()) return toast('Mark at least one mask or caption first (✓ / ✗ in Instances).', 'err');
  try {
    const r = await api('/api/feedback', { body: { image_id: S.image.image_id, target: 'annotation', verdict: 'review', notes: $('#reviewNotes').value.trim(), reviews, share_image: $('#revShare').checked, role: 'research', contributor: contributor() } });
    renderStats(r.stats);
    const b = e.currentTarget.getBoundingClientRect(); burst(b.left + b.width / 2, b.top, 22);
    toast(`Review submitted: ${reviews.length} instance(s). Thank you for improving MarineInst!`, 'ok', 6000);
  } catch (err) { toast(err.message, 'err'); }
};

$('#exportJson').onclick = () => {
  if (!S.image) return;
  const ann = S.inst.filter((r) => r.cate === 1 || r.origin === 'user').map((r) => {
    const v = S.review.get(r.id) || {}, cap = (S.captions.get(r.id) || []).find((c) => c.text && !c.error);
    return { id: r.id, image_id: 0, category_id: 1, bbox: r.bbox, area: r.area, iscrowd: 0,
      segmentation: r.polys.filter((p) => !p.hole).map((p) => p.pts), predicted_iou: r.iou, stability_score: r.stability, origin: r.origin,
      caption: cap?.text || null, caption_model: cap?.model || null, review: v };
  });
  const out = { info: { description: 'MarineChat export (MarineInst instance visual description)', date_created: new Date().toISOString() },
    images: [{ id: 0, width: S.image.width, height: S.image.height, file_name: S.image.image_id + '.jpg' }],
    categories: [{ id: 1, name: 'marine_instance' }], annotations: ann };
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' })), download: `marinechat_${S.image.image_id}.json` });
  a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

$('#copyCite').onclick = () => navigator.clipboard?.writeText($('#citeBox').textContent).then(() => toast('BibTeX copied', 'ok', 1800));

// keyboard shortcuts in the app
addEventListener('keydown', (e) => {
  if (document.body.dataset.route !== 'explore' || e.target.closest('input,textarea,select')) return;
  if (e.key === 'Escape') { if (S.busy) return stopChat(); setSelection([]); if (stage.tool === 'add') setTool('select'); }
  if (e.key === 'm') $('#toolMasks').click();
  if (e.key === 'a' && S.mode === 'research') $('#toolAdd').click();
});

// ====================================================================== mask editor
function startMaskEdit(r) {
  if (!S.image) return;
  if (stage.tool === 'add') setTool('select');
  setSelection([r.id]);
  const sr = stage.inst.find((q) => q.id === r.id);
  if (!sr) return;
  stage.startEdit(sr);
  S.editing = r;
  // phones: the bar goes under the picture instead of covering half of it
  const bar = $('#editBar'), st = $('#stage');
  if (matchMedia('(max-width: 860px)').matches) st.after(bar); else if (bar.parentNode !== st) st.append(bar);
  $('#editBar').hidden = false; $('#stageTools').hidden = true; $('#addBar').hidden = true;
  setEditTool('smart');
}
const TOUCH = matchMedia('(hover: none) and (pointer: coarse)').matches;
const EDIT_HINT = TOUCH ? {
  smart: 'Smart tap: tap a part of the creature to add it (MarineInst finds the region). Use Cut to remove one.',
  smartneg: 'Cut: tap a region to remove it from the mask.',
  brush: 'Brush: drag to paint the mask.',
  erase: 'Eraser: drag to remove parts of the mask.',
} : {
  smart: 'Smart click: left-click adds the region under the cursor, right-click removes it (MarineInst finds the region).',
  brush: 'Brush: drag to paint the mask. Hold right button to erase. [ and ] change the size.',
  erase: 'Eraser: drag to remove parts of the mask. [ and ] change the size.',
};
function setEditTool(t) {
  if (!stage.edit) return;
  stage.edit.tool = t; stage.edit.points = []; stage.dirty = true;
  $$('[data-etool]').forEach((b) => b.classList.toggle('on', b.dataset.etool === t));
  $('#editHint').textContent = EDIT_HINT[t];
  document.body.dataset.tool = `edit-${t}`;
}
function endMaskEdit() {
  stage.endEdit(); S.editing = null;
  $('#editBar').hidden = true; $('#stageTools').hidden = !S.image;
  document.body.dataset.tool = 'select';
}
$$('[data-etool]').forEach((b) => (b.onclick = () => setEditTool(b.dataset.etool)));
$('#brushSize').oninput = (e) => { if (stage.edit) { stage.edit.size = +e.target.value; stage.dirty = true; } };
$('#editUndo').onclick = () => stage.undoEdit();
$('#editRedo').onclick = () => stage.redoEdit();
$('#editReset').onclick = () => stage.resetEdit();
$('#editCancel').onclick = endMaskEdit;
let refineSeq = 0;
stage.onRefine = async (pts) => {
  const r = S.editing; if (!r) return;
  const seq = ++refineSeq;
  $('#editHint').textContent = 'Refining with MarineInst…';
  try {
    const res = await api('/api/segment/refine', { body: { image_id: S.image.image_id, instance_id: r.id, mask_png: stage.editPNG(),
      points: pts.map((p) => [p.x, p.y]), labels: pts.map((p) => p.l) } });
    if (seq !== refineSeq || !stage.edit) return;
    stage.setEditPolys(res.polys); stage.edit.tools.add('smart');
    $('#editHint').textContent = `Updated (stability ${res.stability.toFixed(2)}). Keep clicking, or switch to Brush / Erase for fine details.`;
  } catch (e) { toast(e.message, 'err'); $('#editHint').textContent = EDIT_HINT.smart; }
};
$('#editSave').onclick = async (e) => {
  const r = S.editing; if (!r || !stage.edit) return;
  const btn = e.currentTarget; btn.disabled = true;
  try {
    const rec = await api('/api/instances/update', { body: { image_id: S.image.image_id, instance_id: r.id, mask_png: stage.editPNG(),
      tools: [...stage.edit.tools], role: S.mode, contributor: contributor() } });
    Object.assign(r, { polys: rec.polys, bbox: rec.bbox, area: rec.area, edited: true });
    stage.updateInstance(rec);
    S.review.set(r.id, { ...(S.review.get(r.id) || {}), mask: 'refined' });
    stage.verdict.set(r.id, 'refined');
    endMaskEdit();
    renderChips(); renderInstList(); renderReview();
    const b = btn.getBoundingClientRect(); burst(b.left + b.width / 2, b.top, 18);
    toast(`Mask #${instNo(r)} saved. The original prediction is kept for the team. Thank you!`, 'ok', 5000);
  } catch (err) { toast(err.message, 'err'); }
  finally { btn.disabled = false; }
};
addEventListener('keydown', (e) => {
  if (!stage.edit || e.target.closest('input,textarea,select')) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? stage.redoEdit() : stage.undoEdit(); return; }
  if (k === 'b') setEditTool('brush');
  else if (k === 'e') setEditTool('erase');
  else if (k === 's') setEditTool('smart');
  else if (k === '[' || k === ']') {
    const v = Math.max(2, Math.min(120, stage.edit.size + (k === ']' ? 4 : -4)));
    stage.edit.size = v; $('#brushSize').value = v; stage.dirty = true;
  } else if (k === 'escape') endMaskEdit();
  else if (k === 'enter') $('#editSave').click();
});

// ====================================================================== theme switch (auto / dark / light / ocean)
// Auto (the default) follows the visitor's clock: morning Maritime (light), afternoon Sunlit reef, evening and night Deep sea.
const THEME_NAMES = { light: 'Maritime', ocean: 'Sunlit reef', dark: 'Deep sea' };
const clockTheme = (d = new Date()) => { const hr = d.getHours(); return hr >= 5 && hr < 12 ? 'light' : hr >= 12 && hr < 18 ? 'ocean' : 'dark'; };
const urlTheme = new URLSearchParams(location.search).get('theme');
let themeMode = ['dark', 'light', 'ocean'].includes(urlTheme) ? urlTheme : store.get('themeMode', 'auto');
function applyTheme(t) {
  if (!['dark', 'light', 'ocean'].includes(t)) t = 'dark';
  document.documentElement.dataset.theme = t;
  setTheme(t);
  const btns = $$('#themeSwitch button'), active = themeMode === 'auto' ? 'auto' : t;
  btns.forEach((b) => { b.setAttribute('aria-checked', String(b.dataset.theme === active)); b.classList.toggle('auto-pick', themeMode === 'auto' && b.dataset.theme === t); });
  const auto = btns.find((b) => b.dataset.theme === 'auto');
  if (auto) auto.title = `Auto: follows your clock (now ${THEME_NAMES[t]})`;
  const on = btns.find((b) => b.dataset.theme === active), th = $('.ts-thumb');
  if (on && on.offsetWidth) { th.style.left = `${on.offsetLeft}px`; th.style.width = `${on.offsetWidth}px`; }
  else requestAnimationFrame(() => applyTheme(t));
  stage.dirty = true;
}
function setThemeMode(m) {
  themeMode = m;
  store.set('themeMode', m);
  applyTheme(m === 'auto' ? clockTheme() : m);
  if (m === 'auto') toast(`Auto theme: ${THEME_NAMES[clockTheme()]} now, changing with your clock`, '', 2600);
}
$$('#themeSwitch button').forEach((b) => (b.onclick = () => setThemeMode(b.dataset.theme)));
applyTheme(document.documentElement.dataset.theme || clockTheme());
setInterval(() => { if (themeMode === 'auto' && document.documentElement.dataset.theme !== clockTheme()) applyTheme(clockTheme()); }, 60000);

// ====================================================================== hover spotlight on interactive elements
const FX = '.glass, .btn, .chip, .icard, .sim, .vid, .ph, .fact-chip, .tool, .sugg, .step, .model-card, .gallery button, .mp-item, .tab, .ib, .sp-sec-head, .cthumbs div';
if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
  let fxRaf = 0, fxEvt = null;
  addEventListener('pointermove', (e) => {
    fxEvt = e;
    if (fxRaf) return;
    fxRaf = requestAnimationFrame(() => {
      fxRaf = 0;
      const t = fxEvt.target.closest?.(FX);
      if (!t) return;
      // the spotlight follows the pointer inside the hovered element (and its glass container)
      for (const el of [t, t.parentElement?.closest('.glass')].filter(Boolean)) {
        const b = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${fxEvt.clientX - b.left}px`);
        el.style.setProperty('--my', `${fxEvt.clientY - b.top}px`);
      }
    });
  }, { passive: true });
}

// ====================================================================== model loading progress
/** Elapsed / expected seconds of the current cold load, extrapolated between status polls. */
function loadProgress() {
  const st = S.status || {};
  const el = (st.loading_s || 0) + (S.statusAt ? (performance.now() - S.statusAt) / 1000 : 0);
  const exp = st.expected_load_s || MODEL(st.active).load_s || 30;
  const frac = Math.min(.97, el / exp);
  const text = el <= exp * 1.15 ? `${Math.round(el)} s of ~${exp} s` : `${Math.round(el)} s, almost there…`;
  return { el, exp, frac, text };
}
function loadingNote() {
  return h('div', { class: 'loading-note' }, h('span', { class: 'ln-text' }), h('div', { class: 'ln-bar' }, h('i')));
}
function updateLoadingNote(n) {
  const p = loadProgress();
  n.querySelector('.ln-text').textContent = `Loading ${MODEL(S.status.active).label} onto the GPU · ${p.text}. Only the first answer waits for this.`;
  n.querySelector('.ln-bar i').style.width = `${(p.frac * 100).toFixed(1)}%`;
  return n;
}
