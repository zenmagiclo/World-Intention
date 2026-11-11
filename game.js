const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const winScreen = document.getElementById("win-screen");

let width, height;
let playing = false;
let won = false;

const player = {
  x: 85,
  y: 100,
  radius: 12,
  vx: 1.4,
  vy: 0,
  gravity: 0.28,
  grounded: false
};

// Everything here can be moved independently.
let objects = [];
let portal = {};

function createLevel() {
  player.x = 85;
  player.y = height - 160;
  player.vx = 1.4;
  player.vy = 0;
  player.grounded = false;

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

  won = false;
  winScreen.classList.add("hidden");
}

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  createLevel();
}

window.addEventListener("resize", resize);

// Draw the background.
function drawBackground() {
  ctx.fillStyle = "#0a1020";
  ctx.fillRect(0, 0, width, height);

  // Stars
  for (let i = 0; i < 65; i++) {
    const x = (i * 137.5) % width;
    const y = (i * 83.7) % height;

    ctx.fillStyle = `rgba(160, 200, 255, ${0.15 + (i % 5) * 0.08})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Subtle grid
  ctx.strokeStyle = "rgba(100, 150, 220, 0.045)";
  ctx.lineWidth = 1;

  for (let x = 0; x < width; x += 45) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let y = 0; y < height; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
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

    ctx.restore();
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
  glow.addColorStop(1, "#2676ff00");

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

  ctx.shadowBlur = 25;
  ctx.shadowColor = "#b15cff";
  ctx.strokeStyle = "#c28aff";
  ctx.lineWidth = 4;

  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = "#6945a5";
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.arc(portal.x, portal.y, portal.radius - 8, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();
}

// Basic physics and platform collisions.
function updatePlayer() {
  player.vy += player.gravity;
  player.vy = Math.min(player.vy, 9);

  player.x += player.vx;
  player.y += player.vy;

  player.grounded = false;

  objects.forEach(obj => {
    const overlapsX =
      player.x + player.radius > obj.x &&
      player.x - player.radius < obj.x + obj.w;

    const crossedTop =
      player.y + player.radius >= obj.y &&
      player.y + player.radius - player.vy <= obj.y;

    if (overlapsX && crossedTop && player.vy >= 0) {
      player.y = obj.y - player.radius;
      player.vy = 0;
      player.grounded = true;
    }

    // Side collision
    const overlapsY =
      player.y + player.radius > obj.y &&
      player.y - player.radius < obj.y + obj.h;

    const crossedSide =
      player.x + player.radius > obj.x &&
      player.x - player.radius < obj.x + obj.w;

    if (overlapsY && crossedSide && !crossedTop) {
      if (player.vx > 0 && player.x < obj.x) {
        player.x = obj.x - player.radius;
        player.vx = 0;
      } else if (player.vx < 0 && player.x > obj.x + obj.w) {
        player.x = obj.x + obj.w + player.radius;
        player.vx = 0;
      }
    }
  });

  // Small automatic forward movement.
  if (player.grounded && player.vx === 0) {
    player.vx = 1.4;
  }

  // Fall out of the dimension.
  if (player.y > height + 50) {
    player.x = 85;
    player.y = 80;
    player.vy = 0;
    player.vx = 1.4;
  }

  // Reach the portal.
  const distance = Math.hypot(
    player.x - portal.x,
    player.y - portal.y
  );

  if (distance < portal.radius + player.radius) {
    won = true;
    playing = false;
    winScreen.classList.remove("hidden");
  }
}

// Shift the environment without directly moving the player.
function shiftWorld(dx, dy) {
  objects.forEach(obj => {
    obj.x += dx;
    obj.y += dy;
  });

  portal.x += dx;
  portal.y += dy;
}

// Mouse dragging.
let dragging = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

canvas.addEventListener("pointerdown", e => {
  if (!playing) return;

  const rect = canvas.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];

    if (
      mx >= obj.x && mx <= obj.x + obj.w &&
      my >= obj.y && my <= obj.y + obj.h
    ) {
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
});

canvas.addEventListener("pointermove", e => {
  if (!dragging) return;

  const rect = canvas.getBoundingClientRect();

  dragging.x = e.clientX - rect.left - dragOffsetX;
  dragging.y = e.clientY - rect.top - dragOffsetY;
});

function stopDragging() {
  dragging = null;
}

canvas.addEventListener("pointerup", stopDragging);
canvas.addEventListener("pointercancel", stopDragging);

// Keyboard controls.
const keys = new Set();

window.addEventListener("keydown", e => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    e.preventDefault();
    keys.add(e.key);
  }

  if (e.key.toLowerCase() === "r") {
    createLevel();
  }
});

window.addEventListener("keyup", e => {
  keys.delete(e.key);
});

function updateWorld() {
  const speed = 3;

  if (keys.has("ArrowLeft")) shiftWorld(speed, 0);
  if (keys.has("ArrowRight")) shiftWorld(-speed, 0);
  if (keys.has("ArrowUp")) shiftWorld(0, speed);
  if (keys.has("ArrowDown")) shiftWorld(0, -speed);
}

function draw() {
  drawBackground();
  drawObjects();
  drawPortal();
  drawPlayer();
}

function gameLoop() {
  if (playing && !dragging) {
    updateWorld();
    updatePlayer();
  } else if (playing) {
    updatePlayer();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

document.getElementById("startButton").addEventListener("click", () => {
  startScreen.classList.add("hidden");
  playing = true;
});

document.getElementById("restartButton").addEventListener("click", () => {
  createLevel();
  playing = true;
});

resize();
gameLoop();

