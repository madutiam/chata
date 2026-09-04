/* =====================================================================
   game.js — "Chata: BUILD SUCCESSFUL"
   A short, finite pixel-art platformer. Pure vanilla JS + Canvas.
   No audio, no external libraries, no CDNs — everything is in the repo.

   Flow:  TITLE -> PLAYING -> (GAME OVER -> restart) | (reach goal ->
          CUTSCENE -> BUILD SUCCESSFUL / play again)
   ===================================================================== */

(function () {
  'use strict';

  // ------------------------------------------------------------------ view
  const VW = 480, VH = 270;        // internal resolution (16:9)
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  canvas.width = VW;
  canvas.height = VH;
  ctx.imageSmoothingEnabled = false;

  // ending cinematic video element (plays after the dialogue)
  const endVideo = document.getElementById('ending-video');

  // Real pixel-art sprite of Isabelly, extracted from the reference sheet
  // (assets/references/chata-girl-sheet.jpeg) -> assets/isabelly.png.
  // Falls back to the code-drawn sprite until the image has loaded.
  const isaImg = new Image();
  let isaReady = false;
  isaImg.onload = function () { isaReady = true; };
  isaImg.src = 'assets/isabelly.png';
  const ISA_W = 16, ISA_H = 36;

  // Bedetti — real walk-cycle sprites (3 frames, native facing LEFT),
  // extracted from the reference sheet. She is the black-outfit girl.
  const bedFrames = [];
  let bedReady = 0;
  ['assets/bedetti_walk1.png', 'assets/bedetti_walk2.png', 'assets/bedetti_walk3.png'].forEach(function (src, i) {
    const im = new Image();
    im.onload = function () { bedFrames[i] = { img: im, w: im.naturalWidth, h: im.naturalHeight }; bedReady++; };
    im.src = src;
  });
  const bedOK = function () { return bedReady >= 3; };
  const BED_SEQ = [0, 1, 2, 1];   // walk-cycle order

  // High-detail face portraits for the cutscene (visual-novel style).
  const isaFace = new Image(); let isaFaceReady = false;
  isaFace.onload = function () { isaFaceReady = true; }; isaFace.src = 'assets/isabelly_face.png';
  const bedFace = new Image(); let bedFaceReady = false;
  bedFace.onload = function () { bedFaceReady = true; }; bedFace.src = 'assets/bedetti_face.png';

  // draw one Bedetti frame, feet-anchored. Frames face LEFT natively, so
  // facingRight flips them.
  function drawBed(feetX, feetY, scale, facingRight, seqIdx) {
    const fr = bedFrames[BED_SEQ[seqIdx % BED_SEQ.length]];
    if (!fr) return;
    const dw = fr.w * scale, dh = fr.h * scale;
    const x = Math.round(feetX - dw / 2), y = Math.round(feetY - dh);
    if (facingRight) {
      ctx.save();
      ctx.translate(x + dw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(fr.img, 0, y, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(fr.img, x, y, dw, dh);
    }
  }

  // draw an image feet-anchored at (feetX,feetY), integer-scaled & optionally flipped
  function drawImgFeet(img, w, h, feetX, feetY, scale, flip, dy) {
    const dw = w * scale, dh = h * scale;
    const x = Math.round(feetX - dw / 2);
    const y = Math.round(feetY - dh + (dy || 0));
    if (flip) {
      ctx.save();
      ctx.translate(x + dw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, y, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, dw, dh);
    }
  }

  // ------------------------------------------------------------------ world constants
  const GROUND_TOP = 214;          // y of the top of the base ground
  const GRAVITY = 0.62;            // rising gravity
  const FALL_GRAVITY = 0.9;        // stronger while falling -> less "floaty"
  const WALK = 1.7;
  const RUN = 3.2;
  const JUMP_V = -9.0;
  const MAX_FALL = 13;
  const ACCEL = 0.9;               // snappier acceleration
  const FRICTION = 0.5;            // stronger stop -> less sliding
  const SPRING_V = -13.6;          // launch from a spring pad (reaches ~150px)

  // ------------------------------------------------------------------ input
  const keys = {};
  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'jump', KeyW: 'jump', Space: 'jump',
    ShiftLeft: 'run', ShiftRight: 'run',
  };
  window.addEventListener('keydown', function (e) {
    const a = KEYMAP[e.code];
    if (a) { keys[a] = true; if (a === 'jump') e.preventDefault(); }
    if (e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', function (e) {
    const a = KEYMAP[e.code];
    if (a) keys[a] = false;
  });
  // touch buttons (basic small-screen support)
  function bindTouch(id, action) {
    const el = document.getElementById(id);
    if (!el) return;
    const set = function (v) { return function (ev) { ev.preventDefault(); keys[action] = v; }; };
    el.addEventListener('touchstart', set(true), { passive: false });
    el.addEventListener('touchend', set(false), { passive: false });
    el.addEventListener('touchcancel', set(false), { passive: false });
    el.addEventListener('mousedown', set(true));
    el.addEventListener('mouseup', set(false));
    el.addEventListener('mouseleave', set(false));
  }
  bindTouch('btn-left', 'left');
  bindTouch('btn-right', 'right');
  bindTouch('btn-jump', 'jump');

  // ------------------------------------------------------------------ text helper
  function text(str, x, y, size, color, align, shadow) {
    ctx.font = size + 'px "Courier New", monospace';
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'top';
    if (shadow !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillText(str, x + 1, y + 1);
    }
    ctx.fillStyle = color;
    ctx.fillText(str, x, y);
  }

  function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ================================================================== LEVEL
  // Programming-joke labels sprinkled in the scenery (pure decoration).
  const CODE_JOKES = [
    '404', 'undefined', 'null', 'NaN', '// TODO: fix later', 'git push --force',
    'npm install', 'console.log("oi")', 'merge conflict', 'segmentation fault',
    '{ }', ';;;', '<div>', 'sudo rm -rf', 'it works on my machine',
    'Cannot read properties of undefined', 'stack overflow', 'rebase -i',
  ];

  function buildLevel() {
    const platforms = [];   // solid rectangles {x,y,w,h}
    const enemies = [];     // {type,x,y,w,h,vx,min,max,dead,frame}
    const cats = [];        // {kind,x,y,w,h,got}
    const coins = [];       // {x,y,got,phase}
    const decos = [];       // {text,x,y,size,color}
    const hazards = [];     // {x,y,w,h,label}  (spikes)
    const checkpoints = []; // {x, y, saved}   (progress-save flags)
    let goalX = 0, worldW = 0;

    // ground helper — a solid block from x1..x2 down to the bottom
    function ground(x1, x2) { platforms.push({ x: x1, y: GROUND_TOP, w: x2 - x1, h: VH - GROUND_TOP + 40 }); }
    function plat(x, y, w) { platforms.push({ x: x, y: y, w: w, h: 10 }); }
    function checkpoint(x) { checkpoints.push({ x: x, y: GROUND_TOP, saved: false }); }
    function bug(x, min, max) { enemies.push({ type: 'bug', x: x, y: GROUND_TOP - 8, w: 12, h: 8, vx: 0.7, min: min, max: max, dead: false, frame: 0 }); }
    function spidey(x, y, min, max, sp) { enemies.push({ type: 'spidey', x: x, y: y, w: 14, h: 20, vx: sp || 0.9, min: min, max: max, dead: false, frame: 0 }); }
    function cat(kind, x, y) { cats.push({ kind: kind, x: x, y: y, w: 14, h: 11, got: false, bob: Math.random() * 6.28 }); }
    // coins arc gently, staying LOW enough to be caught at a jump's apex.
    function coinArc(x0, count, gap, peak) {
      peak = peak || 192;
      for (let i = 0; i < count; i++) {
        const t = i / Math.max(1, count - 1);
        const y = peak - Math.sin(t * Math.PI) * 26;
        coins.push({ x: x0 + i * gap, y: y, got: false, phase: Math.random() * 6.28 });
      }
    }
    // spikes sit on SOLID ground, so they must be jumped over (never over a pit).
    function spikes(x, w, label) { hazards.push({ x: x, y: GROUND_TOP - 8, w: w, h: 8, label: label || 'NaN' }); }
    function deco(t, x, y, size, color) { decos.push({ text: t, x: x, y: y, size: size || 10, color: color || '#7de08a' }); }

    // Design rules that keep the level completable:
    //   - open pits are <= 64px wide (a running jump clears ~100px)
    //   - parkour platforms are 90px wide with <= 24px gaps and near-level
    //     heights, so hops land safely
    //   - reachable platform tops sit <= 56px above the takeoff surface
    //   - spikes only ever sit on SOLID ground (must be jumped, never a pit)
    // NOTE: a grounded player's head is at GROUND_TOP - PLAYER_H (= 188), so
    // any platform over the walkable path must have its TOP <= 178, otherwise
    // the player collides with its side. All heights below respect that.
    const PL = GROUND_TOP - 52; // low platform  (top 162)
    const PM = GROUND_TOP - 44; // medium platform (top 170)
    const PK = GROUND_TOP - 44; // parkour platform (top 170, level hops)

    // small parkour bridge: two 90px platforms spanning a wide gap
    function parkour(x0) {
      plat(x0 + 22, PK, 90);
      coinArc(x0 + 46, 3, 20, PK - 8);
      plat(x0 + 134, PK, 90);
      coinArc(x0 + 158, 3, 20, PK - 8);
    }

    // ---- layout ------------------------------------------------------
    // 1) Start plateau — teach walk / run / jump
    ground(0, 760);
    deco('git checkout -b feature/isabelly', 50, 58, 11, '#8fd0ff');
    deco('console.log("hello, world")', 80, 150, 10, '#7de08a');
    cat('azul', 300, GROUND_TOP - 11);
    plat(440, PL, 90);
    coinArc(456, 4, 20, PL - 6);
    bug(600, 520, 740);
    deco('404', 720, GROUND_TOP - 40, 22, '#ff6b6b');
    checkpoint(700);

    // pit 760..814 (54)
    ground(814, 1180);
    deco('undefined', 900, 66, 12, '#c9a6ff');
    bug(980, 900, 1160);
    cat('tigrao', 1080, GROUND_TOP - 11);
    plat(900, PL, 70);
    coinArc(916, 3, 20, PL - 6);

    // PARKOUR bridge over a wide gap 1180..1426
    deco('// hop the callstack', 1200, 96, 10, '#ffd76b');
    parkour(1180);
    ground(1426, 1980);
    checkpoint(1500);
    deco('git stash', 1520, 60, 11, '#8fd0ff');
    spikes(1640, 32, '<error>');
    spidey(1780, GROUND_TOP - 20, 1700, 1940, 1.1);
    bug(1900, 1840, 1960);
    cat('azul', 1560, GROUND_TOP - 11);

    // pit 1980..2034 (54)
    ground(2034, 2520);
    deco('npm install', 2080, 58, 12, '#8fd0ff');
    deco('merge conflict', 2320, 92, 11, '#ff9d6b');
    // optional coin perches (top <= 178 so the ground below stays walkable)
    plat(2140, GROUND_TOP - 46, 64);   // top 168
    plat(2260, GROUND_TOP - 46, 64);   // top 168
    coinArc(2156, 3, 18, GROUND_TOP - 54);
    coinArc(2276, 3, 18, GROUND_TOP - 54);
    bug(2400, 2340, 2500);
    cat('tigrao', 2460, GROUND_TOP - 11);
    checkpoint(2420);

    // pit 2520..2574 (54)
    ground(2574, 3100);
    // Bedetti cameo — she paces on the ground; hop the ledge to pass her
    enemies.push({ type: 'bedetti', x: 2820, y: GROUND_TOP - 24, w: 16, h: 24, vx: 1.2, min: 2740, max: 2960, dead: false, frame: 0, boss: true });
    deco('Bedetti.exe --stalk', 2740, 60, 11, '#ff5a5a');
    plat(2800, PM, 100);
    coinArc(2820, 4, 20, PM - 6);
    deco('it works on my machine', 3000, 150, 9, '#7de08a');

    // PARKOUR bridge over a wide gap 3100..3346
    deco('stack overflow', 3120, 96, 11, '#c9a6ff');
    parkour(3100);
    ground(3346, 3900);
    checkpoint(3420);
    deco('git rebase -i main', 3440, 58, 11, '#8fd0ff');
    cat('azul', 3480, GROUND_TOP - 11);
    spikes(3540, 36, 'NaN');
    bug(3600, 3540, 3680);                          // enemies kept clear of the
    spidey(3680, GROUND_TOP - 20, 3620, 3740, 1.2); // pit edge for a clean run-up
    deco('{ }', 3700, 120, 16, '#ffd76b');

    // pit 3900..3954 (54)  — coins arc across it (clear ~140px run-up before it)
    coinArc(3894, 5, 14, 196);
    deco('Cannot read properties of undefined', 3770, 150, 9, '#ff9d6b');
    ground(3954, 4700);
    checkpoint(4040);
    bug(4160, 4080, 4360);
    cat('tigrao', 4240, GROUND_TOP - 11);
    plat(4120, PL, 80);
    coinArc(4136, 3, 20, PL - 6);
    deco('git push origin main', 4380, 66, 12, '#7de08a');
    // optional final parkour ledge
    plat(4440, PM, 70);
    coinArc(4456, 3, 18, PM - 6);
    bug(4540, 4460, 4620);              // kept clear of the final pit's run-up

    // pit 4700..4754 (54) — final gap before the finish plateau
    ground(4754, 5060);
    deco('BUILD SUCCESSFUL', 4820, 66, 13, '#7de08a');
    deco('Deploy: GitHub Pages', 4820, 88, 10, '#8fd0ff');
    cat('azul', 4840, GROUND_TOP - 11);
    goalX = 4940;
    worldW = 5060;

    return { platforms, enemies, cats, coins, decos, hazards, checkpoints, goalX, worldW };
  }

  // ================================================================== STATE
  const State = { TITLE: 0, PLAYING: 1, GAMEOVER: 2, CUTSCENE: 3, WIN: 4 };
  let state = State.TITLE;

  let level, player, camX, score, hearts, invuln, tick, reachedGoal;
  let spawn, toastMsg, toastT;
  let trail, followers;   // followers = collected cats that conga-line behind Isabelly
  const PLAYER_H = 26;
  const START = { x: 60, y: GROUND_TOP - PLAYER_H };

  function makePlayer(px, py) {
    return {
      x: px, y: py, w: 16, h: PLAYER_H,
      vx: 0, vy: 0, onGround: false, facing: 1, animT: 0, holdT: 0, groundPlat: null,
    };
  }

  // Full reset — new level, back to the very start.
  function resetGame() {
    level = buildLevel();
    player = makePlayer(START.x, START.y);
    spawn = { x: START.x, y: START.y };
    camX = 0;
    score = 0;
    hearts = 3;
    invuln = 0;
    tick = 0;
    reachedGoal = false;
    toastMsg = null;
    toastT = 0;
    trail = [];
    followers = [];
  }

  // Respawn at the last saved checkpoint — keeps the level, score and
  // collected items. Used by the "CONTINUAR" button after a death.
  function continueFromCheckpoint() {
    player = makePlayer(spawn.x, spawn.y);
    hearts = 3;
    invuln = 60;
    reachedGoal = false;
    camX = Math.max(0, Math.min(spawn.x - VW / 2, level.worldW - VW));
    toast('respawn @ checkpoint');
    state = State.PLAYING;
    hideAllOverlays();
  }

  function toast(msg) { toastMsg = msg; toastT = 150; }

  // ------------------------------------------------------------------ collisions
  function collideAxis(ent, dx, dy) {
    // move on one axis and resolve against platforms
    ent.x += dx; ent.y += dy;
    for (let i = 0; i < level.platforms.length; i++) {
      const p = level.platforms[i];
      if (p.state === 'gone') continue;              // crumbled away — not solid
      if (!aabb(ent, p)) continue;
      if (dy > 0) {
        ent.y = p.y - ent.h;
        if (p.type === 'spring') {                   // launch!
          ent.vy = SPRING_V; ent.onGround = false; ent.groundPlat = null;
        } else {
          ent.vy = 0; ent.onGround = true; ent.groundPlat = p;
          if (p.type === 'crumble' && p.state === 'idle') { p.state = 'shaking'; p.t = 0; }
        }
      }
      else if (dy < 0) { ent.y = p.y + p.h; ent.vy = 0; }
      else if (dx > 0) { ent.x = p.x - ent.w; ent.vx = 0; }
      else if (dx < 0) { ent.x = p.x + p.w; ent.vx = 0; }
    }
  }

  function hurt() {
    if (invuln > 0) return;
    hearts--;
    invuln = 70;
    player.vy = -4.5;
    player.vx = -player.facing * 3;
    if (hearts <= 0) { state = State.GAMEOVER; showOverlay('gameover'); }
  }

  // ------------------------------------------------------------------ update: PLAYING
  function updatePlaying() {
    tick++;
    if (invuln > 0) invuln--;
    if (toastT > 0) toastT--;

    // horizontal input
    let ax = 0;
    if (keys.left) { ax = -1; player.facing = -1; }
    if (keys.right) { ax = 1; player.facing = 1; }
    // Hold a direction and you accelerate from a walk up to a run over ~0.4s.
    // This means running needs no Shift key, so mobile (touch) can run too.
    // Shift still gives an instant run for keyboard players.
    if (ax !== 0) player.holdT++; else player.holdT = 0;
    const target = keys.run ? RUN : Math.min(RUN, WALK + player.holdT * 0.07);
    if (ax !== 0) {
      player.vx += ax * ACCEL;
      if (player.vx > target) player.vx = target;
      if (player.vx < -target) player.vx = -target;
    } else {
      player.vx *= FRICTION;
      if (Math.abs(player.vx) < 0.2) player.vx = 0;
    }

    // jump
    if (keys.jump && player.onGround) {
      player.vy = JUMP_V;
      player.onGround = false;
    }

    // gravity — heavier on the way down so the jump feels weighty, not floaty
    player.vy += (player.vy > 0 ? FALL_GRAVITY : GRAVITY);
    if (player.vy > MAX_FALL) player.vy = MAX_FALL;

    // integrate with collisions
    player.onGround = false;
    collideAxis(player, player.vx, 0);
    collideAxis(player, 0, player.vy);

    // animation timer — step cadence scales with speed (walk slow, run fast)
    if (player.onGround && Math.abs(player.vx) > 0.3) player.animT += Math.abs(player.vx) * 0.14;
    else player.animT = 0;

    // fall into a pit -> instant death
    if (player.y > VH + 30) {
      hearts = 0;
      state = State.GAMEOVER;
      showOverlay('gameover');
      return;
    }

    // checkpoints — save progress when passed
    for (let i = 0; i < level.checkpoints.length; i++) {
      const cp = level.checkpoints[i];
      if (!cp.saved && player.x + player.w > cp.x) {
        cp.saved = true;
        spawn = { x: cp.x, y: GROUND_TOP - PLAYER_H };
        score += 50;
        toast('git commit -m "checkpoint"');
      }
    }

    // camera follows, clamped to world
    camX = player.x + player.w / 2 - VW / 2;
    if (camX < 0) camX = 0;
    if (camX > level.worldW - VW) camX = level.worldW - VW;

    // enemies — each type has its own behaviour
    const pcx = player.x + player.w / 2;
    for (let i = 0; i < level.enemies.length; i++) {
      const e = level.enemies[i];
      if (e.dead) continue;
      e.frame += 1;

      if (e.type === 'bug') {
        // glitch-hopper: patrols and does a little hop now and then
        if (e.baseY === undefined) { e.baseY = e.y; e.hopT = Math.floor(Math.random() * 90); }
        e.x += e.vx;
        if (e.x < e.min) { e.x = e.min; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > e.max) { e.x = e.max - e.w; e.vx = -Math.abs(e.vx); }
        e.hopT++;
        const cyc = e.hopT % 120;
        e.y = e.baseY - (cyc < 26 ? Math.sin((cyc / 26) * Math.PI) * 12 : 0); // periodic hop
      } else if (e.type === 'spidey') {
        // patrols, then telegraphs and LUNGES at Isabelly when she's close
        if (!e.st) { e.st = 'patrol'; e.timer = 0; }
        e.timer--;
        const dx = pcx - (e.x + e.w / 2);
        const near = Math.abs(dx) < 100 && Math.abs((player.y + player.h) - (e.y + e.h)) < 44;
        if (e.st === 'patrol') {
          e.x += e.vx;
          if (e.x < e.min) { e.x = e.min; e.vx = Math.abs(e.vx); }
          if (e.x + e.w > e.max) { e.x = e.max - e.w; e.vx = -Math.abs(e.vx); }
          if (near && e.timer <= 0) { e.st = 'wind'; e.timer = 16; e.dir = dx > 0 ? 1 : -1; e.vx = Math.abs(e.vx) * e.dir; }
        } else if (e.st === 'wind') {          // telegraph (shiver) before the dash — fair warning
          if (e.timer <= 0) { e.st = 'lunge'; e.timer = 18; }
        } else if (e.st === 'lunge') {
          e.x += e.dir * 3.6;
          e.x = Math.max(e.min - 34, Math.min(e.max + 34, e.x));
          if (e.timer <= 0) { e.st = 'cool'; e.timer = 55; }
        } else {                                // cool-down
          e.x += e.vx * 0.35;
          if (e.x < e.min) e.x = e.min; if (e.x + e.w > e.max) e.x = e.max - e.w;
          if (e.timer <= 0) e.st = 'patrol';
        }
      } else if (e.type === 'bedetti') {
        // the signature villain: CHASES Isabelly through her zone, then gives up
        if (!e.chaseInit) { e.chaseInit = true; e.chasing = false; e.homeMin = e.min; e.homeMax = e.max; e.giveUpX = 3080; e.chaseSpeed = 1.2; }
        if (!e.chasing) {
          e.x += e.vx;
          if (e.x < e.min) { e.x = e.min; e.vx = Math.abs(e.vx); }
          if (e.x + e.w > e.max) { e.x = e.max - e.w; e.vx = -Math.abs(e.vx); }
          if (pcx > e.min - 30 && pcx < e.giveUpX && player.x > e.min - 50) {
            e.chasing = true; e.chaseSpeed = 1.2; toast('Bedetti: cade voce?! nao corre!');
          }
        } else {
          e.chaseSpeed = Math.min(2.7, e.chaseSpeed + 0.016); // ramps up, but still slower than a full run (escapable)
          const dir = pcx > (e.x + e.w / 2) ? 1 : -1;
          e.x += dir * e.chaseSpeed;
          e.vx = dir * 0.6;                    // for facing
          if (e.x > e.giveUpX) e.x = e.giveUpX;
          if (pcx > e.giveUpX + 40 || player.x > e.giveUpX) { // Isabelly escaped over the gap
            e.chasing = false; e.min = e.x - 30; e.max = e.x + 30; e.vx = -Math.abs(e.vx);
          }
        }
      } else {
        e.x += e.vx;
        if (e.x < e.min) { e.x = e.min; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > e.max) { e.x = e.max - e.w; e.vx = -Math.abs(e.vx); }
      }

      // collision with Isabelly (stomp kills non-Bedetti; otherwise it hurts)
      if (aabb(player, e)) {
        const stomped = player.vy > 1 && (player.y + player.h) - e.y < 14;
        if (stomped && e.type !== 'bedetti') {
          e.dead = true;
          player.vy = JUMP_V * 0.6;
          score += 150;
        } else {
          hurt();
        }
      }
    }

    // record Isabelly's path so collected cats can retrace it (conga line)
    trail.push({ x: player.x, y: player.y, f: player.facing, g: player.onGround });
    if (trail.length > 460) trail.shift();

    // hazards (spikes) — contact hurts
    for (let i = 0; i < level.hazards.length; i++) {
      if (aabb(player, level.hazards[i])) hurt();
    }

    // cats (collectibles)
    for (let i = 0; i < level.cats.length; i++) {
      const c = level.cats[i];
      if (c.got) continue;
      c.bob += 0.08;
      if (aabb(player, c)) {
        c.got = true; score += 250;
        if (hearts < 3 && Math.random() < 0.5) hearts++;
        // the cat now joins Isabelly and follows in a conga line
        followers.push({ kind: c.kind, delay: 16 + followers.length * 12, bob: Math.random() * 6.28 });
        toast((c.kind === 'azul' ? 'Azul' : 'Tigrão') + ' te seguindo! +250');
      }
    }

    // coins
    for (let i = 0; i < level.coins.length; i++) {
      const c = level.coins[i];
      if (c.got) continue;
      c.phase += 0.1;
      if (player.x < c.x + 8 && player.x + player.w > c.x - 8 &&
          player.y < c.y + 8 && player.y + player.h > c.y - 8) { c.got = true; score += 20; }
    }

    // reached the goal flag?
    if (!reachedGoal && player.x + player.w > level.goalX) {
      reachedGoal = true;
      startCutscene();
    }

    updateHUD();
  }

  // ================================================================== RENDER: world
  function drawParallaxBg() {
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#141b2e');
    g.addColorStop(0.55, '#243a5e');
    g.addColorStop(1, '#3a5a7a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VW, VH);

    // faint "matrix" code columns (far parallax)
    ctx.fillStyle = 'rgba(120,220,140,0.06)';
    for (let i = 0; i < 40; i++) {
      const x = ((i * 137 - camX * 0.2) % (VW + 40) + VW + 40) % (VW + 40) - 20;
      ctx.fillRect(x, (i * 53) % VH, 2, 40);
    }

    // distant hills (mid parallax)
    ctx.fillStyle = '#2c3f5e';
    for (let i = -1; i < 6; i++) {
      const bx = i * 180 - (camX * 0.4) % 180;
      ctx.beginPath();
      ctx.moveTo(bx, VH);
      ctx.lineTo(bx + 90, VH - 70);
      ctx.lineTo(bx + 180, VH);
      ctx.closePath();
      ctx.fill();
    }
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 30; i++) {
      const x = ((i * 211 - camX * 0.1) % VW + VW) % VW;
      const y = (i * 71) % 120;
      ctx.fillRect(x, y, 1, 1);
    }
  }

  function drawGroundTexture(p) {
    // grassy top + dirt with a subtle checker
    const sx = Math.round(p.x - camX);
    ctx.fillStyle = '#3b2e24';
    ctx.fillRect(sx, p.y, p.w, p.h);
    ctx.fillStyle = '#4a7a3a';
    ctx.fillRect(sx, p.y, p.w, 5);
    ctx.fillStyle = '#5c9648';
    ctx.fillRect(sx, p.y, p.w, 2);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    for (let x = 0; x < p.w; x += 16) {
      if (((p.x + x) / 16 | 0) % 2 === 0) ctx.fillRect(sx + x, p.y + 5, 8, p.h - 5);
    }
  }

  function drawPlatform(p) {
    const sx = Math.round(p.x - camX);
    if (p.h <= 12) { // floating platform
      ctx.fillStyle = '#6b4a2e';
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = '#5c9648';
      ctx.fillRect(sx, p.y, p.w, 3);
    } else {
      drawGroundTexture(p);
    }
  }

  function drawWorld() {
    drawParallaxBg();

    // decorations (code jokes) — drawn in world space
    for (let i = 0; i < level.decos.length; i++) {
      const d = level.decos[i];
      const sx = d.x - camX;
      if (sx < -260 || sx > VW + 40) continue;
      text(d.text, sx, d.y, d.size, d.color, 'left');
    }

    // platforms
    for (let i = 0; i < level.platforms.length; i++) {
      const p = level.platforms[i];
      if (p.x - camX > VW || p.x + p.w - camX < 0) continue;
      drawPlatform(p);
    }

    // checkpoints — a little save-flag ("commit" marker)
    for (let i = 0; i < level.checkpoints.length; i++) {
      const cp = level.checkpoints[i];
      const sx = Math.round(cp.x - camX);
      if (sx < -20 || sx > VW + 20) continue;
      ctx.fillStyle = '#2a2f3e';
      ctx.fillRect(sx, GROUND_TOP - 34, 2, 34);              // pole
      ctx.fillStyle = cp.saved ? '#5c9648' : '#4a5064';       // flag
      ctx.fillRect(sx + 2, GROUND_TOP - 34, 16, 10);
      text('commit', sx + 3, GROUND_TOP - 33, 7, cp.saved ? '#12331c' : '#dfe4ee', 'left', false);
    }

    // hazards (spikes)
    for (let i = 0; i < level.hazards.length; i++) {
      const hz = level.hazards[i];
      const sx = hz.x - camX;
      if (sx < -60 || sx > VW + 20) continue;
      ctx.fillStyle = '#c23b3b';
      for (let x = 0; x < hz.w; x += 8) {
        ctx.beginPath();
        ctx.moveTo(sx + x, hz.y + hz.h);
        ctx.lineTo(sx + x + 4, hz.y);
        ctx.lineTo(sx + x + 8, hz.y + hz.h);
        ctx.closePath();
        ctx.fill();
      }
      text(hz.label, sx, hz.y - 12, 9, '#ff8a8a', 'left');
    }

    // coins (console.log orbs)
    for (let i = 0; i < level.coins.length; i++) {
      const c = level.coins[i];
      if (c.got) continue;
      const sx = c.x - camX;
      if (sx < -20 || sx > VW + 20) continue;
      const yy = c.y + Math.sin(c.phase) * 2;
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath(); ctx.arc(sx, yy, 5, 0, 6.28); ctx.fill();
      ctx.fillStyle = '#8a6a10';
      text(';', sx - 2, yy - 6, 10, '#6b4e08', 'left', false);
    }

    // cats
    for (let i = 0; i < level.cats.length; i++) {
      const c = level.cats[i];
      if (c.got) continue;
      const sx = Math.round(c.x - camX);
      if (sx < -30 || sx > VW + 20) continue;
      const yy = Math.round(c.y + Math.sin(c.bob) * 2);
      const spr = c.kind === 'azul'
        ? (Math.floor(c.bob * 2) % 2 ? SPR.catAzul2 : SPR.catAzul)
        : SPR.catTigrao;
      SPR.draw(ctx, spr, sx, yy, 1, false);
    }

    // enemies
    for (let i = 0; i < level.enemies.length; i++) {
      const e = level.enemies[i];
      if (e.dead) continue;
      const sx = Math.round(e.x - camX);
      if (sx < -40 || sx > VW + 20) continue;
      const flip = e.vx < 0;
      if (e.type === 'bug') {
        SPR.draw(ctx, SPR.bug, sx, Math.round(e.y), 1, flip);
      } else if (e.type === 'spidey') {
        SPR.draw(ctx, (Math.floor(e.frame / 10) % 2 ? SPR.spidey2 : SPR.spidey), sx, Math.round(e.y), 1, flip);
      } else if (e.type === 'bedetti') {
        if (bedOK()) {
          drawBed(e.x + e.w / 2 - camX, e.y + e.h, 1, e.vx > 0, Math.floor(e.frame / 9));
        } else {
          SPR.draw(ctx, (Math.floor(e.frame / 12) % 2 ? SPR.bedetti2 : SPR.bedetti), sx, Math.round(e.y), 1, flip);
        }
      }
    }

    // goal flag + banner
    const gx = level.goalX - camX;
    if (gx > -40 && gx < VW + 40) {
      SPR.draw(ctx, SPR.flag, Math.round(gx), GROUND_TOP - 48, 3, false);
      text('git push', gx - 6, GROUND_TOP - 62, 10, '#ffffff', 'left');
    }

    // follower cats — retrace Isabelly's recent path (conga line)
    for (let i = 0; i < followers.length; i++) {
      const f = followers[i];
      const idx = trail.length - 1 - f.delay;
      if (idx < 0) continue;
      const s = trail[idx];
      f.bob += 0.1;
      const spr = f.kind === 'azul'
        ? (Math.floor(f.bob) % 2 ? SPR.catAzul2 : SPR.catAzul)
        : SPR.catTigrao;
      const cx = Math.round(s.x + player.w / 2 - camX - spr.w / 2);
      const cy = Math.round(s.y + player.h - spr.h);        // feet on her path
      if (cx < -30 || cx > VW + 20) continue;
      SPR.draw(ctx, spr, cx, cy, 1, s.f < 0);
    }

    // player
    drawPlayer();
  }

  function drawPlayer() {
    if (invuln > 0 && Math.floor(invuln / 4) % 2 === 0) return; // blink
    const flip = player.facing < 0;
    const feetX = player.x + player.w / 2 - camX;
    const feetY = player.y + player.h;
    if (isaReady) {
      const moving = player.onGround && Math.abs(player.vx) > 0.3;
      drawIsaAnimated(feetX, feetY, 1, flip, moving, player.onGround, player.vy, player.animT);
      return;
    }
    // fallback: code-drawn sprite
    let spr;
    if (!player.onGround) spr = SPR.girl.jump;
    else if (Math.abs(player.vx) > 0.3) spr = (Math.floor(player.animT) % 2 ? SPR.girl.run2 : SPR.girl.run1);
    else spr = SPR.girl.idle;
    SPR.draw(ctx, spr, Math.round(player.x - camX), Math.round(player.y), 1, flip);
  }

  // Animated draw for the real (single-image) Isabelly sprite. Kept upright
  // (NO rotation, so she never looks like she's tipping sideways): the run
  // is a purely VERTICAL springy bounce with squash & stretch.
  function drawIsaAnimated(feetX, feetY, S, flip, moving, onGround, vy, animT) {
    const w = ISA_W, h = ISA_H;
    ctx.save();
    ctx.translate(Math.round(feetX), Math.round(feetY)); // pivot at the feet
    if (flip) ctx.scale(-1, 1);

    if (!onGround) {
      const sy = vy < 0 ? 1.05 : (vy > 7 ? 0.96 : 1.0);  // stretch up / squash down
      const sx = vy < 0 ? 0.96 : 1.02;
      ctx.drawImage(isaImg, -w * S * sx / 2, -h * S * sy, w * S * sx, h * S * sy);
    } else if (moving) {
      const a = Math.abs(Math.sin(animT));
      const bob = -a * 1.1 * S;                          // gentle bounce (subtle)
      const sy = 1 - a * 0.03, sx = 1 + a * 0.025;       // slight squash/stretch
      ctx.drawImage(isaImg, -w * S * sx / 2, -h * S * sy + bob, w * S * sx, h * S * sy);
    } else {
      const bob = Math.sin(Date.now() / 420) * 0.6 * S;  // idle breathing
      ctx.drawImage(isaImg, -w * S / 2, -h * S + bob, w * S, h * S);
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------ HUD
  function drawHUD() {
    // hearts
    for (let i = 0; i < 3; i++) {
      ctx.globalAlpha = i < hearts ? 1 : 0.2;
      SPR.draw(ctx, SPR.heart, 8 + i * 12, 8, 1.4, false);
    }
    ctx.globalAlpha = 1;
    // score
    text('score ' + String(score).padStart(5, '0'), VW - 8, 8, 11, '#ffe08a', 'right');
    // progress bar
    const prog = Math.max(0, Math.min(1, player.x / level.goalX));
    const bw = 160, bx = (VW - bw) / 2, by = 10;
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
    ctx.fillStyle = '#2c3f5e'; ctx.fillRect(bx, by, bw, 6);
    ctx.fillStyle = '#5c9648'; ctx.fillRect(bx, by, bw * prog, 6);
    text('build ' + Math.round(prog * 100) + '%', VW / 2, by + 9, 8, '#bfe8c8', 'center');

    // toast (checkpoint saved / respawn)
    if (toastT > 0 && toastMsg) {
      const a = Math.min(1, toastT / 40);
      ctx.globalAlpha = a;
      const tw = 176, tx = (VW - tw) / 2;
      ctx.fillStyle = 'rgba(20,30,20,0.85)'; ctx.fillRect(tx, 30, tw, 16);
      ctx.strokeStyle = '#5c9648'; ctx.lineWidth = 1; ctx.strokeRect(tx, 30, tw, 16);
      text(toastMsg, VW / 2, 34, 9, '#bfe8c8', 'center', false);
      ctx.globalAlpha = 1;
    }
  }

  // ================================================================== CUTSCENE
  // EXACT dialogue as specified — do not change.
  const CUT_LINES = [
    { who: 'Bedetti', text: 'Finalmente te alcancei...' },
    { who: 'Isabelly', text: 'Bedetti... nem tenta.' },
    { who: 'Bedetti', text: 'Eu só estava pensando em uma coisa...' },
  ];
  let cut; // cutscene state

  const CUT_BASE = 206;   // feet baseline for the cutscene stage

  function startCutscene() {
    state = State.CUTSCENE;
    cut = {
      phase: 0,          // 0 approach1, 1 line0, 2 girl steps back + line1,
                          // 3 approach2 + line2, 4 pause, 5 close approach,
                          // 6 cut-to-black, 7 done
      t: 0,
      girlX: 330, bedX: -30,
      line: -1, textShown: 0, fade: 0, girlSurprised: false,
      camScale: 2.0, bars: 0, hearts: [], shake: 0, arrived: false,
      gcat: null, catLift: 0, blackHold: 0, videoStarted: false,
    };
    if (endVideo) { try { endVideo.pause(); } catch (e) {} endVideo.hidden = true; endVideo.currentTime = 0; }
    hideAllOverlays();
  }

  function updateCutscene() {
    cut.t++;
    const c = cut;
    c.bars = Math.min(1, c.bars + 0.05);   // cinematic bars slide in

    switch (c.phase) {
      case 0: // Bedetti SPRINTS in and finally catches up to Isabelly
        c.bedX += (c.bedX < c.girlX - 82 ? 2.7 : 0.6);   // runs, then slows as she arrives
        if (c.bedX > c.girlX - 80 && c.t > 20) { c.phase = 1; c.t = 0; c.line = 0; c.textShown = 0; }
        break;
      case 1: // Bedetti: "Finalmente te alcancei..."
        c.textShown = Math.min(CUT_LINES[0].text.length, c.textShown + 0.6);
        if (c.t > 150) { c.phase = 2; c.t = 0; c.line = 1; c.textShown = 0; }
        break;
      case 2: // Isabelly steps back + "Bedetti... nem tenta."
        if (c.t < 30) c.girlX += 1.0;
        c.textShown = Math.min(CUT_LINES[1].text.length, c.textShown + 0.6);
        if (c.t > 150) { c.phase = 3; c.t = 0; c.line = 2; c.textShown = 0; }
        break;
      case 3: // Bedetti approaches to a normal distance + "Eu só estava pensando em uma coisa..."
        if (c.bedX < c.girlX - 66) c.bedX += 0.7;
        if (c.t < 30) c.girlX += 0.25;                // Isabelly edges back a touch
        c.textShown = Math.min(CUT_LINES[2].text.length, c.textShown + 0.55);
        if (c.t > 170) { c.phase = 4; c.t = 0; }
        break;
      case 4: { // PIXEL beat: a cat trots in and Bedetti scoops it into her arms
        if (!c.gcat) c.gcat = { x: 12, y: CUT_BASE - 11, kind: 'azul', held: false, bob: 0 };
        const tx = c.bedX - 2;
        if (c.gcat.x < tx) c.gcat.x += 2.0; else { c.gcat.x = tx; c.gcat.held = true; }
        c.gcat.bob += 0.2;
        if (c.gcat.held) c.catLift = Math.min(1, c.catLift + 0.05);   // cat rises into her arms
        if (c.catLift >= 1 && c.t > 95) { c.phase = 5; c.t = 0; }
        break;
      }
      case 5: // fade the pixel stage to black
        if (c.t > 20) c.fade = Math.min(1, c.fade + 0.02);
        if (c.fade >= 1) { c.phase = 6; c.t = 0; }
        break;
      case 6: // play the ending cinematic video; when it ends -> BUILD SUCCESSFUL
        if (!c.videoStarted) { c.videoStarted = true; playEndingVideo(); }
        if (c.t > 900) finishCutsceneWin();            // safety fallback
        break;
      case 7:
        state = State.WIN;
        showOverlay('win');
        break;
    }

    // gentle camera push-in (kept modest — no giant characters)
    const target = [2.0, 2.0, 2.05, 2.1, 2.12, 2.12, 2.12, 2.12][c.phase] || 2.0;
    c.camScale += (target - c.camScale) * 0.06;
  }

  // play the generated ending cinematic; fall back to WIN if it can't play
  function playEndingVideo() {
    if (!endVideo || !endVideo.canPlayType || !endVideo.canPlayType('video/mp4')) { finishCutsceneWin(); return; }
    try {
      endVideo.hidden = false;
      endVideo.currentTime = 0;
      endVideo.onended = finishCutsceneWin;
      endVideo.onerror = finishCutsceneWin;
      const pr = endVideo.play();
      if (pr && pr.catch) pr.catch(function () { finishCutsceneWin(); });
    } catch (e) { finishCutsceneWin(); }
  }
  function finishCutsceneWin() {
    if (endVideo) { try { endVideo.pause(); } catch (e) {} endVideo.hidden = true; endVideo.onended = null; endVideo.onerror = null; }
    if (state === State.CUTSCENE) { state = State.WIN; showOverlay('win'); }
  }

  function drawCutscene() {
    const c = cut;
    const shx = c.shake ? Math.round((Math.random() * 2 - 1) * c.shake) : 0;
    const shy = c.shake ? Math.round((Math.random() * 2 - 1) * c.shake) : 0;
    ctx.save();
    ctx.translate(shx, shy);

    // --- moonlit night sky ---
    const g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#0e0b1e'); g.addColorStop(0.5, '#241a3e'); g.addColorStop(1, '#3c2a4e');
    ctx.fillStyle = g; ctx.fillRect(-8, -8, VW + 16, VH + 16);
    // moon
    ctx.fillStyle = '#f3ead0'; ctx.beginPath(); ctx.arc(VW - 78, 52, 22, 0, 6.28); ctx.fill();
    ctx.fillStyle = 'rgba(60,42,78,0.5)'; ctx.beginPath(); ctx.arc(VW - 70, 46, 20, 0, 6.28); ctx.fill();
    // stars
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 60; i++) { const tw = 0.4 + 0.6 * Math.abs(Math.sin(i * 12.9 + c.t * 0.02)); ctx.globalAlpha = tw; ctx.fillRect((i * 89) % VW, (i * 47) % 150, 1, 1); }
    ctx.globalAlpha = 1;
    // faint falling code
    ctx.fillStyle = 'rgba(120,220,140,0.06)';
    for (let i = 0; i < 26; i++) { const x = (i * 61) % VW; const y = ((i * 53 + c.t * 0.6) % (VH + 40)) - 20; ctx.fillRect(x, y, 1, 12); }
    // city silhouette
    for (let layer = 0; layer < 2; layer++) {
      ctx.fillStyle = layer ? '#1a1330' : '#120d24';
      const base = GROUND_TOP - (layer ? 6 : 22);
      for (let x = -20; x < VW + 20; x += 34) {
        const hh = 26 + ((x * 7 + layer * 13) % 40);
        ctx.fillRect(x, base - hh, 26, hh + 40);
        ctx.fillStyle = layer ? 'rgba(255,220,120,0.10)' : 'rgba(255,220,120,0.06)';
        for (let wy = base - hh + 4; wy < base; wy += 8) for (let wx = x + 3; wx < x + 22; wx += 7) ctx.fillRect(wx, wy, 2, 3);
        ctx.fillStyle = layer ? '#1a1330' : '#120d24';
      }
    }
    // ground
    ctx.fillStyle = '#171026'; ctx.fillRect(-8, GROUND_TOP, VW + 16, VH - GROUND_TOP + 8);
    ctx.fillStyle = '#5a3f7a'; ctx.fillRect(-8, GROUND_TOP, VW + 16, 2);
    // ground reflection glow under characters
    const rg = ctx.createRadialGradient(VW / 2, GROUND_TOP + 6, 4, VW / 2, GROUND_TOP + 6, 120);
    rg.addColorStop(0, 'rgba(120,90,160,0.25)'); rg.addColorStop(1, 'rgba(120,90,160,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, GROUND_TOP - 10, VW, 60);

    // --- characters (push-in scale), feet on baseline ---
    const S = c.camScale, feet = CUT_BASE;
    const bedMoving = (c.phase === 0 || c.phase === 3 || c.phase === 6);
    const bedFacingRight = (c.phase < 6);              // faces Isabelly, then turns to leave
    // soft shadows
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(c.bedX + 22, feet + 2, 16 * (S / 2), 4, 0, 0, 6.28); ctx.fill();
    ctx.beginPath(); ctx.ellipse(c.girlX + 8, feet + 2, 13 * (S / 2), 4, 0, 0, 6.28); ctx.fill();

    // the cat trotting in on the ground (before it's scooped up)
    const catSpr = c.gcat
      ? (c.gcat.kind === 'azul' ? (Math.floor(c.gcat.bob) % 2 ? SPR.catAzul2 : SPR.catAzul) : SPR.catTigrao)
      : null;
    if (c.gcat && !c.gcat.held) {
      SPR.draw(ctx, catSpr, Math.round(c.gcat.x - catSpr.w / 2), Math.round(feet - catSpr.h + Math.sin(c.gcat.bob) * 1), 1, false);
    }

    // Bedetti (idle, then strolls off to the left carrying the cat)
    if (bedOK()) drawBed(c.bedX + 22, feet, S, bedFacingRight, bedMoving ? Math.floor(c.t / 8) : 1);
    else { const bf = Math.floor(c.t / 12) % 2 ? SPR.bedetti2 : SPR.bedetti; SPR.draw(ctx, bf, Math.round(c.bedX), feet - bf.h * S, S, false); }

    // the cat cradled in her arms (rises into place, then rides along)
    if (c.gcat && c.gcat.held && catSpr) {
      const groundY = feet - catSpr.h;
      const armY = feet - 20 * S;
      const cy = groundY + (armY - groundY) * c.catLift;
      SPR.draw(ctx, catSpr, Math.round(c.bedX + 22 - catSpr.w / 2 + (bedFacingRight ? 5 : -5)), Math.round(cy), 1, false);
      // a little heart — she loves this cat
      if (Math.floor(c.t / 18) % 2) SPR.draw(ctx, SPR.heart, Math.round(c.bedX + 30), Math.round(feet - 40 * S), 1, false);
    }

    // Isabelly + her relieved/confused "?" once the "threat" turns out to be a cat
    if (isaReady) drawImgFeet(isaImg, ISA_W, ISA_H, c.girlX + 8, feet, S, true, 0);
    else { SPR.draw(ctx, SPR.girl.idle, Math.round(c.girlX), feet - SPR.girl.idle.h * S, S, true); }
    if (c.gcat && c.gcat.held && Math.floor(c.t / 16) % 2) text('?', c.girlX + 8 + 6 * (S / 2), feet - ISA_H * S - 8, 16, '#a9dcff', 'left');

    // --- vignette (tightens toward the finish) ---
    const vig = 0.35 + (c.phase >= 4 ? 0.3 : 0);
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, 60, VW / 2, VH / 2, 300);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,' + vig + ')');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);

    ctx.restore(); // end shake

    // --- cinematic letterbox bars ---
    const bar = Math.round(16 * c.bars);
    if (bar > 0) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, bar); ctx.fillRect(0, VH - bar, VW, bar); }

    // --- visual-novel dialogue box with portrait ---
    if (c.line >= 0 && c.phase >= 1 && c.phase <= 3) {
      const L = CUT_LINES[c.line];
      const isBed = L.who === 'Bedetti';
      const accent = isBed ? '#ff6a6a' : '#8fd0ff';
      const shown = L.text.slice(0, Math.floor(c.textShown));
      const boxX = 16, boxY = VH - 62, boxW = VW - 32, boxH = 44;
      // portrait (pops above the box)
      const face = isBed ? bedFace : isaFace;
      const faceReady = isBed ? bedFaceReady : isaFaceReady;
      let textX = boxX + 14;
      if (faceReady) {
        const ph = 62, pw = Math.round(ph * face.naturalWidth / face.naturalHeight);
        const pxp = boxX + 6, pyp = boxY - ph + 20;
        ctx.save();
        ctx.strokeStyle = accent; ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(10,12,20,0.6)';
        ctx.beginPath(); ctx.arc(pxp + pw / 2, pyp + ph - 18, pw / 2 + 3, Math.PI, 0); ctx.fill();
        ctx.drawImage(face, pxp, pyp, pw, ph);
        ctx.restore();
        textX = pxp + pw + 12;
      }
      // box
      ctx.fillStyle = 'rgba(8,10,18,0.92)'; ctx.fillRect(boxX, boxY, boxW, boxH);
      ctx.strokeStyle = accent; ctx.lineWidth = 2; ctx.strokeRect(boxX, boxY, boxW, boxH);
      // name tag
      ctx.fillStyle = accent; ctx.fillRect(textX - 2, boxY - 9, ctx.measureText(L.who).width + 16, 14);
      text(L.who, textX + 4, boxY - 8, 11, '#10131c', 'left', false);
      // line + blinking cursor
      const cursor = (Math.floor(c.t / 16) % 2 && c.textShown < L.text.length) ? ' ▋' : '';
      text(shown + cursor, textX + 2, boxY + 16, 13, '#ffffff', 'left');
    }

    // dramatic pause hint
    if (c.phase === 4) text('. . .', VW / 2, VH - 44, 18, 'rgba(255,255,255,' + (0.4 + Math.sin(c.t * 0.18) * 0.3) + ')', 'center', false);

    // cut to black
    if (c.fade > 0) { ctx.fillStyle = 'rgba(0,0,0,' + c.fade + ')'; ctx.fillRect(0, 0, VW, VH); }
  }

  // ================================================================== TITLE bg
  function drawTitleBg() {
    drawParallaxBg();
    // ground strip (characters are shown on the HTML title panel, not here)
    const gy = GROUND_TOP + 16;
    ctx.fillStyle = '#3b2e24'; ctx.fillRect(0, gy, VW, VH);
    ctx.fillStyle = '#5c9648'; ctx.fillRect(0, gy, VW, 3);
  }

  // ================================================================== OVERLAYS
  function hideAllOverlays() {
    ['title', 'gameover', 'win'].forEach(function (id) {
      const el = document.getElementById('screen-' + id);
      if (el) el.hidden = true;
    });
  }
  function showOverlay(id) {
    hideAllOverlays();
    const el = document.getElementById('screen-' + id);
    if (el) el.hidden = false;
    if (id === 'gameover') {
      document.getElementById('go-score').textContent = 'score: ' + String(score).padStart(5, '0');
      // enable "continue" only if a checkpoint was actually reached
      const hasCp = level.checkpoints.some(function (cp) { return cp.saved; });
      const btn = document.getElementById('btn-continue');
      if (btn) {
        btn.disabled = !hasCp;
        btn.textContent = hasCp ? 'CONTINUAR (checkpoint)' : 'SEM CHECKPOINT AINDA';
      }
    }
    if (id === 'win') {
      document.getElementById('win-score').textContent =
        'score: ' + String(score).padStart(5, '0') + '   (0 errors, 0 warnings)';
    }
  }

  function updateHUD() { /* HUD drawn each frame in render */ }

  // ================================================================== LOOP
  function startGame() {
    resetGame();
    state = State.PLAYING;
    if (endVideo) { try { endVideo.pause(); } catch (e) {} endVideo.hidden = true; }
    hideAllOverlays();
  }

  function frame() {
    if (state === State.PLAYING) {
      updatePlaying();
      drawWorld();
      drawHUD();
    } else if (state === State.CUTSCENE) {
      updateCutscene();
      drawCutscene();
    } else if (state === State.TITLE) {
      drawTitleBg();
    } else if (state === State.GAMEOVER) {
      drawWorld();
      drawHUD();
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, VW, VH);
    } else if (state === State.WIN) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    }
    requestAnimationFrame(frame);
  }

  // wire buttons
  document.getElementById('btn-play').addEventListener('click', startGame);
  document.getElementById('btn-restart').addEventListener('click', startGame);
  document.getElementById('btn-again').addEventListener('click', startGame);
  const contBtn = document.getElementById('btn-continue');
  if (contBtn) contBtn.addEventListener('click', function () {
    if (!contBtn.disabled) continueFromCheckpoint();
  });

  // ------------------------------------------------------------------ debug hook
  // Lightweight, read-mostly hook. Useful for automated testing and for
  // stepping the simulation when requestAnimationFrame is throttled (e.g.
  // when the tab is hidden). Does not affect normal gameplay.
  window.ISA = {
    get state() { return state; },
    stateName: function () { return ['TITLE', 'PLAYING', 'GAMEOVER', 'CUTSCENE', 'WIN'][state]; },
    get player() { return player; },
    get score() { return score; },
    get hearts() { return hearts; },
    get cut() { return cut; },
    get level() { return level; },
    get spawn() { return spawn; },
    get followers() { return followers; },
    get trail() { return trail; },
    keys: keys,
    start: startGame,
    continue: continueFromCheckpoint,
    // advance the simulation logic n times (no rendering)
    step: function (n) {
      n = n || 1;
      for (let i = 0; i < n; i++) {
        if (state === State.PLAYING) updatePlaying();
        else if (state === State.CUTSCENE) updateCutscene();
        else break;
      }
      return this.stateName();
    },
  };

  // boot
  resetGame();
  showOverlay('title');
  requestAnimationFrame(frame);
})();
