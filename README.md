# itarin.online

Source for [itarin.online](https://itarin.online) — a single page served by
GitHub Pages from `main`. No build step, no framework, no JavaScript beyond the
analytics snippet and a one-line copyright year.

## Structure

```
index.html            the page
style.css             the stylesheet
site.webmanifest      homescreen / PWA icons
CNAME                 custom domain
.well-known/discord   Discord domain verification
fonts/                Excelorate — .woff2 is what loads, .otf is the master
favicon/              generated icon set
images/               see below
```

## Images

Two kinds of file live in `images/`:

| file | role |
|---|---|
| `<Title>.png`, `websitebackground.*` | full-resolution masters. Never loaded by the page. |
| `<slug>-400.webp`, `<slug>-800.webp` | what the page actually serves (`srcset`) |
| `<slug>-400.jpg` | fallback / source for social cards |
| `bg.webp`, `bg-static.webp` | page background (animated + reduced-motion still) |
| `logospin.gif`, `logo-static.webp` | the wordmark (animated + reduced-motion still) |
| `og.jpg` | 1200×630 social share card |

The masters are ~22 MB in total and are kept only as archives. The page itself
loads about 850 KB.

### Adding a release

1. Put the master art in `images/`.
2. Generate `<slug>-400.webp`, `<slug>-800.webp` and `<slug>-400.jpg` from it.
3. Add one `<li class="card">` to the single `<ul class="rack">` in `index.html`.

That is the whole edit — there is only one rack in the markup.

## How the marquee works

`marquee.js` is a progressive enhancement. The HTML ships one rack of covers
inside `.marquee`, which CSS styles as an ordinary horizontal scroller. If the
script runs, it wraps that rack in a `.marquee__track`, clones it enough times
to cover the viewport plus one full rack, and drives the position from
`requestAnimationFrame`.

Position is kept modulo one rack's width, so the wrap is exact — frames at
`offset` and `offset + rackWidth` are pixel-identical at every viewport width.
(The earlier CSS-animation version hardcoded two racks and left a visible gap
at the loop point on any screen wider than one rack.)

Spacing between covers is `margin-right` on `.card`, *not* a flex `gap`, so one
rack's width is exactly `(card width + margin) x card count`.

Behaviour:

- pauses on hover, resumes when the pointer leaves
- click and drag to move it; release with speed to throw it, and it coasts to a
  stop before auto-scroll resumes
- a drag never opens the release underneath it; a click does
- keyboard focus pauses it (`:focus-visible` only, so clicking a cover doesn't
  stop it permanently)
- under `prefers-reduced-motion: reduce` the script bails out entirely and the
  rack stays a plain, manually scrollable row
- with JavaScript off, likewise

`document.querySelector('.marquee').marquee` exposes `offset`, `rackWidth`,
`pause()` and `resume()` if you need to poke at it in the console.
