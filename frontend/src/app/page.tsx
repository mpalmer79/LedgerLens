"use client";

import { useState } from "react";

import { Logomark } from "@/components/ui/Logomark";

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
    <main className="bg-surface-page text-text-primary min-h-screen flex flex-col items-center justify-center text-center px-6">
      <Logomark size={32} className="text-brand-600 mb-4" />
      <h1 className="font-display text-5xl font-medium tracking-tight">LedgerLens</h1>
      <p className="mt-4 text-lg text-text-secondary">
        Bank transaction categorization for bookkeepers.
      </p>
      <p className="mt-6 text-xs text-text-subtle mono">API base URL: {API_BASE_URL}</p>
      <button
        type="button"
        onClick={checkApi}
        className="mt-4 rounded-md bg-brand-600 px-4 py-2 text-sm text-white hover:bg-brand-500 transition-colors duration-short ease-out-expo"
      >
        Check API
      </button>
      {response && (
        <pre className="mono mt-4 rounded-md bg-surface-sunken p-3 text-left text-xs">
          {response}
        </pre>
      )}
      {error && <p className="mt-4 text-sm text-severity-critical">Error: {error}</p>}
    </main>
  );
}
