"""Create responsive display assets; originals stay unchanged. Requires Pillow."""
from pathlib import Path
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GALLERY = ROOT / "dist/assets/Gallery"
PHOTOS = ["DSC00787", "DSC00942", "DSC_0106", "DSC_0068", "IMG_3893", "IMG_7122", "schola-project-snapshot"]

mapping = {}
for stem in PHOTOS:
    source = GALLERY / f"{stem}.webp"
    with Image.open(source) as original:
        original.load()
        variants = []
        for edge in (320, 600, 960):
            image = original.copy()
            image.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            filename = f"{stem}-{edge}.webp"
            image.save(GALLERY / filename, "WEBP", quality=86 if edge == 320 else 90, method=6)
            variants.append({"src": f"assets/Gallery/{filename}", "width": image.width,
                             "height": image.height, "bytes": (GALLERY / filename).stat().st_size})
        original_info = {"src": f"assets/Gallery/{stem}.webp", "width": original.width,
                         "height": original.height, "bytes": source.stat().st_size}
        def srcset(items):
            return ", ".join(f'{v["src"]} {v["width"]}w' for v in items)
        mapping[original_info["src"]] = {
            "src": variants[0]["src"], "data-preview": variants[0]["src"],
            "data-full-src": original_info["src"],
            "data-srcset": srcset(variants[1:] + [original_info]),
            "data-mobile-srcset": srcset(variants[1:]),
            "data-low-srcset": srcset(variants[1:2]),
            "variants": variants + [original_info],
        }

with Image.open(GALLERY / "portrait-cutout-v2.png") as cutout:
    alpha = cutout.getchannel("A")
    alpha.thumbnail((720, 720), Image.Resampling.LANCZOS)
    mask = Image.new("RGBA", alpha.size, (255, 255, 255, 0))
    mask.putalpha(alpha)
    mask.save(GALLERY / "portrait-alpha-mask.webp", "WEBP", lossless=True, method=6)
    mask_info = {"width": mask.width, "height": mask.height,
                 "bytes": (GALLERY / "portrait-alpha-mask.webp").stat().st_size}

work = ROOT / ".work"
work.mkdir(exist_ok=True)
(work / "responsive-media-map.json").write_text(json.dumps(mapping, indent=2) + "\n")
report = {
    "original_photo_bytes": sum(v["variants"][-1]["bytes"] for v in mapping.values()),
    "mobile_photo_bytes": sum(v["variants"][2]["bytes"] for v in mapping.values()),
    "preview_photo_bytes": sum(v["variants"][0]["bytes"] for v in mapping.values()),
    "original_decoded_rgba_bytes": sum(v["variants"][-1]["width"] * v["variants"][-1]["height"] * 4 for v in mapping.values()),
    "mobile_decoded_rgba_bytes": sum(v["variants"][2]["width"] * v["variants"][2]["height"] * 4 for v in mapping.values()),
    "preview_decoded_rgba_bytes": sum(v["variants"][0]["width"] * v["variants"][0]["height"] * 4 for v in mapping.values()),
    "portrait_mask": mask_info,
}
(work / "responsive-media-report.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
