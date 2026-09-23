/* ==========================================================================
   Page assemble — same intro as the itarin wordmark

   Three dots fire from the mark. Particles stream out and lock into every
   catalog element. Plays even with prefers-reduced-motion.
   ========================================================================== */

(function () {
  "use strict";

  var BLUE = "#1f3db5";
  var SILVER = "#8b93a6";
  var particles = [];
  var satellites = [];
  var targets = [];
  var canvas = null;
  var ctx = null;
  var dpr = 1;
  var width = 0;
  var height = 0;
  var originX = 0;
  var originY = 0;
  var burstX = 0;
  var burstY = 0;
  var started = 0;
  var frame = 0;
  var finished = false;
  var mode = "boot";
  var pace = 1.35;
  var generation = 0;
  var bootTimer = 0;

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

  function syncColors() {
    var styles = getComputedStyle(document.documentElement);
    BLUE = (styles.getPropertyValue("--accent") || BLUE).trim() || BLUE;
    SILVER = (styles.getPropertyValue("--silver") || SILVER).trim() || SILVER;
  }

  function hideGate() {
    var gate = document.getElementById("gate");
    if (gate) gate.classList.add("is-gone");
  }

  function reveal() {
    document.documentElement.classList.remove("is-assembling", "is-reassembling");
    document.querySelectorAll("[data-assemble]").forEach(function (el) {
      el.style.opacity = "";
    });
    hideGate();
  }

  function skip(el) {
    if (!el || el.closest(".mark") || el.closest(".invaders-game") || el.closest(".gate")) return true;
    if (el.closest("[hidden]")) return true;
    if (el.closest(".deck__stage")) return true;
    if (el.classList.contains("sr-only")) return true;
    var rect = el.getBoundingClientRect();
    return rect.width < 4 || rect.height < 4;
  }

  function samplePixels(g, w, h, rect, step, keepColor) {
    var data;
    try {
      data = g.getImageData(0, 0, w, h).data;
    } catch (err) {
      return [];
    }
    var pts = [];
    var gap = Math.max(1, step);
    for (var y = 0; y < h; y += gap) {
      for (var x = 0; x < w; x += gap) {
        var i = (y * w + x) * 4;
        if (data[i + 3] < 48) continue;
        pts.push({
          x: rect.left + ((x + 0.5) / w) * rect.width,
          y: rect.top + ((y + 0.5) / h) * rect.height,
          color: keepColor ? "rgb(" + data[i] + "," + data[i + 1] + "," + data[i + 2] + ")" : null
        });
      }
    }
    return pts;
  }

  function sampleImage(img, rect) {
    if (!img || !img.naturalWidth) return [];
    var off = document.createElement("canvas");
    var g = off.getContext("2d", { willReadFrequently: true });
    if (!g) return [];
    var max = rect.width * rect.height > 20000 ? 96 : 56;
    var scale = max / Math.max(rect.width, rect.height);
    var w = Math.max(12, Math.round(rect.width * scale));
    var h = Math.max(12, Math.round(rect.height * scale));
    off.width = w;
    off.height = h;
    try {
      g.drawImage(img, 0, 0, w, h);
    } catch (err) {
      return [];
    }
    return samplePixels(g, w, h, rect, w > 70 ? 2 : 1, true);
  }

  function sampleText(el, rect) {
    var text = (el.innerText || "").replace(/\r/g, "").trim();
    if (!text || text.length > 120) return [];
    var style = getComputedStyle(el);
    var fontSize = parseFloat(style.fontSize) || 16;
    var lineHeight = parseFloat(style.lineHeight);
    if (!lineHeight || isNaN(lineHeight)) lineHeight = fontSize * 1.35;
    var w = Math.max(2, Math.ceil(rect.width));
    var h = Math.max(2, Math.ceil(rect.height));
    var off = document.createElement("canvas");
    var g = off.getContext("2d", { willReadFrequently: true });
    if (!g) return [];
    off.width = w;
    off.height = h;
    g.font = style.font || (style.fontWeight + " " + style.fontSize + " " + style.fontFamily);
    g.fillStyle = "#000";
    g.textBaseline = "top";
    var align = style.textAlign;
    var x = 0;
    if (align === "center") {
      g.textAlign = "center";
      x = w / 2;
    } else if (align === "right" || align === "end") {
      g.textAlign = "right";
      x = w;
    } else {
      g.textAlign = "left";
      x = 0;
    }
    var lines = text.split("\n");
    var startY = Math.max(0, (h - lines.length * lineHeight) / 2);
    lines.forEach(function (line, n) {
      g.fillText(line.trim(), x, startY + n * lineHeight, w);
    });
    return samplePixels(g, w, h, rect, fontSize > 28 ? 2 : 1, false);
  }

  function sampleBox(rect, step) {
    var pts = [];
    var gap = Math.max(3, step);
    for (var y = rect.top; y < rect.bottom; y += gap) {
      for (var x = rect.left; x < rect.right; x += gap) {
        pts.push({ x: x, y: y });
      }
    }
    return pts;
  }

  function sampleTarget(el, rect) {
    var pts = [];
    var img = el.tagName === "IMG" ? el : el.querySelector("img");
    if (img && img.naturalWidth) {
      var ir = img.getBoundingClientRect();
      if (ir.width > 18 && ir.height > 18) pts = pts.concat(sampleImage(img, ir));
    }

    var imageOnly = el.matches(".unit__object, .social a");
    if (!imageOnly) {
      var textHost = el;
      var label = el.querySelector("strong, .disk__title, .unit__title, .frame__title, .repo__name");
      if (label && img) textHost = label;
      var textPts = sampleText(textHost, textHost.getBoundingClientRect());
      if (textPts.length) pts = pts.concat(textPts);
      el.querySelectorAll("em, time, .unit__meta, .disk__format, .disk__price, small").forEach(function (node) {
        pts = pts.concat(sampleText(node, node.getBoundingClientRect()));
      });
    }

    if (!pts.length) {
      var step = Math.max(4, Math.round(Math.sqrt(Math.max(1, rect.width * rect.height)) / 16));
      pts = sampleBox(rect, step);
    }
    return pts;
  }

  function markOrigin() {
    var mark = document.querySelector(".mark");
    if (!mark) {
      return { x: window.innerWidth * 0.18, y: 88 };
    }
    var rect = mark.getBoundingClientRect();
    return {
      x: rect.left + rect.width * 0.5,
      y: rect.top + rect.height * 0.55
    };
  }

  function collect() {
    particles = [];
    satellites = [];
    targets = [];
    var seen = [];
    var origin = markOrigin();
    burstX = origin.x;
    burstY = origin.y;

    document.querySelectorAll("[data-assemble]").forEach(function (el) {
      if (skip(el) || seen.indexOf(el) >= 0) return;
      seen.push(el);
      var rect = el.getBoundingClientRect();
      var pts = sampleTarget(el, rect);
      if (!pts.length) return;

      var cx = rect.left + rect.width / 2;
      var cy = rect.top + rect.height / 2;
      var dist = Math.hypot(cx - burstX, cy - burstY);
      var stagger = clamp(dist / 1400, 0, 0.55);
      var budget = rect.width * rect.height > 16000 ? 280 : 90;
      var count = Math.min(pts.length, budget);
      if (particles.length + count > 3800) count = Math.max(0, 3800 - particles.length);
      if (!count) {
        targets.push({ el: el, stagger: stagger });
        return;
      }

      var rx = Math.max(16, rect.width * 0.38);
      var ry = Math.max(10, rect.height * 0.28);

      targets.push({ el: el, stagger: stagger });

      for (var i = 0; i < count; i++) {
        var dest = pts[Math.floor(i * pts.length / count)];
        var burst = (Math.PI * 2 * (i % 3)) / 3 - Math.PI / 2;
        var seed = Math.random();
        var spread = 5 + seed * 16;
        var x0 = burstX + Math.cos(burst) * (10 + seed * 22) + (seed - 0.5) * spread;
        var y0 = burstY + Math.sin(burst) * (8 + seed * 16) + (Math.random() - 0.5) * spread;
        var midX = (x0 + dest.x) / 2 + (seed - 0.5) * 80;
        var midY = (y0 + dest.y) / 2 - (18 + seed * 46);
        particles.push({
          x0: x0,
          y0: y0,
          cx: midX,
          cy: midY,
          x1: dest.x,
          y1: dest.y,
          delay: stagger + (i / count) * 0.42,
          stagger: stagger,
          seed: seed,
          color: dest.color || (seed > 0.78 ? BLUE : SILVER)
        });
      }

      if (rect.width * rect.height > 3200 && rect.height > 28) {
        satellites.push({
          cx: cx,
          cy: cy,
          rx: rx,
          ry: ry,
          stagger: stagger,
          dots: [0, 1, 2].map(function (n) {
            return { angle: (Math.PI * 2 * n) / 3 - Math.PI / 2 };
          }),
          trails: [[], [], []]
        });
      }
    });
  }

  function paintTheme(elapsed) {
    targets.forEach(function (item) {
      item.el.style.opacity = String(easeInOut((elapsed - 0.62 - item.stagger) / 0.9));
    });
  }

  function teardown() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    started = 0;
    particles = [];
    satellites = [];
    targets = [];
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null;
    ctx = null;
  }

  function finish() {
    if (finished) return;
    finished = true;
    teardown();
    reveal();
  }

  function draw(now) {
    if (!started) started = now;
    var elapsed = ((now - started) / 1000) * pace;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    if (elapsed < 2.6) {
      particles.forEach(function (p) {
        var t = easeOut((elapsed - 0.1 - p.delay) / 1.12);
        if (t <= 0) return;
        var fade = easeInOut((elapsed - 0.68 - p.stagger) / 0.95);
        var x = bezier(p.x0, p.cx, p.x1, t) - originX;
        var y = bezier(p.y0, p.cy, p.y1, t) - originY;
        ctx.globalAlpha = Math.min(1, t * 1.45) * (1 - fade * 0.92);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(x, y, t < 0.16 ? 2.2 : 1.3, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    satellites.forEach(function (group) {
      var lock = easeOut((elapsed - 0.22 - group.stagger) / 1.2);
      var fire = easeOut((elapsed - group.stagger) / 0.42);
      var fade = 1 - easeInOut((elapsed - 0.86 - group.stagger) / 0.7);
      if (fade <= 0.02) return;
      group.dots.forEach(function (dot, i) {
        dot.angle += 0.42 * 0.016;
        var orbitX = Math.cos(dot.angle) * group.rx;
        var orbitY = Math.sin(dot.angle) * group.ry * 0.78;
        var burstA = (Math.PI * 2 * i) / 3 - Math.PI / 2;
        var outX = burstX + Math.cos(burstA) * 18 - group.cx;
        var outY = burstY + Math.sin(burstA) * 14 - group.cy;
        var x = group.cx + outX * (1 - fire) + (outX + (orbitX - outX) * lock) * fire - originX;
        var y = group.cy + outY * (1 - fire) + (outY + (orbitY - outY) * lock) * fire - originY;
        var trailPts = group.trails[i];
        trailPts.push({ x: x, y: y });
        if (trailPts.length > 18) trailPts.shift();
        trailPts.forEach(function (pt, n) {
          ctx.globalAlpha = (n / trailPts.length) * 0.34 * fade;
          ctx.fillStyle = BLUE;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 1.05, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 0.94 * fade;
        ctx.fillStyle = BLUE;
        ctx.shadowColor = BLUE;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(x, y, 1.95, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
    });
    ctx.globalAlpha = 1;

    paintTheme(elapsed);

    if (elapsed > 2.7) {
      finish();
      return;
    }
    frame = requestAnimationFrame(draw);
  }

  function layoutCanvas() {
    var bounds = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    originX = bounds.left;
    originY = bounds.top;
    width = Math.max(1, bounds.width);
    height = Math.max(1, bounds.height);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  function start() {
    var gen;
    mode = "boot";
    pace = 1.35;
    finished = false;
    teardown();
    gen = ++generation;

    document.documentElement.classList.add("is-assembling");
    document.documentElement.classList.remove("is-reassembling");
    window.setTimeout(function () {
      if (gen === generation) hideGate();
    }, 180);

    document.dispatchEvent(new CustomEvent("assemble", { detail: mode }));

    syncColors();
    canvas = document.createElement("canvas");
    canvas.className = "assemble-layer";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");
    if (!ctx) {
      finish();
      return;
    }
    layoutCanvas();
    collect();
    if (!particles.length) {
      finish();
      return;
    }
    started = 0;
    frame = requestAnimationFrame(draw);
    window.setTimeout(function () {
      if (gen === generation) finish();
    }, Math.round(3200 / pace));
  }

  var booted = false;
  function startOnce() {
    if (booted) return;
    booted = true;
    bootTimer = window.setTimeout(function () {
      bootTimer = 0;
      start();
    }, 1680);
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(startOnce, startOnce);
  }
  setTimeout(startOnce, 400);

  document.addEventListener("themechange", syncColors);
})();
