/* Fleeting light, pixel sea animals, and talk.
   Talk uses LLM7's anonymous tier (https://api.llm7.io). The key "unused"
   is that service's public placeholder, not a secret. */
(function () {
  const PAL = {
    ".": null,
    k: "#243330",
    d: "#1a4743",
    s: "#3f7f76",
    g: "#a9d2c8",
    p: "#f3eee4",
    y: "#e2c48a",
    w: "#fffcf7",
    n: "#1b1e1d",
    c: "#d9896a"
  };

  function grid(lines) {
    const w = lines[0].length;
    lines.forEach(function (line, i) {
      if (line.length !== w) {
        throw new Error("sprite row " + i + " is " + line.length + ", expected " + w + ": [" + line + "]");
      }
      for (let x = 0; x < line.length; x++) {
        if (!Object.prototype.hasOwnProperty.call(PAL, line[x])) {
          throw new Error("unknown pixel '" + line[x] + "'");
        }
      }
    });
    return lines;
  }

  const SPRITES = {
    fish: [
      grid([
        "........................",
        "..........cc............",
        "........ddssdd..........",
        "......ddssssssdd........",
        ".....dssggssssssd.......",
        "....dssssssssssssd......",
        "...ddssssssnwsssdd......",
        "....dsssssssssssd.......",
        ".....dsssssssssd........",
        "......ddssssdd..........",
        "........d..d............",
        "........................"
      ]),
      grid([
        "........................",
        "........cc..............",
        "..........ddssdd........",
        "......ddssssssdd........",
        ".....dssggssssssd.......",
        "....dssssssssssssd......",
        "..ddsssssssnwsssdd......",
        "....dsssssssssssd.......",
        ".....ddsssssssdd........",
        ".......dd..dd...........",
        "........................",
        "........................"
      ])
    ],
    jelly: [
      grid([
        "................",
        "....dddddd......",
        "..ddssssssdd....",
        ".dssggggggssd...",
        ".dsggpggpgggd...",
        ".dssggnngggd....",
        ".dssggggggssd...",
        "..ddssssssdd....",
        "....dddddd......",
        "....ss..ss..ss..",
        "...ss..ss..ss...",
        "..ss..ss...ss...",
        "...ss..ss..ss...",
        "....ss....ss....",
        "................",
        "................"
      ]),
      grid([
        "................",
        "....dddddd......",
        "..ddssssssdd....",
        ".dssggggggssd...",
        ".dsggpggpgggd...",
        ".dssggnngggd....",
        ".dssggggggssd...",
        "..ddssssssdd....",
        "....dddddd......",
        "...ss...ss..ss..",
        "....ss..ss...ss.",
        ".ss...ss..ss....",
        "..ss..ss...ss...",
        "...ss....ss.....",
        "................"
      ])
    ],
    turtle: [
      grid([
        "............................",
        ".........yyyyyy.............",
        ".......yyyyyyyyyy...........",
        "......yyyyyyyyyyyy..........",
        ".....yyyyyggyyyyyyy.........",
        "....yyyyyyyyyyyyyyyy........",
        "...yyyyyyyyyyyyyyyyyy.dd....",
        "..syyyyyyyyyyyyyyyyyyddnd...",
        "...yyyyyyyyyyyyyyyyyy.dspd..",
        "....yyyyyyyyyyyyyyyy..dddd..",
        ".....yyyyyyyyyyyyyy.........",
        "....ssss..........ssss......",
        "...s..................s.....",
        "....ss..............ss......",
        "............................"
      ]),
      grid([
        "............................",
        ".........yyyyyy.............",
        ".......yyyyyyyyyy...........",
        "......yyyyyyyyyyyy..........",
        ".....yyyyyggyyyyyyy.........",
        "....yyyyyyyyyyyyyyyy........",
        "...yyyyyyyyyyyyyyyyyy.dd....",
        ".s.yyyyyyyyyyyyyyyyyyddnd...",
        "...yyyyyyyyyyyyyyyyyy.dspd..",
        "....yyyyyyyyyyyyyyyy..dddd..",
        ".....yyyyyyyyyyyyyy.........",
        "..ss................ss......",
        ".s....................s.....",
        "..ss................ss......",
        "............................"
      ])
    ],
    horse: [
      grid([
        "..............",
        ".....dddd.....",
        "....dssssd....",
        "...dsnwsssd...",
        "...dsssssd....",
        "....dddddd....",
        ".....dssd.....",
        "....dsssd.....",
        "...dssssd.....",
        "....dsssd.....",
        ".....dddd.....",
        "......dd......",
        ".....dd.......",
        "....dsd.......",
        "...dssd.......",
        "....dd........",
        ".....d........",
        "....dd........",
        "...dd.........",
        ".............."
      ]),
      grid([
        "..............",
        ".....dddd.....",
        "....dssssd....",
        "...dsnwsssd...",
        "...dsssssd....",
        "....dddddd....",
        ".....dssd.....",
        "....dsssd.....",
        "...dssssd.....",
        "....dsssd.....",
        ".....dddd.....",
        "......dd......",
        ".......dd.....",
        "......dsd.....",
        ".....dssd.....",
        "......dd......",
        ".......d......",
        "......dd......",
        ".......dd.....",
        ".............."
      ])
    ]
  };

  const FACTS = [
    "Yiwei Chen (陈奕玮), also called Jackson, is a third-year PhD student in the Department of Computer Science and Engineering at The Hong Kong University of Science and Technology (HKUST), Hong Kong SAR.",
    "He studies marine vision intelligence: computer vision for marine and biology research, including recognition and the boundary between 2D and 3D vision.",
    "He works closely with Prof. Ziqiang Zheng (UESTC) and is supervised by Prof. Sai-Kit Yeung.",
    "Education: PhD in CSE at HKUST, 2024–present; MSc in Information Technology at HKUST, 2023–2024; BEng in Telecommunications at Huazhong University of Science and Technology, 2019–2023. His undergraduate innovation program was with Prof. Xiaojun Hei, and his final-year project was with Prof. Xinggang Wang.",
    "Papers: MaskGuide (RA-L 2026); ORCA (WACV 2026, oral); MarineInst (ECCV 2024, oral, and an Oral Presentation Award); an arXiv 2024 case study on GPT-4V for marine analysis.",
    "Teaching assistant at HKUST for COMP 2211 Exploring Artificial Intelligence (Spring 2025 and Fall 2025) and MSBD 6000Q Vision Language Models for Vision Tasks (Fall 2025). Outstanding PG Teaching Assistant Honorable Mention, 2025–26.",
    "Visiting student at UESTC, Chengdu, August–November 2026.",
    "Public email: jackson.chen.yiwei@gmail.com and ychenmb@connect.ust.hk."
  ].join(" ");

  const ANIMALS = [
    {
      id: "git",
      name: "Git",
      kind: "fish",
      species: "reef fish",
      flips: true,
      greeting: "I stay near the edge, where the light passes.",
      localEn: "The water went quiet. Ask me once more?",
      localZh: "潮水有点吵，我没听清。再说一次？"
    },
    {
      id: "conda",
      name: "Conda",
      kind: "jelly",
      species: "jellyfish",
      flips: false,
      greeting: "You caught me between one light and the next.",
      localEn: "That light went out before I could answer.",
      localZh: "那道光灭得太快了。你再说一次？"
    },
    {
      id: "python",
      name: "Python",
      kind: "turtle",
      species: "sea turtle",
      flips: true,
      greeting: "I am in no hurry. Say what you like.",
      localEn: "I am still catching up. Try once more?",
      localZh: "我慢，没跟上。再说一次？"
    },
    {
      id: "pip",
      name: "Pip",
      kind: "horse",
      species: "seahorse",
      flips: false,
      greeting: "Hello. The current here is gentle.",
      localEn: "I lost the thread of that. Once more?",
      localZh: "我走神了。再说一次？"
    }
  ];

  const DAY_MARKS = {
    morning: [
      grid([
        "................",
        "................",
        "................",
        "................",
        "................",
        ".......y........",
        "......yyy.......",
        ".....yyyyy......",
        ".....ycyyy......",
        "......yyy.......",
        ".......y........",
        "................",
        "................",
        "................",
        "................",
        "................"
      ]),
      grid([
        "................",
        "................",
        "................",
        "................",
        "................",
        "......y.y.......",
        ".......y........",
        ".....yyyyy......",
        ".....ycyyy......",
        ".......y........",
        "......y.y.......",
        "................",
        "................",
        "................",
        "................",
        "................"
      ])
    ],
    afternoon: [
      grid([
        "................",
        ".......y........",
        "....y..y..y.....",
        "......yyyy......",
        ".y...yyyyyy...y.",
        ".....yyyyyyy....",
        ".y..yyyyyyyy..y.",
        ".....yyyyyyy....",
        ".y...yyyyyy...y.",
        "......yyyy......",
        "....y..y..y.....",
        ".......y........",
        "................",
        "................",
        "................",
        "................"
      ]),
      grid([
        "................",
        "................",
        "....y.......y...",
        ".......yyyy.....",
        ".....yyyyyyy....",
        "...yyyyyyyyyy...",
        ".y.yyyyyyyyyy.y.",
        "...yyyyyyyyyy...",
        ".....yyyyyyy....",
        ".......yyyy.....",
        "....y.......y...",
        "................",
        "................",
        "................",
        "................",
        "................"
      ])
    ],
    night: [
      grid([
        "................",
        "................",
        ".......k........",
        "......kpk.......",
        ".....kppk.......",
        "....kpppkk......",
        "....kpp..k......",
        "....kpppkk......",
        ".....kppk.......",
        "......kpk.......",
        ".......k........",
        "................",
        ".ww.............",
        "................",
        "................",
        "................"
      ]),
      grid([
        "................",
        "................",
        ".......k........",
        "......kpk.......",
        ".....kppk.......",
        "....kpppkk......",
        "....kpp..k......",
        "....kpppkk......",
        ".....kppk.......",
        "......kpk.......",
        ".......k........",
        "................",
        ".............ww.",
        "................",
        "................",
        "................"
      ])
    ]
  };

  const GREETINGS = {
    en: { morning: "Good morning", afternoon: "Good afternoon", night: "Good night" },
    zh: { morning: "早上好", afternoon: "下午好", night: "晚安" }
  };

  const SEA_LIFE = {
    fish: grid([
      "..............",
      ".....ss.......",
      "...ssggsss....",
      "..ssssnwssss..",
      "...ssssssss...",
      "....ss..ss....",
      ".............."
    ]),
    shark: grid([
      "....................",
      ".......k............",
      "......kkk...........",
      "....kksssskk........",
      "...ksssssssssk......",
      "..kssssswnsssssk....",
      "...ksssssssssk......",
      ".....kkkkkkk........"
    ]),
    turtle: grid([
      "................",
      "....yyyyyy......",
      "...yykyyyy......",
      "..yyyyyyyyk.....",
      "..yyyyyyynk.....",
      "...yyyyyyy......",
      "..s..y..y..s....",
      "................"
    ]),
    diver: grid([
      "................",
      "......kk........",
      ".....kssk.......",
      "....kssssk.k....",
      "...kssssssksk...",
      "....kkkkkk.ss...",
      ".......s..ss....",
      ".......ss.......",
      "................"
    ])
  };

  const SURFER = [
    grid([
      "...kkkkkk.......",
      "..kkkkkkkk......",
      "...kccccck......",
      "...knnnnnk......",
      "....cccccc......",
      "...kcccccck.....",
      "..kkcccccckk....",
      "...kccccccck....",
      "....yyyyyyy.....",
      "....kyyyyyyk....",
      ".....kccck......",
      ".....kccck......",
      "....k....k......",
      "...k......k.....",
      "..yyyyyyyyyyyy..",
      ".yyyyyyyyyyyyyy."
    ]),
    grid([
      "...kkkkkk.......",
      "..kkkkkkkk......",
      "...kccccck......",
      "...knnnnnk......",
      "....cccccc......",
      "..k.kccccck.k...",
      ".kkkkccccckkkk..",
      "...kccccccck....",
      "....yyyyyyy.....",
      "....kyyyyyyk....",
      ".....kccck......",
      "....kcccck......",
      "...k......k.....",
      "..k........k....",
      ".yyyyyyyyyyyyyy.",
      "yyyyyyyyyyyyyyyy"
    ])
  ];

  const DIVER_MASK = [
    grid([
      "......kk........",
      "......kk........",
      "..kkkkkkkkkk....",
      ".kggggggggggk...",
      ".kgwwggggwwgk...",
      ".kggggggggggk...",
      "..kkkkkkkkkk....",
      ".....k..k.......",
      "....kk..kk......",
      "................"
    ]),
    grid([
      "......kk........",
      "......kk........",
      "..kkkkkkkkkk....",
      ".kgwwggggwwgk...",
      ".kgwwggggwwgk...",
      ".kggggggggggk...",
      "..kkkkkkkkkk....",
      ".....k..k.......",
      "....kk..kk......",
      "................"
    ])
  ];

  const CURSOR_FISH = [
    grid([
      "..............",
      ".....ss.......",
      "...ssggsss....",
      "..ssssnwssss..",
      ".ssssssssssss.",
      "..ssssssssss..",
      "...ss....ss...",
      "..............",
      ".............."
    ]),
    grid([
      "..............",
      "....ss........",
      "..ssggssss....",
      ".sssssnwssss..",
      "sssssssssssss.",
      "..sssssssss...",
      "....ss..ss....",
      "..............",
      ".............."
    ]),
    grid([
      "..w...........",
      ".....ss.......",
      "...ssggsss....",
      "..ssssnwssss..",
      ".ssssssssssss.",
      "..ssssssssss..",
      "...ss....ss...",
      "..............",
      ".............."
    ])
  ];

  function boot() {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reduce.matches;
    reduce.addEventListener("change", function (event) {
      reduced = event.matches;
    });

    const day = setupDay(function () { return reduced; });
    const lights = setupLights(function () { return reduced; });
    const sea = setupSea(function () { return reduced; });
    const cursor = setupCursor(function () { return reduced; });
    const creatures = setupCreatures(lights, function () { return reduced; });
    setupNav();

    let last = performance.now();
    let rafId = 0;
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        day.tick(now);
        lights.tick(dt, now);
        sea.tick(dt, now);
        cursor.tick(dt, now);
        creatures.tick(dt, now);
      } catch (err) {
        console.error(err);
      }
      rafId = requestAnimationFrame(frame);
    }
    function wake() {
      last = performance.now();
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(frame);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") cursor.release();
      else wake();
    });
    window.addEventListener("blur", function () { cursor.release(); });
    window.addEventListener("focus", wake);
    window.addEventListener("pageshow", wake);
    wake();
  }

  function spriteSheet(rows) {
    const canvas = document.createElement("canvas");
    paint(canvas, rows);
    return canvas;
  }

  function setupSea(isReduced) {
    const canvas = document.getElementById("sea");
    if (!canvas) return { tick: function () {} };
    const ctx = canvas.getContext("2d");
    const sheets = {};
    Object.keys(SEA_LIFE).forEach(function (name) {
      sheets[name] = spriteSheet(SEA_LIFE[name]);
    });
    const surferFrames = SURFER.map(spriteSheet);
    const waves = [
      { y: 0.58, amp: 8, k: 0.010, speed: 0.85, color: "rgba(30, 74, 70, 0.13)" },
      { y: 0.74, amp: 12, k: 0.008, speed: 0.55, color: "rgba(63, 127, 118, 0.16)" },
      { y: 0.86, amp: 16, k: 0.006, speed: 0.38, color: "rgba(30, 74, 70, 0.15)" }
    ];
    const swimmers = [];
    const drops = [];
    let gust = null;
    let nextGust = 6;
    let nextSpawn = 0.4;
    const kinds = ["fish", "shark", "turtle", "diver"];

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function level(wave, x, time) {
      let y = window.innerHeight * wave.y + Math.sin(x * wave.k + time * wave.speed) * wave.amp;
      if (gust) {
        const dist = x - gust.x;
        const reach = Math.abs(dist) / gust.width;
        if (reach < 1) {
          const n = Math.cos(reach * Math.PI * 0.5);
          y += Math.sin(x * wave.k + time * wave.speed + Math.PI) * wave.amp * 3.1 * n * gust.power;
        }
      }
      return y;
    }

    function spawnSwimmer() {
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const fromLeft = Math.random() < 0.5;
      const sheet = sheets[kind];
      swimmers.push({
        kind: kind,
        sheet: sheet,
        wave: 1 + Math.floor(Math.random() * 2),
        x: fromLeft ? -sheet.width * 3 : window.innerWidth + sheet.width,
        dir: fromLeft ? 1 : -1,
        speed: 36 + Math.random() * 58,
        scale: 2,
        kick: 0
      });
    }

    function spawnSurfer(enter) {
      const fromLeft = Math.random() < 0.5;
      swimmers.push({
        kind: "surfer",
        frames: surferFrames,
        sheet: surferFrames[0],
        wave: 2,
        x: enter ? window.innerWidth * 0.32 : (fromLeft ? -50 : window.innerWidth + 50),
        dir: enter ? 1 : (fromLeft ? 1 : -1),
        speed: 62 + Math.random() * 24,
        scale: 4,
        surfer: true,
        kick: 0
      });
    }

    function spawnGust() {
      const fromLeft = Math.random() < 0.5;
      gust = {
        x: fromLeft ? -180 : window.innerWidth + 180,
        vx: (fromLeft ? 1 : -1) * (220 + Math.random() * 80),
        width: 150 + Math.random() * 70,
        power: 0,
        age: 0
      };
    }

    resize();
    window.addEventListener("resize", resize);
    spawnSwimmer();
    spawnSurfer(true);

    function tick(dt, now) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const time = isReduced() ? 0 : now / 1000;
      ctx.clearRect(0, 0, w, h);
      if (!isReduced()) {
        nextGust -= dt;
        nextSpawn -= dt;
        if (nextSpawn <= 0 && swimmers.length < 5) {
          spawnSwimmer();
          nextSpawn = 3.5 + Math.random() * 4;
        }
        if (!swimmers.some(function (fish) { return fish.surfer; })) spawnSurfer(false);
        if (!gust && nextGust <= 0) {
          spawnGust();
          nextGust = 16 + Math.random() * 12;
        }
        if (gust) {
          gust.age += dt;
          gust.x += gust.vx * dt;
          gust.power = Math.sin(Math.min(1, gust.age / 0.6) * Math.PI);
          if ((gust.vx > 0 && gust.x > w + gust.width) || (gust.vx < 0 && gust.x < -gust.width)) {
            gust = null;
          } else if (Math.random() < 0.45) {
            drops.push({
              x: gust.x,
              y: level(waves[2], gust.x, time),
              vx: (Math.random() - 0.5) * 40,
              vy: -30 - Math.random() * 50,
              life: 0.7 + Math.random() * 0.4
            });
          }
        }
      }

      waves.forEach(function (wave, index) {
        ctx.beginPath();
        for (let x = 0; x <= w; x += 8) {
          const y = level(wave, x, time);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = wave.color;
        ctx.lineWidth = index === 2 ? 1.6 : 1.15;
        ctx.stroke();
        if (index === 2) {
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fillStyle = gust ? "rgba(176, 214, 204, 0.16)" : "rgba(63, 127, 118, 0.045)";
          ctx.fill();
        }
      });

      for (let i = swimmers.length - 1; i >= 0; i--) {
        const fish = swimmers[i];
        if (!isReduced()) {
          if (gust && Math.abs(fish.x - gust.x) < gust.width * 0.45) fish.kick = 0.55;
          if (fish.kick > 0) {
            fish.x += gust.vx * dt * 0.35;
            fish.kick -= dt;
          }
          fish.x += fish.dir * fish.speed * dt;
        }
        if (fish.x < -80 || fish.x > w + 80) {
          swimmers.splice(i, 1);
          continue;
        }
        const y = level(waves[fish.wave], fish.x, time);
        const ahead = level(waves[fish.wave], fish.x + 12 * fish.dir, time);
        if (fish.frames) fish.sheet = fish.frames[Math.floor(time * 4) % fish.frames.length];
        const sheet = fish.sheet;
        const scale = fish.scale || 2;
        ctx.save();
        ctx.translate(fish.x, y);
        ctx.rotate(Math.atan2(ahead - y, 12));
        ctx.scale(fish.dir * scale, scale);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(sheet, -sheet.width / 2, -sheet.height);
        ctx.restore();
      }

      for (let i = drops.length - 1; i >= 0; i--) {
        const drop = drops[i];
        drop.life -= dt;
        if (drop.life <= 0) {
          drops.splice(i, 1);
          continue;
        }
        drop.vy += 90 * dt;
        drop.x += drop.vx * dt;
        drop.y += drop.vy * dt;
        ctx.fillStyle = "rgba(255, 252, 247, " + Math.max(0, drop.life) + ")";
        ctx.fillRect(drop.x, drop.y, 2, 2);
      }
    }

    return { tick: tick };
  }

  function setupCursor(isReduced) {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const host = document.getElementById("pointer");
    const bubbleCanvas = document.getElementById("bubbles");
    if (!fine || !host || !bubbleCanvas) return { tick: function () {}, release: function () {} };
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    paint(canvas, DIVER_MASK[0]);
    const bctx = bubbleCanvas.getContext("2d");
    const bubbles = [];
    let x = -80;
    let y = -80;
    let tx = -80;
    let ty = -80;
    let hot = false;
    let active = false;
    let frame = 0;
    let nextBubble = 0;

    function resizeBubbles() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      bubbleCanvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      bubbleCanvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function showMask(event) {
      const target = event.target && event.target.closest ? event.target : null;
      const typing = target && target.closest("input, textarea");
      tx = event.clientX;
      ty = event.clientY;
      active = !typing;
      hot = !typing && !!(target && target.closest("a, button, .sprite"));
      host.style.display = active ? "block" : "none";
      document.body.classList.toggle("sea-cursor", active);
    }

    function release() {
      active = false;
      hot = false;
      host.style.display = "none";
      document.body.classList.remove("sea-cursor");
      document.body.classList.remove("dragging");
    }

    resizeBubbles();
    window.addEventListener("resize", resizeBubbles);
    window.addEventListener("pointermove", showMask);
    window.addEventListener("pointerdown", showMask);
    window.addEventListener("pointerleave", release);
    document.addEventListener("mouseleave", release);

    return {
      release: release,
      tick: function (dt, now) {
        bctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (!active) {
          bubbles.length = 0;
          return;
        }
        const follow = Math.min(1, dt * (hot ? 24 : 16));
        x += (tx - x) * follow;
        y += (ty - y) * follow;
        const next = hot ? 1 : 0;
        if (next !== frame) {
          frame = next;
          paint(canvas, DIVER_MASK[next]);
        }
        const w = host.offsetWidth || 34;
        const h = host.offsetHeight || 30;
        host.style.left = (x - w / 2) + "px";
        host.style.top = (y - h / 2) + "px";
        host.style.transform = "none";
        if (!isReduced()) {
          nextBubble -= dt;
          if (nextBubble <= 0) {
            bubbles.push({
              x: x + (Math.random() - 0.5) * 8,
              y: y + 8,
              born: y + 8,
              r: 2.1,
              vx: (Math.random() - 0.5) * 10,
              vy: -32 - Math.random() * 18,
              pop: 0
            });
            nextBubble = hot ? 0.12 : 0.28;
          }
        }
        for (let i = bubbles.length - 1; i >= 0; i--) {
          const bubble = bubbles[i];
          if (bubble.pop > 0) {
            bubble.pop += dt;
            const t = bubble.pop / 0.22;
            bctx.beginPath();
            bctx.arc(bubble.x, bubble.y, bubble.r * (1 + t * 0.8), 0, Math.PI * 2);
            bctx.strokeStyle = "rgba(63, 127, 118, " + Math.max(0, 1 - t) + ")";
            bctx.lineWidth = 1.2;
            bctx.stroke();
            if (t >= 1) bubbles.splice(i, 1);
            continue;
          }
          bubble.x += bubble.vx * dt;
          bubble.y += bubble.vy * dt;
          const rise = bubble.born - bubble.y;
          bubble.r = 2.1 + rise * 0.055;
          if (rise > 150 || bubble.r > 14 || bubble.y < 28) {
            bubble.pop = 0.001;
            continue;
          }
          bctx.beginPath();
          bctx.arc(bubble.x, bubble.y, bubble.r, 0, Math.PI * 2);
          bctx.fillStyle = "rgba(214, 236, 230, 0.35)";
          bctx.fill();
          bctx.strokeStyle = "rgba(30, 74, 70, 0.55)";
          bctx.lineWidth = 1;
          bctx.stroke();
          bctx.beginPath();
          bctx.arc(bubble.x - bubble.r * 0.28, bubble.y - bubble.r * 0.3, Math.max(0.6, bubble.r * 0.22), 0, Math.PI * 2);
          bctx.fillStyle = "rgba(255, 252, 247, 0.8)";
          bctx.fill();
        }
      }
    };
  }

  function visitorZone() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) return zone;
    } catch (err) { /* keep the Hong Kong default */ }
    return "Asia/Hong_Kong";
  }

  function visitorLang() {
    const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || "en"];
    return String(list[0] || "en").toLowerCase();
  }

  function hourIn(date, zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: zone,
        hour: "2-digit",
        hourCycle: "h23"
      }).formatToParts(date);
      const hour = parts.find(function (part) { return part.type === "hour"; });
      const value = Number(hour ? hour.value : "0");
      return value === 24 ? 0 : value;
    } catch (err) {
      return (date.getUTCHours() + 8) % 24;
    }
  }

  function partOfDay(hour) {
    if (hour >= 5 && hour < 12) return "morning";
    if (hour >= 12 && hour < 18) return "afternoon";
    return "night";
  }

  function zoneLabel(zone) {
    if (zone === "Asia/Hong_Kong" || zone === "Asia/Macau") return "HKT";
    if (zone === "Asia/Shanghai" || zone === "Asia/Chongqing" || zone === "Asia/Harbin") return "BJT";
    const city = zone.split("/").pop().replace(/_/g, " ");
    return city.length > 14 ? city.slice(0, 14) : city;
  }

  function setupDay(isReduced) {
    const hello = document.getElementById("hello");
    const helloText = document.getElementById("hello-text");
    const mark = document.getElementById("hello-mark");
    const clock = document.getElementById("clock");
    const clockTime = document.getElementById("clock-time");
    const clockZone = document.getElementById("clock-zone");
    const zone = visitorZone();
    const lang = visitorLang();
    const chinese = lang.indexOf("zh") === 0;
    let shown = "";
    let frame = -1;

    if (hello) hello.classList.toggle("hello-zh", chinese);
    if (clock) clock.title = zone;
    if (clockZone) clockZone.textContent = zoneLabel(zone);

    function render(now) {
      const date = new Date();
      const part = partOfDay(hourIn(date, zone));
      const phrase = (chinese ? GREETINGS.zh : GREETINGS.en)[part];
      if (helloText && phrase !== shown) {
        shown = phrase;
        helloText.textContent = phrase;
        if (hello) hello.lang = chinese ? "zh-Hans" : "en";
      }
      if (mark) {
        const frames = DAY_MARKS[part];
        const next = isReduced() ? 0 : Math.floor(now / 700) % frames.length;
        if (next !== frame) {
          frame = next;
          paint(mark, frames[next]);
        }
        const bob = isReduced() ? 0 : Math.sin(now / 520) * 1.1;
        mark.style.transform = "translateY(" + bob + "px)";
      }
      if (clockTime) {
        try {
          clockTime.textContent = new Intl.DateTimeFormat("en-GB", {
            timeZone: zone,
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hourCycle: "h23"
          }).format(date);
        } catch (err) {
          clockTime.textContent = date.toLocaleTimeString("en-GB", { hour12: false });
        }
      }
      if (clock) clock.dateTime = date.toISOString();
    }

    render(performance.now());
    return { tick: render };
  }

  function setupNav() {
    const links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
    const sections = links.map(function (link) {
      return document.querySelector(link.getAttribute("href"));
    }).filter(Boolean);
    if (!("IntersectionObserver" in window) || !sections.length) return;
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        links.forEach(function (link) {
          link.classList.toggle("is-here", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -48% 0px", threshold: 0.01 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  function setupLights(isReduced) {
    const canvas = document.getElementById("lights");
    const ctx = canvas.getContext("2d");
    const motes = [];
    const ripples = [];
    let sheet = null;
    let sheetIn = 0.6;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
      canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function spawnMote(x, y, opts) {
      opts = opts || {};
      const mote = {
        x: x == null ? Math.random() * window.innerWidth : x,
        y: y == null ? Math.random() * window.innerHeight : y,
        r: opts.r || (70 + Math.random() * 130),
        vx: (Math.random() - 0.5) * 10,
        vy: -(3 + Math.random() * 8),
        age: opts.age || 0,
        dur: opts.dur || (opts.spark ? 1.8 + Math.random() * 1.6 : 5 + Math.random() * 4),
        warm: opts.spark ? true : Math.random() < 0.65,
        spark: !!opts.spark
      };
      motes.push(mote);
      if (motes.length > 18) motes.shift();
      return mote;
    }

    function spawnRipple(x, y) {
      ripples.push({ x: x, y: y, age: 0, dur: 1.15 });
      if (ripples.length > 8) ripples.shift();
      spawnMote(x, y, { r: 70 + Math.random() * 40, dur: 1.6 });
      spawnMote(x, y, { spark: true, r: 18 + Math.random() * 14, dur: 1.5 });
    }

    for (let i = 0; i < 3; i++) {
      spawnMote(null, null, { age: Math.random() * 2, r: 90 + Math.random() * 80 });
    }
    for (let i = 0; i < 7; i++) {
      spawnMote(null, null, { spark: true, age: Math.random() * 1.1, r: 16 + Math.random() * 18 });
    }

    resize();
    window.addEventListener("resize", resize);

    let down = null;
    document.addEventListener("pointerdown", function (event) {
      down = { x: event.clientX, y: event.clientY, t: event.target };
    });
    document.addEventListener("pointerup", function (event) {
      if (!down) return;
      const dx = event.clientX - down.x;
      const dy = event.clientY - down.y;
      const target = down.t;
      down = null;
      if (dx * dx + dy * dy > 36) return;
      if (target.closest && target.closest("a, button, input, textarea, select, img, .creature, .bubble")) return;
      spawnRipple(event.clientX, event.clientY);
    });

    function tick(dt) {
      const w = window.innerWidth;
      const h = window.innerHeight;
      ctx.clearRect(0, 0, w, h);

      if (!isReduced()) {
        sheetIn -= dt;
        if (sheetIn <= 0 && !sheet) {
          sheet = { age: 0, dur: 6.5 + Math.random() * 2 };
          sheetIn = 11 + Math.random() * 7;
        }
      }

      if (sheet) {
        sheet.age += dt;
        const p = sheet.age / sheet.dur;
        if (p >= 1) {
          sheet = null;
        } else {
          const fade = Math.sin(Math.PI * p) * 0.36;
          ctx.save();
          ctx.translate(w * (p * 1.15 - 0.08), h * 0.45);
          ctx.rotate(-0.6);
          const band = Math.max(w, h) * 0.15;
          const grad = ctx.createLinearGradient(-band, 0, band, 0);
          grad.addColorStop(0, "rgba(255, 250, 236, 0)");
          grad.addColorStop(0.5, "rgba(255, 246, 224, " + fade + ")");
          grad.addColorStop(1, "rgba(198, 222, 214, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(-band, -h, band * 2, h * 2);
          ctx.restore();
        }
      }

      for (let i = motes.length - 1; i >= 0; i--) {
        const mote = motes[i];
        mote.age += dt;
        if (mote.age >= mote.dur) {
          const wasSpark = mote.spark;
          motes.splice(i, 1);
          if (!isReduced()) {
            const sparks = motes.filter(function (item) { return item.spark; }).length;
            const washes = motes.length - sparks;
            if (wasSpark && sparks < 6) {
              spawnMote(null, null, { spark: true, r: 16 + Math.random() * 18 });
            } else if (!wasSpark && washes < 3) {
              spawnMote(null, null, { r: 90 + Math.random() * 70 });
            }
          }
          continue;
        }
        if (!isReduced()) {
          mote.x += mote.vx * dt;
          mote.y += mote.vy * dt;
        }
        const p = mote.age / mote.dur;
        const alpha = Math.sin(Math.PI * p) * (mote.spark ? 0.92 : (mote.warm ? 0.2 : 0.16));
        const grad = ctx.createRadialGradient(mote.x, mote.y, 0, mote.x, mote.y, mote.r);
        const core = mote.spark ? "255, 250, 232" : (mote.warm ? "255, 246, 224" : "214, 232, 226");
        grad.addColorStop(0, "rgba(" + core + ", " + alpha + ")");
        grad.addColorStop(mote.spark ? 0.22 : 0.5, "rgba(" + core + ", " + (alpha * 0.4) + ")");
        grad.addColorStop(1, "rgba(" + core + ", 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let i = ripples.length - 1; i >= 0; i--) {
        const ripple = ripples[i];
        ripple.age += dt;
        if (ripple.age >= ripple.dur) {
          ripples.splice(i, 1);
          continue;
        }
        const p = ripple.age / ripple.dur;
        ctx.beginPath();
        ctx.arc(ripple.x, ripple.y, 6 + p * 72, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 250, 236, " + ((1 - p) * 0.55) + ")";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }

    return {
      tick: tick,
      near: function (x, y) {
        for (let i = 0; i < motes.length; i++) {
          const mote = motes[i];
          const dx = mote.x - x;
          const dy = mote.y - y;
          if (dx * dx + dy * dy < 120 * 120 && Math.sin(Math.PI * (mote.age / mote.dur)) > 0.25) {
            return true;
          }
        }
        return false;
      }
    };
  }

  function setupCreatures(lights, isReduced) {
    const host = document.getElementById("creatures");
    let z = 2;
    let anchors = [];
    const creatures = ANIMALS.map(function (spec, index) {
      return createCreature(host, spec, index, function () { z += 1; return z; });
    });

    function layout() {
      anchors = layoutAnchors(creatures);
      creatures.forEach(function (creature) {
        const home = anchors[creature.index];
        const next = clampPos(
          creature,
          creature.placed ? creature.x : home.x,
          creature.placed ? creature.y : home.y
        );
        creature.x = next.x;
        creature.y = next.y;
        if (creature.placed) {
          creature.parked.x = creature.x;
          creature.parked.y = creature.y;
        }
        place(creature);
      });
    }

    layout();
    window.addEventListener("resize", function () {
      creatures.forEach(applyScale);
      layout();
    });

    document.addEventListener("pointerdown", function (event) {
      const open = creatures.find(function (creature) { return !creature.bubble.hidden; });
      if (!open) return;
      if (event.target.closest && event.target.closest(".creature")) return;
      closeBubble(open);
    });

    function releaseDrags() {
      creatures.forEach(function (creature) {
        creature.dragging = false;
        creature.el.classList.remove("held");
      });
      document.body.classList.remove("dragging");
    }
    window.addEventListener("blur", releaseDrags);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) releaseDrags();
    });
    window.addEventListener("pointercancel", releaseDrags);

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      creatures.forEach(function (creature) {
        if (!creature.bubble.hidden) closeBubble(creature);
      });
    });

    function tick(dt, now) {
      if (!anchors.length) return;
      creatures.forEach(function (creature) {
        const home = anchors[creature.index];
        let goalX = home.x;
        let goalY = home.y;
        if (!isReduced() && creature.bubble.hidden && !creature.dragging) {
          if (creature.placed && creature.rest > 0) {
            goalX = creature.parked.x;
            goalY = creature.parked.y;
            creature.rest -= dt;
            if (creature.rest <= 0) creature.placed = false;
          } else if (!creature.placed) {
            goalX = home.x + Math.sin(now / 1000 * creature.freq + creature.phase) * 28;
            goalY = home.y + Math.cos(now / 1300 * creature.freq + creature.phase) * 18;
          }
        } else if (creature.placed) {
          goalX = creature.parked.x;
          goalY = creature.parked.y;
        }

        if (!creature.dragging) {
          const ease = creature.bubble.hidden && !isReduced() ? Math.min(1, 1.4 * dt) : 0;
          if (ease) {
            creature.x += (goalX - creature.x) * ease;
            creature.y += (goalY - creature.y) * ease;
          }
          const next = clampPos(creature, creature.x, creature.y);
          creature.x = next.x;
          creature.y = next.y;
          if (creature.flips) {
            const vx = goalX - creature.x;
            if (vx > 0.35) creature.dir = 1;
            else if (vx < -0.35) creature.dir = -1;
          }
        }

        const bob = isReduced() ? 0 : Math.sin(now / 480 + creature.phase) * 1.4;
        const lift = creature.el.classList.contains("held") ? -3 : 0;
        if (!isReduced()) {
          const frameEvery = creature.el.classList.contains("lit") ? 240 : 520;
          const frame = Math.floor(now / frameEvery) % creature.frames.length;
          if (frame !== creature.frame) {
            creature.frame = frame;
            paint(creature.canvas, creature.frames[frame]);
          }
        }
        creature.canvas.style.transform = "scaleX(" + creature.dir + ") translateY(" + (bob + lift) + "px)";

        const rect = creature.el.getBoundingClientRect();
        const lit = lights.near(rect.left + rect.width / 2, rect.top + rect.height / 2);
        creature.el.classList.toggle("lit", lit);
        place(creature);
      });
    }

    return { tick: tick };
  }

  function createCreature(host, spec, index, raise) {
    const el = document.createElement("div");
    el.className = "creature";
    el.dataset.kind = spec.kind;
    el.dataset.id = spec.id;
    el.innerHTML =
      '<button class="sprite" type="button" aria-expanded="false"></button>' +
      '<div class="bubble" hidden>' +
        '<button class="close" type="button">Close</button>' +
        '<p class="who"></p>' +
        '<p class="kind"></p>' +
        '<p class="you"></p>' +
        '<p class="reply" aria-live="polite"></p>' +
        '<form class="say">' +
          '<label class="sr"></label>' +
          '<input type="text" maxlength="240" placeholder="Say something" autocomplete="off" enterkeyhint="send">' +
          '<button type="submit">Send</button>' +
        "</form>" +
        '<p class="via">Replies use a free model.</p>' +
      "</div>";
    host.appendChild(el);

    const button = el.querySelector(".sprite");
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    button.appendChild(canvas);
    const frames = SPRITES[spec.kind];
    const size = paint(canvas, frames[0]);

    const creature = {
      index: index,
      el: el,
      button: button,
      canvas: canvas,
      bubble: el.querySelector(".bubble"),
      you: el.querySelector(".you"),
      reply: el.querySelector(".reply"),
      via: el.querySelector(".via"),
      input: el.querySelector("input"),
      frames: frames,
      frame: 0,
      w: size.w,
      h: size.h,
      flips: spec.flips,
      dir: 1,
      x: 0,
      y: 0,
      phase: index * 1.7,
      freq: 0.32 + index * 0.05,
      placed: false,
      parked: { x: 0, y: 0 },
      rest: 0,
      dragging: false,
      didDrag: false,
      skipClick: false,
      greeted: false,
      busy: false,
      token: 0,
      history: [],
      spec: spec
    };

    button.setAttribute("aria-label", spec.name + ", pixel " + spec.species + ". Drag, or press to talk. Arrow keys move.");
    el.querySelector(".who").textContent = spec.name;
    el.querySelector(".kind").textContent = spec.species;
    const label = el.querySelector("label");
    const fieldId = "say-" + spec.id;
    creature.input.id = fieldId;
    label.htmlFor = fieldId;
    label.textContent = "Say something to " + spec.name;
    applyScale(creature);

    button.addEventListener("pointerdown", function (event) {
      creature.dragging = true;
      creature.didDrag = false;
      creature.ox = event.clientX - creature.x;
      creature.oy = event.clientY - creature.y;
      creature.sx = event.clientX;
      creature.sy = event.clientY;
      button.setPointerCapture(event.pointerId);
      el.style.zIndex = String(raise());
      el.classList.add("held");
      document.body.classList.add("dragging");
    });

    button.addEventListener("pointermove", function (event) {
      if (!creature.dragging) return;
      const dx = event.clientX - creature.sx;
      const dy = event.clientY - creature.sy;
      if (dx * dx + dy * dy > 36) creature.didDrag = true;
      const next = clampPos(creature, event.clientX - creature.ox, event.clientY - creature.oy);
      creature.x = next.x;
      creature.y = next.y;
      place(creature);
    });

    function endDrag() {
      if (!creature.dragging) return;
      creature.dragging = false;
      el.classList.remove("held");
      document.body.classList.remove("dragging");
      creature.skipClick = true;
      window.setTimeout(function () { creature.skipClick = false; }, 500);
      if (creature.didDrag) {
        creature.placed = true;
        creature.parked = { x: creature.x, y: creature.y };
        creature.rest = 26;
        return;
      }
      toggleBubble(creature);
    }

    button.addEventListener("pointerup", endDrag);
    button.addEventListener("pointercancel", endDrag);
    button.addEventListener("click", function () {
      if (creature.skipClick) return;
      toggleBubble(creature);
    });

    button.addEventListener("keydown", function (event) {
      const step = event.shiftKey ? 28 : 14;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else return;
      event.preventDefault();
      const next = clampPos(creature, creature.x + dx, creature.y + dy);
      creature.x = next.x;
      creature.y = next.y;
      creature.placed = true;
      creature.parked = { x: creature.x, y: creature.y };
      creature.rest = 26;
      if (creature.flips && dx) creature.dir = dx > 0 ? 1 : -1;
      place(creature);
    });

    el.querySelector(".close").addEventListener("click", function () {
      closeBubble(creature);
    });

    creature.input.addEventListener("keydown", function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      el.querySelector("form").requestSubmit();
    });

    el.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      const text = creature.input.value.trim();
      if (!text || creature.busy) return;
      creature.input.value = "";
      speak(creature, text);
    });

    return creature;
  }

  function applyScale(creature) {
    const narrow = window.matchMedia("(max-width: 720px)").matches;
    const maxW = narrow ? 68 : 100;
    const base = narrow ? 3 : 4;
    const scale = Math.max(2, Math.min(base, Math.floor(maxW / creature.w)));
    creature.canvas.style.width = (creature.w * scale) + "px";
    creature.canvas.style.height = (creature.h * scale) + "px";
  }

  function paint(canvas, lines) {
    const h = lines.length;
    const w = lines[0].length;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const color = PAL[lines[y][x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return { w: w, h: h };
  }

  function layoutAnchors(list) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const column = document.querySelector(".wrap").getBoundingClientRect();
    const widths = list.map(function (creature) { return creature.el.offsetWidth || 72; });
    const maxW = Math.max.apply(null, widths);
    const wide = column.left > maxW + 18 && (vw - column.right) > maxW + 18;
    const ys = [0.2, 0.44, 0.64, 0.8];
    if (wide) {
      return list.map(function (creature, i) {
        const cw = widths[i];
        const ch = creature.el.offsetHeight || 72;
        const lx = Math.max(8, (column.left - cw) * 0.5);
        const rx = Math.min(vw - cw - 8, column.right + (vw - column.right - cw) * 0.4);
        return {
          x: i % 2 === 0 ? rx : lx,
          y: Math.min(vh - ch - 10, vh * ys[i])
        };
      });
    }
    const total = widths.reduce(function (sum, w) { return sum + w; }, 0);
    const gap = Math.max(6, (vw - total) / (list.length + 1));
    let cursor = gap;
    const row = list.map(function (creature, i) {
      const ch = creature.el.offsetHeight || 64;
      const pos = { x: cursor, y: Math.max(72, vh - ch - 8) };
      cursor += widths[i] + gap;
      return pos;
    });
    return clearOfPhoto(list, row);
  }

  function clearOfPhoto(list, positions) {
    const photo = document.querySelector(".portrait");
    if (!photo) return positions;
    const p = photo.getBoundingClientRect();
    if (p.width < 20) return positions;
    let stackY = Math.max(72, p.top);
    return positions.map(function (pos, i) {
      const w = list[i].el.offsetWidth || 60;
      const h = list[i].el.offsetHeight || 60;
      const hits = !(pos.x + w < p.left || pos.x > p.right || pos.y + h < p.top || pos.y > p.bottom);
      if (!hits) return pos;
      const x = Math.min(window.innerWidth - w - 4, Math.max(4, p.right + 8));
      const y = Math.min(stackY, window.innerHeight - h - 4);
      stackY += h + 8;
      return { x: x, y: y };
    });
  }

  function clampPos(creature, x, y) {
    const w = creature.el.offsetWidth || 64;
    const h = creature.el.offsetHeight || 64;
    const header = document.querySelector(".top");
    const wide = document.querySelector(".wrap").getBoundingClientRect().left > w + 28;
    const minY = wide ? 8 : (header ? header.offsetHeight + 4 : 60);
    return {
      x: Math.max(2, Math.min(window.innerWidth - w - 2, x)),
      y: Math.max(minY, Math.min(window.innerHeight - h - 2, y))
    };
  }

  function place(creature) {
    creature.el.style.left = creature.x + "px";
    creature.el.style.top = creature.y + "px";
    if (!creature.bubble.hidden) placeBubble(creature);
  }

  function placeBubble(creature) {
    const bubble = creature.bubble;
    bubble.style.left = "50%";
    bubble.style.right = "auto";
    bubble.style.top = "auto";
    bubble.style.bottom = "calc(100% + 8px)";
    bubble.style.transform = "translateX(-50%)";
    let rect = bubble.getBoundingClientRect();
    const headerH = document.querySelector(".top") ? document.querySelector(".top").offsetHeight : 0;
    if (rect.top < headerH + 8) {
      bubble.style.bottom = "auto";
      bubble.style.top = "calc(100% + 8px)";
      rect = bubble.getBoundingClientRect();
    }
    if (rect.left < 8) {
      bubble.style.left = "0";
      bubble.style.transform = "none";
    } else if (rect.right > window.innerWidth - 8) {
      bubble.style.left = "auto";
      bubble.style.right = "0";
      bubble.style.transform = "none";
    }
  }

  function toggleBubble(creature) {
    if (creature.bubble.hidden) openBubble(creature);
    else closeBubble(creature);
  }

  function closeBubble(creature) {
    creature.bubble.hidden = true;
    creature.button.setAttribute("aria-expanded", "false");
  }

  function openBubble(creature) {
    document.querySelectorAll(".creature .bubble").forEach(function (bubble) {
      if (bubble !== creature.bubble) {
        bubble.hidden = true;
        const button = bubble.parentElement.querySelector(".sprite");
        if (button) button.setAttribute("aria-expanded", "false");
      }
    });
    creature.bubble.hidden = false;
    creature.button.setAttribute("aria-expanded", "true");
    if (!creature.greeted) {
      creature.greeted = true;
      creature.history.push({ role: "assistant", content: creature.spec.greeting });
      creature.reply.textContent = creature.spec.greeting;
      creature.via.textContent = "Replies use a free model.";
    }
    placeBubble(creature);
    if (!window.matchMedia("(pointer: coarse)").matches) creature.input.focus();
  }

  function systemFor(spec, text) {
    const chinese = /[\u4e00-\u9fff]/.test(text);
    return [
      "You are " + spec.name + ", a small pixel " + spec.species + " living on Yiwei Chen's academic homepage.",
      "You are not Yiwei. Speak as yourself: calm, brief, lightly warm. Never mean, never sarcastic. No emoji.",
      "Reply in one or two short sentences.",
      chinese ? "The visitor wrote in Chinese. Reply in Chinese only." : "The visitor wrote in English. Reply in English only.",
      "Use only these facts if asked about him. If you do not know, say so. Do not invent papers, emails, dates, or affiliations.",
      FACTS
    ].join(" ");
  }

  function cleanReply(text, name) {
    let out = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    out = out.replace(/^["“]|["”]$/g, "").trim();
    out = out.replace(new RegExp("^" + name + "\\s*[:：\\-]\\s*", "i"), "");
    if (out.length > 420) out = out.slice(0, 417).replace(/\s+\S*$/, "") + "…";
    return out.trim();
  }

  function fallback(spec, text) {
    const chinese = /[\u4e00-\u9fff]/.test(text);
    if (/who|yiwei|jackson|hkust|website|陈|谁|网站|港科/i.test(text)) {
      return chinese
        ? "这是陈奕玮的主页。他是香港科技大学计算机科学与工程系的博士生，研究海洋计算机视觉。"
        : "This page is Yiwei Chen’s. He is a PhD student in computer science at HKUST, working on marine computer vision.";
    }
    return chinese ? spec.localZh : spec.localEn;
  }

  async function speak(creature, text) {
    const spec = creature.spec;
    const token = ++creature.token;
    creature.busy = true;
    creature.you.textContent = text;
    creature.reply.textContent = "…";
    creature.via.textContent = "";
    creature.history.push({ role: "user", content: text.slice(0, 240) });
    if (creature.history.length > 8) creature.history = creature.history.slice(-8);
    const messages = [{ role: "system", content: systemFor(spec, text) }].concat(creature.history);
    try {
      const answer = cleanReply(await askModel(messages), spec.name);
      if (!answer) throw new Error("empty");
      if (creature.token !== token) return;
      creature.history.push({ role: "assistant", content: answer });
      creature.reply.textContent = answer;
      creature.via.textContent = "Replied via a free model.";
    } catch (err) {
      if (creature.token !== token) return;
      const local = fallback(spec, text);
      creature.history.push({ role: "assistant", content: local });
      creature.reply.textContent = local;
      creature.via.textContent = "Local reply — the model is away.";
    } finally {
      if (creature.token === token) creature.busy = false;
    }
  }

  async function askModel(messages) {
    const models = ["mistral-Nemo-Instruct-2407", "default"];
    let lastError = null;
    for (let i = 0; i < models.length; i++) {
      try {
        return await callModel(models[i], messages);
      } catch (err) {
        lastError = err;
        if (err && err.rate) break;
      }
    }
    throw lastError || new Error("no model");
  }

  async function callModel(model, messages) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(function () { ctrl.abort(); }, 14000);
    try {
      const res = await fetch("https://api.llm7.io/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer unused"
        },
        body: JSON.stringify({
          model: model,
          temperature: 0.7,
          max_tokens: 120,
          messages: messages
        }),
        signal: ctrl.signal
      });
      if (res.status === 429) {
        const error = new Error("rate");
        error.rate = true;
        throw error;
      }
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content.map(function (part) { return part.text || part.content || ""; }).join("");
      }
      return "";
    } finally {
      window.clearTimeout(timer);
    }
  }

  if (typeof document === "undefined") {
    // Sprite grids already validated while building SPRITES.
  } else {
    try {
      boot();
    } catch (err) {
      console.error(err);
    }
  }
})();
