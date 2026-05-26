/**
 * Template-based business-use-case adaptation.
 *
 * Generates honest, helpful answers about how LedgerLens would apply
 * to a specific small-business type — without calling external APIs,
 * making accounting claims, or pretending industry-specific rule
 * packs exist.
 */

type IndustryProfile = {
  label: string;
  examples: string[];
  sensitive: boolean;
};

const INDUSTRIES: Record<string, IndustryProfile> = {
  dental: {
    label: "a dental office",
    examples: [
      "dental supplies", "lab fees", "practice management software",
      "payroll", "insurance", "rent", "utilities", "merchant fees",
      "equipment payments", "owner draws",
    ],
    sensitive: true,
  },
  restaurant: {
    label: "a restaurant or cafe",
    examples: [
      "food inventory", "beverage inventory", "payroll",
      "merchant fees", "delivery platform fees", "rent",
      "utilities", "repairs", "cleaning supplies", "owner draws",
    ],
    sensitive: false,
  },
  landscaping: {
    label: "a landscaping or lawn care business",
    examples: [
      "materials", "fuel", "equipment rental", "repairs",
      "payroll", "insurance", "subcontractors", "utilities",
      "software", "owner draws",
    ],
    sensitive: false,
  },
  contractor: {
    label: "a contractor or construction business",
    examples: [
      "building materials", "fuel", "equipment rental",
      "subcontractors", "payroll", "insurance", "permits",
      "utilities", "software", "owner draws",
    ],
    sensitive: false,
  },
  salon: {
    label: "a salon or spa",
    examples: [
      "product inventory", "supplies", "booth rent or rent",
      "payroll", "booking software", "merchant fees",
      "utilities", "insurance", "owner draws",
    ],
    sensitive: false,
  },
  medical: {
    label: "a medical office or clinic",
    examples: [
      "medical supplies", "software", "payroll", "insurance",
      "rent", "utilities", "merchant fees", "equipment payments",
      "professional services", "owner draws",
    ],
    sensitive: true,
  },
  legal: {
    label: "a law office or legal practice",
    examples: [
      "office supplies", "legal research software", "payroll",
      "insurance", "rent", "utilities", "merchant fees",
      "professional services", "continuing education", "owner draws",
    ],
    sensitive: true,
  },
  gym: {
    label: "a gym or fitness studio",
    examples: [
      "equipment", "supplies", "payroll", "membership software",
      "rent", "utilities", "insurance", "merchant fees",
      "cleaning", "owner draws",
    ],
    sensitive: false,
  },
  retail: {
    label: "a retail store",
    examples: [
      "inventory purchases", "shipping", "payroll",
      "merchant fees", "rent", "utilities", "insurance",
      "software", "supplies", "owner draws",
    ],
    sensitive: false,
  },
  realestate: {
    label: "a real estate office",
    examples: [
      "office rent", "software subscriptions", "marketing",
      "payroll", "insurance", "utilities", "merchant fees",
      "professional services", "continuing education", "owner draws",
    ],
    sensitive: false,
  },
  cleaning: {
    label: "a cleaning business",
    examples: [
      "cleaning supplies", "equipment", "fuel", "payroll",
      "insurance", "vehicle maintenance", "marketing",
      "software", "utilities", "owner draws",
    ],
    sensitive: false,
  },
};

const DETECT_PATTERNS: [RegExp, string][] = [
  [/dentist|dental|orthodont/i, "dental"],
  [/restaurant|cafe|coffee\s*shop|diner|bakery|catering/i, "restaurant"],
  [/landscap|lawn\s*care|mowing/i, "landscaping"],
  [/contractor|construct|plumb|electric(?:al|ian)|hvac|roofing/i, "contractor"],
  [/\bsalon\b|\bbarber\b|\bspa\b|\bnail\b|\bbeauty\b/i, "salon"],
  [/medical\s*office|clinic|doctor|physician|urgent\s*care/i, "medical"],
  [/law\s*(?:office|firm)|legal\s*practice|attorney/i, "legal"],
  [/gym|fitness|yoga|pilates|crossfit/i, "gym"],
  [/retail|store|shop|boutique/i, "retail"],
  [/real\s*estate|realtor|property\s*management/i, "realestate"],
  [/clean(?:ing|er)|janitorial|maid/i, "cleaning"],
  [/auto\s*repair|mechanic|garage|body\s*shop/i, "auto"],
];

const DEFAULT_EXAMPLES = [
  "supplies", "payroll", "rent", "utilities", "software",
  "insurance", "merchant fees", "equipment", "owner draws",
  "accountant follow-up items",
];

const USE_CASE_PHRASES = [
  "how could", "would this work", "could this", "how would",
  "what if", "could a", "could my", "how about", "useful for",
  "help a", "help my", "apply to", "work for",
  "business like", "office like", "shop like",
];

export function isBusinessUseCaseQuery(query: string): boolean {
  const lower = query.toLowerCase();
  return USE_CASE_PHRASES.some((p) => lower.includes(p));
}

export function detectBusinessType(query: string): string | null {
  const lower = query.toLowerCase();
  for (const [pattern, key] of DETECT_PATTERNS) {
    if (pattern.test(lower)) return key;
  }
  return null;
}

export function buildBusinessUseCaseAnswer(query: string): {
  answer: string;
  followUps: string[];
} {
  const bizType = detectBusinessType(query);
  const profile = bizType ? INDUSTRIES[bizType] : null;
  const label = profile?.label ?? "a small business like that";
  const examples = profile?.examples ?? DEFAULT_EXAMPLES;
  const isSensitive = profile?.sensitive ?? false;

  const exampleList = examples.slice(0, 8).join(", ");

  let answer =
    `For ${label}, LedgerLens would work the same way it does in the ` +
    `auto repair demo: it would help clean up monthly transaction activity ` +
    `before the accountant reviews it.\n\n` +
    `Instead of auto parts, fuel, and shop supplies, the typical ` +
    `transactions might include ${exampleList}.\n\n` +
    `LedgerLens would organize obvious rows using deterministic rules ` +
    `and correction memory, flag ambiguous ones for owner review, ask ` +
    `plain-English questions about uncertain items, and produce an ` +
    `accountant handoff package with 7 separated exports.\n\n` +
    `It would not make tax or accounting decisions for the business. ` +
    `The accountant still reviews and posts entries to their system.`;

  if (isSensitive) {
    answer +=
      `\n\nImportant: do not upload patient, client, payroll, bank, ` +
      `account, or regulated data into the public demo. This is a ` +
      `conceptual workflow example, not a production system.`;
  } else {
    answer +=
      `\n\nThis is a conceptual workflow example based on the LedgerLens ` +
      `demo, not financial advice. The public demo uses synthetic data only.`;
  }

  return {
    answer,
    followUps: [
      "What would LedgerLens flag for review?",
      "What exports would the accountant get?",
      "Why is this not accounting software?",
      "Can it connect to QuickBooks?",
    ],
  };
}
