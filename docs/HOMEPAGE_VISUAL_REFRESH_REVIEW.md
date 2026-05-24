# Homepage visual refresh — sprint review

## 1. Why images were added

The homepage carried the story but read as a wall of text — a
casual visitor scrolled past most of it. Carefully selected
stock photography gives the page visual anchors so an owner or
reviewer can scan, pause, and recognize what LedgerLens is
without reading every sentence.

## 2. Which sections received imagery

Five image slots, one per section called out in the audit:

| # | Section | File | Aspect | Load |
|---:|---|---|---|---|
| 1 | Hero mood band | `hero/calm-workspace-morning.jpg` | 16:5 strip | `priority` |
| 2 | Trust / before-after | `trust/verified-checklist-flatlay.jpg` | 4:3 | `lazy` |
| 3 | Granite State scenario card | `auto-shop/independent-garage.jpg` | 4:3 | `lazy` |
| 4 | Engineering / workflow strip | `engineering/workflow-architecture.jpg` | 16:5 | `lazy` |
| 5 | Workflow FAQ side image | `faq/calm-owner-review.jpg` | 3:4 portrait | `lazy` |

The hero strip lives above the existing hero copy (doesn't
crowd the trust card on the right of the hero grid). The trust
flatlay sits next to "What you get in the handoff package".
The auto-shop image grounds the fictional Granite State
scenario. The engineering strip introduces the "Built like an
AI workflow system" section. The FAQ portrait softens the
question wall.

## 3. Why other sections were left text-first

- **TrustPipeline** already has a strong icon-driven visual;
  adding a photo would compete with it.
- **Each value/tech card** could carry a thumbnail, but that
  would push the page into "SaaS pricing page" territory.
- **Eval evidence numbers** lose impact with photos around
  them.
- **Builder bio** — no portrait. A stock silhouette would feel
  fake; the about page deliberately stays linked-out via
  GitHub / LinkedIn.
- **Before/after copy** — contrast already works without an
  image.
- **Live API health** — operational, not visual.

This keeps the page calmer than typical SaaS marketing and
respects the "portfolio prototype, not commercial product"
framing.

## 4. Image sourcing rules

Two layers:

1. **Placeholder JPGs ship with the PR.** The repo carries
   labeled, gridded placeholders at the five expected paths so
   `npm run build` and `npm run images:verify` pass the moment
   the PR merges. The label on each placeholder reads
   "[Slot] placeholder — replace per
   HOMEPAGE_IMAGE_SELECTION_MANIFEST.md" so nobody confuses
   them for the final art.

2. **Operator-driven replacement.** `docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md`
   gives the operator, per slot:
   - desired mood
   - exact search terms
   - a hard-avoid list (no handshakes, no logos, no readable
     financial data, no close-up identifiable faces, etc.)
   - required aspect ratio + min dimensions
   - the exact local filename to drop the new file into

Allowed sources: **Unsplash**, **Pexels**, **Pixabay**. Each is
free for commercial use. No Shutterstock previews, no Getty,
no scraped-from-blog imagery, no Google Images.

## 5. Attribution approach

- `frontend/src/data/imageCredits.ts` is the single source of
  truth. One entry per image with `file`, `photographer`,
  `sourceUrl`, `license`, `section`.
- `<PhotoCredits />` (in `components/marketing/`) renders the
  list in a collapsed `<details>` at the bottom of the
  homepage. Doesn't clutter the page; trivially findable.
- The verify script asserts every credit entry matches a file
  on disk, every file on disk has a credit entry, and every
  `src=` reference in `app/page.tsx` is in the credits.
- Today's entries point at `Placeholder` license + the manifest
  doc as the `sourceUrl`. When a real photo is dropped in, the
  operator updates the entry inline.

## 6. Accessibility notes

- Every `<Image>` has a descriptive `alt` (audit-defined).
  No keyword-stuffing; the alt describes the scene **and** its
  purpose ("…representing a calm monthly bookkeeping cleanup
  workflow").
- No text is baked into any image. The placeholder labels are
  decorative; real photos will have none.
- The hero strip uses `aspect-[16/5]` on a sized container so
  CLS is 0 — the placeholder reserves space before the image
  is decoded.
- No image overlays text, so no contrast trade-off was
  necessary. If a future hero version overlays a headline on a
  photo, the audit doc calls for a gradient + 4.5:1 contrast.
- Decorative overlays (none in v1) would carry
  `aria-hidden="true"` per the audit spec.

## 7. Performance notes

- Hero image: `priority` (above the fold), `fill` with
  `sizes="(min-width: 1024px) 1024px, 100vw"` so next/image
  picks the right resolution per viewport.
- Other four: `loading="lazy"`, narrower `sizes`.
- All five files live under `public/images/stock/`. No remote
  hot-linking — the build is reproducible and offline-safe.
- Placeholder JPG sizes today (well under the per-image
  budget):
  - Hero — 57 KB
  - Trust — 39 KB
  - Auto-shop — 41 KB
  - Engineering — 42 KB
  - FAQ — 36 KB
  - **Total: ~215 KB**, vs. the 700 KB combined budget.
- Real photos will be larger but should stay under ≤ 200 KB
  hero / ≤ 120 KB per other image after `next/image`'s
  automatic format negotiation.
- No animations or carousels were added. No JS weight change.

## 8. Files changed

| Area | File |
|---|---|
| Pictures | `frontend/public/images/stock/{hero,trust,auto-shop,engineering,faq}/*.jpg` (5 placeholder JPGs) |
| Credits data | `frontend/src/data/imageCredits.ts` |
| Credits UI | `frontend/src/components/marketing/PhotoCredits.tsx` |
| Homepage | `frontend/src/app/page.tsx` (5 image slots + `<PhotoCredits />`) |
| Verify | `frontend/scripts/verify-homepage-images.mjs` + `images:verify` npm script |
| Tests | `frontend/src/lib/page-content.test.ts` — 6 new tests |
| Docs | `docs/HOMEPAGE_STOCK_PHOTOGRAPHY_AUDIT.md`, `docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md`, this file |

## 9. Build / test results

- `npm run lint` — clean.
- `npm run build` — clean.
- `npm test -- --run` — 290 → **296** (+6 new tests).
- `npm run images:verify` — `ok — 5 credits, 5 files on disk, 5 used in homepage.`

## 10. Remaining visual improvements

- **Benefit-card thumbnails.** Could give each of the eight
  value/tech cards a small icon-photo combo. Deferred — would
  push the page into "SaaS marketing" territory.
- **Before/after image pair.** Could show "messy CSV →
  organized handoff" instead of the text bullets. Bigger
  design exercise; deferred.
- **Builder background image.** A workspace photo behind the
  Michael Palmer card. Deferred per the no-real-portrait
  decision.
- **Hero overlay treatment.** If we later overlay the headline
  on the hero image (instead of below it), we need a soft
  gradient + 4.5:1 contrast guarantee. Documented in the audit;
  not implemented in v1.
- **Real photos.** Operator follow-up — drop replacement JPGs
  per the manifest and update the credit entries. The verify
  script and the build will catch any drift.
