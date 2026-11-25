/* Manual photo stacks; CSS owns the shuffle and reduced-motion treatment. */
(() => {
  document.querySelectorAll('[data-photo-stack]').forEach(root => {
    const stage = root.querySelector('.photo-stack-stage');
    const images = [...root.querySelectorAll('.photo-stack-image')];
    if (!stage || images.length < 2) return;

    const dots = [...root.querySelectorAll('[data-stack-go]')];
    const caption = root.querySelector('.photo-stack-caption');
    const status = root.querySelector('.photo-stack-status');
    let index = 0;
    let swipe = null;

    function update(announce = true) {
      root.dataset.activeIndex = String(index);
      images.forEach((image, n) => {
        image.classList.toggle('is-active', n === index);
        image.dataset.position = String((n - index + images.length) % images.length);
        image.setAttribute('aria-hidden', String(n !== index));
        image.draggable = false;
      });
      dots.forEach(button => {
        if (Number(button.dataset.stackGo) === index) button.setAttribute('aria-current', 'true');
        else button.removeAttribute('aria-current');
      });
      const text = images[index].dataset.caption || images[index].alt;
      if (caption) caption.textContent = text;
      if (announce && status) status.textContent = `${index + 1} of ${images.length}: ${text}`;
    }

    function go(target) {
      if (!Number.isInteger(target)) return;
      const next = ((target % images.length) + images.length) % images.length;
      if (next === index) return;
      root.dataset.direction = next === (index + 1) % images.length ? 'next' : 'previous';
      index = next;
      update();
    }

    root.querySelector('[data-stack-prev]')?.addEventListener('click', () => go(index - 1));
    root.querySelector('[data-stack-next]')?.addEventListener('click', () => go(index + 1));
    dots.forEach(button => button.addEventListener('click', () => go(Number(button.dataset.stackGo))));
    root.addEventListener('keydown', event => {
      if (!event.target.closest('button') || event.altKey || event.metaKey || event.ctrlKey) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        go(index + (event.key === 'ArrowRight' ? 1 : -1));
      }
    });

    // With touch-action: pan-y on the stage, vertical gestures remain native.
    stage.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0) return;
      swipe = {id: event.pointerId, x: event.clientX, y: event.clientY};
      stage.setPointerCapture(event.pointerId);
    }, {passive: true});
    stage.addEventListener('pointerup', event => {
      if (!swipe || swipe.id !== event.pointerId) return;
      const dx = event.clientX - swipe.x;
      const dy = event.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.25) go(index + (dx < 0 ? 1 : -1));
    }, {passive: true});
    stage.addEventListener('pointercancel', () => { swipe = null; }, {passive: true});
    stage.addEventListener('lostpointercapture', () => { swipe = null; }, {passive: true});

    update(false);
    root.classList.add('is-ready');
  });
})();
