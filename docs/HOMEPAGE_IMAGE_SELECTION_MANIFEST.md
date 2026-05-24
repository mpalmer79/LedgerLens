# Homepage image selection manifest

Operator guide for replacing the five labeled placeholder JPGs
shipped at `frontend/public/images/stock/` with real
Unsplash / Pexels / Pixabay photos.

Workflow:

1. Use the search guidance below to find a candidate on
   **Unsplash** or **Pexels** (Pixabay is OK; everything else
   is not).
2. Verify the candidate against the **hard-avoid** list for
   that section.
3. Download the highest-quality JPG, rename it to the exact
   `local filename`, and replace the placeholder.
4. Update the matching entry in
   `frontend/src/data/imageCredits.ts`: set `photographer`,
   `sourceUrl`, `license`.
5. Run `npm run images:verify` to confirm the system is
   consistent.
6. Run `npm run build` to confirm the homepage still builds.

**Do not** use Google Images, Shutterstock previews, Getty,
stock-photo aggregators, or images scraped from blogs.

---

## 1. Hero — `hero/calm-workspace-morning.jpg`

| Field | Value |
|---|---|
| Section | Hero / above-fold mood band |
| Desired mood | Calm, warm, uncluttered. Sets a small-business tone before anyone reads the headline. |
| Search terms | "minimalist desk workspace morning light laptop notebook" · "tidy home office natural light" · "warm desk laptop notebook coffee" |
| Hard avoid | smiling faces · handshakes · suits · monitors with text · brand logos · readable bank statements / cards · cliché AI / neon / cyber imagery |
| Aspect ratio | 16:9 (rendered as 16:5 strip; original 16:9 crops cleanly) |
| Local filename | `public/images/stock/hero/calm-workspace-morning.jpg` |
| Min dimensions | 1600 × 900 |
| Rationale | A single calm photo above the headline replaces a wall of text with a mood the rest of the page lives up to. Decorative — the alt text describes the scene. |

## 2. Trust — `trust/verified-checklist-flatlay.jpg`

| Field | Value |
|---|---|
| Section | Before/after block — sits next to "What you get in the handoff package" |
| Desired mood | Verification, calm review, "I checked this." |
| Search terms | "checklist clipboard pen flatlay" · "handwritten checklist notebook" · "list checking off paper pen" |
| Hard avoid | readable list items · readable receipts · close-up faces · logos · dollar signs · obvious "audit" stock |
| Aspect ratio | 4:3 landscape |
| Local filename | `public/images/stock/trust/verified-checklist-flatlay.jpg` |
| Min dimensions | 1200 × 900 |
| Rationale | Makes "procedurally verified" concrete without claiming CPA-correctness. The image complements the "what you get" list. |

## 3. Auto shop — `auto-shop/independent-garage.jpg`

| Field | Value |
|---|---|
| Section | Granite State Auto Repair scenario card |
| Desired mood | Real small-business, daylight, independent shop. Not a dealer chain. |
| Search terms | "independent auto repair shop exterior" · "small garage workshop daylight" · "neighborhood mechanic shop street" |
| Hard avoid | brand-name dealership signage · cars with visible license plates · technician close-ups · staged "team" shots · oil-soaked dramatic lighting · stock "mechanic giving thumbs up" |
| Aspect ratio | 4:3 landscape |
| Local filename | `public/images/stock/auto-shop/independent-garage.jpg` |
| Min dimensions | 1200 × 900 |
| Rationale | Grounds the fictional Granite State scenario in a real-feeling place. The card already calls out "fictional sample"; the photo reinforces the *kind* of business, not a real one. |

## 4. Engineering — `engineering/workflow-architecture.jpg`

| Field | Value |
|---|---|
| Section | "Built like an AI workflow system" section |
| Desired mood | Systems thinking, planning, deliberate work. |
| Search terms | "workflow planning laptop notebook architecture" · "system diagram whiteboard hands" · "developer planning notebook laptop" |
| Hard avoid | green-on-black "hacker code" · neon dashboards · cliché AI brain · matrix-style screens · obvious tutorials with readable code · suits |
| Aspect ratio | 16:5 wide strip |
| Local filename | `public/images/stock/engineering/workflow-architecture.jpg` |
| Min dimensions | 1600 × 500 (or 1200 × 900 crop-friendly) |
| Rationale | Signals "this is layered AI engineering, not a wrapper" for the technical reader. Stays calm; avoids cliché "AI"-themed imagery. |

## 5. FAQ — `faq/calm-owner-review.jpg`

| Field | Value |
|---|---|
| Section | Workflow FAQ heading |
| Desired mood | Owner, evening, reading at home / shop counter. |
| Search terms | "person reviewing documents laptop window light hands" · "small business owner papers desk" · "hands papers laptop natural light" |
| Hard avoid | close-up identifiable face · suit / corporate look · staged smile · stock "advisor" framing · readable financial documents |
| Aspect ratio | 3:4 portrait |
| Local filename | `public/images/stock/faq/calm-owner-review.jpg` |
| Min dimensions | 900 × 1200 |
| Rationale | Softens the FAQ wall and reinforces "this is for busy owners". Hands / over-shoulder framing avoids the cheesy headshot trap. |

---

## License + attribution

Free-for-commercial-use only:

- **Unsplash** — Unsplash license, free for commercial use, no
  attribution required (but we credit anyway in the footer).
- **Pexels** — Pexels license, free for commercial use, no
  attribution required (we credit).
- **Pixabay** — Pixabay license, free for commercial use, no
  attribution required (we credit).

When you replace a placeholder, update the matching entry in
`frontend/src/data/imageCredits.ts`:

```ts
{
  file: "/images/stock/hero/calm-workspace-morning.jpg",
  photographer: "Jane Smith",
  sourceUrl: "https://unsplash.com/photos/abc123",
  license: "Unsplash",
  section: "hero",
},
```

## Verification

```
cd frontend
npm run images:verify    # asserts file + credit + JSX usage are aligned
npm run build            # confirms next/image still optimizes cleanly
```

The verify script is the gate. If it passes, the homepage will
render the new image; if it fails, the message tells you exactly
which entry / file / JSX reference is out of sync.
