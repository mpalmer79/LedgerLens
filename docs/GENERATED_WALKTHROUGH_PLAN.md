# Generated walkthrough plan

## Current placeholder behavior

`VideoDemo` reads `NEXT_PUBLIC_LOOM_URL` from `lib/site.ts`. When the env var is empty, the component renders a static `<Placeholder>` card with a play-circle icon, the line "30-second walkthrough coming soon," and a paragraph pointing people at the live `/demo`. It's *honest* but it's also flat — a recruiter who shares the URL on LinkedIn before the Loom is recorded sees a "coming soon" tile in the hero area, which reads "not finished" instead of "deliberate placeholder."

## What we're replacing it with

A reusable React component called `GeneratedWalkthrough` that plays a six-scene, ~30-second narrated-without-audio walkthrough using pure CSS keyframe animation. No new dependencies, no video file, no `<video>` tag, no third-party API. It loops by default.

The scenes follow the same beats as the Loom script so the two assets are interchangeable:

| t (s) | Scene | Visual headline |
|---:|---|---|
| 0 – 5 | Intro | LedgerLens wordmark + "AI-assisted bookkeeping workflow for small businesses" |
| 5 – 10 | The mess | Five messy transaction cards stack into an intake list |
| 10 – 16 | Layered decisioning | Three pipeline nodes light up: memory → rules → review routing |
| 16 – 22 | Review queue | An unknown ACH transaction moves into a review queue with a `Needs Review` pill |
| 22 – 27 | Memory replay | A correction (`UNKNOWN VENDOR → Repairs & Maintenance`) becomes a memory card |
| 27 – 30 | Verified ledger | Trust card: **100% verified finalized demo ledger** + "0 uncertain rows silently finalized" |

A bottom progress bar advances across all 30 seconds. A small scene-counter (`Step 3 / 6`) reads out the current beat.

## Implementation strategy

- **Pure CSS keyframes.** A single `@keyframes` timeline drives `opacity`/`transform` on six scene panels, each layered absolutely on top of one another inside one container. Total `animation-duration: 30s; animation-iteration-count: infinite`.
- **No new runtime dependencies.** Framer Motion isn't installed and isn't worth pulling in for this.
- **One stylesheet imported globally**, scoped under a single root class so the keyframes don't clash with anything else.
- **No JS state** for the animation itself — `prefers-reduced-motion: reduce` shows the final "verified ledger" frame statically so motion-sensitive users still get the punchline.
- **Loom override preserved.** `VideoDemo` still embeds the Loom iframe when `NEXT_PUBLIC_LOOM_URL` is set; it only swaps in `GeneratedWalkthrough` when the URL is empty.

## Tradeoffs

| Choice | Why | Cost |
|---|---|---|
| CSS keyframes | Zero deps, works at build time, accessible. | Slightly more verbose than a Framer Motion timeline. |
| Single 30-s loop | Hands-off "set it and forget it" — no controls needed. | A viewer can't pause. Mitigated by `prefers-reduced-motion` fallback. |
| Inline SVG icons + Tailwind | Matches the existing visual language; no asset pipeline change. | Slightly larger HTML. |
| No `<video>` element | Avoids encoding/storage and the "is this faked?" question. | If someone wants a real .mp4, they need to record `/walkthrough` themselves. |
| Honest "Generated walkthrough" badge | Recruiter can't mistake it for a real screen recording. | Reads slightly less polished than a real Loom — but that's the point. |

## How Loom will still override it

`VideoDemo`:

```tsx
const hasLoom = LOOM_URL.length > 0;
return hasLoom ? <iframe src={LOOM_URL} … /> : <GeneratedWalkthrough />;
```

Setting `NEXT_PUBLIC_LOOM_URL` on Railway is the only step needed to swap the generated animation out for the real recording on next deploy.

## How to export or record the walkthrough

A new `/walkthrough` route renders only the component, full-screen, no nav. To capture a real video:

1. Open `https://<deploy>/walkthrough` in a browser.
2. Use Loom, OBS, QuickTime, or any screen recorder. The animation auto-loops, so start recording at the first appearance of the intro scene.
3. Trim to 30 s.
4. Upload to Loom; copy the embed URL.
5. Set `NEXT_PUBLIC_LOOM_URL` on Railway frontend; redeploy. The Loom now replaces the in-browser animation everywhere `VideoDemo` is rendered.

## Acceptance criteria

- Homepage no longer shows the static "coming soon" tile; it shows the animated six-scene walkthrough when no Loom URL is set.
- The animation contains the exact phrase **"100% verified finalized demo ledger"** and does **not** contain "100% AI accuracy."
- `VideoDemo` still renders the Loom iframe when `NEXT_PUBLIC_LOOM_URL` is set.
- CTA links to `/demo` and `/technical-story` are present.
- `/walkthrough` route exists, shows the component full-screen with no nav, and builds cleanly.
- Existing 36 frontend tests still pass; new tests added for the contract above.
- `next build` clean; `next lint` clean; backend 134 tests untouched.
