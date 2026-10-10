// Annotate area: hub, short-clip feed (TikTok style), long-video projects, image sets, leaderboards.
//   #/annotate                 hub        #/annotate/short[?taxon=id]  clip feed
//   #/annotate/long[/<id>]     projects   #/annotate/images[/<set>]    image sets
//   #/annotate/leaders         boards
import { $, h, icon, api, apiUrl, toast, burst, streamText, store, API_BASE } from './util.js';
import { feedbackBar } from './feedback.js';
import { profileChip, contributorPayload } from './profile.js';
import { renderProjects, renderProject, stopProjectTimers } from './projects.js';
import { leaderBoard, allBoards } from './boards.js';
import { contactSheet, parseDescribe, splitModel } from './videostudio.js';
import { showMedia } from './species.js';

const SUB = [['', 'Overview', 'spark'], ['short', 'Short clips', 'play'], ['long', 'Long videos', 'layers'], ['images', 'Images', 'image'], ['leaders', 'Leaderboards', 'people']];
const fmtT = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
let cleanup = [];

export function leaveAnnotate() { cleanup.forEach((f) => f()); cleanup = []; stopProjectTimers(); }

export function renderAnnotate(root, path, params) {
  leaveAnnotate();
  const [, , sub = '', arg = ''] = path.split('/');
  const nav = h('nav', { class: 'an-nav', 'aria-label': 'Annotate sections' }, SUB.map(([k, l, ico]) =>
    h('a', { href: `#/annotate${k ? '/' + k : ''}`, class: k === sub ? 'on' : '' }, icon(ico), l)));
  const body = h('div', { class: `an-body an-${sub || 'hub'}` });
  root.replaceChildren(h('div', { class: 'an-top' }, nav, profileChip()), body);
  if (!sub) hub(body);
  else if (sub === 'short') shortFeed(body, params);
  else if (sub === 'long') (arg ? renderProject(body, arg) : renderProjects(body));
  else if (sub === 'images') (arg ? imageSet(body, decodeURIComponent(arg), params) : imageSets(body));
  else if (sub === 'leaders') body.append(h('h1', { class: 'an-h1' }, 'Leaderboards'), allBoards({ limit: 50 }));
}

// ====================================================================== hub
function hub(body) {
  const card = (href, ico, title, text, cta) => h('a', { class: 'an-card glass', href }, h('span', { class: 'an-card-ico' }, icon(ico)), h('b', {}, title), h('p', {}, text), h('span', { class: 'an-cta' }, cta, ' →'));
  body.append(
    h('header', { class: 'an-hero' }, h('p', { class: 'eyebrow' }, 'Annotate with the community'), h('h1', { class: 'an-h1' }, 'Help label the ocean'),
      h('p', { class: 'lead' }, 'Every tag, caption and check here becomes training and evaluation data for marine AI, and is credited to your nickname on the boards.')),
    h('div', { class: 'an-cards' },
      card('#/annotate/short', 'play', 'Short clips', 'Swipe through short underwater clips. Say what you see, tag moments, confirm the species. Quick and fun.', 'Start swiping'),
      card('#/annotate/long', 'layers', 'Long videos', 'Minute- to hour-long dives, divided into event segments. Claim a segment, annotate it, review others. Built for experts working together.', 'Open projects'),
      card('#/annotate/images', 'image', 'Images', 'Photo sets per species and from the community. Check that each photo shows the right species, or outline its creatures with MarineInst.', 'Browse sets')),
    h('h2', { class: 'an-h2' }, 'Top contributors'), allBoards({ limit: 5 }));
}

// ====================================================================== short-clip feed
function shortFeed(body, params) {
  const taxon = params.get('taxon');
  const seed = store.get('feedSeed', Math.floor(Math.random() * 1e6));
  store.set('feedSeed', seed);
  const feed = h('div', { class: 'tt-feed', tabindex: '0', 'aria-label': 'Clip feed' });
  const panel = h('aside', { class: 'tt-panel glass' });
  const stats = { clips: store.get('ttClips', 0), streak: 0 };
  const statEl = h('div', { class: 'tt-stats' });
  const drawStats = () => statEl.replaceChildren(h('div', {}, h('b', { class: 'mono' }, stats.clips), h('small', {}, 'clips tagged')), h('div', {}, h('b', { class: 'mono' }, stats.streak), h('small', {}, 'in a row')));
  drawStats();
  const left = h('aside', { class: 'tt-left' }, h('h1', { class: 'an-h1 small' }, taxon ? 'Clips of one species' : 'Short clips'),
    h('p', { class: 'fine' }, 'Scroll or press ↓ for the next clip. Pause, type what you see, press Enter to tag that moment. ✦ chips are the model\'s suggestions.'),
    statEl, leaderBoard('short', { title: 'Short-clip board', limit: 5, compact: true }));
  body.append(left, h('div', { class: 'tt-stage' }, feed), panel);

  let items = [], offset = 0, loading = false, done = false, current = null;
  const cards = new Map();
  const io = new IntersectionObserver((es) => es.forEach((e) => {
    const v = e.target.querySelector('video');
    if (e.isIntersecting && e.intersectionRatio > 0.6) { v.play().catch(() => {}); setCurrent(e.target.item, e.target); }
    else v.pause();
  }), { root: feed, threshold: [0, 0.6, 1] });
  cleanup.push(() => io.disconnect());

  async function more() {
    if (loading || done) return;
    loading = true;
    try {
      const d = await api(`/api/feed/short?offset=${offset}&limit=6&seed=${seed}${taxon ? '&inat_id=' + taxon : ''}`);
      if (!d.items.length) {
        done = !d.building;
        if (d.building && !items.length) { feed.replaceChildren(h('div', { class: 'tt-empty' }, h('p', {}, 'Collecting clips from the public sources…'), h('p', { class: 'fine' }, 'This takes a minute the first time.'))); setTimeout(() => { loading = false; more(); }, 6000); return; }
        if (!items.length) feed.replaceChildren(h('div', { class: 'tt-empty' }, h('p', {}, 'No clips found.')));
      }
      if (!items.length) feed.innerHTML = '';
      d.items.forEach((it) => { items.push(it); const c = clipCard(it); feed.append(c); io.observe(c); });
      offset += d.items.length;
    } catch (e) { toast(e.message, 'err'); }
    loading = false;
  }
  feed.addEventListener('scroll', () => { if (feed.scrollTop + feed.clientHeight * 2.5 > feed.scrollHeight) more(); }, { passive: true });
  const keys = (e) => {
    if (e.target.closest('input, textarea')) return;
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); go(-1); }
    if (e.key === ' ') { e.preventDefault(); const v = cards.get(current?.id)?.querySelector('video'); if (v) v.paused ? v.play() : v.pause(); }
  };
  addEventListener('keydown', keys);
  cleanup.push(() => removeEventListener('keydown', keys));
  const go = (d) => { const el = cards.get(current?.id); const next = d > 0 ? el?.nextElementSibling : el?.previousElementSibling; next?.scrollIntoView({ behavior: 'smooth' }); };

  function clipCard(it) {
    const v = h('video', { muted: true, loop: true, playsinline: true, preload: 'metadata', poster: it.poster || '' });
    if (API_BASE) v.crossOrigin = 'anonymous';
    v.src = it.src;
    v.onclick = () => (v.paused ? v.play() : v.pause());
    const ring = h('i', { class: 'tt-time' });
    v.addEventListener('timeupdate', () => ring.style.setProperty('--p', `${(100 * v.currentTime / (v.duration || 1)).toFixed(1)}%`));
    const sound = h('button', { class: 'tt-btn', type: 'button', title: 'Sound on / off' }, icon('wave'));
    sound.onclick = () => { v.muted = !v.muted; sound.classList.toggle('on', !v.muted); };
    const studio = h('button', { class: 'tt-btn', type: 'button', title: 'Open in the full video studio' }, icon('expand'));
    studio.onclick = () => { v.pause(); showMedia(it, it.taxon || 'marine life', it.inat_id ? { inat_id: it.inat_id } : null); };
    const tagBtn = h('button', { class: 'tt-btn', type: 'button', title: 'Tag this clip' }, icon('edit'));
    tagBtn.onclick = () => { document.body.classList.add('tt-sheet'); $('#ttCaption')?.focus(); };
    const card = h('section', { class: 'tt-card' },
      h('div', { class: 'tt-bg', style: it.poster ? `background-image:url("${it.poster}")` : '' }), v, ring,
      h('div', { class: 'tt-info' },
        h('span', { class: 'pill' }, it.source || 'clip'), it.n_annotations ? h('span', { class: 'pill ok' }, `${it.n_annotations} tagged`) : h('span', { class: 'pill warn' }, 'not tagged yet'),
        h('b', {}, it.title), it.taxon ? h('a', { class: 'tt-sp', href: `#/media?taxon=${it.inat_id}&tab=short` }, h('i', {}, it.taxon), it.common ? ` · ${it.common}` : '') : '',
        h('small', {}, [it.license, it.attribution].filter(Boolean).join(' · '))),
      h('div', { class: 'tt-rail' }, sound, tagBtn, studio));
    card.item = it;
    cards.set(it.id, card);
    return card;
  }

  // ---------------------------------------------------------------- annotation panel for the clip on screen
  let ctl = null;
  function setCurrent(it, card) {
    if (current?.id === it.id) return;
    current = it;
    ctl?.abort(); ctl = new AbortController();
    const v = card.querySelector('video');
    const pairs = [];
    let ai = { caption: '', keywords: [], model: '' };
    const cap = h('textarea', { id: 'ttCaption', rows: 6, maxlength: 2000, placeholder: 'What happens in this clip? The animal, what it does, where, anything unusual…' });
    const aiBox = h('div', { class: 'vs-ref ai' }, h('p', { class: 'vs-ref-text' }, 'Reading the clip…'));
    const kw = h('input', { id: 'ttKeyword', maxlength: 80, placeholder: 'Pause on a moment, type what you see, press Enter' });
    const chips = h('div', { class: 'vs-sugg' });
    const tags = h('div', { class: 'tt-tags' });
    const drawTags = () => tags.replaceChildren(...pairs.map((p, i) => h('button', { class: 'sugg on', type: 'button', title: 'Remove', onclick: () => { pairs.splice(i, 1); drawTags(); } }, h('span', { class: 'mono' }, fmtT(p.t)), ` ${p.text} ×`)));
    const grab = () => { try { const c = h('canvas', { width: 192, height: Math.round(192 * v.videoHeight / (v.videoWidth || 1)) }); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.8); } catch { return null; } };
    const addTag = (text) => { if (!text.trim()) return; pairs.push({ t: +v.currentTime.toFixed(2), text: text.trim(), frame: grab() }); drawTags(); drawChips(); };
    kw.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(kw.value); kw.value = ''; } e.stopPropagation(); });
    kw.addEventListener('input', () => v.pause());
    cap.addEventListener('keydown', (e) => e.stopPropagation());
    const drawChips = () => {
      const used = new Set(pairs.map((p) => p.text.toLowerCase()));
      chips.replaceChildren(...ai.keywords.filter((k) => !used.has(k.toLowerCase())).slice(0, 10).map((k) => h('button', { class: 'sugg ai', type: 'button', title: 'Tag this moment with it', onclick: () => addTag(k) }, icon('spark'), k)));
    };
    const verdict = it.taxon ? feedbackBar({ key: `k:${it.id}:${it.taxon}`, compact: true, question: `Shows ${it.common || it.taxon}?`,
      payload: () => ({ target: 'knowledge', species: it.taxon, taxon: it.taxon, item: { kind: 'video', id: it.id, title: it.title, page: it.page || '', src: it.src, source: it.source || '' }, role: 'clip feed', contributor: contributorPayload() }) }) : '';
    const save = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, icon('check'), 'Save & next');
    save.onclick = async () => {
      if (kw.value.trim()) { addTag(kw.value); kw.value = ''; }
      if (!cap.value.trim() && !pairs.length) { toast('Write a caption or tag a moment first', '', 2200); return cap.focus(); }
      save.disabled = true;
      try {
        await api('/api/video/annotations', { body: { video_id: it.id, provider: it.provider, page: it.page, inat_id: it.inat_id, taxon: it.taxon || '', caption: cap.value.trim(),
          caption_source: cap.value.trim() === ai.caption ? `model:${ai.model}` : 'user', pairs, model: ai.model, model_caption: ai.caption, model_keywords: ai.keywords, role: 'clip feed', contributor: contributorPayload() } });
        stats.clips++; stats.streak++; store.set('ttClips', stats.clips); drawStats();
        const b = save.getBoundingClientRect(); burst(b.left + 50, b.top, stats.streak % 5 === 0 ? 40 : 12);
        toast(`+${3 + pairs.length} points${stats.streak % 5 === 0 ? ` · ${stats.streak} in a row!` : ''}`, 'ok', 1800);
        it.n_annotations = (it.n_annotations || 0) + 1;
        document.body.classList.remove('tt-sheet');
        go(1);
      } catch (e) { save.disabled = false; toast(e.message, 'err'); }
    };
    const skip = h('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { stats.streak = 0; drawStats(); go(1); } }, 'Skip');
    panel.replaceChildren(
      h('button', { class: 'tt-close ib', type: 'button', 'aria-label': 'Close', onclick: () => document.body.classList.remove('tt-sheet') }, icon('x')),
      h('div', { class: 'lb-title' }, it.title), it.taxon ? h('p', { class: 'fine' }, h('i', {}, it.taxon), it.common ? ` · ${it.common}` : '') : h('p', { class: 'fine' }, 'Species unknown: name it in a tag if you can.'),
      verdict, h('label', { class: 'vs-label', for: 'ttCaption' }, 'Caption'), cap, aiBox,
      h('div', { class: 'vs-label' }, 'Moments'), kw, chips, tags, h('div', { class: 'row gap tt-act' }, skip, save));
    // the model reads a contact sheet of the clip and proposes a caption and tags
    (async () => {
      try {
        const sheet = await contactSheet(it);
        if (!sheet || ctl.signal.aborted) { aiBox.replaceChildren(h('p', { class: 'fine' }, 'No model suggestion for this clip.')); return; }
        const out = await streamText('/api/video/describe', { video_id: it.id, sheet: sheet.sheet, n: sheet.n, taxon: it.taxon || 'marine life (identify what you can)', model: window.MC_MODEL?.(), mode: 'full' },
          (t) => { const r = parseDescribe(splitModel(t).text); if (r.caption) aiBox.firstChild.textContent = r.caption; }, ctl.signal);
        if (ctl.signal.aborted) return;
        const m = splitModel(out), r = parseDescribe(m.text);
        ai = { caption: r.caption, keywords: r.keywords, model: m.model };
        aiBox.replaceChildren(h('div', { class: 'vs-ref-head' }, h('span', { class: 'fine' }, icon('spark'), ' Model suggestion'), h('button', { class: 'link', type: 'button', onclick: () => { cap.value = ai.caption; } }, 'Use this')),
          h('p', { class: 'vs-ref-text' }, r.caption || '–'));
        drawChips();
      } catch (e) { if (!ctl.signal.aborted) aiBox.replaceChildren(h('p', { class: 'fine' }, `No model suggestion: ${e.message}`)); }
    })();
  }
  cleanup.push(() => { ctl?.abort(); document.body.classList.remove('tt-sheet'); });
  more();
}

// ====================================================================== image sets
async function imageSets(body) {
  const grid = h('div', { class: 'is-grid' }, h('div', { class: 'shimmer-line' }));
  const chips = h('div', { class: 'fv-filters' });
  const q = h('input', { id: 'isSearch', placeholder: 'Find a set', autocomplete: 'off' });
  body.append(h('header', { class: 'an-head' }, h('h1', { class: 'an-h1' }, 'Image sets'),
    h('p', { class: 'muted' }, 'Pick a set, then check each photo: does it show the right species? Open any photo in Explore to outline its creatures with MarineInst.')),
  h('div', { class: 'pj-toolbar' }, q, chips), grid);
  let sets = [], kind = '';
  const draw = () => {
    const f = q.value.trim().toLowerCase();
    grid.replaceChildren(...sets.filter((s) => (!kind || s.kind === kind) && (!f || `${s.title} ${s.taxon}`.toLowerCase().includes(f))).map((s) =>
      h('a', { class: 'is-card glass', href: `#/annotate/images/${encodeURIComponent(s.id)}` },
        h('div', { class: 'is-cover' }, s.covers.map((c) => h('img', { src: c, alt: '', loading: 'lazy' }))),
        h('div', { class: 'is-meta' }, h('b', {}, s.title), s.taxon ? h('i', { class: 'muted' }, s.taxon) : '',
          h('div', { class: 'pj-bar' }, h('i', { class: 'rv', style: `width:${s.count ? (100 * s.checked / s.count).toFixed(1) : 0}%` })),
          h('small', { class: 'fine' }, `${s.checked} of ${s.count} checked · ${s.sources.join(', ')}`)))));
  };
  const load = async () => {
    const d = await api('/api/imagesets');
    sets = d.sets;
    const kinds = [['', 'All'], ['species', 'Species sets'], ['community', 'Community'], ['demo', 'Demo']].filter(([k]) => !k || sets.some((s) => s.kind === k));
    chips.replaceChildren(...kinds.map(([k, l]) => h('button', { class: `sugg ${k === kind ? 'on' : ''}`, type: 'button', onclick: () => { kind = k; load(); } }, l)));
    draw();
    if (d.building) setTimeout(() => { if (grid.isConnected) load(); }, 8000);
  };
  q.oninput = draw;
  try { await load(); } catch (e) { grid.replaceChildren(h('p', { class: 'err' }, e.message)); }
}

async function imageSet(body, id, params) {
  let d;
  try { d = await api(`/api/imagesets/${encodeURIComponent(id)}`); } catch (e) { body.append(h('p', { class: 'err' }, e.message)); return; }
  const question = d.taxon ? `Does this photo show ${d.title}?` : 'Is this a clear, usable underwater photo?';
  let mode = params.get('mode') || 'grid', idx = 0;
  const checked = () => d.items.filter((p) => Object.keys(p.votes || {}).length).length;
  const prog = h('div', { class: 'pj-bar big' }, h('i', { class: 'rv' }));
  const progTxt = h('span', { class: 'fine' });
  const drawProg = () => { prog.firstChild.style.width = `${(100 * checked() / (d.items.length || 1)).toFixed(1)}%`; progTxt.textContent = `${checked()} of ${d.items.length} checked`; };
  const view = h('div', { class: 'is-view' });
  const modes = h('div', { class: 'about-tabs' });
  const vote = (p, v) => {
    api('/api/feedback', { body: { target: 'knowledge', verdict: v, species: d.taxon || d.title, taxon: d.taxon || d.title, role: 'image set',
      item: { kind: 'photo', id: p.id, title: p.title || '', page: p.page || '', thumb: p.thumb, source: p.source || '' }, contributor: contributorPayload() } }).catch((e) => toast(e.message, 'err'));
    p.votes = { ...(p.votes || {}), [v]: ((p.votes || {})[v] || 0) + 1 };
    p.mine = v;
    drawProg();
  };
  const annotateIn = async (p) => {
    try {
      const info = await api('/api/images/from-url', { body: { src: p.demo ? `demo/${p.demo}` : p.full || p.thumb } });
      sessionStorage.setItem('mc.pendingImage', JSON.stringify(info));
      location.hash = '#/explore';
    } catch (e) { toast(e.message, 'err'); }
  };
  const tally = (p) => h('span', { class: 'is-tally mono' }, `✓${(p.votes || {}).correct || 0} ✗${(p.votes || {}).wrong || 0}`);
  const drawGrid = () => view.replaceChildren(h('div', { class: 'fv-grid photo' }, d.items.map((p) => {
    const tile = h('div', { class: `ph big is-tile ${p.mine ? 'v-' + p.mine : ''}` },
      h('img', { src: p.thumb, alt: '', loading: 'lazy', onclick: () => showMedia(p, d.taxon || d.title) }),
      h('div', { class: 'ph-cap' }, h('b', {}, (p.source || '').split(' · ')[0]), ` ${[p.attribution, p.license].filter(Boolean).join(' · ')}`),
      h('div', { class: 'is-acts' }, tally(p),
        h('button', { class: 'ib', type: 'button', title: 'Yes', onclick: () => { vote(p, 'correct'); tile.className = 'ph big is-tile v-correct'; tile.querySelector('.is-tally').replaceWith(tally(p)); } }, icon('check')),
        h('button', { class: 'ib', type: 'button', title: 'No', onclick: () => { vote(p, 'wrong'); tile.className = 'ph big is-tile v-wrong'; tile.querySelector('.is-tally').replaceWith(tally(p)); } }, icon('x')),
        h('button', { class: 'ib', type: 'button', title: 'Outline its creatures in Explore', onclick: () => annotateIn(p) }, icon('scan'))));
    return tile;
  })));
  const drawSwipe = () => {
    const p = d.items[idx];
    if (!p) { view.replaceChildren(h('div', { class: 'tt-empty' }, h('p', {}, 'All photos in this set are done. Thank you!'), h('a', { class: 'btn btn-sm btn-glow', href: '#/annotate/images' }, 'Pick another set'))); return; }
    const next = (v) => { if (v) vote(p, v); idx++; drawSwipe(); };
    view.replaceChildren(h('div', { class: 'is-swipe' },
      h('div', { class: 'is-photo glass' }, h('img', { src: p.full || p.thumb, alt: '' }), h('div', { class: 'ph-cap show' }, h('b', {}, (p.source || '').split(' · ')[0]), ` ${[p.attribution, p.license, p.place].filter(Boolean).join(' · ')}`)),
      h('p', { class: 'is-q' }, question, h('span', { class: 'fine' }, ` ${idx + 1} / ${d.items.length} · `, tally(p))),
      h('div', { class: 'is-btns' },
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => next('wrong') }, icon('x'), 'No  ←'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => next(null) }, 'Skip  ↓'),
        h('button', { class: 'btn btn-glow', type: 'button', onclick: () => next('correct') }, icon('check'), 'Yes  →'),
        h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => annotateIn(p) }, icon('scan'), 'Outline creatures'))));
  };
  const keys = (e) => {
    if (mode !== 'swipe' || e.target.closest('input, textarea')) return;
    const b = [...view.querySelectorAll('.is-btns button')];
    if (e.key === 'ArrowLeft') b[0]?.click();
    if (e.key === 'ArrowDown') { e.preventDefault(); b[1]?.click(); }
    if (e.key === 'ArrowRight') b[2]?.click();
  };
  addEventListener('keydown', keys);
  cleanup.push(() => removeEventListener('keydown', keys));
  const draw = () => {
    modes.replaceChildren(...[['grid', 'Grid'], ['swipe', 'One by one']].map(([m, l]) => h('button', { class: `about-tab ${m === mode ? 'on' : ''}`, type: 'button', onclick: () => { mode = m; draw(); } }, l)));
    if (mode === 'grid') drawGrid(); else { idx = Math.max(0, d.items.findIndex((p) => !p.mine)); drawSwipe(); }
  };
  body.append(h('a', { class: 'link mp-back', href: '#/annotate/images' }, '← All image sets'),
    h('header', { class: 'an-head row-head' }, h('div', {}, h('h1', { class: 'an-h1' }, d.title), d.taxon ? h('p', { class: 'muted' }, h('i', {}, d.taxon), ' · ', h('a', { href: `#/media?taxon=${d.inat_id}` }, 'species media page')) : '',
      h('p', { class: 'fine' }, question)), h('div', { class: 'is-prog' }, prog, progTxt)), modes, view);
  drawProg(); draw();
}
