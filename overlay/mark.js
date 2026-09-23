/* Transparent itarin wordmark for OBS Browser Source. */
(function () {
  "use strict";

  var mark = document.querySelector(".mark");
  if (!mark) return;

  var FONT = "VAIO CON DIOS";
  var WORD = "itarin";
  var SOURCE = "VAIO CON DIOS";
  var BLUE = "#2f54c7";
  var BLUE_LIT = "#5a86ff";
  var BLUE_DEEP = "#1c348c";
  var SILVER = "#8e97ab";
  var skipIntro = /(?:\?|&)idle(?:=1|&|$)/.test(location.search);

  var canvas = document.createElement("canvas");
  canvas.className = "itarin-canvas";
  mark.appendChild(canvas);
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var width = 0;
  var height = 0;
  var dpr = 1;
  var started = 0;
  var frame = 0;
  var fontReady = false;
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

  function sample(str, size) {
    var off = document.createElement("canvas");
    var g = off.getContext("2d");
    g.font = size + "px \"" + FONT + "\"";
    var metrics = g.measureText(str);
    var w = Math.max(2, Math.ceil(metrics.width) + 28);
    var h = Math.max(2, Math.ceil(size * 1.55));
    off.width = w;
    off.height = h;
    g.font = size + "px \"" + FONT + "\"";
    g.fillStyle = "#000";
    g.textBaseline = "alphabetic";
    g.fillText(str, 14, size);
    var data = g.getImageData(0, 0, w, h).data;
    var pts = [];
    var step = size > 48 ? 3 : 2;
    for (var y = 0; y < h; y += step) {
      for (var x = 0; x < w; x += step) {
        if (data[(y * w + x) * 4 + 3] > 140) {
          pts.push({ x: x - w / 2, y: y - h * 0.58 });
        }
      }
    }
    return pts;
  }

  function buildParticles() {
    var targetSize = Math.round(height * 0.5);
    var sourceSize = Math.round(targetSize * 0.58);
    var from = sample(SOURCE, sourceSize);
    var to = sample(WORD, targetSize);
    if (!from.length || !to.length) return [];
    var count = Math.min(260, to.length);
    var list = [];
    for (var i = 0; i < count; i++) {
      var dest = to[Math.floor(i * to.length / count)];
      var origin = from[Math.floor((i * from.length / count) % from.length)];
      list.push({
        x0: origin.x, y0: origin.y, x1: dest.x, y1: dest.y,
        delay: (i / count) * 0.55, seed: Math.random()
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
    var cssW = Math.max(320, Math.round(window.innerWidth || 1280));
    var cssH = Math.max(160, Math.round(window.innerHeight || 640));
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
    return Math.round(height * 0.5) + "px \"" + FONT + "\"";
  }

  function paintWord(target, ox, fill) {
    target.save();
    target.translate(width / 2, height * 0.62);
    target.font = wordFont();
    target.textAlign = "center";
    target.textBaseline = "alphabetic";
    target.fillStyle = fill;
    target.fillText(WORD, ox, 0);
    target.restore();
  }

  function paintSource(alpha) {
    if (alpha <= 0.01) return;
    var size = Math.round(height * 0.26);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(width / 2, height * 0.58);
    ctx.font = size + "px \"" + FONT + "\"";
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = SILVER;
    ctx.fillText(SOURCE, 0, 0);
    ctx.restore();
  }

  function drawWord(alpha, sheenX) {
    var layer = wordLayer.getContext("2d");
    layer.setTransform(dpr, 0, 0, dpr, 0, 0);
    layer.clearRect(0, 0, width, height);
    paintWord(layer, 0, BLUE);
    layer.globalCompositeOperation = "source-atop";
    var gleam = layer.createLinearGradient(sheenX - 56, 0, sheenX + 56, 0);
    gleam.addColorStop(0, "rgba(255,255,255,0)");
    gleam.addColorStop(0.5, "rgba(255,255,255,0.4)");
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
    var elapsed = (now - started) / 1000;
    if (skipIntro) elapsed += 2.5;

    ctx.clearRect(0, 0, width, height);

    var cx = width / 2;
    var cy = height * 0.52;
    var lock = easeOut((elapsed - 0.32) / 1.35);
    var wordIn = easeInOut((elapsed - 1.05) / 0.85);
    var intro = elapsed < 2.4;

    if (intro) {
      paintSource((1 - easeOut((elapsed - 0.08) / 0.85)) * 0.72);
      particles.forEach(function (p) {
        var t = easeOut((elapsed - 0.18 - p.delay) / 1.12);
        if (t <= 0) return;
        var arc = Math.sin(t * Math.PI) * (8 + p.seed * 12);
        var x = cx + p.x0 + (p.x1 - p.x0) * t;
        var y = cy + p.y0 + (p.y1 - p.y0) * t - arc * (1 - t);
        ctx.globalAlpha = Math.min(1, t * 1.35) * (1 - wordIn * 0.92);
        ctx.fillStyle = p.seed > 0.78 ? BLUE : SILVER;
        var s = t < 0.2 ? 2.1 : 1.25;
        ctx.fillRect(x, y, s, s);
      });
      ctx.globalAlpha = 1;
    }

    if (wordIn > 0) {
      var sheenX = ((elapsed * 80) % (width + 140)) - 70;
      var floatY = Math.sin(elapsed * 0.65) * 1.2;
      ctx.save();
      ctx.translate(0, floatY);
      drawWord(wordIn, sheenX);
      ctx.restore();
    }

    var rx = width * 0.4;
    var ry = height * 0.3;
    var fire = easeOut(elapsed / 0.5);
    var speed = 0.4;
    dots.forEach(function (dot, i) {
      dot.angle += speed * 0.016;
      var orbitX = Math.cos(dot.angle) * rx;
      var orbitY = Math.sin(dot.angle) * ry * 0.78;
      var burstA = (Math.PI * 2 * i) / 3 - Math.PI / 2;
      var outX = Math.cos(burstA) * rx * 1.18;
      var outY = Math.sin(burstA) * ry * 1.05;
      var x = cx + outX * fire + (orbitX - outX) * lock;
      var y = cy + outY * fire + (orbitY - outY) * lock;
      var trailPts = trails[i];
      trailPts.push({ x: x, y: y });
      if (trailPts.length > 16) trailPts.shift();
      trailPts.forEach(function (pt, n) {
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
    frame = requestAnimationFrame(draw);
  }

  function start() {
    fontReady = true;
    layout();
    resetDots();
    started = 0;
    if (!frame) frame = requestAnimationFrame(draw);
  }

  window.addEventListener("resize", layout);
  if (document.fonts && document.fonts.load) {
    document.fonts.load("80px \"" + FONT + "\"").then(start, start);
  } else {
    setTimeout(start, 160);
  }
  setTimeout(function () { if (!fontReady) start(); }, 1200);
})();
