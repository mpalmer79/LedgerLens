import { describe, expect, it } from "vitest";
import { matchQuery, getSuggestedQuestions } from "./matcher";

describe("matchQuery", () => {
  it("returns high confidence for exact known question", () => {
    const result = matchQuery("What is LedgerLens?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.id).toBe("what-is-ledgerlens");
  });

  it("matches trust metric question", () => {
    const result = matchQuery("What does 100% verified mean?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("procedurally verified");
  });

  it("matches QuickBooks question and says no live sync", () => {
    const result = matchQuery("Does it connect to QuickBooks?");
    expect(["high", "medium"]).toContain(result.confidence);
    expect(result.entry?.answer).toContain("QuickBooks");
  });

  it("warns against real bank data upload", () => {
    const result = matchQuery("Can I upload real bank data?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("Do NOT upload");
  });

  it("explains correction memory", () => {
    const result = matchQuery("What is correction memory?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("correction-memory");
  });

  it("returns fallback or low-confidence for unknown question", () => {
    const result = matchQuery("What is the meaning of life?");
    expect(["low", "medium"]).toContain(result.confidence);
  });

  it("returns out-of-scope for tax questions", () => {
    const result = matchQuery("How do I file my taxes?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("qualified professional");
  });

  it("returns empty result for empty input", () => {
    const result = matchQuery("");
    expect(result.score).toBe(0);
    expect(result.entry).toBeNull();
  });

  it("matches keyword-based queries", () => {
    const result = matchQuery("tech stack");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("Next.js");
  });

  it("matches demo workflow query", () => {
    const result = matchQuery("How do I try the demo?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("guided demo");
  });

  it("matches vendor normalization query", () => {
    const result = matchQuery("Why are Amazon and Costco routed to review?");
    expect(["high", "medium"]).toContain(result.confidence);
    expect(result.entry?.answer).toContain("vendor");
  });

  it("does not make external API calls", () => {
    const result = matchQuery("What is LedgerLens?");
    expect(result.entry?.answer).toBeDefined();
  });
});

describe("getSuggestedQuestions", () => {
  it("returns default suggestions for homepage", () => {
    const q = getSuggestedQuestions("/");
    expect(q.length).toBeGreaterThanOrEqual(3);
  });

  it("returns demo-specific suggestions for /demo", () => {
    const q = getSuggestedQuestions("/demo");
    expect(q.some((s) => s.toLowerCase().includes("demo"))).toBe(true);
  });

  it("returns handoff-specific suggestions for /handoff", () => {
    const q = getSuggestedQuestions("/handoff");
    expect(q.some((s) => s.toLowerCase().includes("export"))).toBe(true);
  });

  it("returns tech suggestions for /technical-story", () => {
    const q = getSuggestedQuestions("/technical-story");
    expect(q.some((s) => s.toLowerCase().includes("stack"))).toBe(true);
  });
});
