/**
 * VideoDemo fallback contract:
 *
 *   - When LOOM_URL is empty, the homepage section renders the generated
 *     walkthrough (not an iframe and not a "coming soon" tile).
 *   - The "Generated walkthrough" badge marks the surface so a viewer
 *     can't mistake the animation for a live screen recording.
 *   - The primary CTAs point at /cleanup and /handoff (the product
 *     workflow + deliverable); /technical-story is preserved as a
 *     smaller secondary link for the recruiter doorway.
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
    expect(html).toContain("procedurally verified demo rows");
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

  it("renders the /cleanup and /handoff CTAs and the /technical-story link", async () => {
    const html = await renderWith("");
    expect(html).toContain('href="/cleanup"');
    expect(html).toContain('href="/handoff"');
    expect(html).toContain('href="/technical-story"');
    expect(html).toContain("Start monthly cleanup");
    expect(html).toContain("View accountant handoff");
    expect(html).toContain("Read the technical story");
  });

  it("uses the cleanup-to-handoff section title", async () => {
    const html = await renderWith("");
    expect(html).toContain("Watch the cleanup-to-handoff flow");
  });

  it("renders the six-step storyboard regardless of Loom availability", async () => {
    const withoutLoom = await renderWith("");
    const withLoom = await renderWith("https://www.loom.com/embed/example");
    for (const html of [withoutLoom, withLoom]) {
      expect(html).toContain("Import this month");
      expect(html).toContain("Obvious vendors handled first");
      expect(html).toContain("Uncertain rows become owner questions");
      expect(html).toContain("Answers create accountant context");
      expect(html).toContain("Export the accountant handoff package");
    }
  });
});
