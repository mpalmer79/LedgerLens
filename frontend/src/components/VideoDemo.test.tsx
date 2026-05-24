/**
 * VideoDemo fallback contract:
 *
 *   - When LOOM_URL is empty, the homepage section renders the generated
 *     walkthrough (not an iframe and not a "coming soon" tile).
 *   - The "Generated walkthrough" badge marks the surface so a viewer
 *     can't mistake the animation for a live screen recording.
 *   - The /demo and /technical-story CTAs are present.
 *
 * The mock approach: vi.mock the `lib/site` module so we can control
 * LOOM_URL per test without env shenanigans.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

afterEach(() => {
  vi.resetModules();
  vi.unmock("@/lib/site");
});

async function renderWith(loomUrl: string): Promise<string> {
  vi.doMock("@/lib/site", () => ({
    LOOM_URL: loomUrl,
    // Re-export the other constants the component might pull in
    // transitively — keeping the mock minimal but valid.
    GITHUB_PROFILE_URL: "https://github.com/mpalmer79",
    REPO_URL: "https://github.com/mpalmer79/LedgerLens",
    LINKEDIN_URL: "https://linkedin.com/in/michael-palmer",
    ARCHITECTURE_URL: "https://github.com/mpalmer79/LedgerLens/blob/main/docs/ARCHITECTURE.md",
    TRUST_METRIC_DOC_URL:
      "https://github.com/mpalmer79/LedgerLens/blob/main/docs/TRUST_METRIC.md",
    LOOM_SCRIPT_DOC_URL:
      "https://github.com/mpalmer79/LedgerLens/blob/main/docs/LOOM_WALKTHROUGH_SCRIPT.md",
    SITE_TITLE: "LedgerLens | Verified AI-Assisted Bookkeeping Workflow",
    SITE_DESCRIPTION:
      "Turn messy small-business bank transactions into a verified ledger with rules, correction memory, review routing, and audit trails.",
    SITE_TAGLINE: "Verified AI-assisted bookkeeping workflow",
  }));
  const mod = await import("./VideoDemo");
  return renderToStaticMarkup(<mod.VideoDemo />);
}

describe("VideoDemo — fallback behavior", () => {
  it("renders the generated walkthrough when LOOM_URL is empty", async () => {
    const html = await renderWith("");
    // Generated walkthrough markers (badge + a final-scene phrase) appear.
    expect(html).toContain("Generated walkthrough");
    expect(html).toContain("verified finalized demo ledger");
    // No iframe in the fallback.
    expect(html).not.toContain("<iframe");
    // The "coming soon" placeholder is gone.
    expect(html).not.toContain("30-second walkthrough coming soon");
  });

  it("renders the Loom iframe when LOOM_URL is set", async () => {
    const html = await renderWith("https://www.loom.com/embed/example");
    expect(html).toContain("<iframe");
    expect(html).toContain("https://www.loom.com/embed/example");
    // Generated-walkthrough badge is hidden when a real Loom is configured.
    expect(html).not.toContain("Generated walkthrough");
  });

  it("renders the /demo and /technical-story CTAs", async () => {
    const html = await renderWith("");
    expect(html).toContain('href="/demo"');
    expect(html).toContain('href="/technical-story"');
    expect(html).toContain("Start the live demo");
    expect(html).toContain("Read the technical story");
  });

  it("renders the mini storyboard regardless of Loom availability", async () => {
    const withoutLoom = await renderWith("");
    const withLoom = await renderWith("https://www.loom.com/embed/example");
    for (const html of [withoutLoom, withLoom]) {
      expect(html).toContain("Import messy transactions");
      expect(html).toContain("Export verified ledger");
    }
  });
});
