// Figures for the RL360 write-up. Each figure redraws its SVG from a clock t (seconds): it plays once
// when it first scrolls into view, its step buttons replay one step, and with reduced motion it rests
// on the last frame of whatever was asked for. The SVG's units are the figure's own CSS pixels, so
// labels keep their size on a phone and the layout adapts instead of shrinking.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (t, a, b) => clamp((t - a) / (b - a));
const ease = x => (x < .5 ? 2 * x * x : 1 - (-2 * x + 2) ** 2 / 2);
const lerp = (a, b, u) => a + (b - a) * u;
const n1 = x => Math.round(x * 10) / 10;
const op = a => (a < .999 ? ` opacity="${Math.max(0, a).toFixed(2)}"` : '');
const sub = n => String(n).replace(/\d/g, d => '₀₁₂₃₄₅₆₇₈₉'[d]);
const textW = s => s.length * 6.5; // Lato at 12.5px, close enough to decide whether a label fits

const rect = (x, y, w, h, cls, more = '') => `<rect x="${n1(x)}" y="${n1(y)}" width="${n1(Math.max(0, w))}" height="${n1(h)}" class="${cls}"${more}/>`;
const text = (x, y, s, cls = '', more = '') => `<text x="${n1(x)}" y="${n1(y)}" class="${cls}"${more}>${s}</text>`;
const circle = (x, y, r, cls, more = '') => `<circle cx="${n1(x)}" cy="${n1(y)}" r="${n1(r)}" class="${cls}"${more}/>`;
const line = (x1, y1, x2, y2, cls, more = '') => `<line x1="${n1(x1)}" y1="${n1(y1)}" x2="${n1(x2)}" y2="${n1(y2)}" class="${cls}"${more}/>`;
const cross = (x, y, r, more = '') => `<path d="M${n1(x - r)} ${n1(y - r)}L${n1(x + r)} ${n1(y + r)}M${n1(x + r)} ${n1(y - r)}L${n1(x - r)} ${n1(y + r)}" class="crash"${more}/>`;
const hatch = (id, cls) => `<defs><pattern id="${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" class="${cls}" stroke-width="1.6"/></pattern></defs>`;

function player(fig, def) {
  const stage = fig.querySelector('.stage');
  stage.innerHTML = `<svg role="img" aria-label="${def.label}"></svg>`;
  const svg = stage.firstElementChild;
  const say = Object.assign(document.createElement('p'), { className: 'say' });
  const ctl = Object.assign(document.createElement('div'), { className: 'ctl' });
  const button = (label, cls = '') => Object.assign(document.createElement('button'), { type: 'button', textContent: label, className: cls });
  const replay = button(reduce ? 'Show all' : 'Replay', 'go');
  const chips = def.steps.map((s, i) => button(`${i + 1} · ${s.name}`));
  ctl.append(replay, ...chips);
  stage.after(say, ctl);
  fig.querySelectorAll('[hidden]').forEach(e => { e.hidden = false; });

  const ends = def.steps.map((s, i) => (i + 1 < def.steps.length ? def.steps[i + 1].at : def.end));
  const stepAt = t => { let k = 0; while (k + 1 < def.steps.length && t >= def.steps[k + 1].at) k++; return k; };
  let t = 0, stopAt = 0, raf = 0, prev = 0, width = 0, started = false;
  const fig$ = { t: 0, note: null, draw: () => draw() };

  function draw() {
    if (!width) return;
    const k = stepAt(Math.min(t, def.end - 1e-6));
    fig$.t = t;
    const h = def.height(width);
    svg.setAttribute('viewBox', `0 0 ${width} ${h}`);
    svg.setAttribute('height', h);
    svg.innerHTML = def.draw(t, width, h, fig$);
    say.textContent = fig$.note ?? (started ? def.steps[k].say : def.steps[0].say);
    chips.forEach((c, i) => c.setAttribute('aria-pressed', String(started && i === k && fig$.note == null)));
  }
  function frame(now) {
    t = Math.min(stopAt, t + (now - prev) / 1000);
    prev = now;
    draw();
    raf = t < stopAt ? requestAnimationFrame(frame) : 0;
  }
  function run(from, to) {
    cancelAnimationFrame(raf);
    started = true;
    fig$.note = null;
    def.reset?.(fig$);
    if (reduce) { t = to; draw(); return; }
    t = from; stopAt = to; prev = performance.now();
    draw();
    raf = requestAnimationFrame(frame);
  }
  replay.addEventListener('click', () => run(0, def.end));
  chips.forEach((c, i) => c.addEventListener('click', () => run(def.steps[i].at, ends[i])));

  new ResizeObserver(() => {
    const cs = getComputedStyle(stage);
    width = Math.floor(stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
    draw();
  }).observe(stage);
  // Play once, the first time most of the figure is on screen. With reduced motion, show the end.
  if (reduce) { started = true; t = def.end; }
  else new IntersectionObserver((es, io) => {
    if (es.some(e => e.isIntersecting)) { io.disconnect(); run(0, def.end); }
  }, { threshold: .45 }).observe(stage);
  def.init?.(fig, fig$, () => { cancelAnimationFrame(raf); started = true; t = def.end; draw(); });
}

// ---------- One trajectory becomes one training sample ----------
const TRAJ = [
  { k: 'prompt', n: 12, at: .2, dt: .04 },
  { k: 'gen', n: 7, at: 1.4, dt: .14 },
  { k: 'tool', n: 10, at: 2.8, dt: .04 },
  { k: 'gen', n: 6, at: 3.8, dt: .12 },
  { k: 'tool', n: 6, at: 4.7, dt: .04 },
  { k: 'gen', n: 9, at: 5.1, dt: .12, cut: true }, // stops at max_tokens: finish_reason "length"
  { k: 'tool', n: 7, at: 6.7, dt: .04, late: true },
  { k: 'gen', n: 5, at: 7.0, dt: .12, late: true },
];
const TOKENS = TRAJ.flatMap((s, si) => Array.from({ length: s.n }, (_, i) => ({ ...s, si, i, show: s.at + i * s.dt, last: i === s.n - 1 })));
const SAMPLED = TOKENS.filter(x => x.k === 'gen' && !x.late).length;

const traj = {
  label: 'A multi-turn trajectory drawn as a row of token squares: the prompt, three sampled assistant turns with tool output between them, a third turn cut off at the length limit, and two later turns that the merge drops. The loss falls only on the sampled tokens.',
  end: 10.6,
  steps: [
    { at: 0, name: 'Prompt', say: 'The task prompt is tokenized once, and the session server keeps the token IDs.' },
    { at: 1.2, name: 'Sample', say: 'SGLang samples the first assistant turn. The session stores its token IDs, log-probs and the weight version that produced them.' },
    { at: 2.6, name: 'Tool output', say: 'The agent runs a command. Its output is tokenized and appended, so the next request is the stored IDs plus these, never a re-tokenized transcript.' },
    { at: 3.6, name: 'More turns', say: 'Turn 3 hits max_tokens (finish_reason: length). The agent keeps going, but the turns after it were conditioned on a reply that was cut off.' },
    { at: 7.9, name: 'Merge', say: 'The merge keeps every turn through the first incomplete one and drops the rest.' },
    { at: 9.2, name: 'Train', say: `Loss mask 1 on the ${SAMPLED} sampled tokens and 0 on the prompt and tool output: the policy is trained only on what it wrote.` },
  ],
  geom(w) {
    const c = w < 520 ? 13 : 16, gap = 4, per = Math.max(8, Math.floor((w + gap) / (c + gap)));
    return { c, gap, per, rows: Math.ceil(TOKENS.length / per) };
  },
  height(w) { const g = this.geom(w); return g.rows * (g.c + 8) - 8 + 4; },
  draw(t, w) {
    const { c, gap, per } = this.geom(w), out = [hatch('h-traj', 'hl-fail')];
    const drop = ease(seg(t, 8.1, 8.8)), train = ease(seg(t, 9.4, 10.1));
    TOKENS.forEach((x, j) => {
      const a = ease(seg(t, x.show, x.show + .25));
      if (a <= 0) return;
      const px = (j % per) * (c + gap), py = Math.floor(j / per) * (c + 8) + 2;
      const late = x.late ? 1 - .7 * drop : 1;
      if (x.k === 'prompt') out.push(rect(px, py, c, c, 'prompt', ` rx="3"${op(a)}`));
      else if (x.k === 'tool') out.push(rect(px + .75, py + .75, c - 1.5, c - 1.5, 'tool', ` rx="3"${op(a * late)}`));
      else out.push(rect(px, py, c, c, 'gen', ` rx="3"${op(a * late)}`));
      if (x.late && drop > 0) out.push(rect(px, py, c, c, 'hatch-fail', ` rx="3" fill="url(#h-traj)"${op(drop)}`));
      if (x.k === 'gen' && !x.late && train > 0)
        out.push(rect(px - 1.5, py - 1.5, c + 3, c + 3, 'ink', ` rx="4" style="stroke:var(--orange);stroke-width:2"${op(train)}`));
      if (x.cut && x.last) {
        const ca = ease(seg(t, x.show + .3, x.show + .6));
        if (ca > 0) out.push(line(px + c + gap / 2, py - 3, px + c + gap / 2, py + c + 3, 'crash', op(ca)));
      }
    });
    return out.join('');
  },
};

// ---------- Generating while training ----------
const SCHEM = { G: 10, T: 3.2, P: .9 }, REAL = { G: 2424, T: 81, P: 3.8 }; // public run medians, seconds
const asyncFig = {
  label: 'Two timelines, rollout and training. Each batch generates on the rollout engines while the trainer updates on the batch before it; the trainer then waits, and the engines pause only for a short weight push. Redrawn to scale, rollouts take about 40 minutes, training 81 seconds and the push 3.8 seconds.',
  end: 9.8,
  steps: [
    { at: 0, name: 'Overlap', say: 'Batch 6 generates with weights θ₅ while the trainer updates on batch 5. Both start together.' },
    { at: 1.6, name: 'Wait', say: 'Training finishes long before the rollouts do, so the trainer waits.' },
    { at: 3.2, name: 'Push', say: 'Batch 6 is done. Only now do the new weights θ₆ go to the engines: the one pause on the rollout side.' },
    { at: 4.2, name: 'One behind', say: 'Next cycle, the trainer updates on batch 6, sampled by θ₅, while it is already at θ₆. Every step trains on data one update old.' },
    { at: 7.4, name: 'To scale', say: 'The same schedule with the public 7B run\'s medians: about 40 min of rollouts, 81 s of training, a 3.8 s push. Training is the thin orange sliver; the trainer waits about 97% of each step.' },
  ],
  height: () => 156,
  draw(t, w) {
    const narrow = w < 520, Lw = narrow ? 58 : 118, x0 = Lw, x1 = w - 4, yR = 26, yT = 84, lh = 30, out = [hatch('h-async', 'hl-idle')];
    const s = ease(seg(t, 7.4, 9.4));
    const frac = k => lerp(SCHEM[k] / (SCHEM.G + SCHEM.P), REAL[k] / (REAL.G + REAL.P), s);
    const G = frac('G'), T = frac('T'), P = frac('P'), cyc = G + P, total = 3 * cyc;
    // playhead, in cycles
    const tau = t < 1.6 ? lerp(0, T, seg(t, 0, 1.6)) : t < 3.2 ? lerp(T, G, seg(t, 1.6, 3.2)) : t < 4.2 ? lerp(G, cyc, seg(t, 3.2, 4.2)) : lerp(cyc, total, seg(t, 4.2, 7.2));
    const X = u => x0 + (u / total) * (x1 - x0);
    out.push(text(0, yR + 19, narrow ? 'Rollout' : 'Rollout · SGLang', 'strong'));
    out.push(text(0, yT + 19, narrow ? 'Train' : 'Train · Megatron', 'strong'));
    out.push(line(x0, yR + lh + 14, x1, yR + lh + 14, 'rule'));
    for (let c = 0; c < 3; c++) {
      const S = c * cyc, b = 6 + c;
      const gEnd = Math.min(S + G, tau), tEnd = Math.min(S + T, tau);
      if (tau > S) {
        const gw = X(gEnd) - X(S);
        out.push(rect(X(S), yR, gw - 1, lh, 'gen', ' rx="4"'));
        const lab = narrow ? `b${b} · θ${sub(b - 1)}` : `batch ${b} · θ${sub(b - 1)}`;
        if (gw > textW(lab) + 12) out.push(text(X(S) + 8, yR + 19.5, lab, 'on-dark'));
        const tw = Math.max(3, X(tEnd) - X(S));
        out.push(rect(X(S), yT, tw - 1, lh, 'train', ' rx="4"'));
        const tl = narrow ? `b${b - 1}` : `batch ${b - 1}`;
        if (tw > textW(tl) + 12) out.push(text(X(S) + 8, yT + 19.5, tl, 'on-dark'));
        if (tau > S + T) out.push(rect(X(S + T), yT + 1, X(Math.min(S + cyc, tau)) - X(S + T) - 1, lh - 2, 'idle', ' rx="3" fill="url(#h-async)"'));
      }
      if (tau > S + G) {
        const px = X(S + G), pw = Math.max(2.5, X(Math.min(S + cyc, tau)) - px);
        out.push(rect(px, yR - 4, pw, lh + 8, 'train', ' rx="1"'));
        out.push(line(px + pw / 2, yT, px + pw / 2, yR + lh + 4, 'ink', ' style="stroke:var(--orange)" stroke-dasharray="2 3"'));
        if (s < .5) out.push(text(px + pw / 2, yR - 9, `θ${sub(b)}`, 'orangetxt', ` text-anchor="middle"${op(1 - 2 * s)}`));
      }
    }
    // "one behind": batch 6 was sampled by θ5 and is trained in the next cycle
    const arrow = ease(seg(t, 4.6, 5.4)) * (1 - s);
    if (arrow > 0) {
      const ax = X(G * .5), bx2 = X(cyc + T * .5);
      out.push(`<path d="M${n1(ax)} ${yR + lh + 2}C${n1(ax)} ${yT - 6} ${n1(bx2 - 30)} ${yR + lh} ${n1(bx2)} ${yT - 3}" class="ink" style="stroke:var(--text);stroke-width:1.4" marker-end="url(#arr-async)"${op(arrow)}/>`);
      out.push(`<defs><marker id="arr-async" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L8 4L0 8z" style="fill:var(--text)"/></marker></defs>`);
    }
    // axis: plain "time" while schematic, minutes once to scale
    const ticks = seg(s, .85, 1), ay = yT + lh + 18;
    out.push(line(x0, ay - 8, x1, ay - 8, 'axis'));
    if (ticks > 0) {
      const mins = (REAL.G + REAL.P) * 3 / 60;
      for (let m = 0; m <= mins; m += 20) {
        const x = X((m * 60) / ((REAL.G + REAL.P) * 3) * total);
        out.push(line(x, ay - 11, x, ay - 5, 'axis', op(ticks)));
        const lastTick = m + 20 > mins;
        out.push(text(x, ay + 8, m === 0 ? '0' : `${m}${narrow && !lastTick ? '' : ' min'}`, '', ` text-anchor="${lastTick ? 'end' : 'middle'}"${op(ticks)}`));
      }
      out.push(text(X(T) + 6, yT + 19.5, 'training: 81 s', 'strong', op(ticks)));
      out.push(text(X(G) - 6, yR - 8, 'push: 3.8 s', 'orangetxt', ` text-anchor="end"${op(ticks)}`));
    } else out.push(text(x1, ay + 8, 'time →', '', ` text-anchor="end"${op(1 - s)}`));
    return out.join('');
  },
};

// ---------- A crash is not a wrong answer ----------
// p: passed, f: failed, x: infrastructure failure. Eight attempts per task.
const TASKS = ['pppppppp', 'pfpffpff', 'ffffffff', 'fpxffpxf', 'xxpxxxxx', 'pxpxpxpx'];
const verdict = s => {
  const v = [...s].filter(c => c !== 'x');
  if (v.length < 2) return ['< 2 valid', false];
  if (v.every(c => c === v[0])) return [v[0] === 'p' ? 'all pass' : 'all fail', false];
  return ['kept', true];
};
const VERDICTS = TASKS.map(verdict), ZEROED = TASKS.map(s => verdict(s.replace(/x/g, 'f')));
const hash = (i, j) => (((i * 73 + j * 151) * 2654435761) >>> 0) / 4294967296;
const fail = {
  label: 'Six tasks with eight attempts each. Attempts pass, fail or crash. Recognized crashes are masked; tasks whose valid attempts all agree are dropped, leaving tasks 2 and 4. If the crashes were scored as zero, as unlisted failures are, tasks 5 and 6 would be kept for the wrong reason.',
  end: 8.8,
  steps: [
    { at: 0, name: 'Attempts finish', say: '48 attempts finish. Some crash: a sandbox timeout, a verifier crash, a lost session.' },
    { at: 3, name: 'Mask crashes', say: 'Crashes with a recognized exit status get a zero loss mask, so they add no gradient of their own.' },
    { at: 4.4, name: 'Filter groups', say: 'A group trains only if at least two valid attempts disagree. Tasks 1, 3, 5 and 6 drop out, and the step trains on 14 attempts from tasks 2 and 4.' },
    { at: 6.6, name: 'Unlisted failure', say: 'Now score the crashes as 0, which is what happens in the release to a failure the list doesn\'t name. Tasks 5 and 6 suddenly look informative, get kept, and their crashed attempts are pushed down as if the policy had failed.' },
  ],
  geom(w) {
    const narrow = w < 520, Lw = narrow ? 50 : 66, Tw = narrow ? 64 : 124;
    const cs = clamp((w - Lw - Tw) / 8, 22, 40);
    return { narrow, Lw, cs };
  },
  height(w) { return 6 * (this.geom(w).cs + 4) + 2; },
  draw(t, w) {
    const { narrow, Lw, cs } = this.geom(w), out = [hatch('h-fail', 'hl-idle')];
    const mask = ease(seg(t, 3.1, 3.8)), what = ease(seg(t, 6.7, 7.4));
    TASKS.forEach((s, i) => {
      const y = i * (cs + 4) + 1, cy = y + cs / 2;
      const [why, kept] = VERDICTS[i], [, keptIf0] = ZEROED[i];
      const flip = !kept && keptIf0 ? what : 0;
      const dim = kept ? 1 : lerp(1, .3, ease(seg(t, 4.6 + i * .2, 5.1 + i * .2)));
      const a = lerp(dim, 1, flip);
      out.push(text(0, cy + 4.5, narrow ? `${i + 1}` : `task ${i + 1}`, 'strong', op(a)));
      [...s].forEach((c, j) => {
        const x = Lw + j * cs + cs / 2, show = ease(seg(t, .2 + 2.4 * hash(i, j), .5 + 2.4 * hash(i, j)));
        if (show <= 0) return;
        const r = cs * .3, g = op(show * a);
        if (c === 'p') out.push(circle(x, cy, r, 'pass', g));
        else if (c === 'f') out.push(circle(x, cy, r - .75, 'fail', g));
        else {
          if (mask > 0) out.push(rect(x - cs / 2 + 2, y + 1, cs - 4, cs - 2, 'idle', ` rx="4" fill="url(#h-fail)"${op(mask * a * (1 - (kept || keptIf0 ? what : 0)))}`));
          if (what > 0 && (kept || keptIf0)) out.push(circle(x, cy, r - .75, 'fail', ` style="stroke:var(--fail)"${op(what * a)}`));
          out.push(cross(x, cy, r * .62, g));
        }
      });
      const tx = Lw + 8 * cs + 10, filtered = seg(t, 4.6 + i * .2, 5.1 + i * .2);
      if (filtered > 0 && flip === 0)
        out.push(text(tx, cy + 4.5, kept ? 'kept' : narrow ? why : `dropped: ${why}`, kept ? 'oktxt' : '', op(filtered * (kept ? 1 : .9))));
      if (flip > 0) out.push(text(tx, cy + 4.5, narrow ? 'kept ✗' : 'kept, wrongly', 'failtxt', op(flip)));
    });
    return out.join('');
  },
};

const FIGS = { traj, async: asyncFig, fail };
for (const fig of document.querySelectorAll('.fig[data-fig]')) {
  const def = FIGS[fig.dataset.fig];
  if (def) player(fig, def);
}
