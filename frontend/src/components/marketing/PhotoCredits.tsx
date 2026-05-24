import { imageCredits } from "@/data/imageCredits";

/**
 * Consolidated photo-credit block for the homepage footer.
 *
 * Behavior:
 * - When `imageCredits` is empty (the default — no real photos
 *   shipped yet), the component renders **null**. Nothing visible
 *   is added to the homepage.
 * - When `imageCredits` has entries, renders a collapsed
 *   `<details>` block listing each credit (section, photographer
 *   linked to the source URL, license).
 *
 * The verify script asserts that every entry here matches a file on
 * disk under `public/images/stock/`.
 */
export function PhotoCredits() {
  if (imageCredits.length === 0) {
    return null;
  }

  return (
    <details
      className="mt-12 rounded border border-surface-border bg-surface-panel p-4 text-[12px] text-text-subtle"
      data-testid="homepage-photo-credits"
    >
      <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wide text-text-secondary">
        Photo credits
      </summary>
      <ul className="mt-3 space-y-1">
        {imageCredits.map((c) => (
          <li key={c.file}>
            <span className="mono text-text-subtle">{c.section}</span>
            <span aria-hidden="true"> · </span>
            <a
              href={c.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-700 underline"
            >
              {c.photographer}
            </a>
            <span aria-hidden="true"> · </span>
            <span>{c.license}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11px] text-text-subtle">
        All images live under <code>public/images/stock/</code>; the
        license for each is recorded in{" "}
        <code>frontend/src/data/imageCredits.ts</code>.
      </p>
    </details>
  );
}
