import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = dirname(fileURLToPath(import.meta.url));
GlobalFonts.registerFromPath(join(root, "../fonts/vaio-con-dios.otf"), "VAIO CON DIOS");

const WIDTH = 960;
const HEIGHT = 480;
const FPS = 30;
const FONT = "VAIO CON DIOS";
const WORD = "itarin";
const SOURCE = "VAIO CON DIOS";
const BLUE = "#2f54c7";
const SILVER = "#8e97ab";
const DPR = 2;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function easeOut(t) {
  return 1 - Math.pow(1 - clamp(t, 0, 1), 3);
}
function easeInOut(t) {
  t = clamp(t, 0, 1);
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function sample(str, size) {
  const off = createCanvas(4, 4);
  const g = off.getContext("2d");
  g.font = size + "px \"" + FONT + "\"";
  const metrics = g.measureText(str);
  const w = Math.max(2, Math.ceil(metrics.width) + 28);
  const h = Math.max(2, Math.ceil(size * 1.55));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext("2d");
  ctx.font = size + "px \"" + FONT + "\"";
  ctx.fillStyle = "#000";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(str, 14, size);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pts = [];
  const step = size > 48 ? 3 : 2;
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      if (data[(y * w + x) * 4 + 3] > 140) {
        pts.push({ x: x - w / 2, y: y - h * 0.58 });
      }
    }
  }
  return pts;
}

function buildParticles(height, rand) {
  const targetSize = Math.round(height * 0.5);
  const sourceSize = Math.round(targetSize * 0.58);
  const from = sample(SOURCE, sourceSize);
  const to = sample(WORD, targetSize);
  if (!from.length || !to.length) return [];
  const count = Math.min(260, to.length);
  const list = [];
  for (let i = 0; i < count; i++) {
    const dest = to[Math.floor((i * to.length) / count)];
    const origin = from[Math.floor((i * from.length / count) % from.length)];
    list.push({
      x0: origin.x,
      y0: origin.y,
      x1: dest.x,
      y1: dest.y,
      delay: (i / count) * 0.55,
      seed: rand()
    });
  }
  return list;
}

function paintWord(target, width, height, ox, fill) {
  target.save();
  target.translate(width / 2, height * 0.62);
  target.font = Math.round(height * 0.5) + "px \"" + FONT + "\"";
  target.textAlign = "center";
  target.textBaseline = "alphabetic";
  target.fillStyle = fill;
  target.fillText(WORD, ox, 0);
  target.restore();
}

function renderFrames(label, startTime, duration) {
  const width = WIDTH;
  const height = HEIGHT;
  const canvas = createCanvas(width * DPR, height * DPR);
  const ctx = canvas.getContext("2d");
  ctx.scale(DPR, DPR);
  const wordLayer = createCanvas(width * DPR, height * DPR);
  const layer = wordLayer.getContext("2d");
  const rand = mulberry32(20260922);
  const particles = buildParticles(height, rand);
  const dots = [0, 1, 2].map((i) => ({
    angle: (Math.PI * 2 * i) / 3 - Math.PI / 2
  }));
  const trails = [[], [], []];
  const framesDir = join(root, "frames", label);
  mkdirSync(framesDir, { recursive: true });

  const total = Math.round(duration * FPS);
  for (let i = 0; i < total; i++) {
    const elapsed = startTime + i / FPS;
    const dt = 1 / FPS;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height * 0.52;
    const lock = easeOut((elapsed - 0.32) / 1.35);
    const wordIn = easeInOut((elapsed - 1.05) / 0.85);
    const intro = elapsed < 2.4;

    if (intro) {
      const sourceOut = (1 - easeOut((elapsed - 0.08) / 0.85)) * 0.72;
      if (sourceOut > 0.01) {
        const size = Math.round(height * 0.26);
        ctx.save();
        ctx.globalAlpha = sourceOut;
        ctx.translate(width / 2, height * 0.58);
        ctx.font = size + "px \"" + FONT + "\"";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        ctx.fillStyle = SILVER;
        ctx.fillText(SOURCE, 0, 0);
        ctx.restore();
      }
      particles.forEach((p) => {
        const t = easeOut((elapsed - 0.18 - p.delay) / 1.12);
        if (t <= 0) return;
        const arc = Math.sin(t * Math.PI) * (8 + p.seed * 12);
        const x = cx + p.x0 + (p.x1 - p.x0) * t;
        const y = cy + p.y0 + (p.y1 - p.y0) * t - arc * (1 - t);
        ctx.globalAlpha = Math.min(1, t * 1.35) * (1 - wordIn * 0.92);
        ctx.fillStyle = p.seed > 0.78 ? BLUE : SILVER;
        const s = t < 0.2 ? 2.1 : 1.25;
        ctx.fillRect(x, y, s, s);
      });
      ctx.globalAlpha = 1;
    }

    if (wordIn > 0) {
      const sheenX = ((elapsed * 80) % (width + 140)) - 70;
      const floatY = Math.sin(elapsed * 0.65) * 1.2;
      ctx.save();
      ctx.translate(0, floatY);
      layer.setTransform(DPR, 0, 0, DPR, 0, 0);
      layer.clearRect(0, 0, width, height);
      paintWord(layer, width, height, 0, BLUE);
      layer.globalCompositeOperation = "source-atop";
      const gleam = layer.createLinearGradient(sheenX - 56, 0, sheenX + 56, 0);
      gleam.addColorStop(0, "rgba(255,255,255,0)");
      gleam.addColorStop(0.5, "rgba(255,255,255,0.4)");
      gleam.addColorStop(1, "rgba(255,255,255,0)");
      layer.fillStyle = gleam;
      layer.fillRect(0, 0, width, height);
      layer.globalCompositeOperation = "source-over";
      ctx.globalAlpha = wordIn;
      ctx.drawImage(wordLayer, 0, 0, width, height);
      ctx.restore();
    }

    const rx = width * 0.4;
    const ry = height * 0.3;
    const fire = easeOut(elapsed / 0.5);
    dots.forEach((dot, di) => {
      dot.angle += 0.384 * dt;
      const orbitX = Math.cos(dot.angle) * rx;
      const orbitY = Math.sin(dot.angle) * ry * 0.78;
      const burstA = (Math.PI * 2 * di) / 3 - Math.PI / 2;
      const outX = Math.cos(burstA) * rx * 1.18;
      const outY = Math.sin(burstA) * ry * 1.05;
      const x = cx + outX * fire + (orbitX - outX) * lock;
      const y = cy + outY * fire + (orbitY - outY) * lock;
      const trailPts = trails[di];
      trailPts.push({ x, y });
      if (trailPts.length > 16) trailPts.shift();
      trailPts.forEach((pt, n) => {
        ctx.globalAlpha = (n / trailPts.length) * 0.32;
        ctx.fillStyle = BLUE;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.05, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = BLUE;
      ctx.shadowColor = BLUE;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(x, y, 1.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    const name = String(i).padStart(4, "0") + ".png";
    writeFileSync(join(framesDir, name), canvas.toBuffer("image/png"));
    if (i % 30 === 0) console.log(label, i + "/" + total);
  }
  console.log(label, "wrote", total, "frames");
  return { dir: framesDir, total, duration };
}

const clip = renderFrames("full", 0, 12);
const loop = renderFrames("loop", 2.6, 9.67);
writeFileSync(
  join(root, "frames", "meta.json"),
  JSON.stringify({ clip, loop, fps: FPS }, null, 2)
);
console.log("done");
