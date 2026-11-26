"""Generate the tiny floating-letter palette asset; requires Pillow.

Run from any directory: python scripts/generate-lake-palette.py
The public site consumes JSON and does not need Pillow at runtime.
"""
from collections import Counter
import json
from pathlib import Path

from PIL import Image

root = Path(__file__).resolve().parent.parent
with Image.open(root / 'dist/assets/moraine-lake.avif') as photo:
    source_ratio = photo.width / photo.height
    sample = photo.convert('RGB').resize((96, 96), Image.Resampling.BILINEAR)
    pixels = list(sample.get_flattened_data()) if hasattr(sample, 'get_flattened_data') else list(sample.getdata())

counts = Counter(tuple(channel // 24 for channel in rgb) for rgb in pixels)
sums = {key: [0, 0, 0] for key in counts}
for rgb in pixels:
    key = tuple(channel // 24 for channel in rgb)
    for axis, value in enumerate(rgb):
        sums[key][axis] += value
colors = sorted(
    [(count, [int(channel / count + 0.5) for channel in sums[key]])
     for key, count in counts.items() if count > 2],
    key=lambda item: -item[0],
)
lightness = lambda rgb: sum(channel * weight for channel, weight in zip(rgb, (0.2126, 0.7152, 0.0722)))
by_light = sorted((rgb for _, rgb in colors), key=lightness)
palette = [by_light[0], by_light[-1]]
for _, rgb in colors:
    if len(palette) == 16:
        break
    if all(sum((a - b) ** 2 for a, b in zip(rgb, previous)) > 32 ** 2 for previous in palette):
        palette.append(rgb)
indices = [min(range(len(palette)), key=lambda index: sum((a - b) ** 2 for a, b in zip(rgb, palette[index]))) for rgb in pixels]
asset = {'version': 1, 'width': 96, 'height': 96, 'sourceRatio': source_ratio, 'palette': palette, 'indices': indices}
target = root / 'dist/assets/lake-palette.json'
target.write_text(json.dumps(asset, separators=(',', ':')) + '\n')
print(f'{target.name}: {len(palette)} colors, {target.stat().st_size:,} bytes')
