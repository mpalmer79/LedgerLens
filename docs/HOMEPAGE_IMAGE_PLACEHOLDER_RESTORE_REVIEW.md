# Homepage image placeholder restore — review

## What regressed

PR #65 ("prep system with all five slots disabled by default") removed
the labeled placeholder JPGs and made every image slot conditional on
`enabled === true`. Since all five entries ship as `enabled: false`,
the homepage stopped rendering anything in those positions — no
placeholders, no wireframes, no visual map of where photography
belongs.

The homepage went from "five visible labeled panels" to "text-only
with empty gaps." That made it impossible to see the visual plan.

## Why the placeholders disappeared

The PR correctly removed fake placeholder JPGs (which looked low-
quality on a portfolio page). But it also made the JSX render
conditional on the `enabled` flag — meaning disabled slots rendered
*nothing*. The fix needed a middle state: **visible placeholder
panels when disabled, real photos when enabled.**

## What was restored

### HomepageImageSlot component

`frontend/src/components/app/HomepageImageSlot.tsx` — a single
component that handles both states:

- **`enabled: false`** — renders a professional wireframe placeholder
  panel with a muted paper/grid background (CSS-only), the section
  label (e.g. "Hero image slot"), and the target filename
  (e.g. "1600×900 · calm-workspace-morning.jpg"). No icons, no
  illustrations, no emoji, no fake photos.
- **`enabled: true`** — renders the real local photo via `next/image`
  with fill + object-cover + the manifest's alt text.

### Manifest additions

`homepageImages.ts` gained two new fields on every entry:

- `placeholderTitle` — e.g. "Hero image slot"
- `placeholderNote` — e.g. "1600×900 · calm-workspace-morning.jpg"

### Homepage restored

All five slots in `page.tsx` now render unconditionally using
`<HomepageImageSlot>`. Each shows a visible placeholder panel today
(while all slots are `enabled: false`). When Michael flips a slot to
`enabled: true` and the file exists on disk, the placeholder is
automatically replaced by the real photo — no homepage code changes.

## How Michael should replace a placeholder with a real photo

1. Download the photo and save it at the exact target path:
   - `frontend/public/images/stock/hero/calm-workspace-morning.jpg`
   - (see `docs/HOMEPAGE_IMAGE_MANUAL_SOURCING_MANIFEST.md` for all
     five paths and search guidance)
2. Add a credit entry to `frontend/src/data/imageCredits.ts`:
   ```ts
   {
     file: "/images/stock/hero/calm-workspace-morning.jpg",
     photographer: "Real Name",
     sourceUrl: "https://unsplash.com/photos/<id>",
     license: "Unsplash",
     section: "hero",
   },
   ```
3. Flip the matching slot in `homepageImages.ts`:
   ```diff
   -    enabled: false,
   +    enabled: true,
   ```
4. Run:
   ```bash
   cd frontend
   npm run images:verify
   npm test -- --run
   npm run build
   ```
5. The placeholder panel is replaced by the real photo. No other
   files need to change.
