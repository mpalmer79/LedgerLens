# ADR-0013: 3D hero animation via Three.js

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

The landing page from [Session 9](0012-landing-page-as-portfolio-artifact.md) establishes the project's positioning verbally — eyebrow, two-line headline in Newsreader, subhead, CTAs — but the right half of the hero was visually empty except for a static SVG ledger motif. The verbal pitch is correct; the visual real estate is not pulling its weight.

A recruiter who reaches the live URL sees the verbal pitch and then a low-information decoration. The hero needs a visual that demonstrates the product in motion: real-shaped transactions, the routing-to-review pattern made concrete. An animated 2D illustration would work but matches VeriFlow's tech (Framer Motion) and reduces portfolio differentiation between the two sibling projects.

Competing pressures: a 3D animation adds bundle weight and CPU/GPU cost on slower devices; the implementation must handle SSR and clean up WebGL resources to avoid memory leaks; mobile and reduced-motion users need graceful degradation rather than a stuttering or absent hero.

## Decision

A Three.js carousel of twelve hardcoded small-business transactions on a horizontal circular conveyor. The scene:

- Rotates slowly (one revolution every ~28 seconds) so both the front-arc and back-arc of cards are visible.
- Cards display vendor, amount, and a category chip. Ten chips are forest-green ("Software", "Utilities", "Revenue", etc.); two are warm amber ("Review queue"). The amber chips make the human-in-the-loop routing pattern visible at a glance without any accompanying text.
- Opacity ramps with depth — front-arc cards are opaque, back-arc cards translucent — so the foreground reads cleanly.
- Camera breathes subtly (sinusoidal X/Y drift) to avoid a static feel.

Implementation details: Three.js 0.160 imported directly (no React Three Fiber for this scope), SSR-safe via `useEffect` initialization, alpha-blended WebGL renderer over the CSS-gradient page background, capped pixel ratio at 2 to bound retina cost, `ResizeObserver` for container-size changes.

Graceful degradation: when `prefers-reduced-motion: reduce` matches, when the viewport is ≤768 px wide, or when `document.body.data-disable-3d="true"` is set, the component renders the static `<LedgerMotif />` from Session 8 instead of mounting WebGL at all.

## Consequences

- **Hero conveys product purpose without text.** A visitor sees transactions cycling through, with two flagged for review, before reading a word.
- **Visual differentiation from VeriFlow.** Three.js + WebGL is distinct from VeriFlow's Framer Motion + SVG, so the two portfolio projects look like the work of someone reaching for the right tool, not running the same template twice.
- **Bundle weight: +~128 KB First-Load JS.** Three.js's tree-shaken footprint for this scene. Acceptable for a portfolio piece where engagement matters more than absolute Lighthouse score.
- **Mobile and reduced-motion fall back cleanly.** No WebGL initialization runs on mobile (<769 px) or with reduced motion preference. The static SVG that already shipped in Session 8 carries those users.
- **Memory-cleanup discipline is now load-bearing.** The component disposes geometry, materials, textures, the renderer, and the canvas DOM node on unmount. Without that, navigating between pages would leak WebGL contexts.

## Alternatives considered

- **Pure CSS + SVG animation.** Rejected: 2D can't deliver the depth and parallax the hero needs.
- **Framer Motion + animated SVG.** Rejected: matches VeriFlow's tech, undermines the portfolio differentiation goal.
- **Static SVG illustration.** Rejected: this is what we already had; the whole point of this session is replacing it.
- **Lottie animation.** Rejected: requires designing the animation in After Effects or Bodymovin, out of scope for this session.
- **React Three Fiber.** Deferred: thin wrapper over Three.js, adds dep surface without clear benefit at this scale. Worth adopting later if the 3D footprint grows beyond this hero.
