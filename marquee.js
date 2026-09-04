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

    if (!dragging && rackWidth) {
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

  window.addEventListener("resize", fill);
  reduce.addEventListener("change", function () { location.reload(); });

  // Small control surface, handy for debugging the loop in the console.
  marquee.marquee = {
    get offset() { return offset; },
    set offset(v) { offset = wrap(v); render(); },
    get rackWidth() { return rackWidth; },
    pause: function () { hovering = true; },
    resume: function () { hovering = false; }
  };

  marquee.classList.add("is-live");
  fill();
  // Cover widths can shift once the font and images settle.
  window.addEventListener("load", fill);
  requestAnimationFrame(tick);
})();
