/* Original photo pixels for the person; cached Urdu glyphs for the city.
   Only the small fringe moves. Construction buffers are released immediately. */
(() => {
  'use strict';
  const runtime = window.PortfolioMotion;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const coarse = matchMedia('(pointer: coarse)');
  const mobile = () => runtime ? runtime.mobile : coarse.matches || innerWidth < 768;
  const still = () => runtime ? runtime.reduced : reduced.matches;
  const alphabet = Array.from('ابتٹثجچحخدڈرڑزژسشصضطظعغفقکگلمنںوہھیے');
  const W = 360, H = 440, insetX = 40, insetY = 40, photoW = 280, photoH = 360, tile = 28;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
  const random = (n, seed) => { const v = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return v - Math.floor(v); };
  const edge = (x, y) => Math.min(x - insetX, insetX + photoW - x, y - insetY, insetY + photoH - y)
    + Math.sin(x * .073 + y * .039) * 5 + Math.sin(y * .13 - x * .047) * 3;
  const free = surface => { if (surface) surface.width = surface.height = 0; };
  const decode = async image => {
    let timeout;
    try {
      await Promise.race([image.decode(), new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Portrait image timed out')), 8000);
      })]);
    } finally { clearTimeout(timeout); }
  };

  document.querySelectorAll('[data-letter-portrait]').forEach(figure => {
    const img = figure.querySelector('img'), canvas = figure.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    if (!img || !canvas || !ctx) return;
    let resources = null, frame = 0, resizeTimer = 0, last = 0, lastDraw = 0, time = 0;
    let building = false, buildAgain = false, failed = false, disposed = false, dirty = true;
    const box = figure.getBoundingClientRect();
    let visible = box.bottom > 0 && box.top < innerHeight;
    const active = () => visible && !document.hidden && !disposed;
    const particleLimit = () => mobile() ? (runtime?.low ? 20 : 40) : 150;
    function dimensions() {
      const width = Math.max(1, figure.getBoundingClientRect().width);
      const dpr = Math.min(devicePixelRatio || 1, mobile() ? 1.25 : 2);
      const scale = Math.min(2048 / H, width / W * dpr);
      return { width: Math.ceil(W * scale), height: Math.ceil(H * scale), scale };
    }
    function disposeResources(value) {
      if (!value) return;
      free(value.base); free(value.subject); free(value.atlas);
    }
    function stop() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; last = lastDraw = 0;
    }
    function draw() {
      if (!resources || !active()) { dirty = true; return; }
      const started = performance.now();
      ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 1;
      ctx.drawImage(resources.base, 0, 0, W, H);
      const count = Math.min(particleLimit(), resources.particles.length);
      for (let i = 0; i < count; i++) {
        const p = resources.particles[i], t = (p.phase + time / p.duration) % 1;
        ctx.globalAlpha = Math.sin(Math.PI * t) * .62;
        const x = p.x + p.dx * p.reach * t + Math.sin(t * 5 + p.phase * 6) * 2;
        const y = p.y + p.dy * p.reach * t - 9 * t;
        ctx.drawImage(resources.atlas, p.sx, p.sy, resources.cell, resources.cell,
          x - tile / 2, y - tile / 2, tile, tile);
      }
      ctx.globalAlpha = 1;
      // Keep drifting letters behind the original face and clothing.
      if (resources.subject) ctx.drawImage(resources.subject, 0, 0, W, H);
      dirty = false;
      runtime?.report('portrait', performance.now() - started);
    }
    function tick(now) {
      frame = 0;
      if (!active() || still() || !resources) return;
      const interval = 1000 / (mobile() && runtime?.low ? 20 : 30);
      if (last) time += Math.min((now - last) / 1000, .05);
      last = now;
      if (dirty || !lastDraw || now - lastDraw >= interval - 1) { draw(); lastDraw = now; }
      if (!frame && active() && !still()) frame = requestAnimationFrame(tick);
    }
    function resume() {
      stop();
      if (!active() || !resources) return;
      if (dirty) draw();
      if (!frame && !still()) frame = requestAnimationFrame(tick);
    }
    async function build(size) {
      const scratch = new Set();
      const surface = (width = size.width, height = size.height) => {
        const value = document.createElement('canvas');
        value.width = width; value.height = height; scratch.add(value); return value;
      };
      try {
        await decode(img);
        if (document.fonts) await document.fonts.load('13px "Noto Nastaliq Urdu"');
        // Draw the whole selected image and clip its destination. srcset can
        // density-correct naturalWidth while drawImage source rectangles still
        // address raw pixels in WebKit, so never crop with source coordinates.
        const ratio = Math.max(photoW / img.naturalWidth, photoH / img.naturalHeight);
        const coverW = img.naturalWidth * ratio, coverH = img.naturalHeight * ratio;
        const coverX = insetX + (photoW - coverW) / 2, coverY = insetY + (photoH - coverH) / 2;
        const photo = surface(), pc = photo.getContext('2d', { willReadFrequently: true });
        if (!pc) throw new Error('Portrait sampling unavailable');
        pc.setTransform(size.scale, 0, 0, size.scale, 0, 0);
        pc.save(); pc.beginPath(); pc.rect(insetX, insetY, photoW, photoH); pc.clip();
        pc.drawImage(img, coverX, coverY, coverW, coverH); pc.restore();
        const pixels = pc.getImageData(0, 0, size.width, size.height);
        const colorAt = (x, y) => {
          const sx = Math.floor(clamp(x, insetX + 1, insetX + photoW - 2) * size.scale);
          const sy = Math.floor(clamp(y, insetY + 1, insetY + photoH - 2) * size.scale);
          const i = (sy * size.width + sx) * 4;
          return `rgb(${pixels.data[i]},${pixels.data[i + 1]},${pixels.data[i + 2]})`;
        };
        let letterBackground = true, subject = null;
        try { letterBackground = localStorage.getItem('mahi-portrait-version') !== 'earlier'; } catch {}
        if (letterBackground) {
          try {
            const cutout = new Image(); cutout.src = figure.dataset.cutout;
            await decode(cutout);
            subject = surface();
            const sc = subject.getContext('2d', { willReadFrequently: true });
            if (!sc) throw new Error('Portrait mask unavailable');
            sc.drawImage(photo, 0, 0);
            sc.globalCompositeOperation = 'destination-in';
            sc.drawImage(cutout, coverX * size.scale, coverY * size.scale,
              coverW * size.scale, coverH * size.scale);
            sc.globalCompositeOperation = 'source-over';
            const subjectPixels = sc.getImageData(0, 0, size.width, size.height);
            for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
              subjectPixels.data[(y * size.width + x) * 4 + 3] *= smooth(0, 18, edge(x / size.scale, y / size.scale));
            }
            sc.putImageData(subjectPixels, 0, 0);
          } catch {
            letterBackground = false; free(subject); scratch.delete(subject); subject = null;
          }
        }
        const base = letterBackground ? surface() : photo;
        const bc = base.getContext('2d');
        if (!bc) throw new Error('Portrait composition unavailable');
        if (!letterBackground) {
          for (let y = 0; y < size.height; y++) for (let x = 0; x < size.width; x++) {
            pixels.data[(y * size.width + x) * 4 + 3] *= smooth(9, 49, edge(x / size.scale, y / size.scale));
          }
          pc.putImageData(pixels, 0, 0);
        }
        bc.setTransform(size.scale, 0, 0, size.scale, 0, 0);
        bc.font = '13px "Noto Nastaliq Urdu"'; bc.textAlign = 'center'; bc.textBaseline = 'middle';
        let index = 0;
        for (let y = 22; y < H - 22; y += 6) for (let x = 22; x < W - 22; x += 5) {
          index++;
          const px = x + (random(index, 1) - .5) * 3, py = y + (random(index, 2) - .5) * 3, d = edge(px, py);
          const opacity = letterBackground ? smooth(-17, 12, d) : smooth(-17, 10, d) * (1 - smooth(17, 50, d));
          if (opacity < .025 || random(index, 3) > smooth(-19, 8, d)) continue;
          bc.globalAlpha = opacity * (letterBackground ? .76 + random(index, 4) * .24 : .65 + random(index, 4) * .35);
          bc.fillStyle = colorAt(px, py); bc.fillText(alphabet[index % alphabet.length], px, py);
        }
        bc.globalAlpha = 1;
        const count = particleLimit(), columns = Math.min(15, count), cell = Math.ceil(tile * size.scale);
        const atlas = surface(columns * cell, Math.ceil(count / columns) * cell);
        const ac = atlas.getContext('2d');
        if (!ac) throw new Error('Portrait sprites unavailable');
        ac.font = `${13 * size.scale}px "Noto Nastaliq Urdu"`; ac.textAlign = 'center'; ac.textBaseline = 'middle';
        const particles = [];
        for (let i = 0; i < count; i++) {
          const side = i % 4, along = random(i, 5);
          const x = side < 2 ? (side === 0 ? insetX + 8 : insetX + photoW - 8) : insetX + along * photoW;
          const y = side < 2 ? insetY + along * photoH : side === 2 ? insetY + 9 : insetY + photoH - 9;
          const sx = i % columns * cell, sy = Math.floor(i / columns) * cell;
          ac.fillStyle = colorAt(x, y); ac.fillText(alphabet[i % alphabet.length], sx + cell / 2, sy + cell / 2);
          particles.push({ x, y, sx, sy, dx: side === 0 ? -1 : side === 1 ? 1 : (along - .5) * 1.4,
            dy: side === 3 ? .3 : -1, phase: random(i, 6), duration: 9 + random(i, 7) * 9, reach: 14 + random(i, 8) * 20 });
        }
        for (const retained of [base, subject, atlas]) scratch.delete(retained);
        return { ...size, base, subject, atlas, particles, cell, letterBackground };
      } finally { for (const temporary of scratch) free(temporary); }
    }
    function requestBuild() {
      if (disposed || failed || !active()) return;
      const size = dimensions();
      if (resources && resources.width === size.width && resources.height === size.height && resources.particles.length >= particleLimit()) { resume(); return; }
      if (building) { buildAgain = true; return; }
      building = true;
      const job = async () => {
        try {
          if (!active()) return;
          const next = await build(size);
          if (disposed) { disposeResources(next); return; }
          stop(); disposeResources(resources); resources = next;
          canvas.width = size.width; canvas.height = size.height;
          ctx.setTransform(size.scale, 0, 0, size.scale, 0, 0);
          figure.dataset.portraitVersion = next.letterBackground ? 'letter-background' : 'earlier';
          if (runtime?.debug) {
            figure.dataset.particles = String(next.particles.length);
            figure.dataset.atlas = `${next.atlas.width}×${next.atlas.height}`;
          }
          dirty = true; resume(); figure.classList.add('is-ready');
        } catch (error) {
          failed = true; stop(); disposeResources(resources); resources = null;
          free(canvas); figure.classList.remove('is-ready');
          console.warn('portrait letter effect unavailable; keeping the photo', error);
        } finally {
          building = false;
          if (buildAgain) { buildAgain = false; requestBuild(); }
        }
      };
      if (runtime) runtime.enqueue(job);
      else requestAnimationFrame(() => setTimeout(job, 0));
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        if (visible) { requestBuild(); resume(); } else stop();
      }).observe(figure);
    }
    const resize = () => {
      clearTimeout(resizeTimer); resizeTimer = setTimeout(requestBuild, 150);
    };
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(figure);
    else window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) { requestBuild(); resume(); } else stop();
    });
    const profileChanged = () => { dirty = true; requestBuild(); resume(); };
    if (runtime) runtime.subscribe(profileChanged);
    else reduced.addEventListener('change', profileChanged);
    window.addEventListener('pagehide', event => {
      stop(); clearTimeout(resizeTimer);
      if (!event.persisted) { disposed = true; disposeResources(resources); resources = null; free(canvas); }
    });
    window.addEventListener('pageshow', () => { dirty = true; requestBuild(); resume(); });
    requestBuild();
  });
})();
