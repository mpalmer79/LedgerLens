/**
 * Constants in `site.ts` are referenced from every public surface. These
 * tests pin down the contract the user explicitly asked for:
 *
 *  - LinkedIn and GitHub links are present.
 *  - No email, phone, or direct resume-download URL slips into the
 *    site-wide constants.
 *  - LOOM_URL defaults to empty so the build never fails when no
 *    recording has been uploaded.
 */

import { describe, expect, it } from "vitest";

import {
  GITHUB_PROFILE_URL,
  LINKEDIN_URL,
  LOOM_URL,
  REPO_URL,
  SITE_DESCRIPTION,
  SITE_TITLE,
} from "./site";

describe("site config", () => {
  it("provides a LinkedIn URL", () => {
    expect(LINKEDIN_URL).toMatch(/^https?:\/\/.*linkedin\.com\//);
  });

  it("provides a GitHub profile URL", () => {
    expect(GITHUB_PROFILE_URL).toMatch(/^https?:\/\/.*github\.com\//);
  });

  it("provides a GitHub repo URL", () => {
    expect(REPO_URL).toMatch(/^https?:\/\/.*github\.com\//);
  });

  it("LOOM_URL is a string (possibly empty) — never undefined", () => {
    expect(typeof LOOM_URL).toBe("string");
  });

  it("does not embed an email address in shared constants", () => {
    const corpus = [LINKEDIN_URL, GITHUB_PROFILE_URL, REPO_URL, SITE_TITLE, SITE_DESCRIPTION]
      .join(" ")
      .toLowerCase();
    expect(corpus).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
    expect(corpus).not.toMatch(/mailto:/);
  });

  it("does not embed a phone number in shared constants", () => {
    const corpus = [LINKEDIN_URL, GITHUB_PROFILE_URL, REPO_URL, SITE_TITLE, SITE_DESCRIPTION]
      .join(" ")
      .toLowerCase();
    // Loose phone-number heuristic. Catches "(555) 123-4567", "555-123-4567",
    // "5551234567" but not Sept '23 dates or version numbers.
    expect(corpus).not.toMatch(/\+?\d[\d\s().-]{8,}\d/);
  });

  it("does not embed a resume-download URL in shared constants", () => {
    const corpus = [LINKEDIN_URL, GITHUB_PROFILE_URL, REPO_URL, SITE_TITLE, SITE_DESCRIPTION]
      .join(" ")
      .toLowerCase();
    expect(corpus).not.toMatch(/resume\.pdf|cv\.pdf|\/resume|\/cv/);
  });

  it("does not lead with raw model accuracy in title or description", () => {
    const corpus = [SITE_TITLE, SITE_DESCRIPTION].join(" ").toLowerCase();
    expect(corpus).not.toMatch(/\b6\d(\.\d+)?\s*%/);
    expect(corpus).toMatch(/verified/);
  });
});
