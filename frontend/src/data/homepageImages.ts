/**
 * Homepage stock-photography manifest.
 *
 * One entry per visual slot the homepage can show. Each entry starts
 * **disabled** — the homepage renders a professional placeholder panel
 * that shows the section label, filename, and aspect until a real
 * local photo + matching credit are added.
 *
 * Operator workflow:
 *
 * 1. Download a real local photo per
 *    `docs/HOMEPAGE_IMAGE_MANUAL_SOURCING_MANIFEST.md`.
 * 2. Save it at the exact `src` path below (under
 *    `frontend/public/`).
 * 3. Add a matching entry to `imageCredits.ts` with
 *    photographer + sourceUrl + license.
 * 4. Flip the slot's `enabled` to `true`.
 * 5. Run `npm run images:verify` to confirm everything lines up.
 *
 * Do **not** flip `enabled` to `true` until both the file AND a
 * matching credit exist — the verify script will fail loudly.
 */

export type HomepageImageSection =
  | "hero"
  | "trust"
  | "auto-shop"
  | "engineering"
  | "faq";

export type HomepageImage = {
  /** Logical slot name. Must be unique across the manifest. */
  section: HomepageImageSection;
  /** Public path under `frontend/public/`. Always starts with `/`. */
  src: string;
  /** Descriptive alt text. Must be ≥ 20 characters when enabled. */
  alt: string;
  /**
   * Flip to `true` only after the file exists on disk AND a matching
   * credit lives in `imageCredits.ts`. The verify script enforces both.
   */
  enabled: boolean;
  /** Display aspect ratio. Informational; the homepage owns the actual layout. */
  aspect: "21:9" | "16:9" | "4:3" | "3:2" | "3:4" | "portrait";
  /** Where on the homepage this image is intended to land. */
  placement: string;
  /** Short title shown on the placeholder panel when disabled. */
  placeholderTitle: string;
  /** Subtitle shown below the title on the placeholder panel. */
  placeholderNote: string;
};

export const HOMEPAGE_IMAGES: ReadonlyArray<HomepageImage> = [
  {
    section: "hero",
    src: "/images/stock/hero/calm-workspace-morning.jpg",
    alt:
      "Tidy desk with laptop and notebook in soft morning light, " +
      "representing a calm monthly bookkeeping cleanup workflow",
    enabled: true,
    aspect: "21:9",
    placement: "homepage hero",
    placeholderTitle: "Hero image slot",
    placeholderNote: "1600×900 · calm-workspace-morning.jpg",
  },
  {
    section: "trust",
    src: "/images/stock/trust/verified-checklist-flatlay.jpg",
    alt:
      "Checklist and pen on a desk, representing procedural review " +
      "before accountant handoff",
    enabled: true,
    aspect: "3:2",
    placement: "trust boundary section",
    placeholderTitle: "Trust image slot",
    placeholderNote: "verified-checklist-flatlay.jpg",
  },
  {
    section: "auto-shop",
    src: "/images/stock/auto-shop/independent-garage.jpg",
    alt:
      "Auto repair workshop representing the fictional Granite State " +
      "Auto Repair demo scenario",
    enabled: true,
    aspect: "16:9",
    placement: "Granite State Auto Repair sample scenario",
    placeholderTitle: "Auto shop scenario image slot",
    placeholderNote: "independent-garage.jpg",
  },
  {
    section: "engineering",
    src: "/images/stock/engineering/workflow-architecture.jpg",
    alt:
      "Person writing notes beside a computer, representing workflow " +
      "design and systems thinking",
    enabled: true,
    aspect: "16:9",
    placement: "AI workflow engineering section",
    placeholderTitle: "Workflow architecture image slot",
    placeholderNote: "workflow-architecture.jpg",
  },
  {
    section: "faq",
    src: "/images/stock/faq/calm-owner-review.jpg",
    alt:
      "Person reviewing documents at a desk, representing plain-English " +
      "owner review questions",
    enabled: true,
    aspect: "3:2",
    placement: "owner FAQ section",
    placeholderTitle: "Owner review image slot",
    placeholderNote: "calm-owner-review.jpg",
  },
];

/** Convenience lookup by section. Returns the manifest entry or undefined. */
export function getHomepageImage(
  section: HomepageImageSection,
): HomepageImage | undefined {
  return HOMEPAGE_IMAGES.find((i) => i.section === section);
}
