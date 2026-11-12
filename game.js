"use strict";

/* ================================================================
   WORLD INTENTION
   The traveler walks on its own. You rearrange the world.
   ================================================================ */

const $ = id => document.getElementById(id);

/* ---------- DOM ---------- */
const canvas = $("gameCanvas");
const ctx = canvas.getContext("2d");
const startScreen = $("start-screen");
const winScreen = $("win-screen");
const controlsEl = $("controls");
const levelLabel = $("levelLabel");
const levelGrid = $("levelGrid");
const startButton = $("startButton");
const clearSaveButton = $("clearSave");
const winTitle = $("winTitle");
const winText = $("winText");
const winStarsEl = $("winStars");
const winTime = $("winTime");
const nextButton = $("nextButton");
const restartButton = $("restartButton");
const winMenuButton = $("winMenuButton");
const stasisButton = $("stasisButton");
const resetButton = $("resetButton");
const menuButton = $("menuButton");
const soundButton = $("soundButton");

/* ---------- Constants ---------- */
const WORLD_W = 1000;          // the world is always 1000 x 600 and scaled to fit
const WORLD_H = 600;
const GROUND_Y = 565;
const PLAYER_R = 12;
const SPAWN = { x: 60, y: GROUND_Y - PLAYER_R };

const STEP = 1 / 60;           // fixed physics step (seconds)
const RUN_SPEED = 1.5;
const AIR_BOOST = 2.4;         // forward speed while flying off a spring
const SHIFT_SPEED = 3.2;
const GRAVITY = 0.28;
const MAX_FALL = 9;
const BOUNCE_V = 12.5;

const STASIS_MAX = 5;          // seconds of stasis in a full meter
const STASIS_DRAIN = 1;
const STASIS_REGEN = 0.8;

const READY_TIME = 3.2;        // planning time before the traveler is released
const DEATH_DELAY = 0.85;
const WIN_DELAY = 0.9;
const SAVE_KEY = "worldIntention.save.v2";

/* ================================================================
   LEVELS
   Object types:
     platform  solid, draggable
     block     solid, draggable
     spike     deadly, draggable
     bounce    spring pad: launches the traveler up and forward
     mover     moving platform (ax/ay = travel distance, speed = rad/s)
   `fixed: true` means the object is anchored and can't be dragged,
   but it still slides when you shift the whole world.
   ================================================================ */
const ground = (x, w) => ({ x, y: GROUND_Y, w, h: WORLD_H - GROUND_Y, type: "platform", fixed: true });
const ledge  = (x, y, w) => ({ x, y, w, h: WORLD_H - y, type: "platform", fixed: true });
const plank  = (x, y, w) => ({ x, y, w, h: 20, type: "platform" });
const block  = (x, y, w, h) => ({ x, y, w, h, type: "block" });
const spikes = (x, w, fixed = false, surface = GROUND_Y) => ({ x, y: surface - 24, w, h: 24, type: "spike", fixed });
const spring = (x, y, w = 44) => ({ x, y, w, h: 12, type: "bounce" });
const mover  = (x, y, w, ax, ay, speed, phase = 0) => ({ x, y, w, h: 20, type: "mover", ax, ay, speed, phase });

const LEVELS = [
  {
    name: "FIRST SHIFT",
    hint: "Drag the plank over the gap and clear the wall. Arrow keys slide the whole world.",
    par: 18,
    portal: { x: 940, y: 530 },
    objects: [
      ground(0, 330), ground(520, 480),
      plank(110, 300, 230),
      block(700, 445, 44, 120)
    ],
    shards: [{ x: 425, y: 538 }]
  },
  {
    name: "THORNS",
    hint: "Spikes are deadly. Drag them out of the way.",
    par: 16,
    portal: { x: 940, y: 530 },
    objects: [
      ground(0, 1000),
      spikes(250, 150), spikes(520, 130),
      block(780, 445, 40, 120)
    ],
    shards: [{ x: 460, y: 538 }, { x: 700, y: 538 }]
  },
  {
    name: "SPRING",
    hint: "These spikes are anchored. Place the spring pad just before them to leap over.",
    par: 18,
    portal: { x: 940, y: 530 },
    objects: [
      ground(0, 1000),
      spikes(480, 44, true),
      spring(140, GROUND_Y - 12),
      block(780, 445, 40, 120)
    ],
    shards: [{ x: 700, y: 538 }, { x: 487, y: 285 }]
  },
  {
    name: "TIDES",
    hint: "The bridge moves on its own. Hold SPACE to freeze the traveler while you wait for it.",
    par: 20,
    portal: { x: 950, y: 530 },
    objects: [
      ground(0, 260), ground(740, 260),
      mover(430, GROUND_Y, 140, 170, 0, 1.1, Math.PI / 2),
      block(860, 445, 40, 120)
    ],
    shards: [{ follow: 2, dx: 70, dy: -27 }, { x: 800, y: 538 }]
  },
  {
    name: "ASCENT",
    hint: "The portal is up on the cliff. Aim a spring pad so the traveler lands on top.",
    par: 18,
    portal: { x: 900, y: 312 },
    objects: [
      ground(0, 1000),
      ledge(760, 340, 240),
      spring(120, GROUND_Y - 12),
      block(380, 445, 40, 120)
    ],
    shards: [{ x: 300, y: 538 }, { x: 740, y: 290 }]
  },
  {
    name: "SPLIT",
    hint: "Bridge the gap, spring over the anchored spikes, then clear the wall.",
    par: 22,
    portal: { x: 955, y: 530 },
    objects: [
      ground(0, 300), ground(480, 520),
      plank(150, 250, 200),
      spikes(700, 44, true),
      spring(400, 140),
      block(880, 445, 40, 120)
    ],
    shards: [{ follow: 2, dx: 100, dy: -27 }, { x: 706, y: 285 }]
  },
  {
    name: "ELEVATOR",
    hint: "Wait at the edge (SPACE) for the lift. Then spring over the spikes up top.",
    par: 26,
    portal: { x: 950, y: 330 },
    objects: [
      ground(0, 300),
      ledge(420, 365, 580),
      mover(300, 465, 120, 0, 100, 1.3, -2.0),
      spikes(640, 44, true, 365),
      spring(470, 353),
      block(830, 245, 40, 120)
    ],
    shards: [{ follow: 2, dx: 60, dy: -27 }, { x: 640, y: 80 }]
  },
  {
    name: "CONVERGENCE",
    hint: "Everything at once. Time the bridge, then place both springs.",
    par: 26,
    portal: { x: 930, y: 530 },
    objects: [
      ground(0, 200),
      mover(270, GROUND_Y, 120, 70, 0, 1.7, Math.PI / 2),
      ground(460, 540),
      spikes(600, 44, true),
      spikes(820, 44, true),
      spring(120, 140),
      spring(260, 140)
    ],
    shards: [{ follow: 1, dx: 60, dy: -27 }, { x: 610, y: 285 }, { x: 830, y: 285 }]
  }
];

/* ---------- Visual themes (two levels per theme) ---------- */
const THEMES = [
  {
    top: "#0d1530", bottom: "#070914", star: "160,200,255", grid: "100,150,220",
    portal: "#b15cff", portalSoft: "177,92,255",
    blobs: [{ x: 0.2, y: 0.3, r: 0.55, c: "rgba(60,120,255,0.20)" }, { x: 0.8, y: 0.7, r: 0.5, c: "rgba(130,80,255,0.15)" }]
  },
  {
    top: "#07201f", bottom: "#050f12", star: "150,255,230", grid: "90,200,190",
    portal: "#4fffd0", portalSoft: "79,255,208",
    blobs: [{ x: 0.25, y: 0.65, r: 0.55, c: "rgba(40,200,180,0.18)" }, { x: 0.75, y: 0.25, r: 0.5, c: "rgba(60,140,255,0.14)" }]
  },
  {
    top: "#221015", bottom: "#0f070b", star: "255,200,170", grid: "220,130,100",
    portal: "#ff9a5c", portalSoft: "255,154,92",
    blobs: [{ x: 0.3, y: 0.35, r: 0.55, c: "rgba(255,110,60,0.17)" }, { x: 0.8, y: 0.75, r: 0.5, c: "rgba(255,60,120,0.13)" }]
  },
  {
    top: "#1a0e30", bottom: "#0a0618", star: "220,190,255", grid: "170,120,230",
    portal: "#ff6cf0", portalSoft: "255,108,240",
    blobs: [{ x: 0.2, y: 0.7, r: 0.55, c: "rgba(170,80,255,0.20)" }, { x: 0.85, y: 0.3, r: 0.5, c: "rgba(255,80,200,0.12)" }]
  }
];

/* ================================================================
   STATE
   ================================================================ */
let state = "menu";            // menu | ready | running | dying | won
let levelIndex = 0;

let screenW = 1000, screenH = 600, dpr = 1;
let scale = 1, offX = 0, offY = 0;

let objects = [];
let shards = [];
let portal = { x: 0, y: 0, radius: 28 };
let particles = [];
let trail = [];

let tt = 0;                    // level clock (drives movers)
let elapsed = 0;               // time of the current attempt
let time = 0;                  // visual clock
let deaths = 0;
let readyTimer = 0;
let deathTimer = 0;
let winTimer = 0;
let shake = 0;
let flash = 0;
let flashColor = "255,255,255";
let camX = 0, camY = 0;        // how far the world has been slid (for the grid)

let stasisMeter = STASIS_MAX;
let stasisKey = false;
let stasisBtn = false;
let stasisHeld = false;

let result = null;

const player = {
  x: SPAWN.x, y: SPAWN.y, vx: RUN_SPEED, vy: 0,
  grounded: true, launched: false
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, "0");
const starString = n => "★".repeat(n) + "☆".repeat(3 - n);
const theme = () => THEMES[Math.min(THEMES.length - 1, Math.floor(levelIndex / 2))];
const isSolid = o => o.type !== "spike";

/* ---------- Save data ---------- */
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s.unlocked === "number" && s.best) return s;
  } catch (e) { /* ignore */ }
  return { unlocked: 1, best: {} };
}

function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

let save = loadSave();

/* ---------- Audio (tiny synthesized sound effects) ---------- */
let audio = null;
let muted = false;

function ensureAudio() {
  if (audio) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audio = new AC();
  } catch (e) { audio = null; }
}

function tone(freq, dur, type = "sine", vol = 0.06, slideTo = 0, delay = 0) {
  if (!audio || muted) return;
  const t = audio.currentTime + delay;
  const o = audio.createOscillator();
  const g = audio.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(audio.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function sfx(name) {
  switch (name) {
    case "shard":  tone(880, 0.12, "triangle", 0.07); tone(1320, 0.18, "triangle", 0.07, 0, 0.07); break;
    case "bounce": tone(220, 0.25, "square", 0.04, 700); break;
    case "death":  tone(300, 0.4, "sawtooth", 0.06, 60); break;
    case "go":     tone(520, 0.1, "triangle", 0.05); tone(780, 0.14, "triangle", 0.05, 0, 0.08); break;
    case "win":    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, "triangle", 0.07, 0, i * 0.1)); break;
    case "grab":   tone(400, 0.05, "sine", 0.03); break;
    case "stasis": tone(660, 0.3, "sine", 0.04, 330); break;
  }
}

/* ================================================================
   LEVEL LOADING
   ================================================================ */
function loadLevel(i, clearFx = true) {
  levelIndex = i;
  const lvl = LEVELS[i];

  objects = lvl.objects.map(o => ({ ...o, bx: o.x, by: o.y, ox: 0, oy: 0, squash: 0 }));
  objects.forEach(o => {
    if (o.type === "mover") {
      const s = Math.sin(o.phase);
      o.ox = o.ax * s;
      o.oy = o.ay * s;
      o.x = o.bx + o.ox;
      o.y = o.by + o.oy;
    }
  });

  shards = lvl.shards.map((s, k) => {
    const sh = { ...s, got: false, seed: k * 1.7 };
    sh.target = s.follow !== undefined ? objects[s.follow] : null;
    if (sh.target) {
      sh.x = sh.target.x + s.dx;
      sh.y = sh.target.y + s.dy;
    }
    return sh;
  });

  portal = { x: lvl.portal.x, y: lvl.portal.y, radius: 28 };

  player.x = SPAWN.x;
  player.y = SPAWN.y;
  player.vx = RUN_SPEED;
  player.vy = 0;
  player.grounded = true;
  player.launched = false;

  trail = [];
  if (clearFx) particles = [];
  tt = 0;
  elapsed = 0;
  camX = 0;
  camY = 0;
  stasisMeter = STASIS_MAX;
  stasisHeld = false;
  dragging = null;
  panning = false;
  hoverObj = null;

  levelLabel.textContent = `DIMENSION ${pad2(i + 1)} / ${pad2(LEVELS.length)}`;
}

function enterReady() {
  state = "ready";
  readyTimer = READY_TIME;
  controlsEl.classList.remove("hidden");
}

function startLevel(i, fresh = true) {
  if (fresh) deaths = 0;
  loadLevel(i);
  startScreen.classList.add("hidden");
  winScreen.classList.add("hidden");
  enterReady();
}

function retryLevel() {
  loadLevel(levelIndex, false);
  enterReady();
}

function resetLevel() {
  if (state !== "ready" && state !== "running" && state !== "dying") return;
  retryLevel();
}

function beginRun() {
  if (state !== "ready") return;
  state = "running";
  elapsed = 0;
  sfx("go");
  burst(player.x, player.y, 10, "120,234,255", 2, 0.5, 2);
}

function showMenu() {
  state = "menu";
  stasisKey = stasisBtn = false;
  const idx = Math.min(save.unlocked - 1, LEVELS.length - 1);
  loadLevel(idx);
  buildMenu();
  startButton.textContent = save.unlocked > 1 ? "CONTINUE" : "ENTER WORLD";
  startScreen.classList.remove("hidden");
  winScreen.classList.add("hidden");
  controlsEl.classList.add("hidden");
}

function buildMenu() {
  levelGrid.innerHTML = "";
  LEVELS.forEach((lvl, i) => {
    const btn = document.createElement("button");
    const open = i < save.unlocked;
    const best = save.best[i];
    btn.type = "button";
    btn.className = "level-btn";
    btn.disabled = !open;
    btn.innerHTML =
      `<span class="lv-num">${pad2(i + 1)}</span>` +
      `<span class="lv-name">${lvl.name}</span>` +
      `<span class="lv-stars">${open ? starString(best ? best.stars : 0) : "LOCKED"}</span>`;
    btn.addEventListener("click", () => {
      ensureAudio();
      startLevel(i);
    });
    levelGrid.appendChild(btn);
  });
}

/* ================================================================
   PARTICLES
   ================================================================ */
function burst(x, y, n, rgb, speed = 3, life = 0.8, size = 3) {
  for (let i = 0; i < n && particles.length < 500; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = (0.3 + Math.random() * 0.7) * speed;
    particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      g: 0.04, life: life * (0.6 + Math.random() * 0.4), max: life,
      size: size * (0.6 + Math.random() * 0.8), rgb
    });
  }
}

function spawnPortalSwirl() {
  if (particles.length > 400 || Math.random() > 0.35) return;
  particles.push({
    kind: "swirl", a: Math.random() * Math.PI * 2, r: 70 + Math.random() * 20,
    life: 1.1, max: 1.1, size: 2, rgb: theme().portalSoft, x: 0, y: 0, vx: 0, vy: 0
  });
}

function updateParticles() {
  for (const p of particles) {
    p.life -= STEP;
    if (p.kind === "swirl") {
      p.a += 0.07;
      p.r -= 1.1;
      p.x = portal.x + Math.cos(p.a) * p.r;
      p.y = portal.y + Math.sin(p.a) * p.r * 0.9;
    } else {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.g;
      p.vx *= 0.99;
    }
  }
  particles = particles.filter(p => p.life > 0 && !(p.kind === "swirl" && p.r < 8));
}

/* ================================================================
   PHYSICS
   ================================================================ */
function shiftWorld(dx, dy) {
  objects.forEach(o => { o.x += dx; o.y += dy; o.bx += dx; o.by += dy; });
  shards.forEach(s => { if (!s.target) { s.x += dx; s.y += dy; } });
  portal.x += dx;
  portal.y += dy;
  trail.forEach(p => { p.x += dx; p.y += dy; });
  camX += dx;
  camY += dy;
}

function updateMovers() {
  tt += STEP;

  for (const o of objects) {
    if (o.type !== "mover") continue;

    const oldX = o.x, oldY = o.y;
    const s = Math.sin(o.phase + tt * o.speed);
    const nox = o.ax * s;
    const noy = o.ay * s;

    if (o === dragging) {
      // keep the dragged mover under the pointer; only the base follows the oscillation
      o.ox = nox;
      o.oy = noy;
      o.bx = o.x - nox;
      o.by = o.y - noy;
      continue;
    }

    const riding =
      player.x > oldX - 2 && player.x < oldX + o.w + 2 &&
      Math.abs(player.y + PLAYER_R - oldY) < 3 && player.vy >= 0;

    o.ox = nox;
    o.oy = noy;
    o.x = o.bx + nox;
    o.y = o.by + noy;

    if (riding) {
      player.x += o.x - oldX;
      player.y += o.y - oldY;
    }
  }

  shards.forEach(s => {
    if (s.target) {
      s.x = s.target.x + s.dx;
      s.y = s.target.y + s.dy;
    }
  });
}

// Circle vs. rectangle resolution. Handles tops, sides and corners, and
// recovers if a dragged block ends up on top of the traveler.
function resolveCollisions(allowBounce) {
  player.grounded = false;
  let bounced = null;
  const r = PLAYER_R;

  for (let pass = 0; pass < 3; pass++) {
    for (const obj of objects) {
      if (!isSolid(obj)) continue;

      const cx = clamp(player.x, obj.x, obj.x + obj.w);
      const cy = clamp(player.y, obj.y, obj.y + obj.h);
      const dx = player.x - cx;
      const dy = player.y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 >= r * r) continue;

      let ny = 0;

      if (d2 === 0) {
        const toLeft = player.x - obj.x;
        const toRight = obj.x + obj.w - player.x;
        const toTop = player.y - obj.y;
        const toBottom = obj.y + obj.h - player.y;
        const m = Math.min(toLeft, toRight, toTop, toBottom);

        if (m === toTop)        { player.y = obj.y - r; ny = -1; }
        else if (m === toLeft)  { player.x = obj.x - r; }
        else if (m === toRight) { player.x = obj.x + obj.w + r; }
        else                    { player.y = obj.y + obj.h + r; ny = 1; }
      } else {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        ny = dy / d;
        const push = r - d;
        player.x += nx * push;
        player.y += ny * push;
      }

      if (ny < -0.5) {
        player.grounded = true;
        if (player.vy > 0) player.vy = 0;
      } else if (ny > 0.5 && player.vy < 0) {
        player.vy = 0;
      }

      // touching a spring from above or from the side launches the traveler
      if (allowBounce && obj.type === "bounce" && player.y < obj.y + obj.h) bounced = obj;
    }
  }

  if (bounced) {
    player.vy = -BOUNCE_V;
    player.grounded = false;
    player.launched = true;
    bounced.squash = 1;
    sfx("bounce");
    burst(player.x, player.y + PLAYER_R, 12, "120,255,170", 2.2, 0.5, 2.5);
  }
}

function movePlayer() {
  player.vy = Math.min(player.vy + GRAVITY, MAX_FALL);
  player.vx = player.launched ? AIR_BOOST : RUN_SPEED;

  player.x += player.vx;
  player.y += player.vy;

  resolveCollisions(true);
  if (player.grounded) player.launched = false;
}

function hitsSpike() {
  const r = PLAYER_R - 2;
  for (const o of objects) {
    if (o.type !== "spike") continue;
    const x = o.x + 3, y = o.y + 6, w = o.w - 6, h = o.h - 6;
    const cx = clamp(player.x, x, x + w);
    const cy = clamp(player.y, y, y + h);
    if ((player.x - cx) ** 2 + (player.y - cy) ** 2 < r * r) return true;
  }
  return false;
}

function die() {
  if (state !== "running") return;
  state = "dying";
  deathTimer = DEATH_DELAY;
  deaths++;
  shake = 0.5;
  flash = 0.5;
  flashColor = "255,70,90";
  burst(player.x, player.y, 32, "255,120,140", 4.5, 0.9, 3.5);
  burst(player.x, player.y, 14, "255,255,255", 3, 0.6, 2);
  sfx("death");
}

function win() {
  if (state !== "running") return;
  state = "won";
  winTimer = WIN_DELAY;
  flash = 0.6;
  flashColor = "255,255,255";

  const got = shards.filter(s => s.got).length;
  const total = shards.length;
  const par = LEVELS[levelIndex].par;
  const earned = [true, got === total, elapsed <= par];
  const stars = earned.filter(Boolean).length;

  result = { got, total, par, earned, stars, time: elapsed, deaths };

  const prev = save.best[levelIndex];
  save.best[levelIndex] = {
    stars: Math.max(stars, prev ? prev.stars : 0),
    time: prev ? Math.min(prev.time, elapsed) : elapsed
  };
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIndex + 2));
  writeSave();

  burst(portal.x, portal.y, 50, theme().portalSoft, 5, 1.1, 3.5);
  sfx("win");
}

function showWinScreen() {
  if (!result) return;
  const last = levelIndex === LEVELS.length - 1;
  winTitle.textContent = last ? "ALL DIMENSIONS COMPLETE" : "DIMENSION COMPLETE";
  winText.textContent = last ? "The world is yours to shape." : "You found a way through.";
  winStarsEl.innerHTML = [
    [result.earned[0], "DIMENSION COMPLETE"],
    [result.earned[1], `ALL SHARDS (${result.got}/${result.total})`],
    [result.earned[2], `UNDER PAR (${result.par}s)`]
  ].map(([ok, label]) =>
    `<li class="${ok ? "earned" : ""}"><span>${ok ? "★" : "☆"}</span>${label}</li>`
  ).join("");
  winTime.textContent = `TIME ${result.time.toFixed(1)}s  ·  DEATHS ${result.deaths}`;
  nextButton.classList.toggle("hidden", last);
  winScreen.classList.remove("hidden");
  controlsEl.classList.add("hidden");
}

function nextLevel() {
  if (levelIndex < LEVELS.length - 1) startLevel(levelIndex + 1);
}

function updateRunning() {
  elapsed += STEP;

  const want = stasisKey || stasisBtn;
  const frozen = want && stasisMeter > 0;
  if (frozen) stasisMeter = Math.max(0, stasisMeter - STASIS_DRAIN * STEP);
  else if (!want) stasisMeter = Math.min(STASIS_MAX, stasisMeter + STASIS_REGEN * STEP);

  if (frozen && !stasisHeld) sfx("stasis");
  stasisHeld = frozen;

  if (!dragging && !panning) applyShiftKeys();
  updateMovers();

  if (frozen) resolveCollisions(false);   // stasis: no walking, no gravity
  else movePlayer();

  // collect shards
  for (const s of shards) {
    if (s.got) continue;
    if (Math.hypot(player.x - s.x, player.y - s.y) < PLAYER_R + 10) {
      s.got = true;
      burst(s.x, s.y, 16, "255,230,120", 3, 0.7, 2.5);
      sfx("shard");
    }
  }

  // hazards
  if (player.y > WORLD_H + 60 || player.y < -300 || player.x < -60 || player.x > WORLD_W + 60 || hitsSpike()) {
    die();
    return;
  }

  // portal
  if (Math.hypot(player.x - portal.x, player.y - portal.y) < portal.radius + PLAYER_R - 4) {
    win();
    return;
  }

  trail.push({ x: player.x, y: player.y, life: 24 });
  spawnPortalSwirl();
}

function step() {
  updateParticles();
  if (shake > 0) shake = Math.max(0, shake - STEP);
  if (flash > 0) flash = Math.max(0, flash - STEP * 1.5);

  trail.forEach(p => p.life--);
  trail = trail.filter(p => p.life > 0);

  if (state === "menu") return;

  objects.forEach(o => { if (o.squash > 0) o.squash = Math.max(0, o.squash - 0.07); });

  if (state === "ready") {
    if (!dragging && !panning) applyShiftKeys();
    spawnPortalSwirl();
    readyTimer -= STEP;
    if (readyTimer <= 0) beginRun();
  } else if (state === "running") {
    updateRunning();
  } else if (state === "dying") {
    deathTimer -= STEP;
    if (deathTimer <= 0) retryLevel();
  } else if (state === "won") {
    winTimer -= STEP;
    if (winTimer <= 0) { winTimer = 1e9; showWinScreen(); }
  }
}

/* ================================================================
   INPUT
   ================================================================ */
let dragging = null;
let dragOffsetX = 0, dragOffsetY = 0;
let panning = false;
let lastX = 0, lastY = 0;
let hoverObj = null;

const keys = new Set();
const SHIFT_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"]);

function toWorld(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left - offX) / scale, y: (e.clientY - rect.top - offY) / scale };
}

function hitTest(mx, my) {
  for (let i = objects.length - 1; i >= 0; i--) {
    const o = objects[i];
    const pad = o.h < 20 ? 8 : 2;
    if (mx >= o.x - pad && mx <= o.x + o.w + pad && my >= o.y - pad && my <= o.y + o.h + pad) return o;
  }
  return null;
}

function canInteract() {
  return state === "ready" || state === "running";
}

canvas.addEventListener("pointerdown", e => {
  if (!canInteract()) return;
  ensureAudio();

  const { x: mx, y: my } = toWorld(e);
  const o = hitTest(mx, my);

  if (o && !o.fixed) {
    dragging = o;
    dragOffsetX = mx - o.x;
    dragOffsetY = my - o.y;

    // bring the grabbed object to the front
    objects.splice(objects.indexOf(o), 1);
    objects.push(o);
    sfx("grab");
  } else {
    // dragging empty space (or an anchored object) slides the whole world
    panning = true;
    lastX = mx;
    lastY = my;
  }

  canvas.setPointerCapture(e.pointerId);
  canvas.style.cursor = dragging ? "grabbing" : "move";
});

canvas.addEventListener("pointermove", e => {
  const { x: mx, y: my } = toWorld(e);

  if (dragging) {
    dragging.x = mx - dragOffsetX;
    dragging.y = my - dragOffsetY;
    dragging.bx = dragging.x - dragging.ox;
    dragging.by = dragging.y - dragging.oy;
  } else if (panning) {
    shiftWorld(mx - lastX, my - lastY);
    lastX = mx;
    lastY = my;
  } else if (canInteract()) {
    const o = hitTest(mx, my);
    hoverObj = o && !o.fixed ? o : null;
    canvas.style.cursor = hoverObj ? "grab" : "default";
  }
});

function stopPointer() {
  dragging = null;
  panning = false;
  canvas.style.cursor = "default";
}

canvas.addEventListener("pointerup", stopPointer);
canvas.addEventListener("pointercancel", stopPointer);

window.addEventListener("blur", () => {
  stopPointer();
  keys.clear();
  stasisKey = false;
  stasisBtn = false;
});

window.addEventListener("keydown", e => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (key === "m") { toggleMute(); return; }
  if (state === "menu") return;

  if (SHIFT_KEYS.has(key)) {
    e.preventDefault();
    keys.add(key);
  }

  if (key === " ") {
    e.preventDefault();
    if (canInteract()) stasisKey = true;
  }

  if (e.repeat) return;

  if (key === "Enter") {
    if (state === "ready") beginRun();
    else if (state === "won" && !winScreen.classList.contains("hidden")) nextLevel();
  }

  if (key === "r") {
    if (state === "won") startLevel(levelIndex);
    else resetLevel();
  }

  if (key === "Escape") showMenu();
});

window.addEventListener("keyup", e => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys.delete(key);
  if (key === " ") {
    e.preventDefault();
    stasisKey = false;
  }
});

function applyShiftKeys() {
  if (keys.has("ArrowLeft") || keys.has("a")) shiftWorld(SHIFT_SPEED, 0);
  if (keys.has("ArrowRight") || keys.has("d")) shiftWorld(-SHIFT_SPEED, 0);
  if (keys.has("ArrowUp") || keys.has("w")) shiftWorld(0, SHIFT_SPEED);
  if (keys.has("ArrowDown") || keys.has("s")) shiftWorld(0, -SHIFT_SPEED);
}

/* ---------- Buttons ---------- */
function onClick(el, fn) {
  el.addEventListener("click", () => {
    ensureAudio();
    fn();
    if (el.blur) el.blur();
  });
}

onClick(startButton, () => startLevel(Math.min(save.unlocked - 1, LEVELS.length - 1)));
onClick(nextButton, nextLevel);
onClick(restartButton, () => startLevel(levelIndex));
onClick(winMenuButton, showMenu);
onClick(menuButton, showMenu);
onClick(resetButton, resetLevel);
onClick(soundButton, toggleMute);
onClick(clearSaveButton, () => {
  if (typeof confirm === "function" && !confirm("Erase all progress?")) return;
  save = { unlocked: 1, best: {} };
  writeSave();
  showMenu();
});

stasisButton.addEventListener("pointerdown", e => {
  e.preventDefault();
  ensureAudio();
  if (canInteract()) stasisBtn = true;
});
["pointerup", "pointerleave", "pointercancel"].forEach(ev =>
  stasisButton.addEventListener(ev, () => { stasisBtn = false; })
);

function toggleMute() {
  muted = !muted;
  soundButton.textContent = muted ? "SOUND: OFF" : "SOUND: ON";
}

/* ================================================================
   RENDERING
   ================================================================ */
function resize() {
  const rect = canvas.getBoundingClientRect();
  screenW = rect.width;
  screenH = rect.height;
  dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(screenW * dpr));
  canvas.height = Math.max(1, Math.round(screenH * dpr));
  scale = Math.min(screenW / WORLD_W, screenH / WORLD_H);
  offX = (screenW - WORLD_W * scale) / 2;
  offY = (screenH - WORLD_H * scale) / 2;
}

window.addEventListener("resize", resize);

// background stars are generated once
const stars = Array.from({ length: 90 }, (_, i) => ({
  fx: (i * 0.6180339) % 1,
  fy: (i * 0.3819660 + (i % 7) * 0.07) % 1,
  size: 1 + (i % 4) * 0.45,
  speed: 2 + (i % 5) * 3,
  alpha: 0.15 + (i % 5) * 0.09,
  par: 0.03 + (i % 3) * 0.04
}));

let hatch = null;
function makeHatch() {
  const c = document.createElement("canvas");
  c.width = c.height = 14;
  const g = c.getContext("2d");
  g.strokeStyle = "rgba(255,255,255,0.07)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(0, 14); g.lineTo(14, 0);
  g.moveTo(-7, 7); g.lineTo(7, -7);
  g.moveTo(7, 21); g.lineTo(21, 7);
  g.stroke();
  return ctx.createPattern(c, "repeat");
}

function drawBackground() {
  const th = theme();

  const g = ctx.createLinearGradient(0, 0, 0, screenH);
  g.addColorStop(0, th.top);
  g.addColorStop(1, th.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, screenW, screenH);

  th.blobs.forEach((b, i) => {
    const bx = screenW * (b.x + 0.06 * Math.sin(time * 0.12 + i * 2));
    const by = screenH * (b.y + 0.05 * Math.cos(time * 0.10 + i * 3));
    const rad = Math.max(screenW, screenH) * b.r;
    const rg = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
    rg.addColorStop(0, b.c);
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, screenW, screenH);
  });

  // stars drift slowly and slide a little when you shift the world
  for (const s of stars) {
    const x = (((s.fx * screenW - time * s.speed + camX * s.par * scale) % screenW) + screenW) % screenW;
    const y = (((s.fy * screenH + camY * s.par * scale) % screenH) + screenH) % screenH;
    const tw = 0.7 + 0.3 * Math.sin(time * 1.6 + s.fx * 40);
    ctx.fillStyle = `rgba(${th.star},${s.alpha * tw})`;
    ctx.fillRect(x, y, s.size, s.size);
  }

  // grid that slides with the world
  const gs = 45 * scale;
  const gx = (((offX + camX * scale) % gs) + gs) % gs;
  const gy = (((offY + camY * scale) % gs) + gs) % gs;
  ctx.strokeStyle = `rgba(${th.grid},0.05)`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = gx; x < screenW; x += gs) { ctx.moveTo(x, 0); ctx.lineTo(x, screenH); }
  for (let y = gy; y < screenH; y += gs) { ctx.moveTo(0, y); ctx.lineTo(screenW, y); }
  ctx.stroke();
}

function drawSlab(o, top, mid, bot, glow, edge) {
  ctx.save();
  ctx.shadowBlur = o.fixed ? 6 : 15;
  ctx.shadowColor = glow;

  const g = ctx.createLinearGradient(0, o.y, 0, o.y + Math.min(o.h, 140));
  g.addColorStop(0, mid);
  g.addColorStop(1, bot);
  ctx.fillStyle = g;
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.shadowBlur = 0;

  if (o.fixed && hatch) {
    ctx.fillStyle = hatch;
    ctx.fillRect(o.x, o.y, o.w, o.h);
  }

  ctx.fillStyle = edge;
  ctx.fillRect(o.x, o.y, o.w, 3);

  if (!o.fixed && o.h <= 30) {
    // grip dots so you can tell it can be dragged
    ctx.fillStyle = top;
    for (let x = o.x + 14; x < o.x + o.w - 8; x += 16) {
      ctx.fillRect(x, o.y + o.h / 2 - 1, 3, 3);
    }
  }
  ctx.restore();
}

function drawBlock(o) {
  ctx.save();
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#ad65ff";
  ctx.fillStyle = "#38274f";
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.shadowBlur = 0;
  if (hatch) { ctx.fillStyle = hatch; ctx.fillRect(o.x, o.y, o.w, o.h); }
  ctx.strokeStyle = "#b477ff";
  ctx.lineWidth = 2;
  ctx.strokeRect(o.x, o.y, o.w, o.h);
  ctx.restore();
}

function drawSpikes(o) {
  const n = Math.max(1, Math.round(o.w / 14));
  const sw = o.w / n;
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#ff4d6a";

  const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
  g.addColorStop(0, "#ffb199");
  g.addColorStop(1, "#d6304f");
  ctx.fillStyle = g;

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    ctx.moveTo(o.x + i * sw, o.y + o.h);
    ctx.lineTo(o.x + (i + 0.5) * sw, o.y);
    ctx.lineTo(o.x + (i + 1) * sw, o.y + o.h);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = o.fixed ? "#3a2030" : "#8a3045";
  ctx.fillRect(o.x - 2, o.y + o.h - 2, o.w + 4, 5);
  if (o.fixed && hatch) {
    ctx.fillStyle = hatch;
    ctx.fillRect(o.x - 2, o.y + o.h - 2, o.w + 4, 5);
  }
  ctx.restore();
}

function drawSpring(o) {
  const sq = o.squash;
  const topY = o.y + sq * 6;
  ctx.save();
  ctx.shadowBlur = 14;
  ctx.shadowColor = "#4dff9a";

  // coil
  ctx.strokeStyle = "#7dffb8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  const zig = 5;
  for (let i = 0; i <= zig; i++) {
    const x = o.x + 8 + ((o.w - 16) * i) / zig;
    const y = i % 2 ? o.y + o.h - 3 : topY + 5;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // plates
  ctx.fillStyle = "#b9ffd9";
  ctx.fillRect(o.x, topY, o.w, 5);
  ctx.fillStyle = "#2f9c67";
  ctx.fillRect(o.x - 2, o.y + o.h - 3, o.w + 4, 4);
  ctx.restore();
}

function drawMoverTrack(o) {
  if (!o.ax && !o.ay) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,190,90,0.22)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 8]);
  ctx.beginPath();
  ctx.moveTo(o.bx - o.ax + o.w / 2, o.by - o.ay + o.h / 2);
  ctx.lineTo(o.bx + o.ax + o.w / 2, o.by + o.ay + o.h / 2);
  ctx.stroke();
  ctx.restore();
}

function drawMover(o) {
  ctx.save();
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ffb347";

  const g = ctx.createLinearGradient(0, o.y, 0, o.y + o.h);
  g.addColorStop(0, "#6b4a1f");
  g.addColorStop(1, "#3d2a12");
  ctx.fillStyle = g;
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ffc86b";
  ctx.fillRect(o.x, o.y, o.w, 3);

  // chevrons show which way it travels
  ctx.fillStyle = "rgba(255,200,110,0.8)";
  const horizontal = o.ax >= o.ay;
  const cy = o.y + o.h / 2 + 1;
  for (let k = 0; k < 3; k++) {
    const cx = o.x + o.w / 2 + (k - 1) * 18;
    ctx.beginPath();
    if (horizontal) {
      ctx.moveTo(cx - 3, cy - 4); ctx.lineTo(cx + 3, cy); ctx.lineTo(cx - 3, cy + 4);
    } else {
      ctx.moveTo(cx - 4, cy + 2); ctx.lineTo(cx, cy - 4); ctx.lineTo(cx + 4, cy + 2);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawObject(o) {
  switch (o.type) {
    case "platform":
      if (o.fixed) drawSlab(o, "#4aa8d8", "#1b3350", "#0f1c2f", "#2a6fa8", "#4aa8d8");
      else drawSlab(o, "#62caff", "#2a4f78", "#1a3452", "#39aaff", "#62caff");
      break;
    case "block":  drawBlock(o); break;
    case "spike":  drawSpikes(o); break;
    case "bounce": drawSpring(o); break;
    case "mover":  drawMover(o); break;
  }

  if (o === dragging) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.65)";
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 4]);
    ctx.strokeRect(o.x - 3, o.y - 3, o.w + 6, o.h + 6);
    ctx.restore();
  } else if (o === hoverObj) {
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 1;
    ctx.strokeRect(o.x - 2, o.y - 2, o.w + 4, o.h + 4);
    ctx.restore();
  }
}

function drawShard(s, i) {
  if (s.got) return;
  const bob = Math.sin(time * 2.2 + s.seed) * 3;
  const spin = Math.cos(time * 2.4 + s.seed);
  ctx.save();
  ctx.translate(s.x, s.y + bob);
  ctx.shadowBlur = 18;
  ctx.shadowColor = "#ffd75e";
  ctx.fillStyle = "#ffe48a";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(7 * spin, 0);
  ctx.lineTo(0, 10);
  ctx.lineTo(-7 * spin, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(2.5 * spin, -2);
  ctx.lineTo(0, 1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawPortal() {
  const th = theme();
  const pulse = 1 + Math.sin(time * 3) * 0.05;
  ctx.save();
  ctx.translate(portal.x, portal.y);

  const core = ctx.createRadialGradient(0, 0, 2, 0, 0, portal.radius);
  core.addColorStop(0, `rgba(${th.portalSoft},0.55)`);
  core.addColorStop(1, `rgba(${th.portalSoft},0)`);
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(0, 0, portal.radius * pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 25;
  ctx.shadowColor = th.portal;
  ctx.lineCap = "round";

  for (let k = 0; k < 3; k++) {
    ctx.save();
    ctx.rotate(time * (k % 2 ? -1 : 1) * (0.9 + k * 0.5));
    ctx.strokeStyle = th.portal;
    ctx.globalAlpha = 1 - k * 0.22;
    ctx.lineWidth = 4 - k;
    ctx.beginPath();
    ctx.arc(0, 0, (portal.radius - k * 7) * pulse, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}

function drawTrail() {
  trail.forEach(p => {
    const t = p.life / 24;
    ctx.fillStyle = `rgba(120,234,255,${t * 0.35})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_R * 0.6 * t, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  if (state === "menu" || state === "dying") return;

  const frozen = state === "running" && stasisHeld;
  const stretch = clamp(Math.abs(player.vy) * 0.025, 0, 0.25);

  ctx.save();
  ctx.translate(player.x, player.y);

  ctx.shadowBlur = 25;
  ctx.shadowColor = frozen ? "#aee6ff" : "#6deaff";

  const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, PLAYER_R * 2);
  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.35, frozen ? "#c8ecff" : "#78eaff");
  glow.addColorStop(1, "rgba(38,118,255,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.scale(1 - stretch * 0.5, 1 + stretch);
  ctx.fillStyle = frozen ? "#eaf8ff" : "#d5fbff";
  ctx.beginPath();
  ctx.arc(0, 0, PLAYER_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // little eye that looks where the traveler is heading
  ctx.fillStyle = "#14344a";
  ctx.beginPath();
  ctx.arc(4, -2, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(4.8, -2.8, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (frozen) {
    ctx.save();
    ctx.strokeStyle = `rgba(190,235,255,${0.5 + 0.3 * Math.sin(time * 8)})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.lineDashOffset = -time * 20;
    ctx.beginPath();
    ctx.arc(player.x, player.y, PLAYER_R + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    const a = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = `rgba(${p.rgb},${a})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (p.kind === "swirl" ? a + 0.3 : a), 0, Math.PI * 2);
    ctx.fill();
  }
}

function setLetterSpacing(px) {
  if ("letterSpacing" in ctx) ctx.letterSpacing = px + "px";
}

function wrapText(text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawHud() {
  const lvl = LEVELS[levelIndex];
  ctx.save();
  ctx.textBaseline = "alphabetic";
  setLetterSpacing(2);

  // level name
  ctx.fillStyle = "rgba(140,159,202,0.85)";
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`${pad2(levelIndex + 1)} · ${lvl.name}`, 14, 22);

  // time and deaths
  ctx.textAlign = "right";
  ctx.fillText(`${elapsed.toFixed(1)}s  ·  ☠ ${deaths}`, screenW - 14, 22);

  // shards
  ctx.textAlign = "center";
  const total = shards.length;
  for (let i = 0; i < total; i++) {
    const x = screenW / 2 + (i - (total - 1) / 2) * 20;
    ctx.fillStyle = shards[i].got ? "#ffe48a" : "rgba(255,228,138,0.25)";
    ctx.beginPath();
    ctx.moveTo(x, 10); ctx.lineTo(x + 6, 19); ctx.lineTo(x, 28); ctx.lineTo(x - 6, 19);
    ctx.closePath();
    ctx.fill();
  }

  // stasis meter
  const bw = Math.min(190, screenW * 0.4);
  const bx = (screenW - bw) / 2;
  const by = screenH - 22;
  const frac = stasisMeter / STASIS_MAX;
  ctx.fillStyle = "rgba(120,170,255,0.15)";
  ctx.fillRect(bx, by, bw, 6);
  ctx.fillStyle = stasisHeld ? "#d4f2ff" : frac < 0.25 ? "#ff7a8a" : "#6dc8ff";
  ctx.fillRect(bx, by, bw * frac, 6);
  ctx.fillStyle = "rgba(140,159,202,0.8)";
  ctx.font = "9px Arial, sans-serif";
  ctx.fillText("STASIS", screenW / 2, by - 6);

  ctx.restore();
}

function drawReadyOverlay() {
  const lvl = LEVELS[levelIndex];
  const w = Math.min(560, screenW - 40);
  ctx.save();
  ctx.textAlign = "center";

  ctx.font = "13px Arial, sans-serif";
  setLetterSpacing(0);
  const lines = wrapText(lvl.hint, w - 40);
  const panelH = 92 + lines.length * 19;
  const px = (screenW - w) / 2;
  const py = screenH * 0.08;

  ctx.fillStyle = "rgba(7,9,20,0.62)";
  ctx.strokeStyle = "rgba(90,155,206,0.35)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(px, py, w, panelH, 8) : ctx.rect(px, py, w, panelH);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = "#bce5ff";
  ctx.font = "20px Arial, sans-serif";
  setLetterSpacing(6);
  ctx.fillText(lvl.name, screenW / 2, py + 34);

  ctx.fillStyle = "#9fb0d0";
  ctx.font = "13px Arial, sans-serif";
  setLetterSpacing(0);
  lines.forEach((l, i) => ctx.fillText(l, screenW / 2, py + 58 + i * 19));

  ctx.fillStyle = "#6dc8ff";
  ctx.font = "10px Arial, sans-serif";
  setLetterSpacing(2);
  ctx.fillText(
    `RELEASE IN ${Math.max(0, readyTimer).toFixed(1)}  ·  ENTER TO GO NOW`,
    screenW / 2, py + panelH - 14
  );
  ctx.restore();
}

function drawOverlays() {
  // frost vignette while the traveler is held in stasis
  if (state === "running" && stasisHeld) {
    const g = ctx.createRadialGradient(
      screenW / 2, screenH / 2, Math.min(screenW, screenH) * 0.3,
      screenW / 2, screenH / 2, Math.max(screenW, screenH) * 0.7
    );
    g.addColorStop(0, "rgba(120,200,255,0)");
    g.addColorStop(1, "rgba(120,200,255,0.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, screenW, screenH);
  }

  if (flash > 0) {
    ctx.fillStyle = `rgba(${flashColor},${flash * 0.5})`;
    ctx.fillRect(0, 0, screenW, screenH);
  }

  if (state !== "menu") drawHud();
  if (state === "ready") drawReadyOverlay();
}

function draw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawBackground();

  ctx.save();
  const sx = shake > 0 ? (Math.random() - 0.5) * 16 * shake : 0;
  const sy = shake > 0 ? (Math.random() - 0.5) * 16 * shake : 0;
  ctx.translate(offX + sx, offY + sy);
  ctx.scale(scale, scale);

  objects.forEach(o => { if (o.type === "mover") drawMoverTrack(o); });
  objects.forEach(drawObject);
  shards.forEach(drawShard);
  drawPortal();
  drawTrail();
  drawPlayer();
  drawParticles();
  ctx.restore();

  drawOverlays();
}

/* ================================================================
   MAIN LOOP
   ================================================================ */
let lastFrame = performance.now();
let accumulator = 0;

function gameLoop(now) {
  // fixed timestep: same game speed on 60/120/144 Hz screens
  const delta = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  time += delta;
  accumulator += delta;

  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }

  stasisButton.classList.toggle("active", state === "running" && stasisHeld);
  draw();
  requestAnimationFrame(gameLoop);
}

/* ---------- Boot ---------- */
hatch = makeHatch();
resize();
showMenu();
requestAnimationFrame(gameLoop);
