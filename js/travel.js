// Lightbox for the /travel gallery: click a photo to open it; ← → step through all photos;
// Escape, the ×, or a click on the backdrop closes it.
export function initLightbox(root = document) {
  const dlg = root.querySelector('dialog.lightbox');
  const photos = [...root.querySelectorAll('.gallery figure')];
  if (!dlg || !photos.length) return;
  const big = dlg.querySelector('img'), cap = dlg.querySelector('.cap');
  let at = 0;

  const show = i => {
    at = (i + photos.length) % photos.length;
    const img = photos[at].querySelector('img');
    big.setAttribute('src', img.getAttribute('src'));
    big.alt = img.alt;
    cap.textContent = photos[at].querySelector('figcaption')?.textContent || '';
  };

  photos.forEach((fig, i) => {
    const img = fig.querySelector('img');
    img.tabIndex = 0;
    img.addEventListener('click', () => { show(i); dlg.showModal(); });
    img.addEventListener('keydown', e => { if (e.key === 'Enter') { show(i); dlg.showModal(); } });
  });
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
  });
  dlg.querySelector('.close').addEventListener('click', () => dlg.close());
  // A click on the dialog element itself (not its children) is a click on the backdrop.
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
}

initLightbox();
