# Owner onboarding + portfolio conversion review

## 1. What this sprint shipped

| Layer | Change |
|---|---|
| `/handoff` | Renders `<StaticHandoffSamplePreview>` when the backend errors. Polished Granite State sample so the money-shot page never goes blank. |
| `/start` (new) | Owner-facing five-step path: sample CSV → import → confirm mapping → owner questions → handoff. Includes the full workflow FAQ + a portfolio CTA. Pure static — no backend dependency. |
| `AppShell` nav | Split into two visible groups: **Owner path** (Start / Import / Cleanup / Questions / Handoff) and **Technical** (Demo / Dashboard / Transactions / Review / Mapping / Corrections / Rules / Ledger / Eval evidence). |
| Homepage | New FAQ block + portfolio CTA before the about-Michael strip. Eight buyer-style questions answered plainly; CTA points hiring managers at technical story + GitHub + LinkedIn. |

## 2. Files changed

- `frontend/src/app/start/page.tsx` — new owner-onboarding page.
- `frontend/src/components/app/StaticHandoffSamplePreview.tsx` — new fallback component for `/handoff`.
- `frontend/src/app/handoff/page.tsx` — error branch swaps `ErrorState` for `StaticHandoffSamplePreview`.
- `frontend/src/components/app/AppShell.tsx` — nav split into `OWNER_NAV` and `ADVANCED_NAV`, each with a visible label.
- `frontend/src/app/page.tsx` — added FAQ block, portfolio CTA, and `FaqItem` helper.
- `frontend/src/lib/page-content.test.ts` — 15 new tests covering the four areas above.
- `docs/OWNER_EXPERIENCE_AND_CONVERSION_AUDIT.md` — Phase 1 audit.
- `docs/OWNER_ONBOARDING_AND_CONVERSION_REVIEW.md` (this file).
- Updates: `README.md`, `docs/SMALL_BUSINESS_UX_ROADMAP.md`, `docs/PUBLIC_DEMO_RELIABILITY.md`, `docs/IMPLEMENTATION_GAP_ANALYSIS.md`.

## 3. Static handoff fallback behavior

When `getHandoff()` throws, the page renders `<StaticHandoffSamplePreview>` instead of `<ErrorState>`. The component is hard-coded from the Granite State Auto Repair March 2026 sample:

- Header badge: "Static sample preview — live backend temporarily unavailable".
- Four summary stat cards (transactions imported, procedurally verified, owner-answered, accountant follow-up).
- Reviewed categorization summary — 5 sample finalized rows.
- Questions answered by owner — 3 sample owner answers.
- Owner flagged for accountant review — 2 amber follow-up rows.
- Accountant CSV export explanation — reviewed + follow-up.
- Not-tax-advice disclaimer at the footer + "Static preview rendered because the backend is temporarily unavailable."
- Three CTAs: **Retry live handoff**, **Owner: where do I start?** (→ /start), **Technical story**.

Reviewers and owners both get a presentable page during partial outages instead of a dark spinner / error.

## 4. Owner start-here flow

`/start` ships a five-step workflow (matches the `OWNER_NAV` order):

| # | Title | Primary CTA | Secondary |
|---:|---|---|---|
| 01 | Use the sample CSV or synthetic test data | /demo | /transactions/import |
| 02 | Import and map CSV columns | /transactions/import | — |
| 03 | Confirm category mappings | /mapping | — |
| 04 | Answer plain-English owner questions | /questions | /review |
| 05 | Export the accountant handoff | /handoff | — |

Plus:

- Top-of-page amber warning ("Public demo — use synthetic / sample data only").
- The full nine-question owner FAQ (data testid `start-faq`).
- Portfolio prototype callout with three CTAs (technical story / GitHub repo / about).
- No email / phone / resume / mailto / tel link.
- No commercial signup or pricing copy.

## 5. Navigation changes

The `AppShell` nav was a single 12-link row with no grouping. It's now two labelled rows:

```
Owner path:   Start · Import · Cleanup · Questions · Handoff
Technical:    Guided demo · Dashboard · Transactions · Review queue ·
              Mapping · Learned corrections · Rules · Ledger · Eval evidence
```

Owner path uses brand-emphasis active states; technical uses the muted hover/active states so it visually recedes. Both nav rows scroll horizontally on small screens; technical row uses smaller type to keep the mobile shell clean.

## 6. FAQ changes

Eight buyer-style questions on the homepage (`data-testid="homepage-faq"`); nine on `/start` (`data-testid="start-faq"`):

1. Is this a product I can buy?
2. Can I upload real bank data?
3. Does it connect to my bank?
4. Does it use QuickBooks, Xero, or Plaid?
5. What happens to ambiguous vendors like Amazon?
6. Can my accountant log in?
7. What does "verified" mean?
8. What would production require?
9. (only on `/start`): Where does the data live in this demo?

Each answer holds the production-boundary line — no commercial product claim, no real-bank-data-safe claim, no integration claim that isn't true today.

## 7. Portfolio CTA changes

Two new CTA surfaces:

- **Homepage** — `data-testid="homepage-portfolio-cta"`. Brand-tinted card with copy: "LedgerLens is a portfolio prototype. If you're reviewing Michael Palmer for AI workflow, software engineering, or solutions roles, start with the technical story or the GitHub repo." Three buttons: View technical story / View GitHub / Connect on LinkedIn.
- **/start** — equivalent strip at the bottom of the page so a hiring manager who landed on `/start` (e.g. via the static handoff fallback) gets the same next step.

Neither CTA introduces an email / phone / resume / mailto / tel link. Neither introduces pricing or a "request a demo" form.

## 8. Tests added / updated

| Suite | Before | After |
|---|---|---|
| Backend pytest | 266 | 266 (unchanged) |
| Frontend vitest | 247 | **262** |

15 new frontend tests across four describe blocks:

- `owner /start page` — 6 tests covering step ordering, CTA paths, FAQ contents, public-demo warning, hiring-manager CTA, no overclaim.
- `owner-grouped navigation` — 3 tests covering owner-nav ordering, advanced-nav completeness, visible group labels.
- `homepage FAQ + portfolio CTA` — 3 tests covering the FAQ block, the CTA block, and no commercial conversion.
- `/handoff static fallback (Phase 2)` — 3 tests covering the static sample shape, the integration into `/handoff`, and no overclaim.

All previous tests stay green; `npm run lint`, `npm run build`, and the backend `ruff` / `mypy` / `pytest` runs are all clean.

## 9. Build / test results

- Backend: 266 passed; ruff/mypy clean.
- Frontend: 262 passed; eslint clean; `npm run build` produces the new `/start` route alongside the existing routes.

## 10. Remaining weaknesses

- **Health-dot framing.** The `AppShell` still shows "API: ok" based purely on `/health`. The DemoUnavailablePanel hotfix made the body of `/app` and `/demo` polite, but a casual user can still misread the header dot. The right Phase 2 fix is to drive the header dot from `/demo/ready` (or a combined indicator), not just `/health`.
- **Static handoff is hard-coded.** A real fix would snapshot the live handoff JSON to a file on build and serve it from there. The current static component is good enough for a fallback but it drifts from the live data over time.
- **Mobile nav still scrolls.** The two-row nav fits well on desktop but small phones still get a horizontal scroll on the technical row. A drawer / overflow menu would be cleaner.
- **No re-categorize-after-mapping-edit flow.** Edits at `/mapping` only affect new categorize calls; a "re-run on this month's queue" button would make the editable wizard land better.
- **About / contact path.** `/about` still routes the hiring manager to LinkedIn + GitHub only. A "schedule a 20-minute conversation" via a calendly-style link is the next obvious step but was deliberately deferred to keep the no-email-no-phone contract intact.

## 11. Recommended next PR

Pick the highest-impact item that doesn't pretend the app is commercial SaaS:

1. **Header readiness signal.** Drive the AppShell dot from `/demo/ready` (or a combined check). Add a "see what's affected" pop-out so a not-ready header click takes the user to the same panel `/app` and `/demo` already render.
2. **Build-time static handoff snapshot.** Generate `static-handoff.json` from the live backend during the frontend build and let `<StaticHandoffSamplePreview>` render off that snapshot so the fallback never drifts.
3. **Mobile nav drawer.** A burger menu that pushes the two-group nav into a vertical overlay would scale better than the current horizontal scroll on small phones.
4. **Saved CSV import profiles.** Lets a returning owner skip the column mapping step. Pairs naturally with the new `/mapping` persistence.

The blunt recommendation: do (1) next — the audit specifically called out that the header dot misled the most recent reviewer.
