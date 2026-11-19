(() => {
  'use strict';

  const canvas = document.querySelector('#lake-curtain');
  const scene = canvas?.closest('.lake-scene');
  if (!canvas || !scene) return;
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
  const staticContext = gl ? null : canvas.getContext('2d', { alpha: false });
  if (!gl && !staticContext) return;
  const pauseButton = document.querySelector('[data-curtain-pause]');
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const letters = [...'ابتٹثجچحخدڈرڑزژسشصضطظعغفقکگلمنںوہھیے'];
  const paper = '#fffef9';
  const atlasColumns = 7;
  const atlasRows = Math.ceil(letters.length / atlasColumns);
  const tileSize = 26;
  const atlasScale = 2;
  const glyphSize = 13;
  const atlas = document.createElement('canvas');
  const atlasContext = atlas.getContext('2d');
  const sampleCanvas = document.createElement('canvas');
  const sampleContext = sampleCanvas.getContext('2d', { willReadFrequently: true });
  const photo = new Image();
  const pointer = { x: -1000, y: -1000, active: false, down: false, startX: 0, startY: 0, previousX: 0, previousY: 0, vx: 0, vy: 0, travel: 0 };
  const ripples = [];
  let width = 0, height = 0, dpr = 1, rows = 0, columns = 0, cellWidth = 0;
  let particles;
  let loaded = false, assetsReady = false, inView = true, contextLost = false, hasDisplacement = false, offsetsDirty = true;
  let motionOverride = null;
  let animationFrame = 0, lastFrame = 0, lastRender = 0, elapsed = 0, resizeFrame = 0;
  let interactionCount = 0, lastInteraction = 0;
  let yaw = 0, pitch = 0, dragYaw = 0, dragPitch = 0, dragStartYaw = 0, dragStartPitch = 0;
  let renderCost = 0, lastMetricUpdate = 0, renderedFrames = 0;
  let gpu;

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smoothstep = (low, high, value) => {
    const t = clamp((value - low) / (high - low), 0, 1);
    return t * t * (3 - 2 * t);
  };
  const randomAt = (index, salt = 0) => {
    let seed = (index + 1) * 374761393 + salt * 668265263;
    seed = (seed ^ (seed >>> 13)) * 1274126177;
    return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
  };
  const prefersStill = () => motionPreference.matches && motionOverride !== true;
  const userPaused = () => motionOverride === false || prefersStill();
  const canInteract = () => loaded && gl && !contextLost && width > 0 && height > 0;
  const canAnimate = () => canInteract() && !userPaused() && inView && !document.hidden;

  canvas.dataset.state = 'loading';
  canvas.dataset.interactions = '0';
  canvas.dataset.renderer = gl ? 'webgl' : 'static-2d';
  canvas.style.touchAction = 'pan-y';
  canvas.setAttribute('aria-keyshortcuts', 'ArrowUp ArrowDown ArrowLeft ArrowRight Space');

  function recordInteraction() {
    const now = performance.now();
    if (now - lastInteraction < 100) return;
    lastInteraction = now;
    canvas.dataset.interactions = String(++interactionCount);
  }

  function updateControls() {
    if (!loaded) return;
    if (contextLost) {
      canvas.dataset.state = 'fallback';
      if (pauseButton) pauseButton.hidden = true;
      return;
    }
    const reduced = prefersStill();
    canvas.dataset.state = reduced ? 'reduced-motion' : (!gl || userPaused() || document.hidden || !inView ? 'paused' : 'ready');
    if (pauseButton) {
      pauseButton.hidden = !gl;
      pauseButton.textContent = reduced ? 'Enable motion' : (userPaused() ? 'Resume motion' : 'Pause motion');
      pauseButton.setAttribute('aria-pressed', String(userPaused()));
    }
  }

  function makeAtlas() {
    // One tiny white mask per letter. Color comes from a vertex attribute on the GPU.
    atlas.width = atlasColumns * tileSize * atlasScale;
    atlas.height = atlasRows * tileSize * atlasScale;
    atlasContext.setTransform(atlasScale, 0, 0, atlasScale, 0, 0);
    atlasContext.fillStyle = '#fff';
    atlasContext.textAlign = 'center';
    atlasContext.textBaseline = 'alphabetic';
    atlasContext.font = `${glyphSize}px "Noto Nastaliq Urdu", serif`;
    for (let glyph = 0; glyph < letters.length; glyph++) {
      const metrics = atlasContext.measureText(letters[glyph]);
      const baseline = ((metrics.actualBoundingBoxAscent || glyphSize) - (metrics.actualBoundingBoxDescent || 0)) / 2;
      const x = (glyph % atlasColumns) * tileSize + tileSize / 2;
      const y = Math.floor(glyph / atlasColumns) * tileSize + tileSize / 2;
      atlasContext.fillText(letters[glyph], x, y + baseline);
    }
  }

  function program(vertexSource, fragmentSource) {
    const result = gl.createProgram();
    const compiled = [];
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        gl.deleteProgram(result);
        throw new Error(`Curtain shader could not compile: ${message}`);
      }
      gl.attachShader(result, shader);
      compiled.push(shader);
    }
    gl.linkProgram(result);
    for (const shader of compiled) { gl.detachShader(result, shader); gl.deleteShader(shader); }
    if (!gl.getProgramParameter(result, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(result);
      gl.deleteProgram(result);
      throw new Error(`Curtain shader could not link: ${message}`);
    }
    return result;
  }

  function setupGPU() {
    const backgroundProgram = program(`
      attribute vec2 a_position;
      varying float v_y;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_y = 0.5 - a_position.y * 0.5;
      }
    `, `
      precision mediump float;
      varying float v_y;
      void main() {
        float amount = 0.0;
        if (v_y < 0.13) amount = 0.0;
        else if (v_y < 0.25) amount = mix(0.0, 0.06, (v_y - 0.13) / 0.12);
        else if (v_y < 0.39) amount = mix(0.06, 0.72, (v_y - 0.25) / 0.14);
        else if (v_y < 0.55) amount = mix(0.72, 0.96, (v_y - 0.39) / 0.16);
        else amount = mix(0.96, 1.0, (v_y - 0.55) / 0.45);
        vec3 paper = vec3(1.0, 254.0/255.0, 249.0/255.0);
        vec3 ground = vec3(12.0/255.0, 36.0/255.0, 42.0/255.0);
        gl_FragColor = vec4(mix(paper, ground, amount), 1.0);
      }
    `);
    const particleProgram = program(`
      attribute vec2 a_base;
      attribute vec4 a_meta;
      attribute vec4 a_color;
      attribute vec2 a_offset;
      uniform vec2 u_size;
      uniform vec4 u_rotation;
      uniform float u_wave;
      uniform float u_perspective;
      uniform float u_point_size;
      uniform float u_max_point_size;
      varying vec4 v_color;
      varying float v_glyph;
      void main() {
        float z = a_meta.x + a_meta.y * u_wave;
        float rotatedX = a_base.x * u_rotation.y + z * u_rotation.x;
        float depth = -a_base.x * u_rotation.x + z * u_rotation.y;
        float rotatedY = a_base.y * u_rotation.w - depth * u_rotation.z;
        float depthY = a_base.y * u_rotation.z + depth * u_rotation.w;
        float scale = u_perspective / (u_perspective + depthY);
        vec2 point = vec2(rotatedX, rotatedY) * scale + a_offset;
        gl_Position = vec4(point.x * 2.0 / u_size.x, -point.y * 2.0 / u_size.y, 0.0, 1.0);
        gl_PointSize = min(u_max_point_size, u_point_size * a_meta.w * scale);
        v_color = a_color;
        v_glyph = a_meta.z;
      }
    `, `
      precision mediump float;
      uniform sampler2D u_atlas;
      uniform vec2 u_atlas_grid;
      varying vec4 v_color;
      varying float v_glyph;
      void main() {
        vec2 cell = vec2(mod(v_glyph, u_atlas_grid.x), floor(v_glyph / u_atlas_grid.x));
        vec2 uv = (cell + gl_PointCoord) / u_atlas_grid;
        float alpha = texture2D(u_atlas, uv).a * v_color.a;
        gl_FragColor = vec4(v_color.rgb, alpha);
      }
    `);
    const uniform = name => gl.getUniformLocation(particleProgram, name);
    gpu = {
      backgroundProgram, particleProgram,
      quad: gl.createBuffer(), geometry: gl.createBuffer(), colors: gl.createBuffer(), offsets: gl.createBuffer(), texture: gl.createTexture(),
      backgroundPosition: gl.getAttribLocation(backgroundProgram, 'a_position'),
      base: gl.getAttribLocation(particleProgram, 'a_base'), meta: gl.getAttribLocation(particleProgram, 'a_meta'),
      color: gl.getAttribLocation(particleProgram, 'a_color'), offset: gl.getAttribLocation(particleProgram, 'a_offset'),
      size: uniform('u_size'), rotation: uniform('u_rotation'), wave: uniform('u_wave'), perspective: uniform('u_perspective'),
      pointSize: uniform('u_point_size'), maxPointSize: uniform('u_max_point_size'), atlas: uniform('u_atlas'), atlasGrid: uniform('u_atlas_grid'),
      pointLimit: gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1]
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.disable(gl.DITHER);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    canvas.dataset.drawCalls = '2';
    canvas.dataset.atlasSize = `${atlas.width}×${atlas.height}`;
  }

  function uploadParticles() {
    if (!gl || !gpu) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.geometry);
    gl.bufferData(gl.ARRAY_BUFFER, particles.geometry, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.colors);
    gl.bufferData(gl.ARRAY_BUFFER, particles.colors, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.offsets);
    gl.bufferData(gl.ARRAY_BUFFER, particles.offset, gl.DYNAMIC_DRAW);
    offsetsDirty = false;
  }

  function buildParticles() {
    const targetCount = gl ? (width < 640 ? 8600 : 26000) : 5800;
    columns = Math.max(64, Math.round(Math.sqrt(targetCount * width / height)));
    rows = Math.round(columns * height / width);
    cellWidth = width / columns;
    sampleCanvas.width = columns;
    sampleCanvas.height = rows;
    const imageRatio = photo.naturalWidth / photo.naturalHeight;
    const frameRatio = width / height;
    let sourceWidth = photo.naturalWidth, sourceHeight = photo.naturalHeight;
    if (imageRatio > frameRatio) sourceWidth = sourceHeight * frameRatio;
    else sourceHeight = sourceWidth / frameRatio;
    sampleContext.drawImage(photo, (photo.naturalWidth - sourceWidth) * 0.46, (photo.naturalHeight - sourceHeight) * 0.44, sourceWidth, sourceHeight, 0, 0, columns, rows);
    const pixels = sampleContext.getImageData(0, 0, columns, rows).data;
    const geometry = new Float32Array(columns * rows * 6);
    const colors = new Uint8Array(columns * rows * 4);
    let count = 0;
    for (let row = 0; row < rows; row++) {
      const v = (row + 0.5) / rows;
      const opacity = 0.16 + 0.84 * smoothstep(0.025, 0.31, v);
      for (let column = 0; column < columns; column++) {
        const index = row * columns + column;
        const u = (column + 0.5) / columns;
        const ridge = 0.085 + 0.023 * Math.sin(u * 15.5) + 0.014 * Math.cos(u * 29);
        const density = 0.025 + 0.975 * smoothstep(ridge, ridge + 0.22, v);
        if (randomAt(index, 7) >= density) continue;
        const g = count * 6, c = count * 4, p = index * 4;
        geometry[g] = (u - 0.5) * width;
        geometry[g + 1] = (v - 0.5) * height;
        geometry[g + 2] = Math.sin(u * Math.PI * 8) * (5 + v * 5);
        geometry[g + 3] = Math.sin(u * Math.PI * 5 + v * 3.5);
        geometry[g + 4] = Math.min(letters.length - 1, Math.floor(randomAt(index, 3) * letters.length));
        geometry[g + 5] = 0.89 + randomAt(index, 13) * 0.22;
        colors[c] = clamp(Math.round((pixels[p] * 1.1 + 7) / 51), 0, 5) * 51;
        colors[c + 1] = clamp(Math.round((pixels[p + 1] * 1.1 + 7) / 51), 0, 5) * 51;
        colors[c + 2] = clamp(Math.round((pixels[p + 2] * 1.1 + 7) / 51), 0, 5) * 51;
        colors[c + 3] = Math.round(opacity * 255);
        count++;
      }
    }
    particles = { count, geometry: geometry.subarray(0, count * 6), colors: colors.subarray(0, count * 4), offset: new Float32Array(count * 2), velocity: new Float32Array(count * 2) };
    hasDisplacement = false;
    offsetsDirty = true;
    uploadParticles();
    canvas.dataset.particles = String(count);
    canvas.dataset.grid = `${columns}×${rows}`;
  }

  function resize() {
    if (!loaded) return;
    const box = canvas.getBoundingClientRect();
    const nextWidth = Math.max(1, Math.round(box.width)), nextHeight = Math.max(1, Math.round(box.height));
    if (nextWidth === width && nextHeight === height) return;
    width = nextWidth;
    height = nextHeight;
    dpr = Math.min(window.devicePixelRatio || 1, width < 640 ? 1.75 : 1.5);
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    if (gl) gl.viewport(0, 0, canvas.width, canvas.height);
    else staticContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildParticles();
    ripples.length = 0;
    draw(performance.now(), 0, false);
    requestFrame();
  }

  function simulate(dt, now) {
    if (!pointer.active && !ripples.length && !hasDisplacement) return;
    const radius = width < 640 ? 94 : Math.min(145, width * 0.12);
    const radiusSquared = radius * radius;
    const damping = Math.pow(0.855, dt);
    const geometry = particles.geometry, offset = particles.offset, velocity = particles.velocity;
    let maximumEnergy = 0;
    while (ripples.length && now - ripples[0].start >= 1450) ripples.shift();
    for (let i = 0; i < particles.count; i++) {
      const g = i * 6, p = i * 2;
      const baseX = geometry[g] + width / 2, baseY = geometry[g + 1] + height / 2;
      let forceX = 0, forceY = 0;
      if (pointer.active) {
        const dx = baseX + offset[p] - pointer.x, dy = baseY + offset[p + 1] - pointer.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < radiusSquared) {
          const distance = Math.max(1, Math.sqrt(distanceSquared));
          const falloff = (1 - distance / radius) ** 2;
          const strength = pointer.down ? 4.7 : 3.0;
          forceX = dx / distance * falloff * strength + pointer.vx * falloff * 0.018;
          forceY = dy / distance * falloff * strength + pointer.vy * falloff * 0.018;
        }
      }
      for (let r = 0; r < ripples.length; r++) {
        const ripple = ripples[r];
        const dx = baseX - ripple.x, dy = baseY - ripple.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const age = (now - ripple.start) / 1000;
        const ring = distance - age * 380;
        if (Math.abs(ring) < 70) {
          const strength = Math.cos(ring / 70 * Math.PI / 2) * 1.65 * (1 - age / 1.45);
          forceX += dx / distance * strength;
          forceY += dy / distance * strength;
        }
      }
      velocity[p] = (velocity[p] + (forceX - offset[p] * 0.032) * dt) * damping;
      velocity[p + 1] = (velocity[p + 1] + (forceY - offset[p + 1] * 0.032) * dt) * damping;
      offset[p] += velocity[p] * dt;
      offset[p + 1] += velocity[p + 1] * dt;
      maximumEnergy = Math.max(maximumEnergy, Math.abs(offset[p]) + Math.abs(offset[p + 1]) + Math.abs(velocity[p]) + Math.abs(velocity[p + 1]));
    }
    hasDisplacement = maximumEnergy > 0.015;
    if (!hasDisplacement) { offset.fill(0); velocity.fill(0); }
    offsetsDirty = true;
  }

  function drawStatic() {
    staticContext.globalAlpha = 1;
    staticContext.fillStyle = paper;
    staticContext.fillRect(0, 0, width, height);
    const ground = staticContext.createLinearGradient(0, 0, 0, height);
    ground.addColorStop(0.13, 'rgba(12,36,42,0)');
    ground.addColorStop(0.25, 'rgba(12,36,42,0.06)');
    ground.addColorStop(0.39, 'rgba(12,36,42,0.72)');
    ground.addColorStop(0.55, 'rgba(12,36,42,0.96)');
    ground.addColorStop(1, 'rgba(12,36,42,1)');
    staticContext.fillStyle = ground;
    staticContext.fillRect(0, 0, width, height);
    staticContext.textAlign = 'center';
    staticContext.textBaseline = 'middle';
    staticContext.font = `${glyphSize * cellWidth / 7.1}px "Noto Nastaliq Urdu", serif`;
    for (let i = 0; i < particles.count; i++) {
      const g = i * 6, c = i * 4;
      staticContext.fillStyle = `rgba(${particles.colors[c]},${particles.colors[c + 1]},${particles.colors[c + 2]},${particles.colors[c + 3] / 255})`;
      staticContext.fillText(letters[particles.geometry[g + 4]], particles.geometry[g] + width / 2, particles.geometry[g + 1] + height / 2);
    }
  }

  function draw(now, dt, animate) {
    if (!particles || contextLost) return;
    const started = performance.now();
    if (!gl) { drawStatic(); return; }
    if (animate && !userPaused()) {
      if (!pointer.down) { dragYaw *= Math.pow(0.92, dt); dragPitch *= Math.pow(0.92, dt); }
      const pointerYaw = pointer.active && !pointer.down ? (pointer.x / width - 0.5) * 0.032 : 0;
      const pointerPitch = pointer.active && !pointer.down ? (pointer.y / height - 0.5) * 0.014 : 0;
      yaw += (dragYaw + pointerYaw - yaw) * Math.min(1, 0.09 * dt);
      pitch += (dragPitch + pointerPitch - pitch) * Math.min(1, 0.09 * dt);
      simulate(dt, now);
    }
    gl.disable(gl.BLEND);
    gl.useProgram(gpu.backgroundProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.quad);
    gl.enableVertexAttribArray(gpu.backgroundPosition);
    gl.vertexAttribPointer(gpu.backgroundPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disableVertexAttribArray(gpu.backgroundPosition);

    gl.enable(gl.BLEND);
    gl.useProgram(gpu.particleProgram);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.geometry);
    gl.enableVertexAttribArray(gpu.base);
    gl.vertexAttribPointer(gpu.base, 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(gpu.meta);
    gl.vertexAttribPointer(gpu.meta, 4, gl.FLOAT, false, 24, 8);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.colors);
    gl.enableVertexAttribArray(gpu.color);
    gl.vertexAttribPointer(gpu.color, 4, gl.UNSIGNED_BYTE, true, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, gpu.offsets);
    if (offsetsDirty) { gl.bufferSubData(gl.ARRAY_BUFFER, 0, particles.offset); offsetsDirty = false; }
    gl.enableVertexAttribArray(gpu.offset);
    gl.vertexAttribPointer(gpu.offset, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(gpu.size, width, height);
    gl.uniform4f(gpu.rotation, Math.sin(yaw), Math.cos(yaw), Math.sin(pitch), Math.cos(pitch));
    gl.uniform1f(gpu.wave, Math.sin(elapsed * 0.00032) * 1.7);
    gl.uniform1f(gpu.perspective, Math.max(1100, width * 1.45));
    gl.uniform1f(gpu.pointSize, tileSize * cellWidth / 7.1 * (width < 640 ? 1.04 : 1.08) * dpr);
    gl.uniform1f(gpu.maxPointSize, gpu.pointLimit);
    gl.uniform2f(gpu.atlasGrid, atlasColumns, atlasRows);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
    gl.uniform1i(gpu.atlas, 0);
    gl.drawArrays(gl.POINTS, 0, particles.count);
    gl.disableVertexAttribArray(gpu.base);
    gl.disableVertexAttribArray(gpu.meta);
    gl.disableVertexAttribArray(gpu.color);
    gl.disableVertexAttribArray(gpu.offset);

    pointer.vx *= 0.85;
    pointer.vy *= 0.85;
    renderCost = renderCost * 0.9 + (performance.now() - started) * 0.1;
    renderedFrames++;
    if (now - lastMetricUpdate > 1000) {
      canvas.dataset.frameMs = renderCost.toFixed(2);
      canvas.dataset.fps = String(Math.round(renderedFrames * 1000 / (now - lastMetricUpdate)));
      lastMetricUpdate = now;
      renderedFrames = 0;
    }
  }
  function frame(now) {
    animationFrame = 0;
    if (!canAnimate()) return;
    const interactive = pointer.active || pointer.down || ripples.length > 0;
    const frameInterval = interactive && renderCost < 22 ? 1000 / 60 : 1000 / 30;
    if (now - lastRender >= frameInterval - 1) {
      const milliseconds = lastFrame ? Math.min(32, now - lastFrame) : 16.67;
      lastFrame = now;
      lastRender = now;
      elapsed += milliseconds;
      draw(now, milliseconds / 16.67, true);
    }
    animationFrame = requestAnimationFrame(frame);
  }

  function requestFrame() {
    if (!canAnimate() || animationFrame) return;
    lastFrame = 0;
    lastRender = 0;
    animationFrame = requestAnimationFrame(frame);
  }

  function syncMotion() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    updateControls();
    if (canAnimate()) requestFrame();
    else if (loaded && inView && !document.hidden) draw(performance.now(), 0, false);
  }

  function resetDisplacement() {
    yaw = pitch = dragYaw = dragPitch = dragStartYaw = dragStartPitch = 0;
    pointer.vx = pointer.vy = pointer.travel = 0;
    hasDisplacement = false;
    offsetsDirty = true;
    ripples.length = 0;
    if (!particles) return;
    particles.offset.fill(0);
    particles.velocity.fill(0);
  }

  function localPointer(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function makeRipple(x, y) {
    if (!canInteract() || userPaused()) return;
    if (ripples.length >= 3) ripples.shift();
    ripples.push({ x, y, start: performance.now() });
    recordInteraction();
    requestFrame();
  }

  canvas.addEventListener('pointermove', event => {
    if (!canInteract() || userPaused()) return;
    const point = localPointer(event);
    pointer.vx = clamp(point.x - pointer.previousX, -40, 40);
    pointer.vy = clamp(point.y - pointer.previousY, -40, 40);
    pointer.previousX = point.x;
    pointer.previousY = point.y;
    pointer.x = point.x;
    pointer.y = point.y;
    pointer.active = true;
    if (pointer.down) {
      const dx = point.x - pointer.startX;
      const dy = point.y - pointer.startY;
      pointer.travel = Math.max(pointer.travel, Math.hypot(dx, dy));
      dragYaw = clamp(dragStartYaw + dx / width * 0.3, -0.2, 0.2);
      dragPitch = clamp(dragStartPitch - dy / height * 0.11, -0.07, 0.07);
    }
    recordInteraction();
    requestFrame();
  }, { passive: true });

  canvas.addEventListener('pointerdown', event => {
    if (!canInteract() || event.button !== 0 || userPaused()) return;
    const point = localPointer(event);
    pointer.x = pointer.startX = pointer.previousX = point.x;
    pointer.y = pointer.startY = pointer.previousY = point.y;
    pointer.active = pointer.down = true;
    pointer.travel = 0;
    dragStartYaw = dragYaw;
    dragStartPitch = dragPitch;
    canvas.setPointerCapture?.(event.pointerId);
    recordInteraction();
    requestFrame();
  }, { passive: true });

  canvas.addEventListener('pointerup', event => {
    if (!canInteract() || !pointer.down) return;
    pointer.down = false;
    if (pointer.travel < 8) makeRipple(pointer.x, pointer.y);
    if (event.pointerType !== 'mouse') pointer.active = false;
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }, { passive: true });

  function clearPointer() { pointer.active = pointer.down = false; }
  canvas.addEventListener('pointerleave', () => { if (!pointer.down) pointer.active = false; });
  canvas.addEventListener('pointercancel', clearPointer, { passive: true });
  canvas.addEventListener('lostpointercapture', () => { pointer.down = false; });
  window.addEventListener('blur', clearPointer);

  function toggleMotion() {
    if (!canInteract()) return;
    motionOverride = userPaused();
    clearPointer();
    syncMotion();
  }
  pauseButton?.addEventListener('click', toggleMotion);
  canvas.addEventListener('keydown', event => {
    if (!canInteract()) return;
    if (event.code === 'Space') {
      event.preventDefault();
      toggleMotion();
    } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault();
      const x = width * (event.key === 'ArrowLeft' ? 0.3 : event.key === 'ArrowRight' ? 0.7 : 0.5);
      const y = height * (event.key === 'ArrowUp' ? 0.35 : event.key === 'ArrowDown' ? 0.75 : 0.55);
      makeRipple(x, y);
    }
  });

  document.addEventListener('visibilitychange', () => { clearPointer(); syncMotion(); });
  motionPreference.addEventListener('change', () => {
    motionOverride = null;
    clearPointer();
    resetDisplacement();
    syncMotion();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      if (!inView) clearPointer();
      syncMotion();
    }, { rootMargin: '80px', threshold: 0 }).observe(scene);
  }
  const scheduleResize = () => {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => { resizeFrame = 0; resize(); });
  };
  if ('ResizeObserver' in window) new ResizeObserver(scheduleResize).observe(canvas);
  else window.addEventListener('resize', scheduleResize, { passive: true });

  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    contextLost = true;
    clearPointer();
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    scene.classList.remove('is-ready');
    canvas.tabIndex = -1;
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.state = 'fallback';
    if (pauseButton) pauseButton.hidden = true;
  });
  canvas.addEventListener('webglcontextrestored', () => {
    try {
      contextLost = false;
      if (!loaded || !particles) {
        // The image/font promise may still be pending; its initializer will finish.
        if (assetsReady) initialize();
        return;
      }
      setupGPU();
      gl.viewport(0, 0, canvas.width, canvas.height);
      resetDisplacement();
      uploadParticles();
      draw(performance.now(), 0, false);
      canvas.hidden = false;
      canvas.tabIndex = 0;
      canvas.removeAttribute('aria-hidden');
      scene.classList.add('is-ready');
      updateControls();
      requestFrame();
    } catch (error) {
      contextLost = true;
      console.warn('The lake photograph remains available after a graphics interruption.', error);
    }
  });

  async function initialize() {
    try {
      photo.src = canvas.dataset.image;
      const loadImage = photo.decode ? photo.decode() : new Promise((resolve, reject) => { photo.onload = resolve; photo.onerror = reject; });
      const loadFont = document.fonts?.load('18px "Noto Nastaliq Urdu"', 'بہک') ?? Promise.resolve();
      await Promise.all([loadImage, loadFont]);
      if (!atlasContext || !sampleContext) return;
      makeAtlas();
      assetsReady = true;
      if (gl && contextLost) return;
      if (gl) setupGPU();
      loaded = true;
      resetDisplacement();
      resize();
      scene.classList.add('is-ready');
      canvas.hidden = false;
      canvas.tabIndex = gl ? 0 : -1;
      canvas.removeAttribute('aria-hidden');
      if (!gl) {
        canvas.removeAttribute('aria-keyshortcuts');
        canvas.removeAttribute('aria-describedby');
      }
      updateControls();
      requestFrame();
    } catch (error) {
      canvas.dataset.state = 'fallback';
      canvas.hidden = true;
      canvas.tabIndex = -1;
      canvas.setAttribute('aria-hidden', 'true');
      if (pauseButton) pauseButton.hidden = true;
      // The sibling photograph remains visible when decoding or canvas is unavailable.
      console.warn('The letter curtain could not load; showing the lake photograph.', error);
    }
  }
  initialize();
})();
