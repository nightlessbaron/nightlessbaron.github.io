# nightlessbaron.github.io

Personal website of Varad Pimpalkhute: plain HTML, CSS and a little vanilla JS, served by GitHub Pages with no build step (`.nojekyll`).
The layout is adapted from [Jon Barron's website](https://github.com/jonbarron/jonbarron.github.io).

- `index.html`: the home page (all content is static HTML)
- `css/`, `js/`: styles and the small interactive pieces (hover-to-play media, tagline decode, contour background, the robot that walks along the bottom)
- `media/`: paper thumbnails (WebP) and videos, and `card.jpg`, the 1200×630 link-preview image; `files/`: papers, CV, notes
- `fonts/`: Lato, served from the site itself (SIL Open Font License, `fonts/OFL.txt`)
- `travel/`: an unlisted photo page

Tests: `npm install && npm test` (headless Chromium via `playwright-core`; set `CHROMIUM_PATH` if Chromium isn't at the default Playwright cache path).
