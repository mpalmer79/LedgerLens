/**
 * Productization-boundary docs must exist and link from one another so the
 * /technical-story production-readiness section never points at dead links.
 * Asserted on the file system, not on the frontend bundle.
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const DOCS = join(REPO_ROOT, "docs");

const REQUIRED_DOCS = [
  "PRODUCTIZATION_GAP_AUDIT.md",
  "ACCOUNTING_LANGUAGE_AUDIT.md",
  "ACCOUNTING_DOMAIN_BOUNDARY.md",
  "SECURITY_AND_PRODUCTION_READINESS.md",
  "SMALL_BUSINESS_UX_ROADMAP.md",
  "TRUST_METRIC.md",
] as const;

describe("productization-boundary docs", () => {
  it.each(REQUIRED_DOCS)("ships %s", (filename) => {
    const path = join(DOCS, filename);
    expect(existsSync(path)).toBe(true);
    expect(statSync(path).size).toBeGreaterThan(500);
  });

  it("SECURITY_AND_PRODUCTION_READINESS.md ends with a 'do not' list for real buyers", () => {
    const body = readFileSync(join(DOCS, "SECURITY_AND_PRODUCTION_READINESS.md"), "utf-8");
    expect(body.toLowerCase()).toContain("do not upload real bank");
    expect(body.toLowerCase()).toContain("do not rely on the demo for tax");
    // The "substitute" word is hyphenated / bolded inline.
    expect(body.toLowerCase()).toMatch(/substitut/);
  });

  it("ACCOUNTING_DOMAIN_BOUNDARY.md spells out what LedgerLens is NOT", () => {
    const body = readFileSync(join(DOCS, "ACCOUNTING_DOMAIN_BOUNDARY.md"), "utf-8");
    expect(body.toLowerCase()).toContain("does not");
    expect(body.toLowerCase()).toContain("double-entry");
    expect(body.toLowerCase()).toContain("bank reconciliation");
    expect(body.toLowerCase()).toContain("split transactions");
    expect(body.toLowerCase()).toMatch(/substitut/);
  });

  it("ACCOUNTING_LANGUAGE_AUDIT.md ships the approved glossary", () => {
    const body = readFileSync(join(DOCS, "ACCOUNTING_LANGUAGE_AUDIT.md"), "utf-8");
    expect(body).toContain("approved glossary");
    expect(body).toContain("procedurally verified");
    // CPA-related framing — accepts hyphenated variants.
    expect(body.toLowerCase()).toMatch(/cpa[\s-]/);
  });

  it("PRODUCTIZATION_GAP_AUDIT.md distinguishes portfolio demo from production SaaS", () => {
    const body = readFileSync(join(DOCS, "PRODUCTIZATION_GAP_AUDIT.md"), "utf-8");
    expect(body.toLowerCase()).toContain("portfolio");
    expect(body.toLowerCase()).toContain("not production");
    expect(body).toContain("Phase A");
    expect(body).toContain("Phase E");
  });

  it("SMALL_BUSINESS_UX_ROADMAP.md describes the three priority wizards / queues", () => {
    const body = readFileSync(join(DOCS, "SMALL_BUSINESS_UX_ROADMAP.md"), "utf-8");
    expect(body.toLowerCase()).toContain("csv mapping wizard");
    expect(body.toLowerCase()).toContain("account-mapping wizard");
    expect(body.toLowerCase()).toContain("mobile-first review queue");
  });

  it("Dependabot config exists", () => {
    const path = join(REPO_ROOT, ".github", "dependabot.yml");
    expect(existsSync(path)).toBe(true);
    const body = readFileSync(path, "utf-8");
    expect(body).toContain("package-ecosystem: npm");
    expect(body).toContain("package-ecosystem: pip");
    expect(body).toContain("package-ecosystem: github-actions");
  });

  it("public/samples/granite-state-bank-sample.csv exists and has Debit + Credit columns", () => {
    const sample = join(
      REPO_ROOT,
      "frontend",
      "public",
      "samples",
      "granite-state-bank-sample.csv",
    );
    expect(existsSync(sample)).toBe(true);
    const body = readFileSync(sample, "utf-8");
    const header = body.split("\n")[0];
    // The sample uses debit/credit mode so the wizard exercises that path.
    expect(header).toContain("Debit");
    expect(header).toContain("Credit");
    expect(header).toContain("Description");
    // No real data — recognizable fictional vendor names from the
    // Granite State Auto Repair scenario.
    expect(body).toContain("NAPA");
    expect(body).toContain("STRIPE");
  });
});
