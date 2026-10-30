// Lightbox for the /travel gallery: click a photo to open it; ← → (or the ‹ › buttons) step through
// all photos; Escape, the ×, or a click on the backdrop closes it. Each thumbnail is a link to the
// full-size photo, so without JavaScript a click simply opens the photo.
export function initLightbox(root = document) {
  const dlg = root.querySelector('dialog.lightbox');
  const photos = [...root.querySelectorAll('.gallery figure')];
  if (!dlg || !photos.length) return;
  const big = dlg.querySelector('img'), cap = dlg.querySelector('.cap');
  let at = 0;

  const show = i => {
    at = (i + photos.length) % photos.length;
    const img = photos[at].querySelector('img');
    big.setAttribute('src', photos[at].querySelector('a').getAttribute('href'));
    big.alt = img.alt;
    cap.textContent = photos[at].querySelector('figcaption')?.textContent || '';
  };

  photos.forEach((fig, i) => fig.querySelector('a').addEventListener('click', e => { e.preventDefault(); show(i); dlg.showModal(); }));
  dlg.addEventListener('keydown', e => {
    if (e.key === 'ArrowRight') show(at + 1);
    if (e.key === 'ArrowLeft') show(at - 1);
  });
  dlg.querySelector('.close').addEventListener('click', () => dlg.close());
  dlg.querySelector('.prev').addEventListener('click', () => show(at - 1));
  dlg.querySelector('.next').addEventListener('click', () => show(at + 1));
  // A click on the dialog element itself (not its children) is a click on the backdrop.
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
}

initLightbox();
