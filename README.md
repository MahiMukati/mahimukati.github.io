# Mahi's portfolio website

A small, buildless portfolio based on the visual feel of muhibwaqar.com. The homepage prose is intentionally blank for Mahi to write. Writing has no entries.

Live site: https://mahis-portfolio.poisedpath2.chatgpt.site

## Local preview

From this folder, run:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:4173. After editing, refresh the browser. Stop the server with Control-C. There are no dependencies to install and no build step.

## Add your homepage words

Edit `dist/index.html`. Search for `YOUR WORDS`. Two empty divs are ready for your own paragraphs:

- `#introduction`: above the portrait.
- `#about`: below the portrait.

Put your own `<p>…</p>` elements inside them. The reserved whitespace automatically gives way to the text. Use an `<a href="…">…</a>` for a link. No generated biography or sample copy is included.

The portrait is styled in `dist/assets/style.css` under `.portrait`. Its display uses a 4:3 crop with the original color. The source image is preserved in the old portfolio; the public copies here have embedded metadata removed.

## Edit projects and writing

- Project grid: `dist/projects/index.html`.
- Detail pages: `dist/projects/amd-schola/index.html`, `impulseguard/index.html`, `mysh/index.html`, and `jraw/index.html`.
- Writing index: `dist/writing/index.html`. Add real writing only when ready. For each post, create `dist/writing/your-post-slug/index.html`, use the same shared stylesheet, and link it from the writing index.
- Colors, widths, typography, responsive layout: `dist/assets/style.css`.
- Contact links and navigation are ordinary HTML links. Update them in each page if needed.

Paths use relative links so the ordinary pages work at a domain root or under a subdirectory. The custom 404 uses root-relative links because it can be served at any missing URL; adjust those links if deploying under a GitHub Pages project subpath.

Project facts and images came from the existing `mahimukati.github.io` project. AMD team contributions are distinguished from individual work. Training integration is described as unfinished. Private project source is not presented as publicly available. Keep `dist/assets/amd-schola/NOTICE.txt` with that project's media.

## Current hosting: Sites

The current iteration uses the public generated Sites URL above. You can return to this chat to request changes and publication. The local `.openai/hosting.json` identifies the same hosted site; preserve its project ID for future updates. Publishing to Sites synchronizes source and deploys a saved version. Local edits alone do not update the live site.

No custom domain is necessary. A platform subdomain is a regular hosted address, not a local development tunnel. No expiration is promised; platform terms and availability apply.

## Recommended long-term free hosting: Cloudflare Pages

Use a dedicated repository for this portfolio. Keep the existing `mahimukati.github.io` repository separate.

1. Create a new GitHub repository, for example `mahi-portfolio`, and push this project to its `main` branch. Do not put credentials in the repository.
2. In Cloudflare, open Workers & Pages, create a Pages project, and connect that GitHub repository.
3. Select the `main` production branch and no framework preset.
4. Set the build command to `exit 0` and the output directory to `dist`.
5. Deploy. Cloudflare assigns a public HTTPS address ending in `.pages.dev`; you do not need to buy a domain.
6. Subsequent pushes to `main` update the live site. Other branches can produce preview deployments for testing.

For a manual deployment instead, Cloudflare's Direct Upload can accept the contents of `dist` (included in the portable archive). Choose Git integration from the beginning if automatic updates are important: a Direct Upload project cannot later be switched to Git integration.

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

The seven content pages were reviewed in the browser at 320px, 390px, 768px, and 1440px. Checks cover navigation, direct nested routes, images, empty homepage prose, empty writing, keyboard focus, and horizontal overflow. No account system, contact form backend, analytics, or tracking is included.
