import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError, getApiBaseUrl, getReviewQueue, importCsv, listTransactions } from "./client";

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

describe("getApiBaseUrl", () => {
  it("falls back to localhost when env var is unset", () => {
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("uses the env var when present", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "https://api.example.com/";
    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it("ignores the magic 'unset' sentinel from Docker-build fallback", () => {
    process.env.NEXT_PUBLIC_API_BASE_URL = "unset";
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });
});

describe("apiFetch error parsing", () => {
  it("turns FastAPI HTTPException detail into ApiError with code and message", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          detail: {
            error: "missing_provider_config",
            provider: "Anthropic",
            env_var: "ANTHROPIC_API_KEY",
            message: "Anthropic credential is not configured. Set ANTHROPIC_API_KEY to enable this endpoint.",
          },
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;

    await expect(listTransactions()).rejects.toMatchObject({
      name: "ApiError",
      status: 503,
      code: "missing_provider_config",
      message: expect.stringContaining("Anthropic credential is not configured"),
    });
  });

  it("turns network failure into ApiError with helpful message", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;

    await expect(getReviewQueue()).rejects.toBeInstanceOf(ApiError);
    await expect(getReviewQueue()).rejects.toMatchObject({
      status: 0,
      code: "network_error",
    });
  });

  it("returns parsed JSON on 200", async () => {
    mockJsonOnce({ total: 0, items: [] });
    const out = await listTransactions();
    expect(out).toEqual({ total: 0, items: [] });
  });
});

describe("client helpers", () => {
  it("listTransactions encodes limit and offset", async () => {
    const fn = mockJsonOnce({ total: 0, items: [] });
    await listTransactions({ limit: 25, offset: 50 });
    expect(fn).toHaveBeenCalledWith(
      "http://localhost:8000/transactions?limit=25&offset=50",
      expect.any(Object),
    );
  });

  it("importCsv sends multipart with file", async () => {
    const fn = mockJsonOnce({ received_rows: 0, created: 0, errors: [], transactions: [] });
    const blob = new Blob(["date,description,amount\n2026-01-01,Test,-10.00\n"], {
      type: "text/csv",
    });
    await importCsv(blob, "my.csv");
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("http://localhost:8000/transactions/import");
    expect(init?.body).toBeInstanceOf(FormData);
    // FormData should NOT get a Content-Type header from us — the browser sets the boundary.
    const headers = init?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBeUndefined();
  });
});
