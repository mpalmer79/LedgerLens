import { KNOWLEDGE_BASE, type KnowledgeEntry } from "./knowledge";

export type MatchResult = {
  entry: KnowledgeEntry | null;
  score: number;
  confidence: "high" | "medium" | "low";
};

const FALLBACK_ANSWER =
  "I can only answer from the curated LedgerLens project knowledge base. " +
  "Try asking about the demo workflow, trust metric, exports, tech stack, " +
  "correction memory, vendor normalization, or roadmap.";

const OUT_OF_SCOPE_ANSWER =
  "Good question, but I'm only designed to answer questions about the " +
  "LedgerLens project. For accounting, tax, legal, or real financial " +
  "decisions, please consult a qualified professional.";

const OUT_OF_SCOPE_KEYWORDS = [
  "tax", "taxes", "irs", "cpa", "audit", "legal", "lawyer", "attorney",
  "sue", "refund", "owe", "filing", "deduction", "w2", "1099",
  "bank account", "routing number", "social security", "ssn",
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return normalize(text).split(" ").filter(Boolean);
}

function scoreEntry(query: string, entry: KnowledgeEntry): number {
  const norm = normalize(query);
  const tokens = tokenize(query);
  let score = 0;

  for (const q of entry.questions) {
    if (normalize(q) === norm) return 100;
    if (norm.includes(normalize(q))) score = Math.max(score, 80);
    if (normalize(q).includes(norm)) score = Math.max(score, 70);
  }

  for (const kw of entry.keywords) {
    if (tokens.includes(kw.toLowerCase())) score += 15;
    if (norm.includes(kw.toLowerCase())) score += 10;
  }

  const titleNorm = normalize(entry.title);
  if (norm.includes(titleNorm) || titleNorm.includes(norm)) {
    score += 20;
  }

  return Math.min(score, 100);
}

export function matchQuery(query: string): MatchResult {
  if (!query.trim()) {
    return { entry: null, score: 0, confidence: "low" };
  }

  const norm = normalize(query);
  if (OUT_OF_SCOPE_KEYWORDS.some((kw) => norm.includes(kw))) {
    return {
      entry: {
        id: "out-of-scope",
        title: "Out of scope",
        keywords: [],
        questions: [],
        answer: OUT_OF_SCOPE_ANSWER,
        category: "safety",
      },
      score: 100,
      confidence: "high",
    };
  }

  let best: KnowledgeEntry | null = null;
  let bestScore = 0;
  for (const entry of KNOWLEDGE_BASE) {
    const s = scoreEntry(query, entry);
    if (s > bestScore) {
      bestScore = s;
      best = entry;
    }
  }

  if (bestScore >= 50) {
    return { entry: best, score: bestScore, confidence: "high" };
  }
  if (bestScore >= 25 && best) {
    return { entry: best, score: bestScore, confidence: "medium" };
  }
  return {
    entry: {
      id: "fallback",
      title: "No match",
      keywords: [],
      questions: [],
      answer: FALLBACK_ANSWER,
      category: "fallback",
    },
    score: 0,
    confidence: "low",
  };
}

export function getSuggestedQuestions(pathname?: string): string[] {
  const defaults = [
    "What is LedgerLens?",
    "What does 100% verified mean?",
    "How does the demo work?",
  ];

  if (pathname?.startsWith("/demo")) {
    return [
      "What happens in this demo?",
      "What does verified mean?",
      "Why are some rows unresolved?",
    ];
  }
  if (pathname?.startsWith("/handoff")) {
    return [
      "What exports are available?",
      "Is this QuickBooks-ready?",
      "What should the accountant review?",
    ];
  }
  if (pathname?.startsWith("/technical")) {
    return [
      "What is the tech stack?",
      "How does correction memory work?",
      "Why not just an LLM wrapper?",
    ];
  }
  if (pathname?.startsWith("/evals")) {
    return [
      "Why is raw accuracy not 100%?",
      "What does the trust metric mean?",
      "How does review routing help?",
    ];
  }
  return defaults;
}
