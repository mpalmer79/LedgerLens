import { HOMEPAGE_IMAGE_CREDITS } from "@/data/imageCredits";

/**
 * Consolidated photo-credit block.
 *
 * Rendered in the homepage footer inside a collapsed `<details>`
 * so it does not crowd the page. Reads `HOMEPAGE_IMAGE_CREDITS`;
 * the verify script asserts that every entry matches an actual
 * file on disk.
 */
export function PhotoCredits() {
  return (
    <details
      className="mt-12 rounded border border-surface-border bg-surface-panel p-4 text-[12px] text-text-subtle"
      data-testid="homepage-photo-credits"
    >
      <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wide text-text-secondary">
        Photo credits
      </summary>
      <ul className="mt-3 space-y-1">
        {HOMEPAGE_IMAGE_CREDITS.map((c) => (
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
