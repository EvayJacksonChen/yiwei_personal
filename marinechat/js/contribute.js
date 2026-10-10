// Contribute page: multi-image drop, metadata form, consent, upload with progress.
import { $, h, icon, toast, burst, store, apiUrl } from './util.js';
import { profile } from './profile.js';

export function initContribute(onStats) {
  const files = [];
  const input = $('#cfiles'), zone = $('#cdrop'), thumbs = $('#cthumbs');
  const c = store.get('contributor', {});
  $('#cName').value = c.name || ''; $('#cAff').value = c.affiliation || ''; $('#cEmail').value = c.email || '';

  const add = (list) => {
    for (const f of list) {
      if (!f.type.startsWith('image/')) continue;
      if (files.length >= 20) { toast('Maximum 20 images per submission', 'err'); break; }
      files.push(f);
    }
    render();
  };
  const render = () => {
    thumbs.innerHTML = '';
    files.forEach((f, i) => {
      const url = URL.createObjectURL(f);
      const rm = h('button', { type: 'button', title: 'Remove' }, icon('x'));
      rm.onclick = (e) => { e.stopPropagation(); files.splice(i, 1); render(); };
      thumbs.append(h('div', { style: `animation-delay:${i * 30}ms` }, h('img', { src: url, alt: f.name, onload: () => URL.revokeObjectURL(url) }), rm));
    });
  };
  zone.onclick = (e) => { if (!e.target.closest('button')) input.click(); };
  input.onchange = () => { add(input.files); input.value = ''; };
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', (e) => add(e.dataTransfer.files));

  $('#contribForm').onsubmit = (e) => {
    e.preventDefault();
    if (!files.length) return toast('Add at least one image', 'err');
    if (!$('#cConsent').checked) return toast('Please confirm the consent statement', 'err');
    const meta = {
      consent: true, role: $('#cRole').value, license: $('#cLicense').value, location: $('#cLoc').value, depth_m: $('#cDepth').value,
      date: $('#cDate').value, habitat: $('#cHabitat').value, species: $('#cSpecies').value, notes: $('#cNotes').value,
      name: $('#cName').value, affiliation: $('#cAff').value, email: $('#cEmail').value, uid: profile().uid,
    };
    store.set('contributor', { name: meta.name, affiliation: meta.affiliation, email: meta.email });
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f));
    fd.append('meta', JSON.stringify(meta));
    const xhr = new XMLHttpRequest(), prog = $('#cProg'), bar = prog.querySelector('i'), btn = $('#cSubmit');
    prog.hidden = false; btn.disabled = true; bar.style.width = '0%';
    xhr.upload.onprogress = (ev) => { if (ev.lengthComputable) bar.style.width = `${(ev.loaded / ev.total) * 100}%`; };
    xhr.onload = () => {
      btn.disabled = false; prog.hidden = true;
      let res = {}; try { res = JSON.parse(xhr.responseText); } catch { /* ignore */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        const r = btn.getBoundingClientRect(); burst(r.left + r.width / 2, r.top, 26);
        toast(`Thank you! ${res.saved} image(s) added to the MarineInst community collection.`, 'ok', 7000);
        files.length = 0; render(); $('#cConsent').checked = false;
        onStats?.(res.stats);
      } else toast(res.error || 'Upload failed', 'err');
    };
    xhr.onerror = () => { btn.disabled = false; prog.hidden = true; toast('Network error, please try again', 'err'); };
    xhr.open('POST', apiUrl('/api/contribute')); xhr.send(fd);
  };
}
