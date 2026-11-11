const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const winScreen = document.getElementById("win-screen");
const winTime = document.getElementById("winTime");

const STEP = 1 / 60;          // fixed physics step (seconds)
const RUN_SPEED = 1.4;
const SHIFT_SPEED = 3;
const SPAWN_X = 85;

let width = 0;
let height = 0;
let playing = false;
let elapsed = 0;
let time = 0;
let accumulator = 0;
let lastFrame = performance.now();

const player = {
  x: SPAWN_X,
  y: 100,
  radius: 12,
  vx: RUN_SPEED,
  vy: 0,
  gravity: 0.28,
  grounded: false
};

let objects = [];
let portal = { x: 0, y: 0, radius: 25 };
let trail = [];

// Stars are generated once, as fractions of the screen.
const stars = Array.from({ length: 65 }, (_, i) => ({
  fx: (i * 0.6180339) % 1,
  fy: (i * 0.3819660 + (i % 7) * 0.07) % 1,
  alpha: 0.15 + (i % 5) * 0.08
}));

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

function createLevel() {
  player.x = SPAWN_X;
  player.y = height - 160;
  player.vx = RUN_SPEED;
  player.vy = 0;
  player.grounded = false;
  trail = [];

  objects = [
    { x: 0, y: height - 35, w: width * 0.35, h: 35, type: "platform" },
    { x: width * 0.48, y: height - 35, w: width * 0.20, h: 35, type: "platform" },
    { x: width * 0.79, y: height - 35, w: width * 0.21, h: 35, type: "platform" },
    { x: width * 0.32, y: height - 145, w: 105, h: 18, type: "platform" },
    { x: width * 0.55, y: height - 205, w: 115, h: 18, type: "platform" },
    { x: width * 0.73, y: height - 125, w: 65, h: 65, type: "obstacle" },
    { x: width * 0.43, y: height - 105, w: 28, h: 70, type: "obstacle" }
  ];

  portal = {
    x: width - 65,
    y: height - 90,
    radius: 25
  };

  winScreen.classList.add("hidden");
}

function startRun() {
  createLevel();
  elapsed = 0;
  playing = true;
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  const oldW = width;
  const oldH = height;

  width = rect.width;
  height = rect.height;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  if (!oldW || !oldH) {
    createLevel();
    return;
  }

  // Keep the current progress instead of wiping the level on resize.
  const sx = width / oldW;
  const sy = height / oldH;

  objects.forEach(o => {
    o.x *= sx;
    o.w *= sx;
    o.y *= sy;
    o.h *= sy;
  });

  portal.x *= sx;
  portal.y *= sy;
  player.x *= sx;
  player.y *= sy;
  trail = [];
}

window.addEventListener("resize", resize);

/* ---------- Drawing ---------- */

function drawBackground() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, width, height);

  stars.forEach(s => {
    const twinkle = 0.75 + 0.25 * Math.sin(time * 1.5 + s.fx * 40);
    ctx.fillStyle = `rgba(160, 200, 255, ${s.alpha * twinkle})`;
    ctx.fillRect(s.fx * width, s.fy * height, 2, 2);
  });

  ctx.strokeStyle = "rgba(100, 150, 220, 0.045)";
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = 0; x < width; x += 45) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
  }

  for (let y = 0; y < height; y += 45) {
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }

  ctx.stroke();
}

function drawObjects() {
  objects.forEach(obj => {
    ctx.save();

    if (obj.type === "platform") {
      ctx.shadowBlur = 15;
      ctx.shadowColor = "#39aaff";

      ctx.fillStyle = "#203d5c";
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);

      ctx.fillStyle = "#62caff";
      ctx.fillRect(obj.x, obj.y, obj.w, 3);
    } else {
      ctx.shadowBlur = 18;
      ctx.shadowColor = "#ad65ff";

      ctx.fillStyle = "#38274f";
      ctx.fillRect(obj.x, obj.y, obj.w, obj.h);

      ctx.strokeStyle = "#b477ff";
      ctx.lineWidth = 2;
      ctx.strokeRect(obj.x, obj.y, obj.w, obj.h);
    }

    if (obj === dragging) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
    }

    ctx.restore();
  });
}

function drawTrail() {
  trail.forEach(p => {
    const t = p.life / 24;
    ctx.fillStyle = `rgba(120, 234, 255, ${t * 0.35})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, player.radius * 0.6 * t, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawPlayer() {
  ctx.save();

  ctx.shadowBlur = 25;
  ctx.shadowColor = "#6deaff";

  const glow = ctx.createRadialGradient(
    player.x, player.y, 2,
    player.x, player.y, player.radius * 2
  );

  glow.addColorStop(0, "#ffffff");
  glow.addColorStop(0.35, "#78eaff");
  glow.addColorStop(1, "rgba(38, 118, 255, 0)");

  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius * 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#d5fbff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPortal() {
  ctx.save();

  const pulse = 1 + Math.sin(time * 3) * 0.05;

  ctx.shadowBlur = 25;
  ctx.shadowColor = "#b15cff";
  ctx.strokeStyle = "#c28aff";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius * pulse, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#8f63d6";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -time * 20;

  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(140, 159, 202, 0.8)";
  ctx.font = "11px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(elapsed.toFixed(1) + "s", width - 14, 22);
  ctx.restore();
}

function draw() {
  drawBackground();
  drawObjects();
  drawPortal();
  drawTrail();
  drawPlayer();
  if (playing) drawHud();
}

/* ---------- Physics ---------- */

// Circle vs. rectangle resolution. Works for tops, sides, and corners,
// and handles the player's center ending up inside a box.
function resolveCollisions() {
  player.grounded = false;
  const r = player.radius;

  for (let pass = 0; pass < 3; pass++) {
    for (const obj of objects) {
      const cx = clamp(player.x, obj.x, obj.x + obj.w);
      const cy = clamp(player.y, obj.y, obj.y + obj.h);
      const dx = player.x - cx;
      const dy = player.y - cy;
      const d2 = dx * dx + dy * dy;

      if (d2 >= r * r) continue;

      let nx = 0;
      let ny = 0;

      if (d2 === 0) {
        const toLeft = player.x - obj.x;
        const toRight = obj.x + obj.w - player.x;
        const toTop = player.y - obj.y;
        const toBottom = obj.y + obj.h - player.y;
        const m = Math.min(toLeft, toRight, toTop, toBottom);

        if (m === toTop) {
          player.y = obj.y - r;
          ny = -1;
        } else if (m === toLeft) {
          player.x = obj.x - r;
          nx = -1;
        } else if (m === toRight) {
          player.x = obj.x + obj.w + r;
          nx = 1;
        } else {
          player.y = obj.y + obj.h + r;
          ny = 1;
        }
      } else {
        const d = Math.sqrt(d2);
        nx = dx / d;
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
    }
  }
}

function updatePlayer() {
  player.vy = Math.min(player.vy + player.gravity, 9);

  // The traveler always walks forward; walls simply stop it until you move them.
  player.vx = RUN_SPEED;

  player.x += player.vx;
  player.y += player.vy;

  resolveCollisions();

  // Fell out of the dimension: reset the world so it can't become unwinnable.
  if (player.y > height + 50) {
    createLevel();
    return;
  }

  const distance = Math.hypot(player.x - portal.x, player.y - portal.y);

  if (distance < portal.radius + player.radius) {
    playing = false;
    winTime.textContent = `Time: ${elapsed.toFixed(1)}s`;
    winScreen.classList.remove("hidden");
  }
}

function updateTrail() {
  trail.push({ x: player.x, y: player.y, life: 24 });
  trail.forEach(p => p.life--);
  trail = trail.filter(p => p.life > 0);
}

function shiftWorld(dx, dy) {
  objects.forEach(obj => {
    obj.x += dx;
    obj.y += dy;
  });

  portal.x += dx;
  portal.y += dy;
}

/* ---------- Input ---------- */

let dragging = null;
let dragOffsetX = 0;
let dragOffsetY = 0;
let panning = false;
let lastPointerX = 0;
let lastPointerY = 0;

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

canvas.addEventListener("pointerdown", e => {
  if (!playing) return;

  const { x: mx, y: my } = pointerPos(e);

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    if (mx >= obj.x && mx <= obj.x + obj.w && my >= obj.y && my <= obj.y + obj.h) {
      dragging = obj;
      dragOffsetX = mx - obj.x;
      dragOffsetY = my - obj.y;

      // Bring grabbed object to the front.
      objects.splice(i, 1);
      objects.push(obj);

      canvas.setPointerCapture(e.pointerId);
      return;
    }
  }

  // Dragging empty space shifts the whole world (works on touch screens too).
  panning = true;
  lastPointerX = mx;
  lastPointerY = my;
  canvas.setPointerCapture(e.pointerId);
});

canvas.addEventListener("pointermove", e => {
  const { x: mx, y: my } = pointerPos(e);

  if (dragging) {
    dragging.x = mx - dragOffsetX;
    dragging.y = my - dragOffsetY;
  } else if (panning) {
    shiftWorld(mx - lastPointerX, my - lastPointerY);
    lastPointerX = mx;
    lastPointerY = my;
  }
});

function stopPointer() {
  dragging = null;
  panning = false;
}

canvas.addEventListener("pointerup", stopPointer);
canvas.addEventListener("pointercancel", stopPointer);
window.addEventListener("blur", () => {
  stopPointer();
  keys.clear();
});

const keys = new Set();
const SHIFT_KEYS = new Set([
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "w", "a", "s", "d"
]);

window.addEventListener("keydown", e => {
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (SHIFT_KEYS.has(key)) {
    e.preventDefault();
    keys.add(key);
  }

  if (key === "r" && !e.repeat && (playing || !winScreen.classList.contains("hidden"))) {
    startRun();
  }
});

window.addEventListener("keyup", e => {
  keys.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
});

function updateWorld() {
  if (keys.has("ArrowLeft") || keys.has("a")) shiftWorld(SHIFT_SPEED, 0);
  if (keys.has("ArrowRight") || keys.has("d")) shiftWorld(-SHIFT_SPEED, 0);
  if (keys.has("ArrowUp") || keys.has("w")) shiftWorld(0, SHIFT_SPEED);
  if (keys.has("ArrowDown") || keys.has("s")) shiftWorld(0, -SHIFT_SPEED);
}

/* ---------- Loop ---------- */

function step() {
  if (!playing) return;

  elapsed += STEP;
  if (!dragging && !panning) updateWorld();
  updatePlayer();
  updateTrail();
}

function gameLoop(now) {
  // Fixed timestep so the game runs at the same speed on 60/120/144 Hz screens.
  const delta = Math.min((now - lastFrame) / 1000, 0.1);
  lastFrame = now;
  time += delta;
  accumulator += delta;

  while (accumulator >= STEP) {
    step();
    accumulator -= STEP;
  }

  draw();
  requestAnimationFrame(gameLoop);
}

document.getElementById("startButton").addEventListener("click", () => {
  startScreen.classList.add("hidden");
  startRun();
});

document.getElementById("restartButton").addEventListener("click", startRun);

resize();
requestAnimationFrame(gameLoop);
