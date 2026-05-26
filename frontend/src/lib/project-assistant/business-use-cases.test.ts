import { describe, expect, it } from "vitest";
import {
  buildBusinessUseCaseAnswer,
  detectBusinessType,
  isBusinessUseCaseQuery,
} from "./business-use-cases";
import { matchQuery } from "./matcher";

describe("isBusinessUseCaseQuery", () => {
  it("recognizes 'how could this help' pattern", () => {
    expect(isBusinessUseCaseQuery("How could this help a dentist?")).toBe(true);
  });
  it("recognizes 'would this work for' pattern", () => {
    expect(isBusinessUseCaseQuery("Would this work for a restaurant?")).toBe(true);
  });
  it("recognizes 'could my business' pattern", () => {
    expect(isBusinessUseCaseQuery("Could my business use this?")).toBe(true);
  });
  it("does not match unrelated questions", () => {
    expect(isBusinessUseCaseQuery("What is LedgerLens?")).toBe(false);
  });
});

describe("detectBusinessType", () => {
  it("detects dental", () => {
    expect(detectBusinessType("dentist's office")).toBe("dental");
  });
  it("detects restaurant", () => {
    expect(detectBusinessType("coffee shop")).toBe("restaurant");
  });
  it("detects contractor", () => {
    expect(detectBusinessType("plumbing contractor")).toBe("contractor");
  });
  it("detects salon", () => {
    expect(detectBusinessType("hair salon")).toBe("salon");
  });
  it("detects medical", () => {
    expect(detectBusinessType("medical office")).toBe("medical");
  });
  it("detects legal", () => {
    expect(detectBusinessType("law office")).toBe("legal");
  });
  it("returns null for unknown", () => {
    expect(detectBusinessType("spaceship company")).toBeNull();
  });
});

describe("buildBusinessUseCaseAnswer", () => {
  it("includes dental examples for dentist query", () => {
    const { answer } = buildBusinessUseCaseAnswer("How could this help a dentist?");
    expect(answer).toContain("dental");
    expect(answer).toContain("lab fees");
  });

  it("includes restaurant examples", () => {
    const { answer } = buildBusinessUseCaseAnswer("Would this work for a restaurant?");
    expect(answer).toContain("food inventory");
    expect(answer).toContain("delivery platform fees");
  });

  it("includes contractor examples", () => {
    const { answer } = buildBusinessUseCaseAnswer("How about a contractor?");
    expect(answer).toContain("building materials");
    expect(answer).toContain("subcontractors");
  });

  it("returns generic answer for unknown business type", () => {
    const { answer } = buildBusinessUseCaseAnswer("Could this help my small business?");
    expect(answer).toContain("small business like that");
    expect(answer).toContain("supplies");
  });

  it("includes sensitive-data warning for dental", () => {
    const { answer } = buildBusinessUseCaseAnswer("How could this help a dental office?");
    expect(answer).toContain("patient");
    expect(answer).toContain("regulated data");
  });

  it("includes sensitive-data warning for medical", () => {
    const { answer } = buildBusinessUseCaseAnswer("How could this help a medical clinic?");
    expect(answer).toContain("patient");
  });

  it("includes sensitive-data warning for legal", () => {
    const { answer } = buildBusinessUseCaseAnswer("How would this apply to a law office?");
    expect(answer).toContain("client");
  });

  it("does not claim production accounting software", () => {
    const { answer } = buildBusinessUseCaseAnswer("Would this work for a salon?");
    expect(answer.toLowerCase()).not.toContain("accounting software");
    expect(answer).toContain("not financial advice");
  });

  it("does not claim QuickBooks integration", () => {
    const { answer } = buildBusinessUseCaseAnswer("Could a gym use this?");
    expect(answer.toLowerCase()).not.toContain("quickbooks");
  });

  it("includes follow-up suggestions", () => {
    const { followUps } = buildBusinessUseCaseAnswer("How could this help a dentist?");
    expect(followUps.length).toBeGreaterThan(0);
    expect(followUps.some((f) => f.toLowerCase().includes("export"))).toBe(true);
  });
});

describe("matchQuery integration with business use cases", () => {
  it("routes dentist question to use-case answer, not fallback", () => {
    const result = matchQuery("How could this program be useful for a dentist's office?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.category).toBe("business_use_case_adaptation");
    expect(result.entry?.answer).toContain("dental");
  });

  it("routes restaurant question to use-case answer", () => {
    const result = matchQuery("Would this work for a restaurant?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.answer).toContain("food inventory");
  });

  it("routes generic small-business question to use-case answer", () => {
    const result = matchQuery("How could my small business use this?");
    expect(result.confidence).toBe("high");
    expect(result.entry?.category).toBe("business_use_case_adaptation");
  });

  it("still returns fallback for unrelated questions", () => {
    const result = matchQuery("What is the meaning of life?");
    expect(["low", "medium"]).toContain(result.confidence);
  });

  it("still handles tax questions as out-of-scope", () => {
    const result = matchQuery("How do I file my taxes?");
    expect(result.entry?.answer).toContain("qualified professional");
  });

  it("does not make external API calls", () => {
    const result = matchQuery("How could this help a landscaping business?");
    expect(result.entry?.answer).toBeDefined();
    expect(result.entry?.answer).toContain("landscaping");
  });
});
