# Homepage image selection manifest *(superseded)*

This doc was the operator guide back when the repo shipped labeled
placeholder JPGs under `frontend/public/images/stock/`. Those
placeholders were intentionally removed in the
"homepage image prep" sprint.

**The current guide is:**

- **Sourcing checklist** — `docs/HOMEPAGE_IMAGE_MANUAL_SOURCING_MANIFEST.md`
- **Prep review** — `docs/HOMEPAGE_VISUAL_REFRESH_PREP_REVIEW.md`

The homepage now reads a typed manifest at
`frontend/src/data/homepageImages.ts`, every slot is `enabled: false`
by default, and the homepage renders nothing for disabled slots.
Real photo files go into `frontend/public/images/stock/<section>/`
exactly as before; the difference is the manifest gate.

See `HOMEPAGE_STOCK_PHOTOGRAPHY_AUDIT.md` for the original visual
audit (sections, mood, aspect ratios). That audit is still the
source of truth for *what* each image should convey; this file is
left in place only as a redirect.
