# ADR-0010: Design system architecture

**Status:** Accepted
**Date:** 2026-05-22
**Deciders:** Michael Palmer

## Context

LedgerLens needs a visual identity distinct from VeriFlow (the sibling portfolio project) for portfolio differentiation, and design tokens need to live somewhere that survives the boundary between "documentation" and "running app."

Two pressures compete. First, the design system should be portable — a designer, a future agent, or future-me starting cold should be able to derive UI work from documentation alone, without reading React. Second, the live Next.js app should consume the tokens with no design-system runtime overhead and no extra build step.

The veriflow-design Claude skill already demonstrates the documentation-only side of this pattern, but it's a Claude skill (with `SKILL.md`) rather than a docs folder. For LedgerLens we want the same portability without committing to the skill structure.

## Decision

Two locations, one source of truth:

- **`design/` at repo root** is the documented spec. It contains `README.md` (1500-word narrative of brand direction, content fundamentals, visual foundations, motion vocabulary, and iconography), `tokens.css` (the canonical CSS-variable definitions), `assets/` (the bespoke `logomark.svg` and `ledger-motif.svg`, plus a Lucide icon inventory), and `preview/index.html` (a standalone token-preview page that opens in any browser). The folder is portable — it could be lifted into a Claude skill later by adding a `SKILL.md` without restructuring.

- **`frontend/src/app/globals.css`** is a manual mirror of `design/tokens.css`. The mirror exists because Next.js cannot reach outside `frontend/` at build time. A comment at the top of the `:root` block names the file as a mirror and points back to the canonical source.

- **`frontend/tailwind.config.ts`** extends Tailwind's theme with brand, severity, surface, and text color tokens via the `var(--token)` bridge. Tailwind classes like `bg-brand-600` and `text-text-subtle` resolve through the CSS variables, so swapping a value in `globals.css` propagates automatically without rebuilding Tailwind's class manifest.

The visual choices:

- **Forest green on light surfaces.** Primary `--brand-600 = #2e5f32`, paired with warm off-white page background `#fafaf7`. WCAG AA on both pure white and the page surface.
- **Newsreader (display) + Inter (UI) + IBM Plex Mono (identifiers).** Loaded via `next/font/google` in `layout.tsx`, exposed as `--font-display`, `--font-ui`, `--font-mono`.
- **Horizontal ledger motif.** Three thin parallel lines with transaction-dot markers — different orientation and metaphor from VeriFlow's vertical chain motif.

## Consequences

- **Portable design folder.** Could be lifted into a Claude skill with one `SKILL.md` addition. Could be shared with a designer who reads `README.md` and ignores everything else.
- **No design-system runtime overhead.** The live app uses pure Tailwind — no theming library, no styled-components, no CSS-in-JS runtime.
- **Tokens defined in two places.** `design/tokens.css` and `frontend/src/app/globals.css` must be kept in sync manually. Mitigated by the comment in the mirror file and the small size of each file (under 80 lines). No automated drift check yet; if drift becomes a real cost, a CI step that diffs the two files is the obvious next move.
- **Tailwind-first.** Composition happens via utility classes, not CSS modules. Matches the rest of the project's bias toward boring, well-known wiring.

## Alternatives considered

- **Use the veriflow-design skill directly.** Rejected: VeriFlow ≠ LedgerLens, and a recruiter who clicks both repos would see identical visual systems. The whole point of two portfolio projects is two distinct silhouettes.
- **Inline tokens in `tailwind.config.ts` only.** Rejected: no portable documentation, can't share with non-developers, and the visual language can't be reviewed without spinning up the dev server.
- **Separate package or workspace for design.** Rejected: monorepo overhead premature at this scale.
- **CSS-in-JS or styled-components.** Rejected: against the grain of Tailwind, brings a runtime cost, no clear win.
