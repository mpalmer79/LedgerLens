# ADR-0014: Two-faced transaction cards

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

The 3D carousel from [Session 9b](0013-3d-hero-animation.md) showed transaction cards with a single face: vendor + amount + a category chip, anchored by a generic `TRANSACTION` header label. A site audit flagged the header as visual noise and noted the bigger problem: the card showed *what gets fed into* LedgerLens but not *what LedgerLens does with it*.

The hero animation's job is to demonstrate the product's value, not just illustrate a data shape. Calibrated confidence, routing-to-review on ambiguity, and explanation-bearing categorizations are the project's positioning. The previous card conveyed none of those — viewers saw an animated list of bank charges with category tags.

## Decision

Two-faced card design. Each transaction card carries an Input face and a Decision face, both rendered as 512×320 canvas textures applied to opposite Z-sides of the same `BoxGeometry`.

- **Input face** — date (mono), masked account number (mono), vendor (Georgia serif, 38px), amount (mono, 30px), hairline divider, italic memo line. No header text. This is what arrives from the bank.
- **Decision face** — category pill (forest-green for `Auto-posted`, warm amber for `Review queue`), CONFIDENCE micro-label and 2-decimal numeric, filled confidence bar (same color as pill), one-line italic rationale, status badge with dot and label at bottom. This is what LedgerLens emits.

Cards flip 180° around their Y axis once per revolution, timed so the flip happens at the back arc — a ~70° window centered on the angle where the card is invisible to the viewer. The result: at any moment, roughly half the front-arc cards show Input and half show Decision. A viewer watching the hero for ten seconds sees the input → decision pipeline play out across the visible cards without needing to track any single one. The flip itself is never visible.

Two of the twelve cards use `Review queue` status (State Farm, Claude API). Those carry amber and warm-orange tokens — the same accent that signals confidence routing throughout the design system. The human-in-the-loop pattern is now visible in the hero without any text in the surrounding layout having to mention it.

## Consequences

- **The hero now demonstrates the product.** A viewer watching for ten seconds sees the input → decision story plus two amber cards signalling that not everything gets auto-posted.
- **Doubles canvas texture cost.** 24 textures across 12 cards (~15 MB GPU memory). Acceptable; `setPixelRatio(min(devicePixelRatio, 2))` already caps retina cost.
- **Animation math is slightly more involved.** Flip timing computes `angleInRev mod 2π` and a `revolutionCount` per card so the flip alternates direction each revolution. Constant work per frame, no allocations.
- **Card content is hardcoded.** If cards ever need to come from real eval outputs, that's a future refactor — no urgency at the v0 portfolio scope.
- **`TRANSACTION` header watermark is gone.** The absence is the design.

## Alternatives considered

- **Keep the single-face card but enrich its content.** Rejected: the input → decision story is the project's differentiator and deserves the real estate. A richer single face couldn't carry both halves.
- **Make the decision face the only face.** Rejected: skips the input → decision pipeline; viewers see only the output without the prompting input.
- **Animate the flip on hover.** Rejected: the hero is decorative and `pointer-events-none`; hover-driven interactivity contradicts the "ambient demonstration" framing.
- **Texture-swap on a flat plane rather than a geometric flip.** Rejected: the flip *is* the moment the input becomes a decision; baking it into geometry is the cleaner mental model.
