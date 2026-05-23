# Final conversion review — session 19

## 1. What changed

| Surface | Before | After |
|---|---|---|
| Landing `/` | Verified-ledger headline existed, but the hero had no trust card, no visual pipeline, no video, no About strip. | Premium trust-boundary card in the hero. Reusable `<TrustPipeline />` row. 30-second Loom section (with polished placeholder). About-Michael strip. Three business value cards + six tech-credibility cards. Footer scrubbed. |
| `/demo` step 6 | Trust panel rendered, but no explicit verdict card. | New `<DemoOutcome />` summary card that flips its copy depending on `verification_rate`: "Every finalized row is verified before export" vs "Finish review to reach a fully verified demo ledger." Step header now reads "verified ledger, not an AI answer." |
| `/ledger` | Trust panel above the table; export button identical regardless of verification. | When `unverified_finalized_count > 0`, a red warning panel + `window.confirm()` on the export button + amber button styling. Honest export still allowed. |
| `/app` empty state | Two-card "Start here" panel. | Three-card empty state: **Start guided demo** (recommended) + **Import transactions** + **View technical story**. Explicit "Start with a guided bookkeeping cleanup demo" framing. |
| `/evals` | Honesty callout present. | New trust-boundary callout *above* the honesty callout, with side-by-side Model-metric vs Product-metric cards and a link to `docs/TRUST_METRIC.md`. Existing model-only numbers preserved. |
| `/about` | Did not exist. | New route. Michael's intro, role targets, six background cards, project-connection block, LinkedIn + GitHub buttons. No email, no phone, no resume link. |
| `/technical-story` | Did not exist. | New route. Six sections: product problem, system architecture (uses `TrustPipeline`), why-not-an-LLM-wrapper bullets, stack tags, trust-model side-by-side, what this demonstrates. |
| Metadata | Title "LedgerLens", description "AI-assisted transaction categorization for bookkeepers." Favicon 404. | Title "LedgerLens \| Verified AI-Assisted Bookkeeping Workflow", verified-ledger description, OpenGraph + Twitter cards set. SVG favicon shipped at `/public/favicon.svg`. |
| LinkedIn / GitHub | Inlined in one page. | Centralised in `lib/site.ts` (`LINKEDIN_URL`, `GITHUB_PROFILE_URL`). Site-wide test guarantees no email / phone / resume link slips into shared constants. |

## 2. Why the previous experience was not enough

The verified-ledger metric existed in the API and the trust panel rendered on `/demo` and `/ledger` — but a cold visitor on `/` couldn't see it. The hero still relied on the headline being "Turn messy bank transactions into a reviewed small-business ledger," which was correct but generic. The trust number was buried two clicks deep. There was no visual representation of the pipeline anywhere on the public surface, no recruiter-facing About page, no Technical Story page, and the empty `/app` state still felt like a dead end. Recruiter-grade portfolio products lead with the trust signal in the hero. This sprint moves it there.

## 3. How the homepage now sells the product

- **First 5 seconds** — a small-business owner reads "Turn messy bank transactions into a verified small-business ledger" and the trust card next to it.
- **First 15 seconds** — they read the three value cards (save time, reduce mistakes, learn from corrections) and see the visual pipeline.
- **First 30 seconds** — the Loom section (or polished placeholder) explains the workflow in a recording or storyboard.
- **First 60 seconds** — they see the six tech-credibility cards, click "Start the 3-minute demo →" or "See the engineering story," and convert.

## 4. How the About page sells Michael

- Opens with "About Michael Palmer" and a paragraph that names the pivot (automotive ops → CS / AI).
- Two prominent buttons: **LinkedIn** + **GitHub**. No email, no phone, no resume link.
- A "What I'm looking for" call-out names the role types: AI engineering, applied AI, solutions engineering, full-stack, AI workflow automation.
- Six background cards that connect his automotive / CDK Global / implementation history to the LedgerLens project.
- "Why LedgerLens" block explicitly states the kind of system he wants to build professionally.
- Footer clarifies that PalmerAI Solutions is his personal brand, not a SaaS company.

## 5. How the demo explains the workflow

The 7 narrative steps are unchanged, but step 6 now ends at:

> **Every finalized row in this demo ledger is verified before export.**

(Or, if unverified rows remain, "Finish review to reach a fully verified demo ledger.")

That conclusion is what a viewer carries away. The metric updates in real time from the persisted database — no mocked numbers.

## 6. How the trust metric is positioned

| Where | How it shows up |
|---|---|
| `/` hero | Premium gradient card. The product's headline number. |
| `/demo` step 6 | `<TrustPanel variant="demo" />` + `<DemoOutcome />` verdict card. |
| `/ledger` | `<TrustPanel />` at the top + warning banner + export-confirmation when unverified rows exist. |
| `/evals` | Side-by-side **Model metric / Product metric** card explaining the distinction. |
| `/technical-story` | Section 5: Trust model. Same side-by-side framing. |
| README | Headline. "Why not claim 100% AI accuracy?" Q&A directly below. |
| `docs/TRUST_METRIC.md` | Full contract. Linked from every surface above. |

## 7. How eval honesty is preserved

- `/evals` still shows raw model accuracy (~63% overall, ~42% adversarial).
- The new trust-boundary callout *adds* to the page, doesn't replace anything.
- The committed JSON artifacts under `evals/runs/` are unchanged.
- The tenant-COA caveat for rules-only / hybrid modes is still surfaced.
- The README's "Why not claim 100% AI accuracy?" answer ends with the explicit ~63% number.

## 8. Remaining weaknesses

- **No real Loom recording yet.** The placeholder is intentional and stylish, but the section will be more compelling once `NEXT_PUBLIC_LOOM_URL` is set. The script is shipped at `docs/LOOM_WALKTHROUGH_SCRIPT.md` so Michael can record on his own time.
- **No per-tenant rule generation.** Rules-only and hybrid eval modes still score 0% on the synthetic dataset because the bundled rules target the default seed COA. This is documented honestly but remains the next-best PR.
- **No social preview image.** OpenGraph metadata exists, but there's no `og:image`. A 1200×630 PNG ships in a follow-up PR.
- **`/app` auto-redirect.** First-time visitors still have to click "Start guided demo" on the empty-state. A real product would push them automatically when `transaction_count == 0`.
- **3D transaction-carousel** is still retired. Worth bringing back as a below-fold accent.

## 9. Next recommended PR

**Per-tenant rule generation.** A small CLI that, given a target business's COA, maps each bundled rule's category code to the closest equivalent in that COA by name + type. Then re-run the rules-only and hybrid eval modes per business. That turns the 0% rules-only number into a meaningful one and proves the rule layer's real value on benchmark data. Pairs naturally with a small `og:image` so the LinkedIn share preview lands well.

## 10. Final self-grade

| Dimension | Before this PR | After |
|---|---|---|
| Hero clarity (small-biz owner) | B: headline correct, but no trust card | A: trust card next to headline; verified-ledger value is the first read |
| Hero clarity (recruiter) | C+: no visual pipeline, no About strip, no Loom | A-: pipeline, About strip, video section, six tech cards above the fold |
| About-the-builder presence | F: did not exist | A: dedicated page + homepage strip + footer |
| Technical depth signal | C: buried in docs | A-: `/technical-story` exists, linked from hero + footer |
| Trust metric visibility | C: lived on /demo and /ledger only | A: hero, demo, ledger, evals, technical-story, README, dedicated doc |
| Empty-state UX | B: two-card start | B+: three-card explicit start including "View technical story" |
| Ledger export safety | C: no warning | B+: warning panel + confirmation when unverified rows exist |
| Honesty preservation | A: already strong | A: 63% number still on `/evals`, called out in README, called out on the trust-boundary card |
| Code quality | A | A: 134 backend / 29 frontend tests, ruff/format/mypy/lint/build all clean |

The thing it most still needs is a recorded Loom + per-tenant rule generation. Both are scoped as separate follow-ups so this PR can land clean.
