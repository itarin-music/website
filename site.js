/* ==========================================================================
   itarin.online
   ========================================================================== */

(function () {
  "use strict";

  /* --- Worlds: music / coding / visual ---------------------------------- */

  var WORLDS = ["music", "coding", "visual"];
  var nestedIds = { releases: true, "shop-heading": true };
  var worldLinks = document.querySelectorAll(".worlds a");
  var panels = {};
  WORLDS.forEach(function (id) {
    panels[id] = document.getElementById(id);
  });

  function worldFromHash() {
    var id = (location.hash || "#music").replace(/^#/, "");
    if (nestedIds[id]) return "music";
    return WORLDS.indexOf(id) >= 0 ? id : "music";
  }

  function showWorld(id) {
    WORLDS.forEach(function (world) {
      if (panels[world]) panels[world].hidden = world !== id;
    });
    document.body.dataset.world = id;
    worldLinks.forEach(function (link) {
      var on = link.getAttribute("href") === "#" + id;
      if (on) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
    document.dispatchEvent(new CustomEvent("worldchange", { detail: id }));
  }

  worldLinks.forEach(function (link) {
    link.addEventListener("click", function (event) {
      var id = (link.getAttribute("href") || "").replace(/^#/, "");
      if (WORLDS.indexOf(id) < 0) return;
      event.preventDefault();
      if (location.hash !== "#" + id) {
        history.pushState(null, "", "#" + id);
      }
      showWorld(id);
    });
  });

  window.addEventListener("hashchange", function () { showWorld(worldFromHash()); });
  window.addEventListener("popstate", function () { showWorld(worldFromHash()); });
  showWorld(worldFromHash());

  /* --- GitHub projects -------------------------------------------------- */

  var reposList = document.getElementById("repos");
  var GITHUB_USER = "itarin-music";
  var SKIP_REPOS = { "itarin-music": true };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    var day = String(date.getUTCDate()).padStart(2, "0");
    return day + " " + months[date.getUTCMonth()] + " " + date.getUTCFullYear();
  }

  function renderRepos(repos) {
    reposList.innerHTML = "";
    if (!repos.length) {
      reposList.appendChild(el("li", "repos__status", "no public projects yet"));
      return;
    }

    repos.forEach(function (repo) {
      var item = el("li", "repo");
      var link = el("a", "repo__link");
      link.href = repo.html_url;
      link.target = "_blank";
      link.rel = "noopener";

      link.appendChild(el("span", "repo__name", repo.name));
      if (repo.description && repo.description.toLowerCase() !== repo.name.toLowerCase()) {
        link.appendChild(el("span", "repo__desc", repo.description));
      }

      var meta = el("span", "repo__meta");
      if (repo.language) meta.appendChild(el("span", "repo__lang", repo.language));
      var updated = formatDate(repo.pushed_at || repo.updated_at);
      if (updated) {
        var time = el("time", "repo__date", updated);
        time.dateTime = repo.pushed_at || repo.updated_at;
        meta.appendChild(time);
      }
      link.appendChild(meta);
      item.appendChild(link);
      reposList.appendChild(item);
    });
  }

  if (reposList) {
    fetch("https://api.github.com/users/" + GITHUB_USER + "/repos?sort=updated&per_page=12")
      .then(function (response) {
        if (!response.ok) throw new Error("github " + response.status);
        return response.json();
      })
      .then(function (repos) {
        renderRepos(repos.filter(function (repo) {
          return !repo.fork && !SKIP_REPOS[repo.name];
        }));
      })
      .catch(function () {
        reposList.innerHTML = "";
        var item = el("li", "repos__status");
        item.appendChild(document.createTextNode("couldn’t load github — "));
        var fallback = el("a", "", "open profile");
        fallback.href = "https://github.com/" + GITHUB_USER;
        fallback.target = "_blank";
        fallback.rel = "noopener";
        item.appendChild(fallback);
        reposList.appendChild(item);
      });
  }
})();

/* ==========================================================================
   Release marquee

   Progressive enhancement. Without this script the page still shows one rack
   of covers as an ordinary horizontal scroller; this upgrades it to a looping
   belt you can also grab and throw.

   The loop is seamless because position is taken modulo one rack's width, and
   enough clones are made to cover the viewport plus a full rack — the old
   two-rack CSS version ran out of covers on screens wider than the rack and
   left a gap at the loop point.
   ========================================================================== */

(function () {
  "use strict";

  var marquee = document.querySelector(".marquee");
  var rack = marquee && marquee.querySelector(".rack");
  if (!marquee || !rack) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  if (reduce.matches) return;               // leave the CSS scroller alone

  var SPEED = 26;         // px per second
  var DRAG_SLOP = 6;      // px of movement before a press becomes a drag
  var FRICTION = 0.94;    // per-frame decay of throw velocity
  var RESUME_DELAY = 900; // ms of stillness after a throw before auto-scroll resumes

  var track = document.createElement("div");
  track.className = "marquee__track";
  rack.parentNode.insertBefore(track, rack);
  track.appendChild(rack);

  var offset = 0;         // px scrolled, always within [0, rackWidth)
  var rackWidth = 0;
  var clones = [];
  var velocity = 0;       // px/s, from a throw
  var resumeAt = 0;
  var hovering = false;
  var pressing = false;
  var dragging = false;
  var pointerId = null;
  var startX = 0;
  var lastX = 0;
  var lastT = 0;
  var moved = 0;
  var away = document.body.dataset.world && document.body.dataset.world !== "music";

  function measure() {
    // Width of one rack including the trailing gap on its last card.
    var cards = rack.children;
    if (!cards.length) return;
    var styles = getComputedStyle(cards[0]);
    var w = cards[0].getBoundingClientRect().width + parseFloat(styles.marginRight || 0);
    rackWidth = w * cards.length;
  }

  function fill() {
    clones.forEach(function (c) { c.remove(); });
    clones = [];
    measure();
    if (!rackWidth) return;

    // Cover the viewport plus one whole rack, so there is always content to
    // the right no matter where in the cycle we are. +1 for safety.
    var need = Math.ceil(marquee.clientWidth / rackWidth) + 1;
    for (var i = 0; i < need; i++) {
      var clone = rack.cloneNode(true);
      clone.setAttribute("aria-hidden", "true");
      clone.querySelectorAll("a").forEach(function (a) { a.tabIndex = -1; });
      track.appendChild(clone);
      clones.push(clone);
    }
    render();
  }

  function render() {
    track.style.transform = "translate3d(" + (-offset).toFixed(2) + "px,0,0)";
  }

  function wrap(x) {
    if (!rackWidth) return 0;
    return ((x % rackWidth) + rackWidth) % rackWidth;
  }

  // Only a keyboard-driven focus should hold the belt still. Clicking a cover
  // also focuses it, and that must not stop the belt for good.
  function keyboardFocusInside() {
    try {
      return !!marquee.querySelector(":focus-visible");
    } catch (err) {
      return marquee.contains(document.activeElement);
    }
  }

  var prev = 0;
  function tick(now) {
    var dt = prev ? Math.min((now - prev) / 1000, 0.05) : 0;
    prev = now;

    if (!away && !dragging && rackWidth) {
      if (Math.abs(velocity) > 4) {
        offset = wrap(offset + velocity * dt);
        velocity *= Math.pow(FRICTION, dt * 60);
      } else {
        velocity = 0;
        var idle = !hovering && !keyboardFocusInside() && now >= resumeAt;
        if (idle) offset = wrap(offset + SPEED * dt);
      }
      render();
    }
    requestAnimationFrame(tick);
  }

  /* --- pointer: grab, drag, throw ---------------------------------------- */

  // NB: the pointer is captured only once movement passes DRAG_SLOP. Capturing
  // on pointerdown would retarget the subsequent click to .marquee, and covers
  // would stop opening when clicked.
  marquee.addEventListener("pointerdown", function (e) {
    if (away) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pressing = true;
    dragging = false;
    moved = 0;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    lastT = e.timeStamp;
    velocity = 0;
  });

  marquee.addEventListener("pointermove", function (e) {
    if (!pressing || e.pointerId !== pointerId) return;

    if (!dragging) {
      if (Math.abs(e.clientX - startX) <= DRAG_SLOP) return;   // still just a press
      dragging = true;
      marquee.setPointerCapture(pointerId);
      marquee.classList.add("is-grabbing");
      lastX = startX;            // keep the drag 1:1 from where the press began
    }

    var dx = e.clientX - lastX;
    var dt = (e.timeStamp - lastT) / 1000;
    moved += Math.abs(dx);
    offset = wrap(offset - dx);
    render();
    if (dt > 0) velocity = -dx / dt;   // px/s, matching offset's sign
    lastX = e.clientX;
    lastT = e.timeStamp;
  });

  function endDrag(e) {
    if (!pressing || (e && e.pointerId !== pointerId)) return;
    pressing = false;
    if (!dragging) { pointerId = null; return; }   // a plain click - let it through
    dragging = false;
    marquee.classList.remove("is-grabbing");
    if (pointerId !== null && marquee.hasPointerCapture(pointerId)) {
      marquee.releasePointerCapture(pointerId);
    }
    pointerId = null;
    // A stale velocity from a pause mid-drag shouldn't fling the belt.
    if (e && e.timeStamp - lastT > 120) velocity = 0;
    velocity = Math.max(-4000, Math.min(4000, velocity));
    resumeAt = performance.now() + RESUME_DELAY;
  }

  marquee.addEventListener("pointerup", endDrag);
  marquee.addEventListener("pointercancel", endDrag);

  // Swallow the click that ends a drag, so throwing the belt doesn't open a link.
  marquee.addEventListener("click", function (e) {
    if (moved > DRAG_SLOP) {
      e.preventDefault();
      e.stopPropagation();
      moved = 0;
    }
  }, true);

  marquee.addEventListener("dragstart", function (e) { e.preventDefault(); });

  /* --- pause conditions --------------------------------------------------- */

  marquee.addEventListener("pointerenter", function (e) {
    if (e.pointerType === "mouse") hovering = true;
  });
  marquee.addEventListener("pointerleave", function (e) {
    if (e.pointerType === "mouse") hovering = false;
  });
  // Safety net: a pointer that leaves via a capture or a lost event.
  marquee.addEventListener("mouseleave", function () { hovering = false; });

  document.addEventListener("visibilitychange", function () {
    prev = 0;                       // don't jump after the tab was hidden
  });

  window.addEventListener("resize", function () {
    if (!away) fill();
  });
  reduce.addEventListener("change", function () { location.reload(); });

  document.addEventListener("worldchange", function (event) {
    away = event.detail !== "music";
    if (!away) {
      hovering = false;
      fill();
    }
  });

  // Small control surface, handy for debugging the loop in the console.
  marquee.marquee = {
    get offset() { return offset; },
    set offset(v) { offset = wrap(v); render(); },
    get rackWidth() { return rackWidth; },
    pause: function () { hovering = true; },
    resume: function () { hovering = false; }
  };

  marquee.classList.add("is-live");
  if (!away) fill();
  // Cover widths can shift once the font and images settle.
  window.addEventListener("load", function () { if (!away) fill(); });
  requestAnimationFrame(tick);
})();

/* ==========================================================================
   Release artwork backdrop

   Crossfades a release cover behind the page while its card is hovered or
   keyboard-focused. Each change gets a fresh transparent layer, so even rapid
   movement across the marquee cannot swap artwork on a still-visible layer.
   ========================================================================== */

(function () {
  "use strict";

  var backdrop = document.querySelector(".release-backdrops");
  if (!backdrop) return;

  var activeLayer = null;
  var activeUrl = "";
  var hoveredCard = null;

  function cardFrom(node) {
    if (!node || !node.closest) return null;
    return node.closest(".card a") || node.closest(".covers .card");
  }

  function artworkFor(card) {
    var image = card && card.querySelector("img");
    if (!image) return "";

    var source = image.currentSrc || image.src;
    return source.replace("-400.webp", "-800.webp");
  }

  function show(card) {
    if (document.body.dataset.world === "coding") return;
    var url = artworkFor(card);
    if (!url || (url === activeUrl && activeLayer)) return;

    var nextLayer = document.createElement("span");
    var shade = "linear-gradient(rgba(5, 7, 10, 0.34), rgba(5, 7, 10, 0.7))";
    nextLayer.style.backgroundImage = shade + ", url(\"" + url.replace(/"/g, "%22") + "\")";
    backdrop.appendChild(nextLayer);

    // Commit the initial opacity: 0 before asking the browser to fade it in.
    nextLayer.getBoundingClientRect();
    nextLayer.classList.add("is-visible");

    if (activeLayer) {
      retire(activeLayer);
    }

    activeLayer = nextLayer;
    activeUrl = url;
  }

  function retire(layer) {
    layer.classList.remove("is-visible");
    setTimeout(function () {
      if (layer.parentNode === backdrop) layer.remove();
    }, 700);
  }

  function hide() {
    if (activeLayer) retire(activeLayer);
    activeLayer = null;
    activeUrl = "";
  }

  function refresh() {
    var focusedCard = cardFrom(document.activeElement);
    var card = focusedCard || hoveredCard;
    if (card) show(card);
    else hide();
  }

  document.addEventListener("pointerover", function (event) {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;

    var card = cardFrom(event.target);
    if (!card || card === cardFrom(event.relatedTarget)) return;
    hoveredCard = card;
    show(card);
  });

  document.addEventListener("pointerout", function (event) {
    if (event.pointerType && event.pointerType !== "mouse" && event.pointerType !== "pen") return;

    var card = cardFrom(event.target);
    if (!card || card === cardFrom(event.relatedTarget)) return;
    hoveredCard = cardFrom(event.relatedTarget);
    refresh();
  });

  document.addEventListener("focusin", function (event) {
    var card = cardFrom(event.target);
    if (card) show(card);
  });

  document.addEventListener("focusout", function () {
    setTimeout(refresh, 0);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      hoveredCard = null;
      hide();
    }
  });

  document.addEventListener("worldchange", function () {
    hoveredCard = null;
    hide();
  });
})();

/* ==========================================================================
   Album Invaders easter egg

   Open by clicking the spinning logo five times quickly or typing "invaders".
   The soundtrack uses the official YouTube player and is capped at 5%.
   ========================================================================== */

(function () {
  "use strict";

  var game = document.getElementById("invaders-game");
  var canvas = game && game.querySelector(".invaders-game__canvas");
  var closeButton = game && game.querySelector(".invaders-game__close");
  var scoreNode = document.getElementById("invaders-score");
  var livesNode = document.getElementById("invaders-lives");
  var messageNode = document.getElementById("invaders-message");
  var mark = document.querySelector(".mark");
  if (!game || !canvas || !closeButton || !mark) return;

  var context = canvas.getContext("2d");
  if (!context) return;

  var VIDEO_ID = "RNnyArye0M0";
  var VIDEO_START = 815;
  var VOLUME = 5;
  var covers = [];
  var active = false;
  var frame = 0;
  var lastTime = 0;
  var width = 0;
  var height = 0;
  var ratio = 1;
  var previousFocus = null;

  var ship = { x: 0, y: 0, width: 34, height: 24, speed: 390, invulnerableUntil: 0 };
  var enemies = [];
  var bullets = [];
  var enemyBullets = [];
  var keys = Object.create(null);
  var direction = 1;
  var shotAt = 0;
  var enemyShotIn = 0;
  var score = 0;
  var lives = 3;
  var wave = 1;
  var gameOver = false;

  /* --- soundtrack ------------------------------------------------------- */

  var player = null;
  var playerReady = false;
  var wantsAudio = false;

  function startSoundtrack(restart) {
    wantsAudio = true;
    if (!playerReady || !player) return;

    // Set the quiet volume before unmuting so no default-volume audio leaks.
    player.setVolume(VOLUME);
    if (restart) player.seekTo(VIDEO_START, true);
    player.unMute();
    player.playVideo();
  }

  function stopSoundtrack() {
    wantsAudio = false;
    if (playerReady && player) player.pauseVideo();
  }

  function createPlayer() {
    if (player || !window.YT || !window.YT.Player) return;

    player = new window.YT.Player("invaders-player", {
      width: 200,
      height: 200,
      videoId: VIDEO_ID,
      playerVars: {
        start: VIDEO_START,
        autoplay: 0,
        controls: 1,
        playsinline: 1,
        rel: 0
      },
      events: {
        onReady: function (event) {
          playerReady = true;
          event.target.setVolume(VOLUME);
          event.target.mute();
          if (wantsAudio) startSoundtrack(true);
        }
      }
    });
  }

  var previousYouTubeReady = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = function () {
    if (typeof previousYouTubeReady === "function") previousYouTubeReady();
    createPlayer();
  };

  if (window.YT && window.YT.Player) {
    createPlayer();
  } else if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
    var youtubeScript = document.createElement("script");
    youtubeScript.src = "https://www.youtube.com/iframe_api";
    youtubeScript.async = true;
    document.head.appendChild(youtubeScript);
  }

  /* --- setup ------------------------------------------------------------ */

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function loadCovers() {
    var seen = Object.create(null);
    document.querySelectorAll(".rack:not([aria-hidden]) .card img").forEach(function (source) {
      var url = (source.currentSrc || source.src).replace("-400.webp", "-800.webp");
      if (seen[url]) return;
      seen[url] = true;

      var image = new Image();
      image.src = url;
      covers.push(image);
    });
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);

    ship.y = height - 58;
    ship.x = clamp(ship.x, ship.width, width - ship.width);
  }

  function spawnWave() {
    enemies = [];
    direction = 1;
    enemyShotIn = 0.7;

    var size = clamp(Math.floor((width - 100) / 8), 48, 72);
    var gap = clamp(Math.floor(size * 0.26), 10, 18);
    var columns = Math.min(covers.length, Math.max(3, Math.floor((width - 50) / (size + gap))));
    var rows = height < 520 ? 1 : 2;
    var formationWidth = columns * size + (columns - 1) * gap;
    var startX = (width - formationWidth) / 2;
    var startY = height < 520 ? 70 : 92;

    for (var row = 0; row < rows; row++) {
      for (var column = 0; column < columns; column++) {
        enemies.push({
          x: startX + column * (size + gap),
          y: startY + row * (size + gap),
          width: size,
          height: size,
          image: covers[(column + row) % covers.length]
        });
      }
    }
  }

  function resetGame() {
    score = 0;
    lives = 3;
    wave = 1;
    bullets = [];
    enemyBullets = [];
    gameOver = false;
    ship.x = width / 2;
    ship.y = height - 58;
    ship.invulnerableUntil = 0;
    messageNode.hidden = true;
    updateHud();
    spawnWave();
  }

  function updateHud() {
    scoreNode.textContent = String(score).padStart(5, "0");
    livesNode.textContent = lives;
  }

  /* --- controls --------------------------------------------------------- */

  function fire(now) {
    if (gameOver) {
      resetGame();
      return;
    }
    if (now - shotAt < 170) return;

    shotAt = now;
    bullets.push({
      x: ship.x,
      y: ship.y - ship.height / 2,
      width: 3,
      height: 13
    });
  }

  function openGame() {
    if (active) return;
    active = true;
    previousFocus = document.activeElement;
    game.hidden = false;
    document.body.classList.add("is-playing");
    resize();
    resetGame();
    game.focus();

    var marquee = document.querySelector(".marquee");
    if (marquee && marquee.marquee) marquee.marquee.pause();

    startSoundtrack(true);
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  }

  function closeGame() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(frame);
    frame = 0;
    keys = Object.create(null);
    game.hidden = true;
    document.body.classList.remove("is-playing");
    stopSoundtrack();

    var marquee = document.querySelector(".marquee");
    if (marquee && marquee.marquee) marquee.marquee.resume();
    if (previousFocus && previousFocus.focus) previousFocus.focus();
  }

  document.addEventListener("keydown", function (event) {
    if (!active) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeGame();
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight" ||
        event.key === "a" || event.key === "A" || event.key === "d" || event.key === "D" ||
        event.code === "Space") {
      event.preventDefault();
      keys[event.key.toLowerCase()] = true;
    }

    if (event.code === "Space") fire(performance.now());
    if (gameOver && event.key === "Enter") resetGame();
  });

  document.addEventListener("keyup", function (event) {
    if (!active) return;
    keys[event.key.toLowerCase()] = false;
  });

  canvas.addEventListener("pointermove", function (event) {
    if (!active) return;
    ship.x = clamp(event.clientX, ship.width, width - ship.width);
  });

  canvas.addEventListener("pointerdown", function (event) {
    if (!active) return;
    ship.x = clamp(event.clientX, ship.width, width - ship.width);
    fire(performance.now());
  });

  closeButton.addEventListener("click", closeGame);
  window.addEventListener("resize", function () {
    if (active) {
      resize();
      spawnWave();
    }
  });

  /* --- game ------------------------------------------------------------- */

  function overlaps(a, b) {
    return a.x - a.width / 2 < b.x + b.width / 2 &&
           a.x + a.width / 2 > b.x - b.width / 2 &&
           a.y - a.height / 2 < b.y + b.height / 2 &&
           a.y + a.height / 2 > b.y - b.height / 2;
  }

  function endGame() {
    gameOver = true;
    bullets = [];
    enemyBullets = [];
    messageNode.textContent = "game over\nscore " + String(score).padStart(5, "0") +
                              "\npress enter or click to restart";
    messageNode.hidden = false;
  }

  function update(dt, now) {
    if (gameOver) return;

    var movement = 0;
    if (keys.arrowleft || keys.a) movement -= 1;
    if (keys.arrowright || keys.d) movement += 1;
    ship.x = clamp(ship.x + movement * ship.speed * dt, ship.width, width - ship.width);

    bullets.forEach(function (bullet) { bullet.y -= 650 * dt; });
    enemyBullets.forEach(function (bullet) { bullet.y += 330 * dt; });
    bullets = bullets.filter(function (bullet) { return bullet.y > -20; });
    enemyBullets = enemyBullets.filter(function (bullet) { return bullet.y < height + 20; });

    var left = Infinity;
    var right = -Infinity;
    enemies.forEach(function (enemy) {
      left = Math.min(left, enemy.x - enemy.width / 2);
      right = Math.max(right, enemy.x + enemy.width / 2);
    });

    var speed = 28 + wave * 7;
    var horizontal = direction * speed * dt;
    if (left + horizontal < 14 || right + horizontal > width - 14) {
      direction *= -1;
      enemies.forEach(function (enemy) { enemy.y += 18; });
    } else {
      enemies.forEach(function (enemy) { enemy.x += horizontal; });
    }

    for (var bulletIndex = bullets.length - 1; bulletIndex >= 0; bulletIndex--) {
      for (var enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
        if (!overlaps(bullets[bulletIndex], enemies[enemyIndex])) continue;
        bullets.splice(bulletIndex, 1);
        enemies.splice(enemyIndex, 1);
        score += 100;
        updateHud();
        break;
      }
    }

    enemyShotIn -= dt;
    if (enemyShotIn <= 0 && enemies.length) {
      var shooter = enemies[Math.floor(Math.random() * enemies.length)];
      enemyBullets.push({
        x: shooter.x,
        y: shooter.y + shooter.height / 2,
        width: 4,
        height: 12
      });
      enemyShotIn = Math.max(0.38, 1.15 - wave * 0.06) + Math.random() * 0.45;
    }

    if (now >= ship.invulnerableUntil) {
      for (var shotIndex = enemyBullets.length - 1; shotIndex >= 0; shotIndex--) {
        if (!overlaps(enemyBullets[shotIndex], ship)) continue;
        enemyBullets.splice(shotIndex, 1);
        lives -= 1;
        ship.invulnerableUntil = now + 1300;
        updateHud();
        if (lives <= 0) endGame();
        break;
      }
    }

    if (enemies.some(function (enemy) {
      return enemy.y + enemy.height / 2 >= ship.y - ship.height;
    })) {
      endGame();
    } else if (!enemies.length) {
      wave += 1;
      bullets = [];
      enemyBullets = [];
      spawnWave();
    }
  }

  function drawGrid() {
    context.strokeStyle = "rgba(127, 214, 238, 0.035)";
    context.lineWidth = 1;
    context.beginPath();

    for (var x = 0; x < width; x += 36) {
      context.moveTo(x, 0);
      context.lineTo(x, height);
    }
    for (var y = 0; y < height; y += 36) {
      context.moveTo(0, y);
      context.lineTo(width, y);
    }
    context.stroke();
  }

  function draw() {
    context.clearRect(0, 0, width, height);
    context.fillStyle = "#030509";
    context.fillRect(0, 0, width, height);
    drawGrid();

    enemies.forEach(function (enemy) {
      context.save();
      context.shadowColor = "rgba(127, 214, 238, 0.42)";
      context.shadowBlur = 10;
      if (enemy.image.complete && enemy.image.naturalWidth) {
        context.drawImage(
          enemy.image,
          enemy.x - enemy.width / 2,
          enemy.y - enemy.height / 2,
          enemy.width,
          enemy.height
        );
      } else {
        context.fillStyle = "#7fd6ee";
        context.fillRect(
          enemy.x - enemy.width / 2,
          enemy.y - enemy.height / 2,
          enemy.width,
          enemy.height
        );
      }
      context.strokeStyle = "rgba(238, 242, 247, 0.52)";
      context.strokeRect(
        enemy.x - enemy.width / 2,
        enemy.y - enemy.height / 2,
        enemy.width,
        enemy.height
      );
      context.restore();
    });

    context.save();
    context.fillStyle = "#7fd6ee";
    context.shadowColor = "#7fd6ee";
    context.shadowBlur = 12;
    bullets.forEach(function (bullet) {
      context.fillRect(
        bullet.x - bullet.width / 2,
        bullet.y - bullet.height / 2,
        bullet.width,
        bullet.height
      );
    });
    context.fillStyle = "#eef2f7";
    enemyBullets.forEach(function (bullet) {
      context.fillRect(
        bullet.x - bullet.width / 2,
        bullet.y - bullet.height / 2,
        bullet.width,
        bullet.height
      );
    });
    context.restore();

    if (!gameOver && (performance.now() >= ship.invulnerableUntil ||
        Math.floor(performance.now() / 90) % 2 === 0)) {
      context.save();
      context.translate(ship.x, ship.y);
      context.fillStyle = "#7fd6ee";
      context.strokeStyle = "#eef2f7";
      context.lineWidth = 1.5;
      context.shadowColor = "#7fd6ee";
      context.shadowBlur = 15;
      context.beginPath();
      context.moveTo(0, -ship.height / 2);
      context.lineTo(ship.width / 2, ship.height / 2);
      context.lineTo(0, ship.height / 3);
      context.lineTo(-ship.width / 2, ship.height / 2);
      context.closePath();
      context.fill();
      context.stroke();
      context.restore();
    }
  }

  function tick(now) {
    if (!active) return;
    var dt = lastTime ? Math.min((now - lastTime) / 1000, 0.04) : 0;
    lastTime = now;
    update(dt, now);
    draw();
    frame = requestAnimationFrame(tick);
  }

  /* --- secret entrances ------------------------------------------------- */

  var logoClicks = 0;
  var lastLogoClick = 0;
  mark.addEventListener("click", function () {
    var now = Date.now();
    if (now - lastLogoClick > 1500) logoClicks = 0;
    lastLogoClick = now;
    logoClicks += 1;

    if (logoClicks >= 5) {
      logoClicks = 0;
      openGame();
    }
  });

  var typed = "";
  document.addEventListener("keydown", function (event) {
    if (active || event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1) return;
    if (/^(input|textarea|select)$/i.test(event.target.tagName)) return;

    typed = (typed + event.key.toLowerCase()).slice(-8);
    if (typed === "invaders") {
      typed = "";
      openGame();
    }
  });

  loadCovers();
})();
