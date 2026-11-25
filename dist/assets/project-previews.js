(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll('[data-project-preview]').forEach(preview => {
    const frames = [...preview.querySelectorAll('[data-preview-frame]')];
    const toggle = preview.querySelector('[data-preview-toggle]');
    if (frames.length < 2 || !toggle) return;

    let current = Math.max(0, frames.findIndex(frame => frame.classList.contains('is-active')));
    let paused = motion.matches;
    let visible = !('IntersectionObserver' in window);
    let timer = 0;

    function showFrame() {
      frames.forEach((frame, index) => {
        frame.classList.toggle('is-active', index === current);
        frame.setAttribute('aria-hidden', String(index !== current));
      });
    }

    function schedule() {
      clearTimeout(timer);
      timer = 0;
      const label = paused ? 'resume preview' : 'pause preview';
      const labelNode = toggle.querySelector('[data-preview-label]');
      if (labelNode) labelNode.textContent = label;
      toggle.setAttribute('aria-label', label);
      toggle.dataset.paused = String(paused);
      if (paused || !visible || document.hidden) return;
      timer = setTimeout(() => {
        current = (current + 1) % frames.length;
        showFrame();
        schedule();
      }, 2400);
    }

    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      paused = !paused;
      schedule();
    });
    document.addEventListener('visibilitychange', schedule);
    motion.addEventListener('change', () => {
      if (motion.matches) paused = true;
      schedule();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entries => {
        visible = entries[0].isIntersecting;
        schedule();
      }).observe(preview);
    }

    showFrame();
    schedule();
  });
})();
