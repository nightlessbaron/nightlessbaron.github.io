// The photo arrives the way a diffusion model draws a picture, as pixel art: coloured noise first,
// then a few big blocks, then finer and finer ones until it is the photo. Every frame is
// x_t = √ᾱ·x̂₀ + √(1−ᾱ)·ε on a grid of cells, with x̂₀ the photo averaged over each cell; each finer
// grid draws fresh noise, like the sampler's next step. The cells are first coloured through a ramp
// (ember red on load, another scheme on every rerun), so the face comes out of the noise as a
// two-tone pixel portrait; once the noise is gone, the photo's own colours come in and the grid
// keeps refining. It runs once on load, and again when the pointer rests on the photo
// or it is tapped. The <img> underneath is the real photo (and what shows without JS); the canvas,
// one pixel per cell and scaled up crisp by site.css, only covers it while running.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const GRIDS = [6, 8, 11, 16, 22, 32, 45, 64, 96]; // cells across, coarse to fine
const STARTS = [0, .05, .1, .17, .26, .38, .55, .72, .88]; // the progress (1 − t) at which each grid takes over
const B = 192; // the photo is averaged down from this many pixels across
// Colour ramps, dark to light.
const SCHEMES = {
  ember: ['#1d0610', '#5e0d1f', '#b01e2c', '#ec5a2e', '#ffc98f'],
  ocean: ['#06142b', '#0f3b75', '#1772d0', '#5fb3f0', '#dcf2ff'],
  orchid: ['#16061f', '#4a1263', '#9a2a99', '#ef5b98', '#ffd6e4'],
  gold: ['#1c1002', '#5c3306', '#b6650d', '#f0a83c', '#fff0c4'],
  mint: ['#04191a', '#0b4d4a', '#14897c', '#4fd1a5', '#dcfbe9'],
};
const RAMPS = Object.fromEntries(Object.entries(SCHEMES).map(([k, v]) => [k, v.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)))]));
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
const gauss = () => Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());

export function initPhoto(wrap = document.querySelector('.photo')) {
  if (!wrap) return;
  const img = wrap.querySelector('img');
  // If the script came late and the photo is already showing (site.css lifts the noise after a
  // moment), don't turn it back into noise; it can still run on hover.
  const late = getComputedStyle(wrap, '::after').opacity === '0';
  wrap.classList.add('ready');
  if (reduce) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.append(canvas);
  const g = canvas.getContext('2d');

  // x̂₀ for every grid: the photo cropped like the <img> (cover, 22% from the top) and averaged over
  // each cell. RGB in [-1, 1], and a contrast-stretched luminance that picks the ramp colour.
  let x0 = null;
  const build = () => {
    const c = document.createElement('canvas'); c.width = c.height = B;
    const cg = c.getContext('2d', { willReadFrequently: true }), k = Math.max(B / img.naturalWidth, B / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    cg.imageSmoothingQuality = 'high';
    cg.drawImage(img, (B - dw) * .5, (B - dh) * .22, dw, dh);
    const d = cg.getImageData(0, 0, B, B).data;
    x0 = GRIDS.map(n => {
      const rgb = new Float32Array(n * n * 3), lum = new Float32Array(n * n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const ya = Math.floor(j * B / n), yb = Math.floor((j + 1) * B / n), xa = Math.floor(i * B / n), xb = Math.floor((i + 1) * B / n);
        const sum = [0, 0, 0];
        for (let y = ya; y < yb; y++) for (let x = xa; x < xb; x++) for (let ch = 0; ch < 3; ch++) sum[ch] += d[(y * B + x) * 4 + ch];
        const q = j * n + i, m = (yb - ya) * (xb - xa) * 127.5;
        for (let ch = 0; ch < 3; ch++) rgb[q * 3 + ch] = sum[ch] / m - 1;
        lum[q] = .2126 * rgb[q * 3] + .7152 * rgb[q * 3 + 1] + .0722 * rgb[q * 3 + 2];
      }
      return { rgb, lum };
    });
    // stretch the luminance so the whole ramp gets used: 3rd–97th percentile → [-1, 1]
    const all = [...x0.at(-1).lum].sort((a, b) => a - b), lo = all[all.length * .03 | 0], hi = all[all.length * .97 | 0];
    for (const X of x0) X.lum = X.lum.map(v => Math.max(-1, Math.min(1, (v - lo) / (hi - lo || 1) * 2 - 1)));
  };

  let grid = -1, eps, out, ramp;
  const scheme = name => { wrap.dataset.scheme = name; ramp = RAMPS[name]; };
  const paint = t => {
    const p = 1 - t;
    let gi = 0; while (gi + 1 < GRIDS.length && p >= STARTS[gi + 1]) gi++;
    const n = GRIDS[gi];
    if (gi !== grid) {
      grid = gi; canvas.width = canvas.height = n; out = g.createImageData(n, n);
      eps = Float32Array.from({ length: n * n }, gauss);
    }
    const ab = Math.sin(Math.PI / 2 * Math.min(1, p / .6)) ** 2, a = Math.sqrt(ab), s = Math.sqrt(1 - ab); // noise gone at p = .6
    const own = smooth(.55, .85, p); // how much of the photo's own colour shows
    const X = x0?.[gi], o = out.data, top = ramp.length - 1;
    for (let q = 0; q < n * n; q++) {
      const e = s * eps[q];
      const u = Math.max(0, Math.min(1, ((X ? a * X.lum[q] : 0) + .55 * e + 1) / 2)) * top;
      const k = Math.min(top - 1, u | 0), f = u - k, c0 = ramp[k], c1 = ramp[k + 1];
      for (let ch = 0; ch < 3; ch++) {
        const pal = c0[ch] + (c1[ch] - c0[ch]) * f, real = X ? 127.5 * (X.rgb[q * 3 + ch] + 1) : pal;
        o[q * 4 + ch] = pal + (real - pal) * own;
      }
      o[q * 4 + 3] = 255;
    }
    g.putImageData(out, 0, 0);
  };

  // up: t from 0 to 1 (the forward process: the photo dissolves); hold at pure noise; down: back to 0
  // (the sampler).
  let running = false;
  const run = (up, hold, down) => {
    running = true; wrap.classList.add('noising');
    const t0 = performance.now();
    const tick = now => {
      const k = now - t0;
      if (k < up) paint(k / up);
      else if (k < up + hold) paint(1);
      else if (k < up + hold + down) paint(1 - (k - up - hold) / down);
      else { paint(0); wrap.classList.remove('noising'); running = false; return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  scheme('ember');
  const ready = (img.complete && img.naturalWidth ? Promise.resolve() : img.decode()).then(build);
  if (!late) { paint(1); wrap.classList.add('noising'); ready.then(() => run(0, 350, 4000), () => wrap.classList.remove('noising')); }

  let hoverT;
  const again = () => {
    if (running || !x0) return;
    const others = Object.keys(RAMPS).filter(k => k !== wrap.dataset.scheme);
    scheme(others[Math.random() * others.length | 0]);
    run(900, 250, 4000);
  };
  wrap.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hoverT = setTimeout(again, 150); });
  wrap.addEventListener('pointerleave', () => clearTimeout(hoverT));
  wrap.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') again(); });
}

initPhoto();
