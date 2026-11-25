(() => {
  'use strict';

  const canvas = document.querySelector('#scroll-letters');
  const main = canvas?.closest('main.home-journey');
  const story = main?.querySelector('.home-story');
  const scene = main?.querySelector('.lake-scene');
  const photograph = scene?.querySelector('.lake-fallback');
  const context = canvas?.getContext('2d', { alpha: true });
  if (!canvas || !main || !story || !scene || !photograph || !context) return;

  const letters = [...'ابتٹثجچحخدڈرڑزژسشصضطظعغفقکگلمنںوہھیے'];
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const atlas = document.createElement('canvas');
  const atlasContext = atlas.getContext('2d');
  if (!atlasContext) return;
  const atlasColumns = 8, glyphRows = Math.ceil(letters.length / atlasColumns);
  const tile = 26, fontSize = 13, atlasScale = 2;
  const flickerFraction = 0.01;
  let palette = [], paletteRGB = [], points = [], copyBounds = [], sourcePhoto;
  let width = 0, height = 0, sceneTop = 0, sceneHeight = 0, mainTop = 0, mainLeft = 0, fieldEnd = 0;
  let frame = 0, layoutDirty = true, clearAll = true, ready = false;
  let elapsed = 0, lastTime = 0, lastDraw = 0, frames = 0;
  const pointer = { active: false, x: 0, y: 0, time: 0 };
  const wake = [];
  let settlingUntil = 0;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smoothstep = (low, high, value) => {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const randomAt = (index, salt) => {
    let seed = Math.imul(index + 1, 374761393) + Math.imul(salt, 668265263);
    seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
    return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
  };

  async function samplePalette() {
    const photo = new Image();
    photo.src = photograph.currentSrc || photograph.src;
    if (photo.decode) await photo.decode();
    else await new Promise((resolve, reject) => { photo.onload = resolve; photo.onerror = reject; });
    sourcePhoto = photo;
    const sample = document.createElement('canvas');
    sample.width = sample.height = 96;
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) throw new Error('Photo sampling is unavailable.');
    sampleContext.drawImage(photo, 0, 0, 96, 96);
    const pixels = sampleContext.getImageData(0, 0, 96, 96).data;
    const bins = new Map();
    for (let p = 0; p < pixels.length; p += 4) {
      const key = `${Math.floor(pixels[p] / 24)},${Math.floor(pixels[p + 1] / 24)},${Math.floor(pixels[p + 2] / 24)}`;
      const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bin.count++; bin.r += pixels[p]; bin.g += pixels[p + 1]; bin.b += pixels[p + 2];
      bins.set(key, bin);
    }
    const colors = [...bins.values()].filter(bin => bin.count > 2).map(bin => ({
      count: bin.count,
      rgb: [Math.round(bin.r / bin.count), Math.round(bin.g / bin.count), Math.round(bin.b / bin.count)],
    })).sort((a, b) => b.count - a.count);
    const luminance = color => color.rgb[0] * 0.2126 + color.rgb[1] * 0.7152 + color.rgb[2] * 0.0722;
    const byLight = [...colors].sort((a, b) => luminance(a) - luminance(b));
    // Include snow and forest shadows, then the most common distinct lake,
    // mountain, and tree colors. Every RGB value comes from the photograph.
    const selected = [byLight[0], byLight[byLight.length - 1]];
    for (const color of colors) {
      if (selected.length >= 16) break;
      if (selected.every(other => Math.hypot(...color.rgb.map((value, axis) => value - other.rgb[axis])) > 32)) selected.push(color);
    }
    paletteRGB = selected.map(color => color.rgb);
    palette = paletteRGB.map(rgb => `rgb(${rgb.join(',')})`);
    canvas.dataset.palette = String(palette.length);
  }

  function buildAtlas() {
    atlas.width = atlasColumns * tile * atlasScale;
    atlas.height = glyphRows * palette.length * 2 * tile * atlasScale;
    atlasContext.setTransform(atlasScale, 0, 0, atlasScale, 0, 0);
    atlasContext.font = `${fontSize}px "Noto Nastaliq Urdu", serif`;
    atlasContext.textAlign = 'center';
    atlasContext.textBaseline = 'alphabetic';
    for (let color = 0; color < palette.length * 2; color++) {
      const baseColor = color % palette.length;
      atlasContext.fillStyle = color < palette.length ? palette[baseColor]
        : `rgb(${paletteRGB[baseColor].map(value => Math.round(value + (255 - value) * 0.65)).join(',')})`;
      for (let glyph = 0; glyph < letters.length; glyph++) {
        const metrics = atlasContext.measureText(letters[glyph]);
        const baseline = ((metrics.actualBoundingBoxAscent || fontSize) - (metrics.actualBoundingBoxDescent || 0)) / 2;
        atlasContext.fillText(letters[glyph], (glyph % atlasColumns + 0.5) * tile,
          (color * glyphRows + Math.floor(glyph / atlasColumns) + 0.5) * tile + baseline);
      }
    }
  }

  function sourceColors() {
    // Use the artwork's crop so letters lift out in the color beneath them.
    const sample = document.createElement('canvas');
    sample.width = 120; sample.height = Math.max(1, Math.round(120 * sceneHeight / width));
    const sampleContext = sample.getContext('2d', { willReadFrequently: true });
    if (!sampleContext) return () => 0;
    let sw = sourcePhoto.naturalWidth, sh = sourcePhoto.naturalHeight;
    if (sw / sh > width / sceneHeight) sw = sh * width / sceneHeight;
    else sh = sw * sceneHeight / width;
    sampleContext.drawImage(sourcePhoto, (sourcePhoto.naturalWidth - sw) * 0.46,
      (sourcePhoto.naturalHeight - sh) * 0.44, sw, sh, 0, 0, sample.width, sample.height);
    const pixels = sampleContext.getImageData(0, 0, sample.width, sample.height).data;
    return (x, y) => {
      const px = clamp(Math.floor(x / width * sample.width), 0, sample.width - 1);
      const py = clamp(Math.floor((y - sceneTop) / sceneHeight * sample.height), 0, sample.height - 1);
      const p = (py * sample.width + px) * 4;
      let closest = 0, distance = Infinity;
      paletteRGB.forEach((rgb, index) => {
        const difference = rgb.reduce((sum, value, axis) => sum + (value - pixels[p + axis]) ** 2, 0);
        if (difference < distance) { closest = index; distance = difference; }
      });
      return closest;
    };
  }

  function measure() {
    const box = main.getBoundingClientRect(), sceneBox = scene.getBoundingClientRect();
    width = Math.max(1, Math.round(box.width));
    height = Math.max(1, Math.ceil(main.scrollHeight));
    mainTop = box.top + window.scrollY;
    mainLeft = box.left;
    sceneTop = Math.max(1, sceneBox.top - box.top);
    sceneHeight = Math.max(1, sceneBox.height);
    fieldEnd = Math.min(height, sceneTop + sceneHeight * 0.42);
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    canvas.width = Math.ceil(width * dpr); canvas.height = Math.ceil(height * dpr);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    copyBounds = [];
    for (const panel of story.querySelectorAll('.home-greeting, .home-current')) {
      const blocks = panel.querySelectorAll('h1, h2, h3, p, li, .photo-stack-caption');
      for (const block of blocks.length ? blocks : [panel]) {
        if (!block.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(block);
        // Reserve the caption row so changing slides keeps every caption clear.
        const text = block.matches('.photo-stack-caption')
          ? block.getBoundingClientRect() : range.getBoundingClientRect();
        if (text.width && text.height) copyBounds.push({
          left: text.left - box.left - 24, right: text.right - box.left + 24,
          top: text.top - box.top - 20, bottom: text.bottom - box.top + 20,
        });
      }
    }
    const mobile = sceneBox.width < 640;
    const columns = Math.max(64, Math.round(Math.sqrt((mobile ? 13000 : 40000) * sceneBox.width / sceneHeight)));
    const spriteSize = tile * (sceneBox.width / columns) / 7.1 * (mobile ? 1.04 : 1.08);
    // Keep the traveling population proportional to page area. A fixed cap
    // diluted the upper page as new sections lengthened each letter's journey.
    // Offscreen points still skip drawing and mouse simulation in draw().
    const count = Math.round(1.4 * Math.max(width * fieldEnd / (mobile ? 400 : 700), mobile ? 900 : 1400));
    const liftCount = Math.round(1.4 * clamp(width * sceneHeight / (mobile ? 135 : 115), mobile ? 1600 : 2800, mobile ? 2600 : 6200));
    const colorAt = sourceColors();
    points = [];
    for (let index = 0; index < count + liftCount; index++) {
      const lifting = index >= count;
      const x = (0.015 + randomAt(index, 3) * 0.97) * width;
      const startY = sceneTop + sceneHeight * (lifting ? 0.12 + randomAt(index, 1) * 0.24 : 0.015 + randomAt(index, 1) * 0.3);
      // Give a stable minority a full-page journey, fading above the opening
      // instead of moving their fade-out farther down when the page grows.
      // The rest still disappear at varied heights, with a dense lift at the lake.
      const reachesTop = !lifting && randomAt(index, 15) < 0.32;
      const endY = (lifting ? sceneTop - 35 - Math.pow(randomAt(index, 2), 1.6) * Math.min(440, sceneTop * 0.48)
        : reachesTop ? -80 - randomAt(index, 16) * 200
          : sceneTop * (0.025 + 0.86 * Math.pow(randomAt(index, 2), 0.48)))
        - (reachesTop ? 0 : Math.min(100, sceneTop * 0.1));
      points.push({
        x, lifting,
        startY, endY, distance: startY - endY,
        speed: 8 + randomAt(index, 4) * 8,
        age: randomAt(index, 5),
        phase: randomAt(index, 6) * Math.PI * 2,
        sway: 2 + randomAt(index, 7) * 5,
        glyph: Math.floor(randomAt(index, 8) * letters.length),
        color: lifting ? colorAt(x, startY) : Math.floor(randomAt(index, 9) * palette.length),
        size: spriteSize * (0.85 + randomAt(index, 10) * 0.3),
        alpha: (lifting ? 0.46 : 0.35) + randomAt(index, 11) * 0.3,
        flickers: randomAt(index, 14) < flickerFraction,
        flickerPeriod: 0.85 + randomAt(index, 12) * 0.55,
        flickerPhase: randomAt(index, 13),
        ox: 0, oy: 0, vx: 0, vy: 0, traveled: 0,
      });
    }
    resetPointer();
    canvas.dataset.count = String(points.length);
    canvas.dataset.flickerPopulation = String(points.filter(point => point.flickers).length);
    canvas.dataset.lifting = String(liftCount);
    canvas.dataset.size = spriteSize.toFixed(2);
    layoutDirty = false; clearAll = true;
  }

  function resetPointer() {
    pointer.active = false; pointer.time = 0; wake.length = 0;
  }

  function movePointer(event) {
    if (!ready || motionPreference.matches || event.pointerType === 'touch') return;
    const x = event.clientX - mainLeft, y = event.clientY + window.scrollY - mainTop;
    if (x < 0 || x > width || y < 0 || y > fieldEnd) { resetPointer(); return; }
    const now = performance.now();
    if (pointer.active) {
      const last = wake[wake.length - 1];
      // Coalesce only within a frame, retaining the start of each swept segment.
      const segment = last && now - last.start < 16 ? last
        : { ax: pointer.x, ay: pointer.y, bx: x, by: y, start: pointer.time, time: now };
      segment.bx = x; segment.by = y; segment.time = now;
      if (segment !== last) wake.push(segment);
      if (wake.length > 32) wake.shift();
    }
    pointer.x = x; pointer.y = y; pointer.time = now; pointer.active = true;
    settlingUntil = now + 1800;
    schedule();
  }

  function breeze(point, x, y, dt, now) {
    if (motionPreference.matches) { point.ox = point.oy = point.vx = point.vy = 0; return; }
    const radius = width < 640 ? 100 : 120;
    const nearby = pointer.active && Math.abs(x - pointer.x) < radius && Math.abs(y - pointer.y) < radius;
    if (!nearby && !wake.length && Math.abs(point.ox) + Math.abs(point.oy) + Math.abs(point.vx) + Math.abs(point.vy) < 0.02) {
      point.ox = point.oy = point.vx = point.vy = 0; return;
    }
    let targetX = 0, targetY = 0, strongest = 0;
    const influence = (cx, cy, weight, sweepX = 0, sweepY = 0) => {
      const dx = x - cx, dy = y - cy;
      if (Math.abs(dx) > radius || Math.abs(dy) > radius) return;
      const distance = Math.hypot(dx, dy);
      const strength = Math.max(0, 1 - distance / radius) ** 2 * weight;
      if (strength <= strongest) return;
      strongest = strength;
      targetX = (dx / Math.max(1, distance) * 22 + sweepX * 15) * strength;
      targetY = (dy / Math.max(1, distance) * 22 + sweepY * 15) * strength;
    };
    if (pointer.active) influence(pointer.x, pointer.y, 0.7);
    for (const segment of wake) {
      if (x < Math.min(segment.ax, segment.bx) - radius || x > Math.max(segment.ax, segment.bx) + radius ||
          y < Math.min(segment.ay, segment.by) - radius || y > Math.max(segment.ay, segment.by) + radius) continue;
      const dx = segment.bx - segment.ax, dy = segment.by - segment.ay;
      const lengthSquared = dx * dx + dy * dy;
      const along = lengthSquared ? clamp(((x - segment.ax) * dx + (y - segment.ay) * dy) / lengthSquared, 0, 1) : 0;
      const length = Math.max(1, Math.sqrt(lengthSquared));
      const age = (now - segment.time) / 1000;
      const strength = Math.exp(-age / 0.28) * (1 - smoothstep(0.35, 0.65, age));
      const speed = Math.min(1, length / Math.max(1, segment.time - segment.start) / 0.7);
      influence(segment.ax + along * dx, segment.ay + along * dy, strength, dx / length * speed, dy / length * speed);
    }
    // A damped spring carries the wake gently back into the upward flow.
    const steps = Math.max(1, Math.ceil(dt * 60)), step = dt / steps;
    for (let i = 0; i < steps; i++) {
      point.vx += ((targetX - point.ox) * 42 - point.vx * 13) * step;
      point.vy += ((targetY - point.oy) * 42 - point.vy * 13) * step;
      point.ox += point.vx * step; point.oy += point.vy * step;
    }
  }

  function draw(now) {
    if (layoutDirty) measure();
    const dt = lastDraw ? Math.min(0.05, (now - lastDraw) / 1000) : 1 / 60;
    while (wake.length && now - wake[0].time > 650) wake.shift();
    const viewportTop = window.scrollY - mainTop;
    const top = clamp(viewportTop - 48, 0, height);
    const bottom = clamp(viewportTop + window.innerHeight + 48, 0, height);
    const progress = clamp(window.scrollY / Math.max(1, mainTop + sceneTop - window.innerHeight * 0.7), 0, 1);
    if (clearAll) { context.clearRect(0, 0, width, height); clearAll = false; }
    else context.clearRect(0, top, width, Math.max(0, bottom - top));
    context.save();
    context.beginPath(); context.rect(0, top, width, Math.max(0, bottom - top)); context.clip();
    let visible = 0, flickering = 0, displacement = 0;
    for (const point of points) {
      const traveled = (point.age * point.distance + elapsed * point.speed) % point.distance;
      const baseY = point.startY - traveled;
      if (traveled < point.traveled) point.ox = point.oy = point.vx = point.vy = 0;
      point.traveled = traveled;
      if (baseY + point.size + 40 < top || baseY - point.size - 40 > bottom || baseY > fieldEnd) {
        point.ox = point.oy = point.vx = point.vy = 0; continue;
      }
      const baseX = point.x + Math.sin(elapsed * 0.18 + point.phase) * point.sway;
      breeze(point, baseX, baseY, dt, now);
      const x = baseX + point.ox, y = baseY + point.oy;
      displacement = Math.max(displacement, Math.hypot(point.ox, point.oy));
      const fadeIn = smoothstep(0, Math.min(85, point.distance * 0.15), traveled);
      const fadeOut = smoothstep(0, Math.min(150, point.distance * 0.22), baseY - point.endY);
      const merge = 1 - smoothstep(sceneTop + sceneHeight * (point.lifting ? 0.13 : 0.035), fieldEnd, baseY);
      let protection = 1;
      // Evaluate protection at each moving position, not at its spawn point.
      for (const bounds of copyBounds) {
        const dx = Math.max(bounds.left - x, 0, x - bounds.right);
        const dy = Math.max(bounds.top - y, 0, y - bounds.bottom);
        protection = Math.min(protection, 0.025 + 0.975 * smoothstep(0, 60, Math.hypot(dx, dy)));
      }
      const reveal = motionPreference.matches ? 1 : 0.78 + progress * 0.22;
      const alpha = point.alpha * fadeIn * fadeOut * merge * protection * reveal;
      if (alpha < 0.008) continue;
      // A fixed 1% subset keeps flickering for its entire journey. Its normal
      // fade envelope still controls both the base glyph and the light pulse.
      let flicker = 0;
      if (!motionPreference.matches && point.flickers) {
        const t = (elapsed / point.flickerPeriod + point.flickerPhase) % 1;
        const pulse = (start, end) => t > start && t < end
          ? Math.sin(Math.PI * (t - start) / (end - start)) ** 2 : 0;
        flicker = -0.8 * pulse(0, 0.22) + pulse(0.16, 0.48)
          - 0.55 * pulse(0.43, 0.64) + 0.85 * pulse(0.59, 1);
        flickering++;
      }
      context.globalAlpha = alpha * (1 + Math.min(0, flicker));
      context.drawImage(atlas,
        point.glyph % atlasColumns * tile * atlasScale,
        (point.color * glyphRows + Math.floor(point.glyph / atlasColumns)) * tile * atlasScale,
        tile * atlasScale, tile * atlasScale,
        x - point.size / 2, y - point.size / 2, point.size, point.size);
      if (flicker > 0) {
        context.globalAlpha = Math.min(1, alpha * flicker * 1.3);
        context.drawImage(atlas,
          point.glyph % atlasColumns * tile * atlasScale,
          ((point.color + palette.length) * glyphRows + Math.floor(point.glyph / atlasColumns)) * tile * atlasScale,
          tile * atlasScale, tile * atlasScale,
          x - point.size / 2, y - point.size / 2, point.size, point.size);
      }
      visible++;
    }
    context.restore();
    canvas.dataset.flow = motionPreference.matches ? 'static' : 'upward';
    canvas.dataset.progress = motionPreference.matches ? 'static' : progress.toFixed(3);
    canvas.dataset.visible = String(visible);
    canvas.dataset.flickering = String(flickering);
    canvas.dataset.frame = String(++frames);
    canvas.dataset.breeze = motionPreference.matches ? 'static' : pointer.active || wake.length ? 'active' : displacement > 0.05 ? 'settling' : 'idle';
    canvas.dataset.displacement = displacement.toFixed(2);
    lastDraw = now;
  }

  function tick(now) {
    frame = 0;
    if (!ready || document.hidden) return;
    if (!motionPreference.matches && lastTime) elapsed += Math.min(0.12, (now - lastTime) / 1000);
    lastTime = now;
    const rate = pointer.active || now < settlingUntil ? 60 : 30;
    if (layoutDirty || clearAll || !lastDraw || now - lastDraw >= 1000 / rate - 1) draw(now);
    if (!motionPreference.matches) frame = requestAnimationFrame(tick);
  }
  function schedule(measureAgain = false) {
    layoutDirty = layoutDirty || measureAgain;
    // Static mode must still repaint the newly visible strip after scrolling.
    if (motionPreference.matches) clearAll = true;
    if (!frame && ready && !document.hidden) frame = requestAnimationFrame(tick);
  }
  window.addEventListener('pointermove', movePointer, { passive: true });
  document.addEventListener('pointerleave', resetPointer, { passive: true });
  window.addEventListener('pointercancel', resetPointer, { passive: true });
  window.addEventListener('blur', resetPointer);
  window.addEventListener('scroll', () => { resetPointer(); schedule(); }, { passive: true });
  window.addEventListener('resize', () => schedule(true), { passive: true });
  window.addEventListener('pageshow', () => { lastTime = 0; schedule(true); });
  window.addEventListener('portfolio:themechange', () => { clearAll = true; schedule(); });
  document.addEventListener('visibilitychange', () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastTime = 0; lastDraw = 0; resetPointer();
    if (!document.hidden) schedule(true);
  });
  const preferenceChanged = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; lastTime = 0; clearAll = true; resetPointer(); schedule();
  };
  if (motionPreference.addEventListener) motionPreference.addEventListener('change', preferenceChanged);
  else motionPreference.addListener(preferenceChanged);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(() => schedule(true));
    observer.observe(main); observer.observe(story); observer.observe(scene);
  }
  const font = document.fonts?.load('13px "Noto Nastaliq Urdu"', 'بہک') || Promise.resolve();
  Promise.all([font.catch(() => {}), samplePalette()]).then(() => {
    buildAtlas(); ready = true; schedule(true);
  }).catch(() => { canvas.dataset.flow = 'unavailable'; });
})();
