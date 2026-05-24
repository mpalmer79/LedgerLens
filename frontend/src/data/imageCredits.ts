/**
 * Homepage photo credits.
 *
 * One entry per real local photo shipped under `public/images/stock/`.
 * The array is **intentionally empty by default** — there are no real
 * photos in the repo today, so there are no credits to claim.
 *
 * Operator workflow when adding a real photo:
 *
 * 1. Save the downloaded file under
 *    `frontend/public/images/stock/<section>/<filename>.jpg`.
 * 2. Add an entry to `imageCredits` below with the real
 *    photographer, sourceUrl, and license.
 * 3. Flip the matching slot in `homepageImages.ts` to `enabled: true`.
 * 4. Run `npm run images:verify` to confirm everything lines up.
 *
 * Do **not** add placeholder or fake credit data here. The verify
 * script trusts every entry as a real attribution; fake entries
 * would silently misrepresent the source of an image.
 */

export type ImageLicense = "Unsplash" | "Pexels" | "Pixabay" | "Other";

export type ImageCredit = {
  /** Public path under `frontend/public/`. Always starts with `/images/stock/`. */
  file: string;
  /** Real photographer name as listed on the source platform. */
  photographer: string;
  /** Direct URL to the original on the source platform (must be https). */
  sourceUrl: string;
  /** License the photo is published under. */
  license: ImageLicense;
  /** Logical section the image is used in. Must match `homepageImages.ts`. */
  section: "hero" | "trust" | "auto-shop" | "engineering" | "faq";
};

// ── Add real credits below as photos are added. ──────────────────────
// Example shape (do not commit until the matching file is on disk):
//
// {
//   file: "/images/stock/hero/calm-workspace-morning.jpg",
//   photographer: "Real Name From Unsplash Page",
//   sourceUrl: "https://unsplash.com/photos/<id>",
//   license: "Unsplash",
//   section: "hero",
// },
export const imageCredits: ReadonlyArray<ImageCredit> = [];
