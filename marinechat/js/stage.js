// Interactive mask canvas: draws the image + instance polygons, handles hover/select and point prompts.

const PALETTE = ['#40ffd6', '#5cf2ff', '#3aa0ff', '#9b8cff', '#4dffa6', '#ff7ad9', '#7fe7ff', '#b4ff6b', '#6bb8ff', '#d48cff'];
const SEL = '#ffc86b';
const NEG = '#ff6b8a';
const ADD = '#c6b8ff';

const hexA = (hex, a) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

function toPath(polys) {
  const p = new Path2D();
  for (const { pts } of polys) {
    p.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
    p.closePath();
  }
  return p;
}

export class Stage {
  constructor(canvas, { onSelect, onHover, onPreview }) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.onSelect = onSelect; this.onHover = onHover; this.onPreview = onPreview;
    this.img = null; this.inst = []; this.sel = new Set(); this.hover = null;
    this.showMasks = true; this.showNeg = false; this.opacity = 0.38; this.tool = 'select';
    this.points = []; this.preview = null; this.reveal = 0; this.revealT0 = 0; this.dirty = true; this.t = 0;
    this.verdict = new Map();
    this.edit = null; this.onRefine = null;
    new ResizeObserver(() => this.fit()).observe(canvas.parentElement);
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerleave', () => { this.setHover(null); if (this.edit) { this.edit.cursor = null; this.dirty = true; } });
    canvas.addEventListener('pointerdown', (e) => this.editDown(e));
    addEventListener('pointerup', () => this.editUp());
    canvas.addEventListener('click', (e) => this.click(e, false));
    canvas.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (this.tool === 'add') this.click(e, true);
      else if (this.edit?.tool === 'smart') this.smartClick(e, 0);
    });
    const loop = (t) => { this.t = t; if (this.dirty || this.animating()) this.draw(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  setImage(img) { this.img = img; this.inst = []; this.sel.clear(); this.hover = null; this.points = []; this.preview = null; this.verdict.clear(); this.fit(); }
  setInstances(list, animate = true) {
    this.inst = list.map((r, i) => ({ ...r, path: toPath(r.polys), color: PALETTE[i % PALETTE.length] }));
    this.byArea = [...this.inst].sort((a, b) => a.area - b.area);
    this.revealT0 = animate ? performance.now() : 0; this.dirty = true;
  }
  addInstance(r) {
    const o = { ...r, path: toPath(r.polys), color: ADD, born: performance.now() };
    this.inst.push(o); this.byArea = [...this.inst].sort((a, b) => a.area - b.area); this.dirty = true; return o;
  }
  removeInstance(id) { this.inst = this.inst.filter((r) => r.id !== id); this.byArea = this.byArea.filter((r) => r.id !== id); this.sel.delete(id); this.dirty = true; }
  updateInstance(rec) {
    const o = this.inst.find((r) => r.id === rec.id);
    if (o) Object.assign(o, rec, { path: toPath(rec.polys) });
    this.byArea = [...this.inst].sort((a, b) => a.area - b.area); this.dirty = true;
  }
  animating() { return !!this.edit || (this.revealT0 && this.t - this.revealT0 < 2400) || this.inst.some((r) => r.born && this.t - r.born < 900) || this.hover != null || this.sel.size || this.points.length; }

  fit() {
    if (!this.img) return;
    const box = this.cv.parentElement.getBoundingClientRect();
    const s = Math.min((box.width - 16) / this.img.naturalWidth, (box.height - 16) / this.img.naturalHeight);
    const w = Math.max(50, Math.floor(this.img.naturalWidth * s)), hgt = Math.max(50, Math.floor(this.img.naturalHeight * s));
    const dpr = Math.min(devicePixelRatio || 1, 2);
    this.cv.style.width = `${w}px`; this.cv.style.height = `${hgt}px`;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(hgt * dpr);
    this.scale = (w * dpr) / this.img.naturalWidth; this.cssScale = w / this.img.naturalWidth; this.dirty = true;
  }

  toImg(e) {
    const r = this.cv.getBoundingClientRect();
    return [(e.clientX - r.left) / this.cssScale, (e.clientY - r.top) / this.cssScale];
  }

  visible(r) { return r.cate === 1 || r.origin === 'user' || this.showNeg; }

  hit(x, y) {
    if (!this.showMasks) return null;
    for (const r of this.byArea || []) if (this.visible(r) && this.ctx.isPointInPath(r.path, x * 1, y * 1, 'evenodd')) return r;
    return null;
  }

  setHover(r) {
    const id = r ? r.id : null;
    if (id !== this.hover) { this.hover = id; this.dirty = true; this.onHover?.(r); }
  }

  move(e) {
    if (this.edit) return this.editMove(e);
    if (!this.img || this.tool !== 'select') return this.setHover(null);
    const [x, y] = this.toImg(e);
    this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const r = this.hit(x, y);
    this.ctx.restore();
    this.setHover(r);
    this.onHover?.(r, e);
  }

  click(e, negative) {
    if (!this.img) return;
    if (this.edit) { if (this.edit.tool.startsWith('smart')) this.smartClick(e, this.edit.tool === 'smartneg' || e.altKey ? 0 : 1); return; }
    const [x, y] = this.toImg(e);
    if (this.tool === 'add') {
      this.points.push({ x, y, l: negative || e.altKey ? 0 : 1 });
      this.dirty = true; this.onPreview?.(this.points);
      return;
    }
    this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    const r = this.hit(x, y);
    this.ctx.restore();
    if (!r) { if (!e.shiftKey) { this.sel.clear(); this.onSelect?.([...this.sel]); this.dirty = true; } return; }
    if (e.shiftKey || e.metaKey || e.ctrlKey) { this.sel.has(r.id) ? this.sel.delete(r.id) : this.sel.add(r.id); }
    else if (this.sel.size === 1 && this.sel.has(r.id)) this.sel.clear();
    else { this.sel.clear(); this.sel.add(r.id); }
    this.dirty = true; this.onSelect?.([...this.sel]);
  }

  select(ids) { this.sel = new Set(ids); this.dirty = true; }
  setPreview(r) { this.preview = r ? { ...r, path: toPath(r.polys) } : null; this.dirty = true; }
  clearPoints() { this.points = []; this.preview = null; this.dirty = true; }

  // ------------------------------------------------------------ mask editing (brush / eraser / smart click)
  startEdit(r) {
    const W = this.img.naturalWidth, H = this.img.naturalHeight;
    const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
    const c = mk(), x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fill(r.path, 'evenodd');
    this.edit = { id: r.id, c, x, tint: mk(), edge: mk(), undo: [], redo: [], tool: 'smart', size: 18, points: [],
      cursor: null, drawing: false, last: null, tools: new Set(), color: r.color || '#40ffd6' };
    this.edit.orig = this.snap();
    this.tool = 'edit'; this.setHover(null); this.retint();
  }
  endEdit() { this.edit = null; this.tool = 'select'; this.dirty = true; }
  snap() {
    const s = document.createElement('canvas'); s.width = this.edit.c.width; s.height = this.edit.c.height;
    s.getContext('2d').drawImage(this.edit.c, 0, 0); return s;
  }
  pushUndo() { const E = this.edit; E.undo.push(this.snap()); if (E.undo.length > 20) E.undo.shift(); E.redo = []; }
  restore(s) { const E = this.edit; E.x.clearRect(0, 0, E.c.width, E.c.height); E.x.drawImage(s, 0, 0); this.retint(); }
  undoEdit() { const E = this.edit; if (!E?.undo.length) return; E.redo.push(this.snap()); this.restore(E.undo.pop()); }
  redoEdit() { const E = this.edit; if (!E?.redo.length) return; E.undo.push(this.snap()); this.restore(E.redo.pop()); }
  resetEdit() { if (!this.edit) return; this.pushUndo(); this.restore(this.edit.orig); this.edit.points = []; }
  setEditPolys(polys) {
    const E = this.edit; this.pushUndo();
    E.x.clearRect(0, 0, E.c.width, E.c.height); E.x.fillStyle = '#fff'; E.x.fill(toPath(polys), 'evenodd'); this.retint();
  }
  editPNG() { return this.edit.c.toDataURL('image/png'); }
  /** Tinted fill + bright edge of the edited mask (re-built after each change, at most once per frame). */
  retint() {
    const E = this.edit; if (!E || E.tintQueued) return;
    E.tintQueued = true;
    requestAnimationFrame(() => {
      E.tintQueued = false;
      const W = E.c.width, H = E.c.height, t = E.tint.getContext('2d'), g = E.edge.getContext('2d');
      t.globalCompositeOperation = 'source-over'; t.clearRect(0, 0, W, H); t.drawImage(E.c, 0, 0);
      t.globalCompositeOperation = 'source-in'; t.fillStyle = 'rgba(255,200,107,.42)'; t.fillRect(0, 0, W, H);
      const d = Math.max(1.5, 1.6 / this.cssScale);
      g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, W, H); g.drawImage(E.c, 0, 0);
      g.globalCompositeOperation = 'destination-out';
      for (const [dx, dy] of [[d, 0], [-d, 0], [0, d], [0, -d]]) g.drawImage(E.c, dx, dy);
      g.globalCompositeOperation = 'source-in'; g.fillStyle = '#ffd38a'; g.fillRect(0, 0, W, H);
      this.dirty = true;
    });
  }
  brushPx() { return this.edit.size / this.cssScale; }
  paint(x0, y0, x1, y1, erase) {
    const E = this.edit, x = E.x;
    x.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = this.brushPx();
    x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    x.beginPath(); x.arc(x1, y1, this.brushPx() / 2, 0, 6.283); x.fill();
    x.globalCompositeOperation = 'source-over';
    E.tools.add(erase ? 'erase' : 'brush');
    this.retint();
  }
  editDown(e) {
    const E = this.edit;
    if (!E || E.tool.startsWith('smart')) return;
    e.preventDefault();
    this.cv.setPointerCapture?.(e.pointerId);
    const [x, y] = this.toImg(e);
    this.pushUndo();
    E.drawing = true; E.erasing = E.tool === 'erase' || e.button === 2; E.last = [x, y];
    this.paint(x, y, x, y, E.erasing);
  }
  editMove(e) {
    const E = this.edit, [x, y] = this.toImg(e);
    E.cursor = [x, y]; this.dirty = true;
    if (E.drawing && E.last) { this.paint(E.last[0], E.last[1], x, y, E.erasing); E.last = [x, y]; }
  }
  editUp() { if (this.edit?.drawing) { this.edit.drawing = false; this.edit.last = null; } }
  smartClick(e, label) {
    const E = this.edit, [x, y] = this.toImg(e);
    E.points.push({ x, y, l: label }); this.dirty = true;
    this.onRefine?.(E.points);
  }

  draw() {
    this.dirty = false;
    const { ctx, img } = this;
    if (!img) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.cv.width, this.cv.height);
    ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    ctx.drawImage(img, 0, 0);
    if (this.edit) return this.drawEdit();
    const lw = 2 / this.scale * (devicePixelRatio > 1 ? 1.4 : 1);
    const now = this.t || performance.now();
    if (this.showMasks) {
      const n = this.inst.length || 1;
      this.inst.forEach((r, i) => {
        if (!this.visible(r)) return;
        let a = 1;
        if (this.revealT0) a = Math.max(0, Math.min(1, (now - this.revealT0 - (i / n) * 900) / 500));
        if (r.born) a = Math.min(1, (now - r.born) / 500);
        if (a <= 0) return;
        const sel = this.sel.has(r.id), hov = this.hover === r.id, neg = r.cate === 0 && r.origin !== 'user';
        const v = this.verdict.get(r.id);
        const col = sel ? SEL : neg ? NEG : v === 'wrong' ? NEG : r.color;
        const dim = (this.sel.size && !sel) ? 0.45 : 1;
        ctx.globalAlpha = a * dim;
        ctx.fillStyle = hexA(col, (sel ? this.opacity * 0.55 : hov ? Math.min(0.9, this.opacity + 0.12) : this.opacity) * (neg ? 0.5 : 1));
        ctx.fill(r.path, 'evenodd');
        ctx.lineWidth = (sel ? 3 : hov ? 2.4 : 1.4) * lw;
        ctx.strokeStyle = hexA(col, 0.95);
        ctx.setLineDash(neg ? [6 / this.scale, 5 / this.scale] : v === 'wrong' ? [3 / this.scale, 4 / this.scale] : []);
        if (hov || sel) { ctx.shadowColor = col; ctx.shadowBlur = sel ? 22 : 16; }
        ctx.stroke(r.path);
        ctx.shadowBlur = 0; ctx.setLineDash([]);
        // entrance ripple from the prompt point
        if (this.revealT0 && a < 1 && r.point) {
          ctx.beginPath(); ctx.arc(r.point[0], r.point[1], (1 - a) * 40 / this.scale + 4 / this.scale, 0, 6.283);
          ctx.strokeStyle = hexA(col, 1 - a); ctx.lineWidth = lw; ctx.stroke();
        }
      });
      ctx.globalAlpha = 1;
      // marching ants on selection
      for (const r of this.inst) if (this.sel.has(r.id)) {
        ctx.setLineDash([8 / this.scale, 6 / this.scale]); ctx.lineDashOffset = -now / 40 / this.scale;
        ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = lw; ctx.stroke(r.path); ctx.setLineDash([]);
      }
    }
    if (this.preview) {
      ctx.fillStyle = hexA(ADD, 0.35); ctx.fill(this.preview.path, 'evenodd');
      ctx.setLineDash([6 / this.scale, 4 / this.scale]); ctx.lineDashOffset = -now / 50 / this.scale;
      ctx.strokeStyle = ADD; ctx.lineWidth = 2 * lw; ctx.stroke(this.preview.path); ctx.setLineDash([]);
    }
    for (const p of this.points) {
      const R = 7 / this.scale * (devicePixelRatio > 1 ? 1.5 : 1);
      ctx.beginPath(); ctx.arc(p.x, p.y, R * (1 + 0.15 * Math.sin(now / 200)), 0, 6.283);
      ctx.fillStyle = p.l ? '#4dffa6' : NEG; ctx.fill();
      ctx.lineWidth = lw; ctx.strokeStyle = '#02131f'; ctx.stroke();
      ctx.fillStyle = '#02131f'; ctx.font = `${R * 1.6}px Inter`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(p.l ? '+' : '−', p.x, p.y + R * 0.05);
    }
  }

  drawEdit() {
    const { ctx } = this, E = this.edit, now = this.t || performance.now();
    const W = E.c.width, H = E.c.height;
    ctx.fillStyle = 'rgba(2,8,20,.38)'; ctx.fillRect(0, 0, W, H);       // dim everything...
    ctx.save(); ctx.globalCompositeOperation = 'destination-out';        // ...except the mask being edited
    ctx.restore();
    ctx.drawImage(E.tint, 0, 0);
    ctx.globalAlpha = 0.75 + 0.25 * Math.sin(now / 300);
    ctx.drawImage(E.edge, 0, 0);
    ctx.globalAlpha = 1;
    const R = 7 / this.scale * (devicePixelRatio > 1 ? 1.5 : 1), lw = 2 / this.scale;
    for (const p of E.points) {
      ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, 6.283);
      ctx.fillStyle = p.l ? '#4dffa6' : NEG; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = '#02131f'; ctx.stroke();
    }
    if (E.cursor && !E.tool.startsWith('smart')) {
      ctx.beginPath(); ctx.arc(E.cursor[0], E.cursor[1], this.brushPx() / 2, 0, 6.283);
      ctx.lineWidth = lw; ctx.strokeStyle = E.tool === 'erase' ? NEG : '#ffd38a';
      ctx.setLineDash([4 / this.scale, 3 / this.scale]); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  /** Small canvas with the instance crop and its outline (used by chips and cards). */
  thumb(r, size = 68) {
    const c = document.createElement('canvas'); const dpr = Math.min(devicePixelRatio || 1, 2);
    c.width = c.height = size * dpr;
    const x = c.getContext('2d');
    const [bx, by, bw, bh] = r.bbox; const side = Math.max(bw, bh) * 1.25 + 8;
    const cx = bx + bw / 2, cy = by + bh / 2, s = (size * dpr) / side;
    x.setTransform(s, 0, 0, s, -(cx - side / 2) * s, -(cy - side / 2) * s);
    x.drawImage(this.img, 0, 0);
    x.fillStyle = 'rgba(2,8,20,.45)'; x.fillRect(cx - side, cy - side, side * 2, side * 2);
    x.save(); x.clip(r.path, 'evenodd'); x.drawImage(this.img, 0, 0); x.restore();
    x.lineWidth = 2 / s; x.strokeStyle = r.color || '#40ffd6'; x.stroke(r.path);
    return c;
  }
}
