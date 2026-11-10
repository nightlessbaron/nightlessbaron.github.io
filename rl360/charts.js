// The post's measured charts, plus the small page behaviour around them: the contents rail, the video
// buttons and the code blocks. Every chart draws from data.js and takes its colours from the CSS tokens, so
// it follows the theme. Charts are complete on first paint; the only motion is the hero's one settling sweep.
import { FIELD, UNFILTERED, KEPT, ROLLOUT_MIN, PUSH_S, PUSH_AFTER_S } from './data.js';

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const n1 = x => Math.round(x * 10) / 10;
const fmt = n => n.toLocaleString('en-US');

// ---------- one tooltip for every SVG chart ----------
const tip = Object.assign(document.createElement('div'), { className: 'tip', hidden: true });
document.body.append(tip);
function showTip(x, y, lines) {
  tip.replaceChildren(...lines.map(l => Object.assign(document.createElement('b'), { textContent: l })));
  tip.hidden = false;
  const r = tip.getBoundingClientRect();
  tip.style.left = `${Math.max(8, Math.min(innerWidth - r.width - 8, x + 14))}px`;
  tip.style.top = `${Math.max(8, y - r.height - 12)}px`;
}
const hideTip = () => { tip.hidden = true; };

// Sizes an SVG to its column, redraws it on resize, and adds the "Data" table that holds every value.
function svgChart(fig, label, height, draw, onPointer) {
  const stage = fig.querySelector('.stage');
  stage.innerHTML = `<svg role="img" aria-label="${label}"></svg>`;
  const svg = stage.firstElementChild;
  let geom = null;
  new ResizeObserver(() => {
    const w = Math.floor(stage.clientWidth);
    if (!w) return;
    const h = height(w);
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('height', h);
    const out = draw(w, h);
    svg.innerHTML = out.html;
    geom = out;
  }).observe(stage);
  if (onPointer) {
    svg.addEventListener('pointermove', e => {
      if (!geom) return;
      const b = svg.getBoundingClientRect();
      onPointer(e.clientX - b.left, geom, e);
    });
    svg.addEventListener('pointerleave', hideTip);
  }
}
function dataTable(fig, heads, rows) {
  const d = document.createElement('details');
  d.className = 'data';
  d.innerHTML = '<summary>Data</summary><div class="scroll"><table><thead><tr></tr></thead><tbody></tbody></table></div>';
  const hr = d.querySelector('thead tr'), tb = d.querySelector('tbody');
  heads.forEach(h => hr.append(Object.assign(document.createElement('th'), { textContent: h })));
  d.addEventListener('toggle', () => {
    if (tb.children.length) return;
    for (const r of rows) {
      const tr = document.createElement('tr');
      r.forEach(c => tr.append(Object.assign(document.createElement('td'), { textContent: c })));
      tb.append(tr);
    }
  }, { once: true });
  fig.append(d);
}

// ---------- The hero: where every attempt went ----------
function field(fig) {
  const canvas = fig.querySelector('canvas'), hi = fig.querySelector('.hero-hi'), read = fig.querySelector('.readout');
  const g = canvas.getContext('2d');
  const total = FIELD.reduce((a, r) => r.map((v, i) => v + a[i]), [0, 0, 0, 0, 0]);
  const summary = `<b>${fmt(total[0])} of ${fmt(99 * 256)} attempts reached the gradient.</b> ${fmt(total[2])} sat in groups where every valid attempt passed, ${fmt(total[3])} where every one failed, and ${fmt(total[4])} in groups with too few valid attempts. ${fmt(total[1])} were masked.`;
  read.innerHTML = summary;
  let W = 0, H = 0, colors = [];
  const readColors = () => {
    const cs = getComputedStyle(document.documentElement);
    colors = ['--orange', '--fail', '--tint-pass', '--tint-fail', '--tint-few'].map(k => cs.getPropertyValue(k).trim());
  };
  // t runs 0 to 1. At 0 every attempt in the column is alive; each column then settles to its real counts.
  function draw(t) {
    g.clearRect(0, 0, W, H);
    const gapX = W > 700 ? 2 : 1, cw = (W - 98 * gapX) / 99;
    const gapY = H > 300 ? 1 : .5, rh = (H - 31 * gapY) / 256;
    FIELD.forEach((row, i) => {
      const x = i * (cw + gapX);
      const p = t >= 1 ? 1 : Math.min(1, Math.max(0, (t * 1.5 - i / 99 * .5)));
      const u = p < .5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      const counts = u >= 1 ? row : [row[0] + (256 - row[0]) * (1 - u), row[1] * u, row[2] * u, row[3] * u, row[4] * u];
      // bottom-up order: trained, masked, then the dropped groups
      const order = [0, 1, 3, 4, 2];
      let k = 0, filled = 0;
      for (let at = 0; at < 256; at += 8) {
        const y0 = H - (at + 8) * rh - Math.floor(at / 8) * gapY;
        for (let a = 0; a < 8;) {
          while (k < 4 && filled + counts[order[k]] <= at + a + 1e-6) { filled += counts[order[k]]; k++; }
          const end = Math.min(8, Math.ceil(filled + counts[order[k]] - at - 1e-6));
          const stop = end > a ? end : 8;
          g.fillStyle = colors[order[k]];
          g.fillRect(x, y0 + (8 - stop) * rh, cw, (stop - a) * rh);
          a = stop;
        }
      }
    });
  }
  function resize() {
    const d = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth; H = Math.round(Math.max(190, Math.min(340, W * .36)));
    canvas.style.height = `${H}px`;
    canvas.width = Math.round(W * d); canvas.height = Math.round(H * d);
    g.setTransform(d, 0, 0, d, 0, 0);
    readColors();
    draw(1);
  }
  new ResizeObserver(resize).observe(canvas);
  resize();
  const redraw = () => { readColors(); draw(1); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  let cur = -1;
  function pick(i) {
    cur = i;
    if (i < 0) { hi.hidden = true; read.innerHTML = summary; return; }
    const r = FIELD[i], w = W / 99;
    hi.hidden = false;
    hi.style.left = `${n1(i * w - 2)}px`;
    hi.style.width = `${n1(w + 2)}px`;
    const parts = [`${r[0]} reached the gradient`];
    if (r[1]) parts.push(`${r[1]} masked`);
    if (r[2]) parts.push(`${r[2]} in all-pass groups`);
    if (r[3]) parts.push(`${r[3]} in all-fail groups`);
    if (r[4]) parts.push(`${r[4]} in groups with too few valid attempts`);
    read.innerHTML = `<b>Step ${i}.</b> ${parts.join(', ')}.`;
  }
  const at = e => Math.max(0, Math.min(98, Math.floor((e.clientX - canvas.getBoundingClientRect().left) / (W / 99))));
  canvas.addEventListener('pointermove', e => pick(at(e)));
  canvas.addEventListener('pointerdown', e => pick(at(e)));
  canvas.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') pick(-1); });
  canvas.addEventListener('blur', () => pick(-1));
  canvas.addEventListener('keydown', e => {
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (d) { e.preventDefault(); pick(Math.max(0, Math.min(98, (cur < 0 ? (d > 0 ? -1 : 99) : cur) + d))); }
    if (e.key === 'Escape') pick(-1);
  });
  dataTable(fig, ['step', 'trained', 'masked', 'all pass', 'all fail', 'too few valid'], FIELD.map((r, i) => [i, ...r]));

  // One settling sweep, once: every attempt starts alive and each step falls to what actually trained.
  if (!reduce) {
    const start = performance.now(), dur = 1500;
    const frame = now => {
      const t = Math.min(1, (now - start) / dur);
      if (W) draw(t);
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// ---------- Rollout phases against the client's deadline ----------
function deadline(fig) {
  const lo = 20, hi = 65;
  svgChart(fig, 'A dot for each of 99 rollout phases, in minutes. Most lie between 22 and 58 minutes; 18 of them sit on the 60 minute client deadline.', w => (w < 520 ? 230 : 300), (w, h) => {
    const narrow = w < 520, L = 42, R = 8, T = 26, B = 24, x = i => L + (i / 98) * (w - L - R), y = m => T + (hi - m) / (hi - lo) * (h - T - B);
    let s = '';
    [20, 30, 40, 50].forEach(m => { s += `<line x1="${L}" x2="${w - R}" y1="${n1(y(m))}" y2="${n1(y(m))}" class="rule"/><text x="${L - 8}" y="${n1(y(m) + 4)}" class="tick" text-anchor="end">${m}</text>`; });
    s += `<line x1="${L}" x2="${w - R}" y1="${n1(y(60))}" y2="${n1(y(60))}" class="ink" stroke-width="1"/><text x="${L - 8}" y="${n1(y(60) + 4)}" class="tick" text-anchor="end">60</text>`;
    s += `<text x="${L}" y="${n1(y(60) - 10)}" class="strong">${narrow ? '3,600 s client deadline: 18 of 99' : 'Client deadline, 3,600 s: 18 of 99 phases end here'}</text>`;
    s += `<text x="${L}" y="${h - 4}" class="tick">step 0</text><text x="${w - R}" y="${h - 4}" class="tick" text-anchor="end">step 98</text><text x="${(L + w - R) / 2}" y="${h - 4}" class="tick" text-anchor="middle">minutes per rollout phase</text>`;
    const r = narrow ? 2.6 : 4;
    ROLLOUT_MIN.forEach((m, i) => { s += `<circle cx="${n1(x(i))}" cy="${n1(y(m))}" r="${r}" class="${m >= 60 ? 'dot-a' : 'dot-b'}"/>`; });
    return { html: s, x, L, R, w };
  }, (px, g, e) => {
    const i = Math.max(0, Math.min(98, Math.round((px - g.L) / (g.w - g.L - g.R) * 98)));
    showTip(e.clientX, e.clientY, [`Step ${i}`, `${ROLLOUT_MIN[i]} min${ROLLOUT_MIN[i] >= 60 ? ', at the deadline' : ''}`]);
  });
  dataTable(fig, ['step', 'rollout phase, min'], ROLLOUT_MIN.map((m, i) => [i, m]));
}

// ---------- Reward before and after the filter ----------
function reward(fig) {
  svgChart(fig, 'Two lines over 99 steps. The unfiltered mean reward climbs from 0.37 to 0.90, with a one-step dip to 0.49 at step 70. The kept mean levels off around 0.75 from about step 40.', w => (w < 520 ? 250 : 330), (w, h) => {
    const narrow = w < 520, L = 34, R = narrow ? 10 : 12, T = 26, B = 24, x = i => L + (i / 98) * (w - L - R), y = v => T + (1 - v) * (h - T - B);
    let s = `<text x="${L}" y="12" class="tick">mean reward</text>`;
    [0, .25, .5, .75, 1].forEach(v => { s += `<line x1="${L}" x2="${w - R}" y1="${n1(y(v))}" y2="${n1(y(v))}" class="rule"/><text x="${L - 7}" y="${n1(y(v) + 4)}" class="tick" text-anchor="end">${v}</text>`; });
    const path = a => a.map((v, i) => `${i ? 'L' : 'M'}${n1(x(i))} ${n1(y(v))}`).join('');
    s += `<path d="${path(KEPT)}" class="line-b"/><path d="${path(UNFILTERED)}" class="line-a"/>`;
    // the two moments the text talks about
    s += `<circle cx="${n1(x(70))}" cy="${n1(y(UNFILTERED[70]))}" r="4" class="dot-a"/>`;
    s += `<text x="${n1(x(70) - 8)}" y="${n1(y(UNFILTERED[70]) + 4)}" class="strong" text-anchor="end">Step 70: 0.49</text>`;
    s += `<line x1="${n1(x(40))}" x2="${n1(x(40))}" y1="${n1(y(KEPT[40]) + 4)}" y2="${n1(y(.56) + 6)}" class="axis"/>`;
    s += `<text x="${n1(x(40))}" y="${n1(y(.56) + 20)}" class="strong" text-anchor="middle">${narrow ? 'kept mean levels off' : 'kept mean levels off from about step 40'}</text>`;
    s += `<text x="${L}" y="${h - 4}" class="tick">step 0</text><text x="${w - R}" y="${h - 4}" class="tick" text-anchor="end">step 98</text>`;
    s += `<line class="cross" id="reward-cross" x1="0" x2="0" y1="${T}" y2="${h - B}" visibility="hidden"/>`;
    return { html: s, L, R, w, x };
  }, (px, g, e) => {
    const i = Math.max(0, Math.min(98, Math.round((px - g.L) / (g.w - g.L - g.R) * 98)));
    showTip(e.clientX, e.clientY, [`Step ${i}`, `${UNFILTERED[i].toFixed(2)} unfiltered`, `${KEPT[i].toFixed(2)} kept`]);
    const c = fig.querySelector('#reward-cross');
    c.setAttribute('x1', n1(g.x(i))); c.setAttribute('x2', n1(g.x(i))); c.setAttribute('visibility', 'visible');
  });
  fig.querySelector('svg').addEventListener('pointerleave', () => fig.querySelector('#reward-cross')?.setAttribute('visibility', 'hidden'));
  dataTable(fig, ['step', 'unfiltered', 'kept'], UNFILTERED.map((v, i) => [i, v.toFixed(3), KEPT[i].toFixed(3)]));
}

// ---------- Sandbox readiness percentiles ----------
function ready(fig) {
  const P = [['median', 23, '23 s'], ['p90', 96, '96 s'], ['p99', 229, '3.8 min'], ['worst', 1262, '21 min']];
  const TICKS = [[10, '10 s'], [60, '1 min'], [600, '10 min'], [1800, '30 min']];
  svgChart(fig, 'A log-scale axis from 10 seconds to 30 minutes with four marks: median 23 seconds, 90th percentile 96 seconds, 99th percentile 3.8 minutes, and worst case 21 minutes.', () => 104, (w, h) => {
    const L = 6, R = 10, x = v => L + (Math.log10(v) - 1) / (Math.log10(1800) - 1) * (w - L - R), ay = h - 28;
    let s = `<line x1="${L}" x2="${w - R}" y1="${ay}" y2="${ay}" class="axis"/>`;
    TICKS.forEach(([v, t], i) => { s += `<line x1="${n1(x(v))}" x2="${n1(x(v))}" y1="${ay}" y2="${ay + 5}" class="axis"/><text x="${n1(x(v))}" y="${h - 6}" class="tick" text-anchor="${i === TICKS.length - 1 ? 'end' : i ? 'middle' : 'start'}">${t}</text>`; });
    P.forEach(([name, v, t], i) => {
      const anchor = i === P.length - 1 ? 'end' : 'middle';
      s += `<circle cx="${n1(x(v))}" cy="${ay}" r="5" class="dot-b"/>`;
      s += `<text x="${n1(x(v))}" y="${ay - 28}" class="strong" text-anchor="${anchor}">${t}</text><text x="${n1(x(v))}" y="${ay - 12}" text-anchor="${anchor}">${name}</text>`;
    });
    return { html: s };
  });
}

// ---------- Every weight push ----------
function push(fig) {
  const all = [...PUSH_S.map((v, i) => ({ v, run: 0, i })), ...PUSH_AFTER_S.map((v, i) => ({ v, run: 1, i }))];
  svgChart(fig, 'Columns for 17 weight pushes. The first 13 take 42 to 133 seconds. The last four take 533 to 649 seconds. The job then exits. Five pushes from a later run, after the fix, take 117, 45, 39, 36 and 36 seconds.', w => (w < 520 ? 270 : 340), (w, h) => {
    const narrow = w < 520, L = 42, R = 4, T = 22, B = 34, top = 700, y = v => T + (1 - v / top) * (h - T - B), base = y(0);
    const slots = 17 + 3 + 5, sw = (w - L - R) / slots, bw = Math.min(24, sw - 2);
    const xOf = d => L + (d.run ? 17 + 3 + d.i : d.i) * sw + (sw - bw) / 2;
    let s = '';
    [0, 200, 400, 600].forEach(v => { s += `<line x1="${L}" x2="${w - R}" y1="${n1(y(v))}" y2="${n1(y(v))}" class="rule"/><text x="${L - 8}" y="${n1(y(v) + 4)}" class="tick" text-anchor="end">${v}${v ? '' : ' s'}</text>`; });
    all.forEach(d => {
      const x = xOf(d), yy = y(d.v), r = Math.min(4, bw / 2), slow = !d.run && d.i >= 13;
      s += `<path d="M${n1(x)} ${n1(base)}V${n1(yy + r)}Q${n1(x)} ${n1(yy)} ${n1(x + r)} ${n1(yy)}H${n1(x + bw - r)}Q${n1(x + bw)} ${n1(yy)} ${n1(x + bw)} ${n1(yy + r)}V${n1(base)}Z" class="${slow ? 'col-b' : 'col-a'}"/>`;
    });
    const x13 = xOf(all[12]), x14 = xOf(all[13]);
    s += `<text x="${n1(x14 - 8)}" y="${n1(y(590) + 4)}" class="strong" text-anchor="end">${narrow ? 'plan retired' : 'Second replacement: direct path retired'}</text>`;
    s += `<text x="${n1(x13 + bw - 2)}" y="${n1(y(133) - 8)}" text-anchor="end">${narrow ? 'plan rebuilt' : 'First replacement: plan rebuilt, 133 s'}</text>`;
    const xEnd = xOf(all[16]) + bw + 6;
    s += `<text x="${n1(xEnd)}" y="${n1(y(620))}" class="strong">job</text><text x="${n1(xEnd)}" y="${n1(y(620) + 16)}" class="strong">exits</text>`;
    const xA = xOf(all[17]);
    s += `<text x="${n1(xA)}" y="${n1(y(117) - 8)}" class="strong">${narrow ? '' : 'Later run, with the fix'}</text>`;
    s += `<text x="${L}" y="${h - 8}" class="tick">375B run, first to last push</text><text x="${w - R}" y="${h - 8}" class="tick" text-anchor="end">later run</text>`;
    return { html: s, xOf, bw, sw, L };
  }, (px, g, e) => {
    const slot = Math.floor((px - g.L) / g.sw);
    const d = slot < 17 ? all[slot] : slot >= 20 ? all[17 + slot - 20] : null;
    if (!d) { hideTip(); return; }
    const name = d.run ? `Later run, push ${d.i + 1}` : `Push ${d.i + 1}`;
    showTip(e.clientX, e.clientY, [name, `${d.v} s${!d.run && d.i >= 13 ? ', broadcast' : ', direct path'}`]);
  });
  dataTable(fig, ['run', 'push', 'seconds', 'path'], all.map(d => [d.run ? 'later' : '375B', d.i + 1, d.v, !d.run && d.i >= 13 ? 'broadcast' : 'direct']));
}

const CHARTS = { field, deadline, reward, ready, push };
for (const fig of document.querySelectorAll('[data-chart]')) CHARTS[fig.dataset.chart]?.(fig);

// ---------- Code blocks: a file bar and light highlighting ----------
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const TOKENS = /("""[\s\S]*?"""|"[^"\n]*"|#[^\n]*|--[a-z][a-z-]*|\b(?:def|if|return|await|not|for|in|is|else|None|True|False)\b)/g;
for (const pre of document.querySelectorAll('.post pre')) {
  const code = pre.querySelector('code');
  code.innerHTML = code.textContent.split(TOKENS).map((part, i) => {
    if (i % 2 === 0) return esc(part);
    const cls = part[0] === '#' ? 'c' : part[0] === '"' ? 's' : 'k';
    return `<span class="${cls}">${esc(part)}</span>`;
  }).join('');
  const box = document.createElement('div');
  box.className = 'codebox';
  pre.replaceWith(box);
  const bar = document.createElement('span');
  bar.className = 'bar';
  const name = pre.dataset.file || '';
  if (pre.dataset.href) {
    const a = Object.assign(document.createElement('a'), { href: pre.dataset.href, textContent: name });
    bar.append(a);
  } else bar.textContent = name;
  box.append(bar, pre);
}

// ---------- Tabs: several clips in one figure. Without script every clip simply shows, one after another. ----------
for (const fig of document.querySelectorAll('.fig.tabbed')) {
  const panels = [...fig.querySelectorAll('.panel')];
  const caps = [...fig.querySelectorAll('figcaption [data-for]')];
  const bar = document.createElement('div');
  bar.className = 'tabs';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', fig.dataset.label);
  const tabs = panels.map(p => {
    const b = Object.assign(document.createElement('button'), { type: 'button', id: `${p.id}-tab`, textContent: p.dataset.tab });
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-controls', p.id);
    p.setAttribute('role', 'tabpanel');
    p.setAttribute('aria-labelledby', b.id);
    bar.append(b);
    return b;
  });
  const show = i => {
    panels.forEach((p, j) => { p.hidden = j !== i; });
    tabs.forEach((b, j) => { b.setAttribute('aria-selected', j === i); b.tabIndex = j === i ? 0 : -1; });
    caps.forEach(c => { c.hidden = c.dataset.for !== panels[i].id; });
  };
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => show(i));
    b.addEventListener('keydown', e => {
      const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (!d) return;
      e.preventDefault();
      const n = (i + d + tabs.length) % tabs.length;
      show(n);
      tabs[n].focus();
    });
  });
  fig.prepend(bar);
  show(0);
}

// ---------- Videos: play once when they scroll in, with a small button in place of the native controls ----------
for (const v of document.querySelectorAll('.fig .stage.video video')) {
  const btn = Object.assign(document.createElement('button'), { type: 'button', className: 'vid-btn' });
  const set = () => { btn.textContent = v.paused ? (v.ended ? '↻ Replay' : '▶ Play') : '❚❚ Pause'; };
  const toggle = () => {
    if (v.ended) v.currentTime = 0;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };
  btn.addEventListener('click', toggle);
  v.addEventListener('click', toggle);
  ['play', 'pause', 'ended'].forEach(ev => v.addEventListener(ev, set));
  set();
  v.parentElement.append(btn);
  if (reduce) continue;
  let played = false;
  new IntersectionObserver(es => {
    for (const e of es) {
      if (e.isIntersecting && !played) { played = true; v.play().catch(() => {}); }
      else if (!e.isIntersecting && !v.paused) v.pause();
    }
  }, { threshold: .5 }).observe(v);
}

// ---------- Contents: open as a rail on wide screens, and mark the section being read ----------
const rail = document.querySelector('.rail details');
if (rail) {
  const wide = matchMedia('(min-width: 1240px)');
  const sync = () => { rail.open = wide.matches; };
  sync();
  wide.addEventListener('change', sync);
  const links = new Map([...rail.querySelectorAll('a[href^="#"]')].map(a => [a.getAttribute('href').slice(1), a]));
  const marks = [...links.keys()].map(id => document.getElementById(id)).filter(Boolean);
  let active = null;
  const update = () => {
    const line = innerHeight * .28;
    let cur = null;
    for (const m of marks) { if (m.getBoundingClientRect().top <= line) cur = m; else break; }
    const a = cur && links.get(cur.id);
    if (a === active) return;
    active?.removeAttribute('aria-current');
    a?.setAttribute('aria-current', 'true');
    active = a;
  };
  let queued = false;
  addEventListener('scroll', () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }, { passive: true });
  update();
}
