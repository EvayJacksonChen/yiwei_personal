// Species explorer: links an instance to public biodiversity knowledge + our own community data,
// with a ✓ / ✗ / comment feedback widget on every tag, clip, photo and similar species.
import { $, h, icon, api, toast, burst, store } from './util.js';
import { feedbackBar } from './feedback.js';

const CAT = {
  environment: ['Environment', 'drop'], habitat: ['Habitat', 'reef'], depth: ['Depth', 'depth'],
  behaviour: ['Behaviour', 'spark'], diet: ['Diet', 'fork'], size: ['Size', 'ruler'],
  reproduction: ['Reproduction', 'egg'], conservation: ['Conservation', 'shield'],
};
const SP = { ctx: null, stack: [], seq: 0, votes: new Map(), env: null };

/** env = { image: () => S.image, instName(r), instNo(r), mode: () => S.mode, contributor(), onSpeciesPicked(r, name) } */
export function initSpecies(env) {
  SP.env = env;
  $('#spSearch').addEventListener('input', debounce(onSearch, 250));
  $('#spSearch').addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSuggest(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.sp-searchbox')) hideSuggest(); });
  $('#spBack').onclick = () => { SP.stack.pop(); const t = SP.stack.pop(); if (t) openTaxon(t.inat_id, t.reason); else renderEmpty(); };
  $('#spWide').onclick = () => { $('.workspace').classList.toggle('wide'); store.set('spWide', $('.workspace').classList.contains('wide')); };
  if (store.get('spWide', false)) $('.workspace').classList.add('wide');
  initLightbox();
  renderEmpty();
}

/** Open the explorer for an instance: caption name -> taxon; otherwise BioCLIP's top visual match. */
export async function openForInstance(r, caps) {
  const env = SP.env, img = env.image();
  if (!img || !r) return renderEmpty();
  SP.ctx = { inst: r, image_id: img.image_id, visual: null };
  SP.stack = [];
  const body = $('#spBody');
  body.innerHTML = '';
  body.append(skeleton('Finding this creature in public databases…'));
  const best = (caps || []).find((c) => !c.error && c.text);
  const rv = env.review(r.id) || {};
  let name = rv.species || '', reason = rv.species ? 'your correction' : '';
  if (!name && best) {
    const p = best.parsed;
    name = p ? [p.sci && p.sci.toLowerCase() !== 'uncertain' ? p.sci : '', p.label].filter(Boolean).join(' | ') : best.text.slice(0, 200);
    reason = `caption by ${env.modelLabel(best.model)}`;
  }
  const visualP = api('/api/species/identify', { body: { image_id: img.image_id, instance_id: r.id } })
    .then((d) => (SP.ctx.visual = d)).catch(() => null);
  let taxon = null;
  if (name) taxon = (await api('/api/species/resolve', { body: { name } }).catch(() => ({}))).taxon;
  if (!taxon) {
    const v = await visualP;
    const top = v?.items?.find((x) => x.card);
    if (top) { taxon = top.card; reason = `visual match (BioCLIP-2, ${(top.prob * 100).toFixed(0)}%)`; }
  }
  if (SP.ctx?.inst !== r) return;
  if (!taxon) {
    body.innerHTML = '';
    body.append(h('div', { class: 'sp-empty' }, h('p', {}, 'Could not match this instance to a species automatically.'),
      h('p', { class: 'muted' }, 'Search for it above. Your choice is saved as a correction.')));
    return;
  }
  openTaxon(taxon.inat_id, reason);
}

// ------------------------------------------------------------------ rendering one taxon
async function openTaxon(inatId, reason = '') {
  const seq = ++SP.seq;
  SP.stack.push({ inat_id: inatId, reason });
  $('#spBack').hidden = SP.stack.length < 2;
  const body = $('#spBody');
  body.innerHTML = '';
  body.scrollTop = 0;
  body.append(skeleton('Loading species profile…'));
  let prof;
  try { prof = await api(`/api/species/${inatId}`); } catch (e) {
    if (seq === SP.seq) { body.innerHTML = ''; body.append(h('div', { class: 'sp-empty err' }, e.message)); }
    return;
  }
  if (seq !== SP.seq) return;
  body.innerHTML = '';
  const isMain = SP.stack.length === 1;
  body.append(header(prof, reason, isMain));
  const secs = {
    about: section('about', 'About', 'book'), facts: section('facts', 'Habits & habitats', 'reef'),
    videos: section('videos', 'Short clips & videos', 'play'), photos: section('photos', 'Photos', 'image'),
    similar: section('similar', 'Similar & close species', 'tree'), community: section('community', 'From the MarineChat community', 'people'),
  };
  Object.values(secs).forEach((s) => body.append(s.el));
  if (prof.summary) {
    const p = h('p', { class: 'sp-summary clamp' }, prof.summary);
    const more = h('button', { class: 'link' }, 'more');
    more.onclick = () => { p.classList.toggle('clamp'); more.textContent = p.classList.contains('clamp') ? 'more' : 'less'; };
    secs.about.fill(p, more, h('div', { class: 'sp-src' }, 'Source: ', h('a', { href: prof.wikipedia_url, target: '_blank', rel: 'noopener' }, 'Wikipedia'), ' · iNaturalist'));
  } else secs.about.fill(h('p', { class: 'muted' }, 'No summary available.'));

  const T = prof.name;
  api(`/api/species/${inatId}/facts`).then((d) => seq === SP.seq && secs.facts.fill(factsView(d, T))).catch((e) => secs.facts.fill(errLine(e)));
  api(`/api/species/${inatId}/media`).then((d) => {
    if (seq !== SP.seq) return;
    secs.videos.fill(videosView(d, T), d.videos.length);
    secs.photos.fill(photosView(d.photos, T), d.photos.length);
  }).catch((e) => { secs.videos.fill(errLine(e)); secs.photos.fill(errLine(e)); });
  api(`/api/species/${inatId}/similar`).then((d) => seq === SP.seq && secs.similar.fill(similarView(d, T, isMain))).catch((e) => secs.similar.fill(errLine(e)));
  const names = [prof.name, prof.common].filter(Boolean).join('|');
  api(`/api/species/community?names=${encodeURIComponent(names)}`).then((d) => seq === SP.seq && secs.community.fill(communityView(d.items), d.items.length))
    .catch((e) => secs.community.fill(errLine(e)));
}

function header(p, reason, isMain) {
  const env = SP.env, r = SP.ctx?.inst;
  const crumbs = h('div', { class: 'sp-crumbs' }, (p.ancestors || []).map((a, i) =>
    [i ? h('span', { class: 'sep' }, '›') : '', h('button', { class: 'link', title: a.common || a.rank, onclick: () => openTaxon(a.inat_id, `${a.rank} of ${p.name}`) }, a.name)]));
  const pills = h('div', { class: 'sp-pills' },
    h('span', { class: 'pill' }, p.rank),
    p.worms?.marine ? h('span', { class: 'pill ok' }, 'marine (WoRMS)') : '',
    p.worms && p.worms.status !== 'accepted' ? h('span', { class: 'pill warn' }, `WoRMS: ${p.worms.status} → ${p.worms.valid_name}`) : '',
    p.conservation?.status ? h('span', { class: 'pill warn' }, `${p.conservation.status}${p.conservation.authority ? ' · ' + p.conservation.authority : ''}`) : '',
    h('span', { class: 'pill' }, `${(p.observations || 0).toLocaleString()} iNat records`));
  const links = h('div', { class: 'sp-links' }, Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) =>
    h('a', { href: u, target: '_blank', rel: 'noopener', class: 'btn btn-ghost btn-xs' }, k === 'worms' ? 'WoRMS' : k === 'gbif' ? 'GBIF' : k[0].toUpperCase() + k.slice(1), ' ↗')));
  const card = h('div', { class: 'sp-head' },
    p.photo ? h('img', { class: 'sp-hero', src: p.photo, alt: p.name, title: p.photo_attr || '', onclick: () => lightbox({ kind: 'photo', thumb: p.photo, full: p.photo.replace('medium', 'large'), attribution: p.photo_attr, page: p.links?.inaturalist }, p.name) }) : '',
    h('div', { class: 'sp-titles' },
      h('div', { class: 'sp-common' }, p.common || p.name),
      h('div', { class: 'sp-sci' }, h('i', {}, p.name), p.worms?.authority ? h('span', { class: 'muted' }, ` ${p.worms.authority}`) : ''),
      crumbs, pills, links));
  const out = h('div', {}, card);
  if (isMain && r) {
    const bar = h('div', { class: 'sp-confirm' },
      h('span', {}, `Is #${env.instNo(r)} a `, h('b', {}, p.common || p.name), '?', reason ? h('span', { class: 'muted' }, ` (from ${reason})`) : ''));
    bar.append(fb({ kind: 'identification', id: `inst:${r.id}:${p.inat_id}`, name: p.name, label: p.common, source: reason }, p.name, {
      onVerdict: (v) => { if (v === 'correct') env.onSpeciesPicked(r, p.name, true); else { $('#spSearch').focus(); toast('Pick the right species with the search box above', '', 3500); } },
    }));
    out.append(bar);
  } else if (r) {
    const use = h('button', { class: 'btn btn-sm btn-glow' }, icon('check'), `#${env.instNo(r)} is this species`);
    use.onclick = (e) => { env.onSpeciesPicked(r, p.name, false); sendFb({ kind: 'identification', id: `inst:${r.id}:${p.inat_id}`, name: p.name, source: 'user picked from explorer' }, p.name, 'corrected'); const b = e.currentTarget.getBoundingClientRect(); burst(b.left + 60, b.top); };
    out.append(h('div', { class: 'sp-confirm' }, h('span', { class: 'muted' }, 'Browsing a related taxon.'), use));
  }
  return out;
}

function section(key, title, ico) {
  const cnt = h('span', { class: 'badge' }, '…');
  const content = h('div', { class: 'sp-sec-body' }, h('div', { class: 'shimmer-line' }), h('div', { class: 'shimmer-line short' }));
  const head = h('button', { class: 'sp-sec-head' }, icon(ico), h('span', {}, title), cnt, icon('chev'));
  const el = h('section', { class: `sp-sec ${store.get('spFold:' + key, false) ? 'folded' : ''}`, 'data-sec': key }, head, content);
  head.onclick = () => { el.classList.toggle('folded'); store.set('spFold:' + key, el.classList.contains('folded')); };
  return { el, fill: (...kids) => {
    const n = typeof kids[kids.length - 1] === 'number' ? kids.pop() : null;
    content.innerHTML = ''; content.append(...kids.flat().filter(Boolean));
    cnt.textContent = n == null ? '' : n; cnt.hidden = n == null;
  } };
}

// ------------------------------------------------------------------ sections
function factsView(d, taxon) {
  if (!d.tags.length) return h('p', { class: 'muted' }, 'No habit / habitat facts found in the public sources.');
  const groups = {};
  d.tags.forEach((t) => (groups[t.category] = groups[t.category] || []).push(t));
  const wrap = h('div', { class: 'facts' });
  for (const [cat, tags] of Object.entries(groups)) {
    const [label, ico] = CAT[cat] || [cat, 'spark'];
    const detail = h('div', { class: 'fact-detail', hidden: true });
    const chips = h('div', { class: 'fact-chips' }, tags.map((t) => {
      const c = h('button', { class: `fact-chip v-${SP.votes.get(t.id) || ''}` }, t.label);
      c.onclick = () => {
        const open = c.classList.contains('open');
        chips.querySelectorAll('.fact-chip').forEach((x) => x.classList.remove('open'));
        if (open) { detail.hidden = true; return; }
        c.classList.add('open');
        detail.hidden = false; detail.innerHTML = '';
        detail.append(h('blockquote', {}, '“', t.evidence, '”'),
          h('div', { class: 'sp-src' }, 'Source: ', h('a', { href: t.url, target: '_blank', rel: 'noopener' }, t.source)),
          fb(t, taxon, { prompt: 'Is this correct for this species?', onVerdict: (v) => { c.className = `fact-chip open v-${v}`; } }));
      };
      return c;
    }));
    wrap.append(h('div', { class: 'fact-group' }, h('div', { class: 'fact-cat' }, icon(ico), label), chips, detail));
  }
  wrap.append(h('p', { class: 'fine' }, 'Tags are extracted from the cited text automatically. Tap one to see the evidence and confirm or correct it.'));
  return wrap;
}

function videosView(d, taxon) {
  const box = h('div', {});
  if (d.videos.length) {
    box.append(h('div', { class: 'vid-row' }, d.videos.map((v) => {
      const card = h('div', { class: 'vid' },
        h('button', { class: 'vid-thumb', onclick: () => lightbox(v, taxon), title: v.title },
          v.poster ? h('img', { src: v.poster, alt: v.title, loading: 'lazy' }) : h('div', { class: 'vid-ph' }),
          h('span', { class: 'play' }, icon('play')),
          v.duration ? h('span', { class: 'dur' }, fmtDur(v.duration)) : '',
          h('span', { class: `prov ${v.provider}` }, v.provider === 'youtube' ? 'YouTube' : 'Commons')),
        h('div', { class: 'vid-title', title: v.title }, v.title),
        fb(v, taxon, { compact: true }));
      return card;
    })));
  } else box.append(h('p', { class: 'muted' }, 'No openly licensed clips found yet.'));
  box.append(h('div', { class: 'sp-more' }, 'More clips: ',
    h('a', { href: d.more.youtube_shorts, target: '_blank', rel: 'noopener' }, 'YouTube Shorts ↗'), ' · ',
    h('a', { href: d.more.commons, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons ↗')));
  return box;
}

function photosView(photos, taxon) {
  if (!photos.length) return h('p', { class: 'muted' }, 'No openly licensed photos found.');
  return h('div', { class: 'ph-grid' }, photos.map((p) => h('div', { class: `ph v-${SP.votes.get(p.id) || ''}` },
    h('img', { src: p.thumb, alt: taxon, loading: 'lazy', onclick: () => lightbox(p, taxon) }),
    h('div', { class: 'ph-fb' }, fb(p, taxon, { compact: true, noComment: true })))));
}

function similarView(d, taxon, isMain) {
  const items = [...d.items];
  const v = isMain ? SP.ctx?.visual : null;
  const byName = new Map(items.map((x) => [x.name, x]));
  for (const m of v?.items || []) {
    if (!m.card || m.name === taxon) continue;
    const rel = `looks similar · ${(m.prob * 100).toFixed(m.prob < 0.1 ? 1 : 0)}%`;
    if (byName.has(m.name)) byName.get(m.name).relations.unshift(rel);
    else { const it = { ...m.card, kind: 'similar', id: `inat:${m.card.inat_id}`, relations: [rel], detail: 'BioCLIP-2 visual match for this instance' }; items.unshift(it); byName.set(m.name, it); }
  }
  if (!items.length) return h('p', { class: 'muted' }, 'No similar species found.');
  const r = SP.ctx?.inst;
  return h('div', { class: 'sim-list' }, items.slice(0, 18).map((s) => h('div', { class: 'sim' },
    h('button', { class: 'sim-img', onclick: () => openTaxon(s.inat_id, `similar to ${taxon}`) }, s.photo ? h('img', { src: s.photo, alt: s.name, loading: 'lazy' }) : ''),
    h('div', { class: 'sim-txt' },
      h('button', { class: 'sim-name', onclick: () => openTaxon(s.inat_id, `similar to ${taxon}`) }, h('b', {}, s.common || s.name), s.common ? h('i', {}, ` ${s.name}`) : ''),
      h('div', { class: 'sim-rel' }, s.relations.map((x) => h('span', { class: `rel ${x.startsWith('looks') ? 'vis' : x === 'same genus' ? 'gen' : 'conf'}` }, x))),
      s.detail ? h('div', { class: 'fine' }, s.detail) : '',
      fb(s, taxon, { compact: true, prompt: r ? `Could #${SP.env.instNo(r)} be this instead?` : 'Is this a close relative?' })))));
}

function communityView(items) {
  if (!items.length) {
    return h('div', { class: 'sp-empty small' }, h('p', {}, 'No community records for this species yet.'),
      h('p', { class: 'muted' }, 'Submit a review (Research mode) or contribute photos to be the first.'));
  }
  return h('div', { class: 'ph-grid' }, items.map((c) => h('div', { class: 'ph comm' },
    h('img', { src: c.thumb, alt: c.species || '', loading: 'lazy', onclick: () => lightbox({ kind: 'photo', id: `community:${c.image_id}:${c.instance_id}`, thumb: c.thumb, full: c.thumb, attribution: c.source + (c.location ? ' · ' + c.location : ''), license: c.license || 'MarineChat' }, c.species) }),
    h('div', { class: 'comm-tag' }, c.source === 'contribution' ? 'contributed' : 'expert-verified'))));
}

// ------------------------------------------------------------------ feedback widget
function sendFb(item, taxon, verdict, notes) {
  const env = SP.env, img = env.image();
  return api('/api/feedback', { body: { target: 'knowledge', image_id: img?.image_id, instance_id: SP.ctx?.inst?.id, verdict, notes,
    species: taxon, taxon, item: { ...item, relations: (item.relations || []).join('; ') }, role: env.mode(), contributor: env.contributor() } });
}

function fb(item, taxon, { compact = false, noComment = false, prompt = '', onVerdict } = {}) {
  const env = SP.env;
  return feedbackBar({
    key: `k:${item.id}:${taxon}`, question: prompt, compact, noComment,
    onVerdict: (v) => { SP.votes.set(item.id, v); onVerdict?.(v); },
    payload: () => ({ target: 'knowledge', image_id: env.image()?.image_id, instance_id: SP.ctx?.inst?.id, species: taxon, taxon,
      item: { ...item, relations: (item.relations || []).join('; ') }, role: env.mode(), contributor: env.contributor() }),
  });
}

// ------------------------------------------------------------------ lightbox (photos & videos)
function initLightbox() {
  const lb = h('div', { class: 'lightbox', id: 'lightbox', hidden: true, role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'lb-inner glass' }, h('button', { class: 'lb-close', 'aria-label': 'Close' }, icon('x')), h('div', { class: 'lb-media' }), h('div', { class: 'lb-meta' })));
  document.body.append(lb);
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lb-close')) closeLightbox(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });
}
function closeLightbox() { const lb = $('#lightbox'); lb.hidden = true; lb.querySelector('.lb-media').innerHTML = ''; }
function lightbox(item, taxon) {
  const lb = $('#lightbox'), media = lb.querySelector('.lb-media'), meta = lb.querySelector('.lb-meta');
  media.innerHTML = ''; meta.innerHTML = '';
  if (item.kind === 'video' && item.provider === 'youtube') {
    media.append(h('iframe', { src: `https://www.youtube-nocookie.com/embed/${item.video_id}?autoplay=1&rel=0`, allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: true, title: item.title }));
  } else if (item.kind === 'video') {
    const v = h('video', { controls: true, autoplay: true, muted: true, playsinline: true, loop: true, poster: item.poster || '' }, h('source', { src: item.src, type: item.type || 'video/webm' }));
    media.append(v);
  } else media.append(h('img', { src: item.full || item.thumb, alt: taxon }));
  meta.append(h('div', { class: 'lb-title' }, item.title || taxon || ''),
    h('div', { class: 'fine' }, [item.attribution, item.license, item.place, item.date].filter(Boolean).join(' · '),
      item.page ? [' · ', h('a', { href: item.page, target: '_blank', rel: 'noopener' }, 'source ↗')] : ''),
    item.id ? fb(item, taxon, { prompt: 'Does this really show this species?' }) : '');
  lb.hidden = false;
}

// ------------------------------------------------------------------ search / empty states
async function onSearch() {
  const q = $('#spSearch').value.trim(), box = $('#spSuggest');
  if (q.length < 2) return hideSuggest();
  try {
    const res = await api(`/api/species/search?q=${encodeURIComponent(q)}`);
    box.innerHTML = '';
    res.forEach((t) => {
      const b = h('button', { class: 'sugg-item' }, t.photo ? h('img', { src: t.photo, alt: '' }) : h('span', { class: 'noimg' }),
        h('span', {}, h('b', {}, t.common || t.name), h('i', { class: 'muted' }, ` ${t.name}`), h('small', {}, ` ${t.rank}`)));
      b.onclick = () => {
        hideSuggest(); $('#spSearch').value = '';
        const r = SP.ctx?.inst;
        SP.stack = [];
        openTaxon(t.inat_id, r ? 'your search' : '');
      };
      box.append(b);
    });
    box.hidden = !res.length;
  } catch (e) { toast(e.message, 'err'); }
}
function hideSuggest() { const b = $('#spSuggest'); if (b) b.hidden = true; }

function renderEmpty() {
  const body = $('#spBody');
  if (!body) return;
  $('#spBack').hidden = true;
  body.innerHTML = '';
  body.append(h('div', { class: 'sp-empty' }, h('div', { class: 'bubble-art' }, h('i'), h('i'), h('i')),
    h('p', {}, 'Select a creature to explore its species: similar species, habits, habitats, short clips and photos.'),
    h('p', { class: 'muted' }, 'Or search any marine species above.')));
}

function skeleton(text) {
  return h('div', { class: 'sp-skel' }, h('div', { class: 'sk-hero' }), h('div', { class: 'sk-lines' }, h('div', { class: 'shimmer-line' }), h('div', { class: 'shimmer-line short' }), h('div', { class: 'shimmer-line' })), h('p', { class: 'muted fine' }, text));
}
const errLine = (e) => h('p', { class: 'err fine' }, e.message);
const fmtDur = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
