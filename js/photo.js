// The photo arrives the way a diffusion model draws a picture: pure noise first, then coarse shapes,
// then detail. Each frame is x_t = √ᾱ·x̂₀ + √(1−ᾱ)·ε with a cosine schedule, where x̂₀ (the model's
// current guess at the clean image) sharpens from a few blurry blobs to the full photo as t falls.
// It runs once on load, and again when the pointer rests on the photo or it is tapped. The <img>
// underneath is the real photo (and what shows without JS); the canvas only covers it while running.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const LEVELS = [6, 12, 24, 48]; // x̂₀ from coarse to sharp, in pixels across, before the full photo

export function initPhoto(wrap = document.querySelector('.photo')) {
  if (!wrap) return;
  const img = wrap.querySelector('img');
  // If the script came late and the photo is already showing (site.css lifts the noise after a
  // moment), don't turn it back into noise; it can still run on hover.
  const late = getComputedStyle(wrap, '::after').opacity === '0';
  wrap.classList.add('ready');
  if (reduce) return;

  const canvas = document.createElement('canvas'), label = document.createElement('span');
  canvas.setAttribute('aria-hidden', 'true');
  label.className = 'tstep'; label.setAttribute('aria-hidden', 'true');
  wrap.append(canvas, label);
  const S = canvas.width = canvas.height = Math.round(wrap.clientWidth) || 200; // CSS pixels: it's only up for a second
  const g = canvas.getContext('2d', { willReadFrequently: true }), out = g.createImageData(S, S);

  // ε: one standard normal per pixel and channel (Box–Muller)
  const eps = new Float32Array(S * S * 3);
  for (let i = 0; i < eps.length; i += 2) {
    const r = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)), a = 2 * Math.PI * Math.random();
    eps[i] = r * Math.cos(a); if (i + 1 < eps.length) eps[i + 1] = r * Math.sin(a);
  }

  // x̂₀ at each level, in [-1, 1]: the photo cropped like the <img> (cover, 22% from the top),
  // shrunk to a few pixels and smoothed back up.
  let x0 = null;
  const build = () => {
    const full = document.createElement('canvas'); full.width = full.height = S;
    const fg = full.getContext('2d'), k = Math.max(S / img.naturalWidth, S / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    fg.drawImage(img, (S - dw) * .5, (S - dh) * .22, dw, dh);
    const tiny = document.createElement('canvas'), tg = tiny.getContext('2d');
    const blur = document.createElement('canvas'); blur.width = blur.height = S;
    const bg = blur.getContext('2d', { willReadFrequently: true }); bg.imageSmoothingQuality = 'high';
    x0 = [...LEVELS, S].map(n => {
      let src = fg;
      if (n < S) {
        tiny.width = tiny.height = n; tg.drawImage(full, 0, 0, n, n);
        bg.clearRect(0, 0, S, S); bg.drawImage(tiny, 0, 0, S, S); src = bg;
      }
      const d = src.getImageData(0, 0, S, S).data, f = new Float32Array(S * S * 3);
      for (let p = 0, q = 0; p < d.length; p += 4) { f[q++] = d[p] / 127.5 - 1; f[q++] = d[p + 1] / 127.5 - 1; f[q++] = d[p + 2] / 127.5 - 1; }
      return f;
    });
  };

  const paint = t => {
    const ab = Math.cos(t * Math.PI / 2) ** 2, a = Math.sqrt(ab), s = Math.sqrt(1 - ab), o = out.data;
    // which x̂₀: the coarsest at t = 1, the full photo from t ≈ .2 down
    const pos = Math.min(1, (1 - t) * 1.25) * (LEVELS.length), i = Math.min(LEVELS.length - 1, Math.floor(pos)), w = pos - i;
    const A = x0?.[i], B = x0?.[i + 1];
    for (let p = 0, q = 0; p < o.length; p += 4) for (let c = 0; c < 3; c++, q++) {
      const v = (A ? a * (A[q] + (B[q] - A[q]) * w) : 0) + s * eps[q];
      o[p + c] = 127.5 * (v + 1);
      o[p + 3] = 255;
    }
    g.putImageData(out, 0, 0);
    label.textContent = `t = ${Math.round(t * 1000)}`;
  };

  // up: t from 0 to 1 (the forward process: the photo dissolves); down: back to 0 (the sampler).
  let running = false;
  const run = (up, down) => {
    running = true; wrap.classList.add('noising');
    const t0 = performance.now();
    const tick = now => {
      const k = now - t0;
      if (k < up) paint(k / up);
      else if (k < up + down) paint(1 - (k - up) / down);
      else { paint(0); wrap.classList.remove('noising'); running = false; return; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const ready = (img.complete && img.naturalWidth ? Promise.resolve() : img.decode()).then(build);
  if (!late) { paint(1); wrap.classList.add('noising'); ready.then(() => run(0, 1600), () => wrap.classList.remove('noising')); }

  let hoverT;
  const again = () => { if (!running && x0) run(450, 1300); };
  wrap.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hoverT = setTimeout(again, 150); });
  wrap.addEventListener('pointerleave', () => clearTimeout(hoverT));
  wrap.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') again(); });
}

initPhoto();
