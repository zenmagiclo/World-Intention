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
const undoButton = $("undoButton");
const hintButton = $("hintButton");

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
const ICE_SPEED = 3.3;         // speed the traveler slides up to on ice
const BELT_SPEED = 1.0;        // conveyor push
const CRUMBLE_TIME = 0.7;      // seconds before a crumbling platform drops

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
const flip   = (x, y, h = 120) => ({ x, y, w: 30, h, type: "flip" });
const ice    = (x, y, w) => ({ x, y, w, h: 20, type: "ice" });
const iceGround = (x, w) => ({ x, y: GROUND_Y, w, h: WORLD_H - GROUND_Y, type: "ice", fixed: true });
const belt   = (x, y, w, dir = 1) => ({ x, y, w, h: 20, type: "belt", dir });
const beltGround = (x, w, dir = 1, push = 0) => ({ x, y: GROUND_Y, w, h: WORLD_H - GROUND_Y, type: "belt", dir, push, fixed: true });
const wind   = (x, y, w, h, ax, ay) => ({ x, y, w, h, type: "wind", ax, ay });
const ceil   = (x, w) => ({ x, y: 0, w, h: 50, type: "platform", fixed: true });
const crumble = (x, y, w) => ({ x, y, w, h: 20, type: "crumble" });
// saw(centerX, centerY, radius, travelX, travelY, speed, phase)
const saw    = (cx, cy, r = 22, ax = 0, ay = 0, speed = 1, phase = 0) =>
  ({ x: cx - r, y: cy - r, w: r * 2, h: r * 2, type: "saw", r, ax, ay, speed, phase });
const sw     = (x, y, link, fixed = false, up = false) => ({ x, y, w: 44, h: 10, type: "switch", link, fixed, up });
const door   = (x, y, h, link) => ({ x, y, w: 22, h, type: "door", link, fixed: true });

const LEVELS = [
  {
    name: "FIRST SHIFT",
    hint: "Drag the plank over the gap and clear the wall. Arrow keys slide the whole world.",
    par: 18,
    solution: [[2, 300, 565], [3, 700, 250]],
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
    solution: [[1, 250, 100], [2, 520, 100], [3, 780, 250]],
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
    solution: [[2, 392, 553], [3, 780, 250]],
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
    solution: [[3, 860, 250]],
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
    solution: [[2, 660, 553], [3, 380, 250]],
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
    solution: [[2, 290, 565], [4, 590, 553], [5, 880, 250]],
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
    solution: [[4, 530, 353], [5, 830, 120]],
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
    solution: [[5, 512, 553], [6, 732, 553]],
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
  },
  {
    name: "FLIPSIDE",
    hint: "Magenta fields flip gravity. Flip onto the ceiling to pass the spikes, then flip back. You can only move 3 pieces.",
    par: 15,
    moves: 3,
    solution: [[3, 250, 300], [4, 700, 40], [5, 880, 250]],
    portal: { x: 945, y: 530 },
    objects: [
      ground(0, 1000), ceil(0, 1000),
      spikes(380, 240, true),
      flip(700, 300, 265), flip(790, 40, 200),
      block(880, 445, 40, 120)
    ],
    shards: [{ x: 500, y: 72 }, { x: 820, y: 538 }]
  },
  {
    name: "GLACIER",
    hint: "Ice makes the traveler speed up and keep its momentum. Time the spring over the anchored spikes.",
    par: 10,
    solution: [[2, 460, 553], [3, 860, 250]],
    portal: { x: 945, y: 530 },
    objects: [
      iceGround(0, 1000),
      spikes(520, 80, true),
      spring(130, GROUND_Y - 12),
      block(860, 445, 40, 120)
    ],
    shards: [{ x: 560, y: 290 }, { x: 760, y: 538 }]
  },
  {
    name: "TREADMILL",
    hint: "The conveyor pushes backwards faster than the traveler can walk. Leap over it.",
    par: 14,
    solution: [[3, 294, 553], [4, 860, 250]],
    portal: { x: 945, y: 530 },
    objects: [
      ground(0, 330), beltGround(330, 130, -1, 2.2), ground(460, 540),
      spring(100, GROUND_Y - 12),
      block(860, 445, 40, 120)
    ],
    shards: [{ x: 395, y: 300 }, { x: 700, y: 538 }]
  },
  {
    name: "UPDRAFT",
    hint: "A wind column can lift the traveler over the tower. Slide it into place.",
    par: 10,
    solution: [[2, 430, 300]],
    portal: { x: 630, y: 222 },
    objects: [
      ground(0, 1000),
      ledge(560, 250, 140),
      wind(100, 300, 70, 265, 0, -0.55)
    ],
    shards: [{ x: 555, y: 72 }]
  },
  {
    name: "LOCKSMITH",
    hint: "Step on the glowing switch to unlock the door. It sits up on the ledge, so aim your spring. One move only.",
    par: 14,
    moves: 1,
    solution: [[4, 210, 553]],
    portal: { x: 945, y: 530 },
    objects: [
      ground(0, 1000),
      ledge(300, 380, 160),
      sw(370, 370, "a", true),
      door(760, 235, 330, "a"),
      spring(100, GROUND_Y - 12)
    ],
    shards: [{ x: 440, y: 355 }, { x: 850, y: 538 }]
  },
  {
    name: "STEPPING STONES",
    hint: "Crumbling tiles drop 0.7s after you land. Lay the plank, then chain the tiles flush behind it. Edges snap together.",
    par: 15,
    moves: 4,
    solution: [[2, 260, 565], [3, 440, 565], [4, 490, 565], [5, 540, 565]],
    portal: { x: 945, y: 530 },
    objects: [
      ground(0, 260), ground(590, 410),
      plank(80, 150, 180),
      crumble(330, 150, 50), crumble(420, 150, 50), crumble(510, 150, 50)
    ],
    shards: [{ x: 350, y: 545 }, { x: 515, y: 545 }]
  },
  {
    name: "SAWMILL",
    hint: "These saws are bolted down. Hold SPACE to freeze the traveler and wait for a gap.",
    par: 18,
    solution: [[3, 860, 250]],
    portal: { x: 945, y: 530 },
    objects: [
      ground(0, 1000),
      { ...saw(380, 485, 26, 0, 60, 2.0, 5.6), fixed: true },
      { ...saw(620, 485, 26, 0, 60, 2.0, 0.7), fixed: true },
      block(860, 445, 40, 120)
    ],
    shards: [{ x: 500, y: 538 }, { x: 760, y: 538 }]
  },
  {
    name: "FINALE",
    hint: "Flip to the ceiling to skip the spikes and trip the switch up there, then flip back down through the open door. 2 moves.",
    par: 15,
    moves: 2,
    solution: [[3, 250, 300], [4, 700, 40]],
    portal: { x: 945, y: 530 },
    objects: [
      ground(0, 1000), ceil(0, 1000),
      spikes(360, 200, true),
      flip(900, 300, 265), flip(900, 40, 200),
      sw(600, 50, "a", true, true),
      door(780, 50, 515, "a")
    ],
    shards: [{ x: 470, y: 72 }, { x: 870, y: 538 }]
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
  },
  {
    top: "#0a2036", bottom: "#050d18", star: "200,235,255", grid: "130,200,240",
    portal: "#7fe3ff", portalSoft: "127,227,255",
    blobs: [{ x: 0.25, y: 0.3, r: 0.55, c: "rgba(90,200,255,0.18)" }, { x: 0.8, y: 0.75, r: 0.5, c: "rgba(120,160,255,0.13)" }]
  },
  {
    top: "#241a08", bottom: "#0f0a04", star: "255,225,160", grid: "230,180,90",
    portal: "#ffcf5c", portalSoft: "255,207,92",
    blobs: [{ x: 0.3, y: 0.7, r: 0.55, c: "rgba(255,190,70,0.16)" }, { x: 0.8, y: 0.3, r: 0.5, c: "rgba(255,120,60,0.12)" }]
  },
  {
    top: "#08200f", bottom: "#040f08", star: "170,255,190", grid: "100,220,130",
    portal: "#5cff8a", portalSoft: "92,255,138",
    blobs: [{ x: 0.2, y: 0.4, r: 0.55, c: "rgba(70,230,120,0.16)" }, { x: 0.85, y: 0.7, r: 0.5, c: "rgba(60,200,200,0.12)" }]
  },
  {
    top: "#2a0a20", bottom: "#12040e", star: "255,170,220", grid: "240,100,180",
    portal: "#ff5ca8", portalSoft: "255,92,168",
    blobs: [{ x: 0.25, y: 0.6, r: 0.55, c: "rgba(255,70,160,0.18)" }, { x: 0.8, y: 0.25, r: 0.5, c: "rgba(170,70,255,0.14)" }]
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

// effects
let rings = [];
let popups = [];
let introT = 0;
let prevGrounded = true;
let nextNote = 0;

// planning tools
let history = [];
let movedIds = new Set();
let pending = null;
let dragStart = null;
let hintOn = false;
let hintUsed = false;

const player = {
  x: SPAWN.x, y: SPAWN.y, vx: RUN_SPEED, vy: 0,
  grounded: true, launched: false, g: 1, onIce: false, belt: 0
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pad2 = n => String(n).padStart(2, "0");
const starString = n => "★".repeat(n) + "☆".repeat(3 - n);
const theme = () => THEMES[Math.min(THEMES.length - 1, Math.floor(levelIndex / 2))];
const NON_SOLID = new Set(["spike", "wind", "flip", "saw", "switch"]);
const isSolid = o => !NON_SOLID.has(o.type) && !o.opened && !o.fallen;
const isMoving = o => o.speed !== undefined && (o.ax || o.ay);
const linkColor = l => ["#ffd75e", "#6dc8ff", "#ff8ad8", "#8dff9a"][(String(l).charCodeAt(0) || 0) % 4];
const isZone = o => o.type === "wind" || o.type === "flip";

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
    case "crumble": tone(130, 0.3, "sawtooth", 0.04, 45); break;
    case "switch": tone(500, 0.1, "square", 0.04); tone(900, 0.18, "triangle", 0.05, 0, 0.08); break;
    case "flip":   tone(260, 0.35, "sawtooth", 0.04, 1000); tone(1000, 0.2, "triangle", 0.03, 400, 0.12); break;
  }
}

/* ================================================================
   LEVEL LOADING
   ================================================================ */
function loadLevel(i, clearFx = true) {
  levelIndex = i;
  const lvl = LEVELS[i];

  objects = lvl.objects.map((o, k) => ({ ...o, id: k, bx: o.x, by: o.y, ox: 0, oy: 0, squash: 0 }));
  objects.forEach(o => {
    if (isMoving(o)) {
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
  player.g = 1;
  player.onIce = false;
  player.belt = 0;

  trail = [];
  if (clearFx) { particles = []; rings = []; popups = []; }
  introT = clearFx ? 0 : 0.7;
  prevGrounded = true;
  history = [];
  movedIds = new Set();
  pending = null;
  dragStart = null;
  hintOn = false;
  hintButton.classList.toggle("hidden", !lvl.solution);
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
  if (fresh) { deaths = 0; hintUsed = false; }
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
  ring(player.x, player.y, "120,234,255", 50, 0.5, 3);
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

function ring(x, y, rgb, maxR = 60, life = 0.6, width = 3) {
  if (rings.length < 40) rings.push({ x, y, rgb, maxR, life, max: life, width });
}

function popup(text, x, y, rgb = "255,228,138") {
  if (popups.length < 20) popups.push({ text, x, y, rgb, life: 1, max: 1 });
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

  rings.forEach(r => { r.life -= STEP; });
  rings = rings.filter(r => r.life > 0);
  popups.forEach(q => { q.life -= STEP; q.y -= 0.6; });
  popups = popups.filter(q => q.life > 0);
  if (introT < 1) introT = Math.min(1, introT + STEP / 0.7);
}

/* ================================================================
   PHYSICS
   ================================================================ */
function captureWorld() {
  return {
    objs: objects.map(o => [o, o.x, o.y, o.bx, o.by]),
    portal: [portal.x, portal.y],
    shards: shards.map(sh => [sh.x, sh.y]),
    cam: [camX, camY],
    moved: new Set(movedIds)
  };
}

function pushHistory(snap = captureWorld()) {
  history.push(snap);
  if (history.length > 40) history.shift();
}

function commitPending() {
  if (pending && state === "ready") pushHistory(pending);
  pending = null;
}

function undo() {
  if (state !== "ready" || !history.length) return;
  const h = history.pop();
  h.objs.forEach(([o, x, y, bx, by]) => { o.x = x; o.y = y; o.bx = bx; o.by = by; });
  portal.x = h.portal[0];
  portal.y = h.portal[1];
  shards.forEach((sh, i) => { sh.x = h.shards[i][0]; sh.y = h.shards[i][1]; });
  camX = h.cam[0];
  camY = h.cam[1];
  movedIds = h.moved;
  sfx("grab");
}

function toggleHint() {
  if (!LEVELS[levelIndex].solution) return;
  hintOn = !hintOn;
  if (hintOn) hintUsed = true;
}

// Magnetic edges: dragged pieces snap flush to neighbours (hold Shift to disable).
const SNAP = 9;
const SNAPPY = new Set(["platform", "crumble", "ice", "belt", "mover", "block"]);

function snapDrag(o) {
  if (!SNAPPY.has(o.type)) return;
  let dx = null;
  let dy = null;

  for (const p of objects) {
    if (p === o || !isSolid(p)) continue;

    if (o.y < p.y + p.h + 30 && o.y + o.h > p.y - 30) {
      for (const d of [p.x + p.w - o.x, p.x - (o.x + o.w), p.x - o.x, p.x + p.w - (o.x + o.w)]) {
        if (Math.abs(d) <= SNAP && (dx === null || Math.abs(d) < Math.abs(dx))) dx = d;
      }
    }

    if (o.x < p.x + p.w + 30 && o.x + o.w > p.x - 30) {
      for (const d of [p.y - o.y, p.y + p.h - o.y, p.y - (o.y + o.h)]) {
        if (Math.abs(d) <= SNAP && (dy === null || Math.abs(d) < Math.abs(dy))) dy = d;
      }
    }
  }

  if (dx !== null) o.x += dx;
  if (dy !== null) o.y += dy;
}

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
    if (!isMoving(o)) continue;

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
      o.type === "mover" && player.g === 1 &&
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
  let onIce = false;
  let belt = 0;
  const gs = player.g;
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

      if (ny * gs < -0.5) {
        // standing on a surface (floor, or ceiling when gravity is flipped)
        player.grounded = true;
        if (player.vy * gs > 0) player.vy = 0;
        if (obj.type === "ice") onIce = true;
        if (obj.type === "belt") belt = obj.dir * (obj.push || BELT_SPEED);
        if (obj.type === "crumble" && !obj.timer) obj.timer = CRUMBLE_TIME;
      } else if (ny * gs > 0.5 && player.vy * gs < 0) {
        player.vy = 0;
      }

      // touching a spring from above or from the side launches the traveler
      if (allowBounce && gs === 1 && obj.type === "bounce" && player.y < obj.y + obj.h) bounced = obj;
    }
  }

  if (bounced) {
    player.vy = -BOUNCE_V;
    player.grounded = false;
    player.launched = true;
    bounced.squash = 1;
    sfx("bounce");
    burst(player.x, player.y + PLAYER_R, 12, "120,255,170", 2.2, 0.5, 2.5);
    ring(player.x, player.y + PLAYER_R, "120,255,170", 46, 0.45, 3);
    shake = Math.max(shake, 0.12);
  }

  player.onIce = onIce;
  player.belt = belt;
}

function movePlayer() {
  const gs = player.g;

  // wind zones push the traveler
  for (const w of objects) {
    if (w.type !== "wind") continue;
    if (player.x > w.x && player.x < w.x + w.w && player.y > w.y && player.y < w.y + w.h) {
      player.vy += w.ay;
      player.x += w.ax;
    }
  }

  player.vy += GRAVITY * gs;
  if (player.vy * gs > MAX_FALL) player.vy = MAX_FALL * gs;

  if (player.launched) player.vx = AIR_BOOST;
  else if (player.onIce) player.vx += (ICE_SPEED - player.vx) * 0.025;
  else if (!player.grounded && player.vx > RUN_SPEED) player.vx = Math.max(RUN_SPEED, player.vx - 0.004); // ice momentum
  else player.vx = RUN_SPEED;

  const fallV = player.vy * gs;

  player.x += player.vx + player.belt;
  player.y += player.vy;

  resolveCollisions(true);

  if (player.grounded && !prevGrounded && fallV > 3) {
    burst(player.x, player.y + PLAYER_R * gs, 8, "190,220,255", 1.6, 0.4, 2);
    ring(player.x, player.y + PLAYER_R * gs, "190,220,255", 22, 0.3, 2);
  }
  prevGrounded = player.grounded;

  if (player.launched && Math.random() < 0.7) {
    particles.push({
      x: player.x - 8, y: player.y + (Math.random() - 0.5) * 12, vx: -1.2, vy: 0, g: 0,
      life: 0.35, max: 0.35, size: 2, rgb: "170,255,210"
    });
  }

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

  for (const o of objects) {
    if (o.type !== "saw") continue;
    if (Math.hypot(player.x - (o.x + o.r), player.y - (o.y + o.r)) < o.r + PLAYER_R - 4) return true;
  }
  return false;
}

function updateHazards() {
  for (const o of objects) {
    if (o.type === "crumble") {
      if (o.timer > 0 && !o.fallen) {
        o.timer -= STEP;
        if (o.timer <= 0) {
          o.fallen = true;
          o.fv = 0;
          sfx("crumble");
          burst(o.x + o.w / 2, o.y + 8, 14, "224,176,128", 2.5, 0.7, 2.5);
        }
      }
      if (o.fallen) {
        o.fv += 0.35;
        o.fy = (o.fy || 0) + o.fv;
      }
    }

    if (o.type === "door" && o.opened && (o.open || 0) < 1) {
      o.open = Math.min(1, (o.open || 0) + 0.05);
    }
  }
}

function checkSwitches() {
  for (const o of objects) {
    if (o.type !== "switch" || o.on) continue;

    const cx = clamp(player.x, o.x, o.x + o.w);
    const cy = clamp(player.y, o.y, o.y + o.h);
    if ((player.x - cx) ** 2 + (player.y - cy) ** 2 >= (PLAYER_R + 1) ** 2) continue;

    o.on = true;
    sfx("switch");
    ring(o.x + o.w / 2, o.y + 4, "255,228,138", 50, 0.5, 3);
    burst(o.x + o.w / 2, o.y + 4, 10, "255,228,138", 2.5, 0.6, 2);
    shake = Math.max(shake, 0.1);

    for (const d of objects) {
      if (d.type === "door" && d.link === o.link && !d.opened) {
        d.opened = true;
        ring(d.x + d.w / 2, d.y + d.h / 2, "120,255,170", 80, 0.6, 3);
        burst(d.x + d.w / 2, d.y + d.h / 2, 16, "120,255,170", 3, 0.7, 2.5);
      }
    }
  }
}

function checkFlips() {
  for (const o of objects) {
    if (o.type !== "flip") continue;
    const inside =
      player.x > o.x - PLAYER_R && player.x < o.x + o.w + PLAYER_R &&
      player.y > o.y - PLAYER_R && player.y < o.y + o.h + PLAYER_R;

    if (inside && !o.inside) {
      player.g = -player.g;
      player.vy = 0;
      player.launched = false;
      sfx("flip");
      ring(player.x, player.y, "255,108,240", 90, 0.55, 4);
      burst(player.x, player.y, 18, "255,140,245", 3.5, 0.7, 2.5);
      shake = Math.max(shake, 0.2);
      flash = Math.max(flash, 0.25);
      flashColor = "255,108,240";
    }
    o.inside = inside;
  }
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
  ring(player.x, player.y, "255,90,110", 80, 0.55, 4);
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
  const earned = [true, got === total, elapsed <= par && !hintUsed];
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
  ring(portal.x, portal.y, theme().portalSoft, 190, 1.0, 5);
  ring(portal.x, portal.y, "255,255,255", 110, 0.7, 3);
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
    [result.earned[2], `UNDER PAR (${result.par}s)${hintUsed ? " · NO HINTS" : ""}`]
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

  if (frozen && !stasisHeld) {
    sfx("stasis");
    ring(player.x, player.y, "190,235,255", 70, 0.5, 3);
  }
  stasisHeld = frozen;

  if (!dragging && !panning) applyShiftKeys();
  updateMovers();
  updateHazards();

  if (frozen) resolveCollisions(false);   // stasis: no walking, no gravity
  else movePlayer();
  checkFlips();
  checkSwitches();

  // collect shards
  for (const s of shards) {
    if (s.got) continue;
    if (Math.hypot(player.x - s.x, player.y - s.y) < PLAYER_R + 10) {
      s.got = true;
      burst(s.x, s.y, 16, "255,230,120", 3, 0.7, 2.5);
      ring(s.x, s.y, "255,228,138", 44, 0.5, 3);
      popup(`${shards.filter(x => x.got).length}/${shards.length}`, s.x, s.y - 16);
      sfx("shard");
    }
  }

  // hazards
  if (player.y > WORLD_H + 60 || player.y < -300 || (player.g === -1 && player.y < -60) || player.x < -60 || player.x > WORLD_W + 60 || hitsSpike()) {
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

  if (dragging && Math.random() < 0.6) {
    burst(dragging.x + Math.random() * dragging.w, dragging.y + Math.random() * dragging.h,
      1, "170,220,255", 0.7, 0.5, 1.6);
  }

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
  for (let pass = 0; pass < 2; pass++) {
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      if (o.fallen || isZone(o) !== (pass === 1)) continue;
      const pad = o.h < 20 ? 8 : 2;
      if (mx >= o.x - pad && mx <= o.x + o.w + pad && my >= o.y - pad && my <= o.y + o.h + pad) return o;
    }
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

  const limit = LEVELS[levelIndex].moves || 0;
  if (o && !o.fixed && limit && !movedIds.has(o.id) && movedIds.size >= limit) {
    popup("MOVE LIMIT", mx, my - 10, "255,120,140");
    tone(150, 0.12, "square", 0.03);
    return;
  }

  pending = captureWorld();
  dragStart = o && !o.fixed ? { x: o.x, y: o.y } : null;

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
    commitPending();
    dragging.x = mx - dragOffsetX;
    dragging.y = my - dragOffsetY;
    if (!e.shiftKey) snapDrag(dragging);
    dragging.bx = dragging.x - dragging.ox;
    dragging.by = dragging.y - dragging.oy;
  } else if (panning) {
    commitPending();
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
  if (dragging && dragStart && Math.hypot(dragging.x - dragStart.x, dragging.y - dragStart.y) > 4) {
    movedIds.add(dragging.id);
  }
  dragging = null;
  panning = false;
  pending = null;
  dragStart = null;
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

  if ((e.ctrlKey || e.metaKey) && key === "z") { e.preventDefault(); undo(); return; }
  if (!e.repeat && key === "u") undo();
  if (!e.repeat && key === "h") toggleHint();

  if (SHIFT_KEYS.has(key)) {
    e.preventDefault();
    if (!keys.has(key) && state === "ready") pushHistory();
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
onClick(undoButton, undo);
onClick(hintButton, toggleHint);
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
// Quiet generative ambience: random notes from a minor pentatonic scale.
const MUSIC_SCALE = [0, 3, 5, 7, 10, 12, 15];
const MUSIC_ROOTS = [110, 98, 123.47, 87.31, 103.83, 116.54, 92.5, 82.41];

function playMusic() {
  if (!audio || muted || audio.currentTime < nextNote) return;
  const root = MUSIC_ROOTS[Math.floor(levelIndex / 2) % MUSIC_ROOTS.length];
  const deg = MUSIC_SCALE[(Math.random() * MUSIC_SCALE.length) | 0];
  const f = root * Math.pow(2, deg / 12) * (Math.random() < 0.3 ? 4 : 2);
  tone(f, 1.6, "sine", 0.022);
  if (Math.random() < 0.25) tone(f * 1.5, 1.2, "triangle", 0.012, 0, 0.15);
  const pace = state === "running" ? 0.7 : 1;
  nextNote = audio.currentTime + (0.45 + Math.random() * 0.5) * pace;
}

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

  // large soft motes for depth
  for (let i = 0; i < 14; i++) {
    const span = screenW + 40;
    const mx = ((((i * 211 + time * (6 + (i % 4) * 4) - camX * 0.15 * scale) % span) + span) % span) - 20;
    const my = ((((i * 97 + Math.sin(time * 0.4 + i) * 20 + camY * 0.15 * scale) % screenH) + screenH) % screenH);
    ctx.fillStyle = `rgba(${th.star},0.045)`;
    ctx.beginPath();
    ctx.arc(mx, my, 14 + (i % 3) * 8, 0, Math.PI * 2);
    ctx.fill();
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
  if (!isMoving(o)) return;
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

function drawIce(o) {
  drawSlab(o, "#d6f8ff", "#2d7596", "#183b57", "#7fe3ff", "#d6f8ff");
  ctx.save();
  ctx.strokeStyle = "rgba(220,250,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = o.x + 10; x < o.x + o.w - 6; x += 38) {
    ctx.moveTo(x, o.y + 6);
    ctx.lineTo(x + 10, o.y + 2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBelt(o) {
  drawSlab(o, "#ffcf7a", "#4a3a1a", "#2c2210", "#ffa030", "#ffcf7a");
  ctx.save();
  ctx.beginPath();
  ctx.rect(o.x, o.y + 3, o.w, Math.min(o.h, 30) - 3);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,200,110,0.85)";
  ctx.lineWidth = 2;
  const off = (time * 30 * o.dir) % 20;
  const cy = o.y + Math.min(o.h, 30) / 2 + 2;
  const d = o.dir * 4;
  for (let x = o.x - 20 + off; x < o.x + o.w + 20; x += 20) {
    ctx.beginPath();
    ctx.moveTo(x - d, cy - 5);
    ctx.lineTo(x + d, cy);
    ctx.lineTo(x - d, cy + 5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWind(o) {
  ctx.save();
  ctx.fillStyle = "rgba(120,200,255,0.07)";
  ctx.fillRect(o.x, o.y, o.w, o.h);
  ctx.strokeStyle = "rgba(160,220,255,0.4)";
  ctx.lineWidth = 1.5;

  const horiz = Math.abs(o.ax) > Math.abs(o.ay);
  const dirX = Math.sign(o.ax);
  const dirY = Math.sign(o.ay);
  const n = Math.max(3, Math.floor((horiz ? o.h : o.w) / 22));

  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const f = (time * 0.6 + i * 0.37) % 1;
    if (horiz) {
      const y = o.y + ((i + 0.5) / n) * o.h;
      const x = dirX > 0 ? o.x + f * o.w : o.x + o.w - f * o.w;
      ctx.moveTo(x, y);
      ctx.lineTo(x - dirX * 14, y);
    } else {
      const x = o.x + ((i + 0.5) / n) * o.w;
      const y = dirY > 0 ? o.y + f * o.h : o.y + o.h - f * o.h;
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - dirY * 14);
    }
  }
  ctx.stroke();

  ctx.strokeStyle = "rgba(160,220,255,0.2)";
  ctx.setLineDash([4, 6]);
  ctx.strokeRect(o.x, o.y, o.w, o.h);
  ctx.restore();
}

function drawFlip(o) {
  const up = player.g === 1;       // chevrons show where gravity will point next
  ctx.save();

  const g = ctx.createLinearGradient(o.x, 0, o.x + o.w, 0);
  g.addColorStop(0, "rgba(255,108,240,0)");
  g.addColorStop(0.5, "rgba(255,108,240,0.3)");
  g.addColorStop(1, "rgba(255,108,240,0)");
  ctx.fillStyle = g;
  ctx.fillRect(o.x, o.y, o.w, o.h);

  ctx.shadowBlur = 12;
  ctx.shadowColor = "#ff6cf0";
  ctx.strokeStyle = "rgba(255,150,245,0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(o.x, o.y); ctx.lineTo(o.x, o.y + o.h);
  ctx.moveTo(o.x + o.w, o.y); ctx.lineTo(o.x + o.w, o.y + o.h);
  ctx.stroke();

  const n = Math.max(2, Math.floor(o.h / 30));
  const cx = o.x + o.w / 2;
  for (let i = 0; i < n; i++) {
    const f = (time * 0.8 + i / n) % 1;
    const y = up ? o.y + o.h - f * o.h : o.y + f * o.h;
    const dy = up ? -6 : 6;
    ctx.strokeStyle = `rgba(255,190,250,${Math.sin(f * Math.PI)})`;
    ctx.beginPath();
    ctx.moveTo(cx - 8, y - dy);
    ctx.lineTo(cx, y);
    ctx.lineTo(cx + 8, y - dy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawCrumble(o) {
  if (o.fallen && (o.fy || 0) > 140) return;
  ctx.save();
  const jx = o.timer > 0 && !o.fallen ? (Math.random() - 0.5) * 3 : 0;
  ctx.translate(jx, o.fy || 0);
  ctx.globalAlpha = o.fallen ? Math.max(0, 1 - (o.fy || 0) / 140) : 1;
  drawSlab(o, "#e0b080", "#5a4030", "#33261c", "#c98a4a", "#e0b080");
  ctx.strokeStyle = "rgba(20,10,5,0.7)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let x = o.x + 20; x < o.x + o.w - 10; x += 34) {
    ctx.moveTo(x, o.y + 3);
    ctx.lineTo(x + 5, o.y + 10);
    ctx.lineTo(x - 2, o.y + o.h - 2);
  }
  ctx.stroke();
  ctx.restore();
}

function drawSaw(o) {
  const cx = o.x + o.r;
  const cy = o.y + o.r;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(time * 7);
  ctx.shadowBlur = 16;
  ctx.shadowColor = "#ff4d6a";

  const teeth = 12;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? o.r * 0.76 : o.r;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = "#e8506a";
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#4a1624";
  ctx.beginPath();
  ctx.arc(0, 0, o.r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffb199";
  ctx.beginPath();
  ctx.arc(0, 0, o.r * 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSwitch(o) {
  const c = linkColor(o.link);
  ctx.save();
  if (o.up) {
    ctx.translate(0, o.y * 2 + o.h);
    ctx.scale(1, -1);
  }
  ctx.shadowBlur = o.on ? 22 : 8;
  ctx.shadowColor = c;
  ctx.fillStyle = "#2a3550";
  ctx.fillRect(o.x - 2, o.y + 6, o.w + 4, o.h - 6);
  ctx.fillStyle = c;
  ctx.globalAlpha = o.on ? 1 : 0.8;
  ctx.fillRect(o.x + 4, o.y + (o.on ? 6 : 1), o.w - 8, o.on ? 4 : 9);
  ctx.restore();
}

function drawDoor(o) {
  const open = o.open || 0;
  const c = linkColor(o.link);
  const y0 = o.y + o.h * open;
  const h = o.h - o.h * open;

  ctx.save();
  ctx.fillStyle = "#2a3550";
  ctx.fillRect(o.x - 3, o.y + o.h - 4, o.w + 6, 4);

  if (h > 1) {
    ctx.shadowBlur = 14;
    ctx.shadowColor = c;
    ctx.fillStyle = "#1c2438";
    ctx.fillRect(o.x, y0, o.w, h);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, y0, o.w, h);
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let y = y0 + 8; y < y0 + h - 4; y += 14) {
      ctx.moveTo(o.x + 3, y + 8);
      ctx.lineTo(o.x + o.w - 3, y);
    }
    ctx.stroke();
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
    case "ice":    drawIce(o); break;
    case "belt":   drawBelt(o); break;
    case "wind":   drawWind(o); break;
    case "flip":   drawFlip(o); break;
    case "crumble": drawCrumble(o); break;
    case "saw":    drawSaw(o); break;
    case "switch": drawSwitch(o); break;
    case "door":   drawDoor(o); break;
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
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const c = player.launched ? "120,255,180" : "90,200,255";
  trail.forEach(p => {
    const t = p.life / 24;
    ctx.fillStyle = `rgba(${c},${t * 0.4})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER_R * 0.75 * t, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
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

function drawRings() {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const r of rings) {
    const t = 1 - r.life / r.max;
    const e = 1 - (1 - t) * (1 - t);
    ctx.strokeStyle = `rgba(${r.rgb},${(1 - t) * 0.8})`;
    ctx.lineWidth = r.width * (1 - t) + 0.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y, r.maxR * e, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPopups() {
  ctx.save();
  ctx.textAlign = "center";
  ctx.font = "bold 13px Arial, sans-serif";
  setLetterSpacing(1);
  for (const q of popups) {
    ctx.fillStyle = `rgba(${q.rgb},${clamp((q.life / q.max) * 1.5, 0, 1)})`;
    ctx.fillText(q.text, q.x, q.y);
  }
  ctx.restore();
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

  const limit = lvl.moves || 0;
  if (limit) {
    const used = movedIds.size + (dragging && !movedIds.has(dragging.id) ? 1 : 0);
    ctx.textAlign = "left";
    ctx.font = "11px Arial, sans-serif";
    ctx.fillStyle = used >= limit ? "#ff9aa8" : "rgba(140,159,202,0.9)";
    setLetterSpacing(2);
    ctx.fillText(`MOVES ${used}/${limit}`, 14, screenH - 16);
  }

  ctx.restore();
}

function drawHintGhosts() {
  if (!hintOn) return;
  const sol = LEVELS[levelIndex].solution;
  if (!sol) return;

  ctx.save();
  ctx.lineWidth = 2;
  for (const [id, x, y] of sol) {
    const o = objects.find(q => q.id === id);
    if (!o) continue;
    const gx = x + camX;
    const gy = y + camY;

    ctx.setLineDash([]);
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = "#ffe48a";
    ctx.beginPath();
    ctx.moveTo(o.x + o.w / 2, o.y + o.h / 2);
    ctx.lineTo(gx + o.w / 2, gy + o.h / 2);
    ctx.stroke();

    ctx.globalAlpha = 0.9;
    ctx.setLineDash([6, 5]);
    ctx.fillStyle = "rgba(255,228,138,0.10)";
    ctx.fillRect(gx, gy, o.w, o.h);
    ctx.strokeRect(gx, gy, o.w, o.h);
  }
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
  // permanent soft vignette
  const vg = ctx.createRadialGradient(
    screenW / 2, screenH / 2, Math.min(screenW, screenH) * 0.45,
    screenW / 2, screenH / 2, Math.max(screenW, screenH) * 0.78
  );
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, screenW, screenH);

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

  const ie = 1 - Math.pow(1 - introT, 3);
  ctx.save();
  ctx.globalAlpha = ie;
  ctx.translate(0, (1 - ie) * 24);
  objects.forEach(drawMoverTrack);
  objects.forEach(drawObject);
  shards.forEach(drawShard);
  drawPortal();
  ctx.restore();

  drawHintGhosts();
  drawTrail();
  drawPlayer();
  drawParticles();
  drawRings();
  drawPopups();
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
  accumulator += delta * (state === "won" ? 0.4 : 1);

  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }

  playMusic();
  stasisButton.classList.toggle("active", state === "running" && stasisHeld);
  draw();
  requestAnimationFrame(gameLoop);
}

/* ---------- Boot ---------- */
hatch = makeHatch();
resize();
showMenu();
requestAnimationFrame(gameLoop);
