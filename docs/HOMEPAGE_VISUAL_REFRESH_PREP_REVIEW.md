# Homepage visual refresh — prep review

This PR is **prep only**. It does not change what the homepage
actually shows today. It wires up the file structure, manifest,
credit system, verification script, and documentation so that
adding the real photos later is a small, mechanical change.

## What was prepared

- **Folders**: `frontend/public/images/stock/{hero,trust,auto-shop,engineering,faq}/`
  exist with `.gitkeep` so git tracks them.
- **Manifest**: `frontend/src/data/homepageImages.ts` declares five
  image slots with descriptive alt text, target paths, aspect, and
  intended placement. All five are `enabled: false`.
- **Credits**: `frontend/src/data/imageCredits.ts` ships an empty
  array and a typed `ImageCredit` interface. No fake credits.
- **Component**: `frontend/src/components/marketing/PhotoCredits.tsx`
  returns `null` when `imageCredits` is empty and otherwise renders a
  collapsed `<details>` block with section, photographer, source
  link, and license.
- **Verify script**: `frontend/scripts/verify-homepage-images.ts`
  (`npm run images:verify`) checks the enabled-image rules + the
  credit shape rules.
- **Sourcing manifest**:
  `docs/HOMEPAGE_IMAGE_MANUAL_SOURCING_MANIFEST.md` is the
  operator-side checklist of search terms, target paths, aspect,
  min width, hard-avoid list, and alt text per slot.
- **Homepage**: `src/app/page.tsx` reads from the manifest and only
  renders an image slot when `enabled === true`. Today every slot is
  disabled, so no broken image references are emitted.

## Why images are disabled by default

Three reasons, in order of importance:

1. **No fake placeholders.** We don't ship a labeled "Hero
   placeholder" JPG because anything visibly fake on the homepage of
   a portfolio piece reads as low quality. Better to render nothing
   than a placeholder.
2. **No fake credits.** Every `<PhotoCredits />` entry is supposed to
   be a real attribution. Empty array → empty footer (renders
   nothing). The moment a real photo is added, a real credit is
   added alongside it.
3. **Build-safety.** A broken `<Image src="/missing.jpg" />` either
   404s in dev or fails Next's image optimizer in production. The
   manifest-gated render avoids both.

## Why icons were not used as substitutes

Earlier iterations leaned on `lucide-react` icons in the visual slots
as a stop-gap. That was a mistake — icons read as decorative
chrome, not photography, and they trained the eye to skip past the
section entirely. Empty space (with the rest of the section content
intact) is honest about the state of the page.

## Exact image paths to populate

Order doesn't matter; one slot at a time is fine.

| Slot | Target path |
|---|---|
| Hero | `frontend/public/images/stock/hero/calm-workspace-morning.jpg` |
| Trust | `frontend/public/images/stock/trust/verified-checklist-flatlay.jpg` |
| Auto shop | `frontend/public/images/stock/auto-shop/independent-garage.jpg` |
| Engineering | `frontend/public/images/stock/engineering/workflow-architecture.jpg` |
| FAQ | `frontend/public/images/stock/faq/calm-owner-review.jpg` |

See `docs/HOMEPAGE_IMAGE_MANUAL_SOURCING_MANIFEST.md` for the
search-term guidance, aspect, and hard-avoid list for each.

## How to add credits

Append to the `imageCredits` array in
`frontend/src/data/imageCredits.ts`:

```ts
{
  file: "/images/stock/hero/calm-workspace-morning.jpg",
  photographer: "Real Name",
  sourceUrl: "https://unsplash.com/photos/<id>",
  license: "Unsplash", // Unsplash | Pexels | Pixabay | Other
  section: "hero",
},
```

Real name + real URL + real license only — there is no placeholder
shape that is acceptable in this file.

## How to enable an image

In `frontend/src/data/homepageImages.ts`, find the slot's entry and
flip `enabled: false` → `enabled: true`. The homepage will pick it
up automatically on the next build.

## How to run the verify script

```bash
cd frontend
npm run images:verify
```

The script asserts:

- Every enabled image has a file on disk under
  `frontend/public/`, alt text ≥ 20 characters, and a matching
  credit entry.
- Every credit references a file that exists on disk, has a
  non-empty photographer, a `https://` source URL, and a valid
  license.
- All-disabled + empty credits passes (the current shipping state).

## What the next PR should do

Once the five real photos and matching credits are in place:

1. Single commit per slot, or one commit for all five — operator's
   choice.
2. Run `npm run images:verify`, `npm test -- --run`,
   `npm run lint`, `npm run build` locally.
3. Open a PR titled along the lines of *"enable real homepage
   stock photography"*.
4. The PR description should list each slot, its photographer,
   source URL, and license — copy-pasted from `imageCredits.ts`.
5. Confirm with a screenshot that the homepage renders the photos
   in the right slots and at the right aspect.

## What this prep PR does NOT do

- Does not change the headline, body copy, FAQ content, or any
  other homepage text.
- Does not add icons, illustrations, or decorative SVGs in the
  empty image slots.
- Does not change the layout of any unrelated section.
- Does not add pricing, signup, request-demo, contact form, email,
  phone, mailto, or tel links.
- Does not modify backend code.
- Does not touch the portfolio-demo chip or any public-demo warning.
