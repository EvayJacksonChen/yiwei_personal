/* The page around the water: clock and greeting, sky and weather controls, the dive
   computer, Vision mode, picking an animal and talking to it, and the portrait detector. */

(function () {
  "use strict";

  const D = (window.DIVE = window.DIVE || {});
  const GL = !!(window.THREE && D.S && !D.failed);
  const S = D.S;
  const doc = document;
  const $ = function (id) { return doc.getElementById(id); };
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const visitorZh = String((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase().indexOf("zh") === 0;

  const ZONES = [
    { id: "top", name: "Surface", place: "sea surface", m: 0 },
    { id: "about", name: "Sunlit zone", place: "sunlit zone", m: 8 },
    { id: "publications", name: "Twilight zone", place: "twilight zone", m: 200 },
    { id: "news", name: "Midnight zone", place: "midnight zone", m: 1000 },
    { id: "experience", name: "Abyssal zone", place: "abyssal zone", m: 4000 }
  ];
  const TIPS = {
    top: { up: "Surface · 1 atm, breathe!" },
    about: { down: "Sunlit zone · most ocean life lives here", up: "Back in the sunlit zone" },
    publications: { down: "200 m · Twilight: red light is gone", up: "Rising into the twilight" },
    news: { down: "1,000 m · Midnight: only animal light", up: "Leaving the midnight zone" },
    experience: { down: "4,000 m · Abyss: 400× surface pressure" }
  };

  /* ---------- clock and greeting ---------- */

  const PARTS = ["morning", "afternoon", "evening", "night"];
  const GREET = { morning: "Good morning", afternoon: "Good afternoon", evening: "Good evening", night: "Good night" };
  function partOfDay(h) { return h >= 5 && h < 11 ? "morning" : h >= 11 && h < 17 ? "afternoon" : h >= 17 && h < 20 ? "evening" : "night"; }

  let part = partOfDay(new Date().getHours());
  let partPinned = false;
  // ?sky=morning|afternoon|evening|night pins the sky, for previews and screenshots
  const wanted = (location.search.match(/[?&]sky=([a-z]+)/) || [])[1];
  if (PARTS.indexOf(wanted) >= 0) { part = wanted; partPinned = true; }
  function applyPart() {
    doc.body.dataset.part = part;
    const hello = $("hello-text");
    if (hello) hello.textContent = GREET[part];
    if (GL) D.setPart(part);
    tone();
  }

  (function clock() {
    const timeEl = $("clock-time"), zoneEl = $("clock-zone");
    if (!timeEl) return;
    let zone = "";
    try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch (e) { zone = ""; }
    const city = zone.indexOf("/") >= 0 ? zone.split("/").pop().replace(/_/g, " ") : "Local";
    if (zoneEl) zoneEl.textContent = city;
    function tick() {
      const now = new Date();
      timeEl.textContent = [now.getHours(), now.getMinutes(), now.getSeconds()].map(function (n) { return (n < 10 ? "0" : "") + n; }).join(":");
      if (!partPinned) {
        const p = partOfDay(now.getHours());
        if (p !== part) { part = p; applyPart(); }
      }
    }
    tick();
    window.setInterval(tick, 1000);
  })();

  const dayMark = $("day-mark");
  if (dayMark) {
    dayMark.addEventListener("click", function () {
      part = PARTS[(PARTS.indexOf(part) + 1) % PARTS.length];
      partPinned = true;
      applyPart();
    });
  }

  /* ---------- live weather over Hong Kong shapes the sky and the swell ---------- */

  const KINDS = {
    clear: { label: "clear", cloud: 0.18, wave: 0.9 },
    partly: { label: "partly cloudy", cloud: 0.42, wave: 1 },
    overcast: { label: "overcast", cloud: 0.86, wave: 1.1 },
    fog: { label: "fog", cloud: 0.94, wave: 0.8 },
    rain: { label: "rain", cloud: 0.95, wave: 1.35 },
    storm: { label: "thunderstorm", cloud: 1, wave: 1.8 }
  };
  const KIND_ORDER = ["clear", "partly", "overcast", "rain", "storm"];
  const weather = { kind: "partly", live: null, temp: null, text: "" };

  function showWeather(kind, temp, live) {
    weather.kind = kind;
    const k = KINDS[kind];
    const tag = $("weather-tag"), text = $("weather-text");
    weather.text = k.label;
    if (tag) tag.dataset.kind = part === "night" && kind === "clear" ? "night" : kind;
    if (text) text.textContent = "Hong Kong" + (temp != null ? " · " + Math.round(temp) + "°C" : "") + " · " + k.label + (live ? "" : " (preview)");
    if (GL) D.setWeather(k.cloud, k.wave);
  }
  showWeather("partly", null, true);

  function kindFor(code, cover) {
    if (code >= 95) return "storm";
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
    if (code === 45 || code === 48) return "fog";
    if (code === 3 || cover > 80) return "overcast";
    if (code === 0 || cover < 20) return "clear";
    return "partly";
  }
  (function fetchWeather() {
    if (!window.fetch) return;
    fetch("https://api.open-meteo.com/v1/forecast?latitude=22.3027&longitude=114.1772&current=temperature_2m,weather_code,is_day,cloud_cover&timezone=Asia%2FHong_Kong")
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        const cur = data && data.current;
        if (!cur) return;
        weather.live = { kind: kindFor(cur.weather_code, cur.cloud_cover), temp: cur.temperature_2m };
        weather.temp = cur.temperature_2m;
        showWeather(weather.live.kind, weather.live.temp, true);
      })
      .catch(function () { /* offline: keep the default sky */ });
  })();

  const weatherTag = $("weather-tag");
  if (weatherTag) {
    let step = -1;
    weatherTag.addEventListener("click", function () {
      step++;
      if (step >= KIND_ORDER.length) {
        step = -1;
        if (weather.live) showWeather(weather.live.kind, weather.live.temp, true);
        else showWeather("partly", null, true);
        return;
      }
      showWeather(KIND_ORDER[step], weather.temp, false);
    });
  }

  /* ---------- where we are: zone, tone, dive computer ---------- */

  const zoneEls = ZONES.map(function (z) { return $(z.id); });
  const navLinks = Array.prototype.slice.call(doc.querySelectorAll(".nav a"));
  const heroEl = $("top");
  let zoneIndex = 0;
  let submerged = false;

  function tone() {
    const sky = GL ? D.skyTone() : (part === "morning" || part === "afternoon" ? "light" : "dark");
    const heroTone = submerged ? "dark" : sky;
    if (heroEl) heroEl.dataset.tone = heroTone;
    doc.body.dataset.tone = zoneIndex === 0 ? heroTone : "dark";
  }
  D.onCross = function (under) { submerged = under; tone(); };

  // Depth, for when there is no WebGL to ask.
  function flatDepth() {
    const sy = window.scrollY;
    const tops = zoneEls.map(function (el) { return el ? el.getBoundingClientRect().top + sy - 64 : 0; });
    const end = Math.max(1, doc.documentElement.scrollHeight - window.innerHeight);
    const ms = ZONES.map(function (z) { return z.m; }).concat(4800);
    tops[0] = 0;
    tops.push(end);
    for (let i = 1; i < tops.length; i++) {
      if (sy <= tops[i]) return lerp(ms[i - 1], ms[i], clamp((sy - tops[i - 1]) / Math.max(1, tops[i] - tops[i - 1]), 0, 1));
    }
    return 4800;
  }

  function seaTemp(m) {
    // a tropical profile: warm mixed layer, sharp thermocline, then near-freezing
    const pts = [[0, 26], [50, 25], [200, 15], [500, 8.5], [1000, 4.8], [2000, 2.6], [4000, 1.7], [4800, 1.5]];
    for (let i = 1; i < pts.length; i++) if (m <= pts[i][0]) return lerp(pts[i - 1][1], pts[i][1], (m - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]));
    return 1.5;
  }

  const gauge = { num: $("depth-num"), zone: $("depth-zone"), atm: $("depth-atm"), temp: $("depth-temp"), light: $("depth-light"), rail: $("gauge-rail"), sub: $("gauge-sub") };
  const tip = { el: $("dive-tip"), arrow: $("dive-tip-arrow"), text: $("dive-tip-text"), timer: 0 };
  let lastNum = "";

  // Ticks on the rail: one per zone boundary, each a shortcut to its section.
  if (gauge.rail) {
    ZONES.forEach(function (z, i) {
      const b = doc.createElement("button");
      b.type = "button";
      b.className = "gauge-tick";
      b.style.top = (i / (ZONES.length)) * 100 + "%";
      b.dataset.label = z.name;
      b.setAttribute("aria-label", "Go to " + z.name);
      b.addEventListener("click", function () { const el = $(z.id); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); });
      gauge.rail.appendChild(b);
    });
  }

  function showTip(id, down) {
    const t = TIPS[id] && TIPS[id][down ? "down" : "up"];
    if (!t || !tip.el) return;
    tip.text.textContent = t;
    tip.arrow.textContent = down ? "▼" : "▲";
    tip.el.hidden = false;
    tip.el.classList.remove("out");
    void tip.el.offsetWidth;
    window.clearTimeout(tip.timer);
    tip.timer = window.setTimeout(function () {
      tip.el.classList.add("out");
      window.setTimeout(function () { tip.el.hidden = true; }, 320);
    }, 3200);
  }

  function updateWhere() {
    const sy = window.scrollY, vh = window.innerHeight;
    let idx = 0;
    for (let i = 0; i < zoneEls.length; i++) {
      if (zoneEls[i] && zoneEls[i].getBoundingClientRect().top <= vh * 0.42) idx = i;
    }
    if (idx !== zoneIndex) {
      const down = idx > zoneIndex;
      zoneIndex = idx;
      tone();
      showTip(ZONES[idx].id, down);
    }
    // "Projects" lives inside the sunlit zone but has its own nav entry.
    const proj = $("projects");
    const inProj = proj && proj.getBoundingClientRect().top <= vh * 0.42;
    navLinks.forEach(function (a) {
      const id = a.getAttribute("href").slice(1);
      const here = id === "projects" ? zoneIndex === 1 && inProj : id === "about" ? zoneIndex === 1 && !inProj : id === ZONES[zoneIndex].id;
      a.classList.toggle("is-here", !!here);
    });

    const m = GL ? S.depthM : flatDepth();
    const text = m >= 1000 ? Math.round(m).toLocaleString("en-US") : String(Math.round(m));
    if (gauge.num && text !== lastNum) {
      lastNum = text;
      gauge.num.textContent = text;
      const zname = m < 1 ? "Surface" : m < 200 ? "Sunlit zone" : m < 1000 ? "Twilight zone" : m < 4000 ? "Midnight zone" : "Abyssal zone";
      gauge.zone.textContent = zname;
      gauge.atm.textContent = (m < 95 ? (1 + m / 10).toFixed(1) : Math.round(1 + m / 10).toLocaleString("en-US")) + " atm";
      gauge.temp.textContent = seaTemp(m).toFixed(1) + " °C";
      const light = 100 * Math.exp(-m / 43.5);
      gauge.light.textContent = (light >= 10 ? Math.round(light) : light >= 0.1 ? light.toFixed(1) : light >= 0.001 ? "<0.1" : "0") + " %";
    }
    if (gauge.sub) {
      // position on the rail follows the zone ticks, not raw metres
      const stops = [0, 8, 200, 1000, 4000, 4800];
      let f = 1;
      for (let i = 1; i < stops.length; i++) if (m <= stops[i]) { f = (i - 1 + (m - stops[i - 1]) / (stops[i] - stops[i - 1])) / (stops.length - 1); break; }
      gauge.sub.style.top = (f * 100).toFixed(2) + "%";
    }
    void sy;
  }

  /* ---------- portrait: run the detector ---------- */

  (function portrait() {
    const wrap = $("portrait"), btn = $("portrait-frame"), label = $("scan-label");
    if (!wrap || !btn) return;
    let timer = 0;
    btn.addEventListener("click", function () {
      window.clearTimeout(timer);
      if (wrap.classList.contains("scanned") || wrap.classList.contains("scanning")) {
        wrap.classList.remove("scanned", "scanning");
        btn.setAttribute("aria-pressed", "false");
        return;
      }
      wrap.classList.add("scanning");
      btn.setAttribute("aria-pressed", "true");
      if (label) label.textContent = "Segmenting…";
      timer = window.setTimeout(function () {
        wrap.classList.remove("scanning");
        wrap.classList.add("scanned");
      }, 1550);
    });
    doc.addEventListener("pointerdown", function (e) {
      if (wrap.classList.contains("scanned") && !(e.target.closest && e.target.closest("#portrait"))) {
        wrap.classList.remove("scanned");
        btn.setAttribute("aria-pressed", "false");
      }
    });
  })();

  /* ---------- everything below needs the live scene ---------- */

  applyPart();
  updateWhere();
  if (!GL) {
    window.addEventListener("scroll", updateWhere, { passive: true });
    window.addEventListener("resize", updateWhere);
    const vt = $("vision-toggle");
    if (vt) vt.addEventListener("click", function () {
      const on = !doc.body.classList.contains("vision");
      doc.body.classList.toggle("vision", on);
      vt.setAttribute("aria-pressed", on ? "true" : "false");
    });
    return;
  }

  const hud = $("hud");
  const data = D.data;

  function latinHtml(latin) {
    if (!latin || latin === "ROV") return "";
    if (/idae$/.test(latin)) return latin; // family names stay roman
    return "<i>" + latin.replace(/\s+sp\.$/, "</i> sp.<i>") + "</i>";
  }

  /* ---------- vision mode: boxes, labels and masks, as a detector would draw them ---------- */

  const visionCanvas = $("vision");
  const vx = visionCanvas.getContext("2d");
  const visionToggle = $("vision-toggle");
  let visionDpr = 1;

  function sizeVision() {
    visionDpr = Math.min(window.devicePixelRatio || 1, 2);
    visionCanvas.width = Math.round(window.innerWidth * visionDpr);
    visionCanvas.height = Math.round(window.innerHeight * visionDpr);
  }
  D.onLayout(sizeVision);

  function setVision(on) {
    S.visionOn = on;
    S.dirty = true;
    doc.body.classList.toggle("vision", on);
    if (visionToggle) visionToggle.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (visionToggle) visionToggle.addEventListener("click", function () { setVision(!S.visionOn); });
  doc.addEventListener("keydown", function (e) {
    if ((e.key === "v" || e.key === "V") && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target.closest && e.target.closest("input, textarea"))) setVision(!S.visionOn);
  });

  function bracket(l, t, r, b, col, label, alpha) {
    const w = r - l, h = b - t;
    const k = Math.max(5, Math.min(14, Math.min(w, h) * 0.28));
    vx.globalAlpha = alpha;
    vx.strokeStyle = col;
    vx.lineWidth = 1.5;
    vx.beginPath();
    vx.moveTo(l, t + k); vx.lineTo(l, t); vx.lineTo(l + k, t);
    vx.moveTo(r - k, t); vx.lineTo(r, t); vx.lineTo(r, t + k);
    vx.moveTo(r, b - k); vx.lineTo(r, b); vx.lineTo(r - k, b);
    vx.moveTo(l + k, b); vx.lineTo(l, b); vx.lineTo(l, b - k);
    vx.stroke();
    vx.globalAlpha = alpha * 0.28;
    vx.lineWidth = 1;
    vx.strokeRect(l, t, w, h);
    if (label) {
      vx.globalAlpha = alpha;
      const tw = vx.measureText(label).width;
      const ly = t - 17 < 62 ? b + 3 : t - 17;
      vx.fillStyle = col;
      vx.fillRect(l - 1, ly, tw + 10, 15);
      vx.fillStyle = "#04131c";
      vx.fillText(label, l + 4, ly + 11);
    }
    vx.globalAlpha = 1;
  }

  const pv = { x: 0, y: 0, z: 0, behind: false };
  const tmp3 = new window.THREE.Vector3();
  function drawVision(t) {
    vx.setTransform(visionDpr, 0, 0, visionDpr, 0, 0);
    vx.clearRect(0, 0, S.vw, S.vh);
    const a = S.vision;
    if (a < 0.02) return;
    vx.font = "500 10px 'JetBrains Mono', ui-monospace, Menlo, monospace";
    const focal = S.vh / (2 * Math.tan((D.camera.fov * Math.PI) / 360));
    let count = 0;
    // schools: each fish is its own instance
    D.schools.forEach(function (s) {
      if (!s.mesh.visible) return;
      let shown = 0;
      for (let i = 0; i < s.n && shown < 16; i += 2) {
        const f = s.fish[i];
        tmp3.set(f.x, f.y, f.z);
        const dist = tmp3.distanceTo(D.camera.position);
        if (dist > 20) continue;
        D.project(tmp3, pv);
        if (pv.behind || pv.x < 0 || pv.x > S.vw || pv.y < 60 || pv.y > S.vh) continue;
        const r = Math.max(5, (s.fishLen * 0.62 * focal) / dist);
        bracket(pv.x - r, pv.y - r * 0.62, pv.x + r, pv.y + r * 0.62, s.mask, shown === 0 ? s.label + " " + (0.9 + 0.05 * Math.sin(t + i)).toFixed(2) : "", a * 0.9);
        shown++; count++;
      }
    });
    (D.detectables || []).forEach(function (d, i) {
      const dist = d.pos.distanceTo(D.camera.position);
      if (dist > 19 || dist < 1.5) return;
      D.project(d.pos, pv);
      if (pv.behind) return;
      const r = (d.r * focal) / dist;
      if (pv.x + r < 0 || pv.x - r > S.vw || pv.y + r < 60 || pv.y - r > S.vh || r < 9) return;
      bracket(pv.x - r, pv.y - r * d.k, pv.x + r, pv.y + r * d.k, d.col, d.label + " " + (d.conf + 0.015 * Math.sin(t * 0.7 + i)).toFixed(2), a * 0.75);
      count++;
    });
    D.creatures.forEach(function (c, i) {
      const r = c.rect;
      if (!r.ok || c.school) return;
      const conf = (parseFloat(c.spec.conf) + 0.012 * Math.sin(t * 0.9 + i * 2.1)).toFixed(2);
      bracket(r.l - 6, r.t - 6, r.r + 6, r.b + 6, c.maskHex, c.spec.common + " " + conf, a);
      count++;
    });
    // a quiet status line, bottom left
    vx.globalAlpha = a * 0.85;
    vx.fillStyle = "#5ff0d8";
    vx.fillText("VISION · " + count + " INSTANCE" + (count === 1 ? "" : "S") + " · " + Math.round(S.depthM).toLocaleString("en-US") + " M", 18, S.vh - 18);
    vx.globalAlpha = 1;
  }

  /* ---------- hover label ---------- */

  const who = doc.createElement("div");
  who.className = "who";
  hud.appendChild(who);
  let hovered = null;

  function isControl(target) {
    return !!(target && target.closest && target.closest("a, button, input, textarea, label, .chat, .top, .gauge, .viewpad, .zone-body, .foot-inner, .scan-card"));
  }

  function setHover(c) {
    if (hovered === c) return;
    if (hovered) hovered.hover = false;
    hovered = c;
    doc.documentElement.classList.toggle("can-pick", !!c);
    if (c) {
      c.hover = true;
      const lat = latinHtml(c.spec.latin);
      who.innerHTML = "<b>" + c.spec.name + "</b><span>" + c.spec.common + "</span><small>" + (lat ? lat + " · " : "") + (COARSE ? "tap to talk" : "click to talk") + "</small>";
    }
    who.classList.toggle("show", !!c);
  }

  let overControl = false;
  // Leaning the mouse on the left or right edge of the window steers the slow rotation:
  // -1 at the far left, +1 at the far right, 0 anywhere in the middle or over a control.
  const EDGE = 0.16;
  const cueL = doc.createElement("span"), cueR = doc.createElement("span");
  cueL.className = "edge-cue left"; cueR.className = "edge-cue right";
  hud.appendChild(cueL); hud.appendChild(cueR);
  function setEdge(v) {
    S.edge = v;
    cueL.style.opacity = v < 0 && S.spin ? String(Math.min(1, -v * 1.4)) : "0";
    cueR.style.opacity = v > 0 && S.spin ? String(Math.min(1, v * 1.4)) : "0";
  }
  window.addEventListener("pointermove", function (e) {
    overControl = isControl(e.target);
    let v = 0;
    if (e.pointerType === "mouse" && !overControl && !e.buttons) {
      const fx = e.clientX / S.vw;
      if (fx > 1 - EDGE) v = Math.pow((fx - (1 - EDGE)) / EDGE, 1.6);
      else if (fx < EDGE) v = -Math.pow((EDGE - fx) / EDGE, 1.6);
    }
    setEdge(v);
  }, { passive: true });
  doc.documentElement.addEventListener("mouseleave", function () { setEdge(0); });
  window.addEventListener("blur", function () { setEdge(0); });

  /* ---------- chat ---------- */

  const chat = (function () {
    const panel = doc.createElement("div");
    panel.className = "chat";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.style.pointerEvents = "auto";
    panel.innerHTML =
      '<div class="chat-head">' +
        '<canvas class="chat-avatar" width="116" height="116" aria-hidden="true"></canvas>' +
        '<div class="chat-who"><p class="chat-name"></p><p class="chat-meta"></p></div>' +
        '<button class="chat-close" type="button" aria-label="Close">✕</button>' +
      "</div>" +
      '<ol class="chat-log" aria-live="polite"></ol>' +
      '<div class="chat-chips"></div>' +
      '<form class="chat-say">' +
        '<label class="sr" for="chat-input">Say something</label>' +
        '<input id="chat-input" type="text" maxlength="240" autocomplete="off" enterkeyhint="send">' +
        '<button type="submit">Send</button>' +
      "</form>" +
      '<p class="chat-via">Replies via a free model · LLM7</p>';
    hud.appendChild(panel);
    const avatar = panel.querySelector(".chat-avatar");
    const ax = avatar.getContext("2d");
    const nameEl = panel.querySelector(".chat-name");
    const metaEl = panel.querySelector(".chat-meta");
    const log = panel.querySelector(".chat-log");
    const chips = panel.querySelector(".chat-chips");
    const input = panel.querySelector("input");
    const via = panel.querySelector(".chat-via");
    const label = panel.querySelector("label");
    const histories = new Map();
    const tokens = new Map();
    const busy = new Map();
    const api = { current: null, met: new Set() };

    function history(c) {
      let h = histories.get(c.id);
      if (!h) { h = [{ role: "assistant", content: c.spec.greeting }]; histories.set(c.id, h); }
      return h;
    }

    function fillChips(c) {
      chips.textContent = "";
      const lang = visitorZh ? "zh" : "en";
      const asked = histories.get(c.id) || [];
      const list = c.spec.chips[lang].concat(data.aboutChip[lang]).filter(function (text) {
        return !asked.some(function (m) { return m.role === "user" && m.content === text; });
      });
      list.forEach(function (text) {
        const b = doc.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.addEventListener("click", function () { send(text); });
        chips.appendChild(b);
      });
      chips.hidden = !list.length;
    }

    function render() {
      const c = api.current;
      if (!c) return;
      log.textContent = "";
      history(c).forEach(function (msg) {
        const li = doc.createElement("li");
        li.className = msg.role === "user" ? "me" : "them";
        li.textContent = msg.content;
        log.appendChild(li);
      });
      if (busy.get(c.id)) {
        const li = doc.createElement("li");
        li.className = "them typing";
        li.setAttribute("aria-label", c.spec.name + " is typing");
        li.innerHTML = "<span></span><span></span><span></span>";
        log.appendChild(li);
      }
      fillChips(c);
      if (busy.get(c.id)) chips.hidden = true;
      log.scrollTop = log.scrollHeight;
    }

    api.place = function () {
      const c = api.current;
      if (!c || panel.hidden) return;
      const sheet = S.vw < 720;
      panel.classList.toggle("sheet", sheet);
      if (sheet) { panel.style.left = ""; panel.style.top = ""; return; }
      const pw = panel.offsetWidth, ph = panel.offsetHeight;
      const r = c.rect;
      const margin = 14, head = 70;
      let left, top;
      if (r.ok) {
        // sit beside the animal, on whichever side has room
        left = r.r + 22 + pw < S.vw - margin ? r.r + 22 : r.l - 22 - pw;
        if (left < margin) left = clamp(r.cx - pw / 2, margin, S.vw - pw - margin);
        top = clamp(r.cy - ph / 2, head, S.vh - ph - margin);
        if (left < r.r && left + pw > r.l) top = r.b + 18 + ph < S.vh ? r.b + 18 : Math.max(head, r.t - ph - 18);
      } else {
        left = S.vw - pw - 110;
        top = S.vh - ph - 30;
      }
      panel.style.left = Math.round(clamp(left, margin, S.vw - pw - margin)) + "px";
      panel.style.top = Math.round(clamp(top, head, Math.max(head, S.vh - ph - margin))) + "px";
    };

    api.open = function (c) {
      if (api.current && api.current !== c) api.close(true);
      api.current = c;
      api.met.add(c.id);
      c.talking = true;
      nameEl.textContent = c.spec.name;
      const lat = latinHtml(c.spec.latin);
      const depth = c.pos.y < -0.5 ? Math.round(D.metresAt(c.pos.y)).toLocaleString("en-US") + " m" : "surface";
      metaEl.innerHTML = c.spec.common + (lat ? " · " + lat : "") + " · " + depth;
      panel.setAttribute("aria-label", "Chat with " + c.spec.name);
      label.textContent = "Say something to " + c.spec.name;
      input.placeholder = visitorZh ? "和 " + c.spec.name + " 说点什么" : "Say something to " + c.spec.name;
      via.textContent = "Replies via a free model · LLM7";
      panel.hidden = false;
      render();
      api.place();
      if (!COARSE) input.focus({ preventScroll: true });
    };

    api.close = function () {
      const c = api.current;
      if (!c) return;
      panel.hidden = true;
      c.talking = false;
      api.current = null;
    };

    function systemFor(c, text) {
      const spec = c.spec;
      const zone = ZONES.filter(function (z) { return z.id === spec.zone; })[0] || ZONES[1];
      const chinese = /[一-鿿]/.test(text);
      return [
        "You are " + spec.name + ", a " + spec.common.toLowerCase() + " (" + spec.latin + ") living in the " + zone.place + " of Yiwei Chen's personal homepage.",
        "The page is a live 3D dive from the sea surface down to the seafloor, and visitors can click you to chat.",
        "Your personality: " + spec.persona + ".",
        "You are not Yiwei. Stay in character and speak as yourself: warm, playful and curious, never mean or sarcastic. No emoji, no markdown.",
        "Reply in one to three short sentences.",
        weather.live && weather.text ? "Right now in Hong Kong it is " + weather.text + (weather.temp != null ? ", " + Math.round(weather.temp) + " degrees C" : "") + "; mention it only if it fits naturally." : "",
        chinese ? "The visitor wrote in Chinese. Reply in Chinese only." : "The visitor wrote in English. Reply in English only.",
        "If asked about Yiwei, use only these facts. If you do not know, say so. Do not invent papers, emails, dates, or affiliations.",
        data.facts
      ].join(" ");
    }

    async function send(text) {
      const c = api.current;
      if (!c || !text || busy.get(c.id)) return;
      const spec = c.spec;
      const h = history(c);
      h.push({ role: "user", content: text.slice(0, 240) });
      if (h.length > 10) h.splice(0, h.length - 10);
      const token = (tokens.get(c.id) || 0) + 1;
      tokens.set(c.id, token);
      busy.set(c.id, true);
      render();
      const messages = [{ role: "system", content: systemFor(c, text) }].concat(h);
      let answer = "", source = "";
      try {
        const got = await data.askModel(messages);
        answer = data.cleanReply(got.text, spec.name);
        source = got.via;
        if (!answer) throw new Error("empty");
      } catch (err) {
        answer = data.fallback(spec, text);
        source = "";
      }
      if (tokens.get(c.id) !== token) return;
      busy.set(c.id, false);
      h.push({ role: "assistant", content: answer });
      if (api.current === c) {
        via.textContent = source ? "Replied via " + source : "Offline reply · the models are resting";
        render();
      }
    }

    // A live crop of the scene around whoever is talking, like a camera feed.
    let feedAt = 0;
    api.feed = function (t) {
      const c = api.current;
      if (!c || panel.hidden || t - feedAt < 0.12) return;
      feedAt = t;
      const r = c.rect;
      if (!r.ok) return;
      const gl = D.renderer.domElement;
      const k = gl.width / S.vw;
      const side = clamp(Math.max(r.r - r.l, r.b - r.t) * 1.35, 90, Math.min(S.vw, S.vh));
      const sx = clamp(r.cx - side / 2, 0, S.vw - side), sy = clamp(r.cy - side / 2, 0, S.vh - side);
      try { ax.drawImage(gl, sx * k, sy * k, side * k, side * k, 0, 0, avatar.width, avatar.height); } catch (e) { /* no feed */ }
    };

    panel.querySelector(".chat-close").addEventListener("click", function () { api.close(); });
    panel.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(text);
    });
    doc.addEventListener("keydown", function (event) { if (event.key === "Escape" && api.current) api.close(); });
    return api;
  })();
  D.chat = chat;

  /* ---------- hands on: look around, move an animal, or click one to talk ---------- */

  const DROP = {
    same: ["Wheee!", "Thanks for the lift.", "Nice spot.", "Again! Again!"],
    deeper: ["Too dark down here…", "Brr. Heading back up.", "Wrong depth, friend."],
    shallower: ["Too bright up here!", "My eyes! Back down I go.", "The pressure's all wrong."]
  };
  const quip = doc.createElement("div");
  quip.className = "quip";
  hud.appendChild(quip);
  let quipFor = null, quipUntil = 0;
  function say(c, text) {
    quipFor = c;
    quipUntil = performance.now() + 2400;
    quip.textContent = text;
    quip.classList.add("show");
  }

  const exploreToggle = $("explore-toggle");
  const hint = doc.createElement("p");
  hint.className = "explore-hint mono";
  hint.textContent = COARSE ? "Swipe sideways to look around · scroll to dive · tap an animal to talk" : "Drag to look around · scroll to dive · drag an animal to move it · click one to talk · Esc to return";
  hud.appendChild(hint);
  function setExplore(on) {
    S.explore = on;
    S.dirty = true;
    doc.body.classList.toggle("explore", on);
    if (exploreToggle) exploreToggle.setAttribute("aria-pressed", on ? "true" : "false");
  }
  if (exploreToggle) exploreToggle.addEventListener("click", function () { setExplore(!S.explore); });
  doc.addEventListener("keydown", function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest("input, textarea"))) return;
    if (e.key === "e" || e.key === "E") setExplore(!S.explore);
    else if (e.key === "Escape" && S.explore && !chat.current) setExplore(false);
    else if (S.explore && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { D.lookBy(e.key === "ArrowLeft" ? 70 : -70, 0); e.preventDefault(); }
  });

  /* ---------- view pad: a stick to steer the view, slow rotation, and a way home ---------- */

  (function viewpad() {
    const pad = $("viewpad-pad"), knob = $("viewpad-knob"), ring = $("viewpad-ring"), spinBtn = $("spin-toggle"), resetBtn = $("look-reset");
    if (!pad) return;
    function setSpin(on) {
      S.spin = on;
      S.look.homing = false;
      S.dirty = true;
      spinBtn.setAttribute("aria-pressed", on ? "true" : "false");
      doc.body.classList.toggle("spinning", on);
    }
    D.setSpin = setSpin;
    // on for every visit, unless the visitor's system asks for less motion
    setSpin(!S.reduced);
    spinBtn.addEventListener("click", function () { S.look.at = -99; setSpin(!S.spin, true); });
    resetBtn.addEventListener("click", function () { setSpin(false, true); D.lookHome(); });
    doc.addEventListener("keydown", function (e) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target.closest && e.target.closest("input, textarea"))) return;
      if (e.key === "r" || e.key === "R") { S.look.at = -99; setSpin(!S.spin, true); }
    });

    // the stick: how far it is pushed sets how fast the view turns
    let active = false;
    function steer(e) {
      const r = pad.getBoundingClientRect();
      const R = r.width / 2;
      let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
      const l = Math.hypot(dx, dy);
      if (l > 1) { dx /= l; dy /= l; }
      knob.style.transform = "translate(" + (dx * R * 0.56).toFixed(1) + "px," + (dy * R * 0.56).toFixed(1) + "px)";
      const dead = function (v) { return Math.abs(v) < 0.12 ? 0 : v * Math.abs(v); };
      S.look.vy = -dead(dx) * 0.85;
      S.look.vp = -dead(dy) * 0.55;
      S.look.homing = false;
      S.look.held = true;
      S.dirty = true;
    }
    function letGo() {
      if (!active) return;
      active = false;
      S.look.vy = 0; S.look.vp = 0; S.look.held = false; S.look.at = S.t;
      knob.style.transform = "";
      pad.classList.remove("held");
    }
    pad.addEventListener("pointerdown", function (e) {
      active = true;
      pad.classList.add("held");
      if (pad.setPointerCapture) { try { pad.setPointerCapture(e.pointerId); } catch (err) { /* not capturable */ } }
      steer(e);
      e.preventDefault();
    });
    pad.addEventListener("pointermove", function (e) { if (active) steer(e); });
    pad.addEventListener("pointerup", letGo);
    pad.addEventListener("pointercancel", letGo);
    pad.addEventListener("lostpointercapture", letGo);
    pad.addEventListener("keydown", function (e) {
      const step = { ArrowLeft: [70, 0], ArrowRight: [-70, 0], ArrowUp: [0, 50], ArrowDown: [0, -50] }[e.key];
      if (step) { D.lookBy(step[0], step[1]); e.preventDefault(); }
      else if (e.key === "Home") { setSpin(false, true); D.lookHome(); e.preventDefault(); }
    });

    const NAMES = ["forward", "right", "behind", "left"];
    let shown = "";
    D.onAfter(function () {
      // the ring carries a mark for "forward", so it reads like a compass
      ring.style.transform = "rotate(" + (S.look.yaw * 180 / Math.PI).toFixed(1) + "deg)";
      let deg = (-S.look.yaw * 180 / Math.PI) % 360;
      if (deg < 0) deg += 360;
      const name = "Facing " + NAMES[Math.round(deg / 90) % 4];
      if (name !== shown) { shown = name; pad.setAttribute("aria-valuetext", name); }
      // hold still while someone is being talked to, picked up or pointed at
      S.spinHold = !!(chat.current || hovered || (down && down.mode));
    });
  })();

  const far = new window.THREE.Vector3();
  const grab = { origin: new window.THREE.Vector3(), dir: new window.THREE.Vector3() };
  let down = null;

  window.addEventListener("pointerdown", function (e) {
    if (e.button > 0) return;
    const control = isControl(e.target);
    down = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, t: performance.now(), control: control, c: control ? null : D.pick(e.clientX, e.clientY), mode: null, touch: e.pointerType === "touch" };
  }, { passive: true });

  window.addEventListener("pointermove", function (e) {
    const d = down;
    if (!d || d.control) return;
    if (!d.mode) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7) return;
      // on a touch screen a vertical swipe is the page scrolling; leave it be
      if (d.touch && !d.c && Math.abs(e.clientY - d.y) > Math.abs(e.clientX - d.x)) { down = null; return; }
      d.mode = d.c ? "drag" : "look";
      if (d.c) d.dist = D.camera.position.distanceTo(d.c.pos);
      else S.look.held = true;
      doc.body.classList.add("grabbing");
      const sel = window.getSelection && window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    if (d.mode === "look") {
      D.lookBy(e.clientX - d.lx, d.touch ? 0 : e.clientY - d.ly);
    } else {
      D.rayAt((e.clientX / S.vw) * 2 - 1, -((e.clientY / S.vh) * 2 - 1), grab);
      far.copy(grab.origin).addScaledVector(grab.dir, d.dist);
      D.dragTo(d.c, far);
    }
    d.lx = e.clientX; d.ly = e.clientY;
  }, { passive: true });

  function release(e) {
    const d = down;
    down = null;
    S.look.held = false;
    doc.body.classList.remove("grabbing");
    if (!d) return;
    if (d.mode === "drag") {
      const c = d.c;
      c.held = false;
      D.poke(c);
      const moved = c.offset.y;
      say(c, pick(c.pos.y > 0 ? DROP.same : moved > 7 ? DROP.shallower : moved < -7 ? DROP.deeper : DROP.same));
      return;
    }
    if (d.mode === "look" || d.control || e.type === "pointercancel" || isControl(e.target)) return;
    if (performance.now() - d.t > 700) return;
    if (window.getSelection && String(window.getSelection())) return;
    const c = d.c || D.pick(e.clientX, e.clientY);
    if (c) { D.poke(c); chat.open(c); return; }
    if (chat.current) { chat.close(); return; }
    if (S.under) {
      D.rayAt((e.clientX / S.vw) * 2 - 1, -((e.clientY / S.vh) * 2 - 1), grab);
      far.copy(grab.origin).addScaledVector(grab.dir, 3.6);
      D.spawnBubbles(far.x, far.y, far.z, 12, 0.5, 0.08);
    }
  }
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
  window.addEventListener("dblclick", function (e) { if (!isControl(e.target) && !D.pick(e.clientX, e.clientY)) { if (D.setSpin) D.setSpin(false, true); D.lookHome(); } });

  // Keyboard and screen-reader route to the same conversations.
  (function roster() {
    const nav = doc.createElement("nav");
    nav.className = "sr";
    nav.setAttribute("aria-label", "Talk to the animals");
    nav.style.pointerEvents = "auto";
    data.list.forEach(function (spec) {
      const b = doc.createElement("button");
      b.type = "button";
      b.textContent = "Talk to " + spec.name + ", the " + spec.common.toLowerCase();
      b.addEventListener("click", function () {
        const c = D.creature(spec.id);
        if (!c) return;
        window.scrollTo({ top: D.scrollForY(c.home.y + (c.home.y > 0 ? 0 : 1.5)), behavior: "auto" });
        window.setTimeout(function () { chat.open(c); }, 350);
      });
      nav.appendChild(b);
    });
    hud.appendChild(nav);
  })();

  /* ---------- frame ---------- */

  window.addEventListener("scroll", function () { if (chat.current) chat.place(); }, { passive: true });

  D.onAfter(function (dt, t) {
    updateWhere();
    drawVision(t);
    const p = S.pointer;
    const c = !COARSE && p.active && !overControl && !(down && down.mode) && !quipFor ? D.pick(p.cx, p.cy) : null;
    setHover(c);
    if (hovered && hovered.rect.ok) {
      who.style.left = Math.round(clamp(hovered.rect.cx, 90, S.vw - 90)) + "px";
      who.style.top = Math.round(Math.max(74, hovered.rect.t - 12)) + "px";
    } else if (hovered) setHover(null);
    chat.feed(t);
    if (quipFor) {
      if (performance.now() > quipUntil || !quipFor.rect.ok) { quip.classList.remove("show"); quipFor = null; }
      else {
        quip.style.left = Math.round(clamp(quipFor.rect.cx, 70, S.vw - 70)) + "px";
        quip.style.top = Math.round(Math.max(74, quipFor.rect.t - 10)) + "px";
      }
    }
  });

  D.start();
  submerged = S.under;
  tone();
})();
