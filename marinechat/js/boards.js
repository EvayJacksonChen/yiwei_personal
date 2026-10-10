// Leaderboards: long videos, short clips, and everything together. Scores: segment annotated 5, review 3,
// clip annotated 3 (+1 per keyword), any other feedback 1, contributed image 5.
import { h, api } from './util.js';
import { profile } from './profile.js';

const TITLES = { long: 'Long videos', short: 'Short clips', general: 'Overall' };
const DETAIL = {
  long: (r) => `${r.segments} segments · ${r.reviews} reviews`,
  short: (r) => `${r.clips} clips · ${r.keywords} keywords`,
  general: (r) => `${r.actions} contributions`,
};
let cache = { t: 0, period: '', data: null };

export async function boardsData(period = 'all') {
  if (cache.data && cache.period === period && Date.now() - cache.t < 20000) return cache.data;
  const data = await api(`/api/leaderboard?period=${period}`);
  cache = { t: Date.now(), period, data };
  return data;
}

/** One board. opts: { title, limit, period, compact } */
export function leaderBoard(kind, opts = {}) {
  const { limit = 10, period = 'all', compact = false } = opts;
  const list = h('ol', { class: 'lb-list' }, h('li', { class: 'shimmer-line' }));
  const el = h('section', { class: `board ${compact ? 'compact' : ''}`, 'data-kind': kind },
    h('div', { class: 'board-head' }, h('b', {}, opts.title || TITLES[kind])), list);
  boardsData(period).then((d) => fillBoard(list, d[kind] || [], kind, limit)).catch(() => list.replaceChildren(h('li', { class: 'fine' }, 'Board unavailable right now.')));
  return el;
}

export function fillBoard(list, rows, kind, limit) {
  const me = profile().uid;
  const mine = rows.find((r) => r.uid === me);
  const top = rows.slice(0, limit);
  list.replaceChildren(...(top.length ? top.map((r) => row(r, kind, me)) : [h('li', { class: 'fine lb-empty' }, 'No contributions yet. Yours could be the first.')]));
  if (mine && !top.includes(mine)) list.append(h('li', { class: 'lb-gap' }, '…'), row(mine, kind, me));
}

function row(r, kind, me) {
  return h('li', { class: `lb-row ${r.uid === me ? 'me' : ''} ${r.rank <= 3 ? 'top' + r.rank : ''}` },
    h('span', { class: 'lb-rank mono' }, r.rank), h('span', { class: 'pj-av' }, (r.name || '?').slice(0, 1).toUpperCase()),
    h('span', { class: 'lb-who' }, h('b', {}, r.name, r.uid === me ? ' (you)' : ''), h('small', {}, r.affiliation ? `${r.affiliation} · ` : '', DETAIL[kind](r))),
    h('span', { class: 'lb-score mono' }, r.score));
}

/** Three boards side by side with a week / all-time switch. */
export function allBoards({ limit = 20 } = {}) {
  let period = 'all';
  const grid = h('div', { class: 'boards' });
  const tabs = h('div', { class: 'about-tabs' });
  const draw = () => {
    tabs.replaceChildren(...[['week', 'This week'], ['all', 'All time']].map(([p, l]) => h('button', { class: `about-tab ${p === period ? 'on' : ''}`, type: 'button', onclick: () => { period = p; draw(); } }, l)));
    grid.replaceChildren(...['long', 'short', 'general'].map((k) => leaderBoard(k, { limit, period })));
  };
  draw();
  return h('div', { class: 'boards-wrap' }, tabs, grid,
    h('p', { class: 'fine' }, 'Points: annotated segment 5, review 3, tagged clip 3 (+1 per keyword), contributed image 5, any other check or correction 1. Nicknames are not verified.'));
}
