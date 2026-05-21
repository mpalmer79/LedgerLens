"use client";

import { useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "unset";

export default function Page() {
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkApi() {
    setError(null);
    setResponse(null);
    try {
      const res = await fetch(`${API_BASE_URL}/health`);
      const body = await res.json();
      setResponse(JSON.stringify(body, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center text-center">
      <h1 className="text-4xl font-semibold tracking-tight">LedgerLens</h1>
      <p className="mt-4 text-lg text-gray-600">
        Bank transaction categorization for bookkeepers.
      </p>
      <p className="mt-6 text-xs text-gray-400">API base URL: {API_BASE_URL}</p>
      <button
        type="button"
        onClick={checkApi}
        className="mt-4 rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
      >
        Check API
      </button>
      {response && (
        <pre className="mt-4 rounded bg-gray-100 p-3 text-left text-xs">{response}</pre>
      )}
      {error && (
        <p className="mt-4 text-sm text-red-600">Error: {error}</p>
      )}
    </main>
  );
}
