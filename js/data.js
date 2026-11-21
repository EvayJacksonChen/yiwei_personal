/* Who lives on this page and what they know. The chat works offline from the answers
   here, and asks a free model first when one is reachable. */

(function () {
  "use strict";

  const D = (window.DIVE = window.DIVE || {});
  function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

  const FACTS = [
    "Yiwei Chen (陈奕玮), also called Jackson, is a third-year PhD candidate in the Department of Computer Science and Engineering at The Hong Kong University of Science and Technology (HKUST), Hong Kong SAR.",
    "He studies marine vision intelligence: computer vision for marine and biology research, including recognition and the boundary between 2D and 3D vision.",
    "He works closely with Prof. Ziqiang Zheng (UESTC) and is supervised by Prof. Sai-Kit Yeung.",
    "Education: PhD in CSE at HKUST, 2024–present; MSc in Information Technology at HKUST, 2023–2024; BEng in Telecommunications at Huazhong University of Science and Technology, 2019–2023. His undergraduate innovation program was with Prof. Xiaojun Hei, and his final-year project was with Prof. Xinggang Wang.",
    "Papers: MaskGuide (RA-L 2026); ORCA (WACV 2026, oral); MarineInst (ECCV 2024, oral, and an Oral Presentation Award); an arXiv 2024 case study on GPT-4V for marine analysis.",
    "Teaching assistant at HKUST for COMP 2211 Exploring Artificial Intelligence (Spring 2025 and Fall 2025) and MSBD 6000Q Vision Language Models for Vision Tasks (Fall 2025). Outstanding PG Teaching Assistant Honorable Mention, 2025–26.",
    "Recognized as a Top Reviewer at NeurIPS 2026.",
    "He built MarineChat (https://yiweichen.org/marinechat/), launched in October 2026: a public web app built on MarineInst and vision-language models. You drop in an underwater photo; it finds every creature, describes each one with MarineGPT or a 2026 vision-language model, and answers questions about it, for students learning marine science and for researchers who check and correct the AI.",
    "Visiting student at UESTC, Chengdu, August–November 2026.",
    "Public email: jackson.chen.yiwei@gmail.com and ychenmb@connect.ust.hk."
  ].join(" ");

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
    { re: /marinechat|marine chat|web ?app|demo|platform|projects?\b|项目|平台|演示/i,
      en: "Try MarineChat at yiweichen.org/marinechat: drop in an underwater photo and it finds every creature, describes each one and answers your questions. Yiwei built it on MarineInst and vision-language models.",
      zh: "去 yiweichen.org/marinechat 试试 MarineChat：上传一张水下照片，它会找出每一只生物、逐一描述，并回答你的问题。这是奕玮基于 MarineInst 和视觉语言模型做的平台。" },
    { re: /paper|publication|publish|maskguide|orca|marineinst|eccv|wacv|论文|发表/i,
      en: "His papers include MaskGuide (RA-L 2026), ORCA (WACV 2026, oral) and MarineInst (ECCV 2024, oral, with an Oral Presentation Award).",
      zh: "他的论文包括 MaskGuide（RA-L 2026）、ORCA（WACV 2026，口头报告）和 MarineInst（ECCV 2024，口头报告，并获口头报告奖）。" },
    { re: /supervis|advisor|adviser|professor|prof\b|yeung|zheng|导师|教授/i,
      en: "He is supervised by Prof. Sai-Kit Yeung at HKUST and works closely with Prof. Ziqiang Zheng of UESTC.",
      zh: "他的导师是港科大的 Sai-Kit Yeung 教授，并与电子科技大学的 Ziqiang Zheng 教授密切合作。" },
    { re: /email|e-mail|contact|reach|collaborat|邮箱|联系|合作/i,
      en: "You can write to him at jackson.chen.yiwei@gmail.com or ychenmb@connect.ust.hk.",
      zh: "可以写信给他：jackson.chen.yiwei@gmail.com 或 ychenmb@connect.ust.hk。" },
    { re: /award|honou?r|prize|reviewer|neurips|获奖|奖|荣誉|审稿/i,
      en: "He was recognized as a Top Reviewer at NeurIPS 2026, and received an Outstanding PG Teaching Assistant Honorable Mention at HKUST for 2025–26.",
      zh: "他获评 NeurIPS 2026 Top Reviewer（优秀审稿人），并获得港科大 2025–26 优秀研究生助教提名奖。" },
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
      en: "This is Yiwei Chen's page. He's a third-year PhD candidate in Computer Science and Engineering at HKUST, working on marine vision intelligence.",
      zh: "这是陈奕玮的主页。他是香港科技大学计算机科学与工程系的三年级博士候选人，研究海洋视觉智能。" }
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

  function cleanReply(text, name) {
    let out = String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
    out = out.replace(/^["“]|["”]$/g, "").trim();
    out = out.replace(new RegExp("^" + name + "\\s*[:：\\-]\\s*", "i"), "");
    out = out.replace(/\*\*?/g, "");
    if (out.length > 420) out = out.slice(0, 417).replace(/\s+\S*$/, "") + "…";
    return out.trim();
  }


  const cast = {};
  CAST.forEach(function (spec) { cast[spec.id] = spec; });

  D.data = {
    facts: FACTS,
    cast: cast,
    list: CAST,
    fallback: fallback,
    askModel: askModel,
    cleanReply: cleanReply,
    aboutChip: { en: "Who is Yiwei?", zh: "奕玮是谁？" }
  };
})();
