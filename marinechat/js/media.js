// Species media page (#/media?taxon=<inat id>&tab=photos|short|long): every photo and clip of one species,
// with a filter per source. Short clips open the video studio; long videos can become annotation projects.
import { $, h, icon, api, toast } from './util.js';
import { feedbackBar } from './feedback.js';
import { hoverCard, infoCard } from './hovercard.js';
import { contributorPayload } from './profile.js';
import { showMedia } from './species.js';

export const LONG_MIN_S = 180;
const topSource = (s) => (s || 'iNaturalist').split(' · ')[0];
const fmtDur = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(Math.round(s % 60)).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`);

export async function renderMedia(root, params) {
  const inat = +params.get('taxon');
  let tab = params.get('tab') || 'photos';
  root.innerHTML = '';
  if (!inat) { root.append(h('p', { class: 'muted pad' }, 'No species selected.')); return; }
  const wrap = h('div', { class: 'page-inner wide' }, h('div', { class: 'sp-skel' }, h('div', { class: 'sk-hero' }), h('div', { class: 'sk-lines' }, h('div', { class: 'shimmer-line' }), h('div', { class: 'shimmer-line short' }))));
  root.append(wrap);
  let prof, media;
  try { [prof, media] = await Promise.all([api(`/api/species/${inat}`), api(`/api/species/${inat}/media`)]); } catch (e) { wrap.innerHTML = ''; wrap.append(h('p', { class: 'err' }, e.message)); return; }
  const short = media.videos.filter((v) => !(v.duration > LONG_MIN_S)), long = media.videos.filter((v) => v.duration > LONG_MIN_S);
  const T = prof.name;
  const tabs = [['photos', 'Photos', media.photos.length, 'image'], ['short', 'Short clips', short.length, 'play'], ['long', 'Long videos', long.length, 'layers']];
  const tabBar = h('div', { class: 'mp-tabs', role: 'tablist' });
  const body = h('div', { class: 'mp-body' });
  const show = (k) => {
    tab = k;
    tabBar.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b.dataset.k === k); b.setAttribute('aria-selected', String(b.dataset.k === k)); });
    history.replaceState(null, '', `#/media?taxon=${inat}&tab=${k}`);
    body.innerHTML = '';
    if (k === 'photos') body.append(...photosPane(media.photos, T, prof));
    else if (k === 'short') body.append(...shortPane(short, T, prof));
    else body.append(...longPane(long, T, prof));
  };
  tabs.forEach(([k, label, n, ico]) => tabBar.append(h('button', { type: 'button', role: 'tab', 'data-k': k, onclick: () => show(k) }, icon(ico), label, h('span', { class: 'badge' }, String(n)))));
  wrap.innerHTML = '';
  wrap.append(
    h('a', { class: 'link mp-back', href: '#/explore' }, '← Back to Explore'),
    h('header', { class: 'mp-head' },
      prof.photo ? h('img', { class: 'mp-hero', src: prof.photo, alt: '' }) : '',
      h('div', {}, h('p', { class: 'eyebrow' }, 'Species media'), h('h1', {}, prof.common || prof.name), h('p', { class: 'muted' }, h('i', {}, prof.name),
        ` · ${media.photos.length} photos and ${media.videos.length} clips, openly licensed, from ${Object.keys(media.photo_sources || {}).map(topSource).filter((v, i, a) => a.indexOf(v) === i).length + (media.video_sources || []).length} sources`)),
      h('div', { class: 'mp-head-act' }, h('a', { class: 'btn btn-ghost btn-sm', href: `#/annotate/short?taxon=${inat}` }, icon('play'), 'Tag these clips'),
        h('a', { class: 'btn btn-ghost btn-sm', href: `#/annotate/images/species-${inat}` }, icon('check'), 'Verify these photos'))),
    tabBar, body);
  show(tabs.some(([k]) => k === tab) ? tab : 'photos');
}

function filterBar(items, onPick) {
  const c = {};
  items.forEach((x) => { const k = topSource(x.source); c[k] = (c[k] || 0) + 1; });
  const bar = h('div', { class: 'fv-filters' });
  [['', `All ${items.length}`], ...Object.entries(c).map(([k, n]) => [k, `${k} ${n}`])].forEach(([k, label], i) => {
    const b = h('button', { class: `sugg ${i ? '' : 'on'}`, type: 'button' }, label);
    b.onclick = () => { bar.querySelectorAll('.sugg').forEach((x) => x.classList.remove('on')); b.classList.add('on'); onPick(k); };
    bar.append(b);
  });
  return bar;
}

function verdict(item, taxon, prompt) {
  return feedbackBar({ key: `k:${item.id}:${taxon}`, compact: true, noComment: true, question: prompt,
    payload: () => ({ target: 'knowledge', species: taxon, taxon, item: { kind: item.kind, id: item.id, title: item.title || '', page: item.page || '', src: item.src || '', thumb: item.thumb || '', source: item.source || '' },
      role: 'media page', contributor: contributorPayload() }) });
}

function photosPane(photos, taxon) {
  if (!photos.length) return [h('p', { class: 'muted' }, 'No openly licensed photos found.')];
  const grid = h('div', { class: 'fv-grid photo' });
  const render = (src) => {
    grid.innerHTML = '';
    photos.filter((p) => !src || topSource(p.source) === src).forEach((p) => {
      const img = h('img', { src: p.thumb, alt: p.title || taxon, loading: 'lazy', onclick: () => showMedia(p, taxon) });
      grid.append(h('div', { class: 'ph big' }, img, h('div', { class: 'ph-cap' }, h('b', {}, topSource(p.source)), ` ${[p.attribution, p.license].filter(Boolean).join(' · ')}`),
        h('div', { class: 'ph-fb' }, verdict(p, taxon, ''))));
    });
  };
  render('');
  return [filterBar(photos, render), grid];
}

function clipCard(v, taxon, prof, extra) {
  const thumb = h('button', { class: 'vid-thumb', onclick: () => showMedia(v, taxon, prof) },
    v.poster ? h('img', { src: v.poster, alt: v.title, loading: 'lazy' }) : h('div', { class: 'vid-ph' }),
    h('span', { class: 'play' }, icon('play')), v.duration ? h('span', { class: 'dur' }, fmtDur(v.duration)) : '',
    h('span', { class: `prov ${v.provider}` }, topSource(v.source)));
  hoverCard(thumb, () => infoCard({ img: v.poster, title: v.title, wide: true, lines: [v.description ? `${v.description.slice(0, 220)}…` : '', [v.license, v.attribution].filter(Boolean).join(' · ')] }));
  return h('div', { class: 'vid big' }, thumb, h('div', { class: 'vid-title', title: v.title }, v.title),
    v.related ? h('div', { class: 'fine vid-rel' }, `Related species · ${v.related}`) : '',
    h('p', { class: 'fine vid-desc' }, v.description || [v.license, v.attribution].filter(Boolean).join(' · ')), extra || verdict(v, taxon, 'Shows this species?'));
}

function shortPane(clips, taxon, prof) {
  if (!clips.length) return [h('p', { class: 'muted' }, 'No short clips found for this species yet.')];
  const grid = h('div', { class: 'fv-grid video' });
  const render = (src) => { grid.innerHTML = ''; clips.filter((v) => !src || topSource(v.source) === src).forEach((v) => grid.append(clipCard(v, taxon, prof))); };
  render('');
  return [h('p', { class: 'fine' }, `Clips up to ${LONG_MIN_S / 60} minutes. Click one to caption it and tag keyframes, or `, h('a', { href: `#/annotate/short?taxon=${prof.inat_id}` }, 'tag them one after another in the clip feed'), '.'),
    filterBar(clips, render), grid];
}

function longPane(videos, taxon, prof) {
  const out = [h('p', { class: 'fine' }, `Videos longer than ${LONG_MIN_S / 60} minutes are annotated as projects: the video is divided into event segments that several people annotate and review. `,
    h('a', { href: '#/annotate/long' }, 'See all long-video projects'), '.')];
  if (!videos.length) { out.push(h('p', { class: 'muted' }, 'No long videos found for this species yet. You can import one on the projects page.')); return out; }
  const grid = h('div', { class: 'fv-grid video' });
  videos.forEach((v) => {
    const b = h('button', { class: 'btn btn-xs btn-glow', type: 'button' }, icon('layers'), 'Annotate as a project');
    b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await api('/api/projects', { body: { url: v.src.replace(/^https?:\/\/[^/]+(?=\/api\/)/, ''), title: v.title, page: v.page, license: v.license, attribution: v.attribution,
          taxon, inat_id: prof.inat_id, contributor: contributorPayload() } });
        location.hash = `#/annotate/long/${r.id}`;
      } catch (e) { b.disabled = false; toast(e.message, 'err'); }
    };
    grid.append(clipCard(v, taxon, prof, h('div', { class: 'row gap' }, b)));
  });
  out.push(grid);
  return out;
}
