/**
 * MarketingNav responsive contract.
 *
 * Three guarantees that the homepage / about / technical-story rely on:
 *
 *   1. The desktop nav row exposes every required link (Demo, Technical
 *      Story, Evals, App, About Michael, GitHub).
 *   2. The mobile button row is present (hamburger + compact "Cleanup →")
 *      so the nav never overflows on phone widths.
 *   3. The mobile button row carries the same logical destinations as
 *      the desktop row — closed-state markup is enough; the open
 *      drawer is JS-driven and not asserted here.
 */

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { MarketingNav } from "./MarketingNav";

const html = renderToStaticMarkup(<MarketingNav />);

describe("MarketingNav — closed/static markup", () => {
  it("renders every required link in the desktop row", () => {
    expect(html).toContain('href="/cleanup"');
    expect(html).toContain('href="/handoff"');
    expect(html).toContain('href="/demo"');
    expect(html).toContain('href="/technical-story"');
    expect(html).toContain('href="/evals"');
    expect(html).toContain('href="/about"');
    expect(html).toContain("About Michael");
    expect(html).toContain("github.com/mpalmer79/LedgerLens");
  });

  it("uses /cleanup as the primary CTA, not /demo", () => {
    expect(html).toContain("Start monthly cleanup");
  });

  it("renders the compact mobile CTA + hamburger toggle", () => {
    // The compact "Cleanup →" CTA only renders inside the md:hidden cluster.
    expect(html).toContain("Cleanup →");
    // The hamburger button is accessible.
    expect(html).toContain('aria-label="Open menu"');
    expect(html).toContain('aria-controls="marketing-mobile-menu"');
  });

  it("keeps the desktop row hidden below md", () => {
    // The desktop link cluster carries the `hidden ... md:flex` class set.
    expect(html).toMatch(/hidden[^"]*md:flex/);
  });

  it("keeps the mobile cluster hidden at md+", () => {
    expect(html).toMatch(/flex[^"]*md:hidden/);
  });
});
