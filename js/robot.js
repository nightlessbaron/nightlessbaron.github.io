// A small robot that walks along the bottom of the screen as you scroll (its position is your
// reading progress). Hover it for a one-liner; click it for a trick. Purely decorative: hidden
// from screen readers, never focusable, silent until clicked.
// It never stands over the text. On wide screens it walks in the empty margins: the left one for the
// first half of the page, the right one for the second, crossing once in between. Where there are no
// margins (phones, narrow windows), and always with reduced motion, it waits in the bottom-right corner:
// its head peeks up if that corner is clear of the text, and otherwise it stays below the window's edge.
// It climbs out to talk, to do a trick, and at the end of the page.
const LINES = [
  ['FUN FACT', 'I fell over about 10,000 times in simulation before you met me. Please don’t bring it up.'],
  ['MY REWARD FUNCTION', '+1 every time you scroll. You are, technically, my policy.'],
  ['SIM-TO-REAL GAP', 'In simulation I’m six feet tall and I can do parkour.'],
  ['EXPLORATION', 'I’m not lost. I’m exploring. ε = 0.3.'],
  ['COMPUTE', 'I asked Varad for more GPUs. He showed me a scaling law and said no.'],
  ['TRUE STORY', 'On its first birthday on Mars, the Curiosity rover played “Happy Birthday” to itself by vibrating a science instrument. Alone. 225 million km from anyone.'],
  ['HUMBLE', 'Over 40 million Roombas have been sold. Humanoids, please stay humble.'],
  ['HONEST', 'My walk is a sine wave. Varad says a learned policy would be better. I say: who’s the one walking?'],
  ['KL PENALTY', 'My KL divergence from an actual duck is enormous. I’m fine with it.'],
  ['WORLD MODEL', 'I predicted you’d hover here. My world model is very good.'],
  ['pass@k', 'Hover me 64 times and it’s pass@64. Varad will write a paper about it.'],
  ['DEBUGGING', 'The loss went down. The vibes went up. Ship it.'],
  ['ETYMOLOGY', '“Robot” comes from the Czech <i>robota</i>, forced labour. I’m on a volunteer basis.'],
  ['REWARD HACKING', 'The reward was “stay upright”, so I learned to lie very still. They changed the reward.'],
];
const TRICKS = [['backflip', 'backflip.exe ✓'], ['faceplant', ''], ['dance', 'dance mode'], ['spin', 'spin to win'], ['hearts', '♥']];

const SVG = `<svg viewBox="0 0 100 120" focusable="false"><g data-p="trick"><g data-p="flip">
  <g class="hit" fill="transparent"><rect x="34" y="0" width="54" height="46" rx="14"/><rect x="24" y="40" width="50" height="46" rx="18"/><rect x="28" y="76" width="56" height="44" rx="10"/></g>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path data-p="legB" stroke="var(--teal)" stroke-width="4.5" opacity=".55"/><path data-p="legF" stroke="var(--teal)" stroke-width="4.5"/>
  </g>
  <g data-p="upper">
    <ellipse cx="48" cy="68" rx="21" ry="15" fill="var(--bot-shell)" stroke="var(--teal)" stroke-width="2.2"/>
    <path d="M31 72 q17 9 34 0" fill="none" stroke="var(--orange)" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M27 63 q-5 3 -3 8" fill="none" stroke="var(--teal)" stroke-width="2.2" stroke-linecap="round"/>
    <line x1="54" y1="55" x2="58" y2="43" stroke="var(--teal)" stroke-width="5" stroke-linecap="round"/>
    <g data-p="head">
      <g data-p="ant"><line x1="47" y1="16" x2="43" y2="5" stroke="var(--teal)" stroke-width="1.8" stroke-linecap="round"/><circle cx="43" cy="4.5" r="2.8" fill="var(--orange)"/></g>
      <rect x="37" y="15" width="38" height="27" rx="13" fill="var(--bot-shell)" stroke="var(--teal)" stroke-width="2.2"/>
      <path d="M73 26 q11 1 11 4 q0 3.4 -11 4.2 z" fill="var(--orange)" stroke="var(--teal)" stroke-width="1.4" stroke-linejoin="round"/>
      <rect x="46" y="21" width="25" height="14" rx="7" fill="var(--bot-visor)"/>
      <g data-p="eyesOpen" fill="var(--bot-eye)"><ellipse cx="54" cy="28" rx="2.6" ry="3.2"/><ellipse cx="63.5" cy="28" rx="2.6" ry="3.2"/></g>
      <g data-p="eyesX" fill="none" stroke="var(--bot-eye)" stroke-width="1.6" stroke-linecap="round" style="display:none"><path d="M52 26l4 4M56 26l-4 4M61.5 26l4 4M65.5 26l-4 4"/></g>
      <g data-p="eyesHappy" fill="none" stroke="var(--bot-eye)" stroke-width="1.8" stroke-linecap="round" style="display:none"><path d="M51.5 29.5 q2.5 -4 5 0"/><path d="M61 29.5 q2.5 -4 5 0"/></g>
      <g data-p="blush" fill="#ff8fab" opacity="0"><ellipse cx="50" cy="38" rx="3" ry="1.5"/><ellipse cx="68" cy="38" rx="3" ry="1.5"/></g>
    </g>
  </g>
</g></g><ellipse cx="50" cy="117" rx="20" ry="2.5" fill="#000" opacity=".08"/></svg>`;

// Reverse-jointed (bird-like) leg in robot coordinates: thigh forward-down, shin back-down, flat foot.
function leg(ph, hipX, hipY) {
  const sw = Math.sin(ph), lift = Math.max(0, Math.cos(ph));
  const a1 = .55 + .42 * sw, kx = hipX + 15 * Math.sin(a1), ky = hipY + 15 * Math.cos(a1);
  const a2 = -.62 + .30 * sw - .55 * lift, ax = kx + 19 * Math.sin(a2), ay = ky + 19 * Math.cos(a2);
  return { hipX, kx, ky, ax, ay };
}

export function initRobot({ reduce = matchMedia('(prefers-reduced-motion: reduce)').matches } = {}) {
  const bot = document.createElement('div');
  bot.className = 'bot';
  bot.setAttribute('aria-hidden', 'true');
  bot.innerHTML = `<div class="bubble"></div>${SVG}`;
  document.body.append(bot);
  const bubble = bot.querySelector('.bubble');
  const P = Object.fromEntries([...bot.querySelectorAll('[data-p]')].map(el => [el.dataset.p, el]));

  // Wide enough for a margin the robot fits in beside the 812px text column (site.css pads the page
  // end for the peeking robot below this same width).
  const wideMQ = matchMedia('(min-width: 1012px)'), wide = () => !reduce && wideMQ.matches;
  let x, facing = -1, phase = 0, lastT = performance.now(), speed = 0;
  let lane = 0, ty = 0, sink = 1, held = false, done = false;
  let hop = 0, hopV = 0, antA = 0, antV = 0, mouse = null, nextBlink = 1.5, blinkT = -1, happy = false;
  let trick = null, facing0 = 1, combo = 0, lastClick = 0, order = [], lastLine = -1, pointer = 'mouse', ac;
  let calm = false, lastMove = -1e9;
  addEventListener('pointermove', e => { mouse = { x: e.clientX, y: e.clientY }; lastMove = performance.now(); calm = false; }, { passive: true });

  // Sizes are measured only when they can change, never per frame: reading layout right after
  // moving things forces the browser to lay the page out again on every frame.
  let W, bw, bh, botTop, bubbleW, maxScroll, colL, colR, overText;
  const main = document.querySelector('main') || document.body;
  const measure = () => {
    const r = bot.getBoundingClientRect(), c = main.getBoundingClientRect();
    W = document.documentElement.clientWidth; // without the scrollbar
    bw = r.width; bh = r.height; botTop = r.top - ty; bubbleW = bubble.offsetWidth;
    colL = c.left; colR = c.right;
    overText = W - bw - 14 < colR; // the corner it waits in is over the text column
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  };
  measure();
  // Where it wants to be: in a margin, at your reading progress; or in the corner.
  const goalX = () => {
    if (!wide()) return W - bw - 14;
    const p = Math.min(1, scrollY / maxScroll);
    if (lane === 0 && p > .52) lane = 1; else if (lane === 1 && p < .48) lane = 0; // no dithering at the halfway line
    const l0 = 12, l1 = Math.max(l0, colL - bw - 12), r0 = colR + 12, r1 = Math.max(r0, W - bw - 12);
    return lane === 0 ? l0 + (l1 - l0) * Math.min(1, p / .5) : r0 + (r1 - r0) * Math.max(0, (p - .5) / .5);
  };
  x = goalX();
  addEventListener('resize', measure);
  new ResizeObserver(measure).observe(document.body);

  function showEyes(which) {
    P.eyesOpen.style.display = which === 'open' && !happy ? '' : 'none';
    P.eyesHappy.style.display = which === 'open' && happy ? '' : 'none';
    P.eyesX.style.display = which === 'x' ? '' : 'none';
  }
  function setHappy(on) { happy = on; if (!trick) showEyes('open'); P.blush.setAttribute('opacity', on ? .8 : 0); }

  function frame(now) {
    requestAnimationFrame(frame);
    const goal = goalX(), atEnd = scrollY >= maxScroll - 2;
    // A peeking robot keeps its head up while the pointer is anywhere over where its body would be,
    // so rising under a still cursor can't make it duck and pop up again in a loop.
    if (held && !(mouse && mouse.x > x - 10 && mouse.x < x + bw + 10 && mouse.y > botTop - 10)) held = false;
    const up = wide() || atEnd || held || trick || hop > 0 || bubble.classList.contains('on') ? 0 : 1;
    // Standing still with nobody around: a dozen updates a second is plenty for a head sway and a blink.
    if (calm && Math.abs(goal - x) < .05 && sink === up && now - lastT < 80) return;
    const dt = Math.min(.05, (now - lastT) / 1000); lastT = now;
    let moved = 0;
    if (reduce) { x = goal; sink = up; }
    else {
      let step = (goal - x) * Math.min(1, dt * 4);
      step = Math.sign(step) * Math.min(Math.abs(step), 900 * dt); // a brisk trot across the text, not a teleport
      x += step; moved = step;
      if (Math.abs(step) > .05) facing = step > 0 ? 1 : -1;
      phase += Math.abs(step) / 26 * Math.PI; // feet locked to distance travelled, so no moonwalking
      sink += (up - sink) * Math.min(1, dt * 9); if (Math.abs(up - sink) < .002) sink = up;
    }
    ty = sink * (overText ? bh + 12 : 6 + bh * .6); // waiting: all of it, or the bottom 60%, below the window's edge
    // standing still, it turns to face the page
    if (!trick && speed < .03 && Math.abs(goal - x) < 1) facing = wide() && lane === 0 ? 1 : -1;
    // The end of the page, the first time: it has been an episode.
    if (atEnd && !done && sink < .05 && Math.abs(goal - x) < 2 && !trick) { done = true; hopV = 160; tag('episode complete · R = 1.0'); }
    speed += (Math.min(1, Math.abs(moved) / 2) - speed) * Math.min(1, dt * 6);
    if (speed < .03) { const k = Math.round(phase / Math.PI) * Math.PI; phase += (k - phase) * Math.min(1, dt * 6); } // settle feet

    const L1 = leg(phase, 46, 78), L2 = leg(phase + Math.PI, 50, 78);
    hopV -= 900 * dt; hop = Math.max(0, hop + hopV * dt); if (hop === 0) hopV = 0;
    const bob = 114 - Math.max(L1.ay, L2.ay) - hop; // keep the stance foot on the ground
    const d = L => `M${L.hipX} ${78 + bob} L${L.kx} ${L.ky + bob} L${L.ax} ${L.ay + bob} L${L.ax + 8} ${L.ay + bob}`;
    P.legF.setAttribute('d', d(L1)); P.legB.setAttribute('d', d(L2));
    P.upper.setAttribute('transform', `translate(0 ${bob}) rotate(${speed * 6} 48 80)`);
    antV += (-antA * 120 - antV * 8 - moved * 6 - hopV * .15) * dt; antA += antV * dt;
    P.ant.setAttribute('transform', `rotate(${antA} 47 16)`);
    P.head.setAttribute('transform', `rotate(${speed < .05 && !reduce ? Math.sin(now / 900) * 3 : 0} 56 42)`);

    // eyes follow the cursor, and blink every few seconds
    const ex = x + bw * .58, ey = botTop + ty + bh * .24;
    let gx = 0, gy = 0;
    if (mouse) {
      const dist = Math.hypot(mouse.x - ex, mouse.y - ey) || 1;
      gx = Math.max(-1.6, Math.min(2, (mouse.x - ex) * facing / dist * 2)); gy = Math.max(-1.2, Math.min(1.4, (mouse.y - ey) / dist * 1.4));
    }
    const t = now / 1000;
    if (t > nextBlink) { blinkT = t; nextBlink = t + 2.5 + Math.random() * 3.5; }
    P.eyesOpen.setAttribute('transform', `translate(${gx} ${gy}) translate(0 28) scale(1 ${t - blinkT < .14 ? .1 : 1}) translate(0 -28)`);

    let rot = 0, dx = 0, pivot = 64;
    if (trick) {
      const k = (now - trick.t0) / 1000;
      if (trick.type === 'backflip') { rot = 360 * Math.min(1, Math.max(0, (k - .1) / .55)) * -facing; if (k > .95) endTrick(); }
      else if (trick.type === 'faceplant') {
        pivot = 112; rot = (k < .25 ? 95 * k / .25 : k < 1.1 ? 95 : 95 * Math.max(0, 1 - (k - 1.1) / .3)) * -facing;
        showEyes(k > .2 && k < 1.2 ? 'x' : 'open');
        if (k > 1.15 && !trick.said) { trick.said = true; tag('recovery policy ✓'); }
        if (k > 1.6) endTrick();
      } else if (trick.type === 'dance') {
        rot = Math.sin(k * 18) * 14; dx = Math.sin(k * 9) * 4;
        if (k * 1000 % 260 < 20) burst('♪', 1);
        if (k > 1.5) endTrick();
      } else if (trick.type === 'spin') {
        facing = Math.floor(Math.min(1, k / .8) * 6) % 2 ? -facing0 : facing0;
        if (k > .9) { facing = facing0; endTrick(); }
      }
    }
    P.trick.setAttribute('transform', `translate(${dx} 0) rotate(${rot} 50 ${pivot})`);
    P.flip.setAttribute('transform', facing > 0 ? '' : 'translate(100 0) scale(-1 1)');
    bot.style.transform = `translate(${x}px, ${ty}px)`;
    // keep the speech bubble on screen, with its tail still pointing at the robot
    const left = Math.max(8, Math.min(W - bubbleW - 8, x + bw / 2 - bubbleW / 2));
    bubble.style.left = `${left - x}px`;
    bubble.style.setProperty('--tail', `${x + bw / 2 - left}px`);
    calm = !trick && hop === 0 && speed < .03 && sink === up && Math.abs(antA) + Math.abs(antV) < .5 && now - lastMove > 400;
  }
  requestAnimationFrame(frame);

  function talk() {
    let i; do i = Math.floor(Math.random() * LINES.length); while (i === lastLine); lastLine = i;
    bubble.innerHTML = `<small>${LINES[i][0]}</small>${LINES[i][1]}`;
    bubble.classList.add('on'); setHappy(true);
  }
  function quiet() { bubble.classList.remove('on'); setHappy(false); }
  function endTrick() { trick = null; showEyes('open'); }

  function tag(text) {
    const el = document.createElement('div');
    el.className = 'bot-tag'; el.setAttribute('aria-hidden', 'true'); el.textContent = text;
    document.body.append(el);
    const r = bot.getBoundingClientRect();
    el.style.left = `${Math.max(6, Math.min(innerWidth - el.offsetWidth - 6, r.left + r.width / 2 - el.offsetWidth / 2))}px`;
    el.style.top = `${r.top - 22}px`;
    setTimeout(() => { el.style.opacity = 0; }, 900);
    setTimeout(() => el.remove(), 1300);
  }
  function burst(ch, n) {
    const r = bot.getBoundingClientRect(), cols = ['#F44900', '#D03A8A', '#2f8f47', '#1772d0', '#e0a100'];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('span');
      el.className = 'bot-fx'; el.setAttribute('aria-hidden', 'true'); el.textContent = ch;
      el.style.color = cols[Math.floor(Math.random() * cols.length)];
      el.style.left = `${r.left + r.width / 2}px`; el.style.top = `${r.top + r.height * .3}px`;
      document.body.append(el);
      const a = -Math.PI / 2 + (Math.random() - .5) * 1.8, v = 60 + Math.random() * 90;
      el.animate([{ transform: 'translate(0,0) scale(.6)', opacity: 1 },
        { transform: `translate(${Math.cos(a) * v}px,${Math.sin(a) * v}px) scale(1.1) rotate(${(Math.random() - .5) * 60}deg)`, opacity: 0 }],
        { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => el.remove();
    }
  }
  // A short two- or three-note beep. Audio is only ever created inside a click.
  function chirp() {
    try {
      ac ||= new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime, notes = Math.random() < .5 ? [[880, 1500], [1300, 900]] : [[700, 1200], [1000, 1600], [1500, 1100]];
      notes.forEach(([f0, f1], k) => {
        const o = ac.createOscillator(), g = ac.createGain(), s = t0 + k * .085;
        o.type = 'sine'; o.frequency.setValueAtTime(f0, s); o.frequency.exponentialRampToValueAtTime(f1, s + .07);
        g.gain.setValueAtTime(.0001, s); g.gain.exponentialRampToValueAtTime(.06, s + .012); g.gain.exponentialRampToValueAtTime(.0001, s + .08);
        o.connect(g).connect(ac.destination); o.start(s); o.stop(s + .09);
      });
    } catch { /* no audio is fine */ }
  }

  // Only the robot's outline takes the pointer (.hit), so the pointer can slip off it between parts;
  // a short grace period keeps that from closing the bubble and drawing a new line.
  let leaveT;
  bot.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; held = true; clearTimeout(leaveT); if (!bubble.classList.contains('on')) talk(); });
  bot.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') leaveT = setTimeout(quiet, 150); });
  bot.addEventListener('pointerdown', e => { pointer = e.pointerType; });
  document.addEventListener('pointerdown', e => { if (!bot.contains(e.target)) quiet(); });
  bot.addEventListener('click', () => {
    calm = false;
    // On a touch screen the first tap is the "hover": show a line. The next tap does a trick.
    if (pointer !== 'mouse' && !bubble.classList.contains('on')) { talk(); return; }
    const now = performance.now();
    combo = now - lastClick < 1500 ? combo + 1 : 1; lastClick = now;
    if (combo >= 5) {
      combo = 0; quiet(); bot.dataset.last = 'tired'; tag('ok ok I’m tired');
      trick = null; showEyes('x'); setTimeout(() => showEyes('open'), 700); chirp();
      return;
    }
    if (trick) return;
    quiet(); chirp();
    if (reduce) { bot.dataset.last = 'hop'; hopV = 120; return; }
    if (!order.length) order = TRICKS.map((_, i) => i).sort(() => Math.random() - .5); // every trick once before any repeats
    const [type, label] = TRICKS[order.pop()];
    bot.dataset.last = type; facing0 = facing;
    if (type === 'backflip') { hopV = 360; burst('✦', 5); }
    else if (type === 'hearts') { hopV = 120; burst('♥', 10); }
    else if (type === 'spin') hopV = 90;
    else if (type === 'dance') burst('♪', 2);
    if (type !== 'hearts') trick = { type, t0: now };
    if (label) tag(label);
  });
  return bot;
}

initRobot();
