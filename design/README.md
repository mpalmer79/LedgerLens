# LedgerLens — Design system

This folder is the canonical source for what LedgerLens looks like and why. It is intentionally readable without opening any React code. Designers, future agents, or future-me starting cold should be able to derive any UI work from the documents in this folder.

Wiring into the running Next.js app lives in `frontend/`. Tokens in `frontend/src/app/globals.css` are a manual mirror of `tokens.css` in this folder; the comment at the top of the mirror points back here. ADR-0010 records the two-location pattern.

## What LedgerLens is

LedgerLens categorizes bank and credit-card transactions against a per-business chart of accounts. Each decision carries a calibrated confidence score and a short reasoning trace; low-confidence and ambiguous decisions route to a human review queue, and corrections feed back as retrieval signal for future categorizations. It is a focused assistive tool for bookkeepers — not a general ledger, tax-filing, or payroll system.

The product is operator-facing. The audience is a working bookkeeper or accountant — someone who knows what a chart of accounts is, who has opinions about how a coffee importer invoice should be coded, and who will lose trust the moment the system feels glib about a hard decision. The design has to read as competent and serious without being austere, because part of the product's job is to be usable for hours at a stretch.

## Brand direction

**Color story.** Forest green as primary signals financial trust without leaning on the navy-blue banking cliché. The shade chosen (`#2e5f32` at `--brand-600`) is dark enough for WCAG AA against both pure white and the off-white page surface, but warm enough to feel like an organization that cares about craft rather than an institution that fears mistakes. Paired with warm off-white surfaces (`#fafaf7`, not pure white) so the product reads as living material rather than fluorescent-lit spreadsheet software.

A single accent — warm amber, `#b8862e` — is reserved for confidence indicators and the auto-categorized vs. review routing chip. Amber sits at the boundary between green ("we got this") and red ("we don't"), and the routing call lives at exactly that boundary. Using it anywhere else would dilute the signal.

**Distinct from VeriFlow.** VeriFlow is the sibling project: deep navy dark mode + teal accent + vertical chain motif. LedgerLens is light + forest green + horizontal ledger motif. Both stick to the same content-fundamentals and motion-vocabulary patterns because those are project-independent operator-software properties, but every visual signal a recruiter notices in the first three seconds — surface lightness, hue, motif orientation, type personality — is different.

**Visual motif.** A horizontal sequence of three thin parallel lines with subtle dot markers, rendered as the SVG in `assets/ledger-motif.svg`. The lines read as ledger rows; the dots read as transaction entries. In the live product the motif animates on page load — lines fade in left-to-right with 80ms stagger, dots pulse once — replacing VeriFlow's vertical chain animation. The animation lives in JSX (Framer Motion); the SVG file is static source.

**Logomark.** Two short horizontal ledger lines with a transaction dot at the right end of each and a subtle connecting sweep between the dots. Reads as an `L` (for "ledger") sketched out of ledger entries themselves. Bespoke SVG in `assets/logomark.svg`. Always renders in `--brand-600` unless inverted on a brand surface.

**Typography pairing.** Three families, each chosen for what it has to do:

- **Display: Newsreader.** Serif. Carries the gravitas of the bookkeeping audience without the editorial overcorrection of Fraunces. Used for page H1s, marketing taglines, and the rare large pull-quote. Loaded via `next/font/google`.
- **UI: Inter.** Sans-serif. The right tool for body, controls, table headers, and labels. Same family VeriFlow uses, deliberately — UI workhorse fonts don't need to be different to differentiate the brand.
- **Mono: IBM Plex Mono.** For identifiers, account codes, transaction IDs, and JSON output. Chosen over JetBrains Mono (VeriFlow's mono) for its financial-software heritage and slightly warmer letterforms.

**Voice and tone.** Same operator-facing register as VeriFlow but with a slightly more inviting edge appropriate to bookkeeping. Sentence case throughout. Identifier discipline — transaction IDs, account codes, run IDs render in mono. No emoji. Tabular numerals everywhere figures are displayed so columns of dollars and percentages line up cleanly. Example tagline: *"Categorization you can trust. Calibration you can prove."*

## Content fundamentals

These are the invariants that survive any visual revision.

- **Sentence case.** Headings, labels, buttons. No title case. "Run eval" not "Run Eval".
- **Identifier discipline.** Any string a human did not write — transaction IDs, account codes, run IDs, file paths, model names — renders in mono. The eye must be able to find the unique-looking thing on the page in under a second.
- **Tabular numerals.** Enabled globally via `font-variant-numeric: tabular-nums`. Columns of dollar amounts, percentages, and counts align by digit position.
- **Specificity over hype.** "9.27%" not "low"; "$0.68 per run" not "low cost"; "302 transactions, 31 adversarial" not "comprehensive coverage". Numbers, not adjectives.
- **No emoji.** Anywhere. Status, severity, and route information come from icons (Lucide) and color, never from glyphs.
- **Voice is second-person, present-tense, terse.** "Trigger from the Actions tab." Not "You may trigger this from the Actions tab if you wish."
- **Reasoning gets a paragraph; conclusions get a sentence.** The product surfaces *why* a categorization was chosen; that's part of the value. But the why is supporting copy, not the lead.

## Visual foundations

**Color.** Tokens defined in `tokens.css`. Three families:

- **Surfaces** (`--surface-*`) — page background, panel, sunken inputs, hairline borders.
- **Brand** (`--brand-{50..900}`) — forest green nine-stop scale. Primary CTA at `--brand-600`. Hover usually `--brand-500` or `--brand-700`; pick by context.
- **Severity** (`--severity-{low,moderate,high,critical}`) — used only for actual severity signaling (routing chips, alert states). `--severity-low` aliases `--brand-600` so the "all clear" state stays on-brand.

Text colors form a four-step ramp: primary (body), secondary (supporting copy), subtle (metadata and field labels), disabled. Never use brand colors for body text.

**Type scale.** Built from Tailwind's defaults, no custom scale. Display uses Newsreader at `text-4xl`/`text-5xl` for landing-page heroes; H2 and below use Inter. Inline code, account codes, and run IDs use IBM Plex Mono at the same line height as surrounding text.

**Spacing.** Tailwind's default 4px-base scale. Pages target 64px between top-level sections, 32px between subsections, 16px between related rows. Dense tables can compress to 8px but never below 4px.

**Radii.** Three steps: `--radius-sm` (4px) for inline elements like badges and chips; `--radius-md` (6px, the default) for buttons, cards, and form fields; `--radius-lg` (10px) for full panels and modals. Avoid `--radius-full` except for icon-button affordances.

**Backgrounds.** No full-bleed photography anywhere. The `ledger-motif` is the only ambient decoration; everything else is solid surface color with hairline borders. Cards and panels sit on `--surface-page` with `--surface-panel` fill and `--surface-border` outline.

**Shadows.** Restrained, light-theme appropriate. The shadow tokens (`--shadow-sm`, `-md`, `-lg`) all tint toward `rgba(20, 42, 22, ...)` — a slightly green-leaning shadow — to keep the brand quietly present in elevation effects. Used sparingly; most surfaces don't elevate.

**Motion.** Same motion vocabulary as VeriFlow but slightly shorter durations because bookkeeping software should feel snappy, not contemplative. Four durations: `--duration-micro` (100ms) for tooltips and focus rings; `--duration-short` (180ms) for buttons, hovers, and chip changes; `--duration-medium` (300ms) for accordion expansions and tab transitions; `--duration-long` (500ms) for entrance animations like the ledger motif. Easing is `--ease-out-expo` for entrances, system default for hovers.

All animations respect `prefers-reduced-motion: reduce` — the rule lives in `globals.css` and clamps durations to near-zero while preserving final states.

## Iconography

Lucide-react throughout. Stroke-width 1.5 for in-text icons (e.g., the `Check` inside a chip), 2.0 for standalone icons (e.g., a navigation `ChevronRight`). Sizes 14, 16, 20, 24, 28 — match the surrounding text height by eye.

The product's current and reserved inventory lives in `assets/icons.md`. Two bespoke SVGs supplement Lucide:

- `assets/logomark.svg` — the LedgerLens mark. Used in headers, the favicon source, and any context where the wordmark "LedgerLens" needs visual support.
- `assets/ledger-motif.svg` — the ambient motif. Used in landing-page hero, in the "now categorizing" empty state, and as a faint background watermark on long marketing pages.

## Repository layout

This `design/` folder is portable. It could be lifted into a Claude skill later without restructuring; the contents are designed to be useful without surrounding code context.

```
design/
├── README.md           you are here
├── tokens.css          single source of truth for design tokens
├── assets/
│   ├── logomark.svg
│   ├── ledger-motif.svg
│   └── icons.md        Lucide inventory + bespoke SVG inventory
└── preview/
    └── index.html      standalone token-preview page — open in any browser
```

Live-app wiring lives in `frontend/`:

- `frontend/tailwind.config.ts` — extends Tailwind's theme with brand/severity/surface/text colors and the three font families. All values reference `var(--token)` so swapping a value in `globals.css` propagates automatically.
- `frontend/src/app/globals.css` — manual mirror of `tokens.css`. The comment at the top names this file as the mirror and points back here.
- `frontend/src/app/layout.tsx` — loads Newsreader, Inter, and IBM Plex Mono via `next/font/google` and attaches them to `<body>` as CSS variables.
- `frontend/src/components/ui/` — base primitives (`Logomark`, `LedgerMotif`, and additions in future sessions).

## See also

- [ADR-0010](../docs/adr/0010-design-system-architecture.md) — the architecture decision for this folder + frontend wiring.
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) — overall product architecture; this folder owns the visual layer, ARCHITECTURE owns everything below it.
