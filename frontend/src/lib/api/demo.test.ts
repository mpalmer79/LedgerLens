import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getDemoSampleTransactions,
  getDemoStatus,
  resetDemo,
  seedDemo,
} from "./client";

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

describe("demo API client", () => {
  it("getDemoStatus hits /demo/status with GET", async () => {
    const fn = mockJsonOnce({
      demo_mode: true,
      categorizer_mode: "demo_stub",
      transaction_count: 0,
      demo_transaction_count: 0,
      categorization_result_count: 0,
      review_decision_count: 0,
      correction_memory_count: 0,
    });
    const res = await getDemoStatus();
    expect(fn.mock.calls[0][0]).toBe("http://localhost:8000/demo/status");
    expect(res.demo_mode).toBe(true);
  });

  it("getDemoSampleTransactions returns the bundled payload", async () => {
    mockJsonOnce([
      {
        transaction_date: "2026-03-01",
        description: "ZOOM.US MONTHLY",
        merchant: "Zoom",
        amount_cents: -1499,
      },
    ]);
    const res = await getDemoSampleTransactions();
    expect(res).toHaveLength(1);
    expect(res[0].merchant).toBe("Zoom");
  });

  it("seedDemo posts to /demo/seed", async () => {
    const fn = mockJsonOnce({ count: 12, created: [] });
    await seedDemo();
    expect(fn.mock.calls[0][0]).toBe("http://localhost:8000/demo/seed");
    expect(fn.mock.calls[0][1]?.method).toBe("POST");
  });

  it("resetDemo posts to /demo/reset", async () => {
    const fn = mockJsonOnce({ deleted_transactions: 12 });
    await resetDemo();
    expect(fn.mock.calls[0][0]).toBe("http://localhost:8000/demo/reset");
    expect(fn.mock.calls[0][1]?.method).toBe("POST");
  });
});
