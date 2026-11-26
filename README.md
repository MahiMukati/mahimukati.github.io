# Mahi's portfolio

A static portfolio with an animated Arabic name mark, floating Urdu letters, photo stacks, and interactive Moraine Lake artwork. No dependencies or framework build are required.

Live website: [mahimukati.github.io](https://mahimukati.github.io/)

## Local preview

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. Edit files under `dist/` and refresh. Keep changes local. Only commit, push, or deploy when explicitly requested; a previous deployment request does not authorize publishing later edits. Use targeted checks for behavior changes; simple copy or color changes do not need a full review.

## Files to edit

- `dist/index.html`: homepage text, photo carousels, and links.
- `dist/projects/index.html`: projects index; each project has its own subfolder.
- `dist/writing/index.html`: writing index, currently empty.
- `dist/cv/index.html`: résumé retained from the previous public site.
- `dist/assets/lake.css`: shared theme, header, and lake artwork styles.
- `dist/assets/home-journey.css` and `photo-stack.css`: homepage layout and carousels.
- `dist/assets/scroll-letters.js`, `lake-curtain.js`, and `name-morph.js`: letter animations.
- `dist/assets/Gallery/`: public photos. Use optimized WebP images, with orientation applied and metadata removed. The `AMD` and `Charity Week` folders are also available for future images.

Keep visible text lowercase. Light mode uses warm stone (`#E6E1D7`); dark mode uses deep teal (`#123C40`). Fonts are self-hosted. Keep their license files and `dist/assets/amd-schola/NOTICE.txt` with the media.

## Publish to GitHub Pages

The repository is [MahiMukati/mahimukati.github.io](https://github.com/MahiMukati/mahimukati.github.io). GitHub Pages uses GitHub Actions. The only workflow prepares and deploys the static site; it does not run a full CI or design review.

1. Run `node scripts/prepare-publish.mjs` to generate `out/`.
2. Preview the exact output with `python3 -m http.server 4174 --bind 127.0.0.1 --directory out`.
3. Commit the intended source changes and push `main` when publication is requested.
4. Check the **Publish portfolio** action. A successful deployment updates the live website.

The workflow publishes only `out/`, never the repository root. `out/` is generated and ignored by Git. Original Gallery JPEGs and system files are excluded; reference public WebP copies in HTML.

Directory index pages provide `/projects/`, `/writing/`, `/cv/`, and the project detail routes. Requests without a trailing slash redirect to the same pages. `404.html` uses root-relative links so it works at missing URLs of any depth. Absolute social-preview and canonical URLs use `https://mahimukati.github.io`.

## Preserved local material

The earlier forest design and design experiments have been moved out of the public website. A complete pre-publication snapshot is in `.work/backups/before-github-pages/dist/`; it can be previewed with the same Python server command. Individual archived files are in `.work/archive/`, and original carousel photos are in `.work/originals/Gallery/`.

These local folders, screenshots, temporary tooling, and the previous hosting configuration are ignored and not published. Existing GitHub repository history is retained so the former public site can also be recovered.

No account system, contact-form backend, analytics, or tracking is included.

## Mobile rendering

`dist/assets/motion-budget.js` serializes decorative startup after the first paint. Coarse-pointer devices and widths below 768px use smaller buffers and 30 FPS; sustained rendering pressure selects a 20 FPS profile for the rest of the tab session. Reduced-motion preferences stop continuous animation.

The floating-letter surface is viewport-sized with a reusable pool capped at 1,200 mobile particles (600 in the lower profile). The lake initializes only within 200px of the viewport and keeps its photo fallback if graphics fail. The name mark uses precomputed coordinates and sleeps between transitions. Carousels promote only nearby active cards to larger sources.

Add `?perf=1` to a local URL to expose low-frequency canvas size and particle diagnostics in DOM data attributes. This does not send telemetry. Focused regression checks run with:

```sh
node scripts/test-motion-budget.cjs
node scripts/test-lake-budget.cjs
```

For an iPhone check on the same Wi-Fi, serve **only** `dist/` on the local network:

```sh
python3 -m http.server 4176 --bind 0.0.0.0 --directory dist
```

Open this Mac's LAN address on port 4176. Check cold loads, scrolling, carousel changes, rotation, and background/resume in Safari and Arc. Desktop viewport tests do not confirm real-device memory stability.

Generated assets are already included; normal preview and publication still need no dependencies. To regenerate responsive photos or the lake palette, the optional `scripts/prepare-media.py` and `scripts/generate-lake-palette.py` utilities require Pillow. `scripts/generate-name-shapes.mjs` prepares a browser export fixture and imports its JSON to retain the approved calligraphy geometry.
