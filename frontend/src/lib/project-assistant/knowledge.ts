export type KnowledgeEntry = {
  id: string;
  title: string;
  keywords: string[];
  questions: string[];
  answer: string;
  links?: { label: string; href: string }[];
  category: string;
};

export const KNOWLEDGE_BASE: KnowledgeEntry[] = [
  {
    id: "what-is-ledgerlens",
    title: "What is LedgerLens?",
    keywords: ["what", "ledgerlens", "about", "overview", "purpose"],
    questions: [
      "what is ledgerlens",
      "what does this do",
      "tell me about this project",
      "what is this app",
    ],
    answer:
      "LedgerLens is a portfolio-grade bookkeeping cleanup and accountant handoff assistant. It turns messy monthly bank transactions into a reviewed categorization package that a small-business owner can send to their accountant. It is NOT accounting software, NOT a substitute for a CPA, and NOT safe for real bank data.",
    links: [
      { label: "Homepage", href: "/" },
      { label: "Technical story", href: "/technical-story" },
    ],
    category: "overview",
  },
  {
    id: "not-accounting-software",
    title: "Is this accounting software?",
    keywords: ["accounting", "software", "ledger", "double-entry", "quickbooks", "xero"],
    questions: [
      "is this accounting software",
      "does this replace quickbooks",
      "does it connect to xero",
      "is this a ledger",
      "does it do double entry",
      "quickbooks integration",
      "xero integration",
    ],
    answer:
      "No. LedgerLens produces a reviewed categorization and an accountant handoff package — not a double-entry accounting ledger. It does not connect to QuickBooks, Xero, or Plaid. The accountant takes the handoff output and books the entries in their own accounting system. Live integrations are documented as future research, not shipped features.",
    links: [{ label: "Accounting boundary", href: "/technical-story" }],
    category: "accounting boundary",
  },
  {
    id: "trust-metric",
    title: "What does 100% verified mean?",
    keywords: ["trust", "verified", "100", "accuracy", "procedural", "metric"],
    questions: [
      "what does verified mean",
      "what does 100 percent mean",
      "is that raw accuracy",
      "what is the trust metric",
      "how accurate is it",
      "procedural verification",
    ],
    answer:
      "The 100% trust metric means every finalized row in the guided demo was procedurally verified — backed by a deterministic rule, a correction-memory replay, or an explicit human review. This is a workflow trust boundary, NOT raw AI accuracy. Raw model accuracy on the eval dataset is about 63% overall. The distinction matters: uncertain rows are routed to review instead of auto-approved.",
    links: [{ label: "Eval evidence", href: "/evals" }],
    category: "trust metric",
  },
  {
    id: "demo-workflow",
    title: "How does the demo work?",
    keywords: ["demo", "try", "walkthrough", "guided", "how", "start"],
    questions: [
      "how do i try this",
      "how does the demo work",
      "where do i start",
      "walk me through it",
      "guided demo",
    ],
    answer:
      "The 3-minute guided demo at /demo walks you through the full cleanup workflow: seed sample transactions, categorize them, review uncertain rows, answer owner questions, and export the accountant handoff. Every step calls the real backend — no mocked data. The demo runs in zero-cost mode (no paid API calls).",
    links: [
      { label: "Start the demo", href: "/demo" },
      { label: "Monthly cleanup", href: "/cleanup" },
    ],
    category: "demo workflow",
  },
  {
    id: "real-data-warning",
    title: "Can I upload real bank data?",
    keywords: ["real", "bank", "data", "upload", "safe", "production"],
    questions: [
      "can i upload real data",
      "is it safe for real bank data",
      "should i use real transactions",
      "production ready",
    ],
    answer:
      "No. The public demo runs on synthetic sample data with no production authentication or tenant isolation. Do NOT upload real bank statements, account numbers, payroll data, or sensitive financial information. Use the bundled sample CSV or invented data only.",
    category: "security",
  },
  {
    id: "categorization-pipeline",
    title: "How does categorization work?",
    keywords: [
      "categorization", "pipeline", "rules", "memory", "model", "how",
      "classify", "categorize", "layers",
    ],
    questions: [
      "how does categorization work",
      "what is the pipeline",
      "how are transactions categorized",
      "layered pipeline",
    ],
    answer:
      "Transactions pass through a three-layer pipeline: (1) Correction memory — reuses prior human corrections via exact or fingerprint matching. (2) 50 deterministic rules — pattern-matching for known vendors like NAPA, ADP, Eversource, etc. (3) Model fallback — in demo mode this is a zero-cost stub that routes to review; in private mode it's Claude Haiku. High-confidence rows auto-approve; uncertain rows route to human review.",
    links: [{ label: "Technical story", href: "/technical-story" }],
    category: "categorization pipeline",
  },
  {
    id: "correction-memory",
    title: "What is correction memory?",
    keywords: ["correction", "memory", "fingerprint", "remember", "learn"],
    questions: [
      "what is correction memory",
      "does it learn from corrections",
      "how does fingerprint matching work",
      "what is merchant fingerprint",
    ],
    answer:
      "When a reviewer corrects a transaction, LedgerLens saves a correction-memory row. Future transactions with the same merchant are automatically categorized the same way — zero model cost. Tier-2 fingerprint matching normalizes noisy bank descriptions (different store numbers, ACH prefixes) so a correction for 'POS NAPA #4382' also helps with 'DEBIT CARD NAPA #9876'. Ambiguous vendors like Amazon are blocked from fingerprint matching.",
    category: "correction memory",
  },
  {
    id: "vendor-normalization",
    title: "What is vendor normalization?",
    keywords: ["vendor", "normalization", "normalize", "merchant", "noise", "bank"],
    questions: [
      "what is vendor normalization",
      "why are amazon and costco routed to review",
      "ambiguous vendors",
      "how does vendor matching work",
    ],
    answer:
      "Bank statements are noisy — 'ACH DEBIT NAPA AUTO PARTS #4382 NH 03301' is the same vendor as 'POS NAPA AUTO PARTS'. The vendor normalizer strips payment prefixes, store numbers, auth codes, and trailing noise to produce stable lookup keys. It recognizes 45+ vendor families. Ambiguous vendors (Amazon, Costco, Home Depot, Walmart, Lowe's, Target) are detected but NOT auto-categorized — they need owner context per purchase.",
    category: "vendor normalization",
  },
  {
    id: "exports",
    title: "What exports are available?",
    keywords: ["export", "csv", "markdown", "handoff", "download", "package"],
    questions: [
      "what exports are available",
      "how do i download the handoff",
      "what is in the export package",
      "what are the 7 exports",
    ],
    answer:
      "The handoff package includes 7 separated exports: (1) Full ledger CSV, (2) Reviewed rows CSV, (3) Accountant follow-up CSV, (4) Owner questions CSV, (5) Split transaction lines CSV, (6) Handoff summary Markdown, (7) Package manifest JSON. Each download uses a reliable fetch→blob mechanism — no silent dud files on mobile. These are NOT QuickBooks/Xero import files.",
    links: [{ label: "Handoff page", href: "/handoff" }],
    category: "accountant exports",
  },
  {
    id: "split-transactions",
    title: "What are split transactions?",
    keywords: ["split", "transaction", "multiple", "categories", "lines"],
    questions: [
      "what is split transaction support",
      "can i split a transaction",
      "how do splits work",
    ],
    answer:
      "When a single bank transaction covers multiple categories (e.g. Amazon order = shop supplies + personal), you can split it into multiple lines, each with its own category and amount. The split total must equal the original transaction amount. This is reviewed-categorization splitting for accountant handoff — not double-entry accounting and not posted automatically.",
    category: "split transactions",
  },
  {
    id: "tech-stack",
    title: "What tech stack is this built with?",
    keywords: ["tech", "stack", "framework", "language", "next", "fastapi", "python", "typescript"],
    questions: [
      "what tech stack",
      "what is this built with",
      "what framework",
      "what language",
      "what database",
    ],
    answer:
      "Frontend: Next.js (App Router), TypeScript, Tailwind CSS. Backend: FastAPI, Python 3.12, SQLAlchemy 2.0, Alembic migrations. Database: SQLite (demo) / PostgreSQL (Railway deploy). Eval harness: custom Python with per-category metrics, confusion pairs, and safety reporting. CI: GitHub Actions (ruff, mypy, pytest, vitest, eslint, Next.js build).",
    links: [
      { label: "Technical story", href: "/technical-story" },
      { label: "GitHub", href: "https://github.com/mpalmer79/LedgerLens" },
    ],
    category: "tech stack",
  },
  {
    id: "synthetic-data",
    title: "Is the demo using real data?",
    keywords: ["synthetic", "sample", "fictional", "real", "data", "granite"],
    questions: [
      "is this real data",
      "is the demo real",
      "what is granite state auto repair",
      "is that a real business",
    ],
    answer:
      "No. The demo scenario — Granite State Auto Repair, March 2026 — is a fictional independent auto repair shop. It is not a real business, not a real customer, and not anyone's actual books. Every page that names it carries a 'Sample / fictional scenario' badge. The eval dataset contains 302 synthetic transactions across 3 fictional businesses.",
    category: "synthetic data",
  },
  {
    id: "anthropic-usage",
    title: "Does this use Claude / Anthropic?",
    keywords: ["anthropic", "claude", "ai", "model", "llm", "api"],
    questions: [
      "does it use anthropic",
      "does it use claude",
      "is there an ai model",
      "does it call an llm",
    ],
    answer:
      "The deployed public demo runs in zero-cost demo-stub mode — the Anthropic SDK is never imported and no paid API calls are made. A regression test asserts this. In private/local mode, Claude Haiku 4.5 can be used as the model fallback. The categorization pipeline prefers deterministic rules and correction memory before any model call.",
    category: "tech stack",
  },
  {
    id: "security-tenant",
    title: "How is security / tenant isolation handled?",
    keywords: ["security", "tenant", "isolation", "business", "scoped", "auth"],
    questions: [
      "how is tenant isolation handled",
      "is there authentication",
      "how is security handled",
      "is this multi-tenant",
    ],
    answer:
      "LedgerLens has a tenant-boundary foundation: core workflow tables carry business_id, service and API reads/writes are scoped to the active business, and cross-business leakage is covered by regression tests. However, there is no production authentication (no passwords, JWTs, or OAuth). This is a serious foundation, not a production-ready claim. Sensitive-data guardrails redact obvious PII from audit/log payloads.",
    category: "security",
  },
  {
    id: "roadmap",
    title: "What would be built next?",
    keywords: ["roadmap", "next", "future", "planned", "todo", "remaining"],
    questions: [
      "what is the roadmap",
      "what would you build next",
      "what is missing",
      "what remains",
    ],
    answer:
      "Key remaining work: (1) Production authentication — real login, JWT, protected routes. (2) QuickBooks/Xero export integration — research is documented, no live sync. (3) Per-business rule packs — so eval accuracy matches per-COA. (4) Frontend split transaction UI — backend API is ready. (5) Backup/restore drill — runbook exists, no verified drill. (6) Full PII pipeline — current guardrails are a floor, not a ceiling.",
    category: "roadmap",
  },
  {
    id: "about-builder",
    title: "Who built this?",
    keywords: ["who", "built", "builder", "michael", "palmer", "about"],
    questions: [
      "who built this",
      "who is michael palmer",
      "about the builder",
    ],
    answer:
      "LedgerLens was built by Michael Palmer as a portfolio project demonstrating staff-level AI workflow engineering, accounting-domain design, and full-stack product delivery.",
    links: [{ label: "About Michael", href: "/about" }],
    category: "overview",
  },
];
