// Hover cards: a small floating preview (photo, names, bio-traits ...) for species names, photos, clips and instances.
// One shared card element; content comes from a sync or async loader and is cached per key.
import { h, api } from './util.js';

const NO_HOVER = matchMedia('(hover: none)').matches;
const cache = new Map();
let card = null, timer = null, owner = null;

function el() {
  if (!card) {
    card = h('div', { class: 'hovercard glass', role: 'tooltip', hidden: true });
    document.body.append(card);
    // close on any click or user scroll, and when the hovered element is re-rendered away (no pointerleave then)
    const hideAll = () => { clearTimeout(timer); owner = null; card.hidden = true; };
    addEventListener('pointerdown', hideAll, true);
    addEventListener('wheel', hideAll, { capture: true, passive: true });
    addEventListener('touchmove', hideAll, { capture: true, passive: true });
    setInterval(() => { if (!card.hidden && owner && !owner.isConnected) hideAll(); }, 400);
  }
  return card;
}

/**
 * Show `loader()` (Node | Promise<Node>) next to `target` while it is hovered or focused.
 * key: cache key for async content (optional).
 */
export function hoverCard(target, loader, key = null) {
  if (NO_HOVER || !target) return target;
  const show = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      owner = target;
      const c = el();
      c.innerHTML = ''; c.classList.add('loading'); c.hidden = false;
      c.append(h('div', { class: 'hc-loading' }, h('i'), h('i'), h('i')));
      place(c, target);
      try {
        let node = key && cache.get(key);
        if (!node) { node = await loader(); if (key && node) cache.set(key, node); }
        if (owner !== target) return;
        c.innerHTML = ''; c.classList.remove('loading');
        if (!node) { c.hidden = true; return; }
        c.append(node.cloneNode(true));
        place(c, target);
      } catch { if (owner === target) c.hidden = true; }
    }, 320);
  };
  const hide = () => { clearTimeout(timer); if (owner === target) { owner = null; el().hidden = true; } };
  target.addEventListener('pointerenter', show);
  target.addEventListener('pointerleave', hide);
  target.addEventListener('focus', show);
  target.addEventListener('blur', hide);
  return target;
}

function place(c, target) {
  const r = target.getBoundingClientRect(), w = c.offsetWidth, hgt = c.offsetHeight, m = 10;
  let x = r.left + r.width / 2 - w / 2, y = r.top - hgt - m;
  if (y < 8) y = r.bottom + m;                                  // no room above: show below
  x = Math.max(8, Math.min(innerWidth - w - 8, x));
  y = Math.max(8, Math.min(innerHeight - hgt - 8, y));
  c.style.left = `${x}px`; c.style.top = `${y}px`;
}

const LABELS = { environment: 'Environment', habitat: 'Habitat', depth: 'Depth', behaviour: 'Behaviour', diet: 'Diet',
  size: 'Size', reproduction: 'Reproduction', conservation: 'Conservation' };

/** Species preview from /api/species/<id>/brief. */
export async function speciesCard(inatId) {
  const b = await api(`/api/species/${inatId}/brief`);
  return h('div', { class: 'hc-species' },
    b.photo ? h('img', { class: 'hc-photo', src: b.photo, alt: '' }) : '',
    h('div', { class: 'hc-body' },
      h('div', { class: 'hc-title' }, b.common || b.name),
      h('div', { class: 'hc-sci' }, h('i', {}, b.name), b.rank ? ` · ${b.rank}` : ''),
      b.lineage?.length ? h('div', { class: 'hc-line' }, b.lineage.join(' › ')) : '',
      h('div', { class: 'hc-pills' },
        b.marine ? h('span', { class: 'pill ok' }, 'marine') : '',
        b.conservation ? h('span', { class: 'pill warn' }, b.conservation) : '',
        b.observations ? h('span', { class: 'pill' }, `${b.observations.toLocaleString()} records`) : ''),
      b.traits?.length ? h('dl', { class: 'hc-traits' }, b.traits.flatMap((t) => [h('dt', {}, LABELS[t.category] || t.category), h('dd', {}, t.label)])) : '',
      b.summary ? h('p', { class: 'hc-sum' }, b.summary) : ''));
}

/** Species preview for a free-text name (resolved through iNaturalist first). */
export async function speciesCardByName(name) {
  const t = (await api('/api/species/resolve', { body: { name } }).catch(() => ({}))).taxon;
  if (!t) return h('div', { class: 'hc-plain' }, h('b', {}, name), h('p', { class: 'muted' }, 'Not found in iNaturalist.'));
  return speciesCard(t.inat_id);
}

/** Simple preview: optional image + title + lines of text. */
export function infoCard({ img, title, lines = [], wide = false }) {
  return h('div', { class: `hc-info ${wide ? 'wide' : ''}` },
    img ? h('img', { class: 'hc-photo', src: img, alt: '' }) : '',
    h('div', { class: 'hc-body' }, title ? h('div', { class: 'hc-title' }, title) : '',
      ...lines.filter(Boolean).map((l) => (typeof l === 'string' ? h('p', {}, l) : l))));
}
