# Preserved al-folio examples

This directory preserves the original paths of sample content and assets, plus copies of pages and data replaced during personalization. It is explicitly excluded from Jekyll builds. These files remain visible in the source repository if it is public.

To reuse an example:

1. Copy the desired file to its original path outside `_templates/`. Do not restore the entire old configuration.
2. Replace all sample identities, links, dates, and content. Restore only the assets that the example actually uses.
3. For a post, use `_posts/YYYY-MM-DD-title.md`; the live Blog page supports posts, pagination, archives, and RSS. No configuration change is needed for a normal post.
4. For an academic collection, deliberately restore its page and enable that collection in `_config.yml`. Update exclusions and navigation only for the content you intend to publish.
5. Build from a clean destination and check the page, search data, sitemap, feed, and direct asset URLs before publication.

The reusable `_layouts/` and `_includes/` remain in place. Unused academic bibliography/data files remain in their original source locations and are excluded from publication. `assets/rendercv/` is also excluded, including future workflow-generated outputs. The live résumé uses `_data/cv.yml` and has no PDF download.
