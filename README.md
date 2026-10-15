# itarin.online
Source for [itarin.online](https://itarin.online)

The primary site is served from `index.html`, with `style.css` and `site.js`.
The former `/redesign/` preview redirects to the homepage. Wordmark and shuffle-player
behavior lives in `itarin-mark.js` and `deck.js`. The background uses static scan
lines; the globe animation is no longer loaded.

Decorative canvases cap their frame rate and stop when hidden. YouTube loads only
after a playback control is used. The `overlay/` tools are retained for stream
exports; generated frames and installed dependencies are excluded from the site.
