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
    return node && node.closest ? node.closest(".card a") : null;
  }

  function artworkFor(card) {
    var image = card && card.querySelector("img");
    if (!image) return "";

    var source = image.currentSrc || image.src;
    return source.replace("-400.webp", "-800.webp");
  }

  function show(card) {
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
})();
