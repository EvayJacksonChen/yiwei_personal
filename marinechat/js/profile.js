// Contributor profile without accounts: a random id kept in this browser plus an optional nickname / affiliation.
// Every contribution carries it, which is what the leaderboards count. (Anyone can pick any nickname.)
import { h, icon, api, store, toast } from './util.js';

function makeUid() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function profile() {
  let uid = store.get('uid', '');
  if (!/^[a-z0-9]{8,40}$/.test(uid)) { uid = makeUid(); store.set('uid', uid); }
  const c = store.get('contributor', {});
  return { uid, name: c.name || '', affiliation: c.affiliation || '', email: c.email || '' };
}

export const displayName = (p = profile()) => p.name || `Diver ${p.uid.slice(0, 4)}`;

export function saveProfile(name, affiliation) {
  const c = store.get('contributor', {});
  store.set('contributor', { ...c, name: name.trim().slice(0, 60), affiliation: affiliation.trim().slice(0, 80) });
  const p = profile();
  api('/api/profile', { body: { uid: p.uid, name: p.name, affiliation: p.affiliation } }).catch(() => {});
  document.dispatchEvent(new CustomEvent('mc:profile', { detail: p }));
  return p;
}

/** Small chip showing who you are on the boards; click to edit the nickname. */
export function profileChip() {
  const label = h('span', {}, displayName());
  const btn = h('button', { class: 'profile-chip', type: 'button', title: 'Your name on the leaderboards' }, h('span', { class: 'pc-av' }, displayName().slice(0, 1).toUpperCase()), label, icon('edit'));
  const box = h('div', { class: 'profile-pop glass', hidden: true });
  const name = h('input', { id: 'pcName', maxlength: 60, placeholder: 'Nickname shown on the boards', autocomplete: 'nickname' });
  const aff = h('input', { id: 'pcAff', maxlength: 80, placeholder: 'Affiliation (optional)', autocomplete: 'organization' });
  const ok = h('button', { class: 'btn btn-xs btn-glow', type: 'button' }, 'Save');
  box.append(h('p', { class: 'fine' }, 'No account needed. Your id stays in this browser; the nickname is public on the leaderboards.'), name, aff, ok);
  const refresh = () => { const p = profile(); label.textContent = displayName(p); btn.querySelector('.pc-av').textContent = displayName(p).slice(0, 1).toUpperCase(); };
  btn.onclick = () => { const p = profile(); name.value = p.name; aff.value = p.affiliation; box.hidden = !box.hidden; if (!box.hidden) name.focus(); };
  ok.onclick = () => { saveProfile(name.value, aff.value); box.hidden = true; refresh(); toast('Profile saved', 'ok', 1800); };
  [name, aff].forEach((i) => i.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok.click(); if (e.key === 'Escape') box.hidden = true; e.stopPropagation(); }));
  document.addEventListener('mc:profile', refresh);
  return h('div', { class: 'profile-wrap' }, btn, box);
}

export const contributorPayload = () => { const p = profile(); return { uid: p.uid, name: p.name, affiliation: p.affiliation }; };
