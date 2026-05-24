# Homepage image — manual sourcing manifest

LedgerLens needs five real local photographs on its homepage. Claude
Code does not have reliable access to Unsplash, Pexels, or Pixabay in
its execution environment, so it cannot download these for you. This
doc is the operator-side checklist for adding the real files.

The repo is **already prepared** for these images:

- The folders exist under `frontend/public/images/stock/`.
- The five image slots are declared (disabled) in
  `frontend/src/data/homepageImages.ts`.
- The credit array lives empty in
  `frontend/src/data/imageCredits.ts`.
- The verify script is `npm run images:verify`.
- The homepage skips any slot whose `enabled` is `false`.

You do not need to write any code. The workflow per image is:

1. **Download** a real photo from a free-license source.
2. **Save** it at the exact target path below — don't rename, don't
   change folder, don't change extension.
3. **Add a credit entry** to `imageCredits.ts` (real photographer,
   real source URL, real license).
4. **Flip `enabled: true`** for that slot in `homepageImages.ts`.
5. **Run** `npm run images:verify`. Fix anything it flags.

Once all five slots are populated you can land them in a single
"enable real homepage images" PR.

## Hard rules

- **Source**: Unsplash, Pexels, Pixabay, or another clearly
  free-license source.
- **Forbidden**: Google Images, Shutterstock or Getty previews, blog
  scrapes, "stock" aggregators, AI-generated illustration packs.
- **File**: Save the real downloaded image file, not a screenshot.
- **Credit**: Keep the source URL + photographer name as you download
  so the credit entry is honest.
- **Don't enable** an image slot until both the file AND a matching
  credit entry exist — the verify script will fail loudly.
- **Don't add fake credits** — every entry must point to a real
  photographer and a real source URL.

## Slot 1 — Hero

| Field | Value |
|---|---|
| Target path | `frontend/public/images/stock/hero/calm-workspace-morning.jpg` |
| Search terms | `minimalist desk workspace morning light laptop notebook` |
| Aspect | 21:9 or 16:9 |
| Min width | 2400 px |
| Avoid | faces, readable documents, logos, messy clutter, fake financial charts |
| Alt text | Tidy desk with laptop and notebook in soft morning light, representing a calm monthly bookkeeping cleanup workflow |

## Slot 2 — Trust

| Field | Value |
|---|---|
| Target path | `frontend/public/images/stock/trust/verified-checklist-flatlay.jpg` |
| Search terms | `checklist clipboard pen flatlay review` |
| Aspect | 3:2 |
| Min width | 1800 px |
| Avoid | readable personal information, contracts with visible names, bank documents |
| Alt text | Checklist and pen on a desk, representing procedural review before accountant handoff |

## Slot 3 — Auto shop

| Field | Value |
|---|---|
| Target path | `frontend/public/images/stock/auto-shop/independent-garage.jpg` |
| Search terms | `independent auto repair shop exterior daylight` |
| Aspect | 16:9 |
| Min width | 2000 px |
| Avoid | visible dealership logos, license plates, brand signage, recognizable customers |
| Alt text | Auto repair workshop representing the fictional Granite State Auto Repair demo scenario |

## Slot 4 — Engineering

| Field | Value |
|---|---|
| Target path | `frontend/public/images/stock/engineering/workflow-architecture.jpg` |
| Search terms | `workflow planning laptop notebook architecture systems` |
| Aspect | 16:9 or 4:3 |
| Min width | 1800 px |
| Avoid | fake hacker code, green terminal clichés, unreadable stock dashboards with logos |
| Alt text | Person writing notes beside a computer, representing workflow design and systems thinking |

## Slot 5 — FAQ

| Field | Value |
|---|---|
| Target path | `frontend/public/images/stock/faq/calm-owner-review.jpg` |
| Search terms | `person reviewing documents laptop window light hands` |
| Aspect | 3:2 or portrait |
| Min width | 1600 px |
| Avoid | close-up faces, readable documents, real invoices, bank statements, financial statements |
| Alt text | Person reviewing documents at a desk, representing plain-English owner review questions |

## How to add a credit

Append an object to `imageCredits` in
`frontend/src/data/imageCredits.ts`:

```ts
{
  file: "/images/stock/hero/calm-workspace-morning.jpg",
  photographer: "Jane Smith",                    // real name on the source page
  sourceUrl: "https://unsplash.com/photos/<id>", // real URL (must be https)
  license: "Unsplash",                            // Unsplash | Pexels | Pixabay | Other
  section: "hero",
},
```

Then in `frontend/src/data/homepageImages.ts`, flip the matching
slot's `enabled: false` → `enabled: true`.

## License + attribution

All three approved sources allow commercial use without required
attribution. We credit anyway in the homepage footer (collapsed
`<details>` block; `<PhotoCredits />`).

- **Unsplash** — Unsplash License
- **Pexels** — Pexels License
- **Pixabay** — Pixabay Content License

If a candidate's license is anything other than these three, set
`license: "Other"` and add a short comment in `imageCredits.ts`
explaining the license + a link to its terms.
