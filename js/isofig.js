// "Try it" figure in the IsoCompute row: the paper's fitted compute-optimal number of parallel
// rollouts per problem, n*, as sampling compute C grows. The fits are printed on Fig. 7 of the
// IsoCompute Playbook (arXiv 2603.12151; Qwen2.5-7B-Instruct, GRPO, B_problem = 32):
//   log2 n* = L / (1 + exp(-k (log10 C - log10 C0))) + b,   C = B_problem · n · M (rollouts)
// The caption and table are plain HTML; this builds the slider and the plot the first time it opens.
const FITS = {
  easy: { L: 6.09, k: 4.75, c0: 5.84, b: 2.73, from: 4.78 }, // fitted over C ≈ 6×10⁴–10⁷
  hard: { L: 4.47, k: 7.23, c0: 5.84, b: 2.79, from: 5.11 }, // and ≈ 1.3×10⁵–10⁷
};
const B_PROBLEM = 32, TO = 7;
export const nStar = (set, lc) => { const f = FITS[set]; return 2 ** (f.L / (1 + Math.exp(-f.k * (lc - f.c0))) + f.b); };

const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
const sci = lc => { const e = Math.floor(lc + 1e-9); return `${(10 ** (lc - e)).toFixed(1)} × 10${[...String(e)].map(d => SUP[d]).join('')}`; };

// plot geometry (SVG user units)
const W = 480, H = 210, ML = 38, MR = 44, MT = 10, MB = 34;
const X0 = 4.75, X1 = 7.05, Y0 = 2, Y1 = 9.3; // log10 C and log2 n
const px = lc => ML + (lc - X0) / (X1 - X0) * (W - ML - MR);
const py = l2 => H - MB - (l2 - Y0) / (Y1 - Y0) * (H - MT - MB);
const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs, parent, text) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  parent?.append(e);
  return e;
};

function build(fig) {
  const figure = fig.querySelector('figure');
  const ctl = document.createElement('div');
  ctl.className = 'ctl';
  ctl.innerHTML = `<label>Sampling compute <input type="range" min="${FITS.easy.from}" max="${TO}" step="0.01" value="6"></label>
    <span role="radiogroup" aria-label="Problem set">
      <label><input type="radio" name="isoset" value="easy" checked><i class="sw easy"></i>Easy problems</label>
      <label><input type="radio" name="isoset" value="hard"><i class="sw hard"></i>Hard problems</label>
    </span>`;
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, 'aria-hidden': 'true' });
  const out = document.createElement('p');
  out.className = 'out'; out.setAttribute('aria-live', 'polite');
  figure.prepend(ctl, svg, out);

  // axes: hairline grid at n = 4, 16, 64, 256; C at 10⁵, 10⁶, 10⁷
  for (const l2 of [2, 4, 6, 8]) {
    el('line', { class: 'grid', x1: ML, x2: W - MR, y1: py(l2), y2: py(l2) }, svg);
    el('text', { class: 'tick', x: ML - 6, y: py(l2) + 3.5, 'text-anchor': 'end' }, svg, 2 ** l2);
  }
  for (const lc of [5, 6, 7]) el('text', { class: 'tick', x: px(lc), y: H - MB + 14, 'text-anchor': 'middle' }, svg, `10${SUP[lc]}`);
  el('text', { class: 'axis', x: (ML + W - MR) / 2, y: H - 4, 'text-anchor': 'middle' }, svg, 'sampling compute C (rollouts)');
  el('text', { class: 'axis', x: 4, y: MT + 2, 'dominant-baseline': 'hanging' }, svg, 'n*');

  const curves = {};
  for (const set of ['easy', 'hard']) {
    const pts = [];
    for (let lc = FITS[set].from; lc <= TO + 1e-9; lc += .02) pts.push(`${px(lc).toFixed(1)},${py(Math.log2(nStar(set, lc))).toFixed(1)}`);
    curves[set] = el('path', { class: `curve ${set}`, d: `M${pts.join('L')}` }, svg);
    el('text', { class: 'end', x: px(TO) + 6, y: py(Math.log2(nStar(set, TO))) + 4 }, svg, set === 'easy' ? 'Easy' : 'Hard');
  }
  const cross = el('line', { class: 'cross', y1: MT, y2: H - MB }, svg);
  const dot = el('circle', { class: 'dot', r: 4.5 }, svg);

  const range = ctl.querySelector('input[type=range]');
  const set = () => ctl.querySelector('input[name=isoset]:checked').value;
  const draw = () => {
    const s = set(), lc = +range.value, n = nStar(s, lc), C = 10 ** lc;
    for (const k in curves) curves[k].classList.toggle('dim', k !== s);
    cross.setAttribute('x1', px(lc)); cross.setAttribute('x2', px(lc));
    dot.setAttribute('cx', px(lc)); dot.setAttribute('cy', py(Math.log2(n))); dot.setAttribute('class', `dot ${s}`);
    range.setAttribute('aria-valuetext', `${Number(C.toPrecision(2)).toLocaleString('en-US')} rollouts`);
    out.textContent = `C = ${sci(lc)} rollouts → n* ≈ ${Math.round(n)} rollouts per problem, M ≈ ${Math.round(C / (B_PROBLEM * n))} steps`;
  };
  range.addEventListener('input', draw);
  ctl.addEventListener('change', e => {
    if (e.target.name !== 'isoset') return;
    range.min = FITS[set()].from;
    if (+range.value < +range.min) range.value = range.min;
    draw();
  });
  // pointing at the plot picks the compute under the pointer
  const fromPointer = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * W;
    range.value = Math.max(+range.min, Math.min(TO, X0 + (x - ML) / (W - ML - MR) * (X1 - X0)));
    draw();
  };
  svg.addEventListener('pointermove', fromPointer);
  svg.addEventListener('pointerdown', fromPointer);
  draw();
}

export function initIsoFig(fig = document.querySelector('.isofig')) {
  if (!fig) return;
  const once = () => { if (fig.open && !fig.querySelector('svg')) build(fig); };
  fig.addEventListener('toggle', once);
  once();
}

initIsoFig();
