// Hover (mouse/keyboard) or tap (touch) to play a paper's animation.
// The still image stays visible until the video is actually playing, so a slow
// network never shows an empty box. Videos are preload="none" until first use.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const touch = matchMedia('(hover: none)').matches;

function controller(thumb) {
  const video = thumb.querySelector('video.anim');
  let wanted = false;
  video.addEventListener('playing', () => { if (wanted) thumb.classList.add('playing'); });
  const start = () => {
    wanted = true;
    if (video.preload !== 'auto') video.preload = 'auto';
    video.play().catch(() => {});
  };
  const stop = () => {
    wanted = false;
    thumb.classList.remove('playing');
    video.pause();
  };
  return { start, stop, toggle: () => (wanted ? stop() : start()) };
}

export function initMedia(root = document) {
  for (const thumb of root.querySelectorAll('.thumb[data-anim]')) {
    const ctl = controller(thumb);
    const row = thumb.closest('.row') || thumb;

    if (reduceMotion) {
      const btn = document.createElement('button');
      btn.className = 'play';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Play animation');
      btn.setAttribute('aria-pressed', 'false'); // a toggle: screen readers announce on/off
      btn.textContent = '▶';
      btn.addEventListener('click', () => {
        ctl.toggle();
        const playing = !thumb.querySelector('video').paused;
        btn.textContent = playing ? '❚❚' : '▶';
        btn.setAttribute('aria-pressed', String(playing));
      });
      thumb.append(btn);
      continue;
    }

    // Mouse hover and keyboard focus play while inside the row. The hover has to rest a moment first,
    // so a cursor passing over on its way down the page doesn't start downloading the video.
    let hoverT;
    row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') hoverT = setTimeout(ctl.start, 150); });
    row.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { clearTimeout(hoverT); ctl.stop(); } });
    row.addEventListener('focusin', ctl.start);
    row.addEventListener('focusout', e => { if (!row.contains(e.relatedTarget)) ctl.stop(); });
    // Touch has no hover: a tap on the thumbnail toggles, and a small ▶ says so.
    thumb.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') ctl.toggle(); });
    if (touch) {
      const hint = document.createElement('span');
      hint.className = 'play'; hint.setAttribute('aria-hidden', 'true'); hint.textContent = '▶';
      const video = thumb.querySelector('video');
      video.addEventListener('play', () => { hint.textContent = '❚❚'; });
      video.addEventListener('pause', () => { hint.textContent = '▶'; });
      thumb.append(hint);
    }
  }
}

initMedia();
