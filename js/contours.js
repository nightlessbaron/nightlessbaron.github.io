// Faint topographic contour lines behind the page. Drawn once (and again on resize or a
// light/dark switch), never animated. The ink colour comes from the --contour CSS token.
const LEVELS = 22, CELL = 7;

// The map is drawn as tall as the screen, not the window: on phones the window grows when the
// address bar slides away, and a map sized to the window would have to be redrawn (and would move).
const size = () => [innerWidth, Math.max(innerHeight, screen.height || 0), Math.min(2, devicePixelRatio || 1)];

export function drawContours(canvas) {
  const [W, H, d] = size();
  canvas.width = W * d; canvas.height = H * d;
  canvas.style.height = `${H}px`;
  const g = canvas.getContext('2d');
  g.setTransform(d, 0, 0, d, 0, 0);
  g.clearRect(0, 0, W, H);

  // A smooth height field: seeded gaussian hills and valleys plus two long gentle waves.
  // Seeded so the map is the same on every visit.
  let seed = 11;
  const rnd = () => (seed = seed * 16807 % 2147483647) / 2147483647;
  const hills = Array.from({ length: 9 }, () => ({ x: rnd() * W, y: rnd() * H, r: 140 + rnd() * 260, a: (rnd() < .35 ? -1 : 1) * (.6 + rnd()) }));
  const f = (x, y) => hills.reduce((s, h) => s + h.a * Math.exp(-((x - h.x) ** 2 + (y - h.y) ** 2) / (2 * h.r * h.r)), 0)
    + .25 * Math.sin(x / 260 + y / 410) + .18 * Math.sin(y / 190 - x / 520);

  const nx = Math.ceil(W / CELL) + 1, ny = Math.ceil(H / CELL) + 1, v = new Float32Array(nx * ny);
  let lo = Infinity, hi = -Infinity;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const z = f(i * CELL, j * CELL); v[j * nx + i] = z; lo = Math.min(lo, z); hi = Math.max(hi, z);
  }

  const css = getComputedStyle(document.documentElement);
  const rgb = css.getPropertyValue('--contour').trim(), alpha = parseFloat(css.getPropertyValue('--contour-alpha')) || .065;
  for (let k = 1; k < LEVELS; k++) {
    const lv = lo + (hi - lo) * k / LEVELS, major = k % 5 === 0; // every fifth line a little darker, like a real topo map
    g.strokeStyle = `rgba(${rgb},${major ? alpha * 1.8 : alpha})`;
    g.lineWidth = major ? 1.1 : .8;
    g.beginPath();
    // Marching squares: for each cell, join the points where the level crosses its edges.
    for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
      const a = v[j * nx + i], b = v[j * nx + i + 1], c = v[(j + 1) * nx + i + 1], e = v[(j + 1) * nx + i];
      const idx = (a > lv ? 8 : 0) | (b > lv ? 4 : 0) | (c > lv ? 2 : 0) | (e > lv ? 1 : 0);
      if (idx === 0 || idx === 15) continue;
      const x = i * CELL, y = j * CELL, t = (p, q) => (lv - p) / (q - p);
      const T = [x + CELL * t(a, b), y], R = [x + CELL, y + CELL * t(b, c)], B = [x + CELL * t(e, c), y + CELL], L = [x, y + CELL * t(a, e)];
      const seg = { 1: [L, B], 2: [B, R], 3: [L, R], 4: [T, R], 5: [L, T, B, R], 6: [T, B], 7: [L, T],
        8: [L, T], 9: [T, B], 10: [L, B, T, R], 11: [T, R], 12: [L, R], 13: [B, R], 14: [L, B] }[idx];
      for (let s = 0; s < seg.length; s += 2) { g.moveTo(...seg[s]); g.lineTo(...seg[s + 1]); }
    }
    g.stroke();
  }
}

export function initContours() {
  const canvas = document.createElement('canvas');
  canvas.className = 'topo';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.prepend(canvas);
  let drawn;
  const redraw = () => { drawContours(canvas); drawn = size(); };
  redraw();
  let t;
  // Redraw only when the map no longer fits: a new width, a window taller than what was drawn,
  // or a new pixel density. A shorter or slightly taller window just shows more or less of it.
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => { const [W, H, d] = size(); if (W !== drawn[0] || H > drawn[1] || d !== drawn[2]) redraw(); }, 150);
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  return canvas;
}

initContours();
