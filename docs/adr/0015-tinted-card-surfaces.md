# ADR-0015: Tinted card surfaces for brand cohesion

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

The landing and `/evals` pages used `bg-surface-panel` (`#ffffff`) card surfaces on a `bg-surface-page` (`#fafaf7`) background — pure white cards on a very-pale warm-off-white page. The visual contrast was technically present (a few luminance points) but practically invisible: cards floated against the page without weight, and the overall composition read as "white-on-white" rather than as a cohesive branded surface system.

The eval CTA card on the landing page already used `bg-brand-50` with a `brand-100` border to signal "this is the most important link on the page." That signal was meaningful only because every other card was white. If every card moves to a green tint, the CTA's brand-50 wash becomes indistinguishable from its neighbors.

## Decision

Every card surface across the frontend shifts to `bg-brand-100` (`#dceadd`) with a `border-brand-200` (`#b8d4ba`) hairline border. The eval CTA card is reinforced separately:

- Background: `bg-brand-100` (same as every other card)
- Border: `border-2 border-brand-600` — the only place a 2px border appears on the site, used as the project's "featured" convention
- A small "Featured" label above the headline (`bg-brand-600` background, white text, uppercase 10px, rounded-full)

The page background remains `bg-surface-page` — cards now have a clear ~2:1 luminance gap against it, so they read as raised surfaces rather than recessed panels.

Chart containers on `/evals` (Recharts) sit on `bg-brand-100` with the existing brand-600 bars and scatter points. Contrast of brand-600 (`#2e5f32`) against brand-100 (`#dceadd`) is ~5.3:1 — solidly within WCAG AA — so the data series remain crisp. Axis label color (`text-subtle`) is technically tighter on the tinted background (~3.7:1, AA Large), but axis labels are fine-print reference scale, not primary content.

## Consequences

- **The pages now read as forest-green-themed rather than generic white-app.** Cards have visible weight and feel like distinct surfaces of the same family.
- **Brand identity is stronger throughout.** A visitor scanning either page sees green in the cards, not just the buttons.
- **The 2px CTA border is an explicit exception.** It's the only place 2px borders appear on the site. ADR-0015 names this exception so future contributors don't replicate it without thinking.
- **Recharts contrast was verified, not adjusted.** Brand-600 data colors stay; only the wrapper moved. If contrast feels marginal in production, the follow-up is an inner `bg-surface-panel/60` panel around each chart.
- **Tint depth is at the high end of "subtle."** Anything lighter doesn't solve the white-on-white problem.

## Alternatives considered

- **Brand-50 subtle tint (`#f0f7f1`).** Rejected: not visible enough to solve the white-on-white problem; the original eval CTA used this and the audit still flagged the page.
- **Brand-50 cards with brand-100 borders.** Rejected: same issue. Fill is the load-bearing element.
- **Keep some cards white and tint others.** Rejected: inconsistent design language; readers would learn a rule with no semantic content.
- **Deepen the page background instead of the cards.** Rejected: cards are the visual focus and should carry the color.
