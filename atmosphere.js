/* ==========================================================================
   Catalog atmosphere

   Home: a rotating globe with GeoNames cities over 25,000 people.
   Major capitals are labeled. Other pages: paper dust only.
   ========================================================================== */

(function () {
  "use strict";

  var paper = document.querySelector(".paper");
  if (!paper) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

  var canvas = document.createElement("canvas");
  canvas.className = "atmosphere";
  canvas.setAttribute("aria-hidden", "true");
  paper.appendChild(canvas);

  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  var width = 0;
  var height = 0;
  var dpr = 1;
  var frame = 0;
  var last = 0;
  var accent = { r: 47, g: 84, b: 199 };
  var silver = { r: 142, g: 151, b: 171 };
  var dark = false;
  var world = "home";
  var motes = [];
  var cities = [];
  var labels = [];

  function hexRgb(value, fallback) {
    var hex = (value || "").trim().replace("#", "");
    if (hex.length === 3) {
      hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    }
    if (hex.length !== 6) return fallback;
    var n = parseInt(hex, 16);
    if (isNaN(n)) return fallback;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function tint(rgb, alpha) {
    return "rgba(" + rgb.r + "," + rgb.g + "," + rgb.b + "," + alpha + ")";
  }

  function syncColors() {
    var styles = getComputedStyle(document.documentElement);
    accent = hexRgb(styles.getPropertyValue("--accent"), accent);
    silver = hexRgb(styles.getPropertyValue("--silver"), silver);
    dark = document.documentElement.dataset.theme === "dark";
  }

  function syncWorld() {
    world = document.body.dataset.world || "home";
  }

  function seedMotes() {
    var count = Math.max(22, Math.min(56, Math.round((width * height) / 22000)));
    motes = [];
    for (var i = 0; i < count; i++) {
      motes.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() * 0.4 + 0.12) * (Math.random() < 0.5 ? -1 : 1) * 5,
        r: Math.random() * 1.2 + 0.35,
        seed: Math.random() * Math.PI * 2,
        pulse: 0.18 + Math.random() * 0.35
      });
    }
  }

  function viewportSize() {
    if (window.visualViewport) {
      return {
        width: Math.max(1, Math.round(window.visualViewport.width)),
        height: Math.max(1, Math.round(window.visualViewport.height))
      };
    }
    return {
      width: Math.max(1, window.innerWidth),
      height: Math.max(1, window.innerHeight)
    };
  }

  function layout() {
    var size = viewportSize();
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    width = size.width;
    height = size.height;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedMotes();
  }

  function globeLayout() {
    var phone = width < 720;
    var room = Math.min(width, height);
    var radius;
    var cx;
    var cy;
    if (phone) {
      radius = Math.max(width, height) * 0.78;
      cx = width * 0.72;
      cy = height * 0.58;
      return { cx: cx, cy: cy, r: radius, phone: true, stroke: Math.max(1.15, radius / 300) };
    }
    radius = room * 0.36;
    cx = Math.min(width - radius - 28, width * 0.7);
    cy = height * 0.54;
    if (cx - radius < 8) cx = radius + 8;
    if (cy - radius < 8) cy = radius + 8;
    if (cy + radius > height - 8) cy = height - radius - 8;
    return { cx: cx, cy: cy, r: radius, phone: false, stroke: 1 };
  }

  function xyz(lat, lon, rot) {
    var phi = (lat * Math.PI) / 180;
    var lam = ((lon + rot) * Math.PI) / 180;
    var cosPhi = Math.cos(phi);
    return {
      x: cosPhi * Math.sin(lam),
      y: Math.sin(phi),
      z: cosPhi * Math.cos(lam)
    };
  }

  function screenOf(v, globe) {
    return {
      x: globe.cx + v.x * globe.r,
      y: globe.cy - v.y * globe.r,
      z: v.z
    };
  }

  function strokeParallel(lat, rot, globe, alpha) {
    ctx.beginPath();
    var drawing = false;
    var lon;
    for (lon = -180; lon <= 180; lon += 4) {
      var p = xyz(lat, lon, rot);
      var s = screenOf(p, globe);
      if (p.z < 0) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(s.x, s.y);
        drawing = true;
      } else {
        ctx.lineTo(s.x, s.y);
      }
    }
    ctx.strokeStyle = tint(accent, alpha);
    ctx.lineWidth = (lat === 0 ? 1.05 : 0.7) * globe.stroke;
    ctx.stroke();
  }

  function strokeMeridian(lon, rot, globe, alpha) {
    ctx.beginPath();
    var drawing = false;
    var lat;
    for (lat = -90; lat <= 90; lat += 3) {
      var p = xyz(lat, lon, rot);
      var s = screenOf(p, globe);
      if (p.z < 0) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(s.x, s.y);
        drawing = true;
      } else {
        ctx.lineTo(s.x, s.y);
      }
    }
    ctx.strokeStyle = tint(accent, alpha);
    ctx.lineWidth = (lon === 0 || lon === 180 || lon === -180 ? 1.05 : 0.7) * globe.stroke;
    ctx.stroke();
  }

  function drawGlobe(now) {
    var globe = globeLayout();
    var glow = (dark ? 0.9 : 1) * (globe.phone ? 0.86 : 1);
    var speed = 2.6;
    var rot = reduce.matches ? 18 : now * speed;
    var i;
    var lat;
    var lon;

    ctx.save();
    ctx.beginPath();
    ctx.arc(globe.cx, globe.cy, globe.r, 0, Math.PI * 2);
    ctx.clip();

    for (lat = -75; lat <= 75; lat += 15) {
      strokeParallel(lat, rot, globe, ((lat === 0 ? (dark ? 0.28 : 0.21) : (dark ? 0.14 : 0.11)) * glow));
    }
    for (lon = -180; lon < 180; lon += 15) {
      strokeMeridian(lon, rot, globe, ((lon === 0 ? (dark ? 0.28 : 0.22) : (dark ? 0.14 : 0.11)) * glow));
    }

    var cityR = globe.phone ? Math.max(1.4, globe.r * 0.0038) : 1.15;
    ctx.fillStyle = tint(accent, (dark ? 0.78 : 0.64) * glow);
    ctx.beginPath();
    for (i = 0; i < cities.length; i += 2) {
      var v = xyz(cities[i], cities[i + 1], rot);
      if (v.z < 0.04) continue;
      var s = screenOf(v, globe);
      ctx.moveTo(s.x + cityR, s.y);
      ctx.arc(s.x, s.y, cityR, 0, Math.PI * 2);
    }
    ctx.fill();

    ctx.restore();

    ctx.beginPath();
    ctx.arc(globe.cx, globe.cy, globe.r, 0, Math.PI * 2);
    ctx.strokeStyle = tint(accent, (dark ? 0.36 : 0.3) * glow);
    ctx.lineWidth = 1.2 * globe.stroke;
    ctx.stroke();
  }

  function drawCityLabels(rot, globe, glow) {
    if (!labels.length || globe.phone) return;
    var size = Math.max(8, Math.min(11, globe.r * 0.026));
    var markR = Math.max(1.8, globe.r * 0.006);
    var pad = markR + 4;
    var edge = globe.cx + globe.r + 8;
    var i;

    ctx.font = size + "px ui-monospace, \"Lucida Console\", \"Courier New\", monospace";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    ctx.lineJoin = "round";

    for (i = 0; i < labels.length; i++) {
      var city = labels[i];
      var v = xyz(city.lat, city.lon, rot);
      if (v.z < 0.08) continue;
      var fade = Math.min(1, Math.max(0, (v.z - 0.08) / 0.22));
      var s = screenOf(v, globe);
      var text = city.name;
      var tw = ctx.measureText(text).width;
      var sx = Math.round(s.x);
      var sy = Math.round(s.y);
      var lx = sx + pad;
      var ly = sy - 0.4;
      if (lx + tw > Math.min(width - 8, edge)) lx = sx - pad - tw;

      ctx.beginPath();
      ctx.arc(sx, sy, markR, 0, Math.PI * 2);
      ctx.fillStyle = tint(accent, (dark ? 0.95 : 0.88) * glow * fade);
      ctx.fill();

      ctx.lineWidth = 2.6;
      ctx.strokeStyle = dark ? "rgba(12,14,20," + (0.7 * fade) + ")" : "rgba(228,224,212," + (0.86 * fade) + ")";
      ctx.strokeText(text, Math.round(lx), Math.round(ly));
      ctx.fillStyle = tint(accent, (dark ? 0.94 : 0.82) * glow * fade);
      ctx.fillText(text, Math.round(lx), Math.round(ly));
    }
  }

  function draw(ts) {
    if (document.hidden || document.body.classList.contains("is-playing")) {
      if (!reduce.matches) frame = requestAnimationFrame(draw);
      return;
    }

    var now = ts / 1000;
    var dt = last ? Math.min(0.05, now - last) : 0.016;
    last = now;
    var dust = dark ? 0.28 : 0.72;

    ctx.clearRect(0, 0, width, height);

    motes.forEach(function (mote) {
      if (!reduce.matches) {
        mote.x += mote.vx * dt;
        mote.y += mote.vy * dt;
        if (mote.x < -8) mote.x = width + 8;
        if (mote.x > width + 8) mote.x = -8;
        if (mote.y < -8) mote.y = height + 8;
        if (mote.y > height + 8) mote.y = -8;
      }
      var alpha = (0.07 + Math.sin(now * mote.pulse + mote.seed) * 0.06) * dust * (dark ? 0.5 : 1);
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.r, 0, Math.PI * 2);
      ctx.fillStyle = tint(mote.seed > 2.2 ? accent : silver, alpha);
      ctx.fill();
    });

    if (world === "home") drawGlobe(now);

    if (!reduce.matches) frame = requestAnimationFrame(draw);
  }

  function flattenPairs(list) {
    var out = [];
    var i;
    if (!Array.isArray(list)) return out;
    for (i = 0; i < list.length; i++) {
      var pair = list[i];
      if (!pair || pair.length < 2) continue;
      out.push(+pair[0], +pair[1]);
    }
    return out;
  }

  function loadMap() {
    fetch("data/world-cities.json?v=4")
      .then(function (res) { return res.ok ? res.json() : []; })
      .then(function (list) {
        cities = flattenPairs(list);
        if (reduce.matches) draw(0);
      })
      .catch(function () {});
  }

  var resizeTimer = 0;
  function refreshLayout() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      layout();
      if (reduce.matches) draw(0);
    }, 80);
  }

  layout();
  syncColors();
  syncWorld();
  loadMap();
  window.addEventListener("resize", refreshLayout);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", refreshLayout);
  }
  document.addEventListener("themechange", function () {
    syncColors();
    if (reduce.matches) draw(0);
  });
  document.addEventListener("worldchange", function () {
    syncWorld();
    if (reduce.matches) draw(0);
  });
  reduce.addEventListener("change", function () { location.reload(); });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && !reduce.matches && !frame) frame = requestAnimationFrame(draw);
  });
  if (reduce.matches) draw(0);
  else frame = requestAnimationFrame(draw);
})();
