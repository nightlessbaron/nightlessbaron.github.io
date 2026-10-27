// pass@k easter egg: hovering (or tapping) the name samples n rollouts that fan out toward a
// reward region. Each new trigger doubles n (8 → 16 → 32 → 64 → 8), so coverage visibly grows
// with sampling compute, IsoCompute's finding as a toy. Draws for ~4.4 s, then leaves no trace.
const GROW = 1.3, HOLD = 3.2, END = 4.4;

export function initPassK(nameEl, host) {
  const canvas = document.createElement('canvas');
  canvas.className = 'passk';
  canvas.setAttribute('aria-hidden', 'true');
  const hud = document.createElement('div');
  hud.className = 'passk-hud';
  hud.setAttribute('aria-live', 'off');
  hud.setAttribute('aria-hidden', 'true');
  host.append(canvas, hud);
  const g = canvas.getContext('2d');
  let n = 4, trajs = [], t0 = 0, raf = 0, w = 0, h = 0, zone = null;

  function fit() {
    const r = host.getBoundingClientRect(), d = Math.min(2, devicePixelRatio || 1);
    w = r.width; h = r.height;
    canvas.width = Math.round(w * d); canvas.height = Math.round(h * d);
    g.setTransform(d, 0, 0, d, 0, 0);
  }

  function sample() {
    const hr = host.getBoundingClientRect(), nr = nameEl.getBoundingClientRect();
    // Fan out to the right of the name when there's room (desktop); on narrow screens start
    // under the name's left edge so the rollouts get a comparable distance to travel.
    const roomy = w - 12 - (nr.right - hr.left + 8) >= 150;
    const ox = roomy ? nr.right - hr.left + 8 : nr.left - hr.left;
    const oy = roomy ? nr.top - hr.top + nr.height / 2 : nr.bottom - hr.top + 8;
    // A narrow target off the start line: few of 8 rollouts reach it, many of 64 do.
    zone = { x: w - 40, y0: oy + 56, y1: oy + 86 };
    hud.style.top = `${zone.y1 + 8}px`; // readout sits just under the reward zone, near the action
    trajs = Array.from({ length: n }, () => {
      const pts = [[ox, oy]];
      let x = ox, y = oy, vy = (Math.random() - .5) * 2.2;
      while (x < w - 12) {
        x += 6; vy = (vy + (Math.random() - .5) * 1.6) * .96; y += vy;
        if (y < 8 || y > h - 8) { vy = -vy; y = Math.min(h - 8, Math.max(8, y)); } // bounce, don't stick
        pts.push([x, y]);
      }
      return pts;
    });
  }

  const hits = p => { const [x, y] = p[p.length - 1]; return x >= zone.x && y > zone.y0 && y < zone.y1; };

  function draw(now) {
    const t = (now - t0) / 1000;
    g.clearRect(0, 0, w, h);
    if (t >= END) { hud.textContent = ''; return; }
    const grow = Math.min(1, t / GROW), fade = t > HOLD ? 1 - (t - HOLD) / (END - HOLD) : 1;
    const css = getComputedStyle(host), teal = css.getPropertyValue('--teal').trim();
    g.globalAlpha = fade;
    g.fillStyle = 'rgba(47,143,71,.10)';
    g.fillRect(zone.x, zone.y0, 28, zone.y1 - zone.y0);
    g.fillStyle = 'rgba(47,143,71,.8)';
    g.font = `600 10px ${css.getPropertyValue('--mono')}`;
    g.fillText('reward', zone.x - 6, zone.y0 - 5);
    let k = 0;
    for (const p of trajs) {
      const end = Math.max(1, Math.floor((p.length - 1) * grow)), ok = grow === 1 && hits(p);
      if (ok) k++;
      g.strokeStyle = ok ? 'rgba(47,143,71,.9)' : teal; // theme-aware, so misses stay visible in dark mode
      g.globalAlpha = fade * (ok ? 1 : n > 16 ? .35 : .55);
      g.lineWidth = ok ? 1.6 : 1;
      g.beginPath();
      p.slice(0, end + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.globalAlpha = fade;
    }
    g.globalAlpha = 1;
    hud.textContent = grow < 1 ? `n = ${n} rollouts · sampling…`
      : `n = ${n} rollouts · pass@${n} ${k ? '✓' : '✗'} · ${k}/${n} reached reward`;
    hud.classList.toggle('miss', grow === 1 && !k);
    raf = requestAnimationFrame(draw);
  }

  function trigger() {
    n = n >= 64 ? 8 : n * 2;
    cancelAnimationFrame(raf);
    fit(); sample();
    t0 = performance.now();
    raf = requestAnimationFrame(draw);
  }

  nameEl.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') trigger(); });
  nameEl.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') trigger(); });
  return { trigger, n: () => n };
}

const nameEl = document.getElementById('name'), host = nameEl?.closest('header.hdr');
if (nameEl && host && !matchMedia('(prefers-reduced-motion: reduce)').matches) initPassK(nameEl, host);
