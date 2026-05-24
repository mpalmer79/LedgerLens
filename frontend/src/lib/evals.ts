import fs from 'node:fs';
import path from 'node:path';

// ────────────────────────────────────────────────────────────────────────────
// Schema — derived from the actual JSON produced by
// backend/src/ledgerlens/evals/writer.py.
// ────────────────────────────────────────────────────────────────────────────

export type EvalSummary = {
  categorizer: string;
  accuracy_overall: number;
  run_timestamp: string;
};

export type LatencyStats = {
  p50_ms: number;
  p95_ms: number;
  mean_ms: number;
};

export type ReliabilityBucket = {
  bucket: string;
  count: number;
  predicted_confidence_mean: number;
  actual_accuracy: number;
};

export type PerCategoryMetrics = {
  precision: number;
  recall: number;
  support: number;
};

export type ConfusionPair = {
  actual: string;
  predicted: string;
  count: number;
  percentage_of_actual: number;
};

export type RoutingMetrics = {
  total?: number;
  auto_approved?: number;
  needs_review?: number;
  uncategorizable?: number;
  failed?: number;
  auto_approved_rate?: number;
  review_rate?: number;
  auto_approved_accuracy?: number;
  model_called?: number;
  model_called_rate?: number;
  zero_cost?: number;
  zero_cost_rate?: number;
  by_provider?: Record<string, number>;
  cost_per_100?: number;
  cost_per_100_model_only_baseline?: number | null;
  cost_savings_per_100?: number | null;
};

export type CalibrationBlock = {
  label: string;
  count: number;
  ece: number;
  mce: number;
  buckets: ReliabilityBucket[];
  warning: string | null;
};

export type CalibrationMetrics = {
  overall?: CalibrationBlock;
  model_only?: CalibrationBlock;
  deterministic?: CalibrationBlock;
};

export type MappingIntentCount = {
  intent: string;
  count: number;
};

export type MappingMetrics = {
  enabled: boolean;
  mapped_intent_count: number;
  fallback_to_default_count: number;
  routed_to_review_count: number;
  unmapped_intent_count: number;
  mapping_override_count: number;
  correct_when_mapped: number;
  correct_when_fallback: number;
  top_unmapped_intents: MappingIntentCount[];
  top_rule_intents: MappingIntentCount[];
};

export type MetricsSlice = {
  accuracy: number;
  per_category: Record<string, PerCategoryMetrics>;
  reliability_diagram: ReliabilityBucket[];
  latency_stats: LatencyStats;
  total_cost: number;
  cost_per_100: number;
  transaction_count: number;
  top_confusions?: ConfusionPair[];
  category_coverage?: Record<string, unknown>;
  routing?: RoutingMetrics;
  calibration?: CalibrationMetrics;
  mapping?: MappingMetrics;
};

export type RunMetadata = {
  dataset_version: string;
  categorizer_name: string;
  model: string | null;
  timestamp_utc: string;
  git_sha: string | null;
};

export type Prediction = {
  transaction_id: string;
  predicted_category_code: string;
  confidence: number;
  reasoning: string;
  alternative_category_code: string | null;
  cost_usd: number;
  latency_ms: number;
  model: string | null;
  matched_rule_intent?: string | null;
  mapping_outcome?: string | null;
};

export type EvalRun = {
  filename: string;
  run_metadata: RunMetadata;
  metrics: {
    overall: MetricsSlice;
    non_adversarial: MetricsSlice;
    adversarial: MetricsSlice;
  };
  predictions: Prediction[];
};

// Dataset transactions used to cross-reference predictions against ground
// truth, the is_adversarial flag, and the raw description.
export type DatasetTransaction = {
  id: string;
  date: string;
  amount_cents: number;
  raw_description: string;
  proposed_category_code: string;
  label_confidence: 'high' | 'medium' | 'low';
  is_adversarial: boolean;
  reasoning: string;
  labeler_notes: string | null;
};

export type DatasetAccount = {
  code: string;
  name: string;
  description: string;
  parent_code: string | null;
  type: string;
};

export type DatasetIndex = Record<string, {
  business_name: string;
  transactions: DatasetTransaction[];
  accounts_by_code: Record<string, DatasetAccount>;
}>;

// ────────────────────────────────────────────────────────────────────────────
// Filesystem resolution
// ────────────────────────────────────────────────────────────────────────────

function findEvalsDir(): string | null {
  let cursor = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    const candidate = path.join(cursor, 'evals');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    cursor = path.dirname(cursor);
  }
  return null;
}

function findRunsDir(): string | null {
  const root = findEvalsDir();
  if (!root) return null;
  const runs = path.join(root, 'runs');
  return fs.existsSync(runs) ? runs : null;
}

// ────────────────────────────────────────────────────────────────────────────
// Run loading
// ────────────────────────────────────────────────────────────────────────────

function listRuns(filter: (name: string) => boolean): string[] {
  const dir = findRunsDir();
  if (!dir) return [];
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith('.json') && filter(n))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

function loadRunFile(filename: string): EvalRun | null {
  const dir = findRunsDir();
  if (!dir) return null;
  try {
    const raw = fs.readFileSync(path.join(dir, filename), 'utf8');
    const parsed = JSON.parse(raw) as Omit<EvalRun, 'filename'>;
    return { filename, ...parsed };
  } catch {
    return null;
  }
}

export function loadLatestEvalRun(): EvalRun | null {
  // Prefer the most recent claude-haiku run; fall back to any non-stub run;
  // finally fall back to any run.
  const haiku = listRuns((n) => n.includes('claude-haiku'));
  if (haiku.length > 0) return loadRunFile(haiku[0]);
  const nonStub = listRuns((n) => !n.includes('stub'));
  if (nonStub.length > 0) return loadRunFile(nonStub[0]);
  const anyRun = listRuns(() => true);
  if (anyRun.length > 0) return loadRunFile(anyRun[0]);
  return null;
}

export function loadStubBaseline(): EvalRun | null {
  const stub = listRuns((n) => n.includes('stub'));
  if (stub.length === 0) return null;
  return loadRunFile(stub[0]);
}

export type ComparisonRunSummary = {
  categorizer: string;
  filename: string;
  timestamp_utc: string;
  transactions: number;
  overall_accuracy: number;
  non_adversarial_accuracy: number;
  adversarial_accuracy: number;
  cost_per_100: number;
  p95_latency_ms: number;
  routing: RoutingMetrics;
  calibration: CalibrationMetrics;
  mapping?: MappingMetrics;
};

export type ComparisonArtifact = {
  filename: string;
  generated_at: string;
  runs: ComparisonRunSummary[];
  notes: string[];
};

export function loadLatestComparison(): ComparisonArtifact | null {
  const dir = findRunsDir();
  if (!dir) return null;
  const files = listRuns((n) => n.includes('comparison'));
  if (files.length === 0) return null;
  try {
    const raw = fs.readFileSync(path.join(dir, files[0]), 'utf8');
    const parsed = JSON.parse(raw) as Omit<ComparisonArtifact, 'filename'>;
    return { filename: files[0], ...parsed };
  } catch {
    return null;
  }
}

// Compact summary used by the landing page; preserves backward compatibility
// with the loader introduced in session 9.
export function loadLatestEvalSummary(): EvalSummary | null {
  const run = loadLatestEvalRun();
  if (!run) return null;
  return {
    categorizer: run.run_metadata.categorizer_name,
    accuracy_overall: run.metrics.overall.accuracy,
    run_timestamp: run.run_metadata.timestamp_utc,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dataset cross-reference — predictions don't carry ground truth or the
// is_adversarial flag, so we load them from the dataset JSONs.
// ────────────────────────────────────────────────────────────────────────────

const BUSINESS_DISPLAY: Record<string, string> = {
  'coffee-shop': 'Lighthouse Roasters',
  'design-agency': 'Northwind Design Co.',
  'auto-repair': 'Granite State Auto Service',
};

export function businessIdFromTransactionId(transactionId: string): string {
  // IDs are formed as "<business-id>-tx-NNN"; everything before "-tx-" is the
  // business id.
  const idx = transactionId.lastIndexOf('-tx-');
  return idx >= 0 ? transactionId.slice(0, idx) : transactionId;
}

export function loadDataset(version: string): DatasetIndex | null {
  const root = findEvalsDir();
  if (!root) return null;
  const versionDir = path.join(root, 'datasets', version);
  if (!fs.existsSync(versionDir)) return null;

  let businesses: { id: string }[];
  try {
    const index = JSON.parse(fs.readFileSync(path.join(versionDir, 'index.json'), 'utf8'));
    businesses = index.businesses ?? [];
  } catch {
    return null;
  }

  const out: DatasetIndex = {};
  for (const entry of businesses) {
    try {
      const bizDir = path.join(versionDir, entry.id);
      const txs: DatasetTransaction[] = JSON.parse(
        fs.readFileSync(path.join(bizDir, 'transactions.json'), 'utf8'),
      );
      const business = JSON.parse(fs.readFileSync(path.join(bizDir, 'business.json'), 'utf8'));
      const accounts: DatasetAccount[] = JSON.parse(
        fs.readFileSync(path.join(bizDir, 'chart_of_accounts.json'), 'utf8'),
      );
      const accountsByCode: Record<string, DatasetAccount> = {};
      for (const a of accounts) accountsByCode[a.code] = a;
      out[entry.id] = {
        business_name: business.name ?? BUSINESS_DISPLAY[entry.id] ?? entry.id,
        transactions: txs,
        accounts_by_code: accountsByCode,
      };
    } catch {
      // Skip any malformed business.
    }
  }
  return out;
}

// ────────────────────────────────────────────────────────────────────────────
// Derived analyses for the dashboard
// ────────────────────────────────────────────────────────────────────────────

export type PerBusinessSummary = {
  business_id: string;
  business_name: string;
  transaction_count: number;
  overall_accuracy: number;
  adversarial_count: number;
  adversarial_accuracy: number;
  total_cost: number;
};

export function summarizePerBusiness(run: EvalRun, dataset: DatasetIndex): PerBusinessSummary[] {
  // Build a quick lookup: tx_id → dataset transaction
  const txByID = new Map<string, DatasetTransaction>();
  for (const biz of Object.values(dataset)) {
    for (const t of biz.transactions) txByID.set(t.id, t);
  }

  const buckets: Record<
    string,
    {
      transaction_count: number;
      correct: number;
      adversarial_count: number;
      adversarial_correct: number;
      total_cost: number;
    }
  > = {};

  for (const p of run.predictions) {
    const bizId = businessIdFromTransactionId(p.transaction_id);
    if (!buckets[bizId]) {
      buckets[bizId] = {
        transaction_count: 0,
        correct: 0,
        adversarial_count: 0,
        adversarial_correct: 0,
        total_cost: 0,
      };
    }
    const b = buckets[bizId];
    const truth = txByID.get(p.transaction_id);
    const isCorrect = truth?.proposed_category_code === p.predicted_category_code;
    b.transaction_count += 1;
    if (isCorrect) b.correct += 1;
    b.total_cost += p.cost_usd;
    if (truth?.is_adversarial) {
      b.adversarial_count += 1;
      if (isCorrect) b.adversarial_correct += 1;
    }
  }

  return Object.entries(buckets)
    .map(([business_id, b]) => ({
      business_id,
      business_name: dataset[business_id]?.business_name ?? BUSINESS_DISPLAY[business_id] ?? business_id,
      transaction_count: b.transaction_count,
      overall_accuracy: b.transaction_count > 0 ? b.correct / b.transaction_count : 0,
      adversarial_count: b.adversarial_count,
      adversarial_accuracy:
        b.adversarial_count > 0 ? b.adversarial_correct / b.adversarial_count : 0,
      total_cost: b.total_cost,
    }))
    .sort((a, b) => a.business_id.localeCompare(b.business_id));
}

export type AdversarialDeepDive = {
  transaction_id: string;
  business_id: string;
  business_name: string;
  raw_description: string;
  amount_cents: number;
  ground_truth_code: string;
  ground_truth_name: string;
  predicted_code: string;
  predicted_name: string;
  confidence: number;
  reasoning: string;
  status: 'correct' | 'incorrect' | 'routed-to-review';
};

const REVIEW_THRESHOLD = 0.6;

export function adversarialDeepDive(
  run: EvalRun,
  dataset: DatasetIndex,
  limit = 5,
): AdversarialDeepDive[] {
  const out: AdversarialDeepDive[] = [];
  for (const p of run.predictions) {
    const bizId = businessIdFromTransactionId(p.transaction_id);
    const biz = dataset[bizId];
    if (!biz) continue;
    const truth = biz.transactions.find((t) => t.id === p.transaction_id);
    if (!truth || !truth.is_adversarial) continue;

    const isCorrect = truth.proposed_category_code === p.predicted_category_code;
    const status: AdversarialDeepDive['status'] =
      p.confidence < REVIEW_THRESHOLD ? 'routed-to-review' : isCorrect ? 'correct' : 'incorrect';

    out.push({
      transaction_id: p.transaction_id,
      business_id: bizId,
      business_name: biz.business_name,
      raw_description: truth.raw_description,
      amount_cents: truth.amount_cents,
      ground_truth_code: truth.proposed_category_code,
      ground_truth_name:
        biz.accounts_by_code[truth.proposed_category_code]?.name ?? truth.proposed_category_code,
      predicted_code: p.predicted_category_code,
      predicted_name:
        biz.accounts_by_code[p.predicted_category_code]?.name ?? p.predicted_category_code,
      confidence: p.confidence,
      reasoning: p.reasoning,
      status,
    });
  }

  // Prefer the most interesting stories: incorrect first, then routed-to-review, then correct;
  // within each tier sort by confidence ascending (lower = more interesting).
  const tier = (s: AdversarialDeepDive['status']) =>
    s === 'incorrect' ? 0 : s === 'routed-to-review' ? 1 : 2;
  out.sort((a, b) => {
    const t = tier(a.status) - tier(b.status);
    return t !== 0 ? t : a.confidence - b.confidence;
  });
  return out.slice(0, limit);
}
