import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ApiError,
  getApiBaseUrl,
  getReviewQueue,
  importCsv,
  listTransactions,
  resetDemo,
  seedDemo,
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

describe("ApiError envelope", () => {
  it("carries userMessage + retryable for network errors", async () => {
    global.fetch = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    try {
      await listTransactions();
      throw new Error("expected ApiError");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      const apiErr = err as ApiError;
      expect(apiErr.code).toBe("network_error");
      expect(apiErr.retryable).toBe(true);
      expect(apiErr.userMessage).toContain("could not reach the demo backend");
    }
  });

  it("marks 503 as retryable but 404 as not retryable", () => {
    expect(new ApiError("nope", 503).retryable).toBe(true);
    expect(new ApiError("nope", 504).retryable).toBe(true);
    expect(new ApiError("nope", 429).retryable).toBe(true);
    expect(new ApiError("nope", 404).retryable).toBe(false);
    expect(new ApiError("nope", 400).retryable).toBe(false);
    expect(new ApiError("nope", 200).retryable).toBe(false);
  });

  it("uses a plain-English userMessage for common failure modes", () => {
    expect(new ApiError("x", 0, "network_error").userMessage).toContain(
      "could not reach the demo backend",
    );
    expect(new ApiError("x", 0, "timeout").userMessage).toContain("taking longer");
    expect(new ApiError("x", 503).userMessage).toContain("temporarily unavailable");
    expect(new ApiError("x", 404).userMessage).toContain("couldn’t find");
    expect(new ApiError("x", 500).userMessage).toContain("backend responded with an error");
  });
});

describe("retry behavior", () => {
  it("retries safe GETs once on network error then throws", async () => {
    const fn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    global.fetch = fn as unknown as typeof fetch;
    await expect(listTransactions()).rejects.toBeInstanceOf(ApiError);
    // Default: 1 retry → 2 attempts total.
    expect(fn.mock.calls.length).toBe(2);
  });

  it("retries safe GETs on 503 then throws", async () => {
    const fn = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "down" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fn as unknown as typeof fetch;
    await expect(listTransactions()).rejects.toMatchObject({ status: 503 });
    expect(fn.mock.calls.length).toBe(2);
  });

  it("does NOT retry POST mutations on 5xx", async () => {
    const fn = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "kaboom" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fn as unknown as typeof fetch;
    await expect(seedDemo()).rejects.toBeInstanceOf(ApiError);
    expect(fn.mock.calls.length).toBe(1);
  });

  it("does NOT retry POST mutations on network error", async () => {
    const fn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    global.fetch = fn as unknown as typeof fetch;
    await expect(resetDemo()).rejects.toBeInstanceOf(ApiError);
    expect(fn.mock.calls.length).toBe(1);
  });

  it("does NOT retry GETs on 404 (non-retryable status)", async () => {
    const fn = vi.fn(async () =>
      new Response(JSON.stringify({ detail: "not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      }),
    );
    global.fetch = fn as unknown as typeof fetch;
    await expect(listTransactions()).rejects.toMatchObject({ status: 404 });
    expect(fn.mock.calls.length).toBe(1);
  });

  it("succeeds on the second attempt when the first fails", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt === 1) throw new TypeError("fetch failed");
      return new Response(JSON.stringify({ total: 0, items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    });
    global.fetch = fn as unknown as typeof fetch;
    const out = await listTransactions();
    expect(out).toEqual({ total: 0, items: [] });
    expect(fn.mock.calls.length).toBe(2);
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
