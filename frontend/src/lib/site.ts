/**
 * Site-wide identity constants. Centralised so a single URL change does not
 * require touching every page.
 *
 * `LOOM_URL` is optional. The frontend renders a premium placeholder when it
 * is empty, so the build never fails for a missing demo recording. To wire
 * the real video in, set `NEXT_PUBLIC_LOOM_URL` at build time or update the
 * constant below.
 */

export const REPO_URL = "https://github.com/mpalmer79/LedgerLens";
export const GITHUB_PROFILE_URL = "https://github.com/mpalmer79";

// TODO(michael): update if you change your LinkedIn slug.
export const LINKEDIN_URL = "https://linkedin.com/in/michael-palmer";

export const ARCHITECTURE_URL = `${REPO_URL}/blob/main/docs/ARCHITECTURE.md`;
export const TRUST_METRIC_DOC_URL = `${REPO_URL}/blob/main/docs/TRUST_METRIC.md`;
export const LOOM_SCRIPT_DOC_URL = `${REPO_URL}/blob/main/docs/LOOM_WALKTHROUGH_SCRIPT.md`;

/**
 * Empty string by default. Set NEXT_PUBLIC_LOOM_URL at build time to embed
 * the live 30-second walkthrough; otherwise the VideoDemo component falls
 * back to a styled placeholder.
 */
export const LOOM_URL: string = process.env.NEXT_PUBLIC_LOOM_URL?.trim() ?? "";

export const SITE_TITLE = "LedgerLens | Workflow-Verified AI-Assisted Bookkeeping Cleanup";
export const SITE_DESCRIPTION =
  "Turn messy small-business bank transactions into a workflow-verified accountant handoff with deterministic rules, correction memory, review routing, and audit trails. Not production accounting software.";
export const SITE_TAGLINE = "Workflow-verified AI-assisted bookkeeping cleanup";
