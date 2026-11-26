(() => {
  'use strict';
  // Phones use prepared artwork: do not create native canvas contexts or
  // rasterize thousands of complex glyphs during the initial page load.
  if (window.PortfolioMotion?.lightweight ??
      (matchMedia('(pointer: coarse)').matches || innerWidth < 768)) return;


  const canvas = document.querySelector('#scroll-letters');
  const main = canvas?.closest('main.home-journey');
  const story = main?.querySelector('.home-story');
  const scene = main?.querySelector('.lake-scene');
  if (!canvas || !main || !story || !scene) return;
  const paletteURL = new URL('lake-palette.json', document.currentScript.src);
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) return;

  const runtime = window.PortfolioMotion;
  const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
  const coarsePointer = matchMedia('(pointer: coarse)');
  const reduced = () => runtime ? runtime.reduced : motionPreference.matches;
  const mobile = () => runtime ? runtime.mobile : coarsePointer.matches || innerWidth < 768;
  const low = () => Boolean(runtime?.low);
  const debug = Boolean(runtime?.debug);
  const letters = [...'ابتٹثجچحخدڈرڑزژسشصضطظعغفقکگلمنںوہھیے'];
  const atlas = document.createElement('canvas');
  const atlasContext = atlas.getContext('2d');
  if (!atlasContext) return;
  const atlasColumns = 32, tile = 26, fontSize = 13;
  const bandHeight = 192, overscan = 48, flowSpeed = 12, boundsBandHeight = 256;
  let atlasScale = 0, palette = [], paletteRGB = [], sourceColorMap, sourceRatio = 1;
  let points = [], bandKeys = [], bandSlots = 0, bandCapacity = 0;
  let copyBands = new Map();
  let width = 0, pageHeight = 0, viewportHeight = 0, surfaceHeight = 0, dpr = 1;
  let sceneTop = 0, sceneHeight = 0, mainTop = 0, mainLeft = 0, fieldEnd = 0, spriteSize = 0;
  let frame = 0, resizeTimer = 0, layoutDirty = true, viewportDirty = true, profileDirty = true;
  let ready = false, failed = false, elapsed = 0, lastTime = 0, lastDraw = 0, lastMetricUpdate = 0;
  let frames = 0, needsDraw = true, settlingUntil = 0;
  const pointer = { active: false, x: 0, y: 0, time: 0 };
  const wake = [];

  const clamp = (value, lowValue, highValue) => Math.max(lowValue, Math.min(highValue, value));
  const smoothstep = (lowValue, highValue, value) => {
    const t = clamp((value - lowValue) / (highValue - lowValue), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const randomAt = (index, salt) => {
    let seed = Math.imul(index + 1, 374761393) + Math.imul(salt, 668265263);
    seed = Math.imul(seed ^ (seed >>> 13), 1274126177);
    return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
  };

  async function samplePalette() {
    const response = await fetch(paletteURL);
    if (!response.ok) throw new Error('The lake palette is unavailable.');
    const asset = await response.json();
    if (asset.version !== 1 || asset.width !== 96 || asset.height !== 96
      || !Array.isArray(asset.palette) || !asset.palette.length || asset.palette.length > 16
      || !Array.isArray(asset.indices) || asset.indices.length !== 96 * 96
      || !Number.isFinite(asset.sourceRatio) || asset.sourceRatio <= 0
      || asset.palette.some(rgb => !Array.isArray(rgb) || rgb.length !== 3 || rgb.some(value => !Number.isFinite(value) || value < 0 || value > 255))
      || asset.indices.some(index => !Number.isInteger(index) || index < 0 || index >= asset.palette.length)) {
      throw new Error('The lake palette is invalid.');
    }
    sourceRatio = asset.sourceRatio;
    paletteRGB = asset.palette;
    palette = paletteRGB.map(rgb => `rgb(${rgb.join(',')})`);
    // Generated from the lake photograph: no full image decode or readback at startup.
    sourceColorMap = Uint8Array.from(asset.indices);
  }

  function colorAt(x, y) {
    const ratio = width / sceneHeight;
    const cropWidth = sourceRatio > ratio ? ratio / sourceRatio : 1;
    const cropHeight = sourceRatio > ratio ? 1 : sourceRatio / ratio;
    const u = (1 - cropWidth) * 0.46 + clamp(x / width, 0, 1) * cropWidth;
    const v = (1 - cropHeight) * 0.44 + clamp((y - sceneTop) / sceneHeight, 0, 1) * cropHeight;
    return sourceColorMap[clamp(Math.floor(v * 96), 0, 95) * 96 + clamp(Math.floor(u * 96), 0, 95)];
  }

  function buildAtlas() {
    const nextScale = mobile() ? 1 : 2;
    if (atlasScale === nextScale) return;
    atlasScale = nextScale;
    const count = letters.length * palette.length * 2;
    atlas.width = atlasColumns * tile * atlasScale;
    atlas.height = Math.ceil(count / atlasColumns) * tile * atlasScale;
    atlasContext.setTransform(atlasScale, 0, 0, atlasScale, 0, 0);
    atlasContext.font = `${fontSize}px "Noto Nastaliq Urdu", serif`;
    atlasContext.textAlign = 'center';
    atlasContext.textBaseline = 'alphabetic';
    for (let color = 0; color < palette.length * 2; color++) {
      const baseColor = color % palette.length;
      atlasContext.fillStyle = color < palette.length ? palette[baseColor]
        : `rgb(${paletteRGB[baseColor].map(value => Math.round(value + (255 - value) * 0.65)).join(',')})`;
      for (let glyph = 0; glyph < letters.length; glyph++) {
        const index = color * letters.length + glyph;
        const metrics = atlasContext.measureText(letters[glyph]);
        const baseline = ((metrics.actualBoundingBoxAscent || fontSize) - (metrics.actualBoundingBoxDescent || 0)) / 2;
        atlasContext.fillText(letters[glyph], (index % atlasColumns + 0.5) * tile,
          (Math.floor(index / atlasColumns) + 0.5) * tile + baseline);
      }
    }
  }

  function fitViewport() {
    viewportHeight = Math.max(1, Math.ceil(innerHeight));
    // Quantizing the spare strip avoids reallocating on every mobile toolbar pixel.
    const nextHeight = Math.ceil(viewportHeight / 64) * 64;
    const nextDpr = Math.min(devicePixelRatio || 1, mobile() ? 1 : 1.5, 4096 / width, 4096 / nextHeight);
    const pixelWidth = Math.ceil(width * nextDpr), pixelHeight = Math.ceil(nextHeight * nextDpr);
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth; canvas.height = pixelHeight;
      context.setTransform(nextDpr, 0, 0, nextDpr, 0, 0);
    }
    if (surfaceHeight !== nextHeight) canvas.style.height = `${nextHeight}px`;
    surfaceHeight = nextHeight; dpr = nextDpr;
    const capacity = Math.ceil((surfaceHeight + overscan * 2) / bandHeight) + 2;
    const budget = mobile() ? low() ? 600 : 1200 : 5000;
    const slots = Math.max(1, Math.floor(budget / capacity));
    if (bandCapacity !== capacity || bandSlots !== slots || profileDirty) {
      bandCapacity = capacity; bandSlots = slots;
      const count = capacity * slots;
      if (points.length !== count) points = Array.from({ length: count }, () => ({}));
      bandKeys = new Array(capacity).fill(null);
    }
    viewportDirty = false;
  }

  function measure() {
    const box = main.getBoundingClientRect(), sceneBox = scene.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(box.width));
    const nextSceneTop = Math.max(1, sceneBox.top - box.top);
    const nextSceneHeight = Math.max(1, sceneBox.height);
    const geometryChanged = width !== nextWidth || sceneTop !== nextSceneTop || sceneHeight !== nextSceneHeight;
    width = nextWidth; pageHeight = Math.max(1, Math.ceil(main.scrollHeight));
    mainTop = box.top + scrollY; mainLeft = box.left;
    sceneTop = nextSceneTop; sceneHeight = nextSceneHeight;
    fieldEnd = Math.min(pageHeight, sceneTop + sceneHeight * 0.42);
    canvas.style.left = `${mainLeft}px`;
    canvas.style.width = `${width}px`;
    copyBands.clear();
    for (const panel of story.querySelectorAll('.home-greeting, .home-current')) {
      const blocks = panel.querySelectorAll('h1, h2, h3, p, li, .photo-stack-caption');
      for (const block of blocks.length ? blocks : [panel]) {
        if (!block.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(block);
        const text = block.matches('.photo-stack-caption') ? block.getBoundingClientRect() : range.getBoundingClientRect();
        if (!text.width || !text.height) continue;
        const bounds = { left: text.left - box.left - 24, right: text.right - box.left + 24,
          top: text.top - box.top - 20, bottom: text.bottom - box.top + 20 };
        for (let band = Math.floor((bounds.top - 60) / boundsBandHeight); band <= Math.floor((bounds.bottom + 60) / boundsBandHeight); band++) {
          if (!copyBands.has(band)) copyBands.set(band, []);
          copyBands.get(band).push(bounds);
        }
      }
    }
    const targetCount = mobile() ? low() ? 4000 : 8000 : 40000;
    const columns = Math.max(64, Math.round(Math.sqrt(targetCount * width / sceneHeight)));
    spriteSize = tile * (width / columns) / 7.1 * (mobile() ? 1.04 : 1.08);
    if (geometryChanged) { bandKeys.fill(null); resetPointer(); }
    layoutDirty = false;
    viewportDirty = true;
  }

  function populateBand(band, slot) {
    const offset = slot * bandSlots;
    for (let index = 0; index < bandSlots; index++) {
      const seed = Math.imul(band, 8191) + index;
      const point = points[offset + index];
      const lifting = randomAt(seed, 20) > 0.56;
      const x = (0.015 + randomAt(seed, 3) * 0.97) * width;
      const startY = sceneTop + sceneHeight * (lifting ? 0.12 + randomAt(seed, 1) * 0.24 : 0.015 + randomAt(seed, 1) * 0.3);
      const reachesTop = !lifting && randomAt(seed, 15) < 0.32;
      const endY = (lifting ? sceneTop - 35 - Math.pow(randomAt(seed, 2), 1.6) * Math.min(440, sceneTop * 0.48)
        : reachesTop ? -80 - randomAt(seed, 16) * 200
          : sceneTop * (0.025 + 0.86 * Math.pow(randomAt(seed, 2), 0.48)))
        - (reachesTop ? 0 : Math.min(100, sceneTop * 0.1));
      Object.assign(point, {
        x, lifting, startY, endY, distance: startY - endY,
        y: (band + randomAt(seed, 5)) * bandHeight,
        phase: randomAt(seed, 6) * Math.PI * 2, sway: 2 + randomAt(seed, 7) * 5,
        glyph: Math.floor(randomAt(seed, 8) * letters.length),
        color: lifting ? colorAt(x, startY) : Math.floor(randomAt(seed, 9) * palette.length),
        size: spriteSize * (0.85 + randomAt(seed, 10) * 0.3),
        alpha: (lifting ? 0.46 : 0.35) + randomAt(seed, 11) * 0.3,
        flickers: randomAt(seed, 14) < 0.05,
        flickerPeriod: 0.85 + randomAt(seed, 12) * 0.55,
        flickerPhase: randomAt(seed, 13), ox: 0, oy: 0, vx: 0, vy: 0,
      });
    }
    bandKeys[slot] = band;
  }

  function resetPointer() {
    pointer.active = false; pointer.time = 0; wake.length = 0;
  }

  function movePointer(event) {
    if (!ready || reduced() || event.pointerType === 'touch') return;
    const x = event.clientX - mainLeft, y = event.clientY + scrollY - mainTop;
    if (x < 0 || x > width || y < 0 || y > fieldEnd) { resetPointer(); return; }
    const now = performance.now();
    if (pointer.active) {
      const last = wake[wake.length - 1];
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
    if (reduced()) { point.ox = point.oy = point.vx = point.vy = 0; return; }
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
    const started = performance.now();
    if (layoutDirty) measure();
    if (profileDirty) buildAtlas();
    if (viewportDirty || profileDirty) fitViewport();
    profileDirty = false;
    const viewportTop = scrollY - mainTop;
    const top = Math.max(-overscan, viewportTop - overscan);
    const bottom = Math.min(fieldEnd + overscan, viewportTop + surfaceHeight + overscan);
    const dt = lastDraw ? Math.min(0.05, (now - lastDraw) / 1000) : 1 / 30;
    const drift = elapsed * flowSpeed;
    while (wake.length && now - wake[0].time > 650) wake.shift();
    context.clearRect(0, 0, width, surfaceHeight);
    context.save();
    context.translate(0, -viewportTop);
    const progress = clamp(scrollY / Math.max(1, mainTop + sceneTop - viewportHeight * 0.7), 0, 1);
    const reveal = reduced() ? 1 : 0.78 + progress * 0.22;
    let visible = 0, flickering = 0, displacement = 0;
    const firstBand = Math.floor((top + drift) / bandHeight);
    const lastBand = Math.floor((bottom + drift) / bandHeight);
    // Only bands touching this viewport are generated or visited. The same seed
    // describes the same letter after scrolling away and returning.
    for (let band = firstBand; band <= lastBand; band++) {
      const slot = ((band % bandCapacity) + bandCapacity) % bandCapacity;
      if (bandKeys[slot] !== band) populateBand(band, slot);
      const offset = slot * bandSlots;
      for (let index = 0; index < bandSlots; index++) {
        const point = points[offset + index];
        const baseY = point.y - drift;
        if (baseY < top - point.size || baseY > bottom + point.size || baseY > fieldEnd || baseY < point.endY || baseY > point.startY) {
          point.ox = point.oy = point.vx = point.vy = 0;
          continue;
        }
        const traveled = point.startY - baseY;
        const baseX = point.x + Math.sin(elapsed * 0.18 + point.phase) * point.sway;
        breeze(point, baseX, baseY, dt, now);
        const x = baseX + point.ox, y = baseY + point.oy;
        if (debug) displacement = Math.max(displacement, Math.hypot(point.ox, point.oy));
        const fadeIn = smoothstep(0, Math.min(85, point.distance * 0.15), traveled);
        const fadeOut = smoothstep(0, Math.min(150, point.distance * 0.22), baseY - point.endY);
        const merge = 1 - smoothstep(sceneTop + sceneHeight * (point.lifting ? 0.13 : 0.035), fieldEnd, baseY);
        let protection = 1;
        const nearbyBounds = copyBands.get(Math.floor(y / boundsBandHeight));
        if (nearbyBounds) for (const bounds of nearbyBounds) {
          const dx = Math.max(bounds.left - x, 0, x - bounds.right);
          const dy = Math.max(bounds.top - y, 0, y - bounds.bottom);
          if (dx > 60 || dy > 60) continue;
          protection = Math.min(protection, 0.025 + 0.975 * smoothstep(0, 60, Math.hypot(dx, dy)));
        }
        const alpha = point.alpha * fadeIn * fadeOut * merge * protection * reveal;
        if (alpha < 0.008) continue;
        let flicker = 0;
        if (!reduced() && point.flickers) {
          const t = (elapsed / point.flickerPeriod + point.flickerPhase) % 1;
          const pulse = (start, end) => t > start && t < end ? Math.sin(Math.PI * (t - start) / (end - start)) ** 2 : 0;
          flicker = -0.8 * pulse(0, 0.22) + pulse(0.16, 0.48) - 0.55 * pulse(0.43, 0.64) + 0.85 * pulse(0.59, 1);
          flickering++;
        }
        const sprite = point.color * letters.length + point.glyph;
        const spritePixels = tile * atlasScale;
        context.globalAlpha = alpha * (1 + Math.min(0, flicker));
        context.drawImage(atlas, sprite % atlasColumns * spritePixels, Math.floor(sprite / atlasColumns) * spritePixels,
          spritePixels, spritePixels, x - point.size / 2, y - point.size / 2, point.size, point.size);
        if (flicker > 0) {
          const brightSprite = sprite + palette.length * letters.length;
          context.globalAlpha = Math.min(1, alpha * flicker * 1.3);
          context.drawImage(atlas, brightSprite % atlasColumns * spritePixels, Math.floor(brightSprite / atlasColumns) * spritePixels,
            spritePixels, spritePixels, x - point.size / 2, y - point.size / 2, point.size, point.size);
        }
        visible++;
      }
    }
    context.restore();
    lastDraw = now;
    needsDraw = false;
    frames++;
    if (debug && now - lastMetricUpdate >= 1000) {
      Object.assign(canvas.dataset, {
        count: String(points.length), visible: String(visible), flickering: String(flickering),
        frame: String(frames), atlas: `${atlas.width}×${atlas.height}`, dpr: String(dpr),
        backing: `${canvas.width}×${canvas.height}`, displacement: displacement.toFixed(2),
        breeze: pointer.active || wake.length ? 'active' : displacement > 0.05 ? 'settling' : 'idle',
      });
      lastMetricUpdate = now;
    }
    runtime?.report('floating-letters', performance.now() - started);
  }

  function inView() {
    const top = scrollY - mainTop;
    return top < fieldEnd + overscan && top + innerHeight > 0;
  }

  function fail() {
    failed = true; ready = false;
    cancelAnimationFrame(frame); frame = 0;
    clearTimeout(resizeTimer);
    canvas.width = canvas.height = atlas.width = atlas.height = 0;
    points = []; bandKeys = []; copyBands.clear(); sourceColorMap = null;
    canvas.dataset.flow = 'unavailable';
  }

  function tick(now) {
    frame = 0;
    if (!ready || document.hidden) return;
    if (!reduced() && lastTime) elapsed += Math.min(0.12, (now - lastTime) / 1000);
    lastTime = now;
    const rate = mobile() ? low() ? 20 : 30 : pointer.active || now < settlingUntil ? 60 : 30;
    try {
      if (layoutDirty || viewportDirty || profileDirty || !lastDraw || now - lastDraw >= 1000 / rate - 1) draw(now);
    } catch (error) {
      fail();
      if (debug) console.warn('Floating letters disabled after a rendering failure.', error);
      return;
    }
    if (needsDraw || (!reduced() && inView())) frame = requestAnimationFrame(tick);
    else lastTime = 0;
  }

  function schedule(measureAgain = false) {
    layoutDirty = layoutDirty || measureAgain;
    needsDraw = true;
    if (!frame && ready && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function scheduleResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      viewportDirty = true;
      schedule(true);
    }, 140);
  }

  function profileChanged() {
    profileDirty = true;
    canvas.dataset.flow = reduced() ? 'static' : 'upward';
    resetPointer(); lastTime = 0;
    schedule(true);
  }

  window.addEventListener('pointermove', movePointer, { passive: true });
  document.addEventListener('pointerleave', resetPointer, { passive: true });
  window.addEventListener('pointercancel', resetPointer, { passive: true });
  window.addEventListener('blur', resetPointer);
  window.addEventListener('scroll', () => { resetPointer(); schedule(); }, { passive: true });
  window.addEventListener('resize', scheduleResize, { passive: true });
  window.addEventListener('pageshow', () => { lastTime = 0; schedule(true); });
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; lastTime = 0; resetPointer(); });
  window.addEventListener('portfolio:themechange', () => schedule());
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(frame); frame = 0; lastTime = 0; lastDraw = 0; resetPointer();
    if (!document.hidden) schedule(true);
  });
  canvas.addEventListener('contextlost', fail);
  if (runtime) runtime.subscribe(profileChanged);
  else {
    motionPreference.addEventListener('change', profileChanged);
    coarsePointer.addEventListener('change', profileChanged);
  }
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleResize);
    observer.observe(main); observer.observe(story); observer.observe(scene);
  }

  async function initialize() {
    if (failed) return;
    try {
      const font = document.fonts?.load('13px "Noto Nastaliq Urdu"', 'بہک') || Promise.resolve();
      await Promise.all([font.catch(() => {}), samplePalette()]);
      buildAtlas(); ready = true;
      canvas.dataset.flow = reduced() ? 'static' : 'upward';
      canvas.dataset.renderer = 'viewport-2d';
      schedule(true);
    } catch (error) {
      fail();
      if (debug) console.warn('Floating letters are unavailable.', error);
    }
  }
  if (runtime) runtime.enqueue(initialize);
  else requestAnimationFrame(() => setTimeout(initialize, 0));
})();
