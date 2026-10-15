/* ==========================================================================
   itarin primary site

   Theme toggle, LCD clock, Japanese hover glosses, the release slideshow and
   its disc changer, the music carousel, art grid, news tabs, the header that
   pins after scrolling, the phone menu, and the footer strip.

   The wordmark (itarin-mark.js) and shuffle deck (deck.js) are the
   main site's own scripts.
   ========================================================================== */

(function () {
  "use strict";

  var RELEASES = [
    { title: "Go and Die", with: "itarin & Sovkie", date: "2025.01.30",
      url: "https://tunelink.to/goanddie", art: "go-and-die" },
    { title: "Built This Town", with: "itarin & Sovkie", date: "2024.09.20",
      url: "https://itarin.tunelink.to/bruhbruhbruh", art: "trailer-park-houses" },
    { title: "Never Concentrate (Extended)", with: "itarin", date: "2024.08.15",
      url: "https://tunelink.to/lUvRX", art: "never-concentrate" },
    { title: "Example Needed", with: "itarin & Sovkie", date: "2024.02.02",
      url: "https://itarin.tunelink.to/ExampleNeeded", art: "example-needed" },
    { title: "Don’t Talk to M3 / P3pto", with: "itarin & Sovkie, Metallin", date: "2023.04.13",
      url: "https://tunelink.to/F9STu", art: "dont-talk" }
  ];

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function pad(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function img(name, size) {
    return "images/" + name + "-" + size + ".webp";
  }

  function el(tag, className, attrs, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (attrs) {
      Object.keys(attrs).forEach(function (key) { node.setAttribute(key, attrs[key]); });
    }
    if (text) node.textContent = text;
    return node;
  }

  function outLink(url) {
    return el("a", "", { href: url, target: "_blank", rel: "noopener" });
  }

  function setFocusable(root, on) {
    root.querySelectorAll("a, button").forEach(function (node) {
      if (on) node.removeAttribute("tabindex");
      else node.setAttribute("tabindex", "-1");
    });
  }

  /* --- Theme (shares the main site's saved choice) -------------------------- */

  (function theme() {
    var KEY = "itarin-theme-choice";
    var media = window.matchMedia("(prefers-color-scheme: dark)");
    var meta = document.querySelector('meta[name="theme-color"]');
    var buttons = document.querySelectorAll(".mode");

    function stored() {
      try {
        var value = localStorage.getItem(KEY);
        return value === "light" || value === "dark" ? value : null;
      } catch (err) {
        return null;
      }
    }

    function paint(value, persist) {
      document.documentElement.dataset.theme = value;
      if (meta) meta.setAttribute("content", value === "dark" ? "#0c0e14" : "#e9f7fc");
      if (persist) {
        try { localStorage.setItem(KEY, value); } catch (err) {}
      }
      var next = value === "dark" ? "light" : "dark";
      buttons.forEach(function (button) {
        button.querySelector(".mode__val").textContent = next;
        button.setAttribute("aria-label", "Switch to " + next + " mode");
      });
      // itarin-mark.js repaints the wordmark on this event.
      document.dispatchEvent(new CustomEvent("themechange", { detail: value }));
    }

    buttons.forEach(function (button) {
      button.addEventListener("click", function () {
        paint(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true);
      });
    });

    media.addEventListener("change", function (event) {
      if (!stored()) paint(event.matches ? "dark" : "light", false);
    });

    paint(stored() || (media.matches ? "dark" : "light"), false);
  })();

  /* --- LCD clock -------------------------------------------------------------- */

  (function clock() {
    var node = document.querySelector(".lcd__time");
    if (!node) return;
    function tick() {
      var now = new Date();
      node.textContent = pad(now.getHours()) + ":" + pad(now.getMinutes());
    }
    tick();
    window.setInterval(tick, 15000);
  })();

  /* --- Japanese banner lines show English on hover ------------------------------ */

  document.querySelectorAll("[data-en]").forEach(function (node) {
    var ja = node.textContent;
    var en = node.getAttribute("data-en");
    node.addEventListener("pointerenter", function (event) {
      if (event.pointerType && event.pointerType !== "mouse") return;
      node.textContent = en;
      node.setAttribute("lang", "en");
      node.classList.add("is-en");
    });
    node.addEventListener("pointerleave", function () {
      node.textContent = ja;
      node.setAttribute("lang", "ja");
      node.classList.remove("is-en");
    });
  });

  /* --- Release slideshow + disc changer ------------------------------------------ */

  (function hero() {
    var root = document.querySelector(".hero");
    var track = document.getElementById("hero-track");
    var changer = document.getElementById("changer");
    if (!root || !track || !changer) return;

    var pause = changer.querySelector(".changer__pause");
    var paused = reduceMotion;
    pause.hidden = reduceMotion;
    var slides = [];
    var discs = [];

    RELEASES.forEach(function (release, i) {
      var slide = el("div", "slide", {
        role: "group",
        "aria-roledescription": "slide",
        "aria-label": pad(i + 1) + " of " + pad(RELEASES.length)
      });
      var link = outLink(release.url);
      var blur = el("img", "slide__blur", { src: img(release.art, 400), alt: "", draggable: "false" });
      var art = el("img", "slide__art", {
        src: img(release.art, 800),
        alt: release.title + " cover art",
        width: "800",
        height: "800",
        draggable: "false"
      });
      if (i > 0) {
        blur.loading = "lazy";
        art.loading = "lazy";
      }
      var file = el("span", "tag slide__file", null, i === 0 ? "latest release" : "file " + pad(i + 1));
      var caption = el("span", "slide__caption");
      caption.append(
        el("span", "slide__title", null, release.title),
        el("span", "slide__meta", null, release.with + " · " + release.date)
      );
      link.append(blur, art, file, caption);
      slide.appendChild(link);
      track.appendChild(slide);
      slides.push(slide);

      var disc = el("button", "", { type: "button", "aria-label": "Show " + release.title }, pad(i + 1));
      disc.addEventListener("click", function () { show(i); });
      changer.appendChild(disc);
      discs.push(disc);
    });

    var index = 0;

    function show(next) {
      index = (next + slides.length) % slides.length;
      slides.forEach(function (slide, i) {
        var on = i === index;
        slide.classList.toggle("is-active", on);
        slide.setAttribute("aria-hidden", on ? "false" : "true");
        setFocusable(slide, on);
      });
      discs.forEach(function (disc, i) {
        if (i === index) disc.setAttribute("aria-current", "true");
        else disc.removeAttribute("aria-current");
      });
    }

    // The timer bar under the current disc is a 6s CSS animation; when it
    // fills, the next release loads. Pausing the bar pauses the slideshow.
    changer.addEventListener("animationend", function (event) {
      if (event.animationName === "disc-timer" && !paused && !document.hidden) show(index + 1);
    });

    function hold() {
      var focused = root.contains(document.activeElement) || changer.contains(document.activeElement);
      changer.classList.toggle("is-paused", paused || document.hidden || focused || root.matches(":hover") || changer.matches(":hover"));
    }
    function paintPause() {
      pause.textContent = paused ? "resume" : "pause";
      pause.setAttribute("aria-pressed", String(paused));
      pause.setAttribute("aria-label", (paused ? "Resume" : "Pause") + " release slideshow");
      changer.classList.toggle("is-still", reduceMotion && paused);
      hold();
    }
    pause.addEventListener("click", function () { paused = !paused; paintPause(); });
    document.addEventListener("visibilitychange", hold);
    paintPause();

    [root, changer].forEach(function (area) {
      area.addEventListener("pointerenter", hold);
      area.addEventListener("pointerleave", function () { requestAnimationFrame(hold); });
      area.addEventListener("focusin", hold);
      area.addEventListener("focusout", function () { requestAnimationFrame(hold); });
    });



    root.querySelector(".hero__arrow--prev").addEventListener("click", function () { show(index - 1); });
    root.querySelector(".hero__arrow--next").addEventListener("click", function () { show(index + 1); });

    var startX = null;
    root.addEventListener("touchstart", function (event) {
      startX = event.touches[0].clientX;
    }, { passive: true });
    root.addEventListener("touchend", function (event) {
      if (startX === null) return;
      var dx = event.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) >= 40) show(index + (dx < 0 ? 1 : -1));
    });

    show(0);
  })();

  /* --- Music carousel ------------------------------------------------------------- */

  (function music() {
    var root = document.querySelector(".disc");
    var track = document.getElementById("disc-track");
    if (!root || !track) return;

    var items = RELEASES.map(function (release, i) {
      var item = el("li", "disc__item");
      var link = outLink(release.url);
      var num = el("span", "disc__num");
      num.append(el("b", "", null, pad(i + 1)), document.createTextNode(" / " + pad(RELEASES.length) + " · " + release.date));
      link.append(
        el("img", "", {
          src: img(release.art, 800),
          alt: release.title + " cover art",
          width: "800",
          height: "800",
          loading: "lazy",
          draggable: "false"
        }),
        num,
        el("span", "disc__title", null, release.title),
        el("span", "disc__with", null, release.with)
      );
      item.appendChild(link);
      track.appendChild(item);
      return item;
    });

    var index = 0;

    function show(next) {
      index = (next + items.length) % items.length;
      track.style.transform = "translateX(" + (-100 * index) + "%)";
      items.forEach(function (item, i) {
        var on = i === index;
        item.setAttribute("aria-hidden", on ? "false" : "true");
        setFocusable(item, on);
      });
    }

    root.querySelector(".disc__arrow--prev").addEventListener("click", function () { show(index - 1); });
    root.querySelector(".disc__arrow--next").addEventListener("click", function () { show(index + 1); });
    show(0);
  })();

  /* --- Art grid --------------------------------------------------------------------- */

  (function art() {
    var list = document.getElementById("gallery");
    if (!list) return;
    RELEASES.forEach(function (release) {
      var item = el("li");
      var link = el("a", "", {
        href: img(release.art, 800),
        download: release.art + "-cover.webp",
        "aria-label": "Download " + release.title + " cover art (WebP)"
      });
      link.append(
        el("img", "", {
          src: img(release.art, 400),
          srcset: img(release.art, 400) + " 400w, " + img(release.art, 800) + " 800w",
          sizes: "(max-width: 600px) 44vw, 220px",
          alt: release.title + " cover art",
          width: "400",
          height: "400",
          loading: "lazy",
          draggable: "false"
        }),
        el("span", "", null, release.title)
      );
      item.appendChild(link);
      list.appendChild(item);
    });
  })();

  /* --- News tabs --------------------------------------------------------------------- */

  (function tabs() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
    if (!buttons.length) return;

    function select(button, focus) {
      buttons.forEach(function (other) {
        var on = other === button;
        other.setAttribute("aria-selected", on ? "true" : "false");
        other.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(other.getAttribute("aria-controls"));
        if (panel) panel.hidden = !on;
      });
      if (focus) button.focus();
    }

    buttons.forEach(function (button, i) {
      button.addEventListener("click", function () { select(button, false); });
      button.addEventListener("keydown", function (event) {
        var next = null;
        if (event.key === "ArrowRight") next = buttons[(i + 1) % buttons.length];
        if (event.key === "ArrowLeft") next = buttons[(i - 1 + buttons.length) % buttons.length];
        if (event.key === "Home") next = buttons[0];
        if (event.key === "End") next = buttons[buttons.length - 1];
        if (!next) return;
        event.preventDefault();
        select(next, true);
      });
    });
  })();

  /* --- Header pins after scrolling past it; nav marks the section in view ------------- */

  (function header() {
    var head = document.querySelector(".masthead");
    if (!head) return;
    var pinned = false;

    function limit() {
      return parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--head-h")) || 288;
    }

    function update() {
      var past = window.scrollY > limit();
      if (past === pinned) return;
      pinned = past;
      if (past) {
        head.classList.add("is-fixed");
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { head.classList.add("is-shown"); });
        });
      } else {
        head.classList.remove("is-fixed", "is-shown");
      }
    }

    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();

    if (!("IntersectionObserver" in window)) return;
    var links = head.querySelectorAll(".nav a");
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = "#" + entry.target.id;
        links.forEach(function (link) {
          link.classList.toggle("is-current", link.getAttribute("href") === id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    links.forEach(function (link) {
      var target = document.querySelector(link.getAttribute("href"));
      if (target) watch.observe(target);
    });
  })();

  /* --- Phone menu ----------------------------------------------------------------------- */

  (function menu() {
    var drawer = document.getElementById("drawer");
    var open = document.querySelector(".menu-open");
    if (!drawer || !open) return;
    var close = drawer.querySelector(".drawer__close");

    var background = Array.from(document.body.children).filter(function (node) {
      return node !== drawer && node.tagName !== "SCRIPT";
    });
    var previousInert = [];
    function setOpen(on, refocus) {
      if (on === !drawer.hidden) return;
      if (on) {
        previousInert = background.map(function (node) { return node.inert; });
        background.forEach(function (node) { node.inert = true; });
      } else {
        background.forEach(function (node, i) { node.inert = previousInert[i]; });
      }
      drawer.hidden = !on;
      open.setAttribute("aria-expanded", on ? "true" : "false");
      document.body.style.overflow = on ? "hidden" : "";
      if (on) close.focus();
      else if (refocus) open.focus({ preventScroll: true });
    }

    window.matchMedia("(min-width: 1001px)").addEventListener("change", function (event) {
      if (event.matches && !drawer.hidden) { setOpen(false, false); document.querySelector(".nav a").focus(); }
    });
    open.addEventListener("click", function () { setOpen(true); });
    close.addEventListener("click", function () { setOpen(false, true); });
    drawer.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        setOpen(false, false);
        var target = document.querySelector(link.getAttribute("href"));
        if (target) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
      });
    });
    document.addEventListener("keydown", function (event) {
      if (drawer.hidden) return;
      if (event.key === "Escape") setOpen(false, true);
      if (event.key === "Tab") {
        var controls = Array.from(drawer.querySelectorAll("a, button"));
        var first = controls[0], last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
  })();

  /* --- Footer strip of covers ------------------------------------------------------------ */

  document.querySelectorAll(".strip__row").forEach(function (row, r) {
    var reel = el("div", "strip__reel");
    // Offset the second row so the same cover never stacks vertically.
    var order = RELEASES.map(function (_, i) { return RELEASES[(i + r * 2) % RELEASES.length]; });
    // Each half has to be wider than the widest screen for a seamless loop.
    var perHalf = Math.ceil(2800 / 145 / order.length) * order.length;
    for (var i = 0; i < perHalf * 2; i++) {
      reel.appendChild(el("img", "", {
        src: img(order[i % order.length].art, 400),
        alt: "",
        width: "400",
        height: "400",
        loading: "lazy",
        draggable: "false"
      }));
    }
    row.appendChild(reel);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        reel.style.animationPlayState = entries[0].isIntersecting && !document.hidden ? "running" : "paused";
      }).observe(row);
    }
  });

  // A fixed header is no longer at the document origin for fragment scrolling.
  document.querySelectorAll('a[href="#top"]').forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      window.scrollTo({ top: 0, behavior: reduceMotion ? "instant" : "smooth" });
      var top = document.querySelector(".mark a");
      if (top) top.focus({ preventScroll: true });
    });
  });

  var year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());

  // Starts the wordmark intro in itarin-mark.js (the main site fires this
  // from its page-assemble animation).
  document.dispatchEvent(new Event("assemble"));
})();
