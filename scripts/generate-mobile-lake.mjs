// Bake the existing Urdu lake renderer into mobile images and a tiny glyph sheet.
// Install generator-only tooling if needed:
//   npm install --prefix .work/name-shape-tools @napi-rs/canvas
//   python3 -m venv .work/image-tools && .work/image-tools/bin/pip install Pillow
// Then run: node scripts/generate-mobile-lake.mjs
// The website needs neither this dependency nor a canvas/Urdu font on mobile.
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, '.work/name-shape-tools/package.json'));
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const destination = path.join(root, 'dist/assets/mobile');
mkdirSync(destination, { recursive: true });
GlobalFonts.registerFromPath(path.join(root, 'dist/assets/fonts/noto-nastaliq-urdu.ttf'), 'Noto Nastaliq Urdu');
const image = await loadImage(path.join(root, 'dist/assets/moraine-lake.avif'));
const letters = [...'ابتٹثجچحخدڈرڑزژسشصضطظعغفقکگلمنںوہھیے'];
const palette = JSON.parse(readFileSync(path.join(root, 'dist/assets/lake-palette.json'), 'utf8')).palette;
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const smoothstep = (low, high, value) => {
  const t = clamp((value - low) / (high - low), 0, 1);
  return t * t * (3 - 2 * t);
};
// Matches the approved lake grid's stable glyph placement and density pattern.
const randomAt = (index, salt = 0) => {
  let seed = (index + 1) * 374761393 + salt * 668265263;
  seed = (seed ^ (seed >>> 13)) * 1274126177;
  return ((seed ^ (seed >>> 16)) >>> 0) / 4294967295;
};
async function save(canvas, name) {
  const bytes = name.startsWith('lake-')
    ? execFileSync(process.env.PILLOW_PYTHON || path.join(root, '.work/image-tools/bin/python'), ['-c',
      'import io,sys; from PIL import Image; image=Image.open(io.BytesIO(sys.stdin.buffer.read())); image.save(sys.stdout.buffer,"WEBP",quality=75,method=6)'],
      { input: canvas.toBuffer('image/png'), maxBuffer: 8 * 1024 * 1024 })
    : await canvas.encode('webp', 90);
  writeFileSync(path.join(destination, name), bytes);
  return { file: name, width: canvas.width, height: canvas.height, bytes: bytes.length };
}
function centerGlyph(ctx, glyph, x, y, fontSize) {
  ctx.font = `${fontSize}px "Noto Nastaliq Urdu"`;
  const metrics = ctx.measureText(glyph);
  const baseline = ((metrics.actualBoundingBoxAscent || fontSize) - (metrics.actualBoundingBoxDescent || 0)) / 2;
  ctx.fillText(glyph, x, y + baseline);
}
async function lake(width, height, name) {
  const scale = 2;
  const canvas = createCanvas(width * scale, height * scale);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  // Transparent paper lets exactly the same file blend into both site themes.
  // Compositing this gradient over either theme matches the renderer's mix().
  const ground = ctx.createLinearGradient(0, 0, 0, height);
  for (const [y, alpha] of [[0, 0], [.13, 0], [.25, .06], [.39, .72], [.55, .96], [1, 1]]) {
    ground.addColorStop(y, `rgba(12,36,42,${alpha})`);
  }
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, width, height);

  const target = 13000; // Restore the detailed original mobile look without runtime work.
  const columns = Math.floor(Math.sqrt(target * width / height));
  const rows = Math.min(Math.round(columns * height / width), Math.floor(target / columns));
  const cellWidth = width / columns;
  const sample = createCanvas(columns, rows);
  const sampler = sample.getContext('2d');
  let sourceWidth = image.width, sourceHeight = image.height;
  if (image.width / image.height > width / height) sourceWidth = sourceHeight * width / height;
  else sourceHeight = sourceWidth * height / width;
  sampler.drawImage(image, (image.width - sourceWidth) * .46, (image.height - sourceHeight) * .44,
    sourceWidth, sourceHeight, 0, 0, columns, rows);
  const pixels = sampler.getImageData(0, 0, columns, rows).data;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  let glyphCount = 0;
  for (let row = 0; row < rows; row++) {
    const v = (row + .5) / rows;
    const alpha = .16 + .84 * smoothstep(.025, .31, v);
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col, u = (col + .5) / columns;
      const ridge = .085 + .023 * Math.sin(u * 15.5) + .014 * Math.cos(u * 29);
      const density = .025 + .975 * smoothstep(ridge, ridge + .22, v);
      if (randomAt(index, 7) >= density) continue;
      const pixel = index * 4;
      const rgb = [0, 1, 2].map(axis => clamp(Math.round((pixels[pixel + axis] * 1.1 + 7) / 51), 0, 5) * 51);
      const glyph = letters[Math.min(letters.length - 1, Math.floor(randomAt(index, 3) * letters.length))];
      const z = Math.sin(u * Math.PI * 8) * (5 + v * 5);
      const perspective = Math.max(1100, width * 1.45);
      const depthScale = perspective / (perspective + z);
      const size = .89 + randomAt(index, 13) * .22;
      ctx.fillStyle = `rgba(${rgb.join(',')},${alpha})`;
      centerGlyph(ctx, glyph, (u - .5) * width * depthScale + width / 2,
        (v - .5) * height * depthScale + height / 2,
        13 * cellWidth / 7.1 * (width < 640 ? 1.04 : 1.08) * size * depthScale);
      glyphCount++;
    }
  }
  const result = await save(canvas, name);
  result.glyphs = glyphCount;
  return result;
}
const lakePortrait = await lake(375, 560, 'lake-urdu.webp');
const lakeLandscape = await lake(560, 375, 'lake-urdu-wide.webp');

// Twelve colored variants sharing one 110 KB decoded texture. CSS can choose a
// cell and animate a 24×24 element; no font shaping or canvas is required.
const spriteGlyphs = [...'بتحدرسعقلمنے'];
const colorIndices = [6, 4, 10, 2, 5, 12, 7, 14, 9, 8, 15, 3];
const tile = 48, columns = 4, rows = 3;
const sprites = createCanvas(columns * tile, rows * tile);
const ctx = sprites.getContext('2d');
ctx.textAlign = 'center';
ctx.textBaseline = 'alphabetic';
const cells = spriteGlyphs.map((glyph, index) => {
  const x = index % columns * tile, y = Math.floor(index / columns) * tile;
  const rgb = palette[colorIndices[index] % palette.length];
  ctx.fillStyle = `rgb(${rgb.join(',')})`;
  centerGlyph(ctx, glyph, x + tile / 2, y + tile / 2, 26);
  return { glyph, x, y, width: tile, height: tile, color: rgb, cssX: -x / 2, cssY: -y / 2 };
});
const spriteSheet = await save(sprites, 'urdu-sprites.webp');
const manifest = { version: 1, lakePortrait, lakeLandscape,
  spriteSheet: { ...spriteSheet, tilePixels: tile, cssTile: 24, cssBackgroundWidth: 96, cssBackgroundHeight: 72, cells } };
writeFileSync(path.join(destination, 'lake-art.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify(manifest, null, 2));
