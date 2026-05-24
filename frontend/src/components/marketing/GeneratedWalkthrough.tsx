/**
 * GeneratedWalkthrough — a six-scene, ~30-second animated story of the
 * LedgerLens monthly cleanup → accountant handoff workflow, driven by
 * CSS keyframes (see the sibling .module.css).
 *
 * Honesty: this is *not* a screen recording. It's a generated animation
 * intended to replace the static "coming soon" tile until Michael records
 * the real Loom. The host component (`VideoDemo`) marks the surface with
 * a "Generated walkthrough" badge so no one mistakes it for a live capture.
 *
 * The narration matches `docs/LOOM_WALKTHROUGH_SCRIPT.md` so the two
 * assets are interchangeable. Final card still uses the workflow-level
 * trust phrasing — never a raw-model-accuracy claim.
 */

import styles from "./GeneratedWalkthrough.module.css";

const MESSY_TRANSACTIONS: { description: string; amount: string }[] = [
  { description: "NAPA AUTO PARTS INV 88421", amount: "-$342.50" },
  { description: "ADP PAYROLL BI-WEEKLY", amount: "-$7,842.30" },
  { description: "COMCAST BUSINESS INTERNET MAR", amount: "-$299.00" },
  { description: "SHELL FUEL 03801 NASHUA", amount: "-$87.21" },
  { description: "AMAZON MARKETPLACE ORDER 113-44", amount: "-$214.47" },
  { description: "ACH TRANSFER VENDOR REF 41281", amount: "-$675.00" },
];

const OBVIOUS_VENDORS: { description: string; via: string; category: string }[] = [
  { description: "QUICKBOOKS ONLINE PLUS", via: "Rule", category: "Software" },
  { description: "ADP PAYROLL BI-WEEKLY", via: "Memory", category: "Payroll" },
  { description: "SHELL FUEL 03801 NASHUA", via: "Rule", category: "Fuel & Vehicle" },
  { description: "NAPA AUTO PARTS INV 88421", via: "Memory", category: "Cost of goods sold" },
];

const QUESTION_CHOICES: string[] = [
  "Vendor payment",
  "Owner draw",
  "Office supplies",
  "Needs accountant review",
  "Not sure",
];

const ANSWER_NOTES: { description: string; answer: string }[] = [
  {
    description: "ACH TRANSFER VENDOR REF 41281",
    answer: "Needs accountant review",
  },
  {
    description: "AMAZON MARKETPLACE",
    answer: "Office supplies",
  },
];

const READY_ROWS: { description: string; category: string }[] = [
  { description: "NAPA AUTO PARTS", category: "Cost of goods sold" },
  { description: "ADP PAYROLL BI-WEEKLY", category: "Payroll" },
  { description: "SHELL FUEL 03801", category: "Fuel & Vehicle" },
  { description: "AMAZON MARKETPLACE", category: "Office supplies" },
];

const NEEDS_REVIEW_ROWS: { description: string; note: string }[] = [
  { description: "ACH TRANSFER VENDOR REF 41281", note: "Needs accountant review" },
];

export function GeneratedWalkthrough() {
  return (
    <div
      className={styles.root}
      aria-label="LedgerLens 30-second monthly-cleanup-to-handoff walkthrough"
    >
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.brand}>
        <span className={styles.brandDot} aria-hidden="true">
          L
        </span>
        <span className={styles.brandText}>LedgerLens</span>
      </div>
      <span className={styles.stepBadge}>30-second walkthrough</span>

      <div className={styles.stage}>
        {/* Scene 1 — monthly bookkeeping cleanup intro */}
        <div className={`${styles.scene} ${styles.scene1}`}>
          <p className={styles.stepLabel}>Step 1 of 6</p>
          <p className={styles.sceneTitle}>Monthly bookkeeping cleanup</p>
          <p className={styles.sceneSub}>
            Start with messy bank activity from this month.
          </p>
          <ul className={styles.txList} aria-hidden="true">
            {MESSY_TRANSACTIONS.map((tx) => (
              <li key={tx.description} className={styles.tx}>
                <span>{tx.description}</span>
                <span className={styles.txAmount}>{tx.amount}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scene 2 — obvious vendors handled first */}
        <div className={`${styles.scene} ${styles.scene2}`}>
          <p className={styles.stepLabel}>Step 2 of 6</p>
          <p className={styles.sceneTitle}>Obvious vendors handled first</p>
          <p className={styles.sceneSub}>
            Rules and correction memory classify repeatable items before AI fallback.
          </p>
          <ul className={styles.obviousList} aria-hidden="true">
            {OBVIOUS_VENDORS.map((row) => (
              <li key={row.description} className={styles.obviousRow}>
                <span className={styles.obviousDesc}>{row.description}</span>
                <span className={styles.obviousVia}>{row.via}</span>
                <span className={styles.obviousCat}>{row.category}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scene 3 — uncertain rows become owner questions */}
        <div className={`${styles.scene} ${styles.scene3}`}>
          <p className={styles.stepLabel}>Step 3 of 6</p>
          <p className={styles.sceneTitle}>Uncertain rows become owner questions</p>
          <p className={styles.sceneSub}>
            AI should not guess what the owner knows.
          </p>
          <div className={styles.questionCard} aria-hidden="true">
            <p className={styles.qContext}>
              ACH TRANSFER VENDOR REF 41281 · −$675.00
            </p>
            <p className={styles.qPrompt}>What was this ACH transfer for?</p>
            <ul className={styles.qChoices}>
              {QUESTION_CHOICES.map((choice) => (
                <li key={choice} className={styles.qChoice}>
                  {choice}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Scene 4 — answers create accountant context */}
        <div className={`${styles.scene} ${styles.scene4}`}>
          <p className={styles.stepLabel}>Step 4 of 6</p>
          <p className={styles.sceneTitle}>Answers create accountant context</p>
          <p className={styles.sceneSub}>
            Plain-English answers are saved as review notes for the handoff.
          </p>
          <ul className={styles.answerList} aria-hidden="true">
            {ANSWER_NOTES.map((row) => (
              <li key={row.description} className={styles.answerRow}>
                <span className={styles.answerDesc}>{row.description}</span>
                <span className={styles.answerArrow}>→</span>
                <span className={styles.answerNote}>{row.answer}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scene 5 — verified rows stay separated from unresolved items */}
        <div className={`${styles.scene} ${styles.scene5}`}>
          <p className={styles.stepLabel}>Step 5 of 6</p>
          <p className={styles.sceneTitle}>
            Verified rows stay separated from unresolved items
          </p>
          <p className={styles.sceneSub}>
            Finalized rows are backed by review, rules, or correction memory.
          </p>
          <div className={styles.splitGrid} aria-hidden="true">
            <div className={styles.splitColumn}>
              <p className={styles.splitHeading}>Ready for accountant</p>
              <ul className={styles.splitList}>
                {READY_ROWS.map((row) => (
                  <li key={row.description} className={styles.splitRow}>
                    <span className={styles.splitDesc}>{row.description}</span>
                    <span className={styles.splitCategory}>{row.category}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`${styles.splitColumn} ${styles.splitColumnReview}`}>
              <p className={styles.splitHeading}>Needs review</p>
              <ul className={styles.splitList}>
                {NEEDS_REVIEW_ROWS.map((row) => (
                  <li key={row.description} className={styles.splitRow}>
                    <span className={styles.splitDesc}>{row.description}</span>
                    <span className={styles.splitNote}>{row.note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className={styles.splitFooter}>
            Workflow-level verification, not raw model accuracy.
          </p>
        </div>

        {/* Scene 6 — export the accountant handoff package */}
        <div className={`${styles.scene} ${styles.scene6}`}>
          <p className={styles.stepLabel}>Step 6 of 6</p>
          <p className={styles.sceneTitle}>Export the accountant handoff package</p>
          <p className={styles.sceneSub}>
            Verified ledger, owner answers, unresolved items, and learned corrections in
            one package.
          </p>
          <div className={styles.handoffPreview} aria-hidden="true">
            <p className={styles.handoffFile}>handoff-granite-state-auto-repair-2026-03.md</p>
            <ul className={styles.handoffSections}>
              <li>Ready for accountant · 4 rows</li>
              <li>Needs review · 1 row + owner note</li>
              <li>Owner answers this month</li>
              <li>Corrections learned</li>
            </ul>
          </div>
          <div className={styles.trustCard}>
            <p className={styles.trustLabel}>Trust boundary</p>
            <p className={styles.trustNumber}>100%</p>
            <p className={styles.trustHeadline}>procedurally verified demo rows</p>
            <p className={styles.trustNote}>
              0 uncertain rows silently finalized · workflow-level trust metric, not raw
              model accuracy
            </p>
          </div>
        </div>
      </div>

      <div className={styles.progressTrack} aria-hidden="true">
        <div className={styles.progressFill} />
      </div>
    </div>
  );
}
