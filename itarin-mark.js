/* ==========================================================================
   itarin wordmark — VAIO CON DIOS

   Intro: three dots fire, particles stream in and lock into "itarin".
   Idle is a quiet catalog mark: VAIO-blue type, a screen sheen, satellites
   on a tight ellipse. Hover warms the CRT-blue fill.
   ========================================================================== */

(function () {
  "use strict";

  var mark = document.querySelector(".mark");
  if (!mark) return;

  var FONT = "VAIO CON DIOS";
  var WORD = "itarin";
  var BLUE = "#1f3db5";
  var BLUE_LIT = "#4d73f0";
  var BLUE_DEEP = "#152a80";
  var SILVER = "#8b93a6";

  function syncColors() {
    var styles = getComputedStyle(document.documentElement);
    BLUE = (styles.getPropertyValue("--accent") || BLUE).trim() || BLUE;
    BLUE_LIT = (styles.getPropertyValue("--accent-lit") || BLUE_LIT).trim() || BLUE_LIT;
    BLUE_DEEP = (styles.getPropertyValue("--accent-deep") || BLUE_DEEP).trim() || BLUE_DEEP;
    SILVER = (styles.getPropertyValue("--silver") || SILVER).trim() || SILVER;
  }

  var text = mark.querySelector(".mark__text");
  var canvas = document.createElement("canvas");
  canvas.className = "itarin-canvas";
  canvas.setAttribute("aria-hidden", "true");
  mark.appendChild(canvas);

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var width = 0;
  var height = 0;
  var dpr = 1;
  var hovering = false;
  var hoverAmt = 0;
  var started = 0;
  var frame = 0;
  var fontReady = false;
  var pace = 1.35;
  var particles = [];
  var dots = [];
  var trails = [];
  var wordLayer = null;

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

  function bezier(p0, p1, p2, t) {
    var u = 1 - t;
    return u * u * p0 + 2 * u * t * p1 + t * t * p2;
  }

  function sample(str, size) {
    var off = document.createElement("canvas");
    var g = off.getContext("2d");
    g.font = size + "px \"" + FONT + "\"";
    var metrics = g.measureText(str);
    var w = Math.max(2, Math.ceil(metrics.width) + 32);
    var h = Math.max(2, Math.ceil(size * 1.6));
    off.width = w;
    off.height = h;
    g.font = size + "px \"" + FONT + "\"";
    g.fillStyle = "#000";
    g.textBaseline = "alphabetic";
    g.fillText(str, 16, size);
    var data = g.getImageData(0, 0, w, h).data;
    var pts = [];
    var step = size > 48 ? 2 : 2;
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 130) {
          pts.push({ x: x - w / 2, y: y - h * 0.58 });
        }
      }
    }
    return pts;
  }

  function buildParticles() {
    var targetSize = Math.round(height * 0.52);
    var to = sample(WORD, targetSize);
    if (!to.length) return [];

    var rx = width * 0.42;
    var ry = height * 0.32;
    var count = Math.min(340, to.length);
    var list = [];
    for (var i = 0; i < count; i++) {
      var dest = to[Math.floor(i * to.length / count)];
      var burst = (Math.PI * 2 * (i % 3)) / 3 - Math.PI / 2;
      var seed = Math.random();
      var spread = 6 + seed * 14;
      var x0 = Math.cos(burst) * rx * 1.22 + (seed - 0.5) * spread;
      var y0 = Math.sin(burst) * ry * 1.08 + (Math.random() - 0.5) * spread;
      list.push({
        x0: x0,
        y0: y0,
        cx: (x0 + dest.x) * 0.5 + (seed - 0.5) * 36,
        cy: (y0 + dest.y) * 0.5 - (10 + seed * 28),
        x1: dest.x,
        y1: dest.y,
        delay: (i / count) * 0.48,
        seed: seed
      });
    }
    return list;
  }

  function resetDots() {
    dots = [0, 1, 2].map(function (i) {
      return { angle: (Math.PI * 2 * i) / 3 - Math.PI / 2 };
    });
    trails = [[], [], []];
  }

  function layout() {
    var cssW = Math.max(168, Math.round(mark.clientWidth || 240));
    var cssH = Math.max(76, Math.round(cssW * 0.48));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    width = cssW;
    height = cssH;
    wordLayer = document.createElement("canvas");
    wordLayer.width = canvas.width;
    wordLayer.height = canvas.height;
    if (fontReady) particles = buildParticles();
  }

  function wordFont() {
    return Math.round(height * 0.52) + "px \"" + FONT + "\"";
  }

  function paintWord(target, ox, fill) {
    target.save();
    target.translate(width / 2, height * 0.64);
    target.font = wordFont();
    target.textAlign = "center";
    target.textBaseline = "alphabetic";
    target.fillStyle = fill;
    target.fillText(WORD, ox, 0);
    target.restore();
  }

  function drawWord(alpha, sheenX, hover) {
    var layer = wordLayer.getContext("2d");
    layer.setTransform(dpr, 0, 0, dpr, 0, 0);
    layer.clearRect(0, 0, width, height);

    if (hover > 0.04) {
      var g = layer.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, BLUE_LIT);
      g.addColorStop(0.45, BLUE);
      g.addColorStop(1, BLUE_DEEP);
      paintWord(layer, 0, g);
    } else {
      paintWord(layer, 0, BLUE);
    }

    layer.globalCompositeOperation = "source-atop";
    var gleam = layer.createLinearGradient(sheenX - 64, 0, sheenX + 64, 0);
    gleam.addColorStop(0, "rgba(255,255,255,0)");
    gleam.addColorStop(0.5, "rgba(255,255,255," + (0.42 + hover * 0.3) + ")");
    gleam.addColorStop(1, "rgba(255,255,255,0)");
    layer.fillStyle = gleam;
    layer.fillRect(0, 0, width, height);
    layer.globalCompositeOperation = "source-over";

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(wordLayer, 0, 0, width, height);
    ctx.restore();
  }

  function draw() {
    if (!fontReady) return;
    var now = performance.now();
    if (!started) started = now;
    var elapsed = ((now - started) / 1000) * pace;
    hoverAmt += ((hovering ? 1 : 0) - hoverAmt) * 0.08;

    ctx.clearRect(0, 0, width, height);

    var cx = width / 2;
    var cy = height * 0.52;
    var lock = easeOut((elapsed - 0.28) / 1.28);
    var wordIn = easeInOut((elapsed - 0.95) / 0.8);
    var intro = elapsed < 2.45;

    if (intro) {
      particles.forEach(function (p) {
        var t = easeOut((elapsed - 0.14 - p.delay) / 1.08);
        if (t <= 0) return;
        var x = cx + bezier(p.x0, p.cx, p.x1, t);
        var y = cy + bezier(p.y0, p.cy, p.y1, t);
        ctx.globalAlpha = Math.min(1, t * 1.4) * (1 - wordIn * 0.94);
        ctx.fillStyle = p.seed > 0.78 ? BLUE : SILVER;
        ctx.beginPath();
        ctx.arc(x, y, t < 0.18 ? 2.15 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    if (wordIn > 0) {
      var sheenX = ((elapsed * (72 + hoverAmt * 150)) % (width + 150)) - 75;
      var floatY = Math.sin(elapsed * 0.58) * 1.1;
      var settle = 1 + (1 - wordIn) * 0.06;
      ctx.save();
      ctx.translate(width / 2, height / 2 + floatY);
      ctx.scale(settle, settle);
      ctx.translate(-width / 2, -height / 2);
      drawWord(wordIn, sheenX, hoverAmt);
      ctx.restore();
    }

    var rx = width * 0.4;
    var ry = height * 0.3;
    var fire = easeOut(elapsed / 0.46);
    var speed = 0.38 + hoverAmt * 0.9;
    dots.forEach(function (dot, i) {
      dot.angle += speed * 0.016;
      var orbitX = Math.cos(dot.angle) * rx;
      var orbitY = Math.sin(dot.angle) * ry * 0.78;
      var burstA = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      var outX = Math.cos(burstA) * rx * 1.22;
      var outY = Math.sin(burstA) * ry * 1.08;
      var x = cx + outX * fire + (orbitX - outX) * lock;
      var y = cy + outY * fire + (orbitY - outY) * lock;

      var trailPts = trails[i];
      trailPts.push({ x: x, y: y });
      if (trailPts.length > 18) trailPts.shift();
      trailPts.forEach(function (pt, n) {
        ctx.globalAlpha = (n / trailPts.length) * 0.34;
        ctx.fillStyle = BLUE;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 1.05, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = BLUE;
      ctx.shadowColor = BLUE;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.globalAlpha = 1;

    frame = requestAnimationFrame(draw);
  }

  function start(event) {
    if (event && event.type === "assemble") {
      pace = 1.35;
    }
    if (!fontReady) {
      wantStart = true;
      return;
    }
    syncColors();
    layout();
    resetDots();
    started = 0;
    mark.classList.add("is-live");
    if (!frame) frame = requestAnimationFrame(draw);
  }

  mark.addEventListener("pointerenter", function (event) {
    if (event.pointerType === "mouse" || event.pointerType === "pen") hovering = true;
  });
  mark.addEventListener("pointerleave", function () { hovering = false; });

  window.addEventListener("resize", layout);
  document.addEventListener("themechange", syncColors);
  document.addEventListener("assemble", start);

  var wantStart = false;

  function onFont() {
    fontReady = true;
    layout();
    if (wantStart) start();
  }

  if (document.fonts && document.fonts.load) {
    document.fonts.load("80px \"" + FONT + "\"").then(onFont, onFont);
  } else {
    setTimeout(onFont, 160);
  }
  setTimeout(onFont, 1200);
})();
