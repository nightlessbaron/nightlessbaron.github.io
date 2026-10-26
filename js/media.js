// Hover (mouse/keyboard) or tap (touch) to play a paper's animation.
// The still image stays visible until the video is actually playing, so a slow
// network never shows an empty box. Videos are preload="none" until first use.
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

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
      btn.textContent = '▶';
      btn.addEventListener('click', () => {
        ctl.toggle();
        btn.textContent = thumb.querySelector('video').paused ? '▶' : '❚❚';
      });
      thumb.append(btn);
      continue;
    }

    // Mouse hover and keyboard focus play while inside the row.
    row.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') ctl.start(); });
    row.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') ctl.stop(); });
    row.addEventListener('focusin', ctl.start);
    row.addEventListener('focusout', e => { if (!row.contains(e.relatedTarget)) ctl.stop(); });
    // Touch has no hover: a tap on the thumbnail toggles.
    thumb.addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') ctl.toggle(); });
  }
}

initMedia();
