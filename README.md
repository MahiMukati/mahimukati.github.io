# Mahi's portfolio website

A buildless personal portfolio. The current homepage follows the quiet composition of nabeehaahmed.com: a serif name, a short welcome, and a large interactive image made from Urdu letters. The image is the supplied Moraine Lake photograph. The original photo stays as a fallback while the font and letter curtain load.

Live site: https://mahis-portfolio.poisedpath2.chatgpt.site

Previous design: https://mahis-portfolio.poisedpath2.chatgpt.site/previous/

The complete earlier forest/editorial design is preserved under `dist/previous/`, including its pages, fonts, images, CSS, and JavaScript. Do not overwrite or remove this archive when changing the current design.

## Local preview

From this folder, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. After editing, refresh the browser. Stop the server with Control-C. There are no dependencies to install and no build step.

## Add your homepage words

Edit `dist/index.html`. Search for `YOUR WORDS`. Two empty divs are ready for your own paragraphs:

- `#introduction`: beneath the name and welcome.
- `#about`: below the letter curtain.

Put your own `<p>…</p>` elements inside them. The empty biography areas take up no space until text is added. Use an `<a href="…">…</a>` for a link. No generated biography or sample copy is included.

The current homepage styles live in `dist/assets/lake.css`. Its renderer is `dist/assets/lake-curtain.js`; the unchanged source photograph is `dist/assets/moraine-lake.avif`. Fonts are self-hosted under `dist/assets/fonts/` with their licenses.

Move the mouse through the image to part the letters. Drag to bend the curtain; click for a ripple. With the canvas focused, arrow keys create a ripple and Space pauses or resumes. The renderer respects reduced-motion preferences and suspends itself when hidden or offscreen.

The header’s sun/moon control switches the current site between misty blue-gray light mode (`#DCE6E8`) and deep teal dark mode (`#123C40`). It follows the device preference until a mode is chosen, then remembers that choice across pages and visits. The canvas background follows the theme even while motion is paused.

The previous version's portrait toggle and project previews remain available at `/previous/`. Raw Gallery JPEGs remain local and are excluded from publication; the old version uses metadata-free WebP portraits.

## Edit projects and writing

- Project grid: `dist/projects/index.html`.
- Detail pages: `dist/projects/amd-schola/index.html`, `impulseguard/index.html`, `mysh/index.html`, and `jraw/index.html`.
- Writing index: `dist/writing/index.html`. Add real writing only when ready. For each post, create `dist/writing/your-post-slug/index.html`, use the same shared stylesheet, and link it from the writing index.
- Current colors, typography, responsive layout: `dist/assets/lake.css`. Existing project layout foundations: `dist/assets/style.css`.
- Contact links and navigation are ordinary HTML links. Update them in each page if needed.

Paths use relative links so the ordinary pages work at a domain root or under a subdirectory. The custom 404 uses root-relative links because it can be served at any missing URL; adjust those links if deploying under a GitHub Pages project subpath.

Project facts and images came from the existing `mahimukati.github.io` project. AMD team contributions are distinguished from individual work. Training integration is described as unfinished. Private project source is not presented as publicly available. Keep `dist/assets/amd-schola/NOTICE.txt` with that project's media.

## Prepare the public files

Run `node scripts/prepare-publish.mjs` to copy the editable `dist/` source into generated `out/`, excluding original Gallery JPEGs and system files. This has no dependencies. Preview `out/` when checking the exact publication. The Sites manifest uses `out/`; do not point hosting at `dist/`, which also contains local source photos.

## Current hosting: Sites

The current iteration uses the public generated Sites URL above. You can return to this chat to request changes and publication. The local `.openai/hosting.json` identifies the same hosted site; preserve its project ID for future updates. Publishing to Sites synchronizes source and deploys a saved version. Local edits alone do not update the live site.

No custom domain is necessary. A platform subdomain is a regular hosted address, not a local development tunnel. No expiration is promised; platform terms and availability apply.

## Recommended long-term free hosting: Cloudflare Pages

Use a dedicated repository for this portfolio. Keep the existing `mahimukati.github.io` repository separate.

1. Create a new GitHub repository, for example `mahi-portfolio`, and push this project to its `main` branch. Do not put credentials in the repository.
2. In Cloudflare, open Workers & Pages, create a Pages project, and connect that GitHub repository.
3. Select the `main` production branch and no framework preset.
4. Set the build command to `node scripts/prepare-publish.mjs` and the output directory to `out`.
5. Deploy. Cloudflare assigns a public HTTPS address ending in `.pages.dev`; you do not need to buy a domain.
6. Subsequent pushes to `main` update the live site. Other branches can produce preview deployments for testing.

For a manual deployment instead, Cloudflare's Direct Upload can accept the prepared contents of `out`. Choose Git integration from the beginning if automatic updates are important: a Direct Upload project cannot later be switched to Git integration.

Official documentation:

- Static sites: https://developers.cloudflare.com/pages/framework-guides/deploy-anything/
- Git integration: https://developers.cloudflare.com/pages/configuration/git-integration/
- Preview deployments: https://developers.cloudflare.com/pages/configuration/preview-deployments/
- Direct Upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Free-tier limits: https://developers.cloudflare.com/pages/platform/limits/

## When you buy a domain

Add the domain in the hosting project's custom-domain settings first, then follow its DNS instructions. On Cloudflare Pages, an apex domain uses Cloudflare nameservers; a subdomain can use a CNAME from an external DNS provider. Keep the existing hosted site while its domain changes.

Update the absolute social-preview URLs in the HTML to the new origin. Page and image links already use relative paths. No application rewrite is needed.

Custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/

## Verification

All sixteen HTML files (current and preserved) pass static link and heading checks. Current secondary routes and the preserved homepage/project index were checked in the browser at 320px, 768px, and 1440px. The new homepage has desktop, tablet, and phone visual checks.

Interactive browser checks cover dragging, keyboard ripples, keyboard pause/resume, and the social links over the artwork. An isolated local test fixture verifies simulated reduced-motion preference, explicit motion opt-in, actual WebGL context loss, photo fallback, and context restoration. That fixture lives in ignored `.work/` and is not published. JavaScript syntax and git whitespace checks pass. All case-study factual copy is preserved.

No account system, contact form backend, analytics, or tracking is included.
