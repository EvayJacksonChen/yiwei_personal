// Species explorer: links an instance to public biodiversity knowledge + our own community data,
// with a ✓ / ✗ / comment feedback widget on every tag, clip, photo and similar species.
// Experts can correct any model text in place (species, description, fact tags, summary), with the
// model suggestions shown next to the editor as references. Clips open in the video studio.
import { $, h, icon, api, toast, burst, store, streamText } from './util.js';
import { feedbackBar } from './feedback.js';
import { hoverCard, speciesCard, speciesCardByName, infoCard } from './hovercard.js';
import { openVideoStudio, splitModel } from './videostudio.js';

const CAT = {
  environment: ['Environment', 'drop'], habitat: ['Habitat', 'reef'], depth: ['Depth', 'depth'],
  behaviour: ['Behaviour', 'spark'], diet: ['Diet', 'fork'], size: ['Size', 'ruler'],
  reproduction: ['Reproduction', 'egg'], conservation: ['Conservation', 'shield'],
};
const SP = { ctx: null, stack: [], seq: 0, instSeq: 0, votes: new Map(), env: null, keywords: [], edits: new Map() };

/** env = { image, instNo(r), mode, model(), contributor(), modelLabel(id), review(id), onSpeciesPicked(r, name, confirmed), onCaptionCorrected(r, text) } */
export function initSpecies(env) {
  SP.env = env;
  $('#spSearch').addEventListener('input', debounce(onSearch, 250));
  $('#spSearch').addEventListener('keydown', (e) => { if (e.key === 'Escape') hideSuggest(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.sp-searchbox')) hideSuggest(); });
  $('#spBack').onclick = () => { SP.stack.pop(); const t = SP.stack.pop(); if (t) openTaxon(t.inat_id, t.reason, { root: !SP.stack.length }); else renderEmpty(); };
  $('#spWide').onclick = () => { $('.workspace').classList.toggle('wide'); store.set('spWide', $('.workspace').classList.contains('wide')); };
  if (store.get('spWide', false)) $('.workspace').classList.add('wide');
  initLightbox();
  renderEmpty();
}

/** Open the explorer for an instance: caption name -> taxon; otherwise BioCLIP's top visual match. */
export async function openForInstance(r, caps) {
  const env = SP.env, img = env.image();
  if (!img || !r) return renderEmpty();
  const tok = ++SP.instSeq;                       // a newer request (another click) wins; older ones stop
  SP.ctx = { inst: r, image_id: img.image_id, visual: null, caps: caps || [] };
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
  const ctx = SP.ctx;
  ctx.visualP = api('/api/species/identify', { body: { image_id: img.image_id, instance_id: r.id } })
    .then((d) => (ctx.visual = d)).catch(() => null);
  let taxon = null;
  if (name) taxon = (await api('/api/species/resolve', { body: { name } }).catch(() => ({}))).taxon;
  if (!taxon) {
    const v = await ctx.visualP;
    const top = v?.items?.find((x) => x.card);
    if (top) { taxon = top.card; reason = `visual match (BioCLIP-2, ${(top.prob * 100).toFixed(0)}%)`; }
  }
  if (tok !== SP.instSeq) return;
  if (!taxon) {
    body.innerHTML = '';
    body.append(h('div', { class: 'sp-empty' }, h('p', {}, 'Could not match this instance to a species automatically.'),
      h('p', { class: 'muted' }, 'Type the right name below or search above. Your choice is saved as a correction.')));
    body.append(idEditor(r, null, reason, true));
    return;
  }
  openTaxon(taxon.inat_id, reason, { root: true });
}

// ------------------------------------------------------------------ rendering one taxon
async function openTaxon(inatId, reason = '', { root = false } = {}) {
  const seq = ++SP.seq;
  if (root) SP.stack = [];
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
  const isMain = SP.stack.length === 1 && !!SP.ctx?.inst;
  body.append(header(prof, reason, isMain));
  api(`/api/species/${inatId}/links`).then((d) => {
    const box = body.querySelector('.sp-links');
    if (!box || seq !== SP.seq) return;
    const have = new Set([...box.querySelectorAll('a')].map((a) => a.textContent.replace(' ↗', '').trim().toLowerCase()));
    for (const l of d.links) {
      if (l.key === 'gbif') box.querySelectorAll('a').forEach((a) => { if (a.textContent.startsWith('GBIF')) a.href = l.url; });
      if (have.has(l.label.toLowerCase())) continue;
      box.append(h('a', { href: l.url, target: '_blank', rel: 'noopener', class: 'btn btn-ghost btn-xs new' }, l.label, ' ↗'));
    }
  }).catch(() => {});
  const model = isMain ? modelSection(SP.ctx.inst, SP.ctx.caps) : null;
  if (model) body.append(model);
  const secs = {
    about: section('about', 'About', 'book'), facts: section('facts', 'Habits & habitats', 'reef'),
    videos: section('videos', 'Short clips & videos', 'play'), photos: section('photos', 'Photos', 'image'),
    similar: section('similar', 'Similar & close species', 'tree'), community: section('community', 'From the MarineChat community', 'people'),
  };
  Object.values(secs).forEach((s) => body.append(s.el));
  secs.about.fill(aboutView(prof));

  const T = prof.name;
  SP.keywords = [];
  api(`/api/species/${inatId}/facts`).then((d) => {
    if (seq !== SP.seq) return;
    const pri = { behaviour: 0, diet: 1, habitat: 2 };     // what happens in a clip first, where it is last
    SP.keywords = d.tags.filter((t) => t.category in pri).sort((a, b) => pri[a.category] - pri[b.category]).map((t) => t.label);
    secs.facts.fill(factsView(d, T));
  }).catch((e) => secs.facts.fill(errLine(e)));
  api(`/api/species/${inatId}/media`).then((d) => {
    if (seq !== SP.seq) return;
    secs.videos.fill(videosView(d, T, prof), d.videos.length);
    secs.photos.fill(photosView(d.photos, T, d.photo_sources), d.photos.length);
    const corner = (kind, items, tab) => [
      { icon: 'expand', label: `Pop out all ${items.length} ${kind === 'photo' ? 'photos' : 'clips'} here`, onClick: () => fullView({ kind, items, taxon: T, prof, tab }) },
      { icon: 'layers', label: 'Open them on their own page', onClick: () => { location.hash = `#/media?taxon=${inatId}&tab=${tab}`; } }];
    if (d.photos.length) secs.photos.expandable(corner('photo', d.photos, 'photos'));
    if (d.videos.length) secs.videos.expandable(corner('video', d.videos, 'short'));
  }).catch((e) => { secs.videos.fill(errLine(e)); secs.photos.fill(errLine(e)); });
  api(`/api/species/${inatId}/similar`).then((d) => seq === SP.seq && secs.similar.fill(similarView(d, T, isMain))).catch((e) => secs.similar.fill(errLine(e)));
  const names = [prof.name, prof.common].filter(Boolean).join('|');
  api(`/api/species/community?names=${encodeURIComponent(names)}`).then((d) => seq === SP.seq && secs.community.fill(communityView(d.items), d.items.length))
    .catch((e) => secs.community.fill(errLine(e)));
}

const spHover = (el, inatId) => hoverCard(el, () => speciesCard(inatId), `sp:${inatId}`);

function header(p, reason, isMain) {
  const env = SP.env, r = SP.ctx?.inst;
  const crumbs = h('div', { class: 'sp-crumbs' }, (p.ancestors || []).map((a, i) => {
    const b = h('button', { class: 'link', onclick: () => openTaxon(a.inat_id, `${a.rank} of ${p.name}`) }, a.name);
    spHover(b, a.inat_id);
    return [i ? h('span', { class: 'sep' }, '›') : '', b];
  }));
  const pills = h('div', { class: 'sp-pills' },
    h('span', { class: 'pill' }, p.rank),
    p.worms?.marine ? h('span', { class: 'pill ok' }, 'marine (WoRMS)') : '',
    p.worms && p.worms.status !== 'accepted' ? h('span', { class: 'pill warn' }, `WoRMS: ${p.worms.status} → ${p.worms.valid_name}`) : '',
    p.conservation?.status ? h('span', { class: 'pill warn' }, `${p.conservation.status}${p.conservation.authority ? ' · ' + p.conservation.authority : ''}`) : '',
    h('span', { class: 'pill' }, `${(p.observations || 0).toLocaleString()} iNat records`));
  const links = h('div', { class: 'sp-links' }, Object.entries(p.links || {}).filter(([, u]) => u).map(([k, u]) =>
    h('a', { href: u, target: '_blank', rel: 'noopener', class: 'btn btn-ghost btn-xs' }, { worms: 'WoRMS', gbif: 'GBIF', inaturalist: 'iNaturalist' }[k] || k[0].toUpperCase() + k.slice(1), ' ↗')));
  const card = h('div', { class: 'sp-head' },
    p.photo ? h('img', { class: 'sp-hero', src: p.photo, alt: p.name, title: p.photo_attr || '', onclick: () => lightbox({ kind: 'photo', thumb: p.photo, full: p.photo.replace('medium', 'large'), attribution: p.photo_attr, page: p.links?.inaturalist }, p.name) }) : '',
    h('div', { class: 'sp-titles' },
      h('div', { class: 'sp-common' }, p.common || p.name),
      h('div', { class: 'sp-sci' }, h('i', {}, p.name), p.worms?.authority ? h('span', { class: 'muted' }, ` ${p.worms.authority}`) : ''),
      crumbs, pills, links));
  const out = h('div', {}, card);
  if (isMain && r) {
    const editor = idEditor(r, p, reason, false);
    editor.hidden = true;
    const edit = h('button', { class: 'ib sp-edit', type: 'button', title: 'Type the correct species yourself' }, icon('edit'), 'Correct it');
    edit.onclick = () => { editor.hidden = !editor.hidden; if (!editor.hidden) editor.querySelector('input').focus(); };
    const bar = h('div', { class: 'sp-confirm' },
      h('span', {}, `Is #${env.instNo(r)} a `, h('b', {}, p.common || p.name), '?', reason ? h('span', { class: 'muted' }, ` (from ${reason})`) : ''));
    bar.append(h('div', { class: 'sp-confirm-act' }, fb({ kind: 'identification', id: `inst:${r.id}:${p.inat_id}`, name: p.name, label: p.common, source: reason }, p.name, {
      onVerdict: (v) => {
        if (v === 'correct') { env.onSpeciesPicked(r, p.name, true); editor.hidden = true; SP.simMode?.('rank'); }
        else { editor.hidden = false; editor.querySelector('input').focus(); }
      },
    }), edit));
    out.append(bar, editor);
  } else if (r) {
    const use = h('button', { class: 'btn btn-sm btn-glow' }, icon('check'), `#${env.instNo(r)} is this species`);
    use.onclick = (e) => { env.onSpeciesPicked(r, p.name, false); sendFb({ kind: 'identification', id: `inst:${r.id}:${p.inat_id}`, name: p.name, source: 'user picked from explorer' }, p.name, 'corrected', '', { correction: p.name }); const b = e.currentTarget.getBoundingClientRect(); burst(b.left + 60, b.top); };
    out.append(h('div', { class: 'sp-confirm' }, h('span', { class: 'muted' }, 'Browsing a related taxon.'), use));
  }
  return out;
}

// ------------------------------------------------------------------ expert correction: species name
/** Free-text species editor with iNaturalist autocomplete and the models' suggestions as references. */
function idEditor(r, p, reason, standalone) {
  const env = SP.env;
  let picked = null;                                   // taxon chosen from autocomplete / a reference
  const ta = taxonInput({ placeholder: 'Correct species, e.g. Chromodoris annae', value: p ? p.name : '', onPick: (t) => { picked = t; } });
  ta.input.addEventListener('input', () => { picked = null; });
  const refs = h('div', { class: 'id-refs' }, h('div', { class: 'shimmer-line short' }));
  const save = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, icon('check'), 'Save correction');
  const cancel = standalone ? '' : h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, 'Cancel');
  const box = h('div', { class: 'id-editor' },
    h('div', { class: 'id-row' }, ta.el, save, cancel),
    h('div', { class: 'fine' }, 'Type any name, or pick one of the suggestions. Hover a suggestion for photos and traits.'),
    refs);
  if (cancel) cancel.onclick = () => { box.hidden = true; };

  const choose = (name, taxon) => { ta.input.value = name; picked = taxon || null; ta.input.focus(); };
  const refBtn = (label, sub, onClick, thumb, hover) => {
    const b = h('button', { class: 'id-ref', type: 'button', onclick: onClick },
      thumb ? h('img', { src: thumb, alt: '' }) : h('span', { class: 'id-ref-ico' }, icon('chat')),
      h('span', { class: 'id-ref-txt' }, h('b', {}, label), h('small', {}, sub)));
    hover?.(b);
    return b;
  };
  (async () => {
    const list = [];
    for (const c of SP.ctx?.caps || []) {
      const q = c.parsed;
      if (c.error || !q || !(q.label || q.sci)) continue;
      const nm = q.sci && q.sci.toLowerCase() !== 'uncertain' ? q.sci : q.label;
      list.push(refBtn(q.label || q.sci, `${env.modelLabel(c.model)}${q.conf ? ' · ' + q.conf + ' confidence' : ''}${q.sci && q.label ? ' · ' + q.sci : ''}`,
        () => choose(nm), null, (b) => hoverCard(b, () => speciesCardByName(nm), `name:${nm}`)));
    }
    const v = SP.ctx?.visual || await SP.ctx?.visualP;
    for (const m of (v?.items || []).filter((x) => x.card).slice(0, 6)) {
      list.push(refBtn(m.card.common || m.card.name, `BioCLIP-2 visual match · ${(m.prob * 100).toFixed(m.prob < 0.1 ? 1 : 0)}%${m.card.common ? ' · ' + m.card.name : ''}`,
        () => choose(m.card.name, m.card), m.card.photo, (b) => spHover(b, m.card.inat_id)));
    }
    refs.innerHTML = '';
    if (list.length) refs.append(h('div', { class: 'id-refs-head' }, 'Model suggestions'), h('div', { class: 'id-refs-list' }, list));
  })();

  save.onclick = async () => {
    const name = ta.input.value.trim();
    if (!name) return ta.input.focus();
    save.disabled = true;
    let t = picked;
    if (!t) t = (await api('/api/species/resolve', { body: { name } }).catch(() => ({}))).taxon || null;
    const was = p ? p.name : '';
    sendFb({ kind: 'identification', id: `inst:${r.id}:${p?.inat_id || 'none'}`, name: was, label: p?.common || '', source: reason || '' }, was || name, 'corrected', '',
      { correction: t ? t.name : name, original: was });
    env.onSpeciesPicked(r, t ? t.name : name, false);
    save.disabled = false;
    const b = save.getBoundingClientRect(); burst(b.left + 50, b.top);
    if (t && t.inat_id !== p?.inat_id) openTaxon(t.inat_id, 'your correction', { root: true });
    else if (!t) toast(`Saved “${name}” as your correction. It is not in iNaturalist, so no profile is shown.`, 'ok', 4500);
    else box.hidden = true;
  };
  return box;
}

// ------------------------------------------------------------------ expert correction: model description
function modelSection(r, caps) {
  const env = SP.env, ok = (caps || []).filter((c) => !c.error && c.text);
  if (!ok.length) return null;
  const rv = env.review(r.id) || {}, best = ok[0];
  const orig = best.parsed?.desc || best.text;
  const s = section('model', 'What our models said', 'chat');
  const ta = h('textarea', { class: 'md-edit', rows: 4, maxlength: 4000, 'aria-label': 'Description of this creature (edit to correct)' });
  ta.value = rv.correction || orig;
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight + 2, 320)}px`; };
  const who = h('span', { class: 'fine' }, rv.correction ? 'Your corrected description' : `Description by ${env.modelLabel(best.model)}. Edit the text to correct it.`);
  const save = h('button', { class: 'btn btn-xs btn-glow', type: 'button', disabled: true }, icon('check'), 'Save correction');
  const reset = h('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Reset');
  ta.oninput = () => { grow(); save.disabled = ta.value.trim() === (rv.correction || orig).trim(); };
  ta.addEventListener('keydown', (e) => e.stopPropagation());
  reset.onclick = () => { ta.value = orig; ta.oninput(); };
  save.onclick = async () => {
    const text = ta.value.trim();
    save.disabled = true;
    try {
      await api('/api/feedback', { body: { target: 'caption', verdict: 'corrected', image_id: env.image()?.image_id, instance_id: r.id,
        model: best.model, original: best.text, correction: text, species: rv.species || '', role: env.mode(), contributor: env.contributor(),
        context: { source: 'species tab', instance_no: env.instNo(r) } } });
      env.onCaptionCorrected?.(r, text);
      who.textContent = 'Your corrected description (saved)';
      toast('Correction saved. Thank you!', 'ok');
      const b = save.getBoundingClientRect(); burst(b.left + 40, b.top, 10);
    } catch (e) { save.disabled = false; toast(e.message, 'err'); }
  };
  const refs = ok.map((c) => {
    const q = c.parsed || {};
    const txt = q.desc || c.text;
    return h('div', { class: 'md-ref' },
      h('div', { class: 'md-ref-head' }, h('b', {}, env.modelLabel(c.model)),
        q.label ? h('span', {}, ` · ${q.label}`) : '', q.sci ? h('i', { class: 'muted' }, ` ${q.sci}`) : '',
        q.conf ? h('span', { class: `pill ${q.conf === 'high' ? 'ok' : q.conf === 'low' ? 'warn' : ''}` }, q.conf) : '',
        h('button', { class: 'link', type: 'button', onclick: () => { ta.value = txt; ta.oninput(); ta.focus(); } }, 'Use as starting point')),
      h('p', { class: 'md-ref-text' }, txt));
  });
  s.fill(who, ta, h('div', { class: 'row gap md-actions' }, reset, save),
    h('details', { class: 'md-refs' }, h('summary', {}, `All model answers (${ok.length}) as references`), refs));
  requestAnimationFrame(grow);
  return s.el;
}

function section(key, title, ico) {
  const cnt = h('span', { class: 'badge' }, '…');
  const content = h('div', { class: 'sp-sec-body' }, h('div', { class: 'shimmer-line' }), h('div', { class: 'shimmer-line short' }));
  const head = h('button', { class: 'sp-sec-head' }, icon(ico), h('span', {}, title), cnt, icon('chev'));
  const el = h('section', { class: `sp-sec ${store.get('spFold:' + key, false) ? 'folded' : ''}`, 'data-sec': key }, head, content);
  head.onclick = () => { el.classList.toggle('folded'); store.set('spFold:' + key, el.classList.contains('folded')); };
  return { el,
    fill: (...kids) => {
      const n = typeof kids[kids.length - 1] === 'number' ? kids.pop() : null;
      content.innerHTML = ''; content.append(...kids.flat().filter(Boolean));
      cnt.textContent = n == null ? '' : n; cnt.hidden = n == null;
    },
    /** corner buttons that open the section in a full view: [{ icon, label, onClick }] */
    expandable: (buttons) => {
      el.querySelector('.sec-expand-group')?.remove();
      el.append(h('div', { class: 'sec-expand-group' }, buttons.map((b) =>
        h('button', { class: 'sec-expand', type: 'button', title: b.label, 'aria-label': b.label, onclick: b.onClick }, icon(b.icon)))));
    } };
}

// ------------------------------------------------------------------ sections
/** About: one short, model-condensed paragraph (main traits kept) in an editable box, credited to its sources. */
function aboutView(prof) {
  const env = SP.env, key = `brief:${prof.inat_id}`;
  let generated = '', model = env.model(), ctl = null, sources = ['Wikipedia'];
  const ta = h('textarea', { class: 'about-text', rows: 4, maxlength: 2000, readonly: true, 'aria-label': 'Short summary (edit to correct)' });
  ta.addEventListener('keydown', (e) => e.stopPropagation());
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight + 2, 360)}px`; };
  const credit = h('p', { class: 'fine about-credit' });
  const article = prof.wikipedia_url ? h('a', { href: prof.wikipedia_url, target: '_blank', rel: 'noopener' }, 'Full Wikipedia article ↗') : '';
  const again = h('button', { class: 'link', type: 'button', title: 'Ask the model to write it again' }, 'Regenerate');
  const save = h('button', { class: 'btn btn-xs btn-glow', type: 'button', disabled: true }, icon('check'), 'Save correction');
  const verdict = h('div', { class: 'ai-verdict' });
  const setCredit = (txt) => { credit.replaceChildren(txt, article ? ' · ' : '', article); };
  const fromSources = () => sources.join(sources.length > 2 ? ', ' : ' and ').replace(/, ([^,]+)$/, ' and $1');
  ta.oninput = () => { grow(); save.disabled = !ta.value.trim() || ta.value.trim() === (SP.edits.get(key) || generated).trim(); };
  api(`/api/species/${prof.inat_id}/about`).then((a) => {
    const lb = [...new Set(a.sections.map((x) => x.title.split(' · ')).filter((x) => x.length > 1).map((x) => x[0]))];
    sources = ['Wikipedia', ...lb];
    if (generated) setCredit(`AI-generated by ${env.modelLabel(model)} from ${fromSources()}. It can be wrong: edit the text to correct it.`);
  }).catch(() => {});
  const fallback = (why) => {
    const sents = (prof.summary || '').match(/[^.!?]+[.!?]+/g) || [];
    ta.value = sents.slice(0, 3).join(' ').trim() || 'No summary available.'; grow();
    setCredit(`From Wikipedia (${why}).`);
  };
  const run = async (fresh = false) => {
    ctl?.abort(); ctl = new AbortController();
    ta.readOnly = true; save.disabled = true; again.disabled = true; ta.classList.add('writing');
    ta.value = ''; setCredit(`Writing a short summary from ${fromSources()}…`);
    try {
      const out = await streamText('/api/species/ai-summary', { inat_id: prof.inat_id, model: env.model(), style: 'brief', nocache: fresh }, (t) => {
        const r = splitModel(t);
        if (r.model) model = r.model;
        if (r.text) { ta.value = r.text.trim(); grow(); }
      }, ctl.signal);
      const r = splitModel(out);
      generated = r.text.trim(); model = r.model || model;
      if (!generated) return fallback('the AI summary is empty');
      ta.value = SP.edits.get(key) || generated; ta.readOnly = false; grow();
      setCredit(SP.edits.has(key) ? `Corrected by you · based on an AI summary from ${fromSources()}.`
        : `AI-generated by ${env.modelLabel(model)} from ${fromSources()}. It can be wrong: edit the text to correct it.`);
      verdict.replaceChildren(fb({ kind: 'ai-summary', id: `brief:${prof.inat_id}:${model}`, source: model, title: generated.slice(0, 400) }, prof.name, { compact: true, prompt: 'Accurate?' }));
    } catch (e) { fallback('the AI summary is unavailable right now'); } finally { again.disabled = false; ta.classList.remove('writing'); }
  };
  again.onclick = () => run(true);
  save.onclick = () => {
    const v = ta.value.trim();
    save.disabled = true;
    sendFb({ kind: 'ai-summary', id: `brief:${prof.inat_id}:${model}`, source: model }, prof.name, 'corrected', '', { original: generated, correction: v, model })
      .then(() => { SP.edits.set(key, v); setCredit(`Corrected by you · based on an AI summary from ${fromSources()}.`); toast('Correction saved. Thank you!', 'ok'); const b = save.getBoundingClientRect(); burst(b.left + 40, b.top, 10); })
      .catch((e) => { save.disabled = false; toast(e.message, 'err'); });
  };
  run();
  return h('div', { class: 'about' }, ta, credit, h('div', { class: 'row gap about-act' }, verdict, h('span', { class: 'grow' }), again, save));
}

function factsView(d, taxon) {
  const wrap = h('div', { class: 'facts' });
  const groups = {};
  d.tags.forEach((t) => (groups[t.category] = groups[t.category] || []).push(t));
  if (!d.tags.length) wrap.append(h('p', { class: 'muted' }, 'No habit / habitat facts found in the public sources.'));
  const groupEl = (cat) => {
    let g = wrap.querySelector(`.fact-group[data-cat="${cat}"]`);
    if (g) return g;
    const [label, ico] = CAT[cat] || [cat, 'spark'];
    g = h('div', { class: 'fact-group', 'data-cat': cat }, h('div', { class: 'fact-cat' }, icon(ico), label), h('div', { class: 'fact-chips' }), h('div', { class: 'fact-detail', hidden: true }));
    wrap.querySelector('.fact-add-wrap') ? wrap.querySelector('.fact-add-wrap').before(g) : wrap.append(g);
    return g;
  };
  const chipFor = (t, g) => {
    const chips = g.querySelector('.fact-chips'), detail = g.querySelector('.fact-detail');
    const edited = SP.edits.get(`fact:${t.id}`);
    const c = h('button', { class: `fact-chip v-${SP.votes.get(t.id) || ''} ${edited || t.mine ? 'edited' : ''}` }, edited || t.label);
    if (t.evidence) hoverCard(c, () => infoCard({ title: edited || t.label, lines: [`“${t.evidence.slice(0, 220)}${t.evidence.length > 220 ? '…' : ''}”`, `Source: ${t.source}`] }));
    c.onclick = () => {
      const open = c.classList.contains('open');
      chips.querySelectorAll('.fact-chip').forEach((x) => x.classList.remove('open'));
      if (open) { detail.hidden = true; return; }
      c.classList.add('open');
      detail.hidden = false; detail.innerHTML = '';
      const editBtn = h('button', { class: 'ib', type: 'button', title: 'Retype this tag' }, icon('edit'), 'Edit tag');
      editBtn.onclick = () => {
        const inp = h('input', { value: c.textContent, maxlength: 120, 'aria-label': 'Corrected tag' });
        const ok = h('button', { class: 'btn btn-xs btn-glow', type: 'button' }, 'Save');
        const row = h('div', { class: 'row gap fact-edit' }, inp, ok);
        const commit = () => {
          const v = inp.value.trim();
          if (v && v !== c.textContent) {
            sendFb(t, taxon, 'corrected', '', { original: t.label, correction: v }).then(() => toast('Tag corrected. Thank you!', 'ok')).catch((e) => toast(e.message, 'err'));
            SP.edits.set(`fact:${t.id}`, v); c.textContent = v; c.classList.add('edited');
          }
          row.replaceWith(editBtn);
        };
        ok.onclick = commit;
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') row.replaceWith(editBtn); e.stopPropagation(); });
        editBtn.replaceWith(row); inp.focus(); inp.select();
      };
      detail.append(t.evidence ? h('blockquote', {}, '“', t.evidence, '”') : h('p', { class: 'fine' }, 'Added by you.'),
        t.url ? h('div', { class: 'sp-src' }, 'Source: ', h('a', { href: t.url, target: '_blank', rel: 'noopener' }, t.source)) : '',
        h('div', { class: 'row gap fact-act' }, fb(t, taxon, { prompt: 'Is this correct for this species?', onVerdict: (v) => { c.className = `fact-chip open v-${v}`; } }), editBtn));
    };
    chips.append(c);
  };
  for (const [cat, tags] of Object.entries(groups)) { const g = groupEl(cat); tags.forEach((t) => chipFor(t, g)); }

  // add a fact the sources missed
  const sel = h('select', { 'aria-label': 'Category' }, Object.entries(CAT).map(([k, [l]]) => h('option', { value: k }, l)));
  const txt = h('input', { maxlength: 120, placeholder: 'e.g. feeds on sponges', 'aria-label': 'New fact' });
  const src = h('input', { maxlength: 300, placeholder: 'Source or evidence (optional)', 'aria-label': 'Source' });
  const add = h('button', { class: 'btn btn-xs btn-glow', type: 'button' }, icon('plus'), 'Add');
  const form = h('div', { class: 'fact-add', hidden: true }, sel, txt, src, add);
  const open = h('button', { class: 'ib', type: 'button' }, icon('plus'), 'Add a fact the sources missed');
  open.onclick = () => { form.hidden = !form.hidden; if (!form.hidden) txt.focus(); };
  [txt, src].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') add.click(); e.stopPropagation(); }));
  add.onclick = () => {
    const v = txt.value.trim();
    if (!v) return txt.focus();
    const t = { kind: 'fact-new', id: `new:${sel.value}:${v.toLowerCase()}`, category: sel.value, label: v, source: src.value.trim(), evidence: src.value.trim(), mine: true };
    sendFb(t, taxon, 'added', '', { correction: v }).then(() => toast('Fact added. Thank you!', 'ok')).catch((e) => toast(e.message, 'err'));
    chipFor(t, groupEl(sel.value));
    txt.value = ''; src.value = '';
  };
  wrap.append(h('div', { class: 'fact-add-wrap' }, open, form),
    h('p', { class: 'fine' }, 'Tags are extracted from the cited text automatically. Tap one to see the evidence, confirm it or retype it.'));
  return wrap;
}

function videoCard(v, taxon, prof, big = false) {
  const thumb = h('button', { class: 'vid-thumb', onclick: () => lightbox(v, taxon, prof) },
    v.poster ? h('img', { src: v.poster, alt: v.title, loading: 'lazy' }) : h('div', { class: 'vid-ph' }),
    h('span', { class: 'play' }, icon('play')),
    v.duration ? h('span', { class: 'dur' }, fmtDur(v.duration)) : '',
    h('span', { class: `prov ${v.provider}` }, v.provider === 'youtube' ? 'YouTube' : v.provider === 'archive' ? 'Archive' : (v.source || '').startsWith('EOL') ? 'EOL' : 'Commons'),
    v.related ? h('span', { class: 'rel-badge', title: `Clip of a related species: ${v.related}` }, 'related') : '');
  if (!big) hoverCard(thumb, () => infoCard({ img: v.poster, title: v.title, wide: true, lines: [
    v.related ? h('p', { class: 'hc-hint' }, `Related species, ${v.related}`) : '',
    v.description ? `${v.description.slice(0, 200)}${v.description.length > 200 ? '…' : ''}` : '',
    [v.duration ? fmtDur(v.duration) : '', v.license, v.attribution].filter(Boolean).join(' · '),
    h('p', { class: 'hc-hint' }, 'Click to play, caption it and tag keyframes')] }));
  return h('div', { class: `vid ${big ? 'big' : ''}` }, thumb,
    h('div', { class: 'vid-title', title: v.title }, v.title),
    v.related ? h('div', { class: 'fine vid-rel' }, `Related species · ${v.related}`) : '',
    big ? h('p', { class: 'fine vid-desc' }, v.description || [v.license, v.attribution].filter(Boolean).join(' · ')) : '',
    fb(v, taxon, { compact: true }));
}
/** Pop-out window with every photo or clip of the species, a filter per source, and a link to the full page. */
function fullView({ kind, items, taxon, prof, tab }) {
  document.querySelector('.fullview')?.remove();
  const srcs = {};
  items.forEach((x) => { const k = topSource(x.source); srcs[k] = (srcs[k] || 0) + 1; });
  let filter = '';
  const grid = h('div', { class: `fv-grid ${kind}` });
  const render = () => {
    grid.innerHTML = '';
    items.filter((x) => !filter || topSource(x.source) === filter).forEach((x) => grid.append(kind === 'photo' ? photoTile(x, taxon, true) : videoCard(x, taxon, prof, true)));
  };
  const chips = h('div', { class: 'fv-filters' }, [['', `All ${items.length}`], ...Object.entries(srcs).map(([k, n]) => [k, `${k} ${n}`])].map(([k, label]) => {
    const b = h('button', { class: `sugg ${k === filter ? 'on' : ''}`, type: 'button' }, label);
    b.onclick = () => { filter = k; chips.querySelectorAll('.sugg').forEach((x) => x.classList.remove('on')); b.classList.add('on'); render(); };
    return b;
  }));
  const close = () => { fv.remove(); removeEventListener('keydown', onKey, true); };
  const onKey = (e) => { if (e.key === 'Escape' && $('#lightbox').hidden) { e.stopPropagation(); close(); } };
  const page = h('a', { class: 'btn btn-ghost btn-xs', href: `#/media?taxon=${prof.inat_id}&tab=${tab}`, onclick: () => close() }, icon('layers'), 'Open as a page');
  const fv = h('div', { class: 'fullview', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${kind === 'photo' ? 'Photos' : 'Clips'} of ${taxon}` },
    h('div', { class: 'fv-inner glass' },
      h('div', { class: 'fv-head' },
        h('div', {}, h('div', { class: 'lb-title' }, `${kind === 'photo' ? 'Photos' : 'Clips & videos'} · ${prof.common || taxon}`),
          h('div', { class: 'fine' }, h('i', {}, taxon), ` · ${items.length} openly licensed ${kind === 'photo' ? 'photos' : 'clips'} from ${Object.keys(srcs).length} source${Object.keys(srcs).length === 1 ? '' : 's'}`)),
        h('div', { class: 'fv-head-act' }, page, h('button', { class: 'lb-close', type: 'button', 'aria-label': 'Close', onclick: close }, icon('x')))),
      chips, h('div', { class: 'fv-scroll' }, grid)));
  fv.addEventListener('click', (e) => { if (e.target === fv) close(); });
  addEventListener('keydown', onKey, true);
  document.body.append(fv);
  render();
}

function videosView(d, taxon, prof) {
  const box = h('div', {});
  if (d.videos.length) {
    box.append(sourceLine(d.videos, 'From'), h('div', { class: 'vid-row' }, d.videos.map((v) => videoCard(v, taxon, prof))));
  } else box.append(h('p', { class: 'muted' }, 'No openly licensed clips found yet.'));
  box.append(h('div', { class: 'sp-more' }, 'More clips: ',
    h('a', { href: d.more.youtube_shorts, target: '_blank', rel: 'noopener' }, 'YouTube Shorts ↗'), ' · ',
    h('a', { href: d.more.commons, target: '_blank', rel: 'noopener' }, 'Wikimedia Commons ↗')));
  return box;
}

const topSource = (s) => (s || 'iNaturalist').split(' · ')[0];
function sourceLine(items, label) {
  const c = {};
  items.forEach((x) => { const k = topSource(x.source); c[k] = (c[k] || 0) + 1; });
  return h('p', { class: 'fine sp-sources' }, `${label} `, Object.entries(c).map(([k, n], i) => [i ? ' · ' : '', h('b', {}, k), ` ${n}`]));
}
function photoTile(p, taxon, big = false) {
  const img = h('img', { src: p.thumb, alt: p.title || taxon, loading: 'lazy', onclick: () => lightbox(p, taxon) });
  if (!big) hoverCard(img, () => infoCard({ img: p.thumb, title: p.title || taxon, wide: true, lines: [p.source ? h('p', { class: 'hc-hint' }, p.source) : '',
    [p.attribution, p.license].filter(Boolean).join(' · '), [p.place, p.date].filter(Boolean).join(' · ')] }));
  return h('div', { class: `ph ${big ? 'big' : ''} v-${SP.votes.get(p.id) || ''}` }, img,
    big ? h('div', { class: 'ph-cap' }, h('b', {}, topSource(p.source)), ` ${[p.attribution, p.license].filter(Boolean).join(' · ')}`) : '',
    h('div', { class: 'ph-fb' }, fb(p, taxon, { compact: true, noComment: true })));
}
function photosView(photos, taxon) {
  if (!photos.length) return h('p', { class: 'muted' }, 'No openly licensed photos found.');
  return [sourceLine(photos, 'From'), h('div', { class: 'ph-grid' }, photos.slice(0, 24).map((p) => photoTile(p, taxon))),
    photos.length > 24 ? h('p', { class: 'fine' }, `Showing 24 of ${photos.length}. The corner buttons show all of them, in a pop-out window or on their own page.`) : ''];
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
  const r = SP.ctx?.inst, rv = r ? SP.env.review(r.id) || {} : {};
  const body = h('div', { class: 'sim-body' });
  const bId = h('button', { class: 'about-tab', type: 'button', role: 'tab' }, icon('spark'), 'Help identify');
  const bRank = h('button', { class: 'about-tab', type: 'button', role: 'tab' }, icon('sliders'), 'Rank similarity');
  const hint = h('p', { class: 'fine sim-hint' });
  const render = (mode) => {
    bId.classList.toggle('on', mode === 'identify'); bRank.classList.toggle('on', mode === 'rank');
    bId.setAttribute('aria-selected', String(mode === 'identify')); bRank.setAttribute('aria-selected', String(mode === 'rank'));
    body.innerHTML = '';
    if (mode === 'rank') {
      hint.textContent = `Already sure what it is? Drag the species so the one most similar to ${taxon} is on top. Your ranking teaches the models what “similar” means.`;
      body.append(...rankView(items, taxon));
    } else {
      hint.textContent = r ? `Not sure what #${SP.env.instNo(r)} is? Compare it with these look-alikes and relatives.` : 'Look-alikes and close relatives.';
      body.append(...identifyView(items, taxon));
    }
  };
  bId.onclick = () => { store.set('spSimMode', 'identify'); render('identify'); };
  bRank.onclick = () => { store.set('spSimMode', 'rank'); render('rank'); };
  // default: rank once the identification is settled (confirmed or corrected), otherwise help identify
  const settled = !!(rv.species_confirmed || rv.species);
  render(store.get('spSimMode', null) || (settled ? 'rank' : 'identify'));
  SP.simMode = (m) => { if (!store.get('spSimMode', null) && body.isConnected) render(m); };
  return [h('div', { class: 'about-tabs sim-modes', role: 'tablist' }, bId, bRank), hint, body];
}

function identifyView(items, taxon) {
  const r = SP.ctx?.inst;
  const listEl = h('div', { class: 'sim-list' });
  const row = (s) => {
    const img = h('button', { class: 'sim-img', onclick: () => openTaxon(s.inat_id, `similar to ${taxon}`) }, s.photo ? h('img', { src: s.photo, alt: s.name, loading: 'lazy' }) : '');
    const name = h('button', { class: 'sim-name', onclick: () => openTaxon(s.inat_id, `similar to ${taxon}`) }, h('b', {}, s.common || s.name), s.common ? h('i', {}, ` ${s.name}`) : '');
    spHover(img, s.inat_id); spHover(name, s.inat_id);
    return h('div', { class: 'sim' }, img, h('div', { class: 'sim-txt' }, name,
      h('div', { class: 'sim-rel' }, relChips(s)),
      s.detail ? h('div', { class: 'fine' }, s.detail) : '',
      fb(s, taxon, { compact: true, prompt: r ? `Could #${SP.env.instNo(r)} be this instead?` : 'Is this a close relative?' })));
  };
  items.slice(0, 18).forEach((s) => listEl.append(row(s)));
  if (!items.length) listEl.append(h('p', { class: 'muted' }, 'No similar species found.'));
  const ta = taxonInput({ placeholder: 'Suggest a look-alike or close relative', onPick: (t) => {
    const it = { ...t, kind: 'similar-new', id: `inat:${t.inat_id}`, relations: ['suggested by you'], detail: '' };
    sendFb(it, taxon, 'added', '', { correction: t.name }).then(() => toast('Suggestion saved. Thank you!', 'ok')).catch((e) => toast(e.message, 'err'));
    items.unshift(it); listEl.prepend(row(it)); ta.input.value = '';
  } });
  return [listEl, h('div', { class: 'sim-add' }, ta.el)];
}

const relChips = (s) => s.relations.map((x) => h('span', { class: `rel ${x.startsWith('looks') ? 'vis' : x === 'same genus' ? 'gen' : x.startsWith('suggested') ? 'mine' : 'conf'}` }, x));

/** Drag-to-rank list (mouse, touch and keyboard), plus a "not similar" pile, saved as one feedback row. */
function rankView(items, taxon) {
  const orig = items.slice(0, 18);
  const list = h('ol', { class: 'rk-list' });
  const pile = h('ul', { class: 'rk-pile' });
  const pileWrap = h('details', { class: 'rk-pile-wrap', hidden: true }, h('summary', {}, 'Not similar ', h('span', { class: 'badge' }, '0')), pile);
  const status = h('span', { class: 'fine' });
  const save = h('button', { class: 'btn btn-xs btn-glow', type: 'button', disabled: true }, icon('check'), 'Save ranking');
  const reset = h('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Reset');
  let changed = false;
  const mark = () => { changed = true; save.disabled = false; status.textContent = 'Unsaved ranking'; renumber(); };
  const renumber = () => {
    [...list.children].forEach((li, i) => { li.querySelector('.rk-no').textContent = i + 1; });
    const n = pile.children.length;
    pileWrap.hidden = !n; pileWrap.querySelector('.badge').textContent = n;
  };
  const row = (s) => {
    const handle = h('button', { class: 'rk-handle', type: 'button', title: 'Drag to reorder (or focus and use ↑ ↓)', 'aria-label': `Move ${s.common || s.name}` }, '⋮⋮');
    const img = s.photo ? h('img', { class: 'rk-img', src: s.photo, alt: '', loading: 'lazy' }) : h('span', { class: 'rk-img' });
    const name = h('button', { class: 'sim-name', type: 'button', onclick: () => openTaxon(s.inat_id, `similar to ${taxon}`) }, h('b', {}, s.common || s.name), s.common ? h('i', {}, ` ${s.name}`) : '');
    spHover(img, s.inat_id); spHover(name, s.inat_id);
    const out = h('button', { class: 'ib rk-out', type: 'button', title: 'Not similar at all' }, icon('x'));
    const li = h('li', { class: 'rk-row' }, h('span', { class: 'rk-no mono' }), handle, img, h('div', { class: 'rk-txt' }, name, h('div', { class: 'sim-rel' }, relChips(s))), out);
    li.item = s;
    out.onclick = () => {
      if (li.parentNode === pile) { list.append(li); out.title = 'Not similar at all'; out.replaceChildren(icon('x')); }
      else { pile.append(li); out.title = 'Put back in the ranking'; out.replaceChildren(icon('undo')); }
      mark();
    };
    handle.addEventListener('keydown', (e) => {
      if (li.parentNode !== list) return;
      if (e.key === 'ArrowUp' && li.previousElementSibling) { li.previousElementSibling.before(li); mark(); handle.focus(); e.preventDefault(); }
      if (e.key === 'ArrowDown' && li.nextElementSibling) { li.nextElementSibling.after(li); mark(); handle.focus(); e.preventDefault(); }
      e.stopPropagation();
    });
    return li;
  };
  const fill = () => { list.innerHTML = ''; pile.innerHTML = ''; orig.forEach((s) => list.append(row(s))); renumber(); };
  fill();
  sortable(list, mark);
  reset.onclick = () => { fill(); changed = false; save.disabled = true; status.textContent = ''; };
  save.onclick = () => {
    const pick = (li) => ({ inat_id: li.item.inat_id, name: li.item.name, relations: li.item.relations });
    const ranking = { taxon, ranked: [...list.children].map(pick), not_similar: [...pile.children].map(pick) };
    save.disabled = true;
    sendFb({ kind: 'similarity-ranking', id: `rank:${taxon}`, name: taxon }, taxon, 'ranked', '',
      { original: JSON.stringify(orig.map((s) => ({ inat_id: s.inat_id, name: s.name }))), correction: JSON.stringify(ranking) })
      .then(() => { changed = false; status.textContent = 'Ranking saved'; toast('Ranking saved. Thank you!', 'ok'); const b = save.getBoundingClientRect(); burst(b.left + 40, b.top, 10); })
      .catch((e) => { save.disabled = false; toast(e.message, 'err'); });
  };
  const ta = taxonInput({ placeholder: 'Add a species to the ranking', onPick: (t) => {
    if ([...list.children, ...pile.children].some((li) => li.item.inat_id === t.inat_id)) { toast('Already in the list', '', 2000); ta.input.value = ''; return; }
    list.append(row({ ...t, kind: 'similar-new', id: `inat:${t.inat_id}`, relations: ['suggested by you'] }));
    mark(); ta.input.value = '';
  } });
  return [list, pileWrap, h('div', { class: 'sim-add' }, ta.el), h('div', { class: 'row gap rk-actions' }, status, reset, save)];
}

/** Pointer-driven reordering for an <ol> of .rk-row items with a .rk-handle (works with mouse and touch). */
function sortable(list, onChange) {
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.rk-handle');
    if (!handle || e.button > 0) return;
    const row = handle.closest('.rk-row');
    e.preventDefault();
    const r = row.getBoundingClientRect(), dy = e.clientY - r.top, scroller = list.closest('.sp-body');
    const ph = h('li', { class: 'rk-ph' }); ph.style.height = `${r.height}px`;
    row.before(ph);
    Object.assign(row.style, { position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, zIndex: 60, pointerEvents: 'none' });
    row.classList.add('dragging');
    let lastY = e.clientY, raf = 0;
    const place = (y) => {
      row.style.top = `${y - dy}px`;
      const rows = [...list.children].filter((x) => x !== row && x !== ph);
      const next = rows.find((x) => { const b = x.getBoundingClientRect(); return y < b.top + b.height / 2; });
      if (next) { if (ph.nextElementSibling !== next) next.before(ph); } else if (list.lastElementChild !== ph) list.append(ph);
    };
    const edge = () => {                                     // auto-scroll the panel near its edges
      if (!scroller) return;
      const b = scroller.getBoundingClientRect();
      const v = lastY < b.top + 40 ? -10 : lastY > b.bottom - 40 ? 10 : 0;
      if (v) { scroller.scrollTop += v; place(lastY); }
      raf = requestAnimationFrame(edge);
    };
    raf = requestAnimationFrame(edge);
    const move = (ev) => { lastY = ev.clientY; place(ev.clientY); };
    const up = () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      row.removeAttribute('style'); row.classList.remove('dragging');
      ph.replaceWith(row);
      onChange();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  });
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

// ------------------------------------------------------------------ taxon autocomplete (used by the editors)
function taxonInput({ placeholder, value = '', onPick }) {
  const input = h('input', { placeholder, value, autocomplete: 'off', maxlength: 200, 'aria-label': placeholder, role: 'combobox', 'aria-expanded': 'false' });
  // the list is attached to <body> with fixed positioning, so no scrolling / overflow:hidden parent can hide it
  const listEl = h('div', { class: 'ta-list glass', role: 'listbox' });
  const el = h('div', { class: 'ta-wrap' }, input);
  let seq = 0;
  const place = () => {
    const r = input.getBoundingClientRect(), below = innerHeight - r.bottom - 12, above = r.top - 12;
    const up = below < 220 && above > below;
    const max = Math.max(120, Math.min(320, up ? above : below));
    Object.assign(listEl.style, { left: `${r.left}px`, width: `${Math.max(r.width, 260)}px`, maxHeight: `${max}px` });
    if (up) { listEl.style.top = ''; listEl.style.bottom = `${innerHeight - r.top + 4}px`; } else { listEl.style.bottom = ''; listEl.style.top = `${r.bottom + 4}px`; }
  };
  const close = () => { listEl.remove(); input.setAttribute('aria-expanded', 'false'); removeEventListener('scroll', onScroll, true); removeEventListener('resize', place); };
  const onScroll = (e) => { if (!listEl.contains(e.target)) { if (input.isConnected) place(); else close(); } };
  const open = () => {
    if (!listEl.isConnected) { document.body.append(listEl); addEventListener('scroll', onScroll, true); addEventListener('resize', place); }
    input.setAttribute('aria-expanded', 'true'); place();
  };
  const run = debounce(async () => {
    const q = input.value.trim(), my = ++seq;
    if (q.length < 2) { close(); return; }
    const res = await api(`/api/species/search?q=${encodeURIComponent(q)}`).catch(() => []);
    if (my !== seq || document.activeElement !== input) return;
    listEl.innerHTML = '';
    res.slice(0, 8).forEach((t) => {
      const b = h('button', { class: 'sugg-item', type: 'button', role: 'option' }, t.photo ? h('img', { src: t.photo, alt: '' }) : h('span', { class: 'noimg' }),
        h('span', {}, h('b', {}, t.common || t.name), h('i', { class: 'muted' }, ` ${t.name}`), h('small', {}, ` ${t.rank}`)));
      spHover(b, t.inat_id);
      b.addEventListener('pointerdown', (e) => e.preventDefault());   // keep focus in the input until the click lands
      b.onclick = () => { input.value = t.name; close(); onPick?.(t); };
      listEl.append(b);
    });
    if (res.length) open(); else close();
  }, 250);
  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowDown' && listEl.isConnected) { listEl.querySelector('button')?.focus(); e.preventDefault(); }
    e.stopPropagation();
  });
  listEl.addEventListener('keydown', (e) => {
    const items = [...listEl.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { items[Math.min(i + 1, items.length - 1)]?.focus(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { (i > 0 ? items[i - 1] : input).focus(); e.preventDefault(); }
    if (e.key === 'Escape') { close(); input.focus(); }
    e.stopPropagation();
  });
  input.addEventListener('blur', () => setTimeout(() => { if (!listEl.contains(document.activeElement) && document.activeElement !== input) close(); }, 150));
  listEl.addEventListener('focusout', () => setTimeout(() => { if (!listEl.contains(document.activeElement) && document.activeElement !== input) close(); }, 150));
  return { el, input };
}

// ------------------------------------------------------------------ feedback widget
function sendFb(item, taxon, verdict, notes, extra = {}) {
  const env = SP.env, img = env.image();
  return api('/api/feedback', { body: { target: 'knowledge', image_id: img?.image_id, instance_id: SP.ctx?.inst?.id, verdict, notes,
    species: taxon, taxon, item: { ...item, relations: (item.relations || []).join('; ') }, role: env.mode(), contributor: env.contributor(), ...extra } });
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

// ------------------------------------------------------------------ lightbox (photos) and video studio (clips)
function initLightbox() {
  const lb = h('div', { class: 'lightbox', id: 'lightbox', hidden: true, role: 'dialog', 'aria-modal': 'true' },
    h('div', { class: 'lb-inner glass' }, h('button', { class: 'lb-close', 'aria-label': 'Close' }, icon('x')), h('div', { class: 'lb-media' }), h('div', { class: 'lb-meta' })));
  document.body.append(lb);
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lb-close')) closeLightbox(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLightbox(); });
}
function closeLightbox() {
  SP.dispose?.(); SP.dispose = null;
  const lb = $('#lightbox'); lb.hidden = true;
  lb.querySelector('.lb-media').innerHTML = ''; lb.querySelector('.lb-meta').innerHTML = '';
  lb.querySelector('.lb-inner').classList.remove('studio');
}
/** Open a photo in the viewer, or a clip in the video studio (used by the media and annotation pages too). */
export const showMedia = (item, taxon, prof) => lightbox(item, taxon, prof || null);
function lightbox(item, taxon, prof) {
  const lb = $('#lightbox'), inner = lb.querySelector('.lb-inner'), media = lb.querySelector('.lb-media'), meta = lb.querySelector('.lb-meta');
  media.innerHTML = ''; meta.innerHTML = '';
  inner.classList.toggle('studio', item.kind === 'video');
  if (item.kind === 'video') {
    const env = SP.env;
    SP.dispose = openVideoStudio(media, meta, item, {
      taxon, inatId: prof?.inat_id, imageId: env.image()?.image_id, instanceId: SP.ctx?.inst?.id, role: env.mode(), contributor: env.contributor(),
      keywords: SP.keywords, verdict: fb(item, taxon, { prompt: 'Does this clip show this species?' }), model: env.model(), modelLabel: env.modelLabel });
  } else {
    media.append(h('img', { src: item.full || item.thumb, alt: taxon }));
    meta.append(h('div', { class: 'lb-title' }, item.title || taxon || ''),
      h('div', { class: 'fine' }, [item.attribution, item.license, item.place, item.date].filter(Boolean).join(' · '),
        item.page ? [' · ', h('a', { href: item.page, target: '_blank', rel: 'noopener' }, 'source ↗')] : ''),
      item.id ? fb(item, taxon, { prompt: 'Does this really show this species?' }) : '');
  }
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
      spHover(b, t.inat_id);
      b.onclick = () => {
        hideSuggest(); $('#spSearch').value = '';
        const r = SP.ctx?.inst;
        openTaxon(t.inat_id, r ? 'your search' : '', { root: true });
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
