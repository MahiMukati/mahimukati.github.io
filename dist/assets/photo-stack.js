/* Manual photo stacks. Only the nearby, active card keeps a large image source. */
(() => {
  const motion = window.PortfolioMotion;
  const coarse = window.matchMedia('(pointer: coarse)');
  const isMobile = () => motion ? motion.mobile : coarse.matches || window.innerWidth < 768;

  document.querySelectorAll('[data-photo-stack]').forEach(root => {
    const stage = root.querySelector('.photo-stack-stage');
    const images = [...root.querySelectorAll('.photo-stack-image')];
    if (!stage || images.length < 2) return;

    const dots = [...root.querySelectorAll('[data-stack-go]')];
    const caption = root.querySelector('.photo-stack-caption');
    const status = root.querySelector('.photo-stack-status');
    const releaseTimers = new Map();
    let index = 0, near = false, swipe = null, lastWidth = 0;

    function demote(image) {
      clearTimeout(releaseTimers.get(image));
      releaseTimers.delete(image);
      if (!image.dataset.preview) return;
      image.loading = 'lazy';
      if (image.getAttribute('src') !== image.dataset.preview) image.src = image.dataset.preview;
      image.removeAttribute('srcset');
      image.removeAttribute('sizes');
    }

    function promote(image) {
      clearTimeout(releaseTimers.get(image));
      releaseTimers.delete(image);
      if (!image.dataset.fullSrc) return;
      const mobile = isMobile();
      const sources = mobile
        ? ((motion?.lightweight || motion?.low) && image.dataset.lowSrcset) || image.dataset.mobileSrcset || image.dataset.srcset
        : image.dataset.srcset;
      const size = `${Math.max(1, Math.ceil(image.clientWidth || stage.clientWidth * 0.82))}px`;
      image.loading = 'eager';
      if (image.sizes !== size) image.sizes = size;
      if (sources && image.getAttribute('srcset') !== sources) image.srcset = sources;
      if (image.getAttribute('src') !== image.dataset.fullSrc) image.src = image.dataset.fullSrc;
    }

    function refreshMedia(immediate = false) {
      const active = near && !document.hidden;
      images.forEach((image, n) => {
        if (active && n === index) promote(image);
        else if (immediate) demote(image);
        else if (image.hasAttribute('srcset') && !releaseTimers.has(image)) {
          // Keep the outgoing card sharp during the shuffle, then release it.
          releaseTimers.set(image, setTimeout(() => {
            if (n !== index || !near || document.hidden) demote(image);
            else releaseTimers.delete(image);
          }, 700));
        }
      });
    }

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
      refreshMedia();
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

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        near = entry.isIntersecting;
        refreshMedia(!near);
      }, {rootMargin: '200px 0px'}).observe(root);
    } else {
      near = true;
    }
    if ('ResizeObserver' in window) {
      new ResizeObserver(() => {
        const width = Math.round(stage.clientWidth);
        if (width === lastWidth) return;
        lastWidth = width;
        refreshMedia();
      }).observe(stage);
    }
    motion?.subscribe(() => refreshMedia());
    document.addEventListener('visibilitychange', () => refreshMedia(document.hidden));
    window.addEventListener('pagehide', () => images.forEach(demote));
    window.addEventListener('pageshow', () => refreshMedia());

    update(false);
    root.classList.add('is-ready');
  });
})();
