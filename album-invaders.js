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
