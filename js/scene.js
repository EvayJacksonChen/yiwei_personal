/* The Dive (v3). The page is one descent from the sea surface to the seafloor:
   an ocean canvas behind the text, pixel creatures you can drag and talk to,
   and a depth gauge on the side.
   Talk tries, in order: LLM7's anonymous tier (https://api.llm7.io; the key
   "unused" is that service's public placeholder, not a secret), then the owner's
   chat proxy (Pollinations, then DeepSeek; the DeepSeek key lives only in that
   proxy, never in this file), and finally the offline answers below. */
(function () {
  "use strict";
  const PX = window.PX;
  if (!PX || typeof document === "undefined") return;
  const PAL = PX.PAL;
  const TAU = Math.PI * 2;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

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

  const ZONES = [
    { id: "top", name: "Surface", tone: "light", d0: 0, d1: 0 },
    { id: "about", name: "Sunlit zone", tone: "light", d0: 0, d1: 200 },
    { id: "publications", name: "Twilight zone", tone: "dark", d0: 200, d1: 1000 },
    { id: "news", name: "Midnight zone", tone: "dark", d0: 1000, d1: 4000 },
    { id: "experience", name: "Abyssal zone", tone: "dark", d0: 4000, d1: 4800 }
  ];

  // Live weather in Hong Kong (Open-Meteo) shapes the rainbow, the sky and the sea.
  // Each kind maps to a real optical effect: a double rainbow needs sun and showers,
  // fog makes a white fogbow, and moonlight makes a pale moonbow.
  const WEATHER_KINDS = {
    sunny: { label: "sunny", bow: "normal", alpha: 1, twinkle: 1.4, clouds: "white", rain: 0, wave: 1 },
    partly: { label: "partly cloudy", bow: "normal", alpha: 0.9, twinkle: 1, clouds: "white", rain: 0, wave: 1 },
    sunshower: { label: "sun & showers", bow: "normal", alpha: 1, double: true, twinkle: 1.2, clouds: "white", rain: 0.45, wave: 1.1 },
    overcast: { label: "overcast", bow: "normal", alpha: 0.4, twinkle: 0.3, clouds: "grey", rain: 0, wave: 1.1, sky: ["#ebecea", "#e8ebe8"] },
    rain: { label: "rain", bow: "normal", alpha: 0.28, twinkle: 0, clouds: "grey", rain: 1, wave: 1.3, sky: ["#e3e6e7", "#e7eaea"] },
    storm: { label: "thunderstorm", bow: "normal", alpha: 0.1, twinkle: 0, clouds: "dark", rain: 1.5, wave: 1.7, lightning: true, sky: ["#d6dade", "#dde1e3"] },
    fog: { label: "fog", bow: "fog", alpha: 0.95, twinkle: 0.4, clouds: "grey", rain: 0, wave: 0.9, haze: true, sky: ["#eeefed", "#f0f1ef"] },
    night: { label: "clear night", bow: "moon", alpha: 0.95, twinkle: 1.2, clouds: "white", rain: 0, wave: 1 }
  };

  const SKY = {
    morning: ["#f7eee2", "#f1efe8"],
    afternoon: ["#f4f0e7", "#eef1ea"],
    night: ["#dcdde8", "#e7e8ee"]
  };

  const WATER = {
    surface: "#cfe5e0",
    sunlitEnd: "#94c1bd",
    twilight: "#1d5263",
    twilightEnd: "#133a4f",
    midnight: "#0c2638",
    midnightEnd: "#0a1d2d",
    abyss: "#081624",
    floor: "#050b13"
  };

  const HUMAN_TAXA = [
    ["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Mammalia"],
    ["Order", "Primates"], ["Family", "Hominidae"], ["Genus", "Homo"], ["Species", "Homo sapiens"]
  ];

  const CAST = [
    {
      id: "det", name: "Det", sprite: "surfer", zone: "top", motion: "surf", side: "R",
      species: "surfer", common: "Surfer", latin: "Homo sapiens", conf: "0.98", scale: [4, 3], speed: 64, flips: true,
      react: "r-jump", fx: "splash", taxa: HUMAN_TAXA,
      persona: "a sunny, easygoing surfer named after object detection, because he can spot the one clean wave in a crowded sea like a detector drawing a box; he loves explaining swells, tides, wave sets and rip currents",
      greeting: "Hey, I'm Det. I can spot a clean wave from a mile out.",
      chips: {
        en: ["How do you spot a good wave?", "How do waves form?", "What is a rip current?"],
        zh: ["你怎么找到好浪？", "海浪是怎么形成的？", "什么是离岸流？"]
      },
      localEn: "A wave just ate your words. Say again?",
      localZh: "浪把你的话卷走了，再说一遍？"
    },
    {
      id: "dropout", name: "Dropout", sprite: "gull", zone: "top", motion: "fly", side: "R",
      species: "herring gull", common: "Herring gull", latin: "Larus argentatus", conf: "0.95", scale: [3, 2], speed: 70, flips: true,
      react: "r-hop", fx: "feather",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Aves"], ["Order", "Charadriiformes"], ["Family", "Laridae"], ["Genus", "Larus"], ["Species", "Larus argentatus"]],
      persona: "a cheeky herring gull named after the dropout trick in neural networks; famous for dropping shellfish onto rocks to crack them, and jokes that it randomly ignores half of what it hears because that helps it generalize",
      greeting: "Skree! I'm Dropout. I might ignore half of what you say. It helps me generalize.",
      chips: {
        en: ["Why do gulls drop shells?", "Can you drink seawater?", "Why the name Dropout?"],
        zh: ["海鸥为什么要扔贝壳？", "你能喝海水吗？", "为什么叫 Dropout？"]
      },
      localEn: "Skree? I dropped that one. Again?",
      localZh: "嘎？这句被我 dropout 了，再说一遍？"
    },
    {
      id: "git", name: "Git", sprite: "fish", zone: "about", motion: "swim", side: "L",
      species: "reef fish", common: "Blue-green chromis", latin: "Chromis viridis", conf: "0.97", scale: [3, 3], speed: 58, flips: true,
      react: "r-spin", fx: "bubbles",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Actinopterygii"], ["Order", "Perciformes"], ["Family", "Pomacentridae"], ["Genus", "Chromis"], ["Species", "Chromis viridis"]],
      persona: "a quick, observant blue-green chromis who lives in a school above branching coral, darts into the branches when danger comes, and keeps track of every change on the reef",
      greeting: "I stay near the edge, where the light passes.",
      chips: {
        en: ["Why swim in a school?", "Where do you hide?", "How do fish and corals help each other?"],
        zh: ["你们为什么成群游？", "遇到危险躲哪里？", "鱼和珊瑚怎么互相帮助？"]
      },
      localEn: "The water went quiet. Ask me once more?",
      localZh: "潮水有点吵，我没听清。再说一次？"
    },
    {
      id: "python", name: "Python", sprite: "turtle", zone: "about", motion: "glide", side: "R",
      species: "sea turtle", common: "Green sea turtle", latin: "Chelonia mydas", conf: "0.96", scale: [3, 2], speed: 24, flips: true,
      react: "r-hop", fx: "bubbles",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Reptilia"], ["Order", "Testudines"], ["Family", "Cheloniidae"], ["Genus", "Chelonia"], ["Species", "Chelonia mydas"]],
      persona: "an unhurried, kind old green sea turtle who grazes on seagrass, has crossed whole oceans, and gives patient answers",
      greeting: "I am in no hurry. Say what you like.",
      chips: {
        en: ["How old can turtles get?", "How do you find your way home?", "Why do you eat seagrass?"],
        zh: ["海龟能活多久？", "你怎么找到回家的路？", "你为什么吃海草？"]
      },
      localEn: "I am still catching up. Try once more?",
      localZh: "我慢，没跟上。再说一次？"
    },
    {
      id: "pip", name: "Pip", sprite: "horse", zone: "about", motion: "hover", side: "R",
      species: "seahorse", common: "Yellow seahorse", latin: "Hippocampus kuda", conf: "0.93", scale: [4, 3], speed: 16, flips: true,
      react: "r-flipy", fx: "bubbles",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Actinopterygii"], ["Order", "Syngnathiformes"], ["Family", "Syngnathidae"], ["Genus", "Hippocampus"], ["Species", "Hippocampus kuda"]],
      persona: "a small, gentle seahorse who loves calm seagrass, holds on with its tail, and is proud that seahorse fathers carry the babies",
      greeting: "Hello. The current here is gentle.",
      chips: {
        en: ["Do seahorse dads give birth?", "Why curl your tail?", "How do seahorses swim upright?"],
        zh: ["海马是爸爸生宝宝吗？", "你为什么卷着尾巴？", "海马怎么竖着游？"]
      },
      localEn: "I lost the thread of that. Once more?",
      localZh: "我走神了。再说一次？"
    },
    {
      id: "seg", name: "Seg", sprite: "diver", zone: "about", motion: "swim", side: "L",
      species: "scuba diver", common: "Scuba diver", latin: "Homo sapiens", conf: "0.99", scale: [3, 2], speed: 30, flips: true,
      react: "r-hop", fx: "flash", taxa: HUMAN_TAXA,
      persona: "a marine biologist and underwater photographer named after segmentation: she outlines every coral, fish and diver in her photos pixel by pixel to build datasets for marine vision; precise and encouraging, she explains why underwater images are hard (colour loss, haze, light) and happily points visitors to the page owner's work, such as MaskGuide on lightweight marine segmentation",
      greeting: "Hold still. I'm outlining you, pixel by pixel, for my segmentation dataset.",
      chips: {
        en: ["What is segmentation?", "Why is underwater vision hard?", "How do you label coral photos?"],
        zh: ["什么是图像分割？", "水下视觉为什么难？", "你怎么标注珊瑚照片？"]
      },
      localEn: "My regulator was too loud. Once more?",
      localZh: "呼吸器太吵了，再说一次？"
    },
    {
      id: "gan", name: "GAN", sprite: "shark", zone: "about", motion: "hunt", side: "R",
      species: "blacktip reef shark", common: "Blacktip reef shark", latin: "Carcharhinus melanopterus", conf: "0.97", scale: [3, 2], speed: 240, flips: true,
      react: "r-shake", fx: "bubbles",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Chondrichthyes"], ["Order", "Carcharhiniformes"], ["Family", "Carcharhinidae"], ["Genus", "Carcharhinus"], ["Species", "Carcharhinus melanopterus"]],
      persona: "a sleek, dramatic blacktip reef shark named after generative adversarial networks, because it is the adversary that keeps every fish on the reef sharp; it is honest that sharks very rarely bother people, that reefs with sharks are healthier, and that humans are a far bigger danger to sharks than the reverse",
      greeting: "Relax. I'm the adversary, not the villain. Reefs need sharks.",
      chips: {
        en: ["Do sharks attack people?", "Why do reefs need sharks?", "Why the name GAN?"],
        zh: ["鲨鱼会攻击人吗？", "为什么珊瑚礁需要鲨鱼？", "为什么叫 GAN？"]
      },
      localEn: "Sorry, I was chasing something. Again?",
      localZh: "抱歉，刚才在追东西。再说一次？"
    },
    {
      id: "docker", name: "Docker", sprite: "whale", zone: "publications", motion: "glide", side: "L", pref: "stage",
      species: "sperm whale", common: "Sperm whale", latin: "Physeter macrocephalus", conf: "0.94", scale: [3, 2], speed: 22, flips: true,
      react: "r-wiggle", fx: "spout",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Mammalia"], ["Order", "Artiodactyla"], ["Family", "Physeteridae"], ["Genus", "Physeter"], ["Species", "Physeter macrocephalus"]],
      persona: "an enormous, gentle sperm whale who carries a few shipping containers on its back and is quietly proud of how neatly everything is packed; dives past 1,000 m to hunt squid using echolocation clicks, speaks slowly and deeply, and likes small container puns",
      greeting: "Mmm. Hello, small one. Everything I own fits in these containers.",
      chips: {
        en: ["How deep can you dive?", "How does echolocation work?", "What's in the containers?"],
        zh: ["你能潜多深？", "回声定位是怎么回事？", "集装箱里装着什么？"]
      },
      localEn: "Mmm… that echo got lost. Again?",
      localZh: "嗯……回声走丢了。再说一次？"
    },
    {
      id: "conda", name: "Conda", sprite: "jelly", zone: "publications", motion: "drift", side: "R",
      species: "moon jellyfish", common: "Moon jellyfish", latin: "Aurelia aurita", conf: "0.92", scale: [4, 3], speed: 16, flips: false,
      react: "r-pulse", fx: "glow",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Cnidaria"], ["Class", "Scyphozoa"], ["Order", "Semaeostomeae"], ["Family", "Ulmaridae"], ["Genus", "Aurelia"], ["Species", "Aurelia aurita"]],
      persona: "a drifting moon jellyfish, dreamy and soft-spoken, with no brain but a nerve net, who keeps everything tidy inside its own little environment",
      greeting: "You caught me between one light and the next.",
      chips: {
        en: ["Do you have a brain?", "How do you swim?", "Why are there jellyfish blooms?"],
        zh: ["你有大脑吗？", "你怎么游动？", "为什么会出现水母爆发？"]
      },
      localEn: "That light went out before I could answer.",
      localZh: "那道光灭得太快了。你再说一次？"
    },
    {
      id: "neuron", name: "Neuron", sprite: "squid", zone: "publications", motion: "swim", side: "L",
      species: "veined squid", common: "Veined squid", latin: "Loligo forbesii", conf: "0.89", scale: [3, 2], speed: 44, flips: true,
      react: "r-dash", fx: "ink",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Mollusca"], ["Class", "Cephalopoda"], ["Order", "Myopsida"], ["Family", "Loliginidae"], ["Genus", "Loligo"], ["Species", "Loligo forbesii"]],
      persona: "a nerdy, quick veined squid, very proud that the squid giant axon let Hodgkin and Huxley work out how neurons fire, which later inspired artificial neurons; jets backwards and changes colour with chromatophores, a little dramatic",
      greeting: "Hi, I'm Neuron. My giant axon taught humans how nerves fire.",
      chips: {
        en: ["What is a giant axon?", "How did squid help neuroscience?", "How do you change colour?"],
        zh: ["什么是巨型轴突？", "乌贼怎么帮助了神经科学？", "你怎么变色？"]
      },
      localEn: "That signal didn't fire. What did you say?",
      localZh: "这个信号没传过来。你刚才说什么？"
    },
    {
      id: "torch", name: "Torch", sprite: "angler", zone: "news", motion: "glide", side: "L",
      species: "anglerfish", common: "Humpback anglerfish", latin: "Melanocetus johnsonii", conf: "0.91", scale: [3, 3], speed: 16, flips: true,
      react: "r-shake", fx: "lure",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Actinopterygii"], ["Order", "Lophiiformes"], ["Family", "Melanocetidae"], ["Genus", "Melanocetus"], ["Species", "Melanocetus johnsonii"]],
      persona: "a fierce-looking but kind anglerfish who carries the only lamp in the midnight zone, a lure that glows thanks to bioluminescent bacteria, and uses it to read the news",
      greeting: "Come into the light. I was just reading the news.",
      chips: {
        en: ["How does your lure glow?", "What is bioluminescence?", "How do you find food in the dark?"],
        zh: ["你的灯怎么会发光？", "什么是生物发光？", "黑暗里你怎么找吃的？"]
      },
      localEn: "My lamp flickered. Say it again?",
      localZh: "我的灯闪了一下。再说一次？"
    },
    {
      id: "softmax", name: "Softmax", sprite: "eel", zone: "news", motion: "swim", side: "R",
      species: "gulper eel", common: "Gulper eel", latin: "Eurypharynx pelecanoides", conf: "0.87", scale: [3, 2], speed: 30, flips: true,
      react: "r-wiggle", fx: "glow",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Chordata"], ["Class", "Actinopterygii"], ["Order", "Saccopharyngiformes"], ["Family", "Eurypharyngidae"], ["Genus", "Eurypharynx"], ["Species", "Eurypharynx pelecanoides"]],
      persona: "a long, fast-talking gulper eel named after the softmax function: its huge hinged mouth swallows any messy pile of numbers and squashes it into neat probabilities that sum to one; its tail tip glows",
      greeting: "Sssay anything. I'll squash it into probabilities that sum to one.",
      chips: {
        en: ["Why is your mouth so big?", "Why does your tail glow?", "Why the name Softmax?"],
        zh: ["你的嘴为什么这么大？", "你的尾巴为什么发光？", "为什么叫 Softmax？"]
      },
      localEn: "That slipped right past me. Once more?",
      localZh: "这句从我嘴边溜走了。再说一次？"
    },
    {
      id: "head", name: "Head", sprite: "octo", zone: "experience", motion: "walk", side: "L",
      species: "dumbo octopus", common: "Dumbo octopus", latin: "Grimpoteuthis sp.", conf: "0.90", scale: [3, 2], speed: 18, flips: false,
      react: "r-hop", fx: "ink",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Mollusca"], ["Class", "Cephalopoda"], ["Order", "Octopoda"], ["Family", "Grimpoteuthidae"], ["Genus", "Grimpoteuthis"], ["Species", "Grimpoteuthis sp."]],
      persona: "a soft, shy dumbo octopus named after the head of a neural network, the small part that sits on top of a backbone and makes the final prediction; it jokes that an octopus is mostly head anyway, though most of its neurons actually live in its arms; it flaps its ear-like fins to swim and lives deeper than any other octopus, and its best friend is Backbone the crab",
      greeting: "Oh! A visitor. I'm Head. Put me on a Backbone and we make predictions.",
      chips: {
        en: ["Do your arms really think?", "What are your ear fins for?", "Why the name Head?"],
        zh: ["你的腕足真的会思考吗？", "你的“耳朵”是做什么的？", "为什么叫 Head？"]
      },
      localEn: "My fins were flapping. Say again?",
      localZh: "我在扇耳鳍，没听清。再说一次？"
    },
    {
      id: "backbone", name: "Backbone", sprite: "crab", zone: "experience", motion: "walk", side: "R",
      species: "deep-sea red crab", common: "Red deep-sea crab", latin: "Chaceon quinquedens", conf: "0.95", scale: [3, 2], speed: 34, flips: false,
      react: "r-shake", fx: "sand",
      taxa: [["Kingdom", "Animalia"], ["Phylum", "Arthropoda"], ["Class", "Malacostraca"], ["Order", "Decapoda"], ["Family", "Geryonidae"], ["Genus", "Chaceon"], ["Species", "Chaceon quinquedens"]],
      persona: "a sturdy, careful deep-sea red crab who finds its own name hilarious, because crabs have no backbone at all: the skeleton is on the outside and has to be molted to grow; it guards the seafloor and checks everything twice",
      greeting: "I'm Backbone. Yes, really. My skeleton is on the outside.",
      chips: {
        en: ["Wait, do crabs have backbones?", "What is molting?", "How do you survive the pressure?"],
        zh: ["螃蟹有脊椎吗？", "什么是蜕壳？", "你怎么承受深海的压力？"]
      },
      localEn: "Clack. Didn't catch that. Again?",
      localZh: "咔嚓。没听清，再说一次？"
    },
    {
      id: "jetson", name: "Jetson", sprite: "rov", zone: "experience", motion: "hover", side: "R",
      species: "underwater robot", common: "Remotely operated vehicle", latin: "ROV", conf: "1.00", scale: [3, 2], speed: 22, flips: true,
      react: "r-shake", fx: "scan",
      taxa: [["Domain", "Engineered"], ["Kingdom", "Machina"], ["Class", "Underwater vehicles"], ["Order", "Tethered ROVs"], ["Family", "Observation class"], ["Unit", "Jetson (edge AI computer)"]],
      persona: "a polite remotely operated underwater vehicle from a marine vision lab, named after the NVIDIA Jetson edge-AI computer in its hull that runs its vision models on board; it is tethered to a ship, sees through its camera and lamps, labels everything it sees with a confidence score, and talks a little like a robot",
      greeting: "Jetson online. Camera nominal, models loaded. Hello, human: confidence 0.98.",
      chips: {
        en: ["How do you see in the dark?", "Why run AI on board?", "Who drives you?"],
        zh: ["你在黑暗中怎么看见？", "为什么要在本地运行 AI？", "谁在操控你？"]
      },
      localEn: "Signal lost on the tether. Please repeat.",
      localZh: "缆线信号丢失。请重复。"
    }
  ];

  const COARSE = window.matchMedia("(pointer: coarse)").matches;
  const HINTS = {
    top: ["det", "Drag me onto a wave!"],
    about: ["git", COARSE ? "Psst. Tap me to chat." : "Psst. Click me to chat."],
    publications: ["conda", COARSE ? "The vision button sees us all." : "Press V to see like a vision model."],
    news: ["torch", COARSE ? "Tap the dark water. It glows." : "Move your pointer. The plankton glow."],
    experience: ["jetson", "Seafloor reached. Say hello!"]
  };

  const TIPS = {
    top: { up: "Surface · 1 atm, breathe!" },
    about: { down: "0 m · Sunlit zone: most ocean life", up: "Back in the sunlit zone" },
    publications: { down: "200 m · Twilight: red light is gone", up: "Rising into the twilight" },
    news: { down: "1,000 m · Midnight: only animal light", up: "Leaving the midnight zone" },
    experience: { down: "4,000 m · Abyss: 400× surface pressure" }
  };

  const DROP_LINES = {
    same: ["Wheee!", "Thanks for the lift.", "Nice spot.", "Again! Again!"],
    deeper: ["Too dark down here…", "Brr. Heading back up.", "Wrong depth, friend."],
    shallower: ["Too bright up here!", "My eyes! Back down I go.", "The pressure's all wrong."],
    sky: ["Whoa, too much sky!", "I can't breathe up here!", "Put me back in!"]
  };

  const reduceQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const S = {
    reduced: reduceQuery.matches,
    vw: 800, vh: 600, sy: 0, docH: 4000, headerH: 56,
    wrapL: 0, wrapR: 800, narrow: false, gauge: false,
    zones: [], byId: {},
    surfaceY: 700, floorY: 3800,
    skyTop: 80, skyBottom: 400,
    view: { top: 0, bottom: 600 },
    t: 0,
    vision: false,
    visionPulse: 0,
    met: new Set(),
    part: "afternoon",
    weather: Object.assign({ kind: "partly", live: false, temp: null, text: "" }, WEATHER_KINDS.partly),
    waveK: 1,
    dirty: true,
    pointer: { cx: -999, cy: -999, x: -999, y: -999, active: false }
  };
  const P = S.pointer;
  if (reduceQuery.addEventListener) {
    reduceQuery.addEventListener("change", function (event) { S.reduced = event.matches; });
  }

  /* ---------- pixel helpers ---------- */

  function paint(canvas, lines, over) {
    const h = lines.length;
    const w = lines[0].length;
    canvas.width = w;
    canvas.height = h;
    const cx = canvas.getContext("2d");
    cx.clearRect(0, 0, w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const ch = lines[y][x];
        const color = over && over[ch] !== undefined ? over[ch] : PAL[ch];
        if (!color) continue;
        cx.fillStyle = color;
        cx.fillRect(x, y, 1, 1);
      }
    }
    return { w: w, h: h };
  }

  const sheetCache = new Map();
  function sheet(lines, key, over) {
    let byKey = sheetCache.get(lines);
    if (!byKey) {
      byKey = new Map();
      sheetCache.set(lines, byKey);
    }
    const k = key || "";
    let canvas = byKey.get(k);
    if (!canvas) {
      canvas = document.createElement("canvas");
      paint(canvas, lines, over);
      byKey.set(k, canvas);
    }
    return canvas;
  }

  function padFrames(frames) {
    const h = Math.max.apply(null, frames.map(function (f) { return f.length; }));
    return frames.map(function (f) {
      const out = f.slice();
      while (out.length < h) out.push(".".repeat(f[0].length));
      return out;
    });
  }

  const DARK_MINNOW = { s: "#7cc6ba", g: "#d8f5ee", n: "#04131c", w: "#ffffff" };

  function drawPixelBubble(cx, x, y, radius, alpha, dark) {
    const a = alpha == null ? 1 : alpha;
    if (a <= 0.02 || radius < 1.2) return;
    const s = radius < 7 ? 2 : 3;
    const r = Math.max(s, radius);
    const qx = Math.round(x);
    const qy = Math.round(y);
    cx.fillStyle = dark ? "rgba(160, 236, 222, " + (0.55 * a) + ")" : "rgba(63, 118, 110, " + (0.6 * a) + ")";
    const steps = Math.ceil(r / s);
    for (let iy = -steps; iy <= steps; iy++) {
      const py = iy * s;
      const span = Math.sqrt(Math.max(0, r * r - py * py));
      if (span < s * 0.35) continue;
      const left = -Math.round(span / s) * s;
      const right = Math.round(span / s) * s;
      cx.fillRect(qx + left, qy + py, s - 1, s - 1);
      if (right !== left) cx.fillRect(qx + right, qy + py, s - 1, s - 1);
    }
    cx.fillStyle = "rgba(255, 252, 247, " + (0.9 * a) + ")";
    cx.fillRect(qx - Math.round(r * 0.34), qy - Math.round(r * 0.38), Math.max(1, s - 1), Math.max(1, s - 1));
  }

  /* ---------- layout ---------- */

  const layoutHooks = [];
  function onLayout(fn) { layoutHooks.push(fn); }

  function measure() {
    S.dirty = false;
    const de = document.documentElement;
    S.vw = de.clientWidth;
    S.vh = window.innerHeight;
    S.sy = window.scrollY;
    S.narrow = S.vw <= 720;
    S.gauge = S.vw > 1100;
    const header = document.querySelector(".top");
    S.headerH = header ? header.offsetHeight : 56;
    const wrap = document.querySelector("#about .wrap");
    const wr = wrap.getBoundingClientRect();
    S.wrapL = wr.left;
    S.wrapR = wr.right;
    S.zones = ZONES.map(function (cfg, index) {
      const el = document.getElementById(cfg.id);
      const r = el.getBoundingClientRect();
      const stage = el.querySelector(".stage");
      const sr = stage ? stage.getBoundingClientRect() : null;
      return Object.assign({ index: index, el: el }, cfg, {
        top: r.top + S.sy,
        bottom: r.bottom + S.sy,
        stageTop: sr ? sr.top + S.sy : r.top + S.sy,
        stageH: sr ? sr.height : 0
      });
    });
    S.byId = {};
    S.zones.forEach(function (z) { S.byId[z.id] = z; });
    const last = S.zones[S.zones.length - 1];
    S.docH = Math.max(de.scrollHeight, last.bottom);
    last.bottom = S.docH;
    S.surfaceY = S.byId.top.bottom;
    const floor = document.querySelector(".floor-band");
    S.floorY = floor ? floor.getBoundingClientRect().top + S.sy + 34 : S.docH - 100;
    paintBackdrop();
    layoutHooks.forEach(function (fn) { fn(); });
  }

  let lastBackdrop = "";
  function paintBackdrop() {
    const z = S.byId;
    if (!z.top) return;
    const sky = (S.weather && S.weather.sky) || SKY[S.part] || SKY.afternoon;
    const tw = z.publications;
    const mn = z.news;
    const ab = z.experience;
    const stops = [
      [0, sky[0]],
      [S.surfaceY - 1, sky[1]],
      [S.surfaceY, WATER.surface],
      [z.about.bottom, WATER.sunlitEnd],
      [tw.top + tw.stageH, WATER.twilight],
      [tw.bottom, WATER.twilightEnd],
      [mn.top + mn.stageH * 0.6, WATER.midnight],
      [mn.bottom, WATER.midnightEnd],
      [ab.top + ab.stageH * 0.6, WATER.abyss],
      [S.docH, WATER.floor]
    ];
    const css = "linear-gradient(180deg, " + stops.map(function (s) {
      return s[1] + " " + Math.round(s[0]) + "px";
    }).join(", ") + ")";
    if (css !== lastBackdrop) {
      document.body.style.backgroundImage = css;
      lastBackdrop = css;
    }
  }

  function zoneAt(y) {
    const zs = S.zones;
    for (let i = zs.length - 1; i >= 0; i--) {
      if (y >= zs[i].top) return zs[i];
    }
    return zs[0];
  }

  // Matches what the eye sees: the twilight water only turns dark halfway down its transition band.
  function toneAt(y) {
    if (y < S.surfaceY) return "light";
    const tw = S.byId.publications;
    if (tw && y < tw.top + tw.stageH * 0.55) return "light";
    return zoneAt(y).tone;
  }

  function depthAt(y) {
    if (y <= S.surfaceY) return 0;
    const z = zoneAt(y);
    if (z.index === 0) return 0;
    const end = z.id === "experience" ? S.floorY : z.bottom;
    const f = clamp((y - z.top) / Math.max(1, end - z.top), 0, 1);
    return z.d0 + f * (z.d1 - z.d0);
  }

  /* ---------- the ocean canvas ---------- */

  const ocean = document.getElementById("ocean");
  const ctx = ocean.getContext("2d");
  let dpr = 1;

  onLayout(function () {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.floor(S.vw * dpr));
    const h = Math.max(1, Math.floor(S.vh * dpr));
    if (ocean.width !== w || ocean.height !== h) {
      ocean.width = w;
      ocean.height = h;
    }
  });

  // Waves: two distant swells and the surface itself.
  const WAVES = [
    { off: -40, amp: 6, k: 0.011, sp: 0.42, rgb: "63, 127, 118", a: 0.16, bumpK: 0.4 },
    { off: -26, amp: 8, k: 0.008, sp: 0.3, rgb: "47, 112, 104", a: 0.22, bumpK: 0.6 },
    { off: -12, amp: 9, k: 0.014, sp: 0.62, bumpK: 1 }
  ];
  const bumps = [];

  function bump(x, h, w) {
    bumps.push({ x: x, h: h || 10, w: w || 70, age: 0 });
    if (bumps.length > 8) bumps.shift();
  }

  function level(x, i) {
    const w = WAVES[i == null ? 2 : i];
    const t = S.t;
    const amp = w.amp * S.waveK;
    let y = S.surfaceY + w.off
      + Math.sin(x * w.k + t * w.sp) * amp
      + Math.sin(x * w.k * 2.15 + t * w.sp * 1.6 + 1.1) * amp * 0.4;
    for (let j = 0; j < bumps.length; j++) {
      const b = bumps[j];
      const d = Math.abs(x - b.x) / b.w;
      if (d < 1) y -= Math.cos(d * Math.PI / 2) * b.h * Math.cos(b.age * 9) * Math.exp(-b.age * 2.2) * w.bumpK;
    }
    return y;
  }

  function drawWaves(dt) {
    S.waveK += (S.weather.wave - S.waveK) * Math.min(1, dt * 0.8);
    for (let i = bumps.length - 1; i >= 0; i--) {
      bumps[i].age += dt;
      if (bumps[i].age > 2.6) bumps.splice(i, 1);
    }
    const vw = S.vw;
    const step = 6;
    for (let i = 0; i < 2; i++) {
      const w = WAVES[i];
      const ys = [];
      for (let x = 0; x <= vw; x += step) ys.push(Math.round(level(x, i) / step) * step);
      ctx.fillStyle = "rgba(" + w.rgb + ", " + w.a + ")";
      for (let j = 0; j < ys.length; j++) ctx.fillRect(j * step, ys[j], step - 1, step - 1);
      ctx.fillStyle = "rgba(" + w.rgb + ", " + (w.a * 0.45) + ")";
      for (let j = 0; j < ys.length; j++) ctx.fillRect(j * step, ys[j] + step, step - 1, step - 1);
      ctx.fillStyle = "rgba(255, 252, 247, 0.7)";
      for (let j = 1; j < ys.length; j++) {
        if (ys[j - 1] - ys[j] >= step) ctx.fillRect(j * step, ys[j] - step, step - 1, step - 1);
      }
    }
    const q = 3;
    const main = [];
    for (let x = 0; x <= vw; x += q) main.push(Math.round(level(x) / q) * q);
    ctx.fillStyle = WATER.surface;
    for (let j = 0; j < main.length; j++) ctx.fillRect(j * q, main[j], q, S.surfaceY + 4 - main[j]);
    ctx.fillStyle = "rgba(47, 112, 104, 0.4)";
    for (let j = 0; j < main.length; j++) ctx.fillRect(j * q, main[j], q, 2);
    ctx.fillStyle = "rgba(255, 252, 247, 0.95)";
    for (let j = 1; j < main.length; j++) {
      if (main[j - 1] - main[j] >= q) ctx.fillRect(j * q - q, main[j] - q, q * 2, q);
    }
    ctx.fillStyle = "rgba(255, 252, 247, 0.85)";
    for (let x = 0; x < vw; x += 22) {
      if (Math.sin(x * 0.05 + S.t * 1.5) < 0.6) continue;
      ctx.fillRect(Math.round(x / 4) * 4, Math.round((level(x, 1) - 10) / 4) * 4, 3, 3);
    }
    ctx.fillStyle = "rgba(255, 252, 240, 0.4)";
    for (let x = 0; x < vw; x += 14) {
      const s = Math.sin(x * 0.09 + S.t * 1.1) + Math.sin(x * 0.023 - S.t * 0.7);
      if (s < 1.1) continue;
      ctx.fillRect(Math.round(x / 2) * 2, S.surfaceY + 14 + ((x * 7) % 46), 6, 2);
    }
  }

  // Sky: clouds that rain when poked, and stars at night.
  const cloudSheets = PX.CLOUDS.map(function (c) { return sheet(c); });
  const silverSheets = PX.CLOUDS.map(function (c) { return sheet(c, "silver", { D: "#9fb2bf", C: "#dbe4ea" }); });
  const cloudTints = {
    white: cloudSheets,
    grey: PX.CLOUDS.map(function (c) { return sheet(c, "grey", { w: "#e4e8ea", C: "#cfd6da", D: "#aeb8be" }); }),
    dark: PX.CLOUDS.map(function (c) { return sheet(c, "dark", { w: "#c3cad0", C: "#a5afb7", D: "#7f8b95" }); })
  };
  const storm = { next: rand(3, 6), flash: 0, bolt: null };
  const clouds = [];
  const stars = [];
  const raindrops = [];

  onLayout(function () {
    const top = S.headerH + 18;
    const bottom = Math.max(top + 40, S.surfaceY - 250);
    if (!clouds.length) {
      for (let i = 0; i < 4; i++) {
        clouds.push({
          kind: i % 2, x: rand(-60, S.vw), fy: (i + Math.random() * 0.6) / 4,
          speed: rand(5, 11), scale: i % 2 ? 3 : 4, lining: 0, rain: 0, w: 0, h: 0, y: 0
        });
      }
      for (let i = 0; i < 48; i++) stars.push({ fx: Math.random(), fy: Math.random(), ph: rand(0, TAU) });
    }
    S.skyTop = top;
    S.skyBottom = bottom;
    clouds.forEach(function (c, i) {
      c.y = top + c.fy * (bottom - top);
      c.scale = S.narrow ? (i % 2 ? 2 : 3) : (i % 2 ? 3 : 4);
    });
  });

  function drawSky(dt) {
    if (S.part === "night") {
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        const a = 0.35 + 0.35 * Math.sin(S.t * 2 + s.ph);
        const x = Math.round(s.fx * S.vw / 2) * 2;
        const y = Math.round((S.skyTop + s.fy * (S.surfaceY - 80 - S.skyTop)) / 2) * 2;
        ctx.fillStyle = "rgba(196, 160, 92, " + a.toFixed(2) + ")";
        ctx.fillRect(x, y, 2, 2);
        if (i % 7 === 0) {
          ctx.fillRect(x - 2, y, 6, 2);
          ctx.fillRect(x, y - 2, 2, 6);
        }
      }
    }
    const W = S.weather;
    if (W.haze) {
      const grad = ctx.createLinearGradient(0, S.skyTop, 0, S.surfaceY);
      grad.addColorStop(0, "rgba(244, 245, 243, 0)");
      grad.addColorStop(0.55, "rgba(244, 245, 243, 0.55)");
      grad.addColorStop(1, "rgba(244, 245, 243, 0.2)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, S.skyTop, S.vw, S.surfaceY - S.skyTop);
    }
    for (let i = 0; i < clouds.length; i++) {
      const c = clouds[i];
      const sh = (cloudTints[W.clouds] || cloudSheets)[c.kind];
      c.w = sh.width * c.scale;
      c.h = sh.height * c.scale;
      if (!S.reduced) c.x += c.speed * dt * (c.rain > 0 ? 0.3 : 1);
      if (c.x > S.vw + 30) c.x = -c.w - rand(20, 160);
      c.lining = Math.max(0, c.lining - dt * 0.3);
      const x = Math.round(c.x);
      const y = Math.round(c.y);
      if (c.lining > 0) {
        ctx.save();
        ctx.shadowColor = "rgba(205, 218, 230, " + Math.min(1, c.lining * 1.4).toFixed(2) + ")";
        ctx.shadowBlur = 16;
        ctx.drawImage(silverSheets[c.kind], x, y, c.w, c.h);
        ctx.restore();
      } else {
        ctx.globalAlpha = 0.95;
        ctx.drawImage(sh, x, y, c.w, c.h);
        ctx.globalAlpha = 1;
      }
      // A poked cloud pours; weather rain falls more lightly from every cloud.
      const poked = c.rain > 0;
      const wet = poked ? 1 : (S.reduced ? 0 : W.rain);
      if (wet > 0) {
        c.rain = Math.max(0, c.rain - dt);
        const n = Math.random() < dt * (poked ? 34 : 9 * wet) ? (poked ? 2 : 1) : 0;
        for (let k = 0; k < n; k++) {
          raindrops.push({ x: c.x + rand(6, c.w - 6), y: c.y + c.h - 6, vy: rand(230, 300), vx: poked ? 0 : windX() });
        }
      }
    }
  }

  function windX() {
    return S.weather.lightning ? rand(-75, -55) : rand(-24, -12);
  }

  function drawStorm(dt) {
    const W = S.weather;
    // Open-sky rain across the whole hero, not only under the clouds.
    if (W.rain > 0 && !S.reduced && raindrops.length < 520) {
      const n = Math.floor(W.rain * 95 * dt + Math.random());
      for (let k = 0; k < n; k++) {
        raindrops.push({ x: rand(-40, S.vw + 40), y: rand(S.skyTop - 40, S.surfaceY - 120), vy: rand(250, 340), vx: windX() });
      }
    }
    if (!W.lightning || S.reduced) {
      storm.flash = 0;
      return;
    }
    storm.next -= dt;
    if (storm.next <= 0) {
      storm.next = rand(5, 11);
      storm.flash = 0.55;
      const c = pick(clouds);
      const pts = [{ x: c.x + c.w / 2, y: c.y + c.h - 6 }];
      const end = S.surfaceY - 14;
      while (pts[pts.length - 1].y < end) {
        const p = pts[pts.length - 1];
        pts.push({ x: p.x + rand(-26, 26), y: Math.min(end, p.y + rand(22, 46)) });
      }
      storm.bolt = pts;
      bump(pts[pts.length - 1].x, 16, 90);
      splash(pts[pts.length - 1].x, 8);
    }
    if (storm.flash > 0) {
      storm.flash -= dt;
      const pulse = storm.flash > 0.4 || (storm.flash > 0.12 && storm.flash < 0.24) ? 1 : 0;
      if (pulse) {
        ctx.fillStyle = "rgba(255, 255, 248, 0.32)";
        ctx.fillRect(0, S.view.top, S.vw, Math.max(0, S.surfaceY - S.view.top));
        if (storm.bolt) {
          ctx.fillStyle = "#fffbe0";
          for (let i = 1; i < storm.bolt.length; i++) {
            const a = storm.bolt[i - 1];
            const b = storm.bolt[i];
            const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
            for (let k = 0; k <= steps; k++) {
              const u = k / steps;
              ctx.fillRect(Math.round((a.x + (b.x - a.x) * u) / 3) * 3, Math.round((a.y + (b.y - a.y) * u) / 3) * 3, 3, 3);
            }
          }
        }
      }
    }
  }

  function drawRain(dt) {
    for (let i = raindrops.length - 1; i >= 0; i--) {
      const d = raindrops[i];
      d.y += d.vy * dt;
      d.x += (d.vx || 0) * dt;
      const surface = level(d.x);
      if (d.y >= surface) {
        raindrops.splice(i, 1);
        if (Math.random() < 0.3) bump(d.x, 3, 26);
        addFx({ k: "drop", x: d.x, y: surface - 2, vx: rand(-30, 30), vy: rand(-90, -40), g: 600, life: 0.4, max: 0.4, col: "106, 174, 212" });
        continue;
      }
      ctx.fillStyle = "rgba(106, 174, 212, 0.75)";
      ctx.fillRect(Math.round(d.x), Math.round(d.y), 2, 6);
    }
  }

  // Light shafts in the sunlit zone, each drawn once into its own sprite.
  let rays = [];
  onLayout(function () {
    const z = S.byId.about;
    const len = Math.round(Math.min(z.bottom - S.surfaceY + 220, 1100));
    rays = [];
    for (let i = 0; i < 6; i++) {
      const width = 34 + (i % 3) * 22;
      const c = document.createElement("canvas");
      c.width = Math.ceil(width + len * 0.32 + 8);
      c.height = len;
      const rc = c.getContext("2d");
      for (let y = 0; y < len; y += 10) {
        rc.fillStyle = "rgba(255, 252, 236, " + (0.12 * (1 - y / len)).toFixed(3) + ")";
        rc.fillRect(Math.round(y * 0.32 / 4) * 4, y, width, 10);
      }
      rays.push({ c: c, len: len });
    }
  });

  function drawRays() {
    if (!rays.length) return;
    const top = S.surfaceY;
    const len = rays[0].len;
    if (S.view.top > top + len || S.view.bottom < top) return;
    for (let i = 0; i < rays.length; i++) {
      const base = ((i + 0.5) / 6) * S.vw + Math.sin(S.t * 0.18 + i * 1.7) * 50;
      ctx.globalAlpha = 0.72 + 0.28 * Math.sin(S.t * 0.6 + i * 2.1);
      ctx.drawImage(rays[i].c, Math.round((base - 90) / 4) * 4, top);
    }
    ctx.globalAlpha = 1;
  }

  // Reef shelves at the bottom of the sunlit zone.
  const reefSheets = {
    weed: PX.WEED.map(function (f) { return sheet(f); }),
    tuft: PX.TUFT.map(function (f) { return sheet(f); }),
    kelp: PX.KELP.map(function (f) { return sheet(f); }),
    grass: PX.SEAGRASS.map(function (f) { return sheet(f); }),
    coral: [sheet(PX.CORAL)],
    fan: [sheet(PX.FAN)],
    bud: [sheet(PX.BUD)],
    reef: [sheet(PX.REEF)],
    rock: [sheet(PX.ROCK)]
  };
  const PATCHES = {
    weed: [
      { kind: "rock", dx: 2, dy: 14, scale: 4 },
      { kind: "kelp", dx: -16, dy: -6, scale: 3 },
      { kind: "kelp", dx: 12, dy: -10, scale: 3 },
      { kind: "kelp", dx: 30, dy: 0, scale: 2 },
      { kind: "weed", dx: -4, dy: 4, scale: 3 },
      { kind: "weed", dx: -32, dy: 6, scale: 3 },
      { kind: "weed", dx: 20, dy: 8, scale: 2 },
      { kind: "tuft", dx: 2, dy: 10, scale: 3 },
      { kind: "tuft", dx: -20, dy: 12, scale: 2 },
      { kind: "tuft", dx: 36, dy: 10, scale: 2 },
      { kind: "grass", dx: -48, dy: 12, scale: 3 },
      { kind: "grass", dx: 52, dy: 14, scale: 2 },
      { kind: "grass", dx: -60, dy: 16, scale: 2 }
    ],
    coral: [
      { kind: "rock", dx: 0, dy: 14, scale: 4 },
      { kind: "reef", dx: -22, dy: 8, scale: 3 },
      { kind: "reef", dx: 24, dy: 12, scale: 2 },
      { kind: "coral", dx: -8, dy: 0, scale: 3 },
      { kind: "coral", dx: 18, dy: 4, scale: 2 },
      { kind: "fan", dx: 4, dy: -4, scale: 3 },
      { kind: "fan", dx: -30, dy: 2, scale: 2 },
      { kind: "bud", dx: 32, dy: 8, scale: 3 },
      { kind: "bud", dx: -14, dy: 10, scale: 2 },
      { kind: "bud", dx: 10, dy: 14, scale: 2 },
      { kind: "grass", dx: 46, dy: 14, scale: 2 }
    ]
  };
  let shelves = [];

  onLayout(function () {
    const z = S.byId.about;
    const y = z.bottom - 14;
    const roomy = S.wrapL > 190;
    const shrink = S.narrow ? 0.62 : 1;
    const lx = roomy ? S.wrapL * 0.5 : 58;
    const rx = roomy ? S.wrapR + (S.vw - S.wrapR - (S.gauge ? 80 : 0)) * 0.5 : S.vw - 58;
    shelves = [
      { x: lx, y: y, kind: "weed", flip: 1 },
      { x: rx, y: y, kind: "coral", flip: -1 }
    ].map(function (s) {
      s.plants = PATCHES[s.kind].map(function (p) {
        return {
          kind: p.kind,
          dx: Math.round(p.dx * s.flip * shrink),
          dy: p.dy,
          scale: S.narrow ? Math.max(2, p.scale - 1) : p.scale,
          lean: 0
        };
      });
      s.span = 150 * shrink;
      return s;
    });
  });

  function stampBottom(sh, x, y, scale, alpha) {
    ctx.globalAlpha = alpha;
    ctx.drawImage(sh, Math.round(x - sh.width * scale / 2), Math.round(y - sh.height * scale), sh.width * scale, sh.height * scale);
    ctx.globalAlpha = 1;
  }

  function drawShelves(dt) {
    shelves.forEach(function (s, si) {
      if (s.y < S.view.top - 20 || s.y - 120 > S.view.bottom) return;
      const swayBase = Math.sin(S.t * 1.15 + si * 0.8);
      s.plants.forEach(function (p, pi) {
        const frames = reefSheets[p.kind];
        const sh = frames[Math.floor(S.t * 1.5 + si + pi) % frames.length];
        const sways = p.kind === "weed" || p.kind === "tuft" || p.kind === "kelp" || p.kind === "grass";
        let target = 0;
        if (sways) {
          target = swayBase * 2 + Math.sin(S.t * 1.7 + pi);
          const ax = s.x + p.dx;
          if (P.active && Math.abs(P.y - (s.y - 40)) < 90 && Math.abs(P.x - ax) < 90) {
            target += clamp((ax - P.x) / 90, -1, 1) * 9;
          }
        }
        p.lean += (target - p.lean) * Math.min(1, dt * 6);
        stampBottom(sh, s.x + p.dx + Math.round(p.lean), s.y + p.dy, p.scale, 0.9);
      });
    });
  }

  // Fish schools that keep their distance from the pointer.
  const minnowLight = PX.MINNOW.map(function (f) { return sheet(f); });
  const minnowDark = PX.MINNOW.map(function (f) { return sheet(f, "dark", DARK_MINNOW); });
  const lanternSheets = PX.LANTERN.map(function (f) { return sheet(f); });
  const SCHOOL_SPECS = [
    { zone: "about", n: 9, kind: "minnow", band: [0.12, 0.55], label: "Damselfish" },
    { zone: "about", n: 6, kind: "minnow", band: [0.45, 0.85], label: "Damselfish" },
    { zone: "publications", n: 11, kind: "minnow", band: [0.15, 0.85], label: "Mackerel scad" },
    { zone: "news", n: 7, kind: "lantern", band: [0.15, 0.85], label: "Lanternfish" },
    { zone: "experience", n: 5, kind: "lantern", band: [0.1, 0.45], label: "Lanternfish" }
  ];
  const schools = SCHOOL_SPECS.map(function (spec) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    const members = [];
    for (let i = 0; i < spec.n; i++) {
      members.push({
        ox: rand(-46, 46), oy: rand(-22, 22), x: 0, y: 0, vx: 0, vy: 0,
        ph: rand(0, TAU), face: dir, frame: Math.floor(rand(0, 2))
      });
    }
    return {
      spec: spec, dir: dir, speed: rand(22, 40), cx: rand(0, 1200), cy: 0, by: rand(0, 1),
      members: members, placed: false, kick: 0, box: null
    };
  });

  onLayout(function () {
    schools.forEach(function (s) {
      if (s.wild) return;
      const z = S.byId[s.spec.zone];
      const span = z.bottom - z.top;
      s.base = z.top + span * (s.spec.band[0] + s.by * (s.spec.band[1] - s.spec.band[0]));
      if (!s.placed) {
        s.cx = rand(0, S.vw);
        s.members.forEach(function (m) { m.x = s.cx + m.ox; m.y = s.base + m.oy; });
        s.placed = true;
      }
    });
  });

  function scatter(s, x, y, power) {
    s.members.forEach(function (m) {
      const dx = m.x - x;
      const dy = m.y - y;
      const d = Math.hypot(dx, dy) || 1;
      const f = (power || 420) * Math.max(0.25, 1 - d / 260);
      m.vx += dx / d * f;
      m.vy += dy / d * f;
    });
    s.kick = 1.2;
  }

  // Wild schools: small groups that appear at random places and times, wander, then fade away.
  let wildTimer = rand(6, 12);
  let schoolCheck = 0.5;
  const minSchools = 2 + Math.floor(Math.random() * 3);

  function spawnWild() {
    const top = Math.max(S.surfaceY + 80, S.sy + S.headerH + 60);
    const bottom = Math.min(S.floorY - 60, S.sy + S.vh - 100);
    if (bottom - top < 60) return false;
    const y = rand(top, bottom);
    const z = zoneAt(y);
    const kind = z.index >= 3 ? "lantern" : "minnow";
    const label = kind === "lantern" ? "Lanternfish" : z.index === 2 ? "Mackerel scad" : "Damselfish";
    const n = Math.floor(rand(4, 8));
    const dir = Math.random() < 0.5 ? 1 : -1;
    const cx = rand(S.vw * 0.12, S.vw * 0.88);
    const members = [];
    for (let i = 0; i < n; i++) {
      const ox = rand(-34, 34);
      const oy = rand(-16, 16);
      members.push({ ox: ox, oy: oy, x: cx + ox, y: y + oy, vx: 0, vy: 0, ph: rand(0, TAU), face: dir, frame: 0 });
    }
    schools.push({
      spec: { zone: z.id, n: n, kind: kind, label: label },
      wild: true, life: rand(24, 38), alpha: 0, dir: dir, speed: rand(18, 34),
      cx: cx, cy: y, base: y, by: rand(0, 1), members: members, placed: true, kick: 0, box: null, meetCool: 1.5
    });
    return true;
  }

  function drawSchools(dt) {
    // Keep between minSchools (2-4) and 4 schools around whatever the visitor is looking at.
    if (!S.reduced) {
      wildTimer -= dt;
      schoolCheck -= dt;
      if (schoolCheck <= 0) {
        schoolCheck = 0.7;
        const top = S.sy + S.headerH;
        const bottom = S.sy + S.vh;
        const inView = schools.filter(function (o) {
          return o.cy > top && o.cy < bottom && o.members.some(function (m) { return !(m.gone > 0); });
        }).length;
        const wild = schools.filter(function (o) { return o.wild; }).length;
        if (wild < 8 && (inView < minSchools || (inView < 4 && wildTimer <= 0))) {
          if (spawnWild() && wildTimer <= 0) wildTimer = rand(8, 16);
        }
      }
    }
    schools.forEach(function (s) {
      s.meetCool = Math.max(0, (s.meetCool || 0) - dt);
      if (s.wild) {
        s.life -= dt;
        s.alpha = s.life < 2 ? Math.max(0, s.life / 2) : Math.min(1, s.alpha + dt * 0.8);
        const left = s.members.some(function (m) { return !(m.gone > 0); });
        const far = Math.abs(s.cy - (S.sy + S.vh / 2)) > S.vh * 1.6;
        if (s.life <= 0 || !left || far || s.cx > S.vw + 200 || s.cx < -200) {
          s.dead = true;
          return;
        }
      }
      if (!S.reduced) {
        s.cx += s.dir * s.speed * (s.kick > 0 ? 2.2 : 1) * dt;
        s.kick = Math.max(0, s.kick - dt);
        if (!s.wild && (s.cx > S.vw + 160 || s.cx < -160)) {
          const shift = s.cx > 0 ? -(S.vw + 300) : S.vw + 300;
          s.cx += shift;
          s.members.forEach(function (m) { m.x += shift; });
          s.base += rand(-60, 60);
          const z = S.byId[s.spec.zone];
          s.base = clamp(s.base, z.top + 60, z.bottom - 60);
        }
      }
      s.cy = s.base + Math.sin(S.t * 0.4 + s.by * 6) * 26;
      if (s.cy < S.view.top - 140 || s.cy > S.view.bottom + 140) {
        s.members.forEach(function (m) { m.x = s.cx + m.ox; m.y = s.cy + m.oy; m.vx = 0; m.vy = 0; });
        s.box = null;
        return;
      }
      const dark = toneAt(s.cy) === "dark";
      const frames = s.spec.kind === "lantern" ? lanternSheets : (dark ? minnowDark : minnowLight);
      let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
      let shown = 0;
      s.members.forEach(function (m) {
        if (m.gone > 0) {
          m.gone -= dt;
          if (m.gone <= 0) {
            m.x = s.cx + m.ox + s.dir * -120;
            m.y = s.cy + m.oy;
          }
          return;
        }
        if (!S.reduced) {
          const tx = s.cx + m.ox;
          const ty = s.cy + m.oy + Math.sin(S.t * 2 + m.ph) * 3;
          let ax = (tx - m.x) * 5;
          let ay = (ty - m.y) * 5;
          if (P.active) {
            // With a following school around, the others get curious and let it come close.
            const fear = chasers.on || (S.chase && S.chase.under) ? 0 : 90;
            const dx = m.x - P.x;
            const dy = m.y - P.y;
            const d2 = dx * dx + dy * dy;
            if (fear > 0 && d2 < fear * fear) {
              const d = Math.sqrt(d2) || 1;
              const f = (1 - d / fear) * 1400;
              ax += dx / d * f;
              ay += dy / d * f;
            }
          }
          m.vx += ax * dt;
          m.vy += ay * dt;
          const drag = Math.exp(-3.4 * dt);
          m.vx *= drag;
          m.vy *= drag;
          m.x += (m.vx + s.dir * s.speed * 0.2) * dt;
          m.y += m.vy * dt;
          const rel = m.vx + s.dir * s.speed;
          if (Math.abs(rel) > 12) m.face = rel > 0 ? 1 : -1;
        }
        const sh = frames[Math.floor(S.t * 5 + m.ph) % frames.length];
        ctx.save();
        ctx.globalAlpha = (dark ? 0.85 : 0.62) * (s.wild ? s.alpha : 1);
        ctx.translate(Math.round(m.x), Math.round(m.y));
        ctx.scale(m.face * 2, 2);
        ctx.drawImage(sh, -sh.width / 2, -sh.height / 2);
        ctx.restore();
        shown += 1;
        if (s.spec.kind === "lantern") {
          ctx.fillStyle = "rgba(111, 245, 223, 0.18)";
          ctx.fillRect(Math.round(m.x) - 6, Math.round(m.y) - 2, 12, 6);
        }
        l = Math.min(l, m.x - 10); r = Math.max(r, m.x + 10);
        t = Math.min(t, m.y - 6); b = Math.max(b, m.y + 6);
      });
      s.box = shown ? { l: l, t: t, r: r, b: b } : null;
      s.shown = shown;
    });
    for (let i = schools.length - 1; i >= 0; i--) {
      if (schools[i].dead) schools.splice(i, 1);
    }
  }

  function hitSchool(x, y) {
    for (let i = 0; i < schools.length; i++) {
      const s = schools[i];
      if (!s.box) continue;
      for (let j = 0; j < s.members.length; j++) {
        const m = s.members[j];
        if (m.gone > 0) continue;
        if (Math.abs(m.x - x) < 18 && Math.abs(m.y - y) < 14) return s;
      }
    }
    return null;
  }

  // Marine snow drifting down through the dark.
  const snow = [];
  function drawSnow(dt) {
    const start = S.byId.publications.top + S.byId.publications.stageH * 0.4;
    const top = Math.max(start, S.view.top);
    const bottom = Math.min(S.floorY, S.view.bottom);
    if (bottom <= top) { snow.length = 0; return; }
    const want = Math.round(70 * (bottom - top) / Math.max(1, S.vh));
    while (snow.length < want) {
      snow.push({ x: rand(0, S.vw), y: rand(top, bottom), vy: rand(6, 16), ph: rand(0, TAU), s: Math.random() < 0.25 ? 2 : 1, a: rand(0.25, 0.6) });
    }
    for (let i = snow.length - 1; i >= 0; i--) {
      const p = snow[i];
      if (!S.reduced) {
        p.y += p.vy * dt;
        p.x += Math.sin(S.t * 0.6 + p.ph) * 6 * dt;
      }
      if (p.y < top - 10 || p.y > bottom + 10) {
        if (snow.length > want) { snow.splice(i, 1); continue; }
        p.y = p.y > bottom ? top : rand(top, bottom);
        p.x = rand(0, S.vw);
      }
      ctx.fillStyle = "rgba(220, 236, 232, " + p.a + ")";
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
  }

  // Bioluminescent plankton: they light up as the pointer passes.
  let plankton = [];
  onLayout(function () {
    const top = S.byId.news.top + S.byId.news.stageH * 0.2;
    const bottom = S.floorY - 10;
    const area = S.vw * Math.max(0, bottom - top);
    const n = Math.min(420, Math.round(area / 6500));
    if (plankton.length === n && plankton.top === top) return;
    plankton = [];
    for (let i = 0; i < n; i++) {
      plankton.push({ x: rand(0, S.vw), y: rand(top, bottom), g: 0, ph: rand(0, TAU), delay: 0 });
    }
    plankton.top = top;
  });

  function glowAround(x, y, radius) {
    plankton.forEach(function (p) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.delay = d / 700;
        p.boost = 1 - d / radius * 0.4;
      }
    });
  }

  function drawPlankton(dt) {
    for (let i = 0; i < plankton.length; i++) {
      const p = plankton[i];
      if (p.y < S.view.top || p.y > S.view.bottom) {
        p.g = 0;
        continue;
      }
      if (p.boost) {
        p.delay -= dt;
        if (p.delay <= 0) {
          p.g = Math.max(p.g, p.boost);
          p.boost = 0;
        }
      }
      if (P.active) {
        const dx = p.x - P.x;
        const dy = p.y - P.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 150 * 150) p.g = Math.max(p.g, (1 - Math.sqrt(d2) / 150) * 0.95);
      }
      p.g = Math.max(0, p.g - dt * 0.55);
      if (!S.reduced) p.y += Math.sin(S.t * 0.5 + p.ph) * 2 * dt;
      const base = 0.1 + 0.08 * Math.sin(S.t * 1.3 + p.ph);
      const a = Math.min(1, base + p.g);
      const x = Math.round(p.x / 2) * 2;
      const y = Math.round(p.y / 2) * 2;
      if (p.g > 0.25) {
        ctx.fillStyle = "rgba(111, 245, 223, " + (p.g * 0.16).toFixed(3) + ")";
        ctx.fillRect(x - 5, y - 5, 12, 12);
      }
      ctx.fillStyle = "rgba(111, 245, 223, " + a.toFixed(3) + ")";
      ctx.fillRect(x, y, 2, 2);
    }
  }

  // The seafloor: sand, tube worms, sea stars, a vent, and deep-sea corals.
  let floorCanvas = null;
  let floorDecor = [];
  const starSheet = sheet(PX.STAR);
  const wormSheets = PX.WORM.map(function (f) { return sheet(f); });
  const ventSheet = sheet(PX.VENT);
  const FLORA = {
    bubblegum: { frames: [sheet(PX.BUBBLEGUM)], sway: 0.6, label: "Paragorgia arborea" },
    bamboo: { frames: [sheet(PX.BAMBOO)], glow: [sheet(PX.BAMBOO, "glow", { p: "#6ff5df", A: "#2aa996" })], sway: 0.4, label: "Keratoisis sp." },
    seapen: { frames: [sheet(PX.SEAPEN)], sway: 2.2, label: "Pennatula sp." },
    sponge: { frames: [sheet(PX.SPONGE)], sway: 0, label: "Euplectella aspergillum" },
    crinoid: { frames: PX.CRINOID.map(function (f) { return sheet(f); }), sway: 1.6, label: "Crinoidea" }
  };
  const rockSheet = sheet(PX.ROCK, "deep", { y: "#2b3448", k: "#141a26", d: "#10151f" });

  onLayout(function () {
    const w = S.vw;
    const h = Math.max(40, S.docH - S.floorY + 14);
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = w;
    floorCanvas.height = h;
    const fc = floorCanvas.getContext("2d");
    const sand = ["#141c28", "#18212f", "#1c2636", "#202b3d"];
    const cell = 4;
    for (let x = 0; x < w; x += cell) {
      const top = 10 + Math.round((Math.sin(x * 0.012) * 6 + Math.sin(x * 0.031 + 1) * 3) / cell) * cell;
      fc.fillStyle = "#34465c";
      fc.fillRect(x, top, cell, cell);
      for (let y = top + cell; y < h; y += cell) {
        fc.fillStyle = sand[(x * 7 + y * 13 + ((x * y) % 11)) % sand.length];
        fc.fillRect(x, y, cell, cell);
      }
    }
    floorDecor = [
      { k: "worm", fx: 0.05 }, { k: "worm", fx: 0.068 }, { k: "worm", fx: 0.086 },
      { k: "flora", f: "bubblegum", fx: 0.15 },
      { k: "rock", fx: 0.205 },
      { k: "flora", f: "seapen", fx: 0.25 }, { k: "flora", f: "seapen", fx: 0.272, wide: true },
      { k: "star", fx: 0.315 },
      { k: "flora", f: "crinoid", fx: 0.37 },
      { k: "flora", f: "bamboo", fx: 0.445 },
      { k: "rock", fx: 0.52 },
      { k: "flora", f: "sponge", fx: 0.575, wide: true },
      { k: "star", fx: 0.63 },
      { k: "flora", f: "seapen", fx: 0.672 },
      { k: "worm", fx: 0.72 }, { k: "worm", fx: 0.738, wide: true },
      { k: "vent", fx: 0.8 },
      { k: "flora", f: "bubblegum", fx: 0.875, wide: true },
      { k: "flora", f: "bamboo", fx: 0.92 },
      { k: "rock", fx: 0.965 }
    ].filter(function (d) { return !(d.wide && S.narrow); }).map(function (d) {
      d.x = Math.round(d.fx * w);
      d.spin = 0;
      d.hide = 0;
      d.puff = 0;
      d.lean = 0;
      d.act = 0;
      return d;
    });
  });

  function floorTop(x) {
    return S.floorY + 10 + Math.round((Math.sin(x * 0.012) * 6 + Math.sin(x * 0.031 + 1) * 3) / 4) * 4;
  }

  function drawFloor(dt) {
    if (!floorCanvas || S.floorY - 80 > S.view.bottom) return;
    ctx.drawImage(floorCanvas, 0, S.floorY);
    const sc = S.narrow ? 2 : 3;
    floorDecor.forEach(function (d) {
      const y = floorTop(d.x) + 4;
      if (d.k === "rock") {
        stampBottom(rockSheet, d.x, y + 6, sc + 1, 1);
      } else if (d.k === "worm") {
        d.hide = Math.max(0, d.hide - dt);
        const sh = wormSheets[d.hide > 0 ? 1 : 0];
        stampBottom(sh, d.x, y, sc, 1);
        d.box = { l: d.x - 8, t: y - sh.height * sc, r: d.x + 8, b: y };
      } else if (d.k === "star") {
        d.spin = Math.max(0, d.spin - dt);
        const w = starSheet.width * sc;
        ctx.save();
        ctx.translate(d.x, y - w / 2);
        ctx.rotate((1 - d.spin / 0.9) * TAU * (d.spin > 0 ? 1 : 0));
        ctx.drawImage(starSheet, -w / 2, -w / 2, w, w);
        ctx.restore();
        d.box = { l: d.x - w / 2, t: y - w, r: d.x + w / 2, b: y };
      } else if (d.k === "flora") {
        const kind = FLORA[d.f];
        d.act = Math.max(0, d.act - dt);
        let target = kind.sway ? Math.sin(S.t * 0.9 + d.x * 0.05) * kind.sway : 0;
        if (kind.sway && P.active && Math.abs(P.y - (y - 30)) < 80 && Math.abs(P.x - d.x) < 70) {
          target += clamp((d.x - P.x) / 70, -1, 1) * 6 * kind.sway;
        }
        d.lean += (target - d.lean) * Math.min(1, dt * 4);
        let sh = kind.frames[0];
        let scale = sc;
        if (d.f === "crinoid" && d.act > 0) sh = kind.frames[1];
        if (d.f === "bamboo" && d.act > 0 && Math.sin(d.act * 18) > -0.2) sh = kind.glow[0];
        if (d.f === "bubblegum") scale = sc + (S.narrow ? 0 : 1);
        const h = sh.height * scale;
        let drawH = h;
        if (d.f === "seapen" && d.act > 0) drawH = h * clamp(1 - Math.sin(Math.min(1, d.act / 2.4) * Math.PI) * 1.4, 0.3, 1);
        const lean = Math.round(d.lean);
        ctx.drawImage(sh, Math.round(d.x - sh.width * scale / 2 + lean), Math.round(y - drawH), sh.width * scale, Math.round(drawH));
        if (d.f === "bamboo" && d.act > 0) {
          const grad = ctx.createRadialGradient(d.x, y - h * 0.6, 0, d.x, y - h * 0.6, 70);
          grad.addColorStop(0, "rgba(111, 245, 223, " + (0.3 * d.act / 2.4).toFixed(3) + ")");
          grad.addColorStop(1, "rgba(111, 245, 223, 0)");
          ctx.fillStyle = grad;
          ctx.fillRect(d.x - 70, y - h * 0.6 - 70, 140, 140);
        }
        d.box = { l: d.x - sh.width * scale / 2, t: y - h, r: d.x + sh.width * scale / 2, b: y };
      } else if (d.k === "vent") {
        stampBottom(ventSheet, d.x, y + 4, sc + 1, 1);
        const top = y + 4 - ventSheet.height * (sc + 1);
        d.box = { l: d.x - 20, t: top, r: d.x + 20, b: y };
        d.puff -= dt;
        if (d.puff <= 0 && !S.reduced) {
          d.puff = rand(0.25, 0.6);
          spawnBubble(d.x + rand(-4, 4), top, rand(2, 4), -rand(30, 60));
        }
        const g = 0.12 + 0.06 * Math.sin(S.t * 3);
        const grad = ctx.createRadialGradient(d.x, top, 0, d.x, top, 40);
        grad.addColorStop(0, "rgba(255, 170, 90, " + g + ")");
        grad.addColorStop(1, "rgba(255, 170, 90, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(d.x - 40, top - 40, 80, 80);
      }
    });
  }

  function hitFloor(x, y) {
    for (let i = 0; i < floorDecor.length; i++) {
      const d = floorDecor[i];
      if (!d.box) continue;
      if (x >= d.box.l - 6 && x <= d.box.r + 6 && y >= d.box.t - 6 && y <= d.box.b + 6) return d;
    }
    return null;
  }

  // Bubbles: drifting up everywhere below the surface. Click or rest on one to pop it.
  const bubbles = [];
  let nextBubble = 0;
  let dwellId = null;
  let dwellStart = 0;

  function spawnBubble(x, y, r, vy) {
    if (bubbles.length > 60) bubbles.shift();
    bubbles.push({ x: x, y: y, born: y, r0: r || rand(2.5, 7), vy: vy || -rand(16, 40), wob: rand(0, TAU), pop: 0, appear: 0, hr: null });
  }

  function bubbleBurst(x, y, n) {
    for (let i = 0; i < n; i++) spawnBubble(x + rand(-14, 14), y + rand(-10, 10), rand(2, 5), -rand(40, 90));
  }

  function drawBubbles(dt) {
    if (!S.reduced) {
      nextBubble -= dt;
      if (nextBubble <= 0) {
        const y0 = Math.max(S.surfaceY + 60, S.view.top + 60);
        const y1 = Math.min(S.floorY, S.view.bottom);
        if (y1 > y0) spawnBubble(rand(10, S.vw - 10), rand(y0, y1));
        nextBubble = rand(0.45, 0.9);
      }
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (!S.reduced && b.pop === 0) {
        b.y += b.vy * dt;
        b.x += Math.sin(S.t * 0.8 + b.wob) * 14 * dt;
        b.appear = Math.min(1, b.appear + dt * 3);
      }
      const rise = Math.max(0, b.born - b.y);
      const radius = b.r0 + rise * 0.018;
      const dark = toneAt(b.y) === "dark";
      if (b.pop > 0) {
        b.hr = null;
        b.pop += dt;
        const k = b.pop / 0.26;
        drawPixelBubble(ctx, b.x, b.y, radius * (1 + k), Math.max(0, b.appear * (1 - k)), dark);
        if (k >= 1) bubbles.splice(i, 1);
        continue;
      }
      if (b.y < level(b.x) + 6 || rise > 720 || radius > 15) {
        b.pop = 0.001;
        continue;
      }
      if (b.y < S.view.top - 300 || b.y > S.view.bottom + 300) {
        bubbles.splice(i, 1);
        continue;
      }
      b.hr = radius;
      drawPixelBubble(ctx, b.x, b.y, radius, b.appear, dark);
    }
  }

  function hitBubble(x, y) {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (b.pop > 0 || b.hr == null) continue;
      const dx = x - b.x;
      const dy = y - b.y;
      const reach = b.hr + 6;
      if (dx * dx + dy * dy <= reach * reach) return b;
    }
    return null;
  }

  // Streamlines: the cursor's recent path, drawn as a bundle of flow lines that hug it
  // at the front and spread and meander behind, like water closing in after a finger.
  const flow = [];
  const FLOW_LIFE = 1.6;
  const FLOW_LINES = [-12, -7, -2.5, 2.5, 7, 12];
  const FLOW_BUCKETS = 10;

  function flowPoint(x, y, under) {
    const last = flow[flow.length - 1];
    if (last && last.under === under && Math.hypot(x - last.x, y - last.y) < 4) return;
    flow.push({ x: x, y: y, age: 0, under: under, dark: under && toneAt(y) === "dark" });
    if (flow.length > 220) flow.shift();
  }

  function drawFlow(dt) {
    for (let i = 0; i < flow.length; i++) flow[i].age += dt;
    while (flow.length && flow[0].age > FLOW_LIFE) flow.shift();
    const n = flow.length;
    if (n < 3) return;
    // Unit normals along the path, smoothed over neighbours.
    const nx = new Array(n);
    const ny = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = flow[Math.max(0, i - 2)];
      const b = flow[Math.min(n - 1, i + 2)];
      const tx = b.x - a.x;
      const ty = b.y - a.y;
      const len = Math.hypot(tx, ty) || 1;
      nx[i] = -ty / len;
      ny[i] = tx / len;
    }
    const light = [];
    const dark = [];
    for (let k = 0; k < FLOW_BUCKETS; k++) {
      light.push(new Path2D());
      dark.push(new Path2D());
    }
    for (let j = 0; j < FLOW_LINES.length; j++) {
      const base = FLOW_LINES[j];
      for (let i = 1; i < n; i++) {
        const p0 = flow[i - 1];
        const p1 = flow[i];
        if (!p0.under || !p1.under) continue;
        const o0 = base * (0.3 + p0.age * 1.5) + Math.sin(p0.age * 5 + j * 1.3) * p0.age * 4;
        const o1 = base * (0.3 + p1.age * 1.5) + Math.sin(p1.age * 5 + j * 1.3) * p1.age * 4;
        const life = 1 - p1.age / FLOW_LIFE;
        const k = Math.min(FLOW_BUCKETS - 1, Math.floor(life * FLOW_BUCKETS));
        const path = p1.dark ? dark[k] : light[k];
        path.moveTo(p0.x + nx[i - 1] * o0, p0.y + ny[i - 1] * o0);
        path.lineTo(p1.x + nx[i] * o1, p1.y + ny[i] * o1);
      }
    }
    ctx.save();
    ctx.lineWidth = 1;
    ctx.lineCap = "round";
    for (let k = 0; k < FLOW_BUCKETS; k++) {
      const fade = Math.pow((k + 0.5) / FLOW_BUCKETS, 1.4);
      ctx.strokeStyle = "rgba(255, 255, 255, " + (0.42 * fade).toFixed(3) + ")";
      ctx.stroke(light[k]);
      ctx.strokeStyle = "rgba(150, 248, 230, " + (0.3 * fade).toFixed(3) + ")";
      ctx.stroke(dark[k]);
    }
    ctx.restore();
  }

  // A little school that chases the cursor while it swims, mills around it when it
  // pauses, and scatters when it rests or leaves the water.
  const chasers = { fish: [], energy: 0, still: 0, cool: 0, on: false };
  const CHASE_N = 7;

  function trailPoint(lag) {
    for (let i = flow.length - 1; i >= 0; i--) {
      if (flow[i].age >= lag) return flow[i];
    }
    return flow.length ? flow[0] : null;
  }

  function drawChasers(dt) {
    const c = S.chase;
    if (!c || S.reduced) {
      chasers.fish.length = 0;
      chasers.on = false;
      return;
    }
    const speed = Math.hypot(c.vx, c.vy);
    const swimming = c.active && c.under && speed > 40;
    chasers.energy = clamp(chasers.energy + (swimming ? dt * 1.4 : -dt * 0.2), 0, 1);
    chasers.still = speed < 20 ? chasers.still + dt : 0;
    chasers.cool = Math.max(0, chasers.cool - dt);
    if (!chasers.on && chasers.energy > 0.45 && chasers.cool <= 0) {
      chasers.on = true;
      const d = speed || 1;
      for (let i = 0; i < CHASE_N; i++) {
        chasers.fish.push({
          x: c.x - c.vx / d * rand(120, 200) + rand(-40, 40),
          y: c.y - c.vy / d * rand(120, 200) + rand(-30, 30),
          vx: 0, vy: 0, a: 0, face: 1, kind: zoneAt(c.y).index >= 3 ? "lantern" : "minnow",
          lag: 0.12 + i * 0.045, side: rand(-16, 16), ph: rand(0, TAU), max: rand(300, 420)
        });
      }
    }
    if (c.active && c.under && speed > 20) touchSchools(c);
    if (!chasers.fish.length) return;
    const leaving = !c.active || !c.under || chasers.still > 2.6 || chasers.energy <= 0;
    const dark = toneAt(c.y) === "dark";
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    for (let i = chasers.fish.length - 1; i >= 0; i--) {
      const f = chasers.fish[i];
      let tx;
      let ty;
      if (leaving) {
        const dx = f.x - c.x;
        const dy = f.y - c.y;
        const d = Math.hypot(dx, dy) || 1;
        tx = f.x + dx / d * 220;
        ty = f.y + dy / d * 220;
        f.a = Math.max(0, f.a - dt * 1.1);
      } else if (speed > 25) {
        const p = trailPoint(f.lag);
        const nx = c.vy / (speed || 1);
        const ny = -c.vx / (speed || 1);
        tx = (p ? p.x : c.x) + nx * f.side;
        ty = (p ? p.y : c.y) + ny * f.side;
        f.a = Math.min(1, f.a + dt * 2);
      } else {
        tx = c.x + Math.cos(S.t * 1.8 + f.ph) * 36;
        ty = c.y + Math.sin(S.t * 2.3 + f.ph) * 22;
        f.a = Math.min(1, f.a + dt * 2);
      }
      let ax = (tx - f.x) * 7 - f.vx * 2.6;
      let ay = (ty - f.y) * 7 - f.vy * 2.6;
      for (let j = 0; j < chasers.fish.length; j++) {
        if (j === i) continue;
        const o = chasers.fish[j];
        const dx = f.x - o.x;
        const dy = f.y - o.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 120 && d2 > 0.01) {
          const d = Math.sqrt(d2);
          ax += dx / d * 600;
          ay += dy / d * 600;
        }
      }
      f.vx += ax * dt;
      f.vy += ay * dt;
      const v = Math.hypot(f.vx, f.vy);
      if (v > f.max) {
        f.vx *= f.max / v;
        f.vy *= f.max / v;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (Math.abs(f.vx) > 12) f.face = f.vx > 0 ? 1 : -1;
      if (f.a <= 0 && leaving) {
        chasers.fish.splice(i, 1);
        continue;
      }
      const fishDark = toneAt(f.y) === "dark";
      const frames = f.kind === "lantern" ? lanternSheets : (fishDark ? minnowDark : minnowLight);
      const sh = frames[Math.floor(S.t * (v > 120 ? 12 : 5) + f.ph) % frames.length];
      ctx.save();
      ctx.globalAlpha = f.a * (fishDark ? 0.9 : 0.75);
      ctx.translate(Math.round(f.x), Math.round(f.y));
      ctx.scale(f.face * 2, 2);
      ctx.drawImage(sh, -sh.width / 2, -sh.height / 2);
      ctx.restore();
      l = Math.min(l, f.x - 10); r = Math.max(r, f.x + 10);
      t = Math.min(t, f.y - 6); b = Math.max(b, f.y + 6);
    }
    if (!chasers.fish.length) {
      chasers.on = false;
      chasers.cool = 1.5;
      chasers.box = null;
    } else {
      chasers.box = { l: l, t: t, r: r, b: b, dark: dark };
    }
  }

  // When the cursor (or the school following it) touches another school, that school
  // decides: most of the time it joins; if it refuses, it can be asked again a bit later.
  function touchSchools(c) {
    const fb = chasers.box;
    const px = P.x;
    const py = P.y;
    schools.forEach(function (s) {
      if (!s.box || s.meetCool > 0 || !s.shown || s.dead) return;
      const pad = 30;
      const cursorIn = px > s.box.l - pad && px < s.box.r + pad && py > s.box.t - pad && py < s.box.b + pad;
      const headIn = c.x > s.box.l - pad && c.x < s.box.r + pad && c.y > s.box.t - pad && c.y < s.box.b + pad;
      const followersIn = fb && chasers.on && !(fb.r + 40 < s.box.l || fb.l - 40 > s.box.r || fb.b + 40 < s.box.t || fb.t - 40 > s.box.b);
      if (!cursorIn && !headIn && !followersIn) return;
      const x = (s.box.l + s.box.r) / 2;
      const y = s.box.t - 12;
      const dark = toneAt(s.cy) === "dark";
      if (Math.random() < 0.7 && chasers.fish.length < 32) {
        s.meetCool = 6;
        let n = 0;
        s.members.forEach(function (m) {
          if (m.gone > 0 || chasers.fish.length >= 32) return;
          chasers.fish.push({
            x: m.x, y: m.y, vx: m.vx, vy: m.vy, a: s.wild ? Math.max(0.4, s.alpha) : 1, face: m.face, kind: s.spec.kind,
            lag: rand(0.12, 0.9), side: rand(-26, 26), ph: m.ph, max: rand(300, 420)
          });
          m.gone = s.wild ? 1e9 : rand(30, 50);
          n += 1;
        });
        chasers.on = true;
        chasers.energy = 1;
        chasers.still = 0;
        addFx({ k: "label", x: x, y: y, vx: 0, g: 0, text: "+" + n + " joined!", col: "255, 210, 122", vy: -26, life: 1.5, max: 1.5 });
        sparks(x, y + 12, 10, "255, 210, 122");
        if (s.wild) s.dead = true;
      } else {
        s.meetCool = 6;
        scatter(s, px, py, 650);
        addFx({ k: "label", x: x, y: y, vx: 0, g: 0, text: pick(["nah!", "no thanks!", "shy…", "busy!", "maybe later"]), col: dark ? "160, 248, 232" : "255, 255, 255", vy: -22, life: 1.3, max: 1.3 });
      }
    });
  }

  // Short-lived effects: splashes, ink, sparks, rings, flashes.
  const fx = [];
  function addFx(o) {
    fx.push(o);
    if (fx.length > 280) fx.shift();
  }

  function splash(x, n) {
    const y = level(x);
    bump(x, 12, 64);
    for (let i = 0; i < (n || 10); i++) {
      addFx({ k: "drop", x: x + rand(-10, 10), y: y - 2, vx: rand(-90, 90), vy: rand(-260, -110), g: 700, life: 1, max: 1, col: "255, 252, 247" });
    }
  }

  function ring(x, y, col, r, life) {
    addFx({ k: "ring", x: x, y: y, r: r || 70, life: life || 1.1, max: life || 1.1, col: col });
  }

  function inkCloud(x, y, n) {
    for (let i = 0; i < n; i++) {
      addFx({ k: "ink", x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-30, 30), vy: rand(-20, 20), r: rand(3, 6), grow: rand(10, 20), life: 1.8, max: 1.8 });
    }
  }

  function sparks(x, y, n, col) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU);
      const s = rand(30, 110);
      addFx({ k: "spark", x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 0, life: rand(0.5, 1), max: 1, col: col });
    }
  }

  function flash(x, y, r, col, life) {
    addFx({ k: "flash", x: x, y: y, r: r, col: col, life: life || 0.5, max: life || 0.5 });
  }

  function sandPuff(x, y, n) {
    for (let i = 0; i < n; i++) {
      addFx({ k: "sand", x: x + rand(-10, 10), y: y, vx: rand(-60, 60), vy: -rand(20, 80), g: 80, life: rand(0.8, 1.4), max: 1.4, col: "120, 128, 140" });
    }
  }

  function feathers(x, y, n) {
    for (let i = 0; i < n; i++) {
      addFx({ k: "feather", x: x + rand(-10, 10), y: y, vx: rand(-40, 40), vy: -rand(10, 50), g: 40, ph: rand(0, TAU), life: 2.2, max: 2.2, col: "255, 252, 247" });
    }
  }

  function fishBurst(x, y, n) {
    for (let i = 0; i < n; i++) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      addFx({ k: "fish", x: x + rand(-20, 20), y: y + rand(-30, 0), vx: dir * rand(90, 170), vy: rand(-40, 10), g: 0, dir: dir, life: 1.3, max: 1.3 });
    }
  }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) {
        fx.splice(i, 1);
        if (f.done) f.done();
        continue;
      }
      const k = 1 - f.life / f.max;
      if (f.vx != null) {
        f.vy += (f.g || 0) * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
      }
      if (f.k === "drop") {
        if (f.vy > 0 && f.y > level(f.x) && f.y < S.surfaceY + 30) {
          fx.splice(i, 1);
          continue;
        }
        ctx.fillStyle = "rgba(" + f.col + ", " + Math.min(1, f.life * 2).toFixed(2) + ")";
        ctx.fillRect(Math.round(f.x), Math.round(f.y), 3, 3);
      } else if (f.k === "ring") {
        const r = 6 + k * f.r;
        const a = (1 - k) * 0.7 * (f.a || 1);
        ctx.fillStyle = "rgba(" + f.col + ", " + a.toFixed(3) + ")";
        const n = Math.max(12, Math.round(r * 0.9));
        for (let j = 0; j < n; j++) {
          const ang = j / n * TAU;
          ctx.fillRect(Math.round((f.x + Math.cos(ang) * r) / 2) * 2, Math.round((f.y + Math.sin(ang) * r) / 2) * 2, 2, 2);
        }
      } else if (f.k === "ink") {
        f.vx *= Math.exp(-2 * dt);
        f.vy *= Math.exp(-2 * dt);
        const r = f.r + k * f.grow;
        const a = (1 - k) * 0.55;
        ctx.fillStyle = "rgba(24, 16, 36, " + a.toFixed(3) + ")";
        const s = 3;
        for (let yy = -r; yy <= r; yy += s) {
          const span = Math.sqrt(Math.max(0, r * r - yy * yy));
          ctx.fillRect(Math.round((f.x - span) / s) * s, Math.round((f.y + yy) / s) * s, Math.round(span * 2 / s) * s, s);
        }
      } else if (f.k === "orb") {
        // A rainbow orb thrown along an arc, trailing its colours.
        const cols = ["#9d8fdc", "#6fb3dc", "#7cc48a", "#f2d36b", "#f0a35e", "#e9788a"];
        const mx = (f.x0 + f.x1) / 2;
        const my = Math.min(f.y0, f.y1) - 150;
        const at = function (u) {
          const v = 1 - u;
          return { x: v * v * f.x0 + 2 * v * u * mx + u * u * f.x1, y: v * v * f.y0 + 2 * v * u * my + u * u * f.y1 };
        };
        const u = 1 - Math.pow(1 - k, 1.6);
        for (let j = cols.length - 1; j >= 0; j--) {
          const p = at(Math.max(0, u - (j + 1) * 0.028));
          const size = Math.max(2, 7 - j);
          ctx.fillStyle = cols[j];
          ctx.fillRect(Math.round(p.x - size / 2), Math.round(p.y - size / 2), size, size);
        }
        const head = at(u);
        ctx.fillStyle = "rgba(255, 252, 240, 0.35)";
        ctx.fillRect(Math.round(head.x) - 8, Math.round(head.y) - 8, 16, 16);
        ctx.fillStyle = "#fffcf7";
        ctx.fillRect(Math.round(head.x) - 4, Math.round(head.y) - 4, 8, 8);
      } else if (f.k === "label") {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
        ctx.font = "9px Silkscreen, monospace";
        ctx.textAlign = "center";
        ctx.lineWidth = 3;
        ctx.strokeStyle = "rgba(4, 19, 28, 0.85)";
        ctx.strokeText(f.text.toUpperCase(), Math.round(f.x), Math.round(f.y));
        ctx.fillStyle = "rgb(" + f.col + ")";
        ctx.fillText(f.text.toUpperCase(), Math.round(f.x), Math.round(f.y));
        ctx.restore();
      } else if (f.k === "spark") {
        ctx.fillStyle = "rgba(" + f.col + ", " + (1 - k).toFixed(3) + ")";
        ctx.fillRect(Math.round(f.x), Math.round(f.y), 3, 3);
      } else if (f.k === "flash") {
        const a = (1 - k) * 0.6;
        const grad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r);
        grad.addColorStop(0, "rgba(" + f.col + ", " + a.toFixed(3) + ")");
        grad.addColorStop(1, "rgba(" + f.col + ", 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
      } else if (f.k === "sand") {
        f.vx *= Math.exp(-2.5 * dt);
        if (f.y > floorTop(f.x) + 2) {
          f.y = floorTop(f.x) + 2;
          f.vy = 0;
        }
        ctx.fillStyle = "rgba(" + f.col + ", " + (1 - k).toFixed(3) + ")";
        ctx.fillRect(Math.round(f.x / 2) * 2, Math.round(f.y / 2) * 2, 3, 3);
      } else if (f.k === "feather") {
        f.vx = Math.sin(S.t * 3 + f.ph) * 40;
        f.vy = Math.min(f.vy, 40);
        ctx.fillStyle = "rgba(" + f.col + ", " + (1 - k).toFixed(3) + ")";
        ctx.fillRect(Math.round(f.x), Math.round(f.y), 4, 2);
        ctx.fillStyle = "rgba(108, 117, 125, " + ((1 - k) * 0.8).toFixed(3) + ")";
        ctx.fillRect(Math.round(f.x) + 4, Math.round(f.y), 2, 2);
      } else if (f.k === "fish") {
        const dark = toneAt(f.y) === "dark";
        const sh = (dark ? minnowDark : minnowLight)[Math.floor(S.t * 8) % 2];
        ctx.save();
        ctx.globalAlpha = 1 - k;
        ctx.translate(Math.round(f.x), Math.round(f.y));
        ctx.scale(f.dir * 2, 2);
        ctx.drawImage(sh, -sh.width / 2, -sh.height / 2);
        ctx.restore();
      }
    }
  }

  // Light sources that belong to creatures: the anglerfish lure and the ROV's lamp and tether.
  function drawCreatureLights() {
    critters.forEach(function (c) {
      if (c.spec.id === "torch") {
        const gx = c.frame === 1 ? 20 : 19;
        const lx = c.x + (c.dir > 0 ? gx : c.gw - 1 - gx) * c.scale + c.scale / 2;
        const ly = c.y + 3 * c.scale + c.bob;
        if (ly < S.view.top - 300 || ly > S.view.bottom + 300) return;
        const flare = c.flare || 0;
        const r = 64 + flare * 170 + Math.sin(S.t * 3) * 4;
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, r);
        grad.addColorStop(0, "rgba(255, 214, 128, " + (0.38 + flare * 0.4).toFixed(3) + ")");
        grad.addColorStop(0.35, "rgba(255, 200, 110, " + (0.1 + flare * 0.18).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(255, 200, 110, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(lx - r, ly - r, r * 2, r * 2);
        glowNear(lx, ly, 70 + flare * 120);
      } else if (c.spec.id === "jetson") {
        if (c.y < S.view.top - 400 || c.y > S.view.bottom + 300) return;
        const sc = c.scale;
        const tx = c.x + (c.dir > 0 ? 12 : c.gw - 13) * sc;
        const ty = c.y + c.bob;
        const topY = Math.max(S.view.top - 10, S.byId.experience.top - 40);
        ctx.fillStyle = "rgba(242, 201, 76, 0.55)";
        for (let y = ty; y > topY; y -= 4) {
          const sway = Math.sin((ty - y) * 0.012 + S.t * 0.8) * Math.min(18, (ty - y) * 0.05);
          ctx.fillRect(Math.round(tx + sway), Math.round(y), 2, 3);
        }
        const lx = c.x + (c.dir > 0 ? 24 : c.gw - 25) * sc;
        const ly = c.y + 5 * sc + c.bob;
        const scan = c.scan || 0;
        const len = 260 + scan * 60;
        const sweep = scan > 0 ? Math.sin(scan * 7) * 0.5 : Math.sin(S.t * 0.5) * 0.12;
        const ang = (c.dir > 0 ? 0 : Math.PI) + sweep * c.dir + 0.18 * c.dir;
        const spread = 0.3;
        const grad = ctx.createRadialGradient(lx, ly, 0, lx, ly, len);
        grad.addColorStop(0, "rgba(255, 246, 214, " + (0.22 + scan * 0.25).toFixed(3) + ")");
        grad.addColorStop(1, "rgba(255, 246, 214, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + Math.cos(ang - spread) * len, ly + Math.sin(ang - spread) * len);
        ctx.lineTo(lx + Math.cos(ang + spread) * len, ly + Math.sin(ang + spread) * len);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  function glowNear(x, y, radius) {
    for (let i = 0; i < plankton.length; i++) {
      const p = plankton[i];
      const dx = p.x - x;
      const dy = p.y - y;
      if (dx * dx + dy * dy < radius * radius) p.g = Math.max(p.g, 0.6);
    }
  }

  // Vision mode: what a detector would draw over the scene.
  function bracket(l, t, r, b, label, dark) {
    const col = dark ? "#6ff5df" : "#12a58c";
    const L = 8;
    ctx.fillStyle = col;
    l = Math.round(l); t = Math.round(t); r = Math.round(r); b = Math.round(b);
    ctx.fillRect(l, t, L, 2); ctx.fillRect(l, t, 2, L);
    ctx.fillRect(r - L, t, L, 2); ctx.fillRect(r - 2, t, 2, L);
    ctx.fillRect(l, b - 2, L, 2); ctx.fillRect(l, b - L, 2, L);
    ctx.fillRect(r - L, b - 2, L, 2); ctx.fillRect(r - 2, b - L, 2, L);
    ctx.font = "8px Silkscreen, monospace";
    const tw = ctx.measureText(label).width;
    ctx.fillRect(l, t - 13, tw + 8, 12);
    ctx.fillStyle = dark ? "#04131c" : "#f4fffc";
    ctx.fillText(label, l + 4, t - 4);
  }

  function drawVision() {
    if (chasers.box) {
      const cb = chasers.box;
      bracket(cb.l - 6, cb.t - 6, cb.r + 6, cb.b + 6, ("Curious juveniles x" + chasers.fish.length + " 0.86").toUpperCase(), cb.dark);
    }
    schools.forEach(function (s, i) {
      if (!s.box) return;
      const conf = (0.84 + (i % 4) * 0.03).toFixed(2);
      bracket(s.box.l - 6, s.box.t - 6, s.box.r + 6, s.box.b + 6, (s.spec.label + " x" + s.members.length + " " + conf).toUpperCase(), toneAt(s.box.t) === "dark");
    });
    if (S.view.top < S.surfaceY) {
      clouds.forEach(function (c, i) {
        bracket(c.x - 4, c.y - 4, c.x + c.w + 4, c.y + c.h + 4, ("Cumulus " + (0.9 + i * 0.02).toFixed(2)).toUpperCase(), false);
      });
    }
    shelves.forEach(function (s) {
      if (s.y < S.view.top || s.y - 110 > S.view.bottom) return;
      const name = s.kind === "weed" ? "Seagrass + kelp bed 0.91" : "Coral reef 0.94";
      bracket(s.x - s.span / 2 - 6, s.y - 112, s.x + s.span / 2 + 6, s.y + 18, name.toUpperCase(), false);
    });
    floorDecor.forEach(function (d) {
      if (!d.box || d.k === "rock") return;
      const name = d.k === "star" ? "Asteroidea 0.93"
        : d.k === "worm" ? "Riftia 0.88"
        : d.k === "flora" ? FLORA[d.f].label + " 0.9" + (d.x % 7)
        : "Hydrothermal vent 0.97";
      bracket(d.box.l - 4, d.box.t - 4, d.box.r + 4, d.box.b + 2, name.toUpperCase(), true);
    });
  }

  function drawOcean(dt) {
    const oy = Math.round(S.sy);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, S.vw, S.vh);
    ctx.setTransform(dpr, 0, 0, dpr, 0, -oy * dpr);
    ctx.imageSmoothingEnabled = false;
    S.view.top = oy - 60;
    S.view.bottom = oy + S.vh + 60;
    if (S.view.top < S.surfaceY + 60) {
      drawSky(dt);
      drawStorm(dt);
      drawWaves(dt);
    }
    drawRays();
    drawFloor(dt);
    drawShelves(dt);
    drawPlankton(dt);
    drawSnow(dt);
    drawCreatureLights();
    drawSchools(dt);
    drawFlow(dt);
    drawChasers(dt);
    drawBubbles(dt);
    drawFx(dt);
    drawRain(dt);
    if (S.vision) drawVision();
  }

  /* ---------- pointer on the open scene ---------- */

  function isControl(target) {
    return !!(target && target.closest && target.closest("a, button, input, textarea, select, label, .critter, .chat, .top, .gauge, figure, .skip"));
  }

  function sceneHit(x, y) {
    const cy = y - S.sy;
    const photo = photoBubbles.hit(x, cy);
    if (photo) return function () { photoBubbles.pop(photo); };
    const onTrack = arcade.hit(x, cy);
    if (onTrack) return onTrack;
    const onRainbow = rainbow.hit(x, cy);
    if (onRainbow) return onRainbow;
    const b = hitBubble(x, y);
    if (b) return function () { b.pop = 0.001; };
    const s = hitSchool(x, y);
    if (s) {
      return function () {
        scatter(s, x, y, 520);
        bubbleBurst(x, y, 3);
      };
    }
    if (y < S.surfaceY - 40) {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) {
          return function () {
            c.rain = 2.6;
            c.lining = 2.2;
            sparks(x, y, 8, "205, 218, 230");
          };
        }
      }
    }
    const d = hitFloor(x, y);
    if (d) {
      return function () {
        if (d.k === "star") d.spin = 0.9;
        else if (d.k === "flora") {
          d.act = 2.4;
          const cy = (d.box.t + d.box.b) / 2;
          if (d.f === "bamboo") {
            sparks(d.x, cy, 12, "111, 245, 223");
            glowAround(d.x, cy, 200);
          } else if (d.f === "bubblegum") {
            sparks(d.x, d.box.t + 10, 10, "255, 252, 247");
          } else if (d.f === "sponge") {
            fishBurst(d.x, cy, 2);
            bubbleBurst(d.x, d.box.t, 4);
          } else if (d.f === "crinoid") {
            sparks(d.x, d.box.t + 8, 6, "226, 196, 138");
          }
        } else if (d.k === "worm") {
          floorDecor.forEach(function (o) { if (o.k === "worm" && Math.abs(o.x - d.x) < 60) o.hide = 2.4; });
        } else if (d.k === "vent") {
          for (let i = 0; i < 8; i++) spawnBubble(d.x + rand(-6, 6), d.box.t - i * 6, rand(3, 6), -rand(60, 110));
          flash(d.x, d.box.t, 90, "255, 170, 90", 0.8);
        }
        sandPuff(d.x, floorTop(d.x), 8);
      };
    }
    for (let i = 0; i < shelves.length; i++) {
      const sh = shelves[i];
      if (Math.abs(x - sh.x) < sh.span / 2 && y > sh.y - 100 && y < sh.y + 20) {
        return function () {
          fishBurst(sh.x, sh.y - 40, 5);
          bubbleBurst(sh.x, sh.y - 30, 4);
        };
      }
    }
    return null;
  }

  function overScene(cx, cy) {
    const y = cy + S.sy;
    if (photoBubbles.hit(cx, cy) || arcade.hit(cx, cy) || rainbow.hit(cx, cy) || hitBubble(cx, y) || hitSchool(cx, y) || hitFloor(cx, y)) return true;
    if (y < S.surfaceY - 40) {
      for (let i = 0; i < clouds.length; i++) {
        const c = clouds[i];
        if (cx >= c.x && cx <= c.x + c.w && y >= c.y && y <= c.y + c.h) return true;
      }
    }
    return false;
  }

  function waterClick(x, y) {
    if (y < S.surfaceY - 70) {
      sparks(x, y, 7, "226, 196, 138");
      return;
    }
    if (y < S.surfaceY + 30) {
      splash(x, 12);
      return;
    }
    const dark = toneAt(y) === "dark";
    ring(x, y, dark ? "111, 245, 223" : "255, 252, 240", 64);
    bubbleBurst(x, y, 4);
    if (dark) glowAround(x, y, 240);
    schools.forEach(function (s) {
      if (s.box && Math.hypot((s.box.l + s.box.r) / 2 - x, (s.box.t + s.box.b) / 2 - y) < 220) scatter(s, x, y, 300);
    });
  }

  let downAt = null;
  function notePointer(event) {
    P.cx = event.clientX;
    P.cy = event.clientY;
    P.x = P.cx;
    P.y = P.cy + S.sy;
    P.active = event.pointerType !== "touch" || event.type !== "pointerup";
  }

  window.addEventListener("pointermove", notePointer, { passive: true });
  document.addEventListener("pointerdown", function (event) {
    notePointer(event);
    downAt = { x: event.clientX, y: event.clientY, skip: false };
    if ((event.button != null && event.button !== 0) || isControl(event.target)) {
      downAt.skip = true;
      return;
    }
    const hit = sceneHit(event.clientX, event.clientY + S.sy);
    if (hit) {
      event.preventDefault();
      hit();
      downAt.skip = true;
      dwellId = null;
    }
  }, true);
  window.addEventListener("pointerup", function (event) {
    notePointer(event);
    if (event.pointerType === "touch") P.active = false;
    if (!downAt) return;
    const moved = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
    const skip = downAt.skip;
    downAt = null;
    if (skip || moved > 6 || isControl(event.target)) return;
    const sel = window.getSelection && window.getSelection();
    if (sel && !sel.isCollapsed) return;
    waterClick(event.clientX, event.clientY + S.sy);
  });
  document.documentElement.addEventListener("mouseleave", function () { P.active = false; });
  window.addEventListener("blur", function () { P.active = false; });

  function dwell(now) {
    if (!P.active || COARSE) {
      dwellId = null;
      return;
    }
    const b = hitBubble(P.x, P.y);
    if (b !== dwellId) {
      dwellId = b;
      dwellStart = now;
      return;
    }
    if (b && now - dwellStart > 500) {
      b.pop = 0.001;
      dwellId = null;
    }
  }

  /* ---------- creatures ---------- */

  const reef = document.getElementById("reef");
  const critters = [];

  function rectFor(c) {
    const z = S.byId[c.spec.zone];
    const w = c.w;
    const h = c.h;
    const right = S.vw - (S.gauge ? 90 : 0);
    const m = c.spec.motion;
    if (m === "surf") return { x0: 12, x1: right - w - 12, y0: 0, y1: 0 };
    if (m === "walk") {
      const y = S.floorY - h + 8;
      return { x0: 12, x1: right - w - 12, y0: y, y1: y };
    }
    const gutterL = S.wrapL;
    const gutterR = right - S.wrapR;
    if (m === "fly") {
      const top = S.headerH + 14;
      if (gutterR > w + 60) {
        return { x0: S.wrapR + 20, x1: right - w - 20, y0: top + 10, y1: Math.max(top + 10, S.surfaceY - 280) };
      }
      return { x0: 10, x1: right - w - 10, y0: top + 4, y1: top + 30 };
    }
    const g = c.spec.side === "L" ? gutterL : gutterR;
    if (c.spec.pref !== "stage" && g >= w + 44) {
      const x0 = c.spec.side === "L" ? 16 : S.wrapR + 16;
      const x1 = c.spec.side === "L" ? S.wrapL - w - 16 : right - w - 16;
      const bottom = z.id === "experience" ? S.floorY - 80 : z.bottom - 40;
      return { x0: x0, x1: Math.max(x0, x1), y0: z.top + 40, y1: Math.max(z.top + 40, bottom - h) };
    }
    // No room in the gutters: share the stage band, one loose lane per creature.
    const y0 = z.stageTop + 14;
    const mates = critters.filter(function (o) {
      return o.spec.zone === c.spec.zone && ["surf", "walk", "fly", "hunt"].indexOf(o.spec.motion) < 0;
    });
    const n = Math.max(1, mates.length);
    const k = Math.max(0, mates.indexOf(c));
    const lane = (right - 20) / n;
    const x0 = clamp(10 + k * lane - 24, 10, right - w - 10);
    const x1 = clamp(10 + (k + 1) * lane - w + 24, x0, right - w - 10);
    return { x0: x0, x1: x1, y0: y0, y1: Math.max(y0, z.stageTop + z.stageH - h - 14) };
  }

  function inRect(c, r) {
    return c.x >= r.x0 - 30 && c.x <= r.x1 + 30 && c.y >= r.y0 - 40 && c.y <= r.y1 + 40;
  }

  function pickTarget(c) {
    const r = c.rect;
    c.tx = rand(r.x0, r.x1);
    c.ty = rand(r.y0, r.y1);
  }

  function makeCritter(spec, index) {
    const el = document.createElement("div");
    el.className = "critter";
    el.dataset.id = spec.id;
    el.innerHTML =
      '<button class="critter-btn" type="button">' +
        '<span class="critter-flip"><span class="critter-body"></span></span>' +
      "</button>" +
      '<span class="box" aria-hidden="true"></span>' +
      '<div class="tag">' +
        '<ol class="taxa" hidden></ol>' +
        '<div class="tag-head px"><span class="tag-name"></span><b></b>' +
          '<button class="tag-arrow" type="button" aria-expanded="false">▸</button>' +
        "</div>" +
      "</div>";
    reef.appendChild(el);
    const frames = padFrames(PX.SPRITES[spec.sprite]);
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    el.querySelector(".critter-body").appendChild(canvas);
    paint(canvas, frames[0]);
    const sheets = frames.map(function (f) { return sheet(f); });
    const btn = el.querySelector(".critter-btn");
    btn.setAttribute("aria-label", spec.name + ", pixel " + spec.species + ". Press to talk; arrow keys move it.");
    el.querySelector(".tag-name").textContent = spec.common;
    el.querySelector(".tag-head b").textContent = spec.conf;
    const taxa = el.querySelector(".taxa");
    spec.taxa.forEach(function (row, i) {
      const li = document.createElement("li");
      li.className = row[0].toLowerCase();
      li.style.setProperty("--i", i);
      li.innerHTML = '<span class="rank"></span><span class="taxon"></span>';
      li.querySelector(".rank").textContent = row[0];
      li.querySelector(".taxon").textContent = row[1];
      taxa.appendChild(li);
    });
    const c = {
      spec: spec, index: index, el: el, btn: btn,
      flipEl: el.querySelector(".critter-flip"),
      body: el.querySelector(".critter-body"),
      canvas: canvas, cctx: canvas.getContext("2d"), sheets: sheets, frames: frames, frame: 0, css: {},
      gw: frames[0][0].length, gh: frames[0].length,
      scale: 3, w: 0, h: 0,
      x: 0, y: 0, vx: 0, vy: 0, dir: 1, tx: 0, ty: 0,
      state: "roam", wait: 0, timer: 0, pulse: rand(0, 1.5), placed: false,
      bob: 0, ph: rand(0, TAU), tone: "", flare: 0, scan: 0, press: null,
      rect: { x0: 0, x1: 0, y0: 0, y1: 0 }, quipEl: null, quipTimer: 0, hover: false, inspect: false
    };
    bindCritter(c);
    return c;
  }

  function sizeCritter(c) {
    c.scale = S.narrow ? c.spec.scale[1] : c.spec.scale[0];
    c.w = c.gw * c.scale;
    c.h = c.gh * c.scale;
    c.canvas.style.width = c.w + "px";
    c.canvas.style.height = c.h + "px";
  }

  onLayout(function () {
    critters.forEach(function (c) {
      sizeCritter(c);
      c.rect = rectFor(c);
      if (!c.placed) {
        c.placed = true;
        pickTarget(c);
        c.x = c.tx;
        c.y = c.ty;
        if (c.spec.motion === "surf") {
          c.x = S.vw * (S.narrow ? 0.55 : 0.4);
          c.dir = 1;
        }
        if (c.spec.motion === "hunt") {
          c.state = "away";
          c.timer = rand(22, 34);
        }
        pickTarget(c);
      } else if (c.state === "roam" && !inRect(c, c.rect)) {
        c.state = c.spec.motion === "walk" ? "sink" : "home";
      }
    });
    chat.place();
  });

  function surfY(c) {
    return level(c.x + c.w / 2) - c.h + c.scale * 2;
  }

  function steer(c, dt, speed, accel) {
    const dx = c.tx - c.x;
    const dy = c.ty - c.y;
    const d = Math.hypot(dx, dy);
    const want = d > 0.5 ? speed * Math.min(1, d / 50) : 0;
    const vx = d > 0.01 ? dx / d * want : 0;
    const vy = d > 0.01 ? dy / d * want : 0;
    const k = Math.min(1, accel * dt);
    c.vx += (vx - c.vx) * k;
    c.vy += (vy - c.vy) * k;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
    return d;
  }

  function settle(c, dt, k) {
    const f = Math.exp(-(k || 3) * dt);
    c.vx *= f;
    c.vy *= f;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }

  function roam(c, dt) {
    const sp = c.spec.speed;
    const m = c.spec.motion;
    if (m === "surf") {
      c.x += c.dir * sp * dt;
      if (c.x < c.rect.x0) c.dir = 1;
      if (c.x > c.rect.x1) c.dir = -1;
      c.vx = c.dir * sp;
      c.y = surfY(c);
      return;
    }
    if (m === "drift") {
      c.pulse -= dt;
      if (c.pulse <= 0) {
        c.pulse = rand(1.5, 2.6);
        if (Math.random() < 0.3 || Math.abs(c.tx - c.x) < 20) pickTarget(c);
        c.vy = c.y > c.ty ? -sp * 3.4 : -sp * 1.2;
        c.vx = clamp(c.tx - c.x, -1, 1) * sp * 1.6;
      }
      c.vy = Math.min(c.vy + 22 * dt, 12);
      c.vx *= Math.exp(-0.8 * dt);
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.y = clamp(c.y, c.rect.y0 - 30, c.rect.y1 + 20);
      c.x = clamp(c.x, c.rect.x0 - 10, c.rect.x1 + 10);
      return;
    }
    if (c.wait > 0) {
      c.wait -= dt;
      settle(c, dt, 3);
      return;
    }
    const accel = m === "glide" ? 1.2 : m === "walk" ? 6 : 2.4;
    const d = steer(c, dt, sp, accel);
    if (m === "walk") c.y = c.rect.y0;
    if (d < 10) {
      pickTarget(c);
      if (Math.random() < (m === "walk" ? 0.6 : 0.4)) c.wait = rand(0.6, 2.6);
    }
  }

  function homeRun(c, dt) {
    const r = c.rect;
    const tx = clamp(c.x, r.x0, r.x1);
    const ty = clamp(c.y, r.y0, r.y1);
    const dx = tx - c.x;
    const dy = ty - c.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      c.state = "roam";
      pickTarget(c);
      return;
    }
    const speed = Math.max(130, c.spec.speed * 3);
    const k = Math.min(1, 2.5 * dt);
    c.vx += (dx / d * speed - c.vx) * k;
    c.vy += (dy / d * speed - c.vy) * k;
    c.x += c.vx * dt;
    c.y += c.vy * dt;
  }

  function waterlineFor(c) {
    return level(c.x + c.w / 2);
  }

  function updateCritter(c, dt) {
    const m = c.spec.motion;
    if (S.reduced && c.state !== "drag" && m !== "hunt") {
      if (c.state === "roam" && m === "surf") c.y = surfY(c);
      c.vx = 0;
      c.vy = 0;
      return;
    }
    if (m === "hunt" && updateShark(c, dt)) return;
    if ((c.state === "free" || c.state === "home") && (m === "surf" || m === "walk")) {
      if (m === "walk") c.state = "sink";
      else c.state = c.y + c.h * 0.6 < waterlineFor(c) ? "fall" : "rise";
    }
    switch (c.state) {
      case "roam":
        if (c.hover || c.inspect) {
          settle(c, dt, 6);
          if (m === "surf") c.y = surfY(c);
          if (m === "walk") c.y = c.rect.y0;
        } else roam(c, dt);
        break;
      case "meet": {
        c.tx = c.meet.x;
        c.ty = c.meet.y;
        const d = steer(c, dt, Math.max(70, c.spec.speed * 2.2), 3);
        if (m === "walk") c.y = c.rect.y0;
        if (m === "surf") c.y = surfY(c);
        if (d < 8 && c.spec.flips) c.dir = c.meet.face;
        break;
      }
      case "play":
        c.tx = c.playT.x;
        c.ty = c.playT.y;
        steer(c, dt, c.playSpeed, 5);
        if (m === "walk") c.y = c.rect.y0;
        break;
      case "chat":
        settle(c, dt, 5);
        if (m === "surf") c.y = surfY(c);
        if (m === "walk") c.y = c.rect.y0;
        break;
      case "drag": {
        c.x = clamp(P.cx - c.grabX, 0, S.vw - c.w);
        c.y = clamp(P.cy + S.sy - c.grabY, 0, S.docH - c.h - 4);
        const now = performance.now();
        c.marks.push({ x: c.x, y: c.y, t: now });
        while (c.marks.length > 2 && now - c.marks[0].t > 100) c.marks.shift();
        const edge = 80;
        if (P.cy > S.vh - edge) window.scrollBy(0, Math.round((P.cy - (S.vh - edge)) / edge * 900 * dt));
        else if (P.cy < S.headerH + edge) window.scrollBy(0, -Math.round((S.headerH + edge - P.cy) / edge * 900 * dt));
        break;
      }
      case "fall":
        c.vy += 980 * dt;
        c.vx *= Math.exp(-0.6 * dt);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.y + c.h * 0.6 >= waterlineFor(c)) {
          splash(c.x + c.w / 2, 14);
          c.vy *= 0.2;
          if (m === "surf") {
            c.state = "roam";
            c.y = surfY(c);
          } else if (m === "walk") c.state = "sink";
          else if (m === "fly") c.state = "rise";
          else {
            c.state = "free";
            c.timer = rand(4, 7);
          }
        }
        break;
      case "rise":
        c.vy += (-260 - c.vy) * Math.min(1, 3 * dt);
        c.vx *= Math.exp(-1.5 * dt);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        if (c.y + c.h * 0.6 <= waterlineFor(c)) {
          splash(c.x + c.w / 2, 8);
          if (m === "surf") {
            c.state = "roam";
            c.y = surfY(c);
          } else {
            c.state = "home";
            c.vy = -120;
          }
        }
        break;
      case "sink": {
        c.vx *= Math.exp(-2 * dt);
        c.vy += (220 - c.vy) * Math.min(1, 2 * dt);
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        const floor = S.floorY - c.h + 8;
        if (c.y >= floor) {
          c.y = floor;
          c.vy = 0;
          c.state = "roam";
          sandPuff(c.x + c.w / 2, floorTop(c.x + c.w / 2), 10);
          pickTarget(c);
          c.wait = 0.8;
        }
        break;
      }
      case "free":
        settle(c, dt, 2.2);
        c.timer -= dt;
        if (c.timer <= 0) c.state = "home";
        break;
      case "home":
        homeRun(c, dt);
        break;
    }
    if (m === "fly" && c.state === "home" && c.y + c.h > waterlineFor(c) && c.vy > -100) c.vy = -200;
  }

  function renderCritter(c, now) {
    const m = c.spec.motion;
    const moving = Math.abs(c.vx) + Math.abs(c.vy) > 6;
    let rate = m === "fly" ? 6 : m === "walk" ? (moving ? 7 : 1.4) : m === "glide" ? 2.2 : m === "drift" ? (c.vy < -10 ? 5 : 1.6) : 3.6;
    if (c.state === "drag") rate = 10;
    if (S.reduced) rate = 0;
    const away = c.state === "away";
    if (away !== c.away) {
      c.away = away;
      c.el.style.display = away ? "none" : "";
    }
    if (away) return;
    if (c.chomp > 0) c.chomp -= 1 / 60;
    let frame = rate ? Math.floor(now / 1000 * rate + c.ph) % c.frames.length : 0;
    if (c.chomp > 0) frame = -1;
    if (frame !== c.frame) {
      c.frame = frame;
      c.cctx.clearRect(0, 0, c.gw, c.gh);
      c.cctx.drawImage(frame < 0 ? chompSheet : c.sheets[frame], 0, 0);
    }
    if (c.spec.flips && c.state !== "drag") {
      if (c.vx > 5) c.dir = 1;
      else if (c.vx < -5) c.dir = -1;
    }
    const bobAmp = m === "walk" || m === "surf" ? 0 : m === "fly" ? 3 : 2;
    c.bob = S.reduced ? 0 : Math.sin(now / 520 + c.ph) * bobAmp;
    c.flare = Math.max(0, c.flare - 0.016);
    c.scan = Math.max(0, c.scan - 0.012);
    let tilt = "";
    if (m === "surf" && c.state === "roam") {
      const a = level(c.x + c.w / 2 + 10) - level(c.x + c.w / 2 - 10);
      tilt = "rotate(" + clamp(Math.atan2(a, 20), -0.35, 0.35).toFixed(3) + "rad) ";
    }
    setStyle(c, "el", c.el, "translate3d(" + Math.round(c.x) + "px, " + Math.round(c.y) + "px, 0)");
    setStyle(c, "flip", c.flipEl, tilt + "scaleX(" + c.dir + ")");
    setStyle(c, "bob", c.canvas, "translateY(" + Math.round(c.bob) + "px)");
    const tone = toneAt(c.y + c.h / 2);
    if (tone !== c.tone) {
      c.tone = tone;
      c.el.dataset.tone = tone;
    }
  }

  function setStyle(c, key, el, value) {
    if (c.css[key] === value) return;
    c.css[key] = value;
    el.style.transform = value;
  }

  function react(c) {
    const cls = c.spec.react;
    c.body.classList.remove(cls);
    void c.body.offsetWidth;
    c.body.classList.add(cls);
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    switch (c.spec.fx) {
      case "splash":
        splash(cx, 14);
        break;
      case "feather":
        feathers(cx, cy, 6);
        quip(c, "Skree!", 1200);
        break;
      case "bubbles":
        bubbleBurst(cx, c.y, 6);
        ring(cx, cy, c.tone === "dark" ? "111, 245, 223" : "255, 252, 240", 46, 0.8);
        break;
      case "flash": {
        const fx0 = c.x + (c.dir > 0 ? c.w - 3 * c.scale : 3 * c.scale);
        flash(fx0, c.y + c.h * 0.85, 160, "255, 255, 245", 0.45);
        ring(fx0, c.y + c.h * 0.85, "255, 252, 240", 90, 0.6);
        bubbleBurst(c.x + (c.dir > 0 ? c.w * 0.8 : c.w * 0.2), c.y, 5);
        S.visionPulse = Math.max(S.visionPulse, 1.4);
        break;
      }
      case "spout":
        for (let i = 0; i < 16; i++) {
          addFx({ k: "drop", x: c.x + (c.dir > 0 ? c.w * 0.72 : c.w * 0.28) + rand(-6, 6), y: c.y, vx: rand(-50, 50), vy: -rand(140, 260), g: 380, life: 1.2, max: 1.2, col: "200, 236, 240" });
        }
        ring(cx, cy, "111, 245, 223", 150, 1.6);
        setTimeout(function () { ring(c.x + c.w / 2, c.y + c.h / 2, "111, 245, 223", 220, 1.8); }, 260);
        break;
      case "glow":
        sparks(cx, cy, 14, "111, 245, 223");
        flash(cx, cy, 110, "111, 245, 223", 0.7);
        glowAround(cx, cy, 200);
        break;
      case "ink":
        inkCloud(c.x + (c.dir > 0 ? 0 : c.w), cy, 7);
        c.vx = c.dir * 160;
        break;
      case "lure":
        c.flare = 1;
        glowAround(cx, cy, 320);
        break;
      case "sand":
        sandPuff(cx, c.y + c.h, 12);
        c.vx = (Math.random() < 0.5 ? -1 : 1) * 140;
        break;
      case "scan":
        c.scan = 1;
        S.visionPulse = Math.max(S.visionPulse, 3.2);
        ring(c.x + (c.dir > 0 ? c.w : 0), cy, "242, 201, 76", 120, 1.2);
        quip(c, "Scanning…", 1600);
        break;
    }
  }

  function quip(c, text, ms) {
    if (c.quipEl) c.quipEl.remove();
    const q = document.createElement("span");
    q.className = "quip";
    q.textContent = text;
    q.title = "Talk to " + c.spec.name;
    q.addEventListener("click", function (event) {
      event.stopPropagation();
      q.remove();
      if (chat.current !== c) chat.open(c);
    });
    c.el.appendChild(q);
    c.quipEl = q;
    const r = q.getBoundingClientRect();
    if (r.left < 8) q.style.marginLeft = Math.round(8 - r.left) + "px";
    else if (r.right > S.vw - 8) q.style.marginLeft = Math.round(S.vw - 8 - r.right) + "px";
    const id = ++c.quipTimer;
    setTimeout(function () {
      if (c.quipTimer !== id) return;
      q.classList.add("out");
      setTimeout(function () { q.remove(); if (c.quipEl === q) c.quipEl = null; }, 260);
    }, ms || 2400);
  }

  function dropQuip(c) {
    const m = c.spec.motion;
    const mid = c.y + c.h / 2;
    const inAir = c.y + c.h * 0.6 < waterlineFor(c);
    if (m === "fly") {
      if (!inAir) quip(c, "Blub! I'm a bird!");
      return;
    }
    if (m === "surf") {
      if (!inAir) quip(c, "Wipeout!");
      return;
    }
    if (inAir) {
      quip(c, pick(DROP_LINES.sky));
      return;
    }
    if (m === "walk") {
      if (mid < S.floorY - 200) quip(c, "Sinking home…");
      return;
    }
    const here = zoneAt(mid).index;
    const home = S.byId[c.spec.zone].index;
    if (here > home) quip(c, pick(DROP_LINES.deeper));
    else if (here < home) quip(c, pick(DROP_LINES.shallower));
    else if (Math.random() < 0.55) quip(c, pick(DROP_LINES.same), 1500);
  }

  function release(c, dragged) {
    c.el.classList.remove("held");
    document.body.classList.remove("dragging");
    if (!dragged) return;
    const marks = c.marks || [];
    if (marks.length > 1) {
      const a = marks[0];
      const b = marks[marks.length - 1];
      const span = Math.max(16, b.t - a.t) / 1000;
      c.vx = clamp((b.x - a.x) / span, -700, 700);
      c.vy = clamp((b.y - a.y) / span, -700, 700);
    } else {
      c.vx = 0;
      c.vy = 0;
    }
    const m = c.spec.motion;
    const inAir = c.y + c.h * 0.6 < waterlineFor(c);
    if (m === "fly") c.state = inAir ? "free" : "rise";
    else if (m === "surf") c.state = inAir ? "fall" : "rise";
    else if (inAir) c.state = "fall";
    else if (m === "walk") c.state = "sink";
    else c.state = "free";
    c.timer = rand(5, 9);
    if (m === "fly" && inAir) c.timer = 2;
    dropQuip(c);
  }

  function activate(c) {
    react(c);
    if (chat.current === c) chat.close();
    else chat.open(c);
  }

  function bindCritter(c) {
    const btn = c.btn;
    btn.addEventListener("pointerdown", function (event) {
      if (event.button != null && event.button !== 0) return;
      c.press = { id: event.pointerId, sx: event.clientX, sy: event.clientY, dragging: false };
      c.grabX = event.clientX - c.x;
      c.grabY = event.clientY + S.sy - c.y;
      try { btn.setPointerCapture(event.pointerId); } catch (err) { /* pointer already gone */ }
    });
    btn.addEventListener("pointermove", function (event) {
      if (!c.press || event.pointerId !== c.press.id) return;
      if (!c.press.dragging && Math.hypot(event.clientX - c.press.sx, event.clientY - c.press.sy) > 6) {
        c.press.dragging = true;
        if (chat.current === c) chat.close();
        c.state = "drag";
        c.marks = [];
        if (c.inspect) c.el.querySelector(".tag-arrow").click();
        c.el.classList.add("held");
        document.body.classList.add("dragging");
        if (c.quipEl) { c.quipEl.remove(); c.quipEl = null; }
      }
    });
    function end(event, cancelled) {
      if (!c.press || (event && event.pointerId !== c.press.id)) return;
      const dragged = c.press.dragging;
      c.press = null;
      if (dragged) release(c, true);
      else if (!cancelled) activate(c);
    }
    btn.addEventListener("pointerup", function (event) { end(event, false); });
    btn.addEventListener("pointercancel", function (event) { end(event, true); });
    btn.addEventListener("lostpointercapture", function (event) { end(event, true); });
    btn.addEventListener("click", function (event) {
      if (event.detail === 0) activate(c);
    });
    btn.addEventListener("keydown", function (event) {
      const step = event.shiftKey ? 32 : 14;
      let dx = 0;
      let dy = 0;
      if (event.key === "ArrowLeft") dx = -step;
      else if (event.key === "ArrowRight") dx = step;
      else if (event.key === "ArrowUp") dy = -step;
      else if (event.key === "ArrowDown") dy = step;
      else return;
      event.preventDefault();
      c.x = clamp(c.x + dx, 2, S.vw - c.w - 2);
      c.y = clamp(c.y + dy, 0, S.docH - c.h);
      if (dx && c.spec.flips) c.dir = dx > 0 ? 1 : -1;
      c.vx = 0;
      c.vy = 0;
      if (c.state !== "chat") {
        c.state = "free";
        c.timer = 8;
      }
    });
    c.el.addEventListener("pointerenter", function (event) {
      if (event.pointerType === "mouse") c.hover = true;
    });
    c.el.addEventListener("pointerleave", function () { c.hover = false; });
    const arrow = c.el.querySelector(".tag-arrow");
    const taxaList = c.el.querySelector(".taxa");
    arrow.setAttribute("aria-label", "Show the taxonomy of " + c.spec.name);
    arrow.addEventListener("pointerdown", function (event) { event.stopPropagation(); });
    arrow.addEventListener("click", function (event) {
      event.stopPropagation();
      const open = !c.inspect;
      c.inspect = open;
      taxaList.hidden = !open;
      c.el.classList.toggle("taxa-open", open);
      arrow.setAttribute("aria-expanded", open ? "true" : "false");
      arrow.setAttribute("aria-label", (open ? "Hide" : "Show") + " the taxonomy of " + c.spec.name);
      const tag = c.el.querySelector(".tag");
      tag.style.marginLeft = "";
      if (open) {
        const r = tag.getBoundingClientRect();
        const right = S.vw - (S.gauge ? 96 : 8);
        if (r.right > right) tag.style.marginLeft = Math.round(right - r.right) + "px";
        if (r.left + (parseFloat(tag.style.marginLeft) || 0) < 8) tag.style.marginLeft = Math.round(8 - r.left) + "px";
      }
    });
    c.body.addEventListener("animationend", function () {
      c.body.className = "critter-body";
    });
  }

  CAST.forEach(function (spec, i) { critters.push(makeCritter(spec, i)); });

  /* ---------- chat ---------- */

  const ABOUT_CHIP = { en: "Who is Yiwei?", zh: "奕玮是谁？" };
  const visitorZh = String((navigator.languages && navigator.languages[0]) || navigator.language || "en").toLowerCase().indexOf("zh") === 0;

  const chat = (function () {
    const panel = document.createElement("div");
    panel.className = "chat";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.innerHTML =
      '<div class="chat-head">' +
        '<canvas class="chat-avatar" width="40" height="40" aria-hidden="true"></canvas>' +
        '<div class="chat-who"><p class="chat-name"></p><p class="chat-meta px"></p></div>' +
        '<button class="chat-close" type="button" aria-label="Close">✕</button>' +
      "</div>" +
      '<ol class="chat-log" aria-live="polite"></ol>' +
      '<div class="chat-chips"></div>' +
      '<form class="chat-say">' +
        '<label class="sr" for="chat-input">Say something</label>' +
        '<input id="chat-input" type="text" maxlength="240" autocomplete="off" enterkeyhint="send">' +
        '<button type="submit">Send</button>' +
      "</form>" +
      '<p class="chat-via px">Replies via a free model · LLM7</p>';
    reef.appendChild(panel);
    const avatar = panel.querySelector(".chat-avatar");
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
    const api = { current: null };

    function fillChips(c) {
      chips.textContent = "";
      const lang = visitorZh ? "zh" : "en";
      const asked = histories.get(c.spec.id) || [];
      const list = c.spec.chips[lang].concat(ABOUT_CHIP[lang]).filter(function (text) {
        return !asked.some(function (m) { return m.role === "user" && m.content === text; });
      });
      list.forEach(function (text) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = text;
        b.addEventListener("click", function () { send(text); });
        chips.appendChild(b);
      });
      chips.hidden = !list.length;
    }

    function drawAvatar(c) {
      const ax = avatar.getContext("2d");
      ax.clearRect(0, 0, 40, 40);
      ax.imageSmoothingEnabled = false;
      const src = sheet(c.frames[0]);
      const s = Math.max(1, Math.floor(36 / Math.max(src.width, src.height)));
      const w = src.width * s;
      const h = src.height * s;
      ax.drawImage(src, Math.round((40 - w) / 2), Math.round((40 - h) / 2), w, h);
    }

    function history(c) {
      let h = histories.get(c.spec.id);
      if (!h) {
        h = [{ role: "assistant", content: c.spec.greeting }];
        histories.set(c.spec.id, h);
      }
      return h;
    }

    function render() {
      const c = api.current;
      if (!c) return;
      log.textContent = "";
      history(c).forEach(function (msg) {
        const li = document.createElement("li");
        li.className = msg.role === "user" ? "me" : "them";
        li.textContent = msg.content;
        log.appendChild(li);
      });
      if (busy.get(c.spec.id)) {
        const li = document.createElement("li");
        li.className = "them typing";
        li.setAttribute("aria-label", c.spec.name + " is typing");
        li.innerHTML = "<span></span><span></span><span></span>";
        log.appendChild(li);
      }
      fillChips(c);
      if (busy.get(c.spec.id)) chips.hidden = true;
      log.scrollTop = log.scrollHeight;
    }

    api.place = function () {
      const c = api.current;
      if (!c || panel.hidden) return;
      const sheetMode = S.narrow;
      panel.classList.toggle("sheet", sheetMode);
      if (sheetMode) {
        panel.style.left = "";
        panel.style.top = "";
        return;
      }
      const pw = panel.offsetWidth;
      const ph = panel.offsetHeight;
      const right = S.vw - (S.gauge ? 96 : 0);
      const cx = c.x + c.w / 2;
      const left = clamp(cx - pw / 2, 12, Math.max(12, right - pw - 12));
      let top = c.y - ph - 18;
      let above = true;
      if (top < S.sy + S.headerH + 10) {
        top = c.y + c.h + 18;
        above = false;
      }
      top = Math.min(top, S.docH - ph - 8);
      panel.style.left = Math.round(left) + "px";
      panel.style.top = Math.round(top) + "px";
      panel.style.setProperty("--tail", Math.round(clamp(cx - left, 18, pw - 18)) + "px");
      panel.classList.toggle("above", above);
      panel.classList.toggle("below", !above);
    };

    api.open = function (c) {
      if (api.current && api.current !== c) api.close(true);
      api.current = c;
      S.met.add(c.spec.id);
      if (["roam", "free", "home", "meet", "play", "hunt", "exit"].indexOf(c.state) >= 0) c.state = "chat";
      c.el.classList.add("talking");
      c.btn.setAttribute("aria-expanded", "true");
      nameEl.textContent = c.spec.name;
      const zone = S.byId[c.spec.zone];
      metaEl.textContent = c.spec.common + " · " + zone.name + (zone.index ? " · " + Math.round(depthAt(c.y + c.h / 2)) + " m" : "");
      panel.setAttribute("aria-label", "Chat with " + c.spec.name);
      label.textContent = "Say something to " + c.spec.name;
      input.placeholder = visitorZh ? "和 " + c.spec.name + " 说点什么" : "Say something to " + c.spec.name;
      panel.classList.toggle("dark", (c.tone || S.byId[c.spec.zone].tone) === "dark");
      drawAvatar(c);
      via.textContent = "Replies via a free model · LLM7";
      panel.hidden = false;
      render();
      api.place();
      if (!COARSE) input.focus({ preventScroll: true });
    };

    api.close = function (switching) {
      const c = api.current;
      if (!c) return;
      panel.hidden = true;
      c.el.classList.remove("talking");
      c.btn.setAttribute("aria-expanded", "false");
      if (c.state === "chat") {
        c.state = "roam";
        c.wait = 1.2;
      }
      api.current = null;
      if (!switching && document.activeElement === input) c.btn.focus({ preventScroll: true });
    };

    async function send(text) {
      const c = api.current;
      if (!c || !text || busy.get(c.spec.id)) return;
      const spec = c.spec;
      const h = history(c);
      h.push({ role: "user", content: text.slice(0, 240) });
      if (h.length > 10) h.splice(0, h.length - 10);
      const token = (tokens.get(spec.id) || 0) + 1;
      tokens.set(spec.id, token);
      busy.set(spec.id, true);
      render();
      const messages = [{ role: "system", content: systemFor(c, text) }].concat(h);
      let answer = "";
      let source = "";
      try {
        const got = await askModel(messages);
        answer = cleanReply(got.text, spec.name);
        source = got.via;
        if (!answer) throw new Error("empty");
      } catch (err) {
        answer = fallback(spec, text);
        source = "";
      }
      if (tokens.get(spec.id) !== token) return;
      busy.set(spec.id, false);
      h.push({ role: "assistant", content: answer });
      if (api.current === c) {
        via.textContent = source ? "Replied via " + source : "Offline reply · the models are resting";
        render();
        api.place();
      }
      if (api.current !== c) quip(c, answer.length > 34 ? answer.slice(0, 32) + "…" : answer, 3200);
      c.body.classList.remove(spec.react);
      void c.body.offsetWidth;
      c.body.classList.add(spec.react);
    }

    panel.querySelector(".chat-close").addEventListener("click", function () { api.close(); });
    panel.querySelector("form").addEventListener("submit", function (event) {
      event.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      send(text);
    });
    document.addEventListener("pointerdown", function (event) {
      if (!api.current) return;
      if (event.target.closest && event.target.closest(".chat, .critter")) return;
      api.close(true);
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && api.current) api.close();
    });
    return api;
  })();

  function systemFor(c, text) {
    const spec = c.spec;
    const zone = S.byId[spec.zone];
    const chinese = /[一-鿿]/.test(text);
    return [
      "You are " + spec.name + ", a pixel-art " + spec.common.toLowerCase() + " (" + spec.latin + ") living in the " + zone.name.toLowerCase() + " of Yiwei Chen's personal homepage.",
      "The page is drawn as a dive from the sea surface down to the seafloor, and visitors can drag you around and chat with you.",
      "Your personality: " + spec.persona + ".",
      "You are not Yiwei. Stay in character and speak as yourself: warm, playful and curious, never mean or sarcastic. No emoji, no markdown.",
      "Reply in one to three short sentences.",
      S.weather.live && S.weather.text ? "Right now in Hong Kong it is " + S.weather.text + (S.weather.temp != null ? ", " + Math.round(S.weather.temp) + " degrees C" : "") + "; mention it only if it fits naturally." : "",
      chinese ? "The visitor wrote in Chinese. Reply in Chinese only." : "The visitor wrote in English. Reply in English only.",
      "If asked about Yiwei, use only these facts. If you do not know, say so. Do not invent papers, emails, dates, or affiliations.",
      FACTS
    ].join(" ");
  }

  function cleanReply(text, name) {
    let out = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    out = out.replace(/^["“]|["”]$/g, "").trim();
    out = out.replace(new RegExp("^" + name + "\\s*[:：\\-]\\s*", "i"), "");
    out = out.replace(/\*\*?/g, "");
    if (out.length > 420) out = out.slice(0, 417).replace(/\s+\S*$/, "") + "…";
    return out.trim();
  }

  /* ---------- offline brain: answers when the free model is busy ---------- */

  // One answer per chip question, in the same order as spec.chips.
  const LOCAL = {
    det: {
      en: ["Watch for lines of swell stacking up on the horizon, then pick the wave that peels steadily instead of closing out all at once.",
        "Wind blowing over the sea pushes energy into the water. That energy travels thousands of kilometres as swell, then rises and breaks in shallow water.",
        "A narrow channel of water rushing back out to sea. If one grabs you, don't fight it: swim parallel to the beach until you're free."],
      zh: ["看远处一排排涌浪，挑那道能稳定地从一侧破开、而不是一下全部拍下的浪。",
        "风吹过海面把能量传给海水，能量以涌浪的形式传播上千公里，到浅水区抬高并破碎。",
        "离岸流是一股流回大海的窄急水流。被卷住别硬拼，平行于海岸游出去。"]
    },
    dropout: {
      en: ["Shells are too tough to bite, so we fly up and drop them on rocks to crack them open. Some of us even pick the hardest rocks.",
        "Yes! Glands above my eyes filter out the salt, and it drips out through my beak. Skree!",
        "Dropout is a neural network trick: randomly ignore some neurons while training so the model doesn't overfit. I randomly ignore some of you. Same idea."],
      zh: ["贝壳太硬咬不开，我们就飞高把它扔到石头上摔开，有的海鸥还专挑硬石头。",
        "可以！我眼睛上方有盐腺，能把盐分滤出来，再从嘴边滴出去。嘎！",
        "Dropout 是神经网络的训练技巧：随机丢掉一部分神经元，防止过拟合。我随机不听你说话，同理。"]
    },
    git: {
      en: ["In a school, a predator can't lock onto any one of us, and we save energy swimming in each other's wake.",
        "Between the branches of coral. When danger comes, the whole school dives in at once.",
        "Corals give us shelter, and we give them nutrients from our waste and help keep algae from taking over."],
      zh: ["成群游的时候，捕食者很难锁定其中一条，我们还能借彼此的尾流省力。",
        "躲进枝状珊瑚的缝隙里，危险一来整群一起钻进去。",
        "珊瑚给我们庇护，我们的排泄物给珊瑚养分，还帮着控制藻类。"]
    },
    python: {
      en: ["Green turtles take 20 to 40 years to grow up, and many live well past 70.",
        "I read Earth's magnetic field like a map. Many of us return to the very beach where we hatched.",
        "Adult green turtles are mostly vegetarian. Grazing keeps seagrass meadows short and healthy, like mowing a lawn."],
      zh: ["绿海龟要20到40年才成年，很多能活过70岁。",
        "我像读地图一样感知地磁场，很多海龟会回到自己出生的那片沙滩。",
        "成年绿海龟基本吃素。我们啃食海草，就像修剪草坪，让海草床保持健康。"]
    },
    pip: {
      en: ["Yes! Mum puts the eggs in Dad's pouch, and he carries them until hundreds of tiny seahorses pop out.",
        "My tail grips like a hand. I hold on to seagrass so the current doesn't carry me away.",
        "A little fin on my back flutters up to 50 times a second, and the fins by my head steer. I'm a slow swimmer, honestly."],
      zh: ["是的！妈妈把卵产进爸爸的育儿袋，爸爸一直带着，直到生出几百只小海马。",
        "我的尾巴能像手一样抓东西，抓住海草就不会被水流冲走。",
        "背上的小鳍每秒能扇动约50次，头边的鳍负责转向。老实说，我游得很慢。"]
    },
    seg: {
      en: ["It means labelling every pixel in an image: this pixel is coral, that one is fish, that one is water. It tells a model exactly where each thing is.",
        "Water absorbs red light first, scatters light into haze, and the light keeps flickering. So colours shift and edges blur.",
        "I outline each coral and fish by hand, pixel by pixel. Models like Yiwei's MaskGuide then learn to do it fast enough for small robots."],
      zh: ["图像分割就是给每个像素贴标签：这是珊瑚，那是鱼，那是水，让模型知道每样东西的确切位置。",
        "水会先吸收红光，又把光散射成雾，光线还一直晃动，所以颜色会偏，边缘会糊。",
        "我一点点手工描出每块珊瑚和每条鱼的轮廓。像奕玮的 MaskGuide 这样的模型就能学会，而且快到能在小机器人上运行。"]
    },
    gan: {
      en: ["Very rarely. People kill tens of millions of sharks a year; sharks bite only a handful of people. You're far more dangerous than me.",
        "We keep fish populations healthy by catching the weak and sick. Reefs with sharks have more fish and healthier corals.",
        "In a GAN, two networks compete: one makes fakes, one catches them, and both get better. I'm the adversary that keeps every fish sharp."],
      zh: ["非常少。人类每年捕杀数千万条鲨鱼，鲨鱼咬人的事件却寥寥无几。你们比我危险多了。",
        "我们捕食老弱病残，让鱼群保持健康。有鲨鱼的珊瑚礁，鱼更多，珊瑚也更健康。",
        "GAN 里两个网络对抗：一个造假，一个抓假，双方越来越强。我就是让每条鱼保持警觉的那个对手。"]
    },
    docker: {
      en: ["Mmm. Past 1,000 metres, sometimes near 2,000, and I can stay down for over an hour hunting squid.",
        "I send out loud clicks and listen for the echoes. Their timing tells me where the squid are, even in total darkness.",
        "Mmm. Everything I need, packed so it runs the same in every ocean. That's what containers are for."],
      zh: ["嗯。我能潜到一千多米，有时接近两千米，一口气能在下面待一个多小时捕乌贼。",
        "我发出响亮的咔嗒声，再听回声。回声的时间告诉我乌贼在哪，哪怕一片漆黑。",
        "嗯。我需要的一切都打包好了，在哪片海都能一样运行。容器就是干这个的。"]
    },
    conda: {
      en: ["No brain at all. Just a net of nerves around my bell, and it works surprisingly well.",
        "I squeeze my bell to push water out, then relax and drift. Pulse, drift, pulse.",
        "Warmer water, fewer predators because of overfishing, and extra nutrients from the land all help jellyfish multiply fast."],
      zh: ["完全没有大脑，只有伞盖周围的一张神经网，效果还挺好。",
        "收缩伞盖把水挤出去，然后放松漂一会儿。收缩，漂，收缩。",
        "海水变暖、过度捕捞让天敌变少、陆地带来更多营养，都会让水母快速繁殖。"]
    },
    neuron: {
      en: ["A nerve fibre up to a millimetre thick, about a hundred times wider than yours. It lets us fire off jet escapes in a flash.",
        "In the 1950s Hodgkin and Huxley put tiny wires into squid giant axons and worked out how nerve signals fire. They won a Nobel Prize, and their model inspired artificial neurons.",
        "My skin is full of tiny colour sacs called chromatophores. Muscles stretch or squeeze them in milliseconds."],
      zh: ["一种粗达一毫米的神经纤维，比你们的粗约一百倍，让我们能瞬间喷射逃跑。",
        "1950年代，霍奇金和赫胥黎把细电极插进乌贼巨型轴突，弄清了神经信号如何产生，因此获得诺贝尔奖，他们的模型也启发了人工神经元。",
        "我的皮肤里有许多叫色素细胞的小色囊，肌肉能在几毫秒内拉开或收紧它们。"]
    },
    torch: {
      en: ["It's packed with glowing bacteria. I give them a home, they give me light.",
        "Light made by living things through a chemical reaction. In the deep sea, most animals can make some light of their own.",
        "I wiggle my lure, curious fish swim up to the light, and gulp. My big mouth does the rest."],
      zh: ["我的灯里住满了会发光的细菌。我给它们安家，它们给我光。",
        "生物通过化学反应自己发出的光。在深海，大多数动物都能发一点光。",
        "我晃动诱饵，好奇的鱼游向灯光，然后一口吞下。剩下的交给我的大嘴。"]
    },
    softmax: {
      en: ["Food is rare down here, so my hinged jaw opens wide enough to swallow prey bigger than me. Never waste a meal.",
        "The tip of my tail has a little light. Scientists think it lures prey toward my mouth.",
        "Softmax takes any list of numbers and squashes it into probabilities that add up to one. I swallow anything and make it tidy too."],
      zh: ["这里食物稀少，我的大嘴能张开吞下比我还大的猎物，一顿都不能浪费。",
        "我尾巴尖有个小光点，科学家认为它能把猎物引到我嘴边。",
        "Softmax 能把任意一串数字压成加起来等于一的概率。我也是什么都吞，再整理得整整齐齐。"]
    },
    head: {
      en: ["Kind of! Most of an octopus's neurons live in its arms, so each arm can make some decisions on its own.",
        "They're fins, not ears. I flap them to swim, gently, like a little Dumbo.",
        "In a neural network, the head is the small part on top of a backbone that makes the final prediction. Put me on Backbone and we're a detector!"],
      zh: ["算是吧！章鱼大部分神经元都在腕足里，每条腕足能自己做一些决定。",
        "那是鳍，不是耳朵。我扇动它们来游泳，慢悠悠的，像小飞象。",
        "神经网络里，head 是接在 backbone 上、负责最终预测的那一小部分。把我放到 Backbone 上，我们就是一个检测器！"]
    },
    backbone: {
      en: ["Not one bone! My skeleton is on the outside, a hard shell called an exoskeleton. Yes, my name is a joke.",
        "To grow, I crawl out of my old shell. The new one stays soft for a few days, so I hide until it hardens.",
        "My body is mostly water, which barely compresses, so the pressure squeezes me evenly. No air pockets, no problem."],
      zh: ["一根骨头都没有！我的骨骼长在外面，是一层硬壳，叫外骨骼。没错，我的名字是个玩笑。",
        "为了长大，我要从旧壳里爬出来。新壳会软几天，我就躲起来等它变硬。",
        "我身体大部分是水，水几乎压不缩，压力就均匀地分布。体内没有气腔，就没问题。"]
    },
    jetson: {
      en: ["My lamps light the scene and my camera records it. Then my vision models find and label everything, confidence included.",
        "The tether is slow and the ocean is big. Running models on my Jetson lets me react in real time, without waiting for the ship.",
        "A pilot on the ship, through my tether. My models help by spotting creatures before the pilot does."],
      zh: ["灯照亮四周，摄像头记录画面，再由视觉模型找出并标注所有东西，附带置信度。",
        "缆线带宽有限，海洋又太大。在 Jetson 上本地运行模型，我就能实时反应，不用等船上回复。",
        "船上的驾驶员通过缆线操控我。我的模型帮忙，常常比驾驶员先发现生物。"]
    }
  };

  // Questions about the page owner, answered from the page's own facts.
  const ABOUT_YIWEI = [
    { re: /paper|publication|publish|maskguide|orca|marineinst|eccv|wacv|论文|发表/i,
      en: "His papers include MaskGuide (RA-L 2026), ORCA (WACV 2026, oral) and MarineInst (ECCV 2024, oral, with an Oral Presentation Award).",
      zh: "他的论文包括 MaskGuide（RA-L 2026）、ORCA（WACV 2026，口头报告）和 MarineInst（ECCV 2024，口头报告，并获口头报告奖）。" },
    { re: /supervis|advisor|adviser|professor|prof\b|yeung|zheng|导师|教授/i,
      en: "He is supervised by Prof. Sai-Kit Yeung at HKUST and works closely with Prof. Ziqiang Zheng of UESTC.",
      zh: "他的导师是港科大的 Sai-Kit Yeung 教授，并与电子科技大学的 Ziqiang Zheng 教授密切合作。" },
    { re: /email|e-mail|contact|reach|collaborat|邮箱|联系|合作/i,
      en: "You can write to him at jackson.chen.yiwei@gmail.com or ychenmb@connect.ust.hk.",
      zh: "可以写信给他：jackson.chen.yiwei@gmail.com 或 ychenmb@connect.ust.hk。" },
    { re: /teach|\bta\b|comp ?2211|msbd|助教|教学/i,
      en: "He TAs COMP 2211 Exploring AI and MSBD 6000Q Vision Language Models at HKUST, and received an Outstanding PG TA Honorable Mention for 2025–26.",
      zh: "他在港科大担任 COMP 2211 和 MSBD 6000Q 的助教，获得 2025–26 优秀研究生助教提名奖。" },
    { re: /educat|degree|undergrad|bachelor|master|msc|beng|hust|university|学历|本科|硕士|大学/i,
      en: "PhD in CSE at HKUST since 2024, an MSc in IT at HKUST before that, and a BEng in Telecommunications from HUST.",
      zh: "2024 年起在港科大读计算机博士，之前在港科大读信息技术硕士，本科是华中科技大学通信工程。" },
    { re: /research|work on|studies|研究|方向/i,
      en: "He builds computer vision for marine and biology studies: recognising sea life, and the problems that sit between 2D and 3D vision.",
      zh: "他研究海洋与生物方向的计算机视觉：识别海洋生物，以及介于二维和三维视觉之间的问题。" },
    { re: /yiwei|jackson|page owner|this (page|site|website)|who (is|made|built|owns) (this|he|him)|陈奕玮|奕玮|网站|主页|他是谁/i,
      en: "This is Yiwei Chen's page. He's a third-year PhD student in Computer Science and Engineering at HKUST, working on marine vision intelligence.",
      zh: "这是陈奕玮的主页。他是香港科技大学计算机科学与工程系的三年级博士生，研究海洋视觉智能。" }
  ];

  const STOP = /^(you|your|yours|the|and|how|what|why|who|are|does|did|can|could|would|tell|about|with|this|that|there|here|have|has|for|from|into|its|it's|whats|what's)$/;

  function words(text) {
    return (String(text).toLowerCase().match(/[a-z]+/g) || []).filter(function (w) {
      return w.length > 2 && !STOP.test(w);
    }).map(function (w) { return w.replace(/(ing|es|s)$/, ""); });
  }

  function localAnswer(spec, text) {
    const zh = /[一-鿿]/.test(text);
    const lang = zh ? "zh" : "en";
    const book = LOCAL[spec.id];
    if (/who are you|your name|introduce yourself|你是谁|你叫什么/i.test(text)) return spec.greeting;
    if (book) {
      const exact = spec.chips[lang].indexOf(text.trim());
      if (exact >= 0) return book[lang][exact];
    }
    for (let i = 0; i < ABOUT_YIWEI.length; i++) {
      if (ABOUT_YIWEI[i].re.test(text)) return ABOUT_YIWEI[i][lang];
    }
    if (!book) return null;
    if (zh) {
      let best = -1;
      let score = 0;
      spec.chips.zh.forEach(function (q, i) {
        let s = 0;
        for (let k = 0; k < q.length - 1; k++) if (text.indexOf(q.slice(k, k + 2)) >= 0) s += 1;
        if (s > score) { score = s; best = i; }
      });
      return score >= 2 ? book.zh[best] : null;
    }
    const mine = words(text);
    let best = -1;
    let score = 0;
    spec.chips.en.forEach(function (q, i) {
      const theirs = words(q);
      const s = mine.filter(function (w) { return theirs.indexOf(w) >= 0; }).length;
      if (s > score) { score = s; best = i; }
    });
    return score >= 1 ? book.en[best] : null;
  }

  function offlineNudge(spec, text) {
    const zh = /[一-鿿]/.test(text);
    const q = pick(spec.chips[zh ? "zh" : "en"]);
    return zh
      ? (spec.localZh + " 或者问我：“" + q + "”")
      : (spec.localEn + " Or ask me: “" + q + "”");
  }

  function fallback(spec, text) {
    return localAnswer(spec, text) || offlineNudge(spec, text);
  }

  // The chat proxy (deepseek-proxy/ in the site folder): Pollinations, then DeepSeek.
  // Paste its Cloudflare Worker URL here once deployed. Empty = skip it.
  const CHAT_PROXY = "https://yiwei-deepseek-proxy.yiweiweb.workers.dev";

  const PROVIDERS = [
    {
      name: "LLM7", url: "https://api.llm7.io/v1/chat/completions", key: "unused",
      models: ["mistral-Nemo-Instruct-2407", "default"], maxTokens: 140, timeout: 14000, downUntil: 0
    },
    {
      name: "Backup", url: CHAT_PROXY,
      models: ["auto"], maxTokens: 220, timeout: 40000, downUntil: 0
    }
  ];

  async function askModel(messages) {
    let lastError = null;
    for (let p = 0; p < PROVIDERS.length; p++) {
      const provider = PROVIDERS[p];
      if (!provider.url || Date.now() < provider.downUntil) continue;
      for (let i = 0; i < provider.models.length; i++) {
        try {
          const got = await callModel(provider, provider.models[i], messages);
          if (got.text && got.text.trim()) return { text: got.text, via: got.via || provider.name };
          throw new Error("empty");
        } catch (err) {
          lastError = err;
          if (err && err.rate) {
            // Out of quota: skip this provider for a while instead of hitting it again.
            provider.downUntil = Date.now() + Math.min(10 * 60 * 1000, Math.max(30000, (err.retry || 60) * 1000));
            break;
          }
        }
      }
    }
    throw lastError || new Error("no model");
  }

  async function callModel(provider, model, messages) {
    const ctrl = new AbortController();
    const timer = window.setTimeout(function () { ctrl.abort(); }, provider.timeout);
    try {
      const headers = { "Content-Type": "application/json" };
      if (provider.key) headers.Authorization = "Bearer " + provider.key;
      const res = await fetch(provider.url, {
        method: "POST",
        headers: headers,
        body: JSON.stringify({ model: model, temperature: 0.7, max_tokens: provider.maxTokens, messages: messages }),
        signal: ctrl.signal
      });
      if (res.status === 429 || res.status === 402) {
        const error = new Error("rate");
        error.rate = true;
        try {
          const body = await res.json();
          error.retry = body && body.error && body.error.retry_after;
        } catch (e) { /* no body */ }
        throw error;
      }
      if (!res.ok) throw new Error("status " + res.status);
      const data = await res.json();
      const content = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content
        : "";
      let text = "";
      if (typeof content === "string") text = content;
      else if (Array.isArray(content)) {
        text = content.map(function (part) { return part.text || part.content || ""; }).join("");
      }
      return { text: text, via: data && data.via };
    } finally {
      window.clearTimeout(timer);
    }
  }

  /* ---------- ambient life: chatter, jokes, banter, tag, and a hungry shark ---------- */

  const LINES = {
    det: ["Watch the swell!", "Click me, I'll teach you to read waves."],
    dropout: ["Got any chips?", "Gulls drop shells to crack them. Science!"],
    git: ["Psst, click me to chat.", "Schools confuse predators. Strength in numbers!"],
    python: ["Green turtles can live past 70.", "Seagrass for lunch again."],
    pip: ["Seahorse dads carry the babies!", "Hold on to something!"],
    seg: ["Smile! You're in my dataset.", "Water eats red light first."],
    docker: ["Mmm… containers secure.", "I can hold my breath for 90 minutes."],
    conda: ["No brain, no problem.", "Pulse… drift… pulse…"],
    neuron: ["My axon is about 1 mm wide!", "I change colour in milliseconds."],
    torch: ["My lamp is full of glowing bacteria.", "Only female anglerfish carry a lure."],
    softmax: ["My mouth is bigger than my body.", "Sssum to one, always."],
    head: ["Flap flap flap!", "No octopus lives deeper than us dumbos."],
    backbone: ["Clack clack!", "Molting season is so awkward."],
    jetson: ["Inference running at the edge.", "Tether nominal. Lamps nominal."]
  };

  const JOKES = {
    det: ["Why don't I use non-max suppression?", "Every wave is a keeper."],
    dropout: ["Why do I ignore half of what you say?", "Regularization. Works every time."],
    git: ["Why did the school refuse to merge?", "Too many conflicts on the reef."],
    python: ["Why are turtles great at code review?", "We never rush anything to production."],
    pip: ["My favourite command?", "pip install --upgrade tail"],
    seg: ["Best diver pickup line?", "Can I segment you from the background?"],
    docker: ["Why do whales love containers?", "It works on every sea."],
    conda: ["How do I deal with stress?", "conda deactivate."],
    neuron: ["Why did the neuron go to the party?", "To get activated."],
    torch: ["How do anglerfish debug?", "Shine a light on the bug. Then eat it."],
    softmax: ["Why am I so good at decisions?", "Everything adds up to one in the end."],
    head: ["What do you call an octopus on a crab?", "A detector! Head plus Backbone."],
    backbone: ["Spineless? Me?", "I prefer 'exoskeletal by design'."],
    jetson: ["Why did I quit cloud computing?", "Too much water in the cloud."],
    gan: ["Why don't sharks overfit?", "We keep every fish guessing."]
  };

  const GENERIC_JOKES = [
    ["There are 10 kinds of fish…", "those who read binary, and those who don't."],
    ["I tried gradient descent once.", "Ended up on the seafloor."],
    ["Down here, every model is a deep model."],
    ["Why is the ocean great at machine learning?", "It's full of deep layers."],
    ["I'd tell you a UDP joke…", "but the current might drop it."],
    ["My loss is low.", "My tide is high."],
    ["Why can't fish hide from ROVs?", "Vision models always find them."]
  ];

  const DIALOGS = [
    { a: "git", b: "seg", lines: [["b", "Hold still, Git. Segmenting you."], ["a", "Get my fins right this time!"], ["b", "Pixel-perfect. Mask saved."]] },
    { a: "python", b: "pip", lines: [["b", "Python, how old are you?"], ["a", "Older than this reef, little one."], ["b", "Do you remember the first coral?"], ["a", "I remember it was slow. Like me."]] },
    { a: "git", b: "python", lines: [["a", "Race you to the kelp!"], ["b", "Go ahead. I'll be there by Tuesday."]] },
    { a: "python", b: "seg", lines: [["b", "Mind if I photograph your shell?"], ["a", "Only my good side."], ["b", "Got it. Dataset plus one."]] },
    { a: "pip", b: "seg", lines: [["b", "Pip, could you uncurl your tail for the mask?"], ["a", "Absolutely not. It's my whole personality."]] },
    { a: "det", b: "dropout", lines: [["b", "Skree! Spotted anything, Det?"], ["a", "A set of three waves, incoming."], ["b", "Noted. And… dropped."]] },
    { a: "docker", b: "neuron", lines: [["b", "Please don't eat me. I'm basically neuroscience."], ["a", "Mmm. Sperm whales do eat squid…"], ["a", "…but you're too interesting. Swim along."]] },
    { a: "docker", b: "conda", lines: [["a", "Need a container, Conda?"], ["b", "No thanks. I'm my own environment."], ["a", "Mmm. Fair."]] },
    { a: "conda", b: "neuron", lines: [["b", "Conda, where's your brain?"], ["a", "Don't have one. Just a nerve net."], ["b", "Respect. Fully distributed."]] },
    { a: "torch", b: "softmax", lines: [["a", "Want some light, Softmax?"], ["b", "No thanksss. Everything I eat sums to one."], ["a", "That is not how dinner works."]] },
    { a: "head", b: "backbone", lines: [["a", "Backbone! Let's team up."], ["b", "Head plus Backbone… we're a detector!"], ["a", "Quick, detect something!"], ["b", "…Sand. Confidence 0.99."]] },
    { a: "head", b: "jetson", lines: [["b", "Scanning… dumbo octopus, 0.90."], ["a", "Only 0.90? Look at these ears!"], ["b", "Updating weights… 0.97."]] },
    { a: "backbone", b: "jetson", lines: [["a", "Careful with that thruster, robot!"], ["b", "Apologies. Collision avoidance enabled."]] }
  ];

  const GENERIC_DIALOGS = [
    [["a", "Hey {B}! Did you see the visitor?"], ["b", "Yes! They keep scrolling past us."]],
    [["a", "{B}, is the current strong today?"], ["b", "No. You're just slow."]],
    [["a", "Psst, {B}. They can drag us around."], ["b", "Shh. Act natural."]],
    [["a", "{B}, what's your confidence score?"], ["b", "Higher than yours!"]]
  ];

  const FLEE = {
    python: "I'm too old for this!",
    pip: "Hold on to something!",
    seg: "Stay calm, no splashing!",
    git: "Into the coral!",
    conda: "Drifting away… quickly!",
    neuron: "Inking out!",
    torch: "Lights off, lights off!",
    softmax: "Odds of escape: 0.99!"
  };

  const chompSheet = sheet(PX.SHARK_CHOMP);
  const life = { next: 8, ev: null };

  function cid(id) {
    for (let i = 0; i < critters.length; i++) if (critters[i].spec.id === id) return critters[i];
    return null;
  }

  function onScreen(c) {
    return c.y + c.h > S.sy + S.headerH + 10 && c.y < S.sy + S.vh - 30 && c.x > -10 && c.x + c.w < S.vw + 10;
  }

  function idle(c) {
    return c.state === "roam" && !c.hover && !c.inspect && chat.current !== c && c.spec.motion !== "hunt" && onScreen(c);
  }

  function bounce(c) {
    c.body.classList.remove("r-hop");
    void c.body.offsetWidth;
    c.body.classList.add("r-hop");
  }

  function tell(c, joke) {
    quip(c, joke[0], joke[1] ? 2600 : 3200);
    c.wait = Math.max(c.wait, joke[1] ? 5.5 : 3);
    if (!joke[1]) return;
    setTimeout(function () {
      if (c.state === "drag" || chat.current === c) return;
      quip(c, joke[1], 3200);
      bounce(c);
    }, 2750);
  }

  function chatter(c) {
    const id = c.spec.id;
    if (Math.random() < 0.5) {
      tell(c, JOKES[id] && Math.random() < 0.65 ? JOKES[id] : pick(GENERIC_JOKES));
    } else {
      quip(c, pick(LINES[id] || ["Hello up there!"]), 3200);
      c.wait = Math.max(c.wait, 3);
    }
  }

  function meetSpot(a, b) {
    let side = b.x + b.w / 2 < a.x + a.w / 2 ? -1 : 1;
    let x = side < 0 ? a.x - b.w - 26 : a.x + a.w + 26;
    if (x < 6 || x + b.w > S.vw - 6) {
      side = -side;
      x = side < 0 ? a.x - b.w - 26 : a.x + a.w + 26;
    }
    let y;
    if (b.spec.motion === "walk") y = b.rect.y0;
    else if (a.spec.motion === "walk" || a.spec.motion === "surf") y = a.y - b.h - 18;
    else y = a.y + a.h / 2 - b.h / 2;
    return { x: clamp(x, 4, S.vw - b.w - 4), y: y, side: side };
  }

  function near(a, b, limit) {
    return Math.hypot(a.x - b.x, a.y - b.y) < limit;
  }

  function findDialog(pool) {
    const ok = DIALOGS.filter(function (d) {
      const a = cid(d.a);
      const b = cid(d.b);
      return a && b && pool.indexOf(a) >= 0 && pool.indexOf(b) >= 0 && near(a, b, 650);
    });
    if (ok.length) {
      const d = pick(ok);
      return { a: cid(d.a), b: cid(d.b), lines: d.lines };
    }
    for (let i = 0; i < 6; i++) {
      const a = pick(pool);
      const mates = pool.filter(function (o) { return o !== a && o.spec.zone === a.spec.zone && near(a, o, 550); });
      if (mates.length) {
        const b = pick(mates);
        return { a: a, b: b, lines: pick(GENERIC_DIALOGS) };
      }
    }
    return null;
  }

  function startDialog(d) {
    const spot = meetSpot(d.a, d.b);
    d.a.state = "meet";
    d.a.meet = { x: d.a.x, y: d.a.y, face: spot.side };
    d.b.state = "meet";
    d.b.meet = { x: spot.x, y: spot.y, face: -spot.side };
    life.ev = { type: "dialog", a: d.a, b: d.b, lines: d.lines, i: -1, t: 0 };
  }

  function startPlay(pool) {
    const mild = pool.filter(function (c) { return ["swim", "glide", "hover", "walk"].indexOf(c.spec.motion) >= 0; });
    for (let i = 0; i < 6 && mild.length > 1; i++) {
      const a = pick(mild);
      const mates = mild.filter(function (o) { return o !== a && o.spec.zone === a.spec.zone && near(a, o, 500); });
      if (!mates.length) continue;
      const b = pick(mates);
      a.state = "play";
      b.state = "play";
      a.playSpeed = Math.max(95, a.spec.speed * 3.2);
      b.playSpeed = Math.max(85, b.spec.speed * 2.8);
      b.playT = { x: rand(b.rect.x0, b.rect.x1), y: rand(b.rect.y0, b.rect.y1) };
      a.playT = { x: b.x, y: b.y };
      quip(b, "Catch me, " + a.spec.name + "!", 1800);
      life.ev = { type: "play", a: a, b: b, t: 0 };
      return true;
    }
    return false;
  }

  function endEvent() {
    const ev = life.ev;
    if (!ev) return;
    [ev.a, ev.b].forEach(function (c) {
      if (c.state === "meet" || c.state === "play") {
        c.state = "roam";
        c.wait = 1.2;
        pickTarget(c);
      }
    });
    life.ev = null;
  }

  function runEvent(dt) {
    const ev = life.ev;
    const want = ev.type === "dialog" ? "meet" : "play";
    if (ev.a.state !== want || ev.b.state !== want) {
      endEvent();
      return;
    }
    ev.t += dt;
    if (ev.type === "play") {
      ev.a.playT = { x: ev.b.x, y: ev.b.y };
      if (Math.hypot(ev.b.x - ev.b.playT.x, ev.b.y - ev.b.playT.y) < 16) {
        ev.b.playT = { x: rand(ev.b.rect.x0, ev.b.rect.x1), y: rand(ev.b.rect.y0, ev.b.rect.y1) };
      }
      const caught = Math.hypot(ev.a.x - ev.b.x, ev.a.y - ev.b.y) < Math.max(ev.a.w, ev.b.w) * 0.7;
      if (caught || ev.t > 5) {
        quip(ev.a, caught ? "Tag! You're it!" : "Phew… you win.", 2000);
        bounce(ev.b);
        bubbleBurst(ev.b.x + ev.b.w / 2, ev.b.y, 5);
        endEvent();
      }
      return;
    }
    if (ev.i < 0) {
      const arrived = Math.hypot(ev.b.x - ev.b.meet.x, ev.b.y - ev.b.meet.y) < 14;
      if (arrived || ev.t > 3.5) {
        ev.i = 0;
        ev.t = 2.4;
      } else return;
    }
    if (ev.t < 2.4) return;
    if (ev.i >= ev.lines.length) {
      bubbleBurst((ev.a.x + ev.b.x) / 2 + ev.a.w / 2, Math.min(ev.a.y, ev.b.y), 4);
      endEvent();
      return;
    }
    ev.t = 0;
    const line = ev.lines[ev.i++];
    const who = line[0] === "a" ? ev.a : ev.b;
    const text = line[1].replace("{A}", ev.a.spec.name).replace("{B}", ev.b.spec.name);
    quip(who, text, 2300);
    if (ev.i === ev.lines.length) ev.t = 0.4;
  }

  // The shark only hunts in the open-water bands between sections, never across the text.
  function huntTarget(h) {
    const top = S.sy + S.headerH + 20;
    const bottom = S.sy + S.vh - 20;
    const bands = [S.byId.about, S.byId.publications].map(function (z) {
      return { t: Math.max(z.stageTop + 10, top), b: Math.min(z.stageTop + z.stageH - 10, bottom) };
    }).filter(function (band) { return band.b - band.t > h + 10; });
    if (!bands.length) return null;
    const band = pick(bands);
    return rand(band.t + h / 2, band.b - h / 2);
  }

  function updateShark(c, dt) {
    const sp = c.spec.speed;
    if (c.state === "roam" || c.state === "home") {
      c.state = "exit";
      c.dir = c.x + c.w / 2 < S.vw / 2 ? -1 : 1;
    }
    if (c.state === "away") {
      c.timer -= dt;
      if (c.timer > 0 || S.reduced) return true;
      const y = huntTarget(c.h);
      if (y == null || chat.current) {
        c.timer = 4;
        return true;
      }
      c.dir = Math.random() < 0.5 ? 1 : -1;
      c.x = c.dir > 0 ? -c.w - 30 : S.vw + 30;
      c.huntY = y - c.h / 2;
      c.y = c.huntY;
      c.vy = 0;
      c.fled = [];
      c.bitten = [];
      c.cry = rand(0.6, 1.2);
      c.state = "hunt";
      return true;
    }
    if (c.state === "hunt" || c.state === "exit") {
      const speed = c.state === "hunt" ? sp : 90;
      c.x += c.dir * speed * dt;
      c.vx = c.dir * speed;
      c.vy = 0;
      if (c.state === "hunt") c.y += (c.huntY + Math.sin(S.t * 3) * 6 - c.y) * Math.min(1, 2 * dt);
      if (c.state === "hunt") {
        c.cry -= dt;
        if (c.cry <= 0 && c.cry > -1 && onScreen(c)) {
          c.cry = -5;
          if (Math.random() < 0.5) quip(c, pick(["Dinner time.", "Just passing through.", "Adversarial training!"]), 1500);
        }
        const mx = c.x + (c.dir > 0 ? c.w : 0);
        const my = c.y + c.h * 0.6;
        schools.forEach(function (s) {
          if (!s.box || c.bitten.indexOf(s) >= 0) return;
          if (mx > s.box.l - 30 && mx < s.box.r + 30 && my > s.box.t - 30 && my < s.box.b + 30) {
            c.bitten.push(s);
            c.chomp = 0.45;
            scatter(s, mx, my, 760);
            let n = 0;
            s.members.forEach(function (m) {
              if (n < 2 && !(m.gone > 0) && Math.hypot(m.x - mx, m.y - my) < 70) {
                m.gone = 14;
                n += 1;
              }
            });
            bubbleBurst(mx, my, 6);
            ring(mx, my, "255, 252, 240", 60, 0.6);
          }
        });
        const cx = c.x + c.w / 2;
        const cy = c.y + c.h / 2;
        critters.forEach(function (o) {
          if (o === c || c.fled.indexOf(o) >= 0) return;
          if (["walk", "surf", "fly", "hunt"].indexOf(o.spec.motion) >= 0) return;
          if (["roam", "meet", "play", "free"].indexOf(o.state) < 0) return;
          const dx = o.x + o.w / 2 - cx;
          const dy = o.y + o.h / 2 - cy;
          const d = Math.hypot(dx, dy) || 1;
          if (d > 260) return;
          c.fled.push(o);
          if (o.spec.id === "docker") {
            quip(o, "Mmm. Not today, GAN.", 1800);
            return;
          }
          if (life.ev && (life.ev.a === o || life.ev.b === o)) endEvent();
          o.state = "free";
          o.timer = 2.6;
          o.vx = dx / d * 340 + c.dir * 120;
          o.vy = dy / d * 260;
          quip(o, FLEE[o.spec.id] || pick(["Shark!!", "Swim!", "Eek!"]), 1600);
        });
      }
      if ((c.dir > 0 && c.x > S.vw + 40) || (c.dir < 0 && c.x < -c.w - 40)) {
        c.state = "away";
        c.timer = rand(50, 85);
      }
      return true;
    }
    return false;
  }

  function tickLife(dt) {
    if (S.reduced) return;
    if (life.ev) {
      runEvent(dt);
      return;
    }
    life.next -= dt;
    if (life.next > 0) return;
    life.next = rand(10, 18);
    const pool = critters.filter(idle);
    if (!pool.length) return;
    const r = Math.random();
    if (r < 0.42) {
      const d = findDialog(pool);
      if (d) {
        startDialog(d);
        return;
      }
    }
    if (r < 0.56 && startPlay(pool)) return;
    chatter(pick(pool));
  }

  /* ---------- portrait: arcade loop, bubbles, scan ---------- */

  const photoBubbles = (function () {
    const canvas = document.getElementById("photo-bubbles");
    const frame = document.querySelector(".portrait-frame");
    const none = { tick: function () {}, hit: function () { return null; }, pop: function () {} };
    if (!canvas || !frame) return none;
    const pc = canvas.getContext("2d");
    const list = [];
    let next = 0;
    const box = { left: 0, docTop: 0, width: 0, height: 0 };
    const photo = { left: 0, top: 0, width: 0, height: 0 };

    onLayout(function () {
      const rect = canvas.getBoundingClientRect();
      const pr = frame.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      box.left = rect.left;
      box.docTop = rect.top + S.sy;
      box.width = rect.width;
      box.height = rect.height;
      photo.left = pr.left - rect.left;
      photo.top = pr.top - rect.top;
      photo.width = pr.width;
      photo.height = pr.height;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      pc.setTransform(ratio, 0, 0, ratio, 0, 0);
    });

    function spawn() {
      if (photo.width < 20) return;
      const left = photo.left;
      const top = photo.top;
      const edge = Math.random();
      let x;
      let y;
      if (edge < 0.7) {
        x = left + Math.random() * photo.width;
        y = top - 18 - Math.random() * 42;
      } else if (edge < 0.85) {
        x = left - 14 - Math.random() * 16;
        y = top + Math.random() * photo.height * 0.28;
      } else {
        x = left + photo.width + 14 + Math.random() * 16;
        y = top + Math.random() * photo.height * 0.28;
      }
      list.push({ x: x, y: y, born: y, r0: 3 + Math.random() * 5, vy: -(32 + Math.random() * 40), vx: (Math.random() - 0.5) * 18, wobble: Math.random() * TAU, pop: 0 });
    }

    return {
      tick: function (dt) {
        if (S.sy > S.surfaceY) {
          list.length = 0;
          return;
        }
        pc.clearRect(0, 0, box.width, box.height);
        if (!S.reduced) {
          next -= dt;
          if (next <= 0 && list.length < 8) {
            spawn();
            next = 0.85 + Math.random() * 0.7;
          }
        }
        for (let i = list.length - 1; i >= 0; i--) {
          const b = list[i];
          const rise = Math.max(0, b.born - b.y);
          const radius = b.r0 + rise * 0.06;
          if (b.pop > 0) {
            b.pop += dt;
            const t = b.pop / 0.24;
            drawPixelBubble(pc, b.x, b.y, radius * (1 + t * 0.8), Math.max(0, 0.85 * (1 - t)));
            if (t >= 1) list.splice(i, 1);
            continue;
          }
          if (!S.reduced) {
            b.y += b.vy * dt;
            b.x += b.vx * dt + Math.sin(S.t + b.wobble) * 10 * dt;
          }
          if (!S.reduced && (rise > 96 || b.y < 8 || radius > 14)) {
            b.pop = 0.001;
            continue;
          }
          b.hr = radius;
          drawPixelBubble(pc, b.x, b.y, radius);
        }
      },
      hit: function (px, py) {
        for (let i = 0; i < list.length; i++) {
          const b = list[i];
          if (b.pop > 0 || b.hr == null) continue;
          const dx = px - (box.left + b.x);
          const dy = py - (box.docTop - S.sy + b.y);
          const reach = b.hr + 5;
          if (dx * dx + dy * dy <= reach * reach) return b;
        }
        return null;
      },
      pop: function (b) { if (b && b.pop === 0) b.pop = 0.001; }
    };
  })();

  // The arcade loop around the portrait: a snake and Pac-Man (with two ghosts) run the track
  // in opposite directions and bump into each other. A power pellet (thrown from the rainbow)
  // turns whoever eats it rainbow: Pac-Man can then chase and eat the frightened ghosts,
  // the snake grows long and fast. Each of them reacts to a click.
  const arcade = (function () {
    const canvas = document.getElementById("arcade");
    const frame = document.querySelector(".portrait-frame");
    const none = { tick: function () {}, hit: function () { return null; }, powerTarget: function () { return null; }, setPower: function () {} };
    if (!canvas || !frame) return none;
    const ac = canvas.getContext("2d");
    const RAINBOW = ["#e9788a", "#f0a35e", "#f2d36b", "#7cc48a", "#6fb3dc", "#9d8fdc"];
    const BASE_LEN = 12;
    const PUNCH = 0.3;
    const TURN = 0.46;
    const box = { width: 0, height: 0, docLeft: 0, docTop: 0 };
    let track = [];
    let len = 0;
    const snake = { segs: [], dir: 1, extra: 0, rainbow: 0, acc: 0 };
    const pac = { idx: 0, dir: -1, power: 0, acc: 0, wink: 0 };
    const ghosts = [
      { sprite: 0, back: 14, idx: 0, state: "trail", boo: 0 },
      { sprite: 1, back: 28, idx: 0, state: "trail", boo: 0 }
    ];
    const trail = [];
    let ghostAcc = 0;
    let pellet = 14;
    let power = -1;
    let combo = 0;
    let mode = "run";
    let modeT = 0;
    let punchX = 0;
    let punchY = 0;
    let cool = 0;
    let started = false;

    onLayout(function () {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      box.width = rect.width;
      box.height = rect.height;
      box.docLeft = rect.left;
      box.docTop = rect.top + S.sy;
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      ac.setTransform(ratio, 0, 0, ratio, 0, 0);
      buildTrack(rect);
    });

    function buildTrack(rect) {
      const photo = frame.getBoundingClientRect();
      if (photo.width < 20) {
        track = [];
        len = 0;
        return;
      }
      const margin = 12;
      const left = photo.left - rect.left - margin;
      const top = photo.top - rect.top - margin;
      const right = photo.right - rect.left + margin;
      const bottom = photo.bottom - rect.top + margin;
      const step = 8;
      const pts = [];
      function edge(x0, y0, x1, y1) {
        const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
        for (let i = 0; i < n; i++) pts.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n });
      }
      edge(left, top, right, top);
      edge(right, top, right, bottom);
      edge(right, bottom, left, bottom);
      edge(left, bottom, left, top);
      const resized = len && pts.length !== len;
      track = pts;
      len = pts.length;
      if (resized) started = false;
    }

    function mod(i) { return ((i % len) + len) % len; }
    function circ(a, b) {
      const d = Math.abs(a - b) % len;
      return Math.min(d, len - d);
    }
    function towards(from, to) { return mod(to - from) <= len / 2 ? 1 : -1; }
    function docPoint(i) {
      const p = track[mod(i)];
      return { x: box.docLeft + p.x, y: box.docTop + p.y };
    }
    function say(i, text, col) {
      const d = docPoint(i);
      addFx({ k: "label", x: d.x, y: d.y - 12, vx: 0, g: 0, vy: -24, text: text, col: col || "255, 210, 122", life: 1.3, max: 1.3 });
    }
    function burst(i, col, n) {
      const d = docPoint(i);
      sparks(d.x, d.y, n || 10, col);
    }

    function reset() {
      pac.idx = Math.floor(len / 2);
      pac.dir = -1;
      snake.dir = 1;
      snake.segs = [];
      for (let s = 0; s < BASE_LEN; s++) snake.segs.push(mod(-s * snake.dir));
      trail.length = 0;
      for (let i = 30; i >= 0; i--) trail.push(mod(pac.idx - i * pac.dir));
      pellet = 14;
      power = -1;
      mode = "run";
      started = true;
    }

    function startPower(seconds, why) {
      pac.power = seconds;
      combo = 0;
      ghosts.forEach(function (g) {
        if (g.state !== "eaten") g.state = "fright";
      });
      let best = null;
      ghosts.forEach(function (g) {
        if (g.state === "fright" && (!best || circ(pac.idx, g.idx) < circ(pac.idx, best.idx))) best = g;
      });
      if (best) pac.dir = towards(pac.idx, best.idx);
      say(pac.idx, why || "Rainbow power!");
      burst(pac.idx, "255, 210, 122", 14);
    }

    function endPower() {
      pac.power = 0;
      ghosts.forEach(function (g) {
        if (g.state !== "trail") burst(g.idx, "111, 174, 212", 6);
        g.state = "trail";
      });
    }

    function stepPac() {
      pac.idx = mod(pac.idx + pac.dir);
      trail.push(pac.idx);
      if (trail.length > 48) trail.shift();
      if (power >= 0 && circ(pac.idx, power) <= 1) {
        power = -1;
        startPower(7);
      }
      if (pac.power > 0) {
        ghosts.forEach(function (g) {
          if (g.state === "fright" && circ(pac.idx, g.idx) <= 1) {
            g.state = "eaten";
            combo += 1;
            say(g.idx, String(100 * Math.pow(2, combo)), "111, 245, 223");
            burst(g.idx, "111, 245, 223", 12);
          }
        });
      }
    }

    function stepSnake() {
      snake.segs.unshift(mod(snake.segs[0] + snake.dir));
      if (snake.segs.length > BASE_LEN + snake.extra) snake.segs.pop();
      if (snake.segs.length > BASE_LEN + snake.extra) snake.segs.pop();
      if (snake.segs[0] === pellet) pellet = mod(pellet + 17 * snake.dir);
      if (power >= 0 && circ(snake.segs[0], power) <= 1) {
        power = -1;
        snake.rainbow = 8;
        snake.extra = 9;
        say(snake.segs[0], "Rainbow snake!");
        burst(snake.segs[0], "255, 210, 122", 14);
      }
    }

    function stepGhosts() {
      ghosts.forEach(function (g) {
        if (g.state === "fright") g.idx = mod(g.idx - towards(g.idx, pac.idx));
      });
    }

    function checkBump() {
      if (cool > 0 || pac.power > 0) return false;
      for (let s = 0; s < snake.segs.length; s++) {
        if (circ(pac.idx, snake.segs[s]) <= 1) {
          const p = track[snake.segs[s]];
          punchX = p.x;
          punchY = p.y;
          mode = "punch";
          modeT = 0;
          return true;
        }
      }
      return false;
    }

    function facing(from, to) {
      if (Math.abs(to.x - from.x) > Math.abs(to.y - from.y)) return to.x >= from.x ? "e" : "w";
      return to.y >= from.y ? "s" : "n";
    }

    function faceAngle(face) {
      if (face === "s") return Math.PI / 2;
      if (face === "w") return Math.PI;
      if (face === "n") return -Math.PI / 2;
      return 0;
    }

    function travelAngle(dir, idx) { return faceAngle(facing(track[idx], track[mod(idx + dir)])); }

    function blit(lines, x, y, scale, angle, over) {
      const h = lines.length;
      const w = lines[0].length;
      ac.save();
      ac.translate(x, y);
      ac.rotate(angle || 0);
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const ch = lines[row][col];
          const color = over && over[ch] !== undefined ? over[ch] : PAL[ch];
          if (!color) continue;
          ac.fillStyle = color;
          ac.fillRect((col - w / 2) * scale, (row - h / 2) * scale, scale, scale);
        }
      }
      ac.restore();
    }

    function update(dt) {
      if (pac.power > 0) {
        pac.power -= dt;
        if (pac.power <= 0) endPower();
      }
      if (snake.rainbow > 0) {
        snake.rainbow -= dt;
        if (snake.rainbow <= 0) snake.extra = 0;
      }
      ghosts.forEach(function (g) { g.boo = Math.max(0, g.boo - dt); });
      pac.wink = Math.max(0, pac.wink - dt);
      if (mode !== "run") {
        modeT += dt;
        if (mode === "punch" && modeT >= PUNCH) {
          mode = "turn";
          modeT = 0;
        } else if (mode === "turn" && modeT >= TURN) {
          snake.dir *= -1;
          pac.dir *= -1;
          mode = "run";
          cool = 0.55;
        }
        return;
      }
      cool = Math.max(0, cool - dt);
      const pacStep = pac.power > 0 ? 0.08 : 0.11;
      pac.acc += dt;
      while (pac.acc >= pacStep && mode === "run") {
        pac.acc -= pacStep;
        stepPac();
        if (checkBump()) pac.acc = 0;
      }
      const snakeStep = snake.rainbow > 0 ? 0.075 : 0.11;
      snake.acc += dt;
      while (snake.acc >= snakeStep && mode === "run") {
        snake.acc -= snakeStep;
        stepSnake();
        if (checkBump()) snake.acc = 0;
      }
      ghostAcc += dt;
      while (ghostAcc >= 0.2) {
        ghostAcc -= 0.2;
        stepGhosts();
      }
    }

    function draw(now) {
      for (let i = 0; i < len; i += 3) {
        if (circ(i, pac.idx) < 3) continue;
        ac.fillStyle = "rgba(226, 196, 138, 0.85)";
        ac.fillRect(Math.round(track[i].x) - 1, Math.round(track[i].y) - 1, 2, 2);
      }
      if (power >= 0) {
        const p = track[power];
        const s = 6 + Math.round(Math.sin(now / 140));
        ac.fillStyle = RAINBOW[Math.floor(now / 90) % RAINBOW.length];
        ac.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
        ac.fillStyle = "rgba(255, 255, 255, 0.9)";
        ac.fillRect(Math.round(p.x - s / 2) + 1, Math.round(p.y - s / 2) + 1, 2, 2);
      }
      const food = track[pellet];
      ac.fillStyle = "#d9896a";
      ac.fillRect(Math.round(food.x) - 2, Math.round(food.y) - 2, 4, 4);

      const spin = mode === "turn" ? Math.PI * (function (u) { return u * u * (3 - 2 * u); })(Math.min(1, modeT / TURN)) : 0;
      const recoil = mode === "punch" ? Math.sin(Math.min(1, modeT / PUNCH) * Math.PI) * 3.5 : 0;
      const snakeAngle = travelAngle(snake.dir, snake.segs[0]);
      const glowing = snake.rainbow > 0;
      for (let s = snake.segs.length - 1; s >= 0; s--) {
        const pt = track[snake.segs[s]];
        const head = s === 0;
        const size = head ? 8 : 7;
        const hx = head ? pt.x - Math.cos(snakeAngle) * recoil : pt.x;
        const hy = head ? pt.y - Math.sin(snakeAngle) * recoil : pt.y;
        if (glowing) ac.fillStyle = head ? "#1a4743" : RAINBOW[(s + Math.floor(now / 80)) % RAINBOW.length];
        else ac.fillStyle = head ? "#1a4743" : (s % 2 ? "#3f7f76" : "#2c6158");
        ac.fillRect(Math.round(hx) - (size >> 1), Math.round(hy) - (size >> 1), size, size);
        if (!head) {
          ac.fillStyle = glowing ? "rgba(255, 255, 255, 0.85)" : "#a9d2c8";
          ac.fillRect(Math.round(pt.x) - 1, Math.round(pt.y) - 1, 2, 2);
          continue;
        }
        const look = snakeAngle + spin;
        const fx0 = Math.cos(look) * 2.2;
        const fy0 = Math.sin(look) * 2.2;
        const px = -Math.sin(look) * 1.6;
        const py = Math.cos(look) * 1.6;
        ac.fillStyle = "#fffcf7";
        ac.fillRect(Math.round(hx + fx0 + px) - 1, Math.round(hy + fy0 + py) - 1, 2, 2);
        ac.fillRect(Math.round(hx + fx0 - px) - 1, Math.round(hy + fy0 - py) - 1, 2, 2);
      }

      const pacAngle = travelAngle(pac.dir, pac.idx);
      const open = Math.floor(now / (pac.power > 0 ? 90 : 160)) % 2 === 0;
      const pacX = track[pac.idx].x - Math.cos(pacAngle) * recoil;
      const pacY = track[pac.idx].y - Math.sin(pacAngle) * recoil;
      const pacOver = pac.power > 0 ? { o: RAINBOW[Math.floor(now / 70) % RAINBOW.length] } : null;
      if (pac.power > 0) {
        ac.fillStyle = "rgba(255, 246, 214, 0.35)";
        ac.fillRect(Math.round(pacX) - 10, Math.round(pacY) - 10, 20, 20);
      }
      blit(open || pac.wink > 0 ? PX.PAC_OPEN.e : PX.PAC_SHUT, pacX, pacY, pac.wink > 0 ? 3 : 2, pacAngle + spin, pacOver);

      ghosts.forEach(function (g) {
        if (g.state === "trail") {
          const at = Math.max(0, trail.length - 1 - g.back);
          g.idx = trail[at];
        }
        const prev = mod(g.idx - pac.dir);
        const angle = faceAngle(facing(track[prev], track[g.idx]));
        let over = null;
        if (g.state === "fright") {
          const flash = pac.power < 1.5 && Math.floor(now / 160) % 2 === 0;
          const body = flash ? "#f4f7ff" : "#2f4fd8";
          over = { r: body, u: body, n: flash ? "#e9788a" : "#ffd27a", w: flash ? "#e9788a" : "#ffd27a" };
        } else if (g.state === "eaten") {
          over = { r: null, u: null };
        } else if (g.boo > 0 && Math.floor(now / 90) % 2 === 0) {
          over = { r: "#fffcf7", u: "#fffcf7" };
        }
        const wobble = g.boo > 0 ? Math.sin(now / 40) * 2 : 0;
        blit(PX.GHOSTS[g.sprite], track[g.idx].x + wobble, track[g.idx].y, g.boo > 0 ? 3 : 2, angle, over);
      });

      if (mode === "punch") {
        const t = Math.min(1, modeT / PUNCH);
        ac.save();
        ac.globalAlpha = Math.max(0, 1 - t);
        ac.fillStyle = "#fffcf7";
        const arm = Math.round(6 + t * 16);
        ac.fillRect(Math.round(punchX) - arm, Math.round(punchY) - 2, arm * 2, 5);
        ac.fillRect(Math.round(punchX) - 2, Math.round(punchY) - arm, 5, arm * 2);
        ac.fillStyle = "#f2c94c";
        const bx = Math.max(3, Math.round(10 * (1 - t)));
        ac.fillRect(Math.round(punchX) - (bx >> 1), Math.round(punchY) - (bx >> 1), bx, bx);
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * TAU + 0.35;
          const dist = 6 + t * 22;
          ac.fillStyle = i % 2 ? "#fffcf7" : "#e07b86";
          ac.fillRect(Math.round(punchX + Math.cos(ang) * dist) - 2, Math.round(punchY + Math.sin(ang) * dist) - 2, 4, 4);
        }
        ac.restore();
      }
    }

    function near(cx, cy, idx, r) {
      const p = track[mod(idx)];
      return Math.hypot(cx - p.x, cy - p.y) <= r;
    }

    return {
      tick: function (dt, now) {
        if (S.sy > S.surfaceY) return;
        ac.clearRect(0, 0, box.width, box.height);
        if (len < 8) return;
        if (!started) reset();
        if (!S.reduced) update(dt);
        draw(now);
      },
      // Client coordinates in; returns what to do if something on the track was clicked.
      hit: function (clientX, clientY) {
        if (len < 8 || !started || S.sy > S.surfaceY) return null;
        const x = clientX - box.docLeft;
        const y = clientY + S.sy - box.docTop;
        if (near(x, y, pac.idx, 12)) {
          return function () {
            pac.wink = 0.35;
            if (pac.power > 0) say(pac.idx, "Waka waka!");
            else startPower(4, "Waka!");
          };
        }
        for (let i = 0; i < ghosts.length; i++) {
          const g = ghosts[i];
          if (g.state !== "eaten" && near(x, y, g.idx, 11)) {
            return function () {
              g.boo = 0.9;
              say(g.idx, g.state === "fright" ? "Eek!" : "Boo!", "233, 120, 138");
            };
          }
        }
        for (let s = 0; s < snake.segs.length; s++) {
          if (near(x, y, snake.segs[s], 9)) {
            return function () {
              snake.rainbow = 6;
              snake.extra = 6;
              say(snake.segs[0], "Hiss!", "124, 196, 138");
              burst(snake.segs[0], "124, 196, 138", 10);
            };
          }
        }
        return null;
      },
      // Where a thrown power pellet should land: on the far side from Pac-Man.
      powerTarget: function () {
        if (len < 8 || !started) return null;
        const idx = mod(pac.idx + Math.floor(len / 2));
        const d = docPoint(idx);
        return { x: d.x, y: d.y, idx: idx };
      },
      setPower: function (idx) {
        if (len < 8) return;
        power = mod(idx);
        burst(power, "255, 210, 122", 10);
      }
    };
  })();

  (function setupPortraitScan() {
    const wrap = document.getElementById("portrait");
    const btn = document.getElementById("portrait-frame");
    const pct = document.getElementById("scan-pct");
    const bar = document.getElementById("scan-bar");
    const label = document.getElementById("scan-label");
    if (!wrap || !btn) return;
    const PHASES = ["scanning", "whos", "revealed", "scanned"];
    let timers = [];
    let run = 0;
    function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
    btn.addEventListener("click", function () {
      timers.forEach(clearTimeout);
      timers = [];
      const id = ++run;
      wrap.classList.remove.apply(wrap.classList, PHASES);
      void wrap.offsetWidth;
      wrap.classList.add("scanning", "whos");
      if (label) label.textContent = "Analyzing silhouette";
      const r = btn.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + S.sy + r.height / 2;
      sparks(cx, cy, 12, "255, 203, 5");
      sparks(cx, cy, 8, "61, 125, 202");
      const start = performance.now();
      const dur = S.reduced ? 1 : 1700;
      (function count() {
        if (id !== run) return;
        const k = Math.min(1, (performance.now() - start) / dur);
        const shown = Math.floor(Math.pow(k, 0.8) * 100);
        if (pct) pct.textContent = String(shown).padStart(3, "0") + "%";
        if (bar) bar.style.width = shown + "%";
        if (label && k > 0.55) label.textContent = "Matching subject";
        if (k < 1) later(count, 40);
      })();
      later(function () {
        wrap.classList.remove("whos");
        wrap.classList.add("revealed");
        sparks(cx, cy - r.height * 0.3, 16, "255, 203, 5");
        sparks(cx, cy, 10, "0, 240, 255");
        ring(cx, cy, "255, 203, 5", Math.max(r.width, r.height) * 0.8, 0.8);
      }, dur + 60);
      later(function () { wrap.classList.add("scanned"); }, dur + 220);
      later(function () {
        wrap.classList.remove.apply(wrap.classList, PHASES);
      }, dur + 4200);
    });
  })();

  // The rainbow over the quote: a pixel arc standing on two clouds. It draws itself in,
  // a silver shimmer sweeps across it, stars twinkle along it, it glows where the cursor
  // is, and a click sends a ripple through it and throws a power pellet to the arcade.
  const rainbow = (function () {
    const canvas = document.getElementById("rainbow");
    const none = { tick: function () {}, hit: function () { return null; } };
    if (!canvas) return none;
    const rc = canvas.getContext("2d");
    const BANDS = ["#e9788a", "#f0a35e", "#f2d36b", "#7cc48a", "#6fb3dc", "#9d8fdc"];
    // A fogbow is nearly white; a moonbow is pale and silvery.
    const PALETTES = {
      normal: BANDS,
      fog: ["#e3c7cd", "#e7d6c4", "#e8e1c7", "#d2e2d3", "#cddbe6", "#d8d2e8"],
      moon: ["#b9b7d3", "#c3c0d8", "#cfcce0", "#bfcadb", "#b3c3db", "#bbb3d6"]
    };
    const CELL = 4;
    const LEVELS = 6;
    function shadeSet(list) {
      return list.map(function (hex) {
        const n = parseInt(hex.slice(1), 16);
        const r = n >> 16;
        const g = (n >> 8) & 255;
        const b = n & 255;
        const out = [];
        for (let l = 0; l < LEVELS; l++) {
          const k = l * 0.11;
          out.push("rgb(" + Math.round(r + (255 - r) * k) + "," + Math.round(g + (255 - g) * k) + "," + Math.round(b + (255 - b) * k) + ")");
        }
        return out;
      });
    }
    const SHADES = { normal: shadeSet(PALETTES.normal), fog: shadeSet(PALETTES.fog), moon: shadeSet(PALETTES.moon) };
    let look = 1;
    let dbl = 0;
    const cloud = sheet(PX.CLOUDS[1]);
    const geo = { w: 0, h: 0, docLeft: 0, docTop: 0, x0: 0, x1: 0, base: 0, amp: 0 };
    let reveal = S.reduced ? 1 : 0;
    let delay = 0.35;
    const waves = [];
    const stars = [];
    let nextStar = 0;
    let hoverX = null;

    onLayout(function () {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      geo.w = rect.width;
      geo.h = rect.height;
      geo.docLeft = rect.left;
      geo.docTop = rect.top + S.sy;
      geo.x0 = 22;
      geo.x1 = Math.max(geo.x0 + 40, rect.width - 22);
      geo.base = rect.height - 12;
      geo.amp = Math.max(20, geo.base - 10 - BANDS.length * CELL);
      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));
      rc.setTransform(ratio, 0, 0, ratio, 0, 0);
    });

    // Top edge of the arc at canvas x: a half circle, snapped to the pixel grid.
    // With a double rainbow the main arc sits a little lower to make room for the second.
    function archY(x) {
      const t = clamp((x - geo.x0) / (geo.x1 - geo.x0), 0, 1);
      const lift = Math.sqrt(Math.max(0, 1 - Math.pow(2 * t - 1, 2)));
      return geo.base - BANDS.length * CELL - lift * (geo.amp - dbl * 12);
    }

    function waveOffset(x) {
      let y = 0;
      for (let i = 0; i < waves.length; i++) {
        const w = waves[i];
        const front = w.t * 260;
        const d = Math.abs(x - w.x);
        if (d > front) continue;
        y += Math.sin((front - d) * 0.09) * 7 * Math.exp(-w.t * 2.2) * Math.exp(-(front - d) / 140);
      }
      return y;
    }

    function star(x, y, size, col, a) {
      rc.globalAlpha = a;
      rc.fillStyle = col;
      rc.fillRect(x - 1, y - 1, 2, 2);
      if (size > 1) {
        rc.fillRect(x - 1, y - 1 - size * 2, 2, size * 2 - 2);
        rc.fillRect(x - 1, y + 1, 2, size * 2 - 2);
        rc.fillRect(x - 1 - size * 2, y - 1, size * 2 - 2, 2);
        rc.fillRect(x + 1, y - 1, size * 2 - 2, 2);
      }
      rc.globalAlpha = 1;
    }

    function tick(dt, now) {
      if (S.sy > S.surfaceY || geo.w < 2) return;
      const t = now / 1000;
      if (!S.reduced) {
        if (delay > 0) delay -= dt;
        else reveal = Math.min(1, reveal + dt / 1.6);
      }
      for (let i = waves.length - 1; i >= 0; i--) {
        waves[i].t += dt;
        if (waves[i].t > 2.2) waves.splice(i, 1);
      }
      // Hover: the arc glows under the cursor.
      hoverX = null;
      if (P.active) {
        const x = P.cx - geo.docLeft;
        const y = P.cy + S.sy - geo.docTop;
        if (x > 0 && x < geo.w && y > -10 && y < geo.h + 10) hoverX = x;
      }
      rc.clearRect(0, 0, geo.w, geo.h);
      const W = S.weather;
      const ease = S.reduced ? 1 : Math.min(1, dt * 1.5);
      look += (W.alpha - look) * ease;
      dbl += ((W.double ? 1 : 0) - dbl) * ease;
      const shades = SHADES[W.bow] || SHADES.normal;
      const edge = geo.x0 + (geo.x1 - geo.x0) * (1 - Math.pow(1 - reveal, 3));
      const sweep = S.reduced ? -999 : ((t * 0.16) % 1.6 - 0.3) * geo.w;
      const breathe = (S.reduced ? 1 : 0.9 + 0.08 * Math.sin(t * 1.3)) * look;
      // The secondary bow of a double rainbow: fainter, thinner, colours reversed.
      if (dbl > 0.02) {
        rc.globalAlpha = 0.5 * dbl * breathe;
        for (let x = geo.x0 - 6; x <= Math.min(edge, geo.x1 + 6); x += CELL) {
          const y = Math.round((archY(clamp(x, geo.x0, geo.x1)) - 12 + waveOffset(x)) / 2) * 2;
          for (let b = 0; b < BANDS.length; b++) {
            rc.fillStyle = shades[BANDS.length - 1 - b][1];
            rc.fillRect(x, y + b * 2 - 2, CELL, 2);
          }
        }
        rc.globalAlpha = 1;
      }
      let prev = null;
      for (let x = geo.x0; x <= edge; x += CELL) {
        const y = Math.round((archY(x) + waveOffset(x)) / CELL) * CELL;
        let glow = Math.exp(-Math.pow((x - sweep) / 46, 2)) * 0.75;
        if (hoverX !== null) glow += Math.exp(-Math.pow((x - hoverX) / 38, 2)) * 0.9;
        if (Math.abs(x - edge) < 10 && reveal < 1) glow += 0.9;
        const level = Math.min(LEVELS - 1, Math.round(glow * (LEVELS - 1)));
        const lift = hoverX !== null ? -Math.round(Math.exp(-Math.pow((x - hoverX) / 30, 2)) * 1.4) * 2 : 0;
        const top = Math.min(prev === null ? y : prev, y) + lift;
        const span = Math.abs(y - (prev === null ? y : prev)) + CELL;
        rc.globalAlpha = breathe;
        for (let b = 0; b < BANDS.length; b++) {
          rc.fillStyle = shades[b][level];
          rc.fillRect(x, top + b * CELL, CELL, span);
        }
        prev = y;
      }
      rc.globalAlpha = 1;
      // The leading tip while drawing in.
      if (reveal < 1 && reveal > 0) {
        star(Math.round(edge / 2) * 2, Math.round((archY(edge) - 4) / 2) * 2, 2, "#fffcf7", 0.95);
      }
      // Twinkling stars along the arc.
      if (!S.reduced && reveal >= 1 && W.twinkle > 0) {
        nextStar -= dt * W.twinkle;
        if (nextStar <= 0) {
          nextStar = rand(0.25, 0.6);
          const x = rand(geo.x0 + 10, geo.x1 - 10);
          const silver = W.bow === "moon" || W.bow === "fog";
          stars.push({ x: Math.round(x / 2) * 2, y: Math.round((archY(x) - rand(4, 16)) / 2) * 2, age: 0, life: rand(0.7, 1.2), size: Math.random() < 0.3 ? 2 : 1, col: Math.random() < 0.5 ? "#fffcf7" : (silver ? "#c9cfe6" : "#f2d36b") });
        }
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i];
        s.age += dt;
        if (s.age >= s.life) {
          stars.splice(i, 1);
          continue;
        }
        star(s.x, s.y, s.size, s.col, Math.sin(Math.PI * s.age / s.life) * Math.max(0.3, look));
      }
      // Clouds at both feet of the rainbow ("every cloud has a silver lining").
      if (reveal > 0.02) {
        const bob = S.reduced ? 0 : Math.round(Math.sin(t * 1.4));
        const cw = cloud.width * 2;
        const ch = cloud.height * 2;
        rc.imageSmoothingEnabled = false;
        rc.drawImage(cloud, Math.round(geo.x0 - cw / 2 + 2), geo.h - ch - 1 + bob, cw, ch);
        if (reveal >= 1) rc.drawImage(cloud, Math.round(geo.x1 - cw / 2 + 2), geo.h - ch - 1 - bob, cw, ch);
      }
    }

    return {
      tick: tick,
      hit: function (clientX, clientY) {
        if (geo.w < 2 || reveal < 1 || S.sy > S.surfaceY) return null;
        const x = clientX - geo.docLeft;
        const y = clientY + S.sy - geo.docTop;
        if (x < geo.x0 - 4 || x > geo.x1 + 4) return null;
        const top = archY(x);
        if (y < top - 12 || y > top + BANDS.length * CELL + 12) return null;
        return function () {
          waves.push({ x: x, t: 0 });
          const docX = geo.docLeft + x;
          const docY = geo.docTop + top + 10;
          BANDS.forEach(function (hex, i) {
            const n = parseInt(hex.slice(1), 16);
            sparks(docX, docY, 3, (n >> 16) + ", " + ((n >> 8) & 255) + ", " + (n & 255));
            void i;
          });
          const target = arcade.powerTarget();
          if (target) {
            addFx({
              k: "orb", x: docX, y: docY, x0: docX, y0: docY, x1: target.x, y1: target.y,
              life: 1.1, max: 1.1, idx: target.idx,
              done: function () { arcade.setPower(target.idx); }
            });
          }
        };
      }
    };
  })();

  /* ---------- weather: live Hong Kong conditions from Open-Meteo (no key, no visitor data) ---------- */

  const weather = (function () {
    const URL = "https://api.open-meteo.com/v1/forecast?latitude=22.3027&longitude=114.1772&current=temperature_2m,weather_code,is_day,cloud_cover&timezone=Asia%2FHong_Kong";
    const CACHE = "hk-weather-v1";
    const tag = document.getElementById("weather-tag");
    const icon = document.getElementById("weather-icon");
    const text = document.getElementById("weather-text");
    const CODE_TEXT = {
      0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast", 45: "fog", 48: "fog",
      51: "light drizzle", 53: "drizzle", 55: "heavy drizzle", 56: "freezing drizzle", 57: "freezing drizzle",
      61: "light rain", 63: "rain", 65: "heavy rain", 66: "freezing rain", 67: "freezing rain",
      71: "light snow", 73: "snow", 75: "heavy snow", 77: "snow grains",
      80: "showers", 81: "showers", 82: "heavy showers", 85: "snow showers", 86: "snow showers",
      95: "thunderstorm", 96: "thunderstorm and hail", 99: "thunderstorm and hail"
    };
    const ICONS = {
      sunny: ["....o....", ".o..o..o.", "..ooooo..", "..ooooo..", "ooooooooo", "..ooooo..", "..ooooo..", ".o..o..o.", "....o...."],
      partly: ["......o..", "....ooooo", "..AAAooo.", ".AAAAAAoo", "AAAAAAAA.", "AAAAAAAA.", ".AAAAAA..", ".........", "........."],
      sunshower: ["..o.o.o..", "...ooo...", ".ooooooo.", "...ooo...", "..o.o.o..", ".........", ".u..u..u.", "u..u..u..", "........."],
      overcast: [".........", "...AAA...", "..AAAAA..", ".AAAAAAAA", "AAAAAAAAA", "AAAAAAAAA", ".AAAAAAA.", ".........", "........."],
      rain: ["...AAA...", "..AAAAA..", ".AAAAAAAA", "AAAAAAAAA", ".AAAAAAA.", ".........", ".u..u..u.", "u..u..u..", "........."],
      storm: ["...AAA...", "..AAAAA..", ".AAAAAAAA", "AAAAAAAAA", ".AAAoAAA.", "....oo...", "...oo....", "....o....", "........."],
      fog: [".........", "AAAAAAA..", ".........", "..AAAAAAA", ".........", "AAAAAAA..", ".........", "..AAAAAAA", "........."],
      night: ["...yyy...", "..yy.....", ".yy......", ".yy......", ".yy......", ".yy......", "..yy.....", "...yyy...", "........."]
    };
    const PREVIEW = ["sunny", "sunshower", "overcast", "rain", "storm", "fog", "night"];
    let live = null;
    let preview = -1;

    function kindFor(code, isDay, cloud) {
      if (code >= 95) return "storm";
      const wet = (code >= 51 && code <= 67) || (code >= 71 && code <= 77) || (code >= 80 && code <= 86);
      if (wet) return isDay && cloud < 85 ? "sunshower" : "rain";
      if (code === 45 || code === 48) return "fog";
      if (!isDay) return "night";
      if (code === 3 || cloud >= 85) return "overcast";
      if (code === 2) return "partly";
      return "sunny";
    }

    function apply(kind, info) {
      const next = Object.assign({ kind: kind, live: !!(info && info.live), temp: info ? info.temp : null, text: info ? info.text : "" }, WEATHER_KINDS[kind]);
      if (kind === "night" && info && info.cloud >= 85) next.alpha = 0.45;
      const skyChanged = (S.weather.sky || null) !== (next.sky || null);
      S.weather = next;
      if (skyChanged) paintBackdrop();
      render();
    }

    function render() {
      if (!tag) return;
      const W = S.weather;
      paint(icon, ICONS[W.kind] || ICONS.partly);
      if (preview >= 0) {
        text.textContent = "Preview · " + W.label;
        tag.title = "Previewing " + W.label + ". Click to keep cycling, back to live Hong Kong weather at the end.";
      } else if (W.live) {
        text.textContent = "Hong Kong · " + Math.round(W.temp) + "° · " + W.text;
        tag.title = "Live weather in Hong Kong (Open-Meteo). Click to preview other weather.";
      } else {
        text.textContent = "Hong Kong · " + W.label;
        tag.title = "Hong Kong weather. Click to preview other weather.";
      }
      tag.setAttribute("aria-label", text.textContent + ". Click to preview other weather on the rainbow.");
    }

    function useLive() {
      if (live) apply(live.kind, live);
      else apply(S.part === "night" ? "night" : "partly", null);
    }

    function read(data) {
      const c = data && data.current;
      if (!c || typeof c.weather_code !== "number") return null;
      const isDay = c.is_day === 1;
      return {
        live: true, temp: c.temperature_2m, cloud: c.cloud_cover || 0,
        text: CODE_TEXT[c.weather_code] || "fair", kind: kindFor(c.weather_code, isDay, c.cloud_cover || 0)
      };
    }

    async function load() {
      try {
        const cached = JSON.parse(sessionStorage.getItem(CACHE) || "null");
        if (cached && Date.now() - cached.at < 20 * 60 * 1000) {
          live = read(cached.data);
          if (live && preview < 0) useLive();
          return;
        }
      } catch (err) { /* storage unavailable */ }
      const ctrl = new AbortController();
      const timer = setTimeout(function () { ctrl.abort(); }, 8000);
      try {
        const res = await fetch(URL, { signal: ctrl.signal });
        if (!res.ok) throw new Error("status " + res.status);
        const data = await res.json();
        live = read(data) || live;
        try { sessionStorage.setItem(CACHE, JSON.stringify({ at: Date.now(), data: data })); } catch (err) { /* ignore */ }
      } catch (err) {
        /* keep whatever we had; the page still works without live weather */
      } finally {
        clearTimeout(timer);
      }
      if (preview < 0) useLive();
    }

    if (tag) {
      tag.addEventListener("click", function () {
        preview += 1;
        if (preview >= PREVIEW.length) {
          preview = -1;
          useLive();
        } else {
          apply(PREVIEW[preview], null);
        }
        const r = tag.getBoundingClientRect();
        sparks(r.left + 12, r.top + S.sy + r.height / 2, 8, S.weather.bow === "normal" ? "242, 201, 76" : "201, 207, 230");
      });
    }

    useLive();
    load();
    setInterval(function () { if (document.visibilityState === "visible") load(); }, 30 * 60 * 1000);
    return { reload: load };
  })();

  /* ---------- greeting, clock, nav, gauge, vision ---------- */

  const GREETINGS = {
    en: { morning: "Good morning", afternoon: "Good afternoon", night: "Good night" },
    zh: { morning: "早上好", afternoon: "下午好", night: "晚安" }
  };
  const PARTS = ["morning", "afternoon", "night"];

  function visitorZone() {
    try {
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (zone) return zone;
    } catch (err) { /* keep the Hong Kong default */ }
    return "Asia/Hong_Kong";
  }

  function hourIn(date, zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", hourCycle: "h23" }).formatToParts(date);
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

  const day = (function () {
    const hello = document.getElementById("hello");
    const helloText = document.getElementById("hello-text");
    const mark = document.getElementById("hello-mark");
    const markBtn = document.getElementById("day-mark");
    const clock = document.getElementById("clock");
    const clockTime = document.getElementById("clock-time");
    const clockZone = document.getElementById("clock-zone");
    const tz = visitorZone();
    const chinese = visitorZh;
    let override = null;
    let shown = "";
    let frame = -1;
    let lastSec = -1;
    if (hello) hello.classList.toggle("hello-zh", chinese);
    if (clock) clock.title = tz;
    if (clockZone) clockZone.textContent = zoneLabel(tz);
    S.part = partOfDay(hourIn(new Date(), tz));

    if (markBtn) {
      markBtn.addEventListener("click", function () {
        const from = override || S.part;
        override = PARTS[(PARTS.indexOf(from) + 1) % PARTS.length];
        const r = markBtn.getBoundingClientRect();
        sparks(r.left + r.width / 2, r.top + S.sy + r.height / 2, 10, override === "night" ? "196, 160, 92" : "242, 201, 76");
      });
    }

    return {
      tick: function (now) {
        const date = new Date();
        const sec = date.getSeconds();
        const part = override || (sec === lastSec ? S.part : partOfDay(hourIn(date, tz)));
        if (part !== S.part) {
          S.part = part;
          paintBackdrop();
        }
        const phrase = (chinese ? GREETINGS.zh : GREETINGS.en)[part];
        if (helloText && phrase !== shown) {
          shown = phrase;
          helloText.textContent = phrase;
          if (hello) hello.lang = chinese ? "zh-Hans" : "en";
        }
        if (mark) {
          const frames = PX.DAY_MARKS[part];
          const next = S.reduced ? 0 : Math.floor(now / 700) % frames.length;
          const key = part + next;
          if (key !== frame) {
            frame = key;
            paint(mark, frames[next]);
          }
          mark.style.transform = "translateY(" + (S.reduced ? 0 : Math.sin(now / 520) * 1.1).toFixed(2) + "px)";
        }
        if (clockTime && sec !== lastSec) {
          lastSec = sec;
          try {
            clockTime.textContent = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(date);
          } catch (err) {
            clockTime.textContent = date.toLocaleTimeString("en-GB", { hour12: false });
          }
          if (clock) clock.dateTime = date.toISOString();
        }
      }
    };
  })();

  const hud = (function () {
    const links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
    const rail = document.getElementById("gauge-rail");
    const sub = document.getElementById("gauge-sub");
    const num = document.getElementById("depth-num");
    const zoneEl = document.getElementById("depth-zone");
    const ticks = [];
    const atm = document.getElementById("depth-atm");
    const tip = document.getElementById("dive-tip");
    const tipText = document.getElementById("dive-tip-text");
    const tipArrow = document.getElementById("dive-tip-arrow");
    const mission = document.getElementById("mission");
    const missionSub = document.getElementById("mission-sub");
    let probeZone = "";
    let lastSy = -1;
    let tipTimer = 0;
    const tipSeen = {};
    let tipOut = 0;
    let missionOn = false;
    let railTop = 0;
    let lastAtm = -1;
    let lastTone = "";
    let lastHere = "";
    let lastDepth = -1;
    let lastZone = "";
    const seen = {};
    let hintAt = 0;
    let pendingHint = null;

    if (rail) {
      ZONES.forEach(function (z) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "gauge-tick";
        b.dataset.label = z.name + (z.id !== "top" ? " · " + z.d0.toLocaleString("en-US") + " m" : "");
        b.setAttribute("aria-label", "Dive to the " + z.name.toLowerCase());
        b.addEventListener("click", function () {
          const zone = S.byId[z.id];
          window.scrollTo({ top: z.id === "top" ? 0 : zone.top, behavior: S.reduced ? "auto" : "smooth" });
        });
        rail.appendChild(b);
        ticks.push(b);
      });
    }

    onLayout(function () {
      if (!rail) return;
      railTop = rail.getBoundingClientRect().top;
      const railH = rail.offsetHeight;
      const range = Math.max(1, S.docH - S.vh);
      ticks.forEach(function (b, i) {
        const z = S.zones[i];
        b.style.top = Math.round(clamp(z.top / range, 0, 1) * railH) + "px";
      });
    });

    function maybeHint(zoneId) {
      if (seen[zoneId] || !HINTS[zoneId]) return;
      seen[zoneId] = true;
      pendingHint = { zone: zoneId, at: S.t + (zoneId === "top" ? 2.6 : 0.9) };
    }

    function fireHint() {
      if (!pendingHint || S.t < pendingHint.at) return;
      const zoneId = pendingHint.zone;
      pendingHint = null;
      if (S.t - hintAt < 4) return;
      const want = HINTS[zoneId];
      const visible = function (c) {
        return c.y + c.h > S.sy + S.headerH && c.y < S.sy + S.vh - 20 && c.state !== "drag" && c.state !== "chat";
      };
      let c = critters.find(function (o) { return o.spec.id === want[0]; });
      if (!c || !visible(c)) c = critters.find(function (o) { return o.spec.zone === zoneId && visible(o); });
      if (!c) {
        seen[zoneId] = false;
        return;
      }
      hintAt = S.t;
      quip(c, want[1], 3600);
    }

    function showTip(text, down) {
      if (!tip) return;
      tipText.textContent = text;
      tipArrow.textContent = down ? "▼" : "▲";
      tip.hidden = false;
      tip.classList.remove("out");
      void tip.offsetWidth;
      tip.style.animation = "";
      tipTimer = 2.2;
      tipOut = 0;
    }

    function tickTip(dt) {
      if (!tip || tip.hidden) return;
      if (S.gauge) {
        const range = Math.max(1, S.docH - S.vh);
        const y = railTop + clamp(S.sy / range, 0, 1) * rail.offsetHeight;
        tip.style.top = Math.round(clamp(y - tip.offsetHeight / 2, S.headerH + 10, S.vh - tip.offsetHeight - 10)) + "px";
      } else {
        tip.style.top = "";
      }
      if (tipTimer > 0) {
        tipTimer -= dt;
        if (tipTimer <= 0) {
          tip.classList.add("out");
          tipOut = 0.32;
        }
      } else if (tipOut > 0) {
        tipOut -= dt;
        if (tipOut <= 0) tip.hidden = true;
      }
    }

    function tickMission() {
      if (!mission) return;
      const on = S.sy + S.vh > S.floorY + 70;
      if (on === missionOn) return;
      missionOn = on;
      if (on) {
        const met = S.met.size;
        missionSub.textContent = "Seafloor reached · 4,800 m · creatures met " + met + "/" + critters.length;
        mission.classList.remove("show");
        void mission.offsetWidth;
        mission.classList.add("show");
        const r = mission.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + S.sy + r.height / 2;
        sparks(cx - r.width / 3, cy, 14, "255, 210, 122");
        sparks(cx + r.width / 3, cy, 14, "255, 210, 122");
        sparks(cx, cy - 20, 18, "111, 245, 223");
        ring(cx, cy, "255, 210, 122", 200, 1.4);
      } else {
        mission.classList.remove("show");
      }
    }

    return {
      tick: function (dt) {
        const probe = S.sy + S.vh * 0.5;
        const pz = probe <= S.surfaceY ? "top" : zoneAt(probe).id;
        const goingDown = lastSy < 0 ? true : S.sy >= lastSy;
        if (pz !== probeZone) {
          const key = pz + (goingDown ? "-down" : "-up");
          if (probeZone && TIPS[pz] && S.t - (tipSeen[key] || -99) > 12) {
            const t = TIPS[pz][goingDown ? "down" : "up"];
            if (t) {
              tipSeen[key] = S.t;
              showTip(t, goingDown);
            }
          }
          probeZone = pz;
        }
        lastSy = S.sy;
        tickTip(dt);
        tickMission();
        const here = zoneAt(S.sy + S.vh * 0.4);
        const headZone = toneAt(S.sy + S.headerH * 0.5);
        if (headZone !== lastTone) {
          lastTone = headZone;
          document.body.dataset.tone = headZone;
        }
        if (here.id !== lastHere) {
          lastHere = here.id;
          links.forEach(function (link) { link.classList.toggle("is-here", link.getAttribute("href") === "#" + here.id); });
        }
        if (S.t > 0.5) maybeHint(here.id);
        fireHint();
        if (!rail || !S.gauge) return;
        const depth = Math.round(depthAt(probe));
        if (depth !== lastDepth) {
          lastDepth = depth;
          num.textContent = depth.toLocaleString("en-US");
        }
        const pressure = Math.round(1 + depth / 10);
        if (pressure !== lastAtm && atm) {
          lastAtm = pressure;
          atm.textContent = "≈ " + pressure.toLocaleString("en-US") + " atm";
        }
        const zname = probe <= S.surfaceY ? "Surface" : zoneAt(probe).name;
        if (zname !== lastZone) {
          lastZone = zname;
          zoneEl.textContent = zname;
        }
        const range = Math.max(1, S.docH - S.vh);
        sub.style.transform = "translateY(" + Math.round(clamp(S.sy / range, 0, 1) * rail.offsetHeight) + "px)";
      }
    };
  })();

  (function setupVision() {
    const btn = document.getElementById("vision-toggle");
    function set(on) {
      S.vision = on;
      if (btn) btn.setAttribute("aria-pressed", on ? "true" : "false");
      document.body.classList.toggle("vision", on || S.visionPulse > 0);
    }
    if (btn) btn.addEventListener("click", function () { set(!S.vision); });
    document.addEventListener("keydown", function (event) {
      if (event.key !== "v" && event.key !== "V") return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const t = event.target;
      if (t && t.closest && t.closest("input, textarea, [contenteditable]")) return;
      set(!S.vision);
    });
  })();

  /* ---------- the diver-mask cursor and its bubble trail ---------- */

  const cursor = (function () {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const trailCanvas = document.getElementById("trail");
    const root = document.documentElement;
    if (!fine || !trailCanvas) return { tick: function () {}, release: function () {} };
    const tc = trailCanvas.getContext("2d");
    const trail = [];
    const darkOver = { k: "#cfe9e3" };
    let x = -80;
    let y = -80;
    let active = false;
    let hot = false;
    let tone = "";
    let nextBubble = 0;
    let moved = false;

    // Render the pixel mask into PNG cursor images: idle/hot × light/dark, at 1x and 2x.
    const setFn = ["image-set", "-webkit-image-set"].find(function (fn) {
      return window.CSS && CSS.supports("cursor", fn + '(url("data:,x") 1x) 1 1, auto');
    });
    function png(lines, over, scale) {
      const src = document.createElement("canvas");
      paint(src, lines, over);
      const c = document.createElement("canvas");
      c.width = src.width * scale;
      c.height = src.height * scale;
      const cx = c.getContext("2d");
      cx.imageSmoothingEnabled = false;
      cx.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/png");
    }
    function cursorValue(lines, over) {
      const hx = lines[0].length;
      const hy = lines.length;
      const one = 'url("' + png(lines, over, 2) + '")';
      if (!setFn) return one + " " + hx + " " + hy;
      return setFn + "(" + one + " 1x, url(\"" + png(lines, over, 4) + "\") 2x) " + hx + " " + hy;
    }
    const looks = {
      light: [cursorValue(PX.DIVER_MASK[0], null), cursorValue(PX.DIVER_MASK[1], null)],
      dark: [cursorValue(PX.DIVER_MASK[0], darkOver), cursorValue(PX.DIVER_MASK[1], darkOver)]
    };
    let wet = null;
    let skim = 0;
    // The streamlines are led by a point dragged through water behind the cursor:
    // a heavily damped spring, so the trace lags a little and eases in.
    let hx = null;
    let hy = 0;
    let hvx = 0;
    let hvy = 0;

    function setTone(next) {
      if (next === tone) return;
      tone = next;
      root.style.setProperty("--sea-cursor", looks[next][0]);
      root.style.setProperty("--sea-cursor-hot", looks[next][1]);
    }
    setTone("light");

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      trailCanvas.width = Math.max(1, Math.floor(S.vw * ratio));
      trailCanvas.height = Math.max(1, Math.floor(S.vh * ratio));
      tc.setTransform(ratio, 0, 0, ratio, 0, 0);
    }
    onLayout(resize);

    function track(event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      x = event.clientX;
      y = event.clientY;
      moved = true;
      if (!active) {
        active = true;
        root.classList.add("sea-cursor");
      }
    }

    function release() {
      active = false;
      if (S.chase) S.chase.active = false;
      hot = false;
      root.classList.remove("sea-cursor", "sea-hot");
    }

    window.addEventListener("pointermove", track, { passive: true });
    window.addEventListener("pointerdown", track, { passive: true });
    document.documentElement.addEventListener("mouseleave", release);

    return {
      release: release,
      tick: function (dt) {
        tc.clearRect(0, 0, S.vw, S.vh);
        if (!active) {
          trail.length = 0;
          return;
        }
        // Hover checks against canvas objects run once a frame, not on every mouse event.
        skim = Math.max(0, skim - dt);
        if (moved) {
          moved = false;
          const docY = y + S.sy;
          const line = level(x);
          const under = docY > line + 2;
          setTone(under ? toneAt(docY) : "light");
          // Crossing the waterline: mask on with a splash, mask off with a few drops.
          if (wet !== null && under !== wet && !S.reduced) {
            if (under) {
              splash(x, 10);
              bubbleBurst(x, line + 26, 4);
            } else {
              splash(x, 6);
            }
          }
          wet = under;
          // Skimming the surface makes the waves bob.
          if (!S.reduced && Math.abs(docY - line) < 22 && skim <= 0) {
            bump(x, 6, 46);
            skim = 0.09;
          }
          if (!S.reduced && under && toneAt(docY) === "dark") glowAround(x, docY, 70);
          const nowHot = overScene(x, y);
          if (nowHot !== hot) {
            hot = nowHot;
            root.classList.toggle("sea-hot", hot);
          }
        }
        if (!S.reduced) {
          const tx = x;
          const ty = y + S.sy;
          if (hx === null || Math.hypot(tx - hx, ty - hy) > 420) {
            hx = tx;
            hy = ty;
            hvx = 0;
            hvy = 0;
          }
          const stiff = 120;
          const drag = 19;
          hvx += (tx - hx) * stiff * dt;
          hvy += (ty - hy) * stiff * dt;
          const damp = Math.exp(-drag * dt);
          hvx *= damp;
          hvy *= damp;
          hx += hvx * dt;
          hy += hvy * dt;
          const headUnder = hy > level(hx) + 10;
          if (Math.hypot(hvx, hvy) > 6) flowPoint(hx, hy, headUnder);
          S.chase = { x: hx, y: hy, vx: hvx, vy: hvy, under: headUnder, active: true };
          nextBubble -= dt;
          if (nextBubble <= 0) {
            trail.push({ x: x + rand(-4, 4), y: y + 10, born: y + 10, r: 2.1, vx: rand(-5, 5), vy: -rand(32, 50), pop: 0 });
            nextBubble = hot ? 0.12 : 0.28;
          }
        }
        for (let i = trail.length - 1; i >= 0; i--) {
          const b = trail[i];
          const bd = toneAt(b.y + S.sy) === "dark";
          if (b.pop > 0) {
            b.pop += dt;
            const t = b.pop / 0.22;
            drawPixelBubble(tc, b.x, b.y, b.r * (1 + t * 0.8), Math.max(0, 1 - t), bd);
            if (t >= 1) trail.splice(i, 1);
            continue;
          }
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          const rise = b.born - b.y;
          b.r = 2.1 + rise * 0.055;
          if (rise > 150 || b.r > 14 || b.y < S.headerH + 6) {
            b.pop = 0.001;
            continue;
          }
          drawPixelBubble(tc, b.x, b.y, b.r, 1, bd);
        }
      }
    };
  })();

  /* ---------- the loop ---------- */

  const page = document.getElementById("page");
  if ("ResizeObserver" in window && page) {
    new ResizeObserver(function () { S.dirty = true; }).observe(page);
  }
  window.addEventListener("resize", function () { S.dirty = true; });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { S.dirty = true; });
  window.addEventListener("load", function () { S.dirty = true; });
  const portraitWrap = document.getElementById("portrait");
  if (portraitWrap) portraitWrap.addEventListener("animationend", function () { S.dirty = true; });

  measure();

  let last = performance.now();
  let rafId = 0;
  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!S.reduced) S.t += dt;
    S.sy = window.scrollY;
    P.x = P.cx;
    P.y = P.cy + S.sy;
    try {
      if (S.dirty) measure();
      S.visionPulse = Math.max(0, S.visionPulse - dt);
      document.body.classList.toggle("vision", S.vision || S.visionPulse > 0);
      day.tick(now);
      drawOcean(dt);
      photoBubbles.tick(dt);
      arcade.tick(dt, now);
      rainbow.tick(dt, now);
      critters.forEach(function (c) {
        updateCritter(c, dt);
        renderCritter(c, now);
      });
      tickLife(dt);
      if (chat.current && !S.narrow) chat.place();
      dwell(now);
      hud.tick(dt);
      cursor.tick(dt);
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
  window.addEventListener("pageshow", wake);
  wake();
})();
