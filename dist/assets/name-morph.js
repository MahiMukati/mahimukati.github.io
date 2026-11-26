(() => {
  'use strict';
  // Phones use prepared artwork: do not create native canvas contexts or
  // rasterize thousands of complex glyphs during the initial page load.
  if (window.PortfolioMotion?.lightweight ??
      (matchMedia('(pointer: coarse)').matches || innerWidth < 768)) return;

  const names = ['محمد', 'ماحي', 'علي', 'مكاتي'];
  const headerMark = document.querySelector('[data-name-mark]');
  const canvas = document.querySelector('#name-art') || headerMark;
  if (!canvas) return;
  const surfaces = [canvas, document.querySelector('#name-icon')].filter(Boolean);
  const contexts = surfaces.map(surface => surface.getContext('2d'));
  if (contexts.some(context => !context)) return;
  const shapeURL = new URL('jali-thuluth/name-shapes.json', document.currentScript.src);
  const runtime = window.PortfolioMotion;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const mobile = () => runtime ? runtime.mobile : coarse.matches || innerWidth < 768;
  const still = () => runtime ? runtime.reduced : reduced.matches;
  const motion = document.querySelector('#motion');
  const buttons = [...document.querySelectorAll('[data-name]')];
  const W = 512, H = 300, duration = 1650, holdDuration = 2400;
  const glyphs = [...'+:*#=.'];
  let colors = ['#fffef9', '#e6e1d7', '#b6ced0', '#91c7ca'];
  let shapes = [], particles = [], origin = [], target = 0;
  let ready = false, onScreen = true, moving = false, playing = !still(), dirty = true;
  let frame = 0, holdTimer = 0, resizeTimer = 0, last = 0, lastPaint = 0, progress = 0;
  let holdRemaining = holdDuration, holdStarted = 0, disposed = false;
  const active = () => ready && !disposed && onScreen && !document.hidden;

  function stop() {
    if (frame) cancelAnimationFrame(frame);
    if (holdTimer) {
      clearTimeout(holdTimer);
      holdRemaining = Math.max(0, holdRemaining - (performance.now() - holdStarted));
    }
    frame = holdTimer = 0;
    last = lastPaint = 0;
  }
  function paint() {
    if (!active()) { dirty = true; return; }
    const started = performance.now();
    for (const ctx of contexts) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      ctx.font = '400 16px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      particles.forEach((point, index) => {
        ctx.fillStyle = point.dot ? colors[0] : colors[index % colors.length];
        ctx.globalAlpha = point.alpha;
        if (point.dot) {
          // Keep the approved four-character dots and widened Mahi alif.
          ctx.font = '400 11px ui-monospace, Menlo, Consolas, monospace';
          ctx.fillText('+', point.x, point.y - 5);
          ctx.fillText('#', point.x - 3.8, point.y);
          ctx.fillText('#', point.x + 3.8, point.y);
          ctx.fillText('+', point.x, point.y + 5);
          ctx.font = '400 16px ui-monospace, Menlo, Consolas, monospace';
        } else {
          ctx.save(); ctx.translate(point.x, point.y); ctx.scale(point.width, 1);
          ctx.fillText(glyphs[index % glyphs.length], 0, 0); ctx.restore();
        }
      });
      ctx.globalAlpha = 1;
    }
    dirty = false;
    runtime?.report('name', performance.now() - started);
  }
  function fit() {
    let changed = false;
    for (const [index, surface] of surfaces.entries()) {
      const box = surface.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(box.width * dpr)), height = Math.max(1, Math.round(box.height * dpr));
      if (surface.width === width && surface.height === height) continue;
      surface.width = width; surface.height = height;
      contexts[index].setTransform(width / W, 0, 0, height / H, 0, 0);
      if (headerMark) {
        contexts[index].translate(W / 2, H / 2);
        contexts[index].scale(1.12, 1.12);
        contexts[index].translate(-W / 2, -H / 2);
      }
      changed = true;
    }
    if (changed) { dirty = true; if (active()) paint(); }
  }
  function schedule() {
    if (!active()) return;
    if (dirty) paint();
    if (moving) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else if (playing && !still() && !holdTimer) {
      // No animation frames or repeated text rasterization while a name holds.
      holdStarted = performance.now();
      holdTimer = setTimeout(() => {
        holdTimer = 0; holdRemaining = 0;
        if (active()) change((target + 1) % names.length);
      }, holdRemaining);
    }
  }
  function change(index, immediate = false) {
    stop();
    target = index; progress = 0;
    origin = particles.map(point => ({ ...point }));
    moving = !immediate;
    if (immediate) particles = shapes[index].map(point => ({ ...point }));
    holdRemaining = holdDuration;
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (!headerMark) canvas.setAttribute('aria-label', `ascii calligraphy: ${names[index]}`);
    canvas.dataset.name = names[target];
    canvas.dataset.phase = moving ? 'morphing' : 'holding';
    dirty = true; schedule();
  }
  function tick(now) {
    frame = 0;
    if (!active() || !moving) { last = 0; return; }
    if (last) progress += Math.min(50, now - last);
    last = now;
    const interval = 1000 / (mobile() ? (runtime?.low ? 20 : 30) : 60);
    const t = Math.min(1, progress / duration);
    if (!lastPaint || now - lastPaint >= interval - 1 || t === 1) {
      const eased = t * t * t * (t * (t * 6 - 15) + 10), arc = Math.sin(Math.PI * t);
      particles.forEach((point, i) => {
        const from = origin[i], to = shapes[target][i];
        point.x = from.x + (to.x - from.x) * eased + Math.sin(i * 2.399) * arc * 9;
        point.y = from.y + (to.y - from.y) * eased - arc * (6 + i % 9);
        point.alpha = from.alpha + (to.alpha - from.alpha) * eased;
        point.width = from.width + (to.width - from.width) * eased;
        point.dot = eased < 0.5 ? from.dot : to.dot;
      });
      paint(); lastPaint = now;
    }
    if (t === 1) {
      moving = false; last = lastPaint = 0; holdRemaining = holdDuration;
      canvas.dataset.phase = 'holding';
    }
    schedule();
  }
  function setPlaying(value) {
    stop(); playing = value;
    if (!playing && moving) {
      particles = shapes[target].map(point => ({ ...point })); moving = false; dirty = true;
      canvas.dataset.phase = 'holding';
    }
    if (motion) motion.textContent = playing ? 'pause motion' : 'play motion';
    holdRemaining = holdDuration;
    schedule();
  }
  function updateColors() {
    if (headerMark) {
      const style = getComputedStyle(document.documentElement);
      const ink = style.getPropertyValue('--lake-ink').trim() || '#183b40';
      colors = [ink, ink, style.getPropertyValue('--lake-accent').trim() || ink, ink];
    }
    dirty = true;
    if (active()) paint();
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    if (ready) change(Number(button.dataset.name), still() || !playing);
  }));
  motion?.addEventListener('click', () => setPlaying(!playing));
  const profileChanged = () => { if (ready) { setPlaying(!still()); fit(); } };
  if (runtime) runtime.subscribe(profileChanged);
  else reduced.addEventListener('change', profileChanged);
  document.addEventListener('visibilitychange', () => { stop(); if (active()) schedule(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => { dirty = true; fit(); schedule(); });
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer); resizeTimer = setTimeout(fit, 150);
  }, { passive: true });
  window.addEventListener('portfolio:themechange', updateColors);
  updateColors();
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting; stop(); if (onScreen) schedule();
    }).observe(canvas);
  }
  async function initialize() {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(shapeURL, { signal: controller.signal });
      if (!response.ok) throw new Error('Name shape data unavailable');
      const data = await response.json();
      if (data.version !== 1 || data.width !== W || data.height !== H || !Number.isInteger(data.count) || data.count < 1 || data.count > 2000 ||
          data.names?.join('|') !== names.join('|') || data.dots?.length !== names.length || data.shapes?.length !== names.length || !data.shapes.every(shape => shape.length === data.count && shape.every(point => point.length === 5 && point.every(Number.isFinite)))) {
        throw new Error('Invalid name shape data');
      }
      shapes = data.shapes.map(shape => shape.map(([x, y, alpha, dot, width]) => ({ x, y, alpha, dot: Boolean(dot), width })));
      particles = shapes[0].map(point => ({ ...point }));
      ready = true;
      fit(); updateColors(); paint();
      const fallback = headerMark ? headerMark.parentElement.querySelector('.name-mark-fallback') : document.querySelector('#fallback');
      if (fallback) fallback.hidden = true;
      if (headerMark) headerMark.parentElement.classList.add('is-ready');
      if (motion) motion.disabled = false;
      canvas.dataset.particles = String(data.count);
      canvas.dataset.dots = data.dots.join(',');
      canvas.dataset.style = 'jali-thuluth';
      canvas.dataset.name = names[0]; canvas.dataset.phase = 'holding';
      schedule();
    } catch {
      disposed = true; stop();
      if (motion) motion.textContent = 'static preview';
      if (!headerMark) canvas.setAttribute('aria-label', 'محمد');
    } finally { clearTimeout(timeout); }
  }
  if (runtime) runtime.enqueue(initialize);
  else requestAnimationFrame(() => setTimeout(initialize, 0));
})();
