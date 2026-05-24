/**
 * Column header detection for common bank-CSV shapes.
 *
 * The wizard always lets the user override the auto-detected mapping; this
 * module is suggestion-only. Detection is case-insensitive and matches by
 * whole-token equality after stripping non-alphanumerics — so "Posted Date",
 * "posted_date", "POSTED-DATE", and "POSTEDDATE" all hit the same candidate.
 *
 * Order of patterns inside each list = priority. The first matching header
 * wins.
 */

const DATE_PATTERNS = [
  "date",
  "transactiondate",
  "transdate",
  "posteddate",
  "postingdate",
  "postdate",
  "effectivedate",
];

const DESCRIPTION_PATTERNS = [
  "description",
  "details",
  "transaction",
  "transactiondetails",
  "memo",
  "name",
  "payee",
  "narrative",
];

const AMOUNT_PATTERNS = [
  "amount",
  "transactionamount",
  "value",
  "signedamount",
  "netamount",
];

const DEBIT_PATTERNS = ["debit", "debits", "withdrawal", "withdrawals", "moneyout", "charge", "charges"];

const CREDIT_PATTERNS = ["credit", "credits", "deposit", "deposits", "moneyin", "payment", "payments"];

const MERCHANT_PATTERNS = ["merchant", "payee", "vendor", "name", "counterparty"];

const ACCOUNT_PATTERNS = ["account", "accountname", "bankaccount", "accountnumber"];

const MEMO_PATTERNS = ["memo", "notes", "note", "narrative", "remark", "remarks"];

const REFERENCE_PATTERNS = ["reference", "ref", "checknumber", "checknum", "trnid", "trxid", "transactionid", "txnid"];

function normalizeKey(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findFirstMatch(headers: string[], patterns: string[]): string | null {
  const map = new Map<string, string>();
  for (const h of headers) map.set(normalizeKey(h), h);
  for (const p of patterns) {
    if (map.has(p)) return map.get(p)!;
  }
  return null;
}

function findAllMatches(headers: string[], patterns: string[]): string[] {
  const normalized = headers.map((h) => [normalizeKey(h), h] as const);
  const out: string[] = [];
  for (const p of patterns) {
    for (const [n, raw] of normalized) {
      if (n === p && !out.includes(raw)) out.push(raw);
    }
  }
  return out;
}

export function detectDate(headers: string[]): string | null {
  return findFirstMatch(headers, DATE_PATTERNS);
}

export function detectDescription(headers: string[]): string | null {
  return findFirstMatch(headers, DESCRIPTION_PATTERNS);
}

export function detectAmount(headers: string[]): string | null {
  // Don't claim "amount" if a "debit" + "credit" pair exists — that's
  // the debit/credit mode, the user should pick which mode to use.
  const debitFound = findFirstMatch(headers, DEBIT_PATTERNS);
  const creditFound = findFirstMatch(headers, CREDIT_PATTERNS);
  const explicitAmount = findFirstMatch(headers, AMOUNT_PATTERNS);
  if (debitFound && creditFound && !explicitAmount) return null;
  return explicitAmount;
}

export function detectDebit(headers: string[]): string | null {
  return findFirstMatch(headers, DEBIT_PATTERNS);
}

export function detectCredit(headers: string[]): string | null {
  return findFirstMatch(headers, CREDIT_PATTERNS);
}

export function detectMerchant(headers: string[]): string | null {
  // Don't shadow description if "payee" / "name" already mapped there;
  // prefer "merchant" / "vendor" / "counterparty" as the merchant column.
  const merchantOnly = ["merchant", "vendor", "counterparty"];
  return findFirstMatch(headers, merchantOnly);
}

export function detectAccount(headers: string[]): string | null {
  return findFirstMatch(headers, ACCOUNT_PATTERNS);
}

export function detectMemo(headers: string[]): string | null {
  return findFirstMatch(headers, MEMO_PATTERNS);
}

export function detectReference(headers: string[]): string | null {
  return findFirstMatch(headers, REFERENCE_PATTERNS);
}

/** Default amount mode based on headers — if both debit+credit columns
 *  exist and no single signed-amount column, return "debit_credit"; else
 *  "signed". The wizard always lets the user override. */
export function suggestAmountMode(headers: string[]): "signed" | "debit_credit" {
  const debit = detectDebit(headers);
  const credit = detectCredit(headers);
  const amount = findFirstMatch(headers, AMOUNT_PATTERNS);
  if (debit && credit && !amount) return "debit_credit";
  return "signed";
}

export { findAllMatches };
