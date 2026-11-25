(() => {
  'use strict';
  const names = ['محمد', 'ماحي', 'علي', 'مكاتي'];
  const silhouettes = ['muhammad-v2', 'mahi-v2', 'ali', 'mukati-v2'];
  const headerMark = document.querySelector('[data-name-mark]');
  const canvas = document.querySelector('#name-art') || headerMark;
  if (!canvas) return;
  const icon = document.querySelector('#name-icon');
  const surfaces = [canvas, icon].filter(Boolean);
  const assetBase = new URL('jali-thuluth/', document.currentScript.src);
  const motion = document.querySelector('#motion');
  const buttons = [...document.querySelectorAll('[data-name]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const contexts = surfaces.map(surface => surface.getContext('2d'));
  if (contexts.some(context => !context)) return;
  const W = 512, H = 300;
  const glyphs = [...'+:*#=.'];
  let colors = ['#fffef9', '#e6e1d7', '#b6ced0', '#91c7ca'];
  let onScreen = true;
  let shapes = [], particles = [], origin = [], target = 0;
  let playing = !reducedMotion.matches, moving = false, ready = false;
  let clock = 0, last = 0, start = 0, next = 2100, frame = 0;
  const duration = 1650;

  // Spatial ordering keeps nearby pieces of each word together as it changes.
  function morton(x, y) {
    let code = 0;
    for (let bit = 0; bit < 8; bit++) code |= ((x >> bit) & 1) << (2 * bit) | ((y >> bit) & 1) << (2 * bit + 1);
    return code;
  }

  function sampleWord(image) {
    // Individually composed Jali Thuluth silhouettes supply the letter geometry.
    // Find the ink bounds so all four emblems have the same optical footprint.
    const source = document.createElement('canvas');
    source.width = source.height = 512;
    const sourceContext = source.getContext('2d', { willReadFrequently: true });
    sourceContext.drawImage(image, 0, 0, 512, 512);
    const sourcePixels = sourceContext.getImageData(0, 0, 512, 512).data;
    let left = 512, top = 512, right = 0, bottom = 0;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        if (sourcePixels[(y * 512 + x) * 4 + 3] > 64) {
          left = Math.min(left, x); right = Math.max(right, x);
          top = Math.min(top, y); bottom = Math.max(bottom, y);
        }
      }
    }
    const sw = right - left + 1, sh = bottom - top + 1;
    if (sw <= 0 || sh <= 0) throw new Error('Empty calligraphy silhouette');
    const mask = document.createElement('canvas');
    mask.width = W; mask.height = H;
    const ctx = mask.getContext('2d', { willReadFrequently: true });
    const scale = Math.min(365 / sw, 236 / sh);
    ctx.drawImage(source, left, top, sw, sh, (W - sw * scale) / 2, (H - sh * scale) / 2, sw * scale, sh * scale);
    const pixels = ctx.getImageData(0, 0, W, H).data;
    // Sample detached letter dots at their own centers: a coarse grid can miss
    // one dot or turn a pair into an ambiguous clump of characters.
    const labels = new Uint16Array(W * H), components = [];
    const stack = new Int32Array(W * H);
    for (let seed = 0; seed < labels.length; seed++) {
      if (labels[seed] || pixels[seed * 4 + 3] <= 64) continue;
      const id = components.length + 1;
      let pending = 1, area = 0, sumX = 0, sumY = 0;
      let minX = W, maxX = 0, minY = H, maxY = 0;
      stack[0] = seed; labels[seed] = id;
      while (pending) {
        const p = stack[--pending], x = p % W, y = Math.floor(p / W);
        area++; sumX += x; sumY += y;
        minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, neighbor = ny * W + nx;
          if (nx < 0 || nx >= W || ny < 0 || ny >= H || labels[neighbor] || pixels[neighbor * 4 + 3] <= 64) continue;
          labels[neighbor] = id; stack[pending++] = neighbor;
        }
      }
      components.push({ id, x: sumX / area, y: sumY / area,
        left: minX, right: maxX, top: minY, bottom: maxY,
        width: maxX - minX, height: maxY - minY,
        dot: area >= 8 && area <= 800 && maxX - minX <= 56 && maxY - minY <= 30 });
    }
    const dotComponents = components.filter(component => component.dot);
    const dotIDs = new Set(dotComponents.map(dot => dot.id));
    const dots = dotComponents.flatMap(component => {
      if (component.width <= component.height * 1.35) return [component];
      // A pair of diamond dots may touch at one corner in the silhouette.
      const halves = [{ x: 0, y: 0, count: 0 }, { x: 0, y: 0, count: 0 }];
      const middle = (component.left + component.right) / 2;
      for (let y = component.top; y <= component.bottom; y++) {
        for (let x = component.left; x <= component.right; x++) {
          if (labels[y * W + x] !== component.id) continue;
          const half = halves[x <= middle ? 0 : 1];
          half.x += x; half.y += y; half.count++;
        }
      }
      return halves.filter(half => half.count).map(half => ({ x: half.x / half.count, y: half.y / half.count }));
    });
    let alif = null;
    if (image.src.endsWith('/mahi-v2.png')) {
      const stem = components.reduce((highest, part) => part.top < highest.top ? part : highest);
      const row = Math.round(stem.top + stem.height * 0.2);
      let sum = 0, count = 0;
      for (let x = stem.left; x <= stem.right; x++) {
        if (labels[row * W + x] === stem.id) { sum += x; count++; }
      }
      if (count) alif = { x: sum / count, bottom: stem.top + stem.height * 0.88 };
    }
    const points = [];
    const spacing = 10;
    for (let y = 2; y < H; y += spacing) {
      for (let x = 2; x < W; x += spacing) {
        const coverage = pixels[(y * W + x) * 4 + 3] / 255;
        if (coverage > 0.25 && !dotIDs.has(labels[y * W + x])) points.push({ x, y, alpha: coverage, dot: false,
          width: alif && y < alif.bottom && Math.abs(x - alif.x) < 12 ? 1.35 : 1,
          order: morton(x / spacing, y / spacing) });
      }
    }
    for (const dot of dots) points.push({ x: dot.x, y: dot.y, alpha: 1, dot: true, width: 1, order: morton(dot.x / spacing, dot.y / spacing) });
    return points.sort((a, b) => a.order - b.order);
  }

  function fit() {
    for (const [index, surface] of surfaces.entries()) {
      const box = surface.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      surface.width = Math.round(box.width * dpr); surface.height = Math.round(box.height * dpr);
      contexts[index].setTransform(surface.width / W, 0, 0, surface.height / H, 0, 0);
      if (headerMark) {
        contexts[index].translate(W / 2, H / 2);
        contexts[index].scale(1.12, 1.12);
        contexts[index].translate(-W / 2, -H / 2);
      }
    }
    if (ready) paint();
  }

  function paint() {
    for (const ctx of contexts) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); ctx.restore();
      ctx.font = '400 16px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      particles.forEach((point, index) => {
        ctx.fillStyle = point.dot ? colors[0] : colors[index % colors.length];
        ctx.globalAlpha = point.alpha;
        if (point.dot) {
          // A compact four-character diamond keeps each dot substantial while
          // leaving clear space between the two dots in a pair.
          ctx.font = '400 11px ui-monospace, Menlo, Consolas, monospace';
          ctx.fillText('+', point.x, point.y - 5);
          ctx.fillText('#', point.x - 3.8, point.y);
          ctx.fillText('#', point.x + 3.8, point.y);
          ctx.fillText('+', point.x, point.y + 5);
          ctx.font = '400 16px ui-monospace, Menlo, Consolas, monospace';
        } else {
          ctx.save();
          ctx.translate(point.x, point.y); ctx.scale(point.width, 1);
          ctx.fillText(glyphs[index % glyphs.length], 0, 0);
          ctx.restore();
        }
      });
      ctx.globalAlpha = 1;
    }
    canvas.dataset.name = names[target];
    canvas.dataset.phase = moving ? 'morphing' : 'holding';
  }

  function change(index, immediate = false) {
    target = index; start = clock;
    origin = particles.map(point => ({ ...point }));
    moving = !immediate;
    if (immediate) particles = shapes[index].map(point => ({ ...point }));
    buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
    if (!headerMark) canvas.setAttribute('aria-label', `ascii calligraphy: ${names[index]}`);
    next = clock + duration + 2400;
    paint(); schedule();
  }

  function tick(now) {
    frame = 0;
    if (document.hidden || !onScreen || !ready) { last = 0; return; }
    if (last) clock += Math.min(50, now - last);
    last = now;
    if (moving) {
      const t = Math.min(1, (clock - start) / duration);
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      const arc = Math.sin(Math.PI * t);
      particles.forEach((point, i) => {
        const from = origin[i], to = shapes[target][i];
        // A restrained arc makes the characters flow instead of dissolving.
        point.x = from.x + (to.x - from.x) * eased + Math.sin(i * 2.399) * arc * 9;
        point.y = from.y + (to.y - from.y) * eased - arc * (6 + i % 9);
        point.alpha = from.alpha + (to.alpha - from.alpha) * eased;
        point.width = from.width + (to.width - from.width) * eased;
        point.dot = eased < 0.5 ? from.dot : to.dot;
      });
      if (t === 1) moving = false;
    }
    if (playing && !moving && clock >= next) change((target + 1) % names.length);
    paint();
    if (playing || moving) schedule();
    else last = 0;
  }

  function schedule() {
    if (!frame && ready && onScreen && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function setPlaying(value) {
    playing = value;
    if (!playing && moving) {
      particles = shapes[target].map(point => ({ ...point })); moving = false;
    }
    if (motion) motion.textContent = playing ? 'pause motion' : 'play motion';
    last = 0; next = clock + 2400;
    paint(); schedule();
  }

  buttons.forEach(button => button.addEventListener('click', () => {
    if (ready) change(Number(button.dataset.name), reducedMotion.matches || !playing);
  }));
  motion?.addEventListener('click', () => setPlaying(!playing));
  reducedMotion.addEventListener('change', () => { if (ready) setPlaying(!reducedMotion.matches); });
  document.addEventListener('visibilitychange', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
    if (!document.hidden) schedule();
  });
  window.addEventListener('resize', fit, { passive: true });
  function updateColors() {
    if (!headerMark) return;
    const style = getComputedStyle(document.documentElement);
    const ink = style.getPropertyValue('--lake-ink').trim() || '#183b40';
    const accent = style.getPropertyValue('--lake-accent').trim() || ink;
    colors = [ink, ink, accent, ink];
    if (ready) paint();
  }
  updateColors();
  window.addEventListener('portfolio:themechange', updateColors);
  if (headerMark && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      onScreen = entry.isIntersecting;
      if (frame) cancelAnimationFrame(frame);
      frame = 0; last = 0;
      if (onScreen) schedule();
    }).observe(headerMark);
  }
  Promise.all(silhouettes.map(async name => {
    const image = new Image();
    image.src = new URL(`${name}.png`, assetBase).href;
    await image.decode();
    return image;
  })).then(images => {
    const sampled = images.map(sampleWord);
    const count = Math.max(...sampled.map(points => points.length));
    if (!count || sampled.some(points => !points.length)) throw new Error('Empty glyph mask');
    shapes = sampled.map(points => {
      const uses = new Uint16Array(points.length);
      for (let i = 0; i < count; i++) uses[Math.floor(i * points.length / count)]++;
      return Array.from({ length: count }, (_, i) => {
        const index = Math.floor(i * points.length / count), point = points[index];
        return { x: point.x, y: point.y, alpha: point.alpha / uses[index], dot: point.dot, width: point.width };
      });
    });
    particles = shapes[0].map(point => ({ ...point }));
    ready = true;
    if (motion) motion.disabled = false;
    const fallback = headerMark ? headerMark.parentElement.querySelector('.name-mark-fallback') : document.querySelector('#fallback');
    if (fallback) fallback.hidden = true;
    if (headerMark) headerMark.parentElement.classList.add('is-ready');
    canvas.dataset.particles = String(count);
    canvas.dataset.dots = sampled.map(points => points.filter(point => point.dot).length).join(',');
    canvas.dataset.style = 'jali-thuluth';
    fit(); setPlaying(playing);
  }).catch(() => {
    if (motion) motion.textContent = 'static preview';
    if (!headerMark) canvas.setAttribute('aria-label', 'محمد');
  });
})();
