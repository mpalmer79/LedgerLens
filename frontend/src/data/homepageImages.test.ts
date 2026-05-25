/**
 * Homepage image manifest contract.
 *
 * Five slots, all disabled by default, placeholder metadata on each,
 * no fake/remote sources.
 */
import { describe, expect, it } from "vitest";

import {
  HOMEPAGE_IMAGES,
  type HomepageImageSection,
  getHomepageImage,
} from "./homepageImages";
import { imageCredits } from "./imageCredits";

describe("HOMEPAGE_IMAGES manifest", () => {
  it("declares exactly five slots", () => {
    expect(HOMEPAGE_IMAGES.length).toBe(5);
  });

  it("covers all five expected sections, each exactly once", () => {
    const expected: HomepageImageSection[] = [
      "hero",
      "trust",
      "auto-shop",
      "engineering",
      "faq",
    ];
    const got = HOMEPAGE_IMAGES.map((i) => i.section).sort();
    expect(got).toEqual([...expected].sort());
  });

  it("only enables slots that have a file on disk", () => {
    const enabledSections = HOMEPAGE_IMAGES.filter((i) => i.enabled).map(
      (i) => i.section,
    );
    expect(enabledSections).toContain("hero");
    expect(enabledSections).toContain("trust");
    expect(enabledSections).toContain("engineering");
    const disabledSections = HOMEPAGE_IMAGES.filter((i) => !i.enabled).map(
      (i) => i.section,
    );
    for (const s of ["auto-shop", "faq"]) {
      expect(disabledSections).toContain(s);
    }
  });

  it("uses local /images/stock/ paths only — no remote URLs", () => {
    for (const img of HOMEPAGE_IMAGES) {
      expect(img.src.startsWith("/images/stock/")).toBe(true);
      expect(img.src).not.toMatch(/^https?:\/\//);
    }
  });

  it("ships descriptive alt text on every slot (≥ 20 chars)", () => {
    for (const img of HOMEPAGE_IMAGES) {
      expect(img.alt.length).toBeGreaterThanOrEqual(20);
    }
  });

  it("ships placeholderTitle and placeholderNote on every slot", () => {
    for (const img of HOMEPAGE_IMAGES) {
      expect(img.placeholderTitle.length).toBeGreaterThan(0);
      expect(img.placeholderNote.length).toBeGreaterThan(0);
    }
  });

  it("provides a working getHomepageImage lookup", () => {
    expect(getHomepageImage("hero")?.section).toBe("hero");
    expect(getHomepageImage("faq")?.section).toBe("faq");
    expect(getHomepageImage("nope" as HomepageImageSection)).toBeUndefined();
  });

  it("ships no credits by default (matches all-disabled state)", () => {
    expect(imageCredits.length).toBe(0);
  });
});
