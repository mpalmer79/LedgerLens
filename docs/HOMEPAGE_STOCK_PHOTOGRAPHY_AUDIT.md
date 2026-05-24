# Homepage stock-photography audit

The LedgerLens homepage tells a strong story but reads as a wall
of text. This audit defines where (and where not) carefully
selected stock photography belongs.

## 1. Current text-heavy sections

The homepage today is roughly twelve text blocks stacked
vertically:

1. Hero — headline + sub + CTAs.
2. Before/after framing.
3. Granite State Auto Repair example handoff card.
4. Workflow strip (the TrustPipeline).
5. Generated walkthrough placeholder (VideoDemo).
6. Reviewer takeaway.
7. Eight value/tech cards.
8. Trust metric callout.
9. Workflow FAQ (Phase: owner onboarding).
10. Portfolio CTA (hiring manager).
11. About-Michael strip.
12. Live API health.

Each block is fully readable, but a casual visitor scrolls past
most of them. The page lacks visual anchors that let an owner
or reviewer scan, pause, and recognize "this is a small-business
workflow tool" without reading every sentence.

## 2. Where imagery would improve comprehension

| Section | What an image adds |
|---|---|
| Hero | A calm-workspace photo establishes the product's voice in 200ms before anyone reads a word. |
| Trust section | A flat-lay of a checklist makes "procedurally verified" concrete. |
| Auto-shop scenario card | An independent garage photo grounds the fictional Granite State scenario in a real-feeling place. |
| Engineering strip | A workflow-planning photo (notebook + laptop) signals "systems thinking" for the technical reader. |
| FAQ section | A small-owner-reviewing-documents photo softens the FAQ wall and reinforces "this is for busy owners". |

## 3. Where imagery would distract or cheapen the product

- **Each value-card thumbnail.** Would look like SaaS pricing pages.
- **TrustPipeline** — already a strong visual; adding a photo
  next to icons creates competition.
- **Eval evidence link / methodology callout.** Photos cheapen
  numbers.
- **Builder bio.** A real photo would conflict with the
  no-personal-portrait stance the about page takes; a stock
  silhouette would look fake.
- **Before/after copy.** Already does its job; a photo would
  steal the contrast.
- **Live API health.** Operational, not visual.

## 4. Recommended number of images for v1

**Five.** One per section listed in §2. No more.

This keeps the page calmer than a typical SaaS marketing surface,
respects the "portfolio prototype, not commercial product"
framing, and stays well under any reasonable performance budget.

## 5. Image style rules

- **Mood**: calm, warm, uncluttered, natural light.
- **Composition**: prefer negative space; the homepage layout
  needs room to breathe.
- **Subjects**: workspaces, tools, documents-without-readable-
  data, exteriors of small businesses, hands on keyboards from
  the side.
- **Forbidden**: handshakes, smiling office teams, suits, charts
  on screens, close-up identifiable faces, visible bank /
  accounting / dealership / vendor logos, readable bank
  statements / invoices / account numbers / cards / checks,
  fake hacker code on monitors, neon-cyber dashboards, cliché
  "AI-themed" stock.
- **Aspect ratios**: hero = 16:9 wide; section images = 4:3
  landscape; FAQ side image = 3:4 portrait.

## 6. Accessibility requirements

- Every image carries descriptive `alt` text. Decorative-only
  overlays (gradients, blur cards) get `aria-hidden="true"`.
- No text is baked into images. All copy stays in the DOM.
- Where text overlays a hero image, the overlay must keep WCAG
  AA contrast (4.5:1 for body text, 3:1 for large display
  text). A soft gradient + a low-opacity surface tint is the
  cheapest way to guarantee this.
- Alt text describes the scene + the purpose (e.g. "Tidy desk
  with laptop and notebook in soft morning light, representing
  a calm monthly bookkeeping cleanup workflow") — not a
  keyword-stuffed list.

## 7. Attribution requirements

- A single `<PhotoCredits />` block in the homepage footer,
  inside a collapsed `<details>` so it doesn't crowd the page.
- Each entry: photographer name + source platform + a link to
  the original.
- Stored centrally in `frontend/src/data/imageCredits.ts` so the
  verify script can keep it honest.
- License must be Unsplash / Pexels / Pixabay or other free-for-
  commercial-use. No Shutterstock / Getty / scraped-from-blog
  imagery.

## 8. Performance budget

- Hero image: ≤ 200 KB after optimization, `priority` (above
  the fold).
- Other images: ≤ 120 KB each, lazy-loaded.
- Combined cold-load image weight: ≤ 700 KB total for all five.
- Use `next/image` so the framework's auto-format negotiation +
  responsive `sizes` apply.
- Cumulative Layout Shift contribution from images: 0 (every
  `<Image>` carries explicit `width` + `height` or `fill` with
  a sized container).
- No external image hosts (no remote `images.unsplash.com`).
  All images live in `public/images/stock/`.

## 9. Acceptance criteria

1. Five image slots wired into the homepage, each with
   meaningful alt text.
2. A `<PhotoCredits />` block in the footer with one entry per
   image.
3. `imageCredits.ts` is the single source of truth.
4. `scripts/verify-homepage-images.ts` validates that every
   manifest entry has a file on disk and every file has a
   credit entry.
5. Placeholder JPGs ship at the expected paths so the build
   passes immediately; a manifest doc tells the operator which
   real photos to download.
6. Lint, build, and tests pass.
7. No honesty contract is broken (no production claim, no fake
   review imagery, no readable financial data, etc.).
8. No new email / phone / resume / mailto / tel links.
