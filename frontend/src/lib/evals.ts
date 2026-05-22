import fs from 'node:fs';
import path from 'node:path';

export type EvalSummary = {
  categorizer: string;
  accuracy_overall: number;
  run_timestamp: string;
};

/**
 * Read the latest committed eval JSON from `evals/runs/` and return a summary.
 *
 * Resolution strategy:
 *   1. Walk up from this module's location looking for an `evals/runs/` directory.
 *      (Works during `next build` invoked from `frontend/` and during local dev.)
 *   2. If no directory is found, return null. Callers fall back to the stub
 *      baseline constant. This is the expected state in production: the frontend
 *      Dockerfile copies only `frontend/` into the image, so `evals/runs/` is not
 *      present and the page renders the baseline.
 *
 * Among the runs found, prefer the most recent non-stub categorizer (filename
 * starts with `YYYY-MM-DD-<name>` so lexicographic sort by filename is also
 * chronological). If only stub runs exist, return the latest stub.
 */
export function loadLatestEvalSummary(): EvalSummary | null {
  const runsDir = findRunsDir();
  if (!runsDir) return null;

  let entries: string[];
  try {
    entries = fs.readdirSync(runsDir);
  } catch {
    return null;
  }
  const files = entries
    .filter((name) => name.endsWith('.json'))
    .filter((name) => name !== 'README.md')
    .sort()
    .reverse();
  if (files.length === 0) return null;

  const nonStub = files.find((name) => !name.includes('stub'));
  const chosen = nonStub ?? files[0];

  try {
    const raw = fs.readFileSync(path.join(runsDir, chosen), 'utf8');
    const parsed = JSON.parse(raw);
    const meta = parsed.run_metadata ?? {};
    const overall = parsed.metrics?.overall ?? {};
    if (typeof overall.accuracy !== 'number') return null;
    return {
      categorizer: meta.categorizer_name ?? 'unknown',
      accuracy_overall: overall.accuracy,
      run_timestamp: meta.timestamp_utc ?? '',
    };
  } catch {
    return null;
  }
}

function findRunsDir(): string | null {
  const candidates: string[] = [];
  let cursor = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    candidates.push(path.join(cursor, 'evals', 'runs'));
    cursor = path.dirname(cursor);
  }
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
  }
  return null;
}
