// Progressive enhancement: the certificate link still works without JavaScript.
(() => {
  'use strict';
  const trigger = document.querySelector('.cert-button');
  const original = document.getElementById('award-img');
  const dialog = document.getElementById('cert-view');
  if (!trigger || !original || !dialog || typeof dialog.showModal !== 'function') return;
  const fullImage = dialog.querySelector('img');
  const closeButton = dialog.querySelector('button');
  trigger.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (dialog.open) return;
    fullImage.src = original.currentSrc || original.src;
    dialog.showModal();
    document.body.classList.add('award-view-open');
    event.preventDefault();
  });
  closeButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('award-view-open');
    trigger.focus({ preventScroll: true });
  });
})();
