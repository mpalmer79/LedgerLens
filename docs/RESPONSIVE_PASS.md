# Responsive design pass

## Why this sprint

LedgerLens is going on LinkedIn. The first impression for most recruiters will be on a phone, opened from the LinkedIn app, while standing in a hallway. The previous public surfaces were desktop-first and would have broken at narrow widths in two specific places:

1. **Public top nav.** The homepage, `/about`, and `/technical-story` each rendered a six-link row inline with the logomark. Below ~720 px those links wrapped under the logo, sometimes overflowed off-screen, and made "About Michael" easy to miss.
2. **Wide comparison table on `/technical-story`.** The "Typical LLM wrapper vs LedgerLens" three-column table fit fine ≥ 640 px and required horizontal scrolling on narrower phones — readable but unpleasant.

Everywhere else, the existing layout was already responsive enough: app workflow tables already wrapped in `overflow-x-auto` containers, the demo journey card stacks its CTAs and step counters, the AppShell nav was scrollable, the trust panel and pipeline cards used grid templates that collapse to one column on mobile, and the generated walkthrough is locked to a 16:9 aspect ratio so it shrinks with the viewport instead of overflowing.

## What changed

| Surface | Before | After |
|---|---|---|
| `/`, `/about`, `/technical-story` public nav | Six inline links + logomark, no mobile collapse | New shared `MarketingNav` component: full inline row at ≥ md, compact "Demo →" CTA + hamburger sheet below md |
| Homepage hero h1 | Fixed `text-4xl md:text-5xl` (could clip at 360 px) | `text-[clamp(28px,7vw,48px)]` so it scales fluidly between phones and desktops |
| Homepage trust-card "100%" | Fixed `text-[56px]` | `text-[clamp(40px,10vw,56px)]` |
| Homepage section padding | `px-8` everywhere | `px-4 sm:px-6 lg:px-8` rhythm |
| `/about`, `/technical-story` h1 | Fixed `text-4xl` | `clamp(28px,6vw,40px)` |
| `/about`, `/technical-story` main padding | `px-8 py-16` | `px-4 py-12 sm:px-6 sm:py-16 lg:px-8` |
| `/technical-story` LLM-wrapper comparison | Horizontal table at all widths | Stacked per-row cards on mobile, original table at `sm:` |
| AppShell nav (workflow pages) | `flex flex-wrap overflow-x-auto` — wrapped weirdly on mobile | `flex-nowrap whitespace-nowrap overflow-x-auto` on mobile, wraps cleanly at `sm:` |
| AppShell container | `px-6` | `px-4 sm:px-6` |
| Page roots | None | `overflow-x-hidden` on public-page roots prevents accidental horizontal scroll from gradient blobs in the trust card |

## What did NOT need changes

- **`/walkthrough`** — already wraps the animation in an `aspect-ratio: 16/9` box that scales with the viewport.
- **`/demo`** — already uses `flex-wrap` for the step header + storyboard; the trust panel's tile grid is `grid-cols-2 sm:grid-cols-4` which is mobile-safe.
- **`/app`** — empty-state cards already do `grid-cols-1 sm:grid-cols-3`; metric tiles already do `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`.
- **`/transactions`, `/corrections`, `/rules`, `/ledger`, `/evals`** — every wide table is wrapped in `overflow-x-auto` and the rest of the page is grid-based. Horizontal scrolling for dense tables is the right call on mobile; cards would lose alignment and obscure scanning.

## Breakpoints verified

- Mobile portrait 360 – 430 px — public nav collapses to hamburger; hero h1 and trust number scale; section padding shrinks to 16 px.
- Mobile landscape 568 – 740 px — same as portrait until 768 px.
- Tablet portrait ≈ 768 px — `md:` kicks in: public nav goes inline; section padding becomes 24 px.
- Tablet landscape ≈ 1024 px — `lg:` kicks in: trust card sits beside the hero copy, six-card tech grid spreads to three columns, section padding becomes 32 px.
- Desktop ≥ 1280 px — `max-w-6xl` caps the inner width; everything reads at its design size.

## Tests

- New `MarketingNav.test.tsx` (4 tests) pins the contract:
  - Desktop row contains every required link (Demo, Technical Story, Evals, App, About Michael, GitHub).
  - Mobile cluster renders the compact "Demo →" CTA + an accessible hamburger toggle with `aria-controls="marketing-mobile-menu"`.
  - The desktop row carries `hidden ... md:flex` (hidden below md).
  - The mobile cluster carries `flex ... md:hidden` (hidden at md+).

Total frontend tests: **51 passed** (was 47, +4). ESLint clean. `next build` clean. Backend untouched: **134 passed**.

## Acceptance check

| Requirement | Status |
|---|---|
| No public page has horizontal overflow at common mobile widths | ✓ (public-page roots set `overflow-x-hidden`; tables remain scrollable inside their containers) |
| Header / nav works on phone and tablet | ✓ (`MarketingNav` with hamburger; AppShell with horizontal-scroll nav on mobile) |
| About link remains discoverable | ✓ (top-level on desktop in `font-medium` weight; second item in the mobile sheet) |
| Homepage video / generated walkthrough looks polished on mobile | ✓ (16:9 container, animation locked to that box) |
| Trust metric readable on mobile | ✓ (clamp-scaled number; surrounding card collapses to full width below `lg:`) |
| App workflow pages usable on mobile | ✓ (AppShell nav scrollable; tables already wrapped; CTA groups already wrap) |
| Tables handled responsibly | ✓ (LLM-wrapper table → stacked cards on mobile; data tables stay scrollable inside their containers) |
| Tablet layouts feel intentional | ✓ (md/lg/xl breakpoints used throughout) |
| Build + tests pass | ✓ |
