// Video studio (opens from a clip in the Species tab): play the clip, write a caption, and tag moments.
// The keyframe preview follows playback; pausing freezes it so the moment can be named. "+" adds a
// keyframe - keyword pair (no limit). The model reads a contact sheet of frames and proposes a caption and
// keywords; its keyword suggestions are refreshed from the tags people add. Saved to /api/video/annotations.
import { h, icon, api, toast, burst, streamText, API_BASE } from './util.js';
import { hoverCard, infoCard } from './hovercard.js';

const drafts = new Map();          // video id -> { caption, captionSource, pairs, saved, ai }
const FRAME_W = 192;

const fmt = (t) => (t == null || !isFinite(t) ? '–' : `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`);
const norm = (s) => s.trim().toLowerCase();

/** "[[MC_MODEL:id]]text" -> { model, text } */
export function splitModel(t) {
  const m = t.match(/^\[\[MC_MODEL:([\w.-]+)\]\]/);
  return { model: m ? m[1] : '', text: m ? t.slice(m[0].length) : t };
}
export function parseDescribe(t) {
  const c = t.match(/Caption:\s*([\s\S]*?)(?:\n\s*Keywords:|$)/i), k = t.match(/Keywords:\s*([\s\S]*)$/i);
  const keywords = k ? k[1].split(/[,\n;]/).map((s) => s.replace(/^[\s\-*•\d.)]+/, '').replace(/[."]+$/, '').trim()).filter((s) => s && s.length <= 40) : [];
  return { caption: (c ? c[1] : k ? '' : t).trim(), keywords };
}

/** Sample n frames across the clip (hidden second player) into one labelled JPEG contact sheet. */
export async function contactSheet(item, n = 6) {
  const W = 320, H = 180;
  const once = (el, ev, ms = 15000) => new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    el.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true });
    el.addEventListener('error', () => { clearTimeout(t); rej(new Error('media error')); }, { once: true });
  });
  if (item.provider === 'youtube' || !item.src) {           // no frame access: the poster is the only picture
    if (!item.poster) return null;
    const img = new Image(); if (API_BASE) img.crossOrigin = 'anonymous'; img.src = item.poster;
    await once(img, 'load');
    const c = h('canvas', { width: 640, height: 360 }); c.getContext('2d').drawImage(img, 0, 0, 640, 360);
    return { sheet: c.toDataURL('image/jpeg', 0.82), n: 1 };
  }
  const v = document.createElement('video');
  v.muted = true; v.preload = 'auto'; v.playsInline = true;
  if (API_BASE) v.crossOrigin = 'anonymous';
  v.src = item.src;
  await once(v, 'loadedmetadata');
  const dur = isFinite(v.duration) && v.duration > 0 ? v.duration : item.duration || 0;
  if (!dur) return null;
  const cols = 3, rows = Math.ceil(n / cols);
  const c = h('canvas', { width: W * cols, height: H * rows }), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  for (let i = 0; i < n; i++) {
    const t = dur * (i + 0.5) / n;
    v.currentTime = t;
    await once(v, 'seeked');
    const ar = v.videoWidth / v.videoHeight || 16 / 9;
    let w = W, hh = W / ar; if (hh > H) { hh = H; w = H * ar; }
    const ox = (i % cols) * W, oy = Math.floor(i / cols) * H;
    x.drawImage(v, ox + (W - w) / 2, oy + (H - hh) / 2, w, hh);
    x.fillStyle = 'rgba(0,0,0,.65)'; x.fillRect(ox + 4, oy + 4, 50, 18);
    x.fillStyle = '#fff'; x.font = '12px monospace'; x.fillText(`${t.toFixed(1)}s`, ox + 8, oy + 17);
  }
  v.removeAttribute('src'); v.load();
  return { sheet: c.toDataURL('image/jpeg', 0.82), n };
}

/**
 * @param media  element to hold the player
 * @param panel  element to hold the annotation panel
 * @param item   clip from /api/species/<id>/media
 * @param ctx    { taxon, inatId, imageId, instanceId, role, contributor, keywords, verdict, model, modelLabel }
 * @returns dispose() - stops model requests when the studio closes
 */
export function openVideoStudio(media, panel, item, ctx) {
  const d = drafts.get(item.id) || { caption: '', captionSource: '', pairs: [], saved: true, ai: { caption: '', keywords: [], model: '' } };
  drafts.set(item.id, d);
  const yt = item.provider === 'youtube';
  const ctl = { full: null, kw: null, alive: true };

  // ---------------------------------------------------------------- player
  let video = null;
  if (yt) {
    media.append(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${item.video_id}?autoplay=1&rel=0`, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, title: item.title }));
  } else {
    video = h('video', { controls: true, autoplay: true, muted: true, playsinline: true, loop: true, poster: item.poster || '' });
    if (API_BASE) video.crossOrigin = 'anonymous';         // API on another origin: keep frames readable
    video.append(h('source', { src: item.src }));          // no type: the proxy may have converted the clip to H.264
    media.append(video);
  }

  // ---------------------------------------------------------------- caption + references (source, model, other visitors)
  const cap = h('textarea', { id: 'vsCaption', rows: 3, maxlength: 4000, placeholder: 'Describe what happens in this clip: the animal, what it is doing, where.' });
  cap.value = d.caption;
  const capRefs = h('div', { class: 'vs-refs' });
  const useRef = (text, source) => { cap.value = text; d.caption = text; d.captionSource = source; dirty(); cap.focus(); };
  if (item.description) capRefs.append(ref('From the source page', item.description, () => useRef(item.description, 'source')));
  const aiText = h('p', { class: 'vs-ref-text' }, d.ai.caption || 'Sampling frames from the clip…');
  const aiHead = h('span', { class: 'fine' }, icon('spark'), ' Model suggestion');
  const aiUse = h('button', { class: 'link', type: 'button', hidden: !d.ai.caption }, 'Use this');
  const aiAgain = h('button', { class: 'link', type: 'button', title: 'Ask the model again' }, 'Regenerate');
  aiUse.onclick = () => useRef(d.ai.caption, `model:${d.ai.model}`);
  capRefs.append(h('div', { class: 'vs-ref ai' }, h('div', { class: 'vs-ref-head' }, aiHead, h('span', { class: 'row gap' }, aiAgain, aiUse)), aiText));
  cap.oninput = () => { d.caption = cap.value; d.captionSource = d.captionSource || 'user'; dirty(); };

  // ---------------------------------------------------------------- keyframes
  const live = h('canvas', { class: 'vs-live', width: 160, height: 90 });
  const lctx = live.getContext('2d');
  const time = h('span', { class: 'vs-time mono' }, yt ? 'YouTube' : '0:00.0');
  const state = h('span', { class: 'vs-state' }, yt ? 'Frames cannot be read from YouTube; keywords are saved without a picture.' : 'Playing. Pause to tag this moment.');
  const kw = h('input', { id: 'vsKeyword', maxlength: 300, placeholder: 'Keyword or phrase for this moment', autocomplete: 'off' });
  const plus = h('button', { class: 'vs-plus', type: 'button', title: 'Add this keyframe and keyword (Enter)', 'aria-label': 'Add keyframe and keyword' }, icon('plus'));
  const sugg = h('div', { class: 'vs-sugg' });
  const suggNote = h('p', { class: 'fine vs-sugg-note' });
  const list = h('ol', { class: 'vs-pairs' });
  const empty = h('p', { class: 'fine vs-empty' }, 'No pairs yet. Pause on a moment, type what you see (e.g. "cracking a shell"), then press + or Enter.');
  const count = h('span', { class: 'badge' }, String(d.pairs.length));

  let frozen = false, lastDraw = 0;
  const draw = () => {
    if (!video || !video.videoWidth) return;
    const ar = video.videoWidth / video.videoHeight, W = live.width, H = live.height;
    let w = W, hh = W / ar; if (hh > H) { hh = H; w = H * ar; }
    lctx.fillStyle = '#000'; lctx.fillRect(0, 0, W, H);
    try { lctx.drawImage(video, (W - w) / 2, (H - hh) / 2, w, hh); } catch { /* not decodable yet */ }
    time.textContent = fmt(video.currentTime);
  };
  const tick = (now) => {
    if (!video?.isConnected) return;
    if (!frozen && now - lastDraw > 180) { draw(); lastDraw = now; }
    requestAnimationFrame(tick);
  };
  if (video) {
    requestAnimationFrame(tick);
    video.addEventListener('pause', () => { frozen = true; draw(); state.textContent = 'Paused. Name this moment, then press +.'; live.classList.add('frozen'); });
    video.addEventListener('play', () => { frozen = false; state.textContent = 'Playing. Pause to tag this moment.'; live.classList.remove('frozen'); });
    video.addEventListener('seeked', () => { if (frozen) draw(); });
    video.addEventListener('loadeddata', draw);
    const freeze = () => { if (!video.paused) video.pause(); };                // typing freezes the keyframe
    kw.addEventListener('focus', freeze); kw.addEventListener('input', freeze);
    live.onclick = () => (video.paused ? video.play() : video.pause());
  }

  const grab = () => {
    if (!video || !video.videoWidth) return null;
    const c = h('canvas', { width: FRAME_W, height: Math.round(FRAME_W * video.videoHeight / video.videoWidth) });
    try { c.getContext('2d').drawImage(video, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); } catch { return null; }
  };
  const add = () => {
    const text = kw.value.trim();
    if (!text) { kw.focus(); kw.classList.remove('shake'); void kw.offsetWidth; kw.classList.add('shake'); return; }
    d.pairs.push({ t: video ? +video.currentTime.toFixed(2) : null, text, frame: grab() });
    d.pairs.sort((a, b) => (a.t ?? 1e9) - (b.t ?? 1e9));
    kw.value = ''; kw.focus();
    renderPairs(); dirty(); tagsChanged();
    const b = plus.getBoundingClientRect(); burst(b.left + 14, b.top + 6, 8);
  };
  plus.onclick = add;
  kw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } e.stopPropagation(); });
  cap.addEventListener('keydown', (e) => e.stopPropagation());

  function renderPairs() {
    list.innerHTML = '';
    empty.hidden = d.pairs.length > 0;
    count.textContent = String(d.pairs.length);
    d.pairs.forEach((p) => {
      const thumb = h('button', { class: 'vs-pthumb', type: 'button', title: 'Jump to this moment' }, p.frame ? h('img', { src: p.frame, alt: '' }) : h('span', {}, icon('image')));
      const at = h('button', { class: 'vs-pt mono', type: 'button', title: 'Jump to this moment' }, fmt(p.t));
      const seek = () => { if (video && p.t != null) { video.pause(); video.currentTime = p.t; } };
      thumb.onclick = seek; at.onclick = seek;
      if (p.frame) hoverCard(thumb, () => infoCard({ img: p.frame, title: p.text, lines: [`at ${fmt(p.t)}`] }));
      const txt = h('input', { value: p.text, maxlength: 300, 'aria-label': `Keyword at ${fmt(p.t)}` });
      txt.oninput = () => { p.text = txt.value; dirty(); };
      txt.onchange = tagsChanged;
      txt.addEventListener('keydown', (e) => e.stopPropagation());
      const del = h('button', { class: 'ib', type: 'button', title: 'Remove this pair', 'aria-label': 'Remove' }, icon('x'));
      del.onclick = () => { d.pairs.splice(d.pairs.indexOf(p), 1); renderPairs(); dirty(); tagsChanged(); };
      list.append(h('li', {}, thumb, at, txt, del));
    });
    renderSugg();
  }

  // ---------------------------------------------------------------- suggestions: model (live), species facts, other visitors
  const facts = (ctx.keywords || []).slice(0, 8);
  let community = [];
  const shown = new Set();                                   // chips already on screen: only new ones animate in
  function renderSugg() {
    const used = new Set(d.pairs.map((p) => norm(p.text)));
    const seen = new Set(), cap = { ai: 10, comm: 8, fact: 6 }, n = { ai: 0, comm: 0, fact: 0 };
    sugg.innerHTML = '';
    const chip = (text, cls, title, frame) => {
      const k = norm(text);
      if (!k || used.has(k) || seen.has(k) || n[cls] >= cap[cls]) return;
      seen.add(k); n[cls]++;
      const b = h('button', { class: `sugg ${cls} ${shown.has(k) ? '' : 'new'}`, type: 'button', title }, cls === 'ai' ? icon('spark') : '', text);
      shown.add(k);
      b.onclick = () => { kw.value = text; kw.focus(); };
      if (frame) hoverCard(b, () => infoCard({ img: frame, title: text, lines: [title] }));
      sugg.append(b);
    };
    d.ai.keywords.forEach((k) => chip(k, 'ai', `Suggested by ${ctx.modelLabel(d.ai.model)}`));
    community.forEach((k) => chip(k.text, 'comm', `${k.n}× by other visitors · at ${fmt(k.t)}`, k.frame));
    facts.forEach((k) => chip(k, 'fact', 'From the species facts'));
  }

  api(`/api/video/annotations?video_id=${encodeURIComponent(item.id)}`).then((res) => {
    if (!res.count) return;
    community = res.keywords.slice(0, 12);
    renderSugg();
    res.captions.slice(0, 2).forEach((c) => capRefs.append(ref('Another visitor wrote', c, () => useRef(c, 'community'))));
  }).catch(() => {});

  // ---------------------------------------------------------------- the model: caption + keywords, then keyword refreshes
  let sheet = null;
  const tags = () => [...d.pairs.map((p) => ({ text: p.text, t: p.t })), ...community.slice(0, 10).map((k) => ({ text: k.text, t: k.t }))];
  async function describe(force = false) {
    if (!ctl.alive) return;
    ctl.full?.abort(); ctl.full = new AbortController();
    aiUse.hidden = true; aiAgain.disabled = true;
    try {
      if (!sheet) { aiText.textContent = 'Sampling frames from the clip…'; sheet = await contactSheet(item); }
      if (!sheet) { aiText.textContent = 'Could not read frames from this clip.'; return; }
      aiText.textContent = `Asking ${ctx.modelLabel(ctx.model)}… (the first answer can take a while if the model has to load)`;
      const body = { video_id: item.id, sheet: sheet.sheet, n: sheet.n, taxon: ctx.taxon, model: ctx.model, mode: 'full' };
      if (force) body.nocache = true;
      const out = await streamText('/api/video/describe', body, (t) => {
        const { model, text } = splitModel(t);
        if (model) aiHead.lastChild.textContent = ` Model suggestion · ${ctx.modelLabel(model)}`;
        const p = parseDescribe(text);
        if (p.caption) aiText.textContent = p.caption;
      }, ctl.full.signal);
      if (!ctl.alive || ctl.full.signal.aborted) return;
      const { model, text } = splitModel(out), p = parseDescribe(text);
      d.ai = { caption: p.caption, keywords: p.keywords, model };
      aiText.textContent = p.caption || 'The model gave no caption.';
      aiUse.hidden = !p.caption;
      renderSugg();
      suggNote.textContent = p.keywords.length ? 'Suggestions with ✦ come from the model and update as you add tags.' : '';
      if (d.pairs.length) tagsChanged();
    } catch (e) { if (ctl.alive) aiText.textContent = `No model suggestion: ${e.message}`; } finally { aiAgain.disabled = false; }
  }
  aiAgain.onclick = () => describe(true);

  let kwTimer = null;
  function tagsChanged() {                                   // the model re-suggests keywords from what people tagged
    clearTimeout(kwTimer);
    kwTimer = setTimeout(async () => {
      if (!ctl.alive) return;
      if (!sheet) sheet = await contactSheet(item).catch(() => null);
      if (!sheet || !ctl.alive) return;
      ctl.kw?.abort(); ctl.kw = new AbortController();
      suggNote.textContent = 'Updating suggestions from your tags…';
      try {
        const out = await streamText('/api/video/describe', { video_id: item.id, sheet: sheet.sheet, n: sheet.n, taxon: ctx.taxon, model: ctx.model,
          mode: 'keywords', tags: tags(), caption: d.caption.trim() }, () => {}, ctl.kw.signal);
        if (!ctl.alive || ctl.kw.signal.aborted) return;
        const { model, text } = splitModel(out), p = parseDescribe(text);
        if (p.keywords.length) {
          const all = [...new Set([...p.keywords, ...d.ai.keywords].map((k) => k))];
          d.ai.keywords = all.slice(0, 16); d.ai.model = model || d.ai.model;
          d.ai.history = [...new Set([...(d.ai.history || []), ...p.keywords])];
        }
        renderSugg();
        suggNote.textContent = 'Suggestions with ✦ come from the model and update as you add tags.';
      } catch (e) { if (ctl.alive) suggNote.textContent = ''; }
    }, 1600);
  }

  // ---------------------------------------------------------------- save
  const status = h('span', { class: 'vs-status fine' }, d.saved ? '' : 'Unsaved changes');
  const save = h('button', { class: 'btn btn-sm btn-glow', type: 'button', disabled: d.saved }, icon('check'), 'Save annotations');
  function dirty() { d.saved = false; save.disabled = false; status.textContent = 'Unsaved changes'; }
  save.onclick = async () => {
    const pairs = d.pairs.filter((p) => p.text.trim());
    if (!pairs.length && !d.caption.trim()) { toast('Add a caption or at least one keyword first', '', 2500); return; }
    save.disabled = true; status.textContent = 'Saving…';
    try {
      const res = await api('/api/video/annotations', { body: {
        video_id: item.id, provider: item.provider, page: item.page, inat_id: ctx.inatId, taxon: ctx.taxon,
        caption: d.caption.trim(), caption_source: d.captionSource, pairs, image_id: ctx.imageId, instance_id: ctx.instanceId,
        role: ctx.role, contributor: ctx.contributor,
        model: d.ai.model, model_caption: d.ai.caption, model_keywords: [...new Set([...(d.ai.history || []), ...d.ai.keywords])] } });
      d.saved = true;
      status.textContent = `Saved · ${res.pairs} keyframe${res.pairs === 1 ? '' : 's'}`;
      toast('Clip annotations saved. Thank you!', 'ok');
      const b = save.getBoundingClientRect(); burst(b.left + 40, b.top, 12);
    } catch (e) { save.disabled = false; status.textContent = 'Not saved'; toast(e.message, 'err'); }
  };

  panel.append(
    h('div', { class: 'vs-head' },
      h('div', { class: 'lb-title' }, item.title || ctx.taxon),
      h('div', { class: 'fine' }, [item.attribution, item.license, item.duration ? `${Math.round(item.duration)} s` : ''].filter(Boolean).join(' · '),
        item.page ? [' · ', h('a', { href: item.page, target: '_blank', rel: 'noopener' }, 'source ↗')] : '')),
    h('div', { class: 'vs-block' },
      h('label', { class: 'vs-label', for: 'vsCaption' }, 'Caption'), cap, capRefs),
    h('div', { class: 'vs-block' },
      h('div', { class: 'vs-label' }, 'Keyframes & keywords ', count),
      h('div', { class: 'vs-now' }, live, h('div', { class: 'vs-now-txt' }, time, state)),
      h('div', { class: 'vs-add' }, kw, plus),
      sugg, suggNote, list, empty),
    h('div', { class: 'vs-foot' }, ctx.verdict || '', h('div', { class: 'vs-save' }, status, save)));
  renderPairs();
  if (d.ai.caption) { aiUse.hidden = false; aiHead.lastChild.textContent = ` Model suggestion · ${ctx.modelLabel(d.ai.model)}`; }
  else describe();

  return () => { ctl.alive = false; ctl.full?.abort(); ctl.kw?.abort(); clearTimeout(kwTimer); };
}

function ref(label, text, onUse) {
  const p = h('p', { class: 'vs-ref-text' }, text);
  return h('div', { class: 'vs-ref' }, h('div', { class: 'vs-ref-head' }, h('span', { class: 'fine' }, label),
    h('button', { class: 'link', type: 'button', onclick: onUse }, 'Use this')), p);
}
