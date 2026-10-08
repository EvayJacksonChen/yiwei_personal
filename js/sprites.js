/* Pixel art for the v3 dive. Every sprite faces right; rows are padded to the widest row. */
(function (root) {
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
    c: "#d9896a",
    o: "#f2c94c",
    r: "#e07b86",
    u: "#6aaed4",
    B: "#22345c",
    b: "#3d5f96",
    l: "#a9c4e4",
    x: "#e8743b",
    X: "#a8441c",
    z: "#252a38",
    Z: "#55607e",
    h: "#e3b08a",
    a: "#c3cad1",
    A: "#6c757d",
    e: "#6ff5df",
    f: "#ffd27a",
    v: "#8c6cc0",
    i: "#d9c8f2",
    m: "#b84f5f",
    C: "#e6ebe9",
    D: "#c9d3d3"
  };

  function grid(lines) {
    const w = Math.max.apply(null, lines.map(function (line) { return line.length; }));
    return lines.map(function (line) {
      for (let x = 0; x < line.length; x++) {
        if (!Object.prototype.hasOwnProperty.call(PAL, line[x])) {
          throw new Error("unknown pixel '" + line[x] + "' in [" + line + "]");
        }
      }
      return line + ".".repeat(w - line.length);
    });
  }

  // Copy a sprite and move the pixels in columns x0..x1 by dy rows (for tails and fins).
  function shift(lines, x0, x1, dy) {
    const h = lines.length;
    const out = lines.map(function (line) { return line.split(""); });
    for (let x = x0; x <= x1; x++) {
      for (let y = 0; y < h; y++) out[y][x] = ".";
      for (let y = 0; y < h; y++) {
        const to = y + dy;
        if (to >= 0 && to < h) out[to][x] = lines[y][x];
      }
    }
    return out.map(function (row) { return row.join(""); });
  }

  function swap(lines, map) {
    return lines.map(function (line) {
      return line.replace(/./g, function (ch) { return map[ch] || ch; });
    });
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

  const MINNOW = [
    grid([
      "........",
      ".sssss..",
      "ssgnwss.",
      ".ssss...",
      "..s..s.."
    ]),
    grid([
      "........",
      "sssss...",
      "ssgnwss.",
      ".ssss...",
      "...s..s."
    ])
  ];

  const WEED = [
    grid([
      "...ss...",
      "...gg...",
      "..sggs..",
      "..ssss..",
      ".ss..ss.",
      ".gs..sg.",
      "ss....ss",
      "s......s",
      "s......s",
      "ss....s.",
      ".s....s.",
      ".ss..s..",
      "..s..s..",
      "..ss.s..",
      "...s....",
      "........"
    ]),
    grid([
      "....ss..",
      "....gg..",
      "...sggs.",
      "..ssss..",
      ".ss..ss.",
      "gs...sg.",
      "s.....ss",
      "s......s",
      "ss.....s",
      ".s....ss",
      ".ss...s.",
      "..s..ss.",
      "..s.s...",
      "..ss....",
      "...s....",
      "........"
    ])
  ];

  const CORAL = grid([
    "....cc......",
    "..cccccc....",
    ".cccyyccc...",
    ".ccyyyycc...",
    "cccyyyyccc..",
    ".cccyyycc...",
    "..cckkcc....",
    "..cccccc....",
    "...cccc.....",
    "....cc......",
    "............"
  ]);

  const REEF = grid([
    "......cccc......",
    "...cccyyyycc....",
    "..ccyyyyyyyycc..",
    ".cccyyyyyyyccc..",
    "..cckkkkkkkkcc..",
    "...cccccccccc...",
    ".....cccccc.....",
    "................"
  ]);

  const TUFT = [
    grid([
      "...ss...",
      "..sggs..",
      ".ssssss.",
      "ss.ss.ss",
      "s..ss..s",
      "s......s",
      ".s....s.",
      "..s..s..",
      "..ssss..",
      "...ss...",
      "........",
      "........"
    ]),
    grid([
      "....ss..",
      "...sggs.",
      "..ssssss",
      ".ss.ss.s",
      "s...ss.s",
      "s......s",
      ".s....ss",
      "..s..s..",
      "...sss..",
      "...ss...",
      "........",
      "........"
    ])
  ];

  const BUD = grid([
    "..cc....",
    ".ccyc...",
    "ccyycc..",
    ".ckkcc..",
    "..cccc..",
    "...cc...",
    "........",
    "........"
  ]);

  const KELP = [
    grid([
      "....ss....ss....",
      "...sggs..sggs...",
      "..ss..ssss..ss..",
      "..s....ss....s..",
      ".ss....ss....ss.",
      ".s.....ss.....s.",
      "ss.....ss.....ss",
      "s......ss......s",
      "s......ss......s",
      ".s.....ss.....s.",
      ".ss....ss....ss.",
      "..s....ss....s..",
      "..ss...ss...ss..",
      "...ss..ss..ss...",
      "....ss.ss.ss....",
      "......ssss......"
    ]),
    grid([
      ".....ss....ss...",
      "....sggs..sggs..",
      "...ss..ssss..ss.",
      "...s....ss....s.",
      "..ss....ss....ss",
      "..s.....ss.....s",
      "ss.....ss.....ss",
      "s......ss......s",
      "s......ss......s",
      "..s.....ss.....s",
      "..ss....ss....ss",
      "...s....ss....s.",
      "...ss...ss...ss.",
      "....ss..ss..ss..",
      ".....ss.ss.ss...",
      ".......ssss....."
    ])
  ];

  const FAN = grid([
    "..cc......cc..",
    ".cccc....cccc.",
    "cccyyc..cyyccc",
    ".ccyyyyyyyycc.",
    ".cccyyyyyyycc.",
    "..cccyyyyccc..",
    "...cccyyccc...",
    "....cckkcc....",
    ".....cccc.....",
    "......cc......",
    "..............",
    ".............."
  ]);

  const ROCK = grid([
    "...kkkkkkkkkk...",
    "..kyyyyyyyyyyk..",
    ".kyyyyyyyyyyyyk.",
    ".kkkkkkkkkkkkkk.",
    "..dddddddddddd..",
    "...dddddddddd..."
  ]);

  const PAC_SHUT = grid([
    "..ooo..",
    ".ooooo.",
    "ooooooo",
    "ooooooo",
    "ooooooo",
    ".ooooo.",
    "..ooo.."
  ]);

  const PAC_OPEN = {
    e: grid([
      "..ooo..",
      ".oooo..",
      "ooo....",
      "oo.....",
      "ooo....",
      ".oooo..",
      "..ooo.."
    ]),
    w: grid([
      "..ooo..",
      "..oooo.",
      "....ooo",
      ".....oo",
      "....ooo",
      "..oooo.",
      "..ooo.."
    ]),
    s: grid([
      "..ooo..",
      ".ooooo.",
      "ooooooo",
      "ooooooo",
      "ooo.ooo",
      ".oo.oo.",
      "..o.o.."
    ]),
    n: grid([
      "..o.o..",
      ".oo.oo.",
      "ooo.ooo",
      "ooooooo",
      "ooooooo",
      ".ooooo.",
      "..ooo.."
    ])
  };

  const GHOSTS = [
    grid([
      "..rrrr.",
      ".rrrrrr",
      "rrwwrrw",
      "rrnnrrn",
      "rrrrrrr",
      "rrrrrrr",
      "rrrrrrr",
      "r.r.r.r"
    ]),
    grid([
      "..uuuu.",
      ".uuuuuu",
      "uuwwuuw",
      "uunnuun",
      "uuuuuuu",
      "uuuuuuu",
      "uuuuuuu",
      "u.u.u.u"
    ])
  ];

  const DIVER_A = grid([
    "..............................",
    "............xxxxxxx...........",
    "...........xwwxxxxxx..........",
    "...........XxxxxxxxX...zzzz...",
    "uu.....zzzzzzzzzzzzzzzzzzggwz.",
    "uuu..zzzzzzzzzzzzzzzzzzzggwgz.",
    ".uuzzzzzz...zzzzzzzzzzzzzhhhz.",
    "uuu..zzz......zzzzzzzzzzzzzz..",
    "uu.............zzzz...zzhh....",
    "......................hAAAAA..",
    "......................AnnwAA..",
    "......................AAAAAA.."
  ]);
  SPRITES.diver = [
    DIVER_A,
    grid([
      "..............................",
      "............xxxxxxx...........",
      "uu.........xwwxxxxxx..........",
      "uuu........XxxxxxxxX...zzzz...",
      ".uu....zzzzzzzzzzzzzzzzzzggwz.",
      ".....zzzzzzzzzzzzzzzzzzzggwgz.",
      "...zzzzzz...zzzzzzzzzzzzzhhhz.",
      ".....zzz......zzzzzzzzzzzzzz..",
      "uuu............zzzz...zzhh....",
      "uu....................hAAAAA..",
      "......................AnnwAA..",
      "......................AAAAAA.."
    ])
  ];

  const WHALE_A = grid([
    "...................BBBBBBB..............",
    "...................BuuBuuB..............",
    "................BBBBBBBBBBBBB...........",
    "................BuuBuuBuuBuuB...........",
    "...........BBBBBBBBBBBBBBBBBBBBBBBBB....",
    "BBB......BBbbbbbbbbbbbbbbbbbbbbbbbbbB...",
    "BbbB...BBbbbbbbbbbbbbbbbbbbbbbbbbbbbbB..",
    ".BbbB.BbbbbbbbbbbbbbbbbbbbbbbbbbwnbbbB..",
    "..BbbBbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB.",
    "...BbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbB.",
    "..BbbBbllllllllllllllllllllllllllllbbbB.",
    ".BbbB.BBllllbllllbllllbllllbllllllbbB...",
    "BbbB...BBBllllllllllllllllllllllBB......",
    "BBB.......BBBBBBBBBBBBBBBBBBBBBB........",
    "....................BBb.................",
    ".....................BB................."
  ]);
  SPRITES.whale = [WHALE_A, shift(WHALE_A, 0, 5, -1)];

  SPRITES.squid = [
    grid([
      "....................ii....",
      "..............vvvvvvvvii..",
      "....v..vvvvvvvvvvvvvvvvvv.",
      ".vvv.vvvvvwnvvvvvvvvvvvvvv",
      "vv.vvvvvvvvviiiiiiiiivvvvv",
      ".vvv.vvvvvvvvvvvvvvvvvvvv.",
      "....v..vvvvvvvvvvvvvvvvv..",
      "..............vvvvvvvvii..",
      "....................ii...."
    ]),
    grid([
      "....................ii....",
      "..............vvvvvvvvii..",
      "..vv...vvvvvvvvvvvvvvvvvv.",
      "vv..vvvvvvwnvvvvvvvvvvvvvv",
      "...vvvvvvvvviiiiiiiiivvvvv",
      "vv..vvvvvvvvvvvvvvvvvvvvv.",
      "..vv...vvvvvvvvvvvvvvvvv..",
      "..............vvvvvvvvii..",
      "....................ii...."
    ])
  ];

  const ANGLER_BODY = [
    "....zzZZZZZZZzz.........",
    "..zzZZZZZZZZwnZzz.......",
    "zzZZZZZZZZZZZZZZZz......",
    "zZZZZZZZZZZZZZwzwzz.....",
    ".zzZZZZZZZZZZz....z.....",
    "zZZZZZZZZZZZZZwzwzz.....",
    "zzZZZZZZZZZZZZZZz.......",
    "..zzZZZZZZZZZZzz........",
    "....zzzzzzzzzz.........."
  ];
  SPRITES.angler = [
    grid([
      "..........AAAAAAA.......",
      ".........A.......A......",
      ".........A........ff....",
      "......zzzAzzz.....ff...."
    ].concat(ANGLER_BODY)),
    grid([
      "..........AAAAAAAA......",
      ".........A........A.....",
      ".........A.........ff...",
      "......zzzAzzz......ff..."
    ].concat(ANGLER_BODY))
  ];

  const EEL_A = grid([
    "..........................zzzz....",
    ".........................zZZZZzz..",
    "e.......................zZZZwnZZz.",
    ".ee.zzzzzzzzzzzzzzzzzzzzZZZZZZZZz.",
    "...eZZZZZZZZZZZZZZZZZZZZZZz....zz.",
    "....zzzzzzzzzzzzzzzzzzzzzZZZZZz...",
    "........................zzzzzz...."
  ]);
  SPRITES.eel = [EEL_A, shift(shift(EEL_A, 0, 4, 1), 9, 14, -1)];

  SPRITES.octo = [
    grid([
      "......cccccccc......",
      "....cccccccccccc....",
      "...cccccccccccccc...",
      "rr.cccccccccccccc.rr",
      "rrrccwnccccccwnccrrr",
      ".rrccnnccccccnnccrr.",
      "..ccccccmmmmcccccc..",
      "..cccccccccccccccc..",
      "...cccccccccccccc...",
      "..cmcmcmcmcmcmcmcm..",
      ".cc.cc..cc..cc.cc...",
      ".c...c...c...c...c.."
    ]),
    grid([
      "......cccccccc......",
      "r...cccccccccccc...r",
      "rr.cccccccccccccc.rr",
      ".rrcccccccccccccccr.",
      "..cccwnccccccwnccc..",
      "..cccnnccccccnnccc..",
      "..ccccccmmmmcccccc..",
      "..cccccccccccccccc..",
      "...cccccccccccccc...",
      "..cmcmcmcmcmcmcmcm..",
      "..cc.cc..cc..cc.cc..",
      "...c...c...c...c...c"
    ])
  ];

  SPRITES.crab = [
    grid([
      ".....n..........n.....",
      ".....X..........X.....",
      ".xx..XxxxxxxxxxxX..xx.",
      "x..x.xxxxxxxxxxxx.x..x",
      "xxxx.xxwnxxxxwnxx.xxxx",
      ".xx.xxxxxXXXXxxxxx.xx.",
      "...xxxxxxxxxxxxxxxx...",
      "....xxxxxxxxxxxxxx....",
      "...X.X.X......X.X.X...",
      "..X.X.X........X.X.X.."
    ]),
    grid([
      ".....n..........n.....",
      "xx...X..........X...xx",
      "x.x..XxxxxxxxxxxX..x.x",
      ".x.x.xxxxxxxxxxxx.x.x.",
      "xxxx.xxwnxxxxwnxx.xxxx",
      ".xx.xxxxxXXXXxxxxx.xx.",
      "...xxxxxxxxxxxxxxxx...",
      "....xxxxxxxxxxxxxx....",
      "..X.X.X......X.X.X....",
      "...X.X.X......X.X.X..."
    ])
  ];

  const ROV_A = grid([
    "....kkkkkkkkkkkkkkkkkk......",
    "....koooooooooooooooook.....",
    "....kokkkkkkkkkkkkkkok......",
    "..kkkokAAAAAAAAAAAAkokkk....",
    ".kxxxokAaaaaaaaaaaAkokwwk...",
    ".kxxxokAaaaaaaaaaaAkokunnk..",
    ".kxxxokAaaaaaaaaaaAkokwwk...",
    "..kkkokAAAAAAAAAAAAkokkk....",
    "....kokkkkkkkkkkkkkkok......",
    "....koooooooooooooooook.....",
    "....kkkkkkkkkkkkkkkkkk......",
    ".....kk..........kk.........",
    "....kkkk........kkkk........"
  ]);
  SPRITES.rov = [ROV_A, swap(ROV_A, { x: "f", w: "f" })];

  SPRITES.gull = [
    grid([
      "....................",
      "..A...........A.....",
      "...AA.......AA......",
      "....aaa...aaa.......",
      ".....aawwwaa...ww...",
      ".AA.wwwwwwwwwwwnwoo.",
      "..AAwwwwwwwwwwww....",
      "......wwwwwww.......",
      "....................",
      "...................."
    ]),
    grid([
      "....................",
      "....................",
      "....................",
      "...............ww...",
      "....wwwwwwwwwwwwnwoo",
      ".AA.wwwwwwwwwwww....",
      "..AAaaawwwwaaa......",
      "....aaa....aaa......",
      "...aa........aa.....",
      "..A............A...."
    ])
  ];

  SPRITES.surfer = SURFER;

  const LANTERN = [
    grid([
      "...zzzz...",
      "zzZZZZwnz.",
      ".zZeZeZZZz",
      "zz.zzzzz.."
    ]),
    grid([
      "...zzzz...",
      ".zZZZZwnz.",
      "zzZeZeZZZz",
      ".z.zzzzz.."
    ])
  ];

  const CLOUDS = [
    grid([
      "...........DDDD.............",
      "........DDDwwwwDD...........",
      "......DDwwwwwwwwwD..DDDD....",
      "....DDwwwwwwwwwwwwDDwwwwD...",
      "..DDwwwwwwwwwwwwwwwwwwwwwDD.",
      ".DwwwwwwwwwwwwwwwwwwwwwwwwwD",
      "DwwwwwwwwwwwwwwwwwwwwwwwwwwD",
      "DCCCCCCCCCCCCCCCCCCCCCCCCCCD",
      ".DDDDDDDDDDDDDDDDDDDDDDDDDD."
    ]),
    grid([
      "......DDDD........",
      "....DDwwwwDDDD....",
      "..DDwwwwwwwwwwD...",
      ".DwwwwwwwwwwwwwDD.",
      "DwwwwwwwwwwwwwwwwD",
      "DCCCCCCCCCCCCCCCCD",
      ".DDDDDDDDDDDDDDDD."
    ])
  ];

  const STAR = grid([
    "....x....",
    "....x....",
    "...xxx...",
    "xxxxXxxxx",
    ".xxXXXxx.",
    "..xxXxx..",
    "..xx.xx..",
    ".xx...xx.",
    "xx.....xx"
  ]);

  const WORM = [
    grid([
      "m.m.m",
      ".mmm.",
      "mmmmm",
      ".ppp.",
      ".pap.",
      ".ppp.",
      ".pap.",
      ".ppp.",
      ".pap.",
      ".ppp."
    ]),
    grid([
      ".....",
      ".....",
      ".....",
      ".mmm.",
      ".pap.",
      ".ppp.",
      ".pap.",
      ".ppp.",
      ".pap.",
      ".ppp."
    ])
  ];

  const VENT = grid([
    "...zzzz...",
    "..zZAAZz..",
    "..zAzzAz..",
    "..zZAAZz..",
    ".zZZAAZZz.",
    ".zZAAAAZz.",
    "zZZAAAAZZz",
    "zZAAAAAAZz",
    "zzzzzzzzzz"
  ]);

  // Deep-sea benthos: nothing here needs sunlight.
  const BUBBLEGUM = grid([
    "..w....w.....w.",
    ".mrm..mrm...mrm",
    "..r....r.....r.",
    "..rr..rr....rr.",
    "...r..r....rr..",
    "...rr.r...rr...",
    "....rrr..rr....",
    ".w...rr.rr..w..",
    "mrm...rrr..mrm.",
    ".r....rr....r..",
    ".rr...rr...rr..",
    "..rrr.rr.rrr...",
    "....rrrrrr.....",
    ".....rrrr......",
    "......AA......."
  ]);

  const BAMBOO = grid([
    "p.....p.....p",
    "p.....A.....p",
    "A....p.p....A",
    ".p..p...p..p.",
    ".A..A...A..A.",
    "..p.p...p.p..",
    "..pp.....pp..",
    "...A.....A...",
    "....p...p....",
    "....pp.pp....",
    ".....A.A.....",
    "......p......",
    "......p......",
    "......A......",
    "......p......",
    "......p......",
    "......A......",
    ".....AAA....."
  ]);

  const SEAPEN = grid([
    "...x...",
    "..xfx..",
    ".xxfxx.",
    "xx.f.xx",
    ".xxfxx.",
    "xx.f.xx",
    ".xxfxx.",
    "xx.f.xx",
    ".xxfxx.",
    "..xfx..",
    "...X...",
    "...X...",
    "...X...",
    "..XXX.."
  ]);

  const SPONGE = grid([
    "..iiiii..",
    ".i.i.i.i.",
    ".iiiiiii.",
    ".i.i.i.i.",
    "i.i.i.i.i",
    "iiiiiiiii",
    "i.i.i.i.i",
    ".iiiiiii.",
    ".i.i.i.i.",
    ".iiiiiii.",
    "..i.i.i..",
    "..iiiii..",
    "...i.i...",
    "...iii...",
    "....i....",
    "...aaa..."
  ]);

  const CRINOID_STALK = [
    "......A......",
    "......A......",
    ".....A.......",
    ".....A.......",
    "......A......",
    "......A......",
    ".......A.....",
    "......A......",
    "......A......",
    ".....AAA....."
  ];
  const CRINOID = [
    grid([
      "y.....o.....y",
      ".y...o.o...y.",
      "..y.o...o.y..",
      "y..yo...oy..y",
      ".y..yy.yy..y.",
      "..yy.yyy.yy..",
      "....yyoyy....",
      ".....yoy....."
    ].concat(CRINOID_STALK)),
    grid([
      ".............",
      ".............",
      "...y.o.o.y...",
      "..y.yo.oy.y..",
      "...y.yoy.y...",
      "....yyyyy....",
      "....yyoyy....",
      ".....yoy....."
    ].concat(CRINOID_STALK))
  ];

  // Seagrass belongs in the shallows: it needs sunlight.
  const SEAGRASS = [
    grid([
      "..g.......",
      "..g....g..",
      ".gs....g..",
      ".gs...gs..",
      ".gs...gs.g",
      "gs...gs..g",
      "gs...gs.gs",
      "gs..gs..gs",
      "gs..gs.gs.",
      ".gs.gs.gs.",
      ".gs.gs.gs.",
      "..gsgsgs..",
      "..gsgsgs..",
      "...gsgs...",
      "...gsgs...",
      "....ss...."
    ]),
    grid([
      "...g......",
      "...g...g..",
      "..gs...g..",
      "..gs..gs..",
      ".gs...gs.g",
      ".gs..gs..g",
      "gs...gs.gs",
      "gs..gs..gs",
      "gs..gs.gs.",
      ".gs.gs.gs.",
      ".gs.gs.gs.",
      "..gsgsgs..",
      "..gsgsgs..",
      "...gsgs...",
      "...gsgs...",
      "....ss...."
    ])
  ];

  const SHARK_A = grid([
    "..................kk................",
    ".................kZZk...............",
    "................kZZZk...............",
    "kk.............kZZZZk...............",
    "kZk.......kkkkkZZZZZZkkkkkkk........",
    ".kZk...kkkZZZZZZZZZZZZZZZZZZZkkk....",
    ".kZZkkkZZZZZZZZZZZZZZZZZZZZZZZZZkk..",
    "..kZZZZZZZZZZZZZZZZZZZZZZZZZZZnwZZk.",
    "...kZZZZZZZaaaaaaaaaaaaaaaaaaaaZZZZk",
    "..kZZZkkaaaaaaaaaaaaaaaaaaaaaawkkk..",
    ".kZZk...kkaaaakkZZkkaaaaakkkkk......",
    ".kzk.......kZZk....kZZk.............",
    "..k........kzk.....kzk..............",
    "............k.......k..............."
  ]);
  SPRITES.shark = [SHARK_A, shift(SHARK_A, 0, 5, -1)];
  const SHARK_CHOMP = grid([
    "..................kk................",
    ".................kZZk...............",
    "................kZZZk...............",
    "kk.............kZZZZk...............",
    "kZk.......kkkkkZZZZZZkkkkkkk........",
    ".kZk...kkkZZZZZZZZZZZZZZZZZZZkkk....",
    ".kZZkkkZZZZZZZZZZZZZZZZZZZZZZZZZkk..",
    "..kZZZZZZZZZZZZZZZZZZZZZZZZZZZnwZZk.",
    "...kZZZZZZZaaaaaaaaaaaaaaaaaakwkwkk.",
    "..kZZZkkaaaaaaaaaaaaaaaaaaak........",
    ".kZZk...kkaaaakkZZkkaaaaakkwkwk.....",
    ".kzk.......kZZk....kZZk.............",
    "..k........kzk.....kzk..............",
    "............k.......k..............."
  ]);

  root.PX = {
    PAL: PAL,
    grid: grid,
    SPRITES: SPRITES,
    DAY_MARKS: DAY_MARKS,
    SEA_LIFE: SEA_LIFE,
    SURFER: SURFER,
    DIVER_MASK: DIVER_MASK,
    MINNOW: MINNOW,
    LANTERN: LANTERN,
    WEED: WEED,
    CORAL: CORAL,
    REEF: REEF,
    TUFT: TUFT,
    BUD: BUD,
    KELP: KELP,
    FAN: FAN,
    ROCK: ROCK,
    PAC_SHUT: PAC_SHUT,
    PAC_OPEN: PAC_OPEN,
    GHOSTS: GHOSTS,
    CLOUDS: CLOUDS,
    STAR: STAR,
    WORM: WORM,
    VENT: VENT,
    BUBBLEGUM: BUBBLEGUM,
    BAMBOO: BAMBOO,
    SEAPEN: SEAPEN,
    SPONGE: SPONGE,
    CRINOID: CRINOID,
    SEAGRASS: SEAGRASS,
    SHARK_CHOMP: SHARK_CHOMP
  };
})(typeof window !== "undefined" ? window : globalThis);
