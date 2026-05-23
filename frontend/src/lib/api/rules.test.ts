import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRuleMatches, listRules } from "./client";

const originalFetch = global.fetch;

function mockJsonOnce(payload: unknown, init: ResponseInit = {}) {
  const fn = vi.fn(
    async () =>
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
        ...init,
      }),
  );
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

beforeEach(() => {
  delete process.env.NEXT_PUBLIC_API_BASE_URL;
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("rules API client", () => {
  it("listRules calls /rules", async () => {
    const fn = mockJsonOnce({ total: 0, items: [] });
    await listRules();
    expect(fn.mock.calls[0][0]).toBe("http://localhost:8000/rules");
  });

  it("listRules returns parsed list", async () => {
    mockJsonOnce({
      total: 1,
      items: [
        {
          id: "rule.adobe.software",
          name: "Adobe → Software",
          active: true,
          priority: 100,
          match_type: "merchant_contains",
          merchant_patterns: ["ADOBE"],
          description_patterns: [],
          category_code: "6070",
          category_name: "Software Subscriptions",
          confidence: 0.95,
          explanation: "Adobe is software.",
        },
      ],
    });
    const res = await listRules();
    expect(res.total).toBe(1);
    expect(res.items[0].id).toBe("rule.adobe.software");
    expect(res.items[0].match_type).toBe("merchant_contains");
  });

  it("getRuleMatches uses transaction id in path", async () => {
    const fn = mockJsonOnce({
      verdict: "apply",
      reason: "matched rule.adobe.software",
      merchant_text: "ADOBE",
      description_text: "ADOBE CREATIVE CLOUD",
      rule: {
        id: "rule.adobe.software",
        name: "Adobe → Software",
        active: true,
        priority: 100,
        match_type: "merchant_contains",
        merchant_patterns: ["ADOBE"],
        description_patterns: [],
        category_code: "6070",
        category_name: "Software Subscriptions",
        confidence: 0.95,
        explanation: "",
      },
      candidates: [],
    });
    const res = await getRuleMatches("tx_42");
    expect(fn.mock.calls[0][0]).toBe(
      "http://localhost:8000/transactions/tx_42/rule-matches",
    );
    expect(res.verdict).toBe("apply");
    expect(res.rule?.category_code).toBe("6070");
  });

  it("getRuleMatches handles no-match verdict", async () => {
    mockJsonOnce({
      verdict: "none",
      reason: "no active rule matched",
      merchant_text: "GENERIC",
      description_text: "GENERIC VENDOR",
      rule: null,
      candidates: [],
    });
    const res = await getRuleMatches("tx_99");
    expect(res.verdict).toBe("none");
    expect(res.rule).toBeNull();
  });
});
