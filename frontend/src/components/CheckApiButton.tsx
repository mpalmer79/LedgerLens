"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

type Props = {
  apiBaseUrl: string;
};

export function CheckApiButton({ apiBaseUrl }: Props) {
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkApi() {
    setError(null);
    setResponse(null);
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/health`);
      const body = await res.json();
      setResponse(JSON.stringify(body, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-surface-border bg-surface-panel p-4 max-w-2xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-left">
          <p className="field-label">API base URL</p>
          <p className="mono mt-1 text-text-primary break-all">{apiBaseUrl}</p>
        </div>
        <button
          type="button"
          onClick={checkApi}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors duration-short ease-out-expo hover:bg-brand-500 disabled:opacity-60"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : null}
          {loading ? "Checking..." : "Check API"}
        </button>
      </div>
      {response && (
        <pre className="mono mt-4 rounded-md bg-surface-sunken p-3 text-left text-xs overflow-x-auto">
          {response}
        </pre>
      )}
      {error && (
        <p className="mt-4 text-sm text-severity-critical">Error: {error}</p>
      )}
    </div>
  );
}
