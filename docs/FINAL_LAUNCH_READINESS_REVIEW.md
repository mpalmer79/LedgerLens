# Final launch readiness review

## 1. What changed in this sprint

- **About is now a prominent header item.** "About Michael" sits next to GitHub on the homepage nav, styled in primary text weight (not the previous footer-style secondary). Repeated as a button-style call in the hero CTA row.
- **OG image shipped.** 1200×630 PNG at `frontend/public/og-ledgerlens.png` rendered from a regeneratable SVG source at `frontend/public/og-ledgerlens.svg`. The LedgerLens wordmark, "Messy transactions in. Verified ledger out." headline, trust card ("100% verified finalized demo ledger — workflow-level trust metric"), and the four-card pipeline strip are all on-canvas.
- **Metadata wired.** `app/layout.tsx` now sets `metadata.openGraph.images` and `metadata.twitter.images` to the new PNG. Title and description preserved from the previous sprint.
- **Hero recruiter line added.** "Built by Michael Palmer as a portfolio project demonstrating AI workflow engineering, full-stack development, and practical product thinking." Sits below the CTA row, links to `/about`.
- **Hero CTAs reorganised.** Primary: Start the 3-minute demo. Secondary: Read the technical story. Recruiter: About Michael. External: View GitHub. No equal-weight clutter.
- **Trust card microcopy strengthened.** "100%" is now a 56px display number; the "verified finalized demo ledger" label is uppercase / tracked / brand-700. Explicit "**Workflow-level trust metric — not raw model accuracy.**" sentence. Deliberate "See raw model evals →" link replaces the previous in-sentence reference.
- **`/technical-story` got a Reviewer-takeaway card** at the top and a side-by-side **Typical LLM wrapper vs LedgerLens** comparison table inside the "Why this is not an LLM wrapper" section.
- **`/demo` got a "What to look for" framing panel** above step 1.
- **`/ledger` got a positive confirmation** ("Every finalized row is verified.") when `verification_rate == 100%`. The existing warning when verification is incomplete is preserved.
- **LinkedIn launch package** added to `docs/LINKEDIN_PROJECT_STORY.md`: main post, first comment, line-to-add-after-Loom-recording, screenshot guidance, ten hashtags, three alternate hooks, recruiter DM follow-up, short trust-metric explainer.
- **README launch polish.** Pointer to the technical story; how-to-try-the-demo callout; "Why not claim 100% AI accuracy?" Q&A kept verbatim.

## 2. How About is now surfaced

| Surface | Visibility |
|---|---|
| Homepage top nav | "About Michael" in primary text weight, brand-hover, next to GitHub. |
| Homepage hero CTAs | "About Michael →" button in brand color, below primary CTAs. |
| Homepage About strip | Full-bleed strip below the tech-credibility cards. |
| Homepage footer | "About Michael" link in the right column. |
| `/about` own nav | Self-link (active). |
| `/technical-story` nav | Top-level link. |
| `/evals` nav | Existing. |
| Footer everywhere | Linked from the workflow AppShell footer. |

## 3. How LinkedIn preview is supported

- `og:image` points to `/og-ledgerlens.png` (1200×630, 191 kB, well within LinkedIn's preview cap).
- `twitter:card` set to `summary_large_image` with the same image.
- Title and description are the verified-ledger framing; the word "verified" appears in both, "100% AI accuracy" appears in neither (tested).
- The OG SVG source ships alongside the PNG so it's regeneratable in any future tooling.

## 4. How the homepage guides recruiters

In order of visibility from top to bottom:

1. Nav: "Start the 3-minute demo" pill + clear "About Michael" + GitHub.
2. Hero: business-first headline + trust card showing 100% / verified finalized demo ledger + workflow-level disclaimer + "See raw model evals →" link.
3. Hero CTAs: demo → technical story → About Michael → GitHub.
4. Recruiter-relevance line under CTAs: "Built by Michael Palmer as a portfolio project..."
5. Visual pipeline (`TrustPipeline`).
6. 30-second walkthrough section (Loom-or-placeholder).
7. Three business value cards (small-biz audience).
8. Six tech-credibility cards (recruiter audience).
9. Full About-Michael strip with name, paragraph, LinkedIn + GitHub buttons.
10. Footer with About, GitHub repo, GitHub profile, LinkedIn, technical story.

## 5. How the technical story supports engineering review

- Reviewer-takeaway card sits at the top — the one-card version of the page.
- Six sections: product problem, system architecture (`TrustPipeline`), why-not-LLM-wrapper (with the new comparison table + bullets), stack tags, trust-model side-by-side, what-this-demonstrates.
- Comparison table makes the differentiation skimmable: capability / typical LLM wrapper / LedgerLens, seven rows covering input, decision logic, uncertainty handling, improvement loop, audit, trust metric, cost.

## 6. How honesty is preserved

- 63% / 42% raw model numbers still on `/evals`.
- README's "Why not claim 100% AI accuracy?" Q&A still ends with the explicit numbers.
- Trust card explicitly says "Workflow-level trust metric — not raw model accuracy."
- OG image text reads "100% verified finalized demo ledger" with the caption "Workflow-level trust metric — not raw model accuracy."
- The Loom placeholder still reads "30-second walkthrough coming soon" — it does not pretend the recording exists.
- No email, phone, or resume link anywhere — enforced by `site.test.ts`.
- The Anthropic SDK is still never imported in demo mode (existing regression test preserved).

## 7. What still needs manual work

- Record the 30-second Loom using `docs/LOOM_WALKTHROUGH_SCRIPT.md` and set `NEXT_PUBLIC_LOOM_URL` on Railway.
- Verify the LinkedIn URL slug at `lib/site.ts` is current (`https://linkedin.com/in/michael-palmer`); update if Michael's LinkedIn vanity URL changes before launch.
- Publish the LinkedIn post from `docs/LINKEDIN_PROJECT_STORY.md`; drop GitHub link in the first comment.

## 8. Railway deployment checklist

### Backend service

| Variable | Value | Required |
|---|---|---|
| `CATEGORIZER_MODE` | `demo_stub` | yes — public deploy |
| `DATABASE_URL` | Railway-injected Postgres URL or `sqlite:///./ledgerlens.db` | yes |
| `CORS_ORIGINS` | `https://<frontend-domain>` | yes |
| `ANTHROPIC_API_KEY` | **unset** | do NOT set |

### Frontend service

| Variable | Value | Required |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<backend-domain>` | yes (build-time ARG) |
| `NEXT_PUBLIC_LOOM_URL` | Loom embed URL | optional — placeholder shows if unset |

### Verification (every deploy)

- [ ] `GET /health` returns 200.
- [ ] `GET /ready` returns `checks.categorizer.mode = "demo_stub"`.
- [ ] `GET /demo/status` returns `demo_mode: true`.
- [ ] Homepage hero renders the trust card.
- [ ] `/about` renders LinkedIn + GitHub buttons. No email / phone / resume link anywhere.
- [ ] `/technical-story` renders the Reviewer-takeaway card and the LLM-wrapper comparison table.
- [ ] `/demo` step 6 renders the `<DemoOutcome />` card after the ledger loads.
- [ ] `/evals` shows the 63% / 42% numbers and the trust-boundary callout above them.
- [ ] Favicon loads (no 404 in browser console).
- [ ] `https://www.linkedin.com/post/inspector` resolves the OG image correctly.

## 9. LinkedIn posting checklist

- [ ] Drop the URL into LinkedIn's Post Inspector and verify the OG preview.
- [ ] Copy the main post from `docs/LINKEDIN_PROJECT_STORY.md` (section 9).
- [ ] Replace any placeholder `[LIVE URL]` markers with the Railway URL.
- [ ] If the Loom is recorded, insert it; otherwise keep "3-minute guided demo at [link]" intact.
- [ ] Post.
- [ ] First comment: paste the GitHub link.
- [ ] Pin the post for a week.
- [ ] Send the recruiter DM follow-up template (also in `docs/LINKEDIN_PROJECT_STORY.md`) to two or three target hiring managers.

## 10. Final recommendation: ready / not ready to launch

**Ready to launch.** The remaining manual work (Loom recording) does not block the post — the placeholder is honest and the storyboard is shipped. Three conditions on the Railway side need a one-time human verification (env vars, OG preview, mobile pass) which are scripted above as a 5-minute checklist.

The single most consequential follow-up is **per-tenant rule generation** so the eval page's rules-only / hybrid numbers reflect the real value of the rule layer. That's the next session, not a launch blocker.
