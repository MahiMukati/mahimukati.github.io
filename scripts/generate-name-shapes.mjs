import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Browser sampling preserves the approved canvas rasterization exactly.
// Run this script, serve the repository root locally, open the printed fixture,
// download its JSON, then run: node scripts/generate-name-shapes.mjs --import FILE
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const W = 512, H = 300;
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


const names = ['محمد', 'ماحي', 'علي', 'مكاتي'];
const silhouettes = ['muhammad-v2', 'mahi-v2', 'ali', 'mukati-v2'];
async function generate() {
  const sampled = [];
  for (const name of silhouettes) {
    const image = new Image();
    image.src = '/dist/assets/jali-thuluth/' + name + '.png';
    await image.decode();
    sampled.push(sampleWord(image));
  }
  const count = Math.max(...sampled.map(points => points.length));
  if (!count || sampled.some(points => !points.length)) throw new Error('Empty glyph mask');
  const shapes = sampled.map(points => {
    const uses = new Uint16Array(points.length);
    for (let i=0; i<count; i++) uses[Math.floor(i * points.length / count)]++;
    return Array.from({length:count}, (_, i) => {
      const index=Math.floor(i * points.length / count), point=points[index];
      return [point.x, point.y, point.alpha / uses[index], Number(point.dot), point.width];
    });
  });
  const output = {version:1, width:W, height:H, names, count,
    dots:sampled.map(points => points.filter(point => point.dot).length), shapes};
  const json=JSON.stringify(output);
  document.querySelector('textarea').value=json;
  document.querySelector('#status').textContent=`ready: ${count} particles; dots ${output.dots.join(',')}`;
  const link=document.querySelector('a');
  link.href=URL.createObjectURL(new Blob([json+'\n'],{type:'application/json'}));
  link.hidden=false;
}

const imported = process.argv.indexOf('--import');
if (imported !== -1) {
  const value=JSON.parse(readFileSync(process.argv[imported+1], 'utf8'));
  if (value.version!==1 || value.width!==W || value.height!==H || value.shapes.length!==4 ||
      !value.shapes.every(shape=>shape.length===value.count && shape.every(p=>p.length===5 && p.every(Number.isFinite)))) {
    throw new Error('Invalid browser shape export');
  }
  const destination=path.join(root,'dist/assets/jali-thuluth/name-shapes.json');
  writeFileSync(destination,JSON.stringify(value)+'\n');
  console.log(`Imported ${value.count} points per name into ${destination}`);
} else {
  const folder=path.join(root,'.work/mobile-perf');
  mkdirSync(folder,{recursive:true});
  const script=`const W=${W}, H=${H};\n${morton.toString()}\n${sampleWord.toString()}\nconst names=${JSON.stringify(names)};\nconst silhouettes=${JSON.stringify(silhouettes)};\n${generate.toString()}\ngenerate().catch(error=>document.querySelector('#status').textContent=error.message);`;
  writeFileSync(path.join(folder,'name-export.js'),script);
  writeFileSync(path.join(folder,'name-export.html'),`<!doctype html><meta charset="utf-8"><title>name shape export</title><h1>name shape export</h1><p id="status">sampling</p><a href="#" download="name-shapes.json" hidden>download name shapes</a><p><textarea readonly style="width:95vw;height:200px" aria-label="name shape json"></textarea></p><script src="name-export.js"></script>`);
  console.log('Serve the project root, then open /.work/mobile-perf/name-export.html');
}
