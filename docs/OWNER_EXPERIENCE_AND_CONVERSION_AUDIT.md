# Owner experience and conversion audit

A blunt audit of the public-demo experience from the perspective of
a busy small-business owner — and what the portfolio surface needs
to convert a hiring manager who lands from LinkedIn or a referral.

## 1. What works for technical reviewers

- **Honest framing.** Homepage + README + technical-story page say
  "portfolio demo, not production accounting software" up front.
- **Eval evidence.** `/evals` ships real numbers (rules-only 0% on
  the eval set, hybrid-rules-model improves it) instead of a single
  cherry-picked metric. The methodology callout next to the
  rules-only row keeps the framing intact.
- **Code-level depth.** `/technical-story`, `docs/`, and the
  `mpalmer79/LedgerLens` repo together give a reviewer enough to
  judge: model + DB + migration + auth-foundation work, all backed
  by 250+ backend tests and 240+ frontend tests.
- **Workflow honesty.** Trust metric is workflow-verified, not
  CPA-verified; that distinction survives in every export, badge,
  and disclaimer.

## 2. What fails for a busy small-business owner

- **The header lies in their head.** When `/health` says "API: ok"
  but `/demo/status` fails (the recent incident), an owner reads
  "API: ok" as "the demo works", clicks `/demo`, and hits an
  unhelpful error. The hotfix made the failure mode polite but
  didn't change the header signal.
- **`/handoff` is the money shot but it can be blank.** A reviewer
  who lands on `/handoff` while the backend is partially out sees
  a `LoadingState` → `ErrorState` and never sees what the handoff
  *looks* like. The page that should sell the product never
  renders.
- **No obvious "start here".** The nav has 12 items and `/app`
  loads as the default after the marketing site. An owner with 7
  minutes does not know whether to open `/demo`, `/cleanup`,
  `/transactions/import`, or `/questions` first.
- **No graceful static fallback.** Every workflow page assumes the
  backend will answer. When it doesn't, the page goes dark.
- **No FAQ.** "Can I upload real bank data?" "Does this integrate
  with QuickBooks?" "What's the catch?" — the answers live in
  scattered docs, not on the page the owner is reading.
- **No conversion target.** A hiring manager reading the homepage
  finds GitHub + LinkedIn at the bottom but no explicit "here's
  what to do if you're hiring" callout.

## 3. Where the app creates choice overload

- AppShell nav: 12 links in one row. No grouping.
- Homepage CTAs: 4 different "start" buttons (Cleanup, Demo,
  Handoff, Technical story).
- `/cleanup` shows a 6-step checklist that is itself an entry
  point — competing with "Start with sample CSV".

## 4. Which pages need static fallback

| Page | Today on backend outage | Should be |
|---|---|---|
| `/handoff` | LoadingState → ErrorState. Page is dark. | Static sample preview labelled "Live backend unavailable" + retry button. The pictures sell the product. |
| `/app` | Renders `<DemoUnavailablePanel>` (recent hotfix). | Keep as-is. |
| `/demo` | Renders `<DemoUnavailablePanel>` (recent hotfix). | Keep as-is. |
| `/start` (new) | n/a | Pure static; no backend dependency. |
| `/transactions/import` | Static UI works; only `/import` POST hits backend. | Already OK. |

`/handoff` is the priority — it's the page hiring managers and
owners both want to see.

## 5. Which workflow questions are unanswered

The "I'm a busy owner — am I going to waste my evening?" questions:

1. Is this a product I can buy? (No — portfolio.)
2. Can I upload real bank data? (No.)
3. Does it connect to my bank? (No.)
4. Does it use QuickBooks / Xero / Plaid? (No.)
5. What happens to ambiguous vendors like Amazon? (Routed to review.)
6. Can my accountant log in? (Not yet — auth Phase 2.)
7. What does "verified" mean? (Workflow-procedural, not CPA-correct.)
8. Where does the data live in this demo? (Synthetic + the public
   Railway Postgres; no real PII.)
9. What would production require? (Auth, tenant isolation, PII
   redaction before LLM, backup, retention, payment integration.)

These are answered across docs but nowhere on a buyer-facing page.

## 6. What portfolio conversion should mean

"Portfolio conversion" here means: when a hiring manager or
prospective collaborator lands on the site, they should reach the
right next step within one screen.

The right next steps are:

- **View technical story** — `/technical-story`.
- **View GitHub repo** — `https://github.com/mpalmer79/LedgerLens`.
- **Connect on LinkedIn** — Michael's public profile (already on
  `/about`).

What conversion explicitly should **not** become:

- Email / phone / resume download — would conflict with the no-PII
  rule the rest of the site holds to.
- Pricing or "request a demo" — would imply commercial SaaS.
- Contact form — same issue.
- "Sign up" — same.

## 7. Acceptance criteria

1. `/handoff` always renders a presentable page, even with the
   backend down.
2. A new `/start` page (or `/cleanup` repositioned as Start)
   walks an owner through a five-step path: sample CSV → import →
   confirm mapping → owner questions → handoff export.
3. The AppShell nav groups the owner path explicitly and pushes
   advanced / developer routes into a secondary group. Mobile nav
   stays clean.
4. A workflow FAQ on the homepage (or `/start`) answers the nine
   questions above with plain English.
5. A tasteful portfolio-conversion CTA on the homepage points
   hiring managers at `/technical-story` + GitHub + LinkedIn.
6. No new email / phone / resume / mailto / tel links anywhere.
7. No "buy" / "pricing" / "request demo" copy.
8. Public-demo and not-tax-advice disclaimers intact.
9. Tests pin every contract above.
