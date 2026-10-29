// Decode the tagline token by token, like an LLM sampling it: each word briefly shows
// its top-3 candidates before settling. Afterwards, hovering a word shows its log-prob.
// The candidate lists are hand-written for flavour, not real model outputs.
const CANDIDATES = {
  'I': [['I', .94], ['We', .04], ['My', .01]],
  'work': [['work', .71], ['research', .18], ['build', .06]],
  'on': [['on', .97], ['in', .02], ['at', .01]],
  'the': [['the', .88], ['both', .07], ['how', .03]],
  'science': [['science', .52], ['theory', .21], ['practice', .11]],
  'and': [['and', .95], ['&', .03], ['+', .01]],
  'systems': [['systems', .64], ['infra', .2], ['engineering', .08]],
  'of': [['of', .9], ['behind', .06], ['for', .02]],
  'reinforcement': [['reinforcement', .83], ['post-training', .1], ['scaling', .04]],
  'learning': [['learning', .99], ['learners', .005], ['loops', .003]],
  'for': [['for', .91], ['in', .05], ['with', .02]],
  'LLM': [['LLM', .77], ['language', .15], ['AI', .05]],
  'agents.': [['agents.', .58], ['reasoning.', .27], ['models.', .1]],
};

const pct = p => `${Math.round(p * 100)}%`;

export function decodeTagline(el, candidates = CANDIDATES, { stepMs = 150, holdMs = 260, animate = true } = {}) {
  const words = el.textContent.trim().split(/\s+/);
  el.textContent = '';
  el.classList.add('ready'); // un-hides the tagline (see site.css); the tokens below start out blank
  const toks = words.map((w, i) => {
    const cands = candidates[w] || [[w, .99]];
    const tok = document.createElement('span');
    tok.className = animate ? 'tok pending' : 'tok';
    tok.append(w);
    const stack = document.createElement('span');
    stack.className = 'cands';
    stack.setAttribute('aria-hidden', 'true');
    stack.style.zIndex = String(10 + i); // the newest token's candidates sit on top
    // Least likely on top, the chosen word nearest the text.
    for (const [c, p] of [...cands].reverse()) {
      // Overlay text lives in data-t and is drawn by CSS, so the tagline's real text stays clean.
      const line = document.createElement(c === w ? 'b' : 'span');
      line.dataset.t = `${c} ${pct(p)}`;
      stack.append(line);
    }
    const lp = document.createElement('span');
    lp.className = 'lp';
    lp.setAttribute('aria-hidden', 'true');
    lp.dataset.t = `logp ${Math.log(cands[0][1]).toFixed(2)}`;
    tok.append(stack, lp);
    el.append(tok, i < words.length - 1 ? ' ' : '');
    return tok;
  });
  if (!animate) return Promise.resolve();
  return new Promise(done => toks.forEach((tok, i) => setTimeout(() => {
    const stack = tok.querySelector('.cands');
    stack.classList.add('on');
    tok.classList.remove('pending');
    setTimeout(() => {
      stack.classList.remove('on');
      if (i === toks.length - 1) done();
    }, holdMs);
  }, i * stepMs)));
}

const el = document.getElementById('tagline');
if (el) decodeTagline(el, CANDIDATES, { animate: !matchMedia('(prefers-reduced-motion: reduce)').matches });
