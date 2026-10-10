// One feedback widget for every piece of model output: quick ✓ / ✗, and ⌄ to expand a comment box.
// Everything is posted to /api/feedback together with its context (prompt, model, output) for future training.
import { h, icon, api, toast, burst } from './util.js';

const votes = new Map();  // key -> verdict, so re-rendered widgets keep their state

/**
 * @param {object} o
 *   key        stable id for this output (keeps the chosen state across re-renders)
 *   payload()  returns the /api/feedback body (target, image_id, model, original, context, ...)
 *   question   optional short prompt shown before the buttons ("Is this correct?")
 *   compact    smaller variant (cards / photo overlays)
 *   noComment  hide the expand arrow
 *   onVerdict  callback(verdict)
 */
export function feedbackBar({ key, payload, question = '', compact = false, noComment = false, onVerdict } = {}) {
  const cur = votes.get(key);
  const ok = h('button', { class: `ib fb-ok ${cur === 'correct' ? 'on-ok' : ''}`, title: 'Correct / helpful', 'aria-label': 'Correct' }, icon('check'));
  const bad = h('button', { class: `ib fb-bad ${cur === 'wrong' ? 'on-bad' : ''}`, title: 'Wrong / not helpful', 'aria-label': 'Wrong' }, icon('x'));
  const more = noComment ? '' : h('button', { class: 'ib fb-more', title: 'Write more feedback', 'aria-label': 'Write more feedback', 'aria-expanded': 'false' }, icon('chev'));
  const row = h('div', { class: `fb ${compact ? 'compact' : ''}` }, question ? h('span', { class: 'fb-q' }, question) : '', ok, bad, more);
  const wrap = h('div', { class: 'fb-wrap' }, row);
  let box = null;

  const post = (verdict, text = '') => {
    const body = { ...payload() };
    body.verdict = verdict;
    if (text) {
      if (verdict === 'wrong' && body.target !== 'knowledge') body.correction = text;
      body.notes = text;
    }
    return api('/api/feedback', { body });
  };
  const vote = (v) => {
    const same = votes.get(key) === v;
    votes.set(key, v);
    ok.classList.toggle('on-ok', v === 'correct'); bad.classList.toggle('on-bad', v === 'wrong');
    if (!same) post(v).then(() => toast(v === 'correct' ? 'Thanks for confirming!' : 'Thanks! Tell us more with ⌄ if you can.', 'ok', 2200)).catch((e) => toast(e.message, 'err'));
    onVerdict?.(v);
    if (v === 'wrong' && more) open();
  };
  const open = () => {
    if (box) { box.querySelector('textarea').focus(); return; }
    more.setAttribute('aria-expanded', 'true'); more.classList.add('open');
    const t = h('textarea', { rows: 2, maxlength: 4000, placeholder: votes.get(key) === 'wrong' ? 'What is wrong? What would the correct answer be?' : 'Anything to add? (helps us improve the model)' });
    const send = h('button', { class: 'btn btn-xs btn-glow', type: 'button' }, icon('send'), 'Send');
    const cancel = h('button', { class: 'btn btn-xs btn-ghost', type: 'button' }, 'Close');
    box = h('div', { class: 'fb-box' }, t, h('div', { class: 'fb-box-actions' }, cancel, send));
    send.onclick = () => {
      if (!t.value.trim()) return t.focus();
      post(votes.get(key) || 'comment', t.value.trim()).then(() => {
        toast('Feedback sent, thank you!', 'ok');
        const b = send.getBoundingClientRect(); burst(b.left + 20, b.top, 10);
        close();
      }).catch((e) => toast(e.message, 'err'));
    };
    cancel.onclick = close;
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) send.click(); e.stopPropagation(); });
    wrap.append(box); t.focus();
  };
  const close = () => { box?.remove(); box = null; if (more) { more.classList.remove('open'); more.setAttribute('aria-expanded', 'false'); } };
  ok.onclick = (e) => { e.stopPropagation(); vote('correct'); };
  bad.onclick = (e) => { e.stopPropagation(); vote('wrong'); };
  if (more) more.onclick = (e) => { e.stopPropagation(); box ? close() : open(); };
  return wrap;
}

export const verdictOf = (key) => votes.get(key);
