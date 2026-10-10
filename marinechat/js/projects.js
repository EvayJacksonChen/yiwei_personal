// Long-video projects: a GitHub / Hugging Face style list, and the project workspace where a long video is divided
// into event segments that people claim, annotate and review together. Progress = reviewed + half of done.
import { h, icon, api, apiUrl, toast, burst, streamText } from './util.js';
import { contributorPayload, profile } from './profile.js';
import { splitModel, parseDescribe } from './videostudio.js';
import { leaderBoard } from './boards.js';

const fmt = (t) => (t == null ? '–' : t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
  : `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`);
const ago = (ts) => { const s = Date.now() / 1000 - ts; return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`; };
const CUT = { start: 'start of the video', 'scene cut': 'after a scene cut', 'visual change': 'after a visual change (BioCLIP-2)', 'max length': 'split at the 45 s limit' };
const STATUS = { todo: 'To do', claimed: 'In progress', done: 'Needs review', 'needs-work': 'Needs work', reviewed: 'Reviewed' };
let timers = [];
export const stopProjectTimers = () => { timers.forEach(clearInterval); timers = []; };

function progressBar(pg, big = false) {
  const w = (n) => `${pg.total ? (100 * n / pg.total).toFixed(2) : 0}%`;
  return h('div', { class: `pj-bar ${big ? 'big' : ''}`, title: `${pg.reviewed} reviewed · ${pg.done} need review · ${pg.needs_work} need work · ${pg.claimed} in progress · ${pg.todo} to do` },
    h('i', { class: 'rv', style: `width:${w(pg.reviewed)}` }), h('i', { class: 'dn', style: `width:${w(pg.done)}` }),
    h('i', { class: 'nw', style: `width:${w(pg.needs_work)}` }), h('i', { class: 'cl', style: `width:${w(pg.claimed)}` }));
}
const avatars = (people, max = 5) => h('span', { class: 'pj-avs' }, people.slice(0, max).map((p) => h('span', { class: 'pj-av', title: `${p.name}${p.affiliation ? ' · ' + p.affiliation : ''}` }, (p.name || '?').slice(0, 1).toUpperCase())));

// ====================================================================== list
export async function renderProjects(root) {
  stopProjectTimers();
  const list = h('div', { class: 'pj-list' }, h('div', { class: 'shimmer-line' }), h('div', { class: 'shimmer-line short' }));
  const search = h('input', { id: 'pjSearch', placeholder: 'Filter projects', autocomplete: 'off' });
  const sort = h('select', { id: 'pjSort', 'aria-label': 'Sort projects' }, [['active', 'Recently active'], ['least', 'Least complete'], ['most', 'Most complete'], ['long', 'Longest']].map(([v, l]) => h('option', { value: v }, l)));
  const newBtn = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, icon('plus'), 'New project');
  const form = newProjectForm();
  form.hidden = true;
  newBtn.onclick = () => { form.hidden = !form.hidden; };
  const side = h('aside', { class: 'pj-side' }, leaderBoard('long', { title: 'Long-video board', limit: 10 }));
  root.append(h('div', { class: 'pj-page' },
    h('div', { class: 'pj-main' },
      h('div', { class: 'pj-toolbar' }, search, sort, newBtn), form, list), side));
  let data = [];
  const draw = () => {
    const f = search.value.trim().toLowerCase();
    let rows = data.filter((p) => !f || `${p.title} ${p.taxon} ${p.owner}`.toLowerCase().includes(f));
    const key = { active: (p) => -p.last_activity, least: (p) => p.progress.pct, most: (p) => -p.progress.pct, long: (p) => -(p.duration || 0) }[sort.value];
    rows = rows.sort((a, b) => key(a) - key(b));
    list.innerHTML = '';
    if (!rows.length) list.append(h('p', { class: 'muted pad' }, data.length ? 'No project matches.' : 'No projects yet. Import a long video with "New project".'));
    rows.forEach((p) => list.append(projectRow(p)));
  };
  search.oninput = draw; sort.onchange = draw;
  const load = async () => {
    try { data = (await api('/api/projects')).projects; draw(); } catch (e) { list.innerHTML = ''; list.append(h('p', { class: 'err' }, e.message)); }
  };
  await load();
  timers.push(setInterval(() => { if (data.some((p) => p.status !== 'ready' && p.status !== 'error')) load(); }, 5000));
}

function projectRow(p) {
  const pg = p.progress, busy = p.status !== 'ready';
  return h('a', { class: 'pj-row', href: `#/annotate/long/${p.id}` },
    h('div', { class: 'pj-thumb' }, !busy ? h('img', { src: p.thumb, alt: '', loading: 'lazy' }) : h('span', { class: 'pj-proc' }, icon('layers')), p.duration ? h('span', { class: 'dur' }, fmt(p.duration)) : ''),
    h('div', { class: 'pj-info' },
      h('div', { class: 'pj-title' }, h('span', { class: 'muted' }, `${p.owner} / `), h('b', {}, p.title)),
      h('div', { class: 'pj-tags' }, p.taxon ? h('span', { class: 'pill ok' }, p.taxon) : '', p.license ? h('span', { class: 'pill' }, p.license) : '',
        h('span', { class: 'pill' }, `${pg.total} segments`), p.status === 'error' ? h('span', { class: 'pill warn' }, 'failed') : ''),
      busy ? h('div', { class: 'pj-stage' }, h('span', { class: 'fine' }, p.status === 'error' ? `Failed: ${p.error}` : `Preparing: ${p.stage}`),
        p.status !== 'error' ? h('div', { class: 'ln-bar' }, h('i', { style: `width:${p.pct || 0}%` })) : '')
        : h('div', { class: 'fine' }, `Updated ${ago(p.last_activity)}${p.attribution ? ' · ' + p.attribution : ''}`)),
    h('div', { class: 'pj-stats' },
      busy ? '' : [progressBar(pg), h('div', { class: 'fine' }, h('b', {}, `${pg.pct}%`), ` · ${pg.reviewed} reviewed · ${pg.done} to review`)],
      h('div', { class: 'pj-people' }, avatars(p.contributors), h('span', { class: 'fine' }, p.n_contributors ? `${p.n_contributors} contributor${p.n_contributors > 1 ? 's' : ''}` : 'Be the first'))));
}

function newProjectForm() {
  const url = h('input', { id: 'pjUrl', placeholder: 'https://archive.org/details/…  or a Wikimedia Commons video page', autocomplete: 'off' });
  const taxon = h('input', { id: 'pjTaxon', placeholder: 'Main species or topic (optional)' });
  const go = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, 'Import');
  const file = h('input', { id: 'pjFile', type: 'file', accept: 'video/*' });
  const title = h('input', { id: 'pjTitle', placeholder: 'Title' });
  const lic = h('select', { id: 'pjLic' }, ['CC-BY-4.0', 'CC-BY-NC-4.0', 'CC0', 'All rights reserved (annotation only)'].map((l) => h('option', {}, l)));
  const consent = h('input', { id: 'pjConsent', type: 'checkbox' });
  const up = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, icon('upload'), 'Upload');
  const prog = h('div', { class: 'ln-bar', hidden: true }, h('i'));
  go.onclick = async () => {
    if (!url.value.trim()) return url.focus();
    go.disabled = true;
    try {
      const r = await api('/api/projects', { body: { url: url.value.trim(), taxon: taxon.value.trim(), contributor: contributorPayload() } });
      location.hash = `#/annotate/long/${r.id}`;
    } catch (e) { toast(e.message, 'err'); } finally { go.disabled = false; }
  };
  up.onclick = () => {
    if (!file.files[0]) return file.click();
    if (!consent.checked) return toast('Please confirm you may share this video for annotation', 'err');
    const fd = new FormData();
    fd.append('file', file.files[0]);
    fd.append('meta', JSON.stringify({ consent: true, title: title.value || file.files[0].name, license: lic.value, taxon: taxon.value, contributor: contributorPayload() }));
    const xhr = new XMLHttpRequest();
    prog.hidden = false; up.disabled = true;
    xhr.upload.onprogress = (e) => { prog.firstChild.style.width = `${(100 * e.loaded / e.total).toFixed(1)}%`; };
    xhr.onload = () => {
      up.disabled = false;
      try { const r = JSON.parse(xhr.responseText); if (xhr.status >= 400) throw new Error(r.error || 'upload failed'); location.hash = `#/annotate/long/${r.id}`; } catch (e) { toast(e.message, 'err'); }
    };
    xhr.onerror = () => { up.disabled = false; toast('Upload failed', 'err'); };
    xhr.open('POST', apiUrl('/api/projects/upload')); xhr.send(fd);
  };
  return h('div', { class: 'pj-new glass' },
    h('b', {}, 'Import a long video'), h('p', { class: 'fine' }, 'Paste an Internet Archive or Wikimedia Commons link (openly licensed), or upload your own video. It is converted, divided into event segments and opened for annotation.'),
    h('div', { class: 'row gap' }, url, go), taxon,
    h('details', {}, h('summary', {}, 'Or upload a video file'), h('div', { class: 'pj-up' }, file, title, lic,
      h('label', { class: 'check' }, consent, h('span', {}, 'I may share this video so the MarineChat community can annotate it for research and education.')), up, prog)));
}

// ====================================================================== workspace
export async function renderProject(root, pid) {
  stopProjectTimers();
  const me = profile().uid;
  let P = null, sel = null, filter = 'all', panelKey = '';
  const video = h('video', { controls: true, playsinline: true, preload: 'metadata' });
  const timeline = h('div', { class: 'pj-timeline', role: 'list' });
  const head = h('div', { class: 'pj-head' });
  const panel = h('div', { class: 'pj-panel glass' });
  const segList = h('div', { class: 'pj-seglist' });
  const filters = h('div', { class: 'fv-filters' });
  const people = h('div', { class: 'pj-contribs' });
  root.append(h('div', { class: 'pj-work' },
    head,
    h('div', { class: 'pj-cols' },
      h('div', { class: 'pj-left' }, h('div', { class: 'pj-player' }, video), timeline, panel),
      h('div', { class: 'pj-right glass' }, h('div', { class: 'pj-right-head' }, h('b', {}, 'Segments'), filters), segList, h('b', { class: 'pj-sub' }, 'Contributors'), people))));

  // loop the selected segment
  video.addEventListener('timeupdate', () => {
    const s = P?.segments.find((x) => x.id === sel);
    if (s && video.currentTime > s.t1 + 0.05) video.currentTime = s.t0;
    timeline.style.setProperty('--now', `${(100 * video.currentTime / (P?.project.duration || 1)).toFixed(3)}%`);
  });

  const load = async (keepScroll = true) => {
    let d;
    try { d = await api(`/api/projects/${pid}`); } catch (e) { head.replaceChildren(h('p', { class: 'err' }, e.message)); return; }
    const first = !P;
    P = d;
    drawHead();
    if (d.project.status !== 'ready') { panel.replaceChildren(h('p', { class: 'fine' }, d.project.status === 'error' ? `Preparing failed: ${d.project.error}` : 'The video is being prepared. Segments appear here when it is done.')); return; }
    if (first) { video.poster = apiUrl(`/api/projects/${pid}/thumb/${Math.floor(d.segments.length / 2)}`); video.src = apiUrl(d.video); }
    drawTimeline(); drawFilters(); drawList(keepScroll); drawPeople();
    if (sel == null) { const s = d.segments.find((x) => x.status === 'todo' || x.status === 'needs-work') || d.segments[0]; if (s) select(s.id, false); }
    else drawPanel();
  };

  function drawHead() {
    const p = P.project, pg = p.progress;
    head.replaceChildren(
      h('a', { class: 'link mp-back', href: '#/annotate/long' }, '← All projects'),
      h('div', { class: 'pj-head-row' },
        h('div', {}, h('div', { class: 'pj-title big' }, h('span', { class: 'muted' }, `${p.owner} / `), h('b', {}, p.title)),
          h('div', { class: 'pj-tags' }, p.taxon ? h('span', { class: 'pill ok' }, p.taxon) : '', p.license ? h('span', { class: 'pill' }, p.license) : '',
            p.duration ? h('span', { class: 'pill' }, fmt(p.duration)) : '', h('span', { class: 'pill' }, `${pg.total} segments`),
            p.page ? h('a', { class: 'btn btn-ghost btn-xs', href: p.page, target: '_blank', rel: 'noopener' }, 'Source ↗') : ''),
          p.status === 'ready' ? h('p', { class: 'fine' }, p.stage) : h('div', { class: 'pj-stage' }, h('span', { class: 'fine' }, p.stage), h('div', { class: 'ln-bar' }, h('i', { style: `width:${p.pct || 0}%` })))),
        h('div', { class: 'pj-head-prog' }, h('div', { class: 'pj-pct' }, `${pg.pct}%`), progressBar(pg, true),
          h('div', { class: 'pj-legend fine' }, ...[['rv', 'reviewed', pg.reviewed], ['dn', 'to review', pg.done], ['nw', 'needs work', pg.needs_work], ['cl', 'in progress', pg.claimed], ['td', 'to do', pg.todo]]
            .map(([c, l, n]) => h('span', {}, h('i', { class: c }), `${n} ${l}`))),
          p.status === 'ready' ? h('button', { class: 'btn btn-xs btn-ghost', type: 'button', title: 'Let the model write a draft caption and keywords for every segment that has none', onclick: draftAll }, icon('spark'), 'AI drafts for all segments') : '')));
  }
  async function draftAll(e) {
    e.currentTarget.disabled = true;
    try { await api(`/api/projects/${pid}/draft-all`, { body: { model: window.MC_MODEL?.() } }); toast('Drafting in the background; drafts appear as they are written.', 'ok', 3500); } catch (er) { toast(er.message, 'err'); }
  }

  function drawTimeline() {
    const dur = P.project.duration || 1;
    timeline.replaceChildren(...P.segments.map((s) => h('button', { class: `pj-seg st-${s.status} ${s.id === sel ? 'sel' : ''}`, type: 'button', role: 'listitem',
      style: `left:${(100 * s.t0 / dur).toFixed(3)}%;width:${(100 * (s.t1 - s.t0) / dur).toFixed(3)}%`, title: `#${s.idx + 1} · ${fmt(s.t0)}–${fmt(s.t1)} · ${STATUS[s.status]}`, onclick: () => select(s.id) })), h('i', { class: 'pj-now' }));
  }
  function drawFilters() {
    const c = { all: P.segments.length };
    P.segments.forEach((s) => { c[s.status] = (c[s.status] || 0) + 1; });
    filters.replaceChildren(...[['all', 'All'], ['todo', 'To do'], ['done', 'Needs review'], ['needs-work', 'Needs work'], ['reviewed', 'Reviewed']].filter(([k]) => k === 'all' || c[k])
      .map(([k, l]) => h('button', { class: `sugg ${filter === k ? 'on' : ''}`, type: 'button', onclick: () => { filter = k; drawFilters(); drawList(false); } }, `${l} ${c[k] || 0}`)));
  }
  function drawList(keepScroll) {
    const top = segList.scrollTop;
    segList.replaceChildren(...P.segments.filter((s) => filter === 'all' || s.status === filter).map((s) => {
      const last = [...s.history].reverse().find((a) => a.kind === 'annotation');
      return h('button', { class: `pj-li ${s.id === sel ? 'sel' : ''}`, type: 'button', onclick: () => select(s.id), 'data-id': s.id },
        h('img', { src: apiUrl(`/api/projects/${pid}/thumb/${s.idx}`), alt: '', loading: 'lazy' }),
        h('span', { class: 'pj-li-txt' }, h('b', {}, `#${s.idx + 1} `), h('span', { class: 'mono fine' }, `${fmt(s.t0)}–${fmt(s.t1)}`),
          h('span', { class: 'pj-li-cap' }, last?.caption || s.ai_caption || h('i', { class: 'muted' }, s.cut))),
        h('span', { class: `pj-st st-${s.status}` }, STATUS[s.status]));
    }));
    if (keepScroll) segList.scrollTop = top;
  }
  function drawPeople() {
    people.replaceChildren(...(P.contributors.length ? P.contributors.map((c) => h('div', { class: 'pj-person' }, avatars([c], 1), h('span', {}, c.name, c.affiliation ? h('small', { class: 'muted' }, ` · ${c.affiliation}`) : ''),
      h('span', { class: 'fine' }, `${c.annotations} annotated · ${c.reviews} reviewed`))) : [h('p', { class: 'fine' }, 'Nobody yet: claim a segment to start.')]));
  }

  function select(id, seek = true) {
    sel = id;
    const s = P.segments.find((x) => x.id === id);
    if (seek && s) { video.currentTime = s.t0; video.play().catch(() => {}); }
    drawTimeline(); drawList(true); drawPanel(true);
    segList.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest' });
  }

  function drawPanel(force = false) {
    const s = P.segments.find((x) => x.id === sel);
    if (!s) return;
    // redraw only when this segment changed, so a half-written annotation is never wiped by the refresh
    const key = `${s.id}:${s.status}:${s.claimed_by}:${s.history.length}:${s.status === 'claimed' && s.claimed_by === me ? '' : s.ai_caption}`;
    if (!force && key === panelKey) return;
    panelKey = key;
    const anns = s.history.filter((a) => a.kind === 'annotation'), last = anns[anns.length - 1];
    const reviews = s.history.filter((a) => a.kind === 'review'), lastRev = reviews[reviews.length - 1];
    const mineClaim = s.status === 'claimed' && s.claimed_by === me;
    const top = h('div', { class: 'pj-panel-head' },
      h('b', {}, `Segment #${s.idx + 1}`), h('span', { class: 'mono fine' }, `${fmt(s.t0)} – ${fmt(s.t1)} · ${(s.t1 - s.t0).toFixed(1)} s · ${CUT[s.cut] || s.cut}`),
      h('span', { class: `pj-st st-${s.status}` }, STATUS[s.status]),
      h('span', { class: 'grow' }),
      h('button', { class: 'ib', type: 'button', title: 'Previous segment', onclick: () => step(-1) }, '‹'), h('button', { class: 'ib', type: 'button', title: 'Next segment', onclick: () => step(1) }, '›'));
    const kids = [top];
    if (last) kids.push(h('div', { class: 'pj-ann' }, h('div', { class: 'fine' }, `Annotated by ${last.who} · ${ago(last.created)}`), h('p', {}, last.caption),
      last.keywords.length ? h('div', { class: 'vs-sugg' }, last.keywords.map((k) => h('span', { class: 'sugg' }, k))) : '', last.species ? h('div', { class: 'fine' }, `Species: ${last.species}`) : '',
      lastRev ? h('div', { class: `fine pj-rev ${lastRev.verdict}` }, `${lastRev.verdict === 'approve' ? 'Approved' : 'Needs work'} by ${lastRev.who}${lastRev.notes ? ': ' + lastRev.notes : ''}`) : ''));
    if (s.status === 'claimed' && !mineClaim) kids.push(h('p', { class: 'fine' }, `${s.claimed_name || 'Someone'} is annotating this segment right now. Pick another one, or come back in a while.`));
    else if (mineClaim) kids.push(annotateForm(s, last));
    else if (s.status === 'done' || s.status === 'reviewed') {
      if (last && last.uid !== me) kids.push(reviewForm(s));
      else if (last) kids.push(h('p', { class: 'fine' }, 'Waiting for someone else to review your annotation.'));
      kids.push(h('button', { class: 'btn btn-xs btn-ghost', type: 'button', onclick: () => claim(s) }, icon('edit'), 'Annotate again'));
    } else kids.push(h('div', { class: 'row gap' }, h('button', { class: 'btn btn-sm btn-glow', type: 'button', onclick: () => claim(s) }, icon('edit'), s.status === 'needs-work' ? 'Fix this segment' : 'Start annotating'),
      h('span', { class: 'fine' }, 'Claiming keeps others off this segment for 30 minutes.')));
    panel.replaceChildren(...kids);
  }
  const step = (d) => { const i = P.segments.findIndex((x) => x.id === sel); const s = P.segments[i + d]; if (s) select(s.id); };

  async function claim(s) {
    try { await api(`/api/projects/${pid}/segments/${s.id}/claim`, { body: { contributor: contributorPayload() } }); await load(); } catch (e) { toast(e.message, 'err'); await load(); }
  }

  function annotateForm(s, last) {
    const cap = h('textarea', { id: 'pjCaption', rows: 3, maxlength: 2000, placeholder: 'What happens in this segment? Animals, behaviour, habitat, equipment…' });
    cap.value = last?.caption || '';
    const kws = new Set(last?.keywords || []);
    const chips = h('div', { class: 'vs-sugg pj-kws' });
    const kw = h('input', { id: 'pjKeyword', maxlength: 60, placeholder: 'Add a keyword and press Enter' });
    const sp = h('input', { id: 'pjSpecies', maxlength: 160, placeholder: 'Species or taxa seen (optional)', value: last?.species || '' });
    const notes = h('input', { id: 'pjNotes', maxlength: 1000, placeholder: 'Notes for reviewers (optional)' });
    const drawChips = () => chips.replaceChildren(...[...kws].map((k) => h('button', { class: 'sugg on', type: 'button', title: 'Remove', onclick: () => { kws.delete(k); drawChips(); } }, k, ' ×')));
    drawChips();
    kw.addEventListener('keydown', (e) => { if (e.key === 'Enter' && kw.value.trim()) { kws.add(kw.value.trim()); kw.value = ''; drawChips(); } e.stopPropagation(); });
    [cap, sp, notes].forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    // AI draft as a reference
    const ai = h('div', { class: 'vs-ref ai' });
    const showAi = (c, k, model) => ai.replaceChildren(h('div', { class: 'vs-ref-head' }, h('span', { class: 'fine' }, icon('spark'), ` AI draft${model ? ' · ' + model : ''}`),
      h('span', { class: 'row gap' }, h('button', { class: 'link', type: 'button', onclick: runDraft }, 'Redo'), h('button', { class: 'link', type: 'button', onclick: () => { cap.value = c; k.forEach((x) => kws.add(x)); drawChips(); } }, 'Use this'))),
      h('p', { class: 'vs-ref-text' }, c || '…'), k.length ? h('div', { class: 'vs-sugg' }, k.map((x) => h('button', { class: 'sugg ai', type: 'button', onclick: () => { kws.add(x); drawChips(); } }, icon('spark'), x))) : '');
    async function runDraft() {
      ai.replaceChildren(h('p', { class: 'fine' }, 'Asking the model about this segment… (it may need to load first)'));
      try {
        const out = await streamText(`/api/projects/${pid}/segments/${s.id}/draft`, { model: window.MC_MODEL?.() }, (t) => { const r = parseDescribe(splitModel(t).text); ai.replaceChildren(h('p', { class: 'vs-ref-text' }, r.caption || '…')); });
        const r = parseDescribe(splitModel(out).text);
        s.ai_caption = r.caption; s.ai_keywords = r.keywords;
        showAi(r.caption, r.keywords, '');
      } catch (e) { ai.replaceChildren(h('p', { class: 'fine err' }, e.message)); }
    }
    if (s.ai_caption) showAi(s.ai_caption, s.ai_keywords || [], s.ai_model); else ai.replaceChildren(h('button', { class: 'btn btn-xs btn-ghost', type: 'button', onclick: runDraft }, icon('spark'), 'Draft with AI'));
    const submit = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, icon('check'), 'Submit for review');
    submit.onclick = async () => {
      if (kw.value.trim()) { kws.add(kw.value.trim()); kw.value = ''; }
      submit.disabled = true;
      try {
        await api(`/api/projects/${pid}/segments/${s.id}/annotate`, { body: { caption: cap.value, keywords: [...kws], species: sp.value, notes: notes.value, contributor: contributorPayload() } });
        toast('Segment submitted: +5 points', 'ok');
        const b = submit.getBoundingClientRect(); burst(b.left + 60, b.top, 14);
        await load();
        const next = P.segments.find((x) => x.idx > s.idx && (x.status === 'todo' || x.status === 'needs-work'));
        if (next) select(next.id);
      } catch (e) { submit.disabled = false; toast(e.message, 'err'); }
    };
    return h('div', { class: 'pj-form' }, h('label', { class: 'vs-label', for: 'pjCaption' }, 'Caption'), cap, ai,
      h('div', { class: 'vs-label' }, 'Keywords'), chips, kw, sp, notes, h('div', { class: 'row gap' }, h('span', { class: 'fine grow' }, 'Another person reviews it next.'), submit));
  }

  function reviewForm(s) {
    const notes = h('input', { id: 'pjRevNotes', maxlength: 1000, placeholder: 'What should change? (for "Needs work")' });
    notes.addEventListener('keydown', (e) => e.stopPropagation());
    const send = async (verdict, btn) => {
      btn.disabled = true;
      try {
        await api(`/api/projects/${pid}/segments/${s.id}/review`, { body: { verdict, notes: notes.value, contributor: contributorPayload() } });
        toast(verdict === 'approve' ? 'Approved: +3 points' : 'Sent back with your notes: +3 points', 'ok');
        await load();
      } catch (e) { btn.disabled = false; toast(e.message, 'err'); }
    };
    const ok = h('button', { class: 'btn btn-sm btn-glow', type: 'button' }, icon('check'), 'Approve');
    const bad = h('button', { class: 'btn btn-sm btn-ghost', type: 'button' }, icon('x'), 'Needs work');
    ok.onclick = () => send('approve', ok); bad.onclick = () => send('needs-work', bad);
    return h('div', { class: 'pj-form' }, h('div', { class: 'vs-label' }, 'Review'), notes, h('div', { class: 'row gap' }, ok, bad));
  }

  await load(false);
  timers.push(setInterval(() => { if (document.activeElement?.matches?.('.pj-form input, .pj-form textarea')) return; load(); }, 8000));   // see others' work (not while typing)
}
