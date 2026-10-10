// Small shared helpers: DOM, API, safe markdown, toasts, storage.

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) el.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat(Infinity)) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
  return el;
};
export const icon = (id) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  u.setAttribute('href', `#i-${id}`); s.append(u); return s;
};

export const store = {
  get(k, d) { try { const v = localStorage.getItem('mc.' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mc.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
};

// Backend location. Empty = same server (the gateway serves this page). When the page is hosted elsewhere
// (e.g. GitHub Pages at yourdomain.com/marinechat/), scripts/publish_frontend.sh fills in the API's HTTPS URL.
export const API_BASE = (document.querySelector('meta[name="marinechat-api"]')?.content || '').trim().replace(/\/$/, '');
export const apiUrl = (p) => (API_BASE && typeof p === 'string' && p.startsWith('/api/') ? API_BASE + p : p);
/** Server responses contain links like "/api/media?u=..." or "/api/images/<id>": point them at API_BASE too. */
function rebase(v) {
  if (!API_BASE) return v;
  if (typeof v === 'string') return apiUrl(v);
  if (Array.isArray(v)) return v.map(rebase);
  if (v && typeof v === 'object') { for (const k of Object.keys(v)) v[k] = rebase(v[k]); }
  return v;
}

export async function api(path, opts = {}) {
  const init = { method: opts.method || (opts.body ? 'POST' : 'GET'), headers: {} };
  if (opts.form) init.body = opts.form;
  else if (opts.body) { init.body = JSON.stringify(opts.body); init.headers['Content-Type'] = 'application/json'; }
  const r = await fetch(apiUrl(path), init);
  const ct = r.headers.get('content-type') || '';
  const data = ct.includes('json') ? rebase(await r.json()) : await r.text();
  if (!r.ok) throw new Error((data && data.error) || `Request failed (${r.status})`);
  return data;
}

/** POST and stream a text/plain body; calls onChunk(fullTextSoFar). Resolves with final text.
 *  Aborting `signal` (the Stop button) resolves with the partial text instead of throwing. */
export async function streamText(path, body, onChunk, signal) {
  let text = '';
  try {
    const r = await fetch(apiUrl(path), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
    if (!r.ok) {
      let msg = `Request failed (${r.status})`;
      try { msg = (await r.json()).error || msg; } catch { /* not json */ }
      throw new Error(msg);
    }
    const reader = r.body.getReader();
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      const k = text.indexOf('[[MC_ERROR]]');
      if (k >= 0) throw new Error(text.slice(k + 12).trim() || 'Model error');
      onChunk(text);
    }
  } catch (e) {
    if (signal?.aborted) return text;
    throw e;
  }
  return text;
}

// ------------------------------------------------------------- safe markdown (escape first, then format)
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inline = (s) => s
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
  .replace(/_([^_\n]+)_/g, '<em>$1</em>');
export function md(src) {
  const lines = esc(src || '').split('\n');
  let html = '', list = null;
  const close = () => { if (list) { html += `</${list}>`; list = null; } };
  for (const raw of lines) {
    const l = raw.trimEnd();
    let m;
    if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
    else if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l)) { close(); html += '<hr>'; }
    else if ((m = l.match(/^#{1,4}\s+(.*)/))) { close(); html += `<h4>${inline(m[1])}</h4>`; }
    else if (!l.trim()) { close(); }
    else { close(); html += `<p>${inline(l)}</p>`; }
  }
  close();
  return html;
}

/** Parse the structured caption format requested from general VLMs. */
export function parseCaption(text) {
  const get = (k) => { const m = text.match(new RegExp(`^\\s*\\**${k}\\**\\s*:\\s*(.+)$`, 'im')); return m ? m[1].replace(/\*+/g, '').trim() : ''; };
  const label = get('Label'), sci = get('Scientific name'), conf = get('Confidence').toLowerCase();
  let desc = get('Description');
  if (!desc) desc = text.replace(/^\s*\**(Label|Scientific name|Confidence)\**\s*:.*$/gim, '').trim();
  return { label, sci, conf: ['high', 'medium', 'low'].find((c) => conf.startsWith(c)) || '', desc };
}

export function toast(msg, kind = '', ms = 4200) {
  const el = h('div', { class: `toast ${kind}` }, msg);
  document.getElementById('toasts').append(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
}

export function burst(x, y, n = 14) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
    const b = h('i', { class: 'burst' });
    b.style.left = `${x}px`; b.style.top = `${y}px`;
    b.style.setProperty('--dx', `${Math.cos(a) * d}px`); b.style.setProperty('--dy', `${Math.sin(a) * d - 60}px`);
    b.style.setProperty('--s', (0.6 + Math.random() * 1.8).toFixed(2));
    document.body.append(b); setTimeout(() => b.remove(), 1300);
  }
}

export function countUp(el, to, ms = 1400) {
  const from = +el.textContent.replace(/\D/g, '') || 0, t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
    el.textContent = Math.round(from + (to - from) * e).toLocaleString();
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
