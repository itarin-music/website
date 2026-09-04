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
3. Add an `<li class="card">` to **both** racks in `index.html`.

The second rack is a duplicate of the first — that is what makes the marquee
loop seamlessly. It is marked `aria-hidden="true"` and its links carry
`tabindex="-1"` so screen readers and keyboard users only meet each release
once. **If the two racks ever differ, the loop will visibly jump.**

## How the marquee works

Both racks sit side by side in `.marquee__track`, which animates to
`translateX(-50%)`. That lands rack two exactly where rack one started. The
spacing between covers is `margin-right` on `.card`, *not* a flex `gap` — a gap
would be added once between the two racks and throw the 50% off.

It pauses on hover and on keyboard focus. Under
`prefers-reduced-motion: reduce` the animation stops entirely, the duplicate
rack is hidden, and the row becomes a normal horizontal scroller.
