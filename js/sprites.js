/* =====================================================================
   sprites.js — Pixel-art sprites for "Chata: BUILD SUCCESSFUL"
   ---------------------------------------------------------------------
   Every sprite is hand-authored as a grid of characters. Each character
   maps to a color in the sprite's palette ('.' = transparent).
   Sprites are drawn as solid rectangles, so they are inherently crisp
   and pixelated — no external image files, everything lives in the repo.

   Designs are faithful to the reference art in assets/references/:
     - girl:    brown hair, navy hoodie, blue jeans, white sneakers
     - spidey:  red suit, black webbing, white eyes, blue lower body
     - bedetti: black symbiote suit, red spider + red eyes
     - cats:    "Azul" (siamese, blue eyes) and "Tigrao" (tabby + white)
   ===================================================================== */

(function (global) {
  'use strict';

  // Shared palette keys used across sprites.
  const PAL = {
    // outline / darks
    K: '#141118', // near-black outline
    // girl — hair & skin
    H: '#3c2a1c', h: '#5c3d24', F: '#dcaa7d', f: '#ba8659', e: '#2a1a12', P: '#b0696a',
    // girl — hoodie (navy, w/ zipper) & baggy light denim & white shoes
    N: '#20273c', n: '#151a2b', L: '#313c58', I: '#9aa2b4', D: '#b7cbe6', d: '#90a8cb', W: '#f2f2f2', w: '#cfcfcf',
    // spider red
    R: '#d33b34', r: '#9c2822', B: '#3f74c4', b: '#2b5390', X: '#ffffff',
    // bedetti black (symbiote): Q body, q shadow, v gloss, Z red, z dark red, S white eye
    Q: '#2a2732', q: '#131218', v: '#514e60', Z: '#e5342f', z: '#9c1f1c', S: '#f6f6f8',
    // cat azul (siamese)
    C: '#efe7db', c: '#cdbfae', T: '#5a4a3f', a: '#7fbce8', // T=dark points, a=blue eye
    // cat tigrao (tabby)
    G: '#8a5f3b', g: '#5c3d24', M: '#f3efe6', y: '#8fae4a', // y=green eye
    // fx / misc
    o: '#ffd34d', p: '#f7c1d8',
  };

  // Parse a sprite definition (array of equal-length strings) into a
  // renderable object. Width/height inferred from the grid.
  function make(rows, palette) {
    const h = rows.length;
    const w = rows[0].length;
    return { w, h, rows, palette: palette || PAL };
  }

  /* ---- draw a sprite at (x,y) top-left, scaled, optional horizontal flip ---- */
  function draw(ctx, sprite, x, y, scale, flip) {
    scale = scale || 1;
    const { w, h, rows, palette } = sprite;
    for (let ry = 0; ry < h; ry++) {
      const row = rows[ry];
      for (let rx = 0; rx < w; rx++) {
        const ch = row[rx];
        if (ch === '.' || ch === ' ') continue;
        const col = palette[ch];
        if (!col) continue;
        const dx = flip ? x + (w - 1 - rx) * scale : x + rx * scale;
        ctx.fillStyle = col;
        ctx.fillRect(Math.round(dx), Math.round(y + ry * scale), scale, scale);
      }
    }
  }

  /* =========================== THE GIRL (Isabelly) =======================
     16 wide x 26 tall. Long brown hair, navy zip-hoodie, baggy light
     jeans, white sneakers — faithful to assets/references/chata-girl-sheet.
     Shared head+torso (rows 0-19); legs (rows 20-25) swap for animation. */
  const girlBody = [
    '.....HHHHHH.....',
    '...HHHHHHHHHH...',
    '..HHHHHHHHHHHH..',
    '..HHhhhhhhhhHH..',
    '..HHFFFFFFFFHH..',
    '..HHFFFFFFFFHH..',
    '..HHFeFFFFeFHH..',
    '..HHFFFFFFFFHH..',
    '..HHFFFPPFFFHH..',
    '..HHHFFFFFFHHH..',
    '..HH.FFFFFF.HH..',
    '..HHNNNNNNNNHH..',
    '..HNNNNIINNNNH..',
    '.HHNNNNIINNNNHH.',
    '.HHNNNNIINNNNHH.',
    '.HHNNNNNNNNNNHH.',
    '..HNNNNNNNNNNH..',
    '..FNNNNNNNNNNF..',
    '..FNNNNNNNNNNF..',
    '...NNNNNNNNNN...',
  ];
  const legsIdle = [
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '..DDDDD..DDDDD..',
    '..dDDDd..dDDDd..',
    '..WWWWW..WWWWW..',
  ];
  const legsRunA = [
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '...DDDD..DDDD...',
    '..dDDd....dDDd..',
    '.WWWW......WWWW.',
  ];
  const legsRunB = [
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '..DDDD....DDDD..',
    '...dDDd..dDDd...',
    '...WWWW..WWWW...',
  ];
  const legsJump = [
    '..DDDDDDDDDDDD..',
    '..DDDDDDDDDDDD..',
    '.DDDD......DDDD.',
    'DDDD........DDDD',
    'dDd..........dDd',
    'WWW..........WWW',
  ];

  const girl = {
    idle: make(girlBody.concat(legsIdle)),
    run1: make(girlBody.concat(legsRunA)),
    run2: make(girlBody.concat(legsRunB)),
    jump: make(girlBody.concat(legsJump)),
  };

  // Surprised / cutscene girl (wide eyes, small open mouth) — reuse body.
  const girlBodySurprised = girlBody.slice();
  girlBodySurprised[8] = '..HHFFFeeFFFHH..'; // small open mouth
  const girlSurprised = make(girlBodySurprised.concat(legsIdle));

  /* ============================ SPIDER-MAN (red) =========================
     14 wide x 20 tall. Red suit, white eyes, blue lower body. */
  const spidey = make([
    '...KKKKKKKK...',
    '..KRRRRRRRRK..',
    '.KRRRRRRRRRRK.',
    '.KRXXRRRRXXRK.',
    '.KRXXRRRRXXRK.',
    '.KRRRRRRRRRRK.',
    '.KRRRrRRrRRRK.',
    '..KRRRRRRRRK..',
    '..KKRRRRRRKK..',
    '...RRRRRRRR...',
    '..RRRKRRKRRR..',
    '..RRKRXRKRRR..',
    '..RRRKRRKRRR..',
    '..RRRRRRRRRR..',
    '..BBBRRRRBBB..',
    '..BBBB..BBBB..',
    '..BBBB..BBBB..',
    '..bBBb..bBBb..',
    '..KKKK..KKKK..',
    '..KKK....KKK..',
  ]);
  const spidey2 = make([ // slight bounce frame (legs shift)
    '...KKKKKKKK...',
    '..KRRRRRRRRK..',
    '.KRRRRRRRRRRK.',
    '.KRXXRRRRXXRK.',
    '.KRXXRRRRXXRK.',
    '.KRRRRRRRRRRK.',
    '.KRRRrRRrRRRK.',
    '..KRRRRRRRRK..',
    '..KKRRRRRRKK..',
    '...RRRRRRRR...',
    '..RRRKRRKRRR..',
    '..RRKRXRKRRR..',
    '..RRRKRRKRRR..',
    '..RRRRRRRRRR..',
    '..BBBRRRRBBB..',
    '...BBBBBBBB...',
    '..BBBB..BBBB..',
    '..bBBb..bBBb..',
    '..KKK....KKK..',
    '..KK......KK..',
  ]);

  /* ============================== BEDETTI ================================
     Black symbiote Spider-Man — sleek glossy mask with big angular
     red-outlined white eyes and a red spider on the chest. 16w x 24h.
     Faithful to assets/references/bedetti-black-mask.jpeg. */
  const bedettiBody = [
    '....KKKKKKKK....',
    '..KKQQQQQQQQKK..',
    '.KQQvvQQQQvvQQK.',   // glossy sheen on the mask
    '.KQQQQQQQQQQQQK.',
    '.KQZZZQQQQZZZQK.',   // eyes — red outline (top)
    '.KZSSSZQQZSSSZK.',   // eyes — white, angular
    '.KZSSSZQQZSSSZK.',
    '.KQZZZQQQQZZZQK.',   // eyes — red outline (bottom)
    '.KQQQvQQQQvQQQK.',
    '..KQQQQQQQQQQK..',
    '..KKQQQQQQQQKK..',
    '...KQQQQQQQQK...',   // neck
    '..QQQQQZZQQQQQ..',   // chest spider — head
    '..QQQZZZZZZQQQ..',   // spider — body
    '..QZQZzZZzZQZQ..',   // spider — legs
    '..QQQZZZZZZQQQ..',
    '..QvQQQZZQQQvQ..',   // gloss + spider tail
    '..QQQQQQQQQQQQ..',
    '..QQQQQQQQQQQQ..',
  ];
  const bedetti = make(bedettiBody.concat([
    '..QQQQ....QQQQ..',
    '..QQQQ....QQQQ..',
    '..qQQq....qQQq..',
    '..KKKK....KKKK..',
    '..KKK......KKK..',
  ]));
  const bedetti2 = make(bedettiBody.concat([  // walking frame (legs shift)
    '...QQQQ..QQQQ...',
    '..QQQQ....QQQQ..',
    '.qQQq......qQQq.',
    '.KKK........KKK.',
    '.KK..........KK.',
  ]));

  /* =============================== CATS =================================
     Small, ~14 wide x 11 tall. Azul = siamese (cream + dark points,
     blue eyes). Tigrao = tabby (brown/white, green eyes). */
  const catAzul = make([
    '..T........T..',
    '.TcT......TcT.',
    '.TccTTTTTTccT.',
    '.TcCCCCCCCCcT.',
    '.TCCaCCCCaCCT.',
    '.TCCCCTTCCCCT.',
    '.TCCCCCCCCCCT.',
    '..CCCCCCCCCC..',
    '..CcCCCCCCcC..',
    '..CC.CCCC.CC..',
    '...T......T...',
  ]);
  const catAzul2 = make([ // tail-up / step frame
    '..T........T..',
    '.TcT......TcTT',
    '.TccTTTTTTccTc',
    '.TcCCCCCCCCcTc',
    '.TCCaCCCCaCCT.',
    '.TCCCCTTCCCCT.',
    '.TCCCCCCCCCCT.',
    '..CCCCCCCCCC..',
    '..CcCCCCCCcC..',
    '..CC.CCCC.CC..',
    '..T........T..',
  ]);
  const catTigrao = make([
    '..g........g..',
    '.gGg......gGg.',
    '.gGgggggggGGg.',
    '.gGMGgMMgGMGg.',
    '.gMMyMMMMyMMg.',
    '.gMGMMggMMGMg.',
    '.gMMMMMMMMMMg.',
    '..GMMMMMMMMG..',
    '..GgMMMMMMgG..',
    '..GG.MMMM.GG..',
    '...g......g...',
  ]);

  /* ============================ FX / ITEMS ============================== */
  // "Bug" enemy — little glitch critter (green with red eyes).
  const bug = make([
    '..y......y..',
    '.yyKyyyyKyy.',
    'yyyyyyyyyyyy',
    'yZyyyyyyyyZy',
    'yyyyyyyyyyyy',
    'yyKyyyyyyKyy',
    '.yyyyyyyyyy.',
    '.y.y.yy.y.y.',
  ], PAL);

  // Heart for HUD (health).
  const heart = make([
    '.RR.RR.',
    'RRRRRRR',
    'RRRRRRR',
    '.RRRRR.',
    '..RRR..',
    '...R...',
  ], PAL);

  // Goal flag pole ("git push" banner drawn separately as text).
  const flag = make([
    'K......',
    'KRRRRR.',
    'KRRRRRR',
    'KRRRRR.',
    'K......',
    'K......',
    'K......',
    'K......',
    'K......',
    'K......',
    'K......',
    'K......',
  ], PAL);

  global.SPR = {
    PAL: PAL,
    draw: draw,
    make: make,
    girl: girl,
    girlSurprised: girlSurprised,
    spidey: spidey,
    spidey2: spidey2,
    bedetti: bedetti,
    bedetti2: bedetti2,
    catAzul: catAzul,
    catAzul2: catAzul2,
    catTigrao: catTigrao,
    bug: bug,
    heart: heart,
    flag: flag,
  };
})(window);
