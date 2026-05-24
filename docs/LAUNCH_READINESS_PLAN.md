# Launch-readiness plan

## 1. Current strengths (going into this sprint)

- Verified-ledger trust metric is wired through the API, the CSV export, `/demo`, `/ledger`, `/evals`, the homepage hero card, `/technical-story`, and `docs/TRUST_METRIC.md`.
- `/about` and `/technical-story` exist. `/about` has LinkedIn + GitHub buttons (no email/phone/resume by design + by test).
- Homepage hero has the trust card, visual pipeline, video section (Loom placeholder + script doc), three business value cards, six tech-credibility cards, and an About-Michael strip.
- Demo-stub mode keeps the public deploy at $0 paid spend; regression test asserts the `anthropic` SDK is never imported in demo mode.
- 134 backend tests + 29 frontend tests pass. ruff / mypy --strict / lint / build all clean.
- Honesty is preserved: 63% / 42% raw model accuracy stays on `/evals`; the trust callout explicitly says raw model accuracy is *not* the product trust boundary.
- `lib/site.ts` centralises LinkedIn + GitHub URLs; `site.test.ts` pins down the contract (no email/phone/resume link in shared constants).

## 2. Remaining launch blockers

These are the gaps a recruiter would hit when the URL is shared on LinkedIn:

1. **About link visibility.** It is in the homepage nav, but it's the last item before "GitHub" and reads as a footer-style afterthought. Needs to be visually prominent enough that a recruiter notices it.
2. **No OG image.** Metadata title + description are set; `og:image` is not. LinkedIn shows a generic preview with a broken thumbnail. Most consequential single thing.
3. **The hero doesn't say "built by Michael Palmer."** That line lives in the About strip further down the page. A recruiter who skim-reads the hero needs the recruiter-relevance signal there too.
4. **Trust card microcopy** is good but the "raw model evals" link is buried in a small sentence. Wants a deliberate "See raw model evals →" call-to-action.
5. **`/technical-story` is dense.** No "reviewer takeaway" header card. No side-by-side "LLM wrapper vs LedgerLens" table — the most useful single visual for a hiring manager.
6. **`/demo` lacks a "what to look for" framing panel at the top.** A first-time visitor doesn't know what to watch for before they start clicking.
7. **`/ledger` shows a warning when verification < 100%** but has no positive confirmation when verification = 100%. The cheerful state is missing.
8. **LinkedIn doc has the post draft but no launch package** (alternate hooks, recruiter DM follow-up, screenshot guidance, the line for adding the Loom URL after recording).
9. **README intro is reorganised but lacks badges and a "how to view the technical story" pointer.**
10. **No manual Railway / launch checklist** anyone could run before publishing.

## 3. Homepage / header improvements (Phase 2–3, 6)

- Promote **About Michael** in the nav: bold weight, brand color on hover, clear separator from the github link.
- Add a one-line recruiter-relevance sentence under the hero CTAs: *"Built by Michael Palmer as a portfolio project demonstrating AI workflow engineering, full-stack development, and practical product thinking."*
- Hero trust card: add an explicit "See raw model evals →" link under the existing honesty sentence.
- Header gets a subtle border tightening so the About link reads as a top-level item, not a buried link.

## 4. Open Graph image plan (Phase 4–5)

- Ship a real PNG at `frontend/public/og-ledgerlens.png`. 1200×630. Brand-green gradient background. LedgerLens wordmark + tagline + verified-ledger value + pipeline glyph.
- Source SVG ships alongside at `frontend/public/og-ledgerlens.svg` so the asset is regeneratable.
- Wire `metadata.openGraph.images` and `metadata.twitter.images` in `app/layout.tsx`.
- Test pins down that `og-ledgerlens.png` exists in `public/`.
- Image deliberately uses *"100% verified finalized demo ledger"* with the *"workflow-level trust metric"* caption beside it — never "100% AI accuracy."

## 5. LinkedIn launch readiness checklist

Goes into `docs/FINAL_LAUNCH_READINESS_REVIEW.md`:

- [ ] Verify the live URL renders the new homepage (deploy frontend).
- [ ] Verify `/ready` returns `categorizer.mode: demo_stub` (deploy backend if needed).
- [ ] Open the URL in an incognito window — does the hero make sense in 5 seconds?
- [ ] Inspect with LinkedIn Post Inspector — does the OG image render?
- [ ] Walk `/demo` end-to-end. Does step 6 land at 100% verified?
- [ ] Click `/about` from the header. Does the LinkedIn button work?
- [ ] Verify favicon.
- [ ] Optional: record Loom, set `NEXT_PUBLIC_LOOM_URL`, redeploy.
- [ ] Post the LinkedIn copy from `docs/LINKEDIN_PROJECT_STORY.md`.
- [ ] Drop GitHub link in the first comment.

## 6. About link visibility requirements

- Top nav on `/` shows **About Michael** as a prominent text link (not the last item before GitHub).
- Repeated on `/about`'s own nav, on `/technical-story`'s nav, and on `/evals`'s nav.
- The on-homepage About strip stays — it gives recruiters a second hit.
- Footer keeps About too.

## 7. Demo readiness requirements

- The seven-step flow already works. Add a "What to look for" framing card at the top of `/demo` so first-time visitors know what to watch for before they click.
- Step 6's `DemoOutcome` card already changes copy based on `verification_rate`; that stays.
- Loom placeholder is fine — script is shipped.

## 8. Manual Railway verification checklist

Goes into the final review doc. Backend: `CATEGORIZER_MODE=demo_stub`, `DATABASE_URL`, `CORS_ORIGINS`, no `ANTHROPIC_API_KEY`. Frontend: `NEXT_PUBLIC_API_BASE_URL`, optional `NEXT_PUBLIC_LOOM_URL`.

## 9. Acceptance criteria

- About Michael is a visible header nav item on every public route.
- A 1200×630 OG image exists, references it in `<meta>` tags, and contains no "100% AI accuracy" wording.
- Hero contains a one-line "built by Michael Palmer" recruiter signal.
- `/technical-story` has a Reviewer-takeaway card and an LLM-wrapper-vs-LedgerLens comparison.
- `/demo` has a "What to look for" panel.
- `/ledger` shows a green "Every finalized row is verified" confirmation when verification rate is 100%.
- LinkedIn doc has the full launch package (main post, alternate hooks, comment, DM follow-up).
- README has the new launch-readiness pointers.
- Backend tests stay at 134 passing. Frontend tests grow to cover the new contracts. Build clean. Demo-mode regression test preserved.
