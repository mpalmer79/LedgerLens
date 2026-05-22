import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deactivateCorrection,
  getMemoryMatches,
  listCorrections,
  patchCorrection,
} from "./client";

const originalFetch = global.fetch;

function mockJsonOnce(payload: unknown, init: ResponseInit = {}) {
  const fn = vi.fn(async () =>
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

describe("correction memory API client", () => {
  it("listCorrections encodes filters", async () => {
    const fn = mockJsonOnce({ total: 0, items: [] });
    await listCorrections({ active: true, category_code: "6070", q: "ADOBE" });
    expect(fn.mock.calls[0][0]).toBe(
      "http://localhost:8000/corrections?active=true&category_code=6070&q=ADOBE",
    );
  });

  it("listCorrections returns parsed list", async () => {
    mockJsonOnce({
      total: 1,
      items: [
        {
          id: "mem_1",
          merchant_key: "ADOBE",
          description_key: "ADOBE CC",
          selected_category_code: "6070",
          source_transaction_id: "tx_1",
          source_review_decision_id: "rev_1",
          match_count: 0,
          last_used_at: null,
          active: true,
          notes: null,
          created_at: "2026-03-14T12:00:00+00:00",
          updated_at: "2026-03-14T12:00:00+00:00",
        },
      ],
    });
    const res = await listCorrections();
    expect(res.total).toBe(1);
    expect(res.items[0].merchant_key).toBe("ADOBE");
  });

  it("deactivateCorrection uses DELETE", async () => {
    const fn = mockJsonOnce({
      id: "mem_1",
      merchant_key: "ADOBE",
      description_key: "ADOBE CC",
      selected_category_code: "6070",
      source_transaction_id: "tx_1",
      source_review_decision_id: "rev_1",
      match_count: 0,
      last_used_at: null,
      active: false,
      notes: null,
      created_at: "2026-03-14T12:00:00+00:00",
      updated_at: "2026-03-14T12:00:00+00:00",
    });
    const res = await deactivateCorrection("mem_1");
    expect(fn.mock.calls[0][0]).toBe("http://localhost:8000/corrections/mem_1");
    expect(fn.mock.calls[0][1]?.method).toBe("DELETE");
    expect(res.active).toBe(false);
  });

  it("patchCorrection uses PATCH with body", async () => {
    const fn = mockJsonOnce({
      id: "mem_1",
      merchant_key: "ADOBE",
      description_key: "ADOBE CC",
      selected_category_code: "6070",
      source_transaction_id: "tx_1",
      source_review_decision_id: "rev_1",
      match_count: 0,
      last_used_at: null,
      active: true,
      notes: "updated",
      created_at: "2026-03-14T12:00:00+00:00",
      updated_at: "2026-03-14T12:00:00+00:00",
    });
    await patchCorrection("mem_1", { notes: "updated" });
    expect(fn.mock.calls[0][1]?.method).toBe("PATCH");
    expect(fn.mock.calls[0][1]?.body).toBe(JSON.stringify({ notes: "updated" }));
  });

  it("getMemoryMatches returns verdict shape", async () => {
    mockJsonOnce({
      verdict: "apply",
      reason: "matched on merchant_key",
      merchant_key: "ADOBE",
      description_key: "ADOBE CC",
      record: null,
      candidates: [],
    });
    const res = await getMemoryMatches("tx_1");
    expect(res.verdict).toBe("apply");
    expect(res.merchant_key).toBe("ADOBE");
  });
});
