/**
 * Homepage stock-photography credits.
 *
 * One entry per file in `public/images/stock/`. The
 * `scripts/verify-homepage-images.ts` script asserts each file
 * referenced here exists on disk and that no homepage image is
 * missing a credit.
 *
 * The shipping repo carries labeled placeholder JPGs at the
 * paths below so the build and verify script pass immediately.
 * The operator replaces them with real Unsplash / Pexels /
 * Pixabay photos per `docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md`
 * — when they do, update the photographer / sourceUrl / license
 * fields in the matching entry.
 */

export type ImageLicense = "Unsplash" | "Pexels" | "Pixabay" | "Placeholder" | "Other";

export type ImageCredit = {
  /** Path under `/public` (always starts with `/images/stock/`). */
  file: string;
  /** Photographer name or "(placeholder)" until a real image is dropped in. */
  photographer: string;
  /** Direct URL to the original on the source platform. */
  sourceUrl: string;
  license: ImageLicense;
  /** Logical section the image is used in. Must match the homepage's slot. */
  section: "hero" | "trust" | "auto-shop" | "engineering" | "faq";
};

export const HOMEPAGE_IMAGE_CREDITS: ReadonlyArray<ImageCredit> = [
  {
    file: "/images/stock/hero/calm-workspace-morning.jpg",
    photographer: "(placeholder — replace per manifest)",
    sourceUrl: "https://github.com/mpalmer79/LedgerLens/blob/main/docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md",
    license: "Placeholder",
    section: "hero",
  },
  {
    file: "/images/stock/trust/verified-checklist-flatlay.jpg",
    photographer: "(placeholder — replace per manifest)",
    sourceUrl: "https://github.com/mpalmer79/LedgerLens/blob/main/docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md",
    license: "Placeholder",
    section: "trust",
  },
  {
    file: "/images/stock/auto-shop/independent-garage.jpg",
    photographer: "(placeholder — replace per manifest)",
    sourceUrl: "https://github.com/mpalmer79/LedgerLens/blob/main/docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md",
    license: "Placeholder",
    section: "auto-shop",
  },
  {
    file: "/images/stock/engineering/workflow-architecture.jpg",
    photographer: "(placeholder — replace per manifest)",
    sourceUrl: "https://github.com/mpalmer79/LedgerLens/blob/main/docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md",
    license: "Placeholder",
    section: "engineering",
  },
  {
    file: "/images/stock/faq/calm-owner-review.jpg",
    photographer: "(placeholder — replace per manifest)",
    sourceUrl: "https://github.com/mpalmer79/LedgerLens/blob/main/docs/HOMEPAGE_IMAGE_SELECTION_MANIFEST.md",
    license: "Placeholder",
    section: "faq",
  },
];
