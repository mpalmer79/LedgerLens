/**
 * Launch-readiness contracts.
 *
 * These tests guard the things a recruiter or LinkedIn share preview will
 * notice within seconds of landing on the site:
 *
 *  - The OG image asset exists in `public/` so the social preview isn't a
 *    broken thumbnail.
 *  - The OG SVG source is kept alongside so the PNG is regeneratable.
 *  - The favicon exists.
 *  - The site description is the verified-ledger framing, not raw model
 *    accuracy.
 *  - The 30-second Loom script doc ships with the repo.
 */

import { existsSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SITE_DESCRIPTION, SITE_TITLE } from "./site";

const PUBLIC_DIR = join(__dirname, "..", "..", "public");
const REPO_ROOT = join(__dirname, "..", "..", "..");

function projectFile(relative: string): string {
  return join(REPO_ROOT, relative);
}

describe("launch readiness — assets", () => {
  it("ships an OG PNG at public/og-ledgerlens.png", () => {
    const path = join(PUBLIC_DIR, "og-ledgerlens.png");
    expect(existsSync(path)).toBe(true);
    const size = statSync(path).size;
    // 1200x630 PNG with text + gradient should land well above 30 kB and
    // below the 1 MB LinkedIn cap.
    expect(size).toBeGreaterThan(30_000);
    expect(size).toBeLessThan(1_000_000);
  });

  it("keeps the OG SVG source alongside the PNG", () => {
    expect(existsSync(join(PUBLIC_DIR, "og-ledgerlens.svg"))).toBe(true);
  });

  it("ships a favicon", () => {
    expect(existsSync(join(PUBLIC_DIR, "favicon.svg"))).toBe(true);
  });

  it("ships the 30-second Loom script in docs/", () => {
    expect(existsSync(projectFile("docs/LOOM_WALKTHROUGH_SCRIPT.md"))).toBe(true);
  });

  it("ships a launch readiness review doc", () => {
    expect(existsSync(projectFile("docs/FINAL_LAUNCH_READINESS_REVIEW.md"))).toBe(true);
  });
});

describe("launch readiness — site copy", () => {
  it("site title contains 'Verified'", () => {
    expect(SITE_TITLE).toMatch(/[Vv]erified/);
  });

  it("site description sells the workflow, not raw accuracy", () => {
    const lower = SITE_DESCRIPTION.toLowerCase();
    expect(lower).toMatch(/verified/);
    expect(lower).not.toMatch(/100\s*%\s*ai/);
    expect(lower).not.toMatch(/100\s*%\s*accurate/);
    // Specifically guard against the old raw-accuracy framing.
    expect(lower).not.toMatch(/\b6\d(\.\d+)?\s*%\b/);
  });
});
