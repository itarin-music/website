/* ==========================================================================
   Catalog shuffle deck

   Plays official YouTube embeds so listens can count as views.
   Volume starts at 5% on a power curve so quiet settings stay quiet.
  and Album Invaders. Tells the user when an ad is on instead of the song.
   ========================================================================== */

(function () {
  "use strict";

  var root = document.querySelector(".deck");
  if (!root) return;

  var mount = root.querySelector("#deck-player");
  var titleNode = root.querySelector(".deck__title");
  var nowNode = root.querySelector(".deck__now");
  var endNode = root.querySelector(".deck__end");
  var countNode = root.querySelector(".deck__count");
  var modeNode = root.querySelector(".deck__mode");
  var adNode = root.querySelector(".deck__ad");
  var playBtn = root.querySelector(".deck__play");
  var prevBtn = root.querySelector(".deck__prev");
  var nextBtn = root.querySelector(".deck__next");
  var seek = root.querySelector(".deck__seek");
  var vol = root.querySelector(".deck__vol");
  var volVal = root.querySelector(".deck__vol-val");
  if (!mount || !titleNode || !playBtn || !prevBtn || !nextBtn || !seek || !vol) return;

  var DEFAULT_VOL = 3;
  var YT_PLAYING = 1;
  var YT_PAUSED = 2;
  var YT_ENDED = 0;
  var tracks = [];
  var order = [];
  var index = 0;
  var seeking = false;
  var userPaused = false;
  var held = false;
  var resumeAfterHold = false;
  var fails = 0;
  var player = null;
  var playerReady = false;
  var lastPushedVolume = null;
  var adPlaying = false;
  var expectedId = "";
  var tick = 0;
  var pendingPlay = false;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) return "0:00";
    sec = Math.floor(sec);
    return Math.floor(sec / 60) + ":" + pad(sec % 60);
  }

  function youtubeVolume(percent) {
    var t = Math.max(0, Math.min(100, Number(percent) || 0)) / 100;
    if (t <= 0) return 0;
    return Math.max(1, Math.min(100, Math.round(Math.pow(t, 1.6) * 100)));
  }

  function applyVolume(percent) {
    percent = Math.max(0, Math.min(100, Number(percent) || 0));
    vol.value = String(Math.round(percent));
    if (volVal) volVal.textContent = pad(Math.round(percent));
    pushVolume();
  }

  function pushVolume() {
    if (!playerReady || !player) return;
    var level = youtubeVolume(Number(vol.value));
    if (level === lastPushedVolume) return;
    try {
      if (level <= 0) {
        player.setVolume(0);
        player.mute();
        lastPushedVolume = level;
        return;
      }
      player.unMute();
      player.setVolume(level);
      lastPushedVolume = level;
    } catch (err) {}
  }

  function shuffleOrder(avoid) {
    var i;
    var j;
    var swap;
    order = [];
    for (i = 0; i < tracks.length; i++) order.push(i);
    for (i = order.length - 1; i > 0; i--) {
      j = Math.floor(Math.random() * (i + 1));
      swap = order[i];
      order[i] = order[j];
      order[j] = swap;
    }
    if (avoid >= 0 && order.length > 1 && order[0] === avoid) {
      j = 1 + Math.floor(Math.random() * (order.length - 1));
      swap = order[0];
      order[0] = order[j];
      order[j] = swap;
    }
  }

  function currentTrack() {
    return tracks[order[index]];
  }

  function currentTime() {
    if (!playerReady || !player || !player.getCurrentTime) return 0;
    try {
      return player.getCurrentTime() || 0;
    } catch (err) {
      return 0;
    }
  }

  function playerState() {
    if (!playerReady || !player || !player.getPlayerState) return -1;
    try {
      return player.getPlayerState();
    } catch (err) {
      return -1;
    }
  }

  function isPlaying() {
    return playerState() === YT_PLAYING;
  }

  function youtubeUrl(track) {
    var t = Math.max(0, Math.floor(currentTime()));
    if (track && track.youtube) {
      return "https://music.youtube.com/watch?v=" + track.youtube + "&t=" + t + "s";
    }
    return "https://music.youtube.com/@itarin";
  }

  function setAd(on) {
    on = !!on;
    if (adPlaying === on) {
      if (on) paintMeta();
      return;
    }
    adPlaying = on;
    root.classList.toggle("is-ad", on);
    if (adNode) adNode.hidden = !on;
    seek.disabled = on || !mediaLength();
    paintMeta();
    paintTime();
  }

  function videoIdFromPlayer() {
    if (!playerReady || !player || !player.getVideoData) return "";
    try {
      var data = player.getVideoData() || {};
      return data.video_id || "";
    } catch (err) {
      return "";
    }
  }

  var loadGen = 0;

  function inspectAd() {
    var id = videoIdFromPlayer();
    if (expectedId && id && id === expectedId) {
      setAd(false);
      return;
    }
  }

  function checkIdMismatch(gen) {
    window.setTimeout(function () {
      if (gen !== loadGen) return;
      var id = videoIdFromPlayer();
      if (expectedId && id && id !== expectedId && isPlaying()) setAd(true);
    }, 1800);
  }

  function paintMeta() {
    var track = currentTrack();
    if (modeNode) modeNode.textContent = adPlaying ? "ad" : "now";
    titleNode.textContent = track ? track.title : "—";
    titleNode.href = youtubeUrl(track);
    titleNode.setAttribute(
      "aria-label",
      track ? track.title + " on YouTube Music" : "YouTube Music"
    );
    if (countNode) {
      countNode.textContent = tracks.length
        ? pad(index + 1) + "/" + pad(tracks.length)
        : "00/00";
    }
  }

  function mediaLength() {
    if (adPlaying) return 0;
    if (playerReady && player && player.getDuration) {
      try {
        var d = player.getDuration();
        if (isFinite(d) && d > 0) return d;
      } catch (err) {}
    }
    var track = currentTrack();
    return track && track.duration > 0 ? track.duration : 0;
  }

  function paintTime() {
    pushVolume();
    var length = mediaLength();
    var now = currentTime();
    if (nowNode) nowNode.textContent = adPlaying ? "ad" : fmt(now);
    if (endNode) endNode.textContent = adPlaying ? "—" : (length ? fmt(length) : "—");
    seek.disabled = adPlaying || !length;
    if (!seeking && length && !adPlaying) {
      seek.value = String(Math.round((now / length) * 1000));
    }
    titleNode.href = youtubeUrl(currentTrack());
  }

  function paintPlay() {
    var on = isPlaying();
    playBtn.setAttribute("aria-pressed", on ? "true" : "false");
    playBtn.setAttribute("aria-label", on ? "Pause" : "Play");
    root.classList.toggle("is-on", on);
  }

  function setTicking(on) {
    if (on && !tick) tick = window.setInterval(paintTime, 250);
    if (!on && tick) {
      window.clearInterval(tick);
      tick = 0;
    }
  }

  function load(i, autoplay) {
    index = i;
    var track = currentTrack();
    if (!track || !track.youtube) return;
    expectedId = track.youtube;
    setAd(false);
    paintMeta();
    paintTime();
    loadGen += 1;
    if (!playerReady || !player) {
      pendingPlay = !!autoplay;
      return;
    }
    try {
      if (autoplay && !held) player.loadVideoById(track.youtube);
      else player.cueVideoById(track.youtube);
    } catch (err) {
      return;
    }
    applyVolume(Number(vol.value));
    if (autoplay && !held) pendingPlay = true;
    checkIdMismatch(loadGen);
  }

  function start() {
    if (held || !tracks.length) return;
    userPaused = false;
    pendingPlay = true;
    applyVolume(Number(vol.value));
    if (!playerReady || !player) return;
    try {
      player.playVideo();
    } catch (err) {}
    paintPlay();
  }

  function pause(fromUser) {
    if (fromUser) userPaused = true;
    pendingPlay = false;
    if (playerReady && player) {
      try { player.pauseVideo(); } catch (err) {}
    }
    paintPlay();
  }

  function next(autoplay) {
    if (!order.length) return;
    var last = order[index];
    if (index + 1 >= order.length) {
      shuffleOrder(last);
      load(0, autoplay);
      return;
    }
    load(index + 1, autoplay);
  }

  function prev(autoplay) {
    if (!order.length) return;
    if (currentTime() > 3) {
      if (playerReady && player) {
        try { player.seekTo(0, true); } catch (err) {}
      }
      paintTime();
      if (autoplay) start();
      return;
    }
    load(index > 0 ? index - 1 : order.length - 1, autoplay);
  }

  function hold() {
    if (held) return;
    held = true;
    resumeAfterHold = isPlaying() && !userPaused;
    if (playerReady && player) {
      try { player.pauseVideo(); } catch (err) {}
    }
    paintPlay();
  }

  function release() {
    if (!held) return;
    held = false;
    if (resumeAfterHold && !userPaused && !document.body.classList.contains("is-playing")) {
      start();
    }
    resumeAfterHold = false;
  }

  function afterAssemble(fn) {
    if (!document.documentElement.classList.contains("is-assembling")) {
      fn();
      return;
    }
    var watch = new MutationObserver(function () {
      if (!document.documentElement.classList.contains("is-assembling")) {
        watch.disconnect();
        fn();
      }
    });
    watch.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  }

  function onPlayerState(event) {
    var state = event && typeof event.data === "number" ? event.data : playerState();
    paintPlay();
    inspectAd();
    if (state === YT_PLAYING) {
      fails = 0;
      pendingPlay = false;
      setTicking(true);
      applyVolume(Number(vol.value));
      if (held) {
        try { player.pauseVideo(); } catch (err) {}
      }
    } else if (state === YT_PAUSED) {
      setTicking(false);
      paintTime();
    } else if (state === YT_ENDED) {
      setTicking(false);
      if (document.hidden || held) {
        paintTime();
        return;
      }
      if (adPlaying) {
        setAd(false);
        return;
      }
      fails = 0;
      next(true);
    } else if (state === 3) {
      inspectAd();
    }
  }

  function onPlayerError() {
    fails += 1;
    setAd(false);
    if (fails >= tracks.length) {
      titleNode.textContent = "signal lost";
      return;
    }
    next(!userPaused);
  }

  function ensureMount() {
    var stage = root.querySelector(".deck__stage");
    var node = document.getElementById("deck-player");
    if (node && node.tagName === "IFRAME") {
      node.remove();
      node = null;
    }
    if (!node) {
      node = document.createElement("div");
      node.id = "deck-player";
      if (stage) stage.insertBefore(node, adNode || null);
    }
    mount = node;
    return mount;
  }

  function rebuildPlayer() {
    if (player) {
      try { player.destroy(); } catch (err) {}
    }
    player = null;
    playerReady = false;
    lastPushedVolume = null;
    ensureMount();
    if (window.YT && window.YT.Player) createPlayer();
  }

  function createPlayer() {
    if (player || !window.YT || !window.YT.Player) return;
    var first = currentTrack();
    ensureMount();
    player = new window.YT.Player(mount, {
      width: 200,
      height: 200,
      videoId: first && first.youtube ? first.youtube : undefined,
      host: "https://www.youtube.com",
      playerVars: {
        autoplay: 0,
        controls: 1,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        playsinline: 1,
        rel: 0,
        origin: location.origin
      },
      events: {
        onReady: function () {
          playerReady = true;
          expectedId = first && first.youtube ? first.youtube : expectedId;
          applyVolume(Number(vol.value));
          paintMeta();
          paintTime();
          if (pendingPlay && !held && !userPaused) start();
        },
        onStateChange: onPlayerState,
        onError: onPlayerError
      }
    });
    try {
      player.addEventListener("onAdStart", function () { setAd(true); });
      player.addEventListener("onAdEnd", function () { setAd(false); });
    } catch (err) {}
  }

  function whenYouTubeReady(fn) {
    if (window.YT && window.YT.Player) {
      fn();
      return;
    }
    var prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function () {
      if (typeof prev === "function") prev();
      fn();
    };
    if (!document.querySelector('script[src*="iframe_api"]')) {
      var script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  }

  playBtn.addEventListener("click", function () {
    if (isPlaying()) pause(true);
    else start();
  });

  prevBtn.addEventListener("click", function () {
    prev(true);
  });

  nextBtn.addEventListener("click", function () {
    next(true);
  });

  titleNode.addEventListener("click", function (event) {
    var track = currentTrack();
    if (!track) return;
    event.preventDefault();
    window.open(youtubeUrl(track), "_blank", "noopener");
  });

  seek.addEventListener("pointerdown", function () { seeking = true; });
  seek.addEventListener("pointerup", function () { seeking = false; });
  seek.addEventListener("input", function () {
    var length = mediaLength();
    if (!length || adPlaying || !playerReady || !player) return;
    try {
      player.seekTo((Number(seek.value) / 1000) * length, true);
    } catch (err) {}
    paintTime();
  });

  vol.addEventListener("input", function () {
    applyVolume(Number(vol.value));
  });

  window.addEventListener("message", function (event) {
    if (!event.origin || event.origin.indexOf("youtube.com") === -1) return;
    var frame = player && player.getIframe ? player.getIframe() : null;
    if (frame && event.source && event.source !== frame.contentWindow) return;
    var payload = event.data;
    if (typeof payload === "string") {
      try { payload = JSON.parse(payload); } catch (err) { return; }
    }
    if (!payload || typeof payload !== "object") return;
    var name = payload.event || payload.id;
    var info = payload.info || {};
    if (name === "onAdStart" || name === "adStart") {
      setAd(true);
      return;
    }
    if (name === "onAdEnd" || name === "adEnd") {
      setAd(false);
      return;
    }
    if (info.adState === 1 || info.adPlaying === true || info.advertisement) {
      setAd(true);
      return;
    }
    if (info.adState === 0 || info.adPlaying === false) {
      inspectAd();
    }
    if (info.videoData && info.videoData.video_id) inspectAd();
  });

  new MutationObserver(function () {
    if (document.body.classList.contains("is-playing")) hold();
    else release();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });

  applyVolume(DEFAULT_VOL);

  fetch("data/playlist.json?v=4")
    .then(function (res) { return res.ok ? res.json() : []; })
    .then(function (list) {
      if (!Array.isArray(list) || !list.length) {
        titleNode.textContent = "no signal";
        return;
      }
      tracks = list.filter(function (item) {
        return item && item.title && item.youtube;
      });
      if (!tracks.length) {
        titleNode.textContent = "no signal";
        return;
      }
      shuffleOrder(-1);
      expectedId = currentTrack().youtube;
      paintMeta();
      whenYouTubeReady(createPlayer);
      afterAssemble(function () {
        if (!userPaused) start();
      });
    })
    .catch(function () {
      titleNode.textContent = "no signal";
    });
})();
