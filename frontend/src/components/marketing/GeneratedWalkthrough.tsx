/**
 * GeneratedWalkthrough — a six-scene, ~30-second animated story of the
 * LedgerLens workflow, driven by CSS keyframes (see the sibling .module.css).
 *
 * Honesty: this is *not* a screen recording. It's a generated animation
 * intended to replace the static "coming soon" tile until Michael records
 * the real Loom. The host component (`VideoDemo`) marks the surface with
 * a "Generated walkthrough" badge so no one mistakes it for a live capture.
 *
 * The wording is deliberately the same as the Loom script
 * (docs/LOOM_WALKTHROUGH_SCRIPT.md) so the two assets are interchangeable.
 */

import styles from "./GeneratedWalkthrough.module.css";

const MESSY_TRANSACTIONS: { description: string; amount: string }[] = [
  { description: "COMCAST BUSINESS INTERNET MAR", amount: "-$189.00" },
  { description: "QUICKBOOKS ONLINE PLUS", amount: "-$80.00" },
  { description: "ADP PAYROLL BI-WEEKLY", amount: "-$7,423.80" },
  { description: "SHELL FUEL 03801", amount: "-$78.21" },
  { description: "ACH TRANSFER VENDOR REF 99812", amount: "-$421.00" },
];

export function GeneratedWalkthrough() {
  return (
    <div className={styles.root} aria-label="LedgerLens 30-second product walkthrough">
      <div className={styles.grid} aria-hidden="true" />

      <div className={styles.brand}>
        <span className={styles.brandDot} aria-hidden="true">
          L
        </span>
        <span className={styles.brandText}>LedgerLens</span>
      </div>
      <span className={styles.stepBadge}>30-second walkthrough</span>

      <div className={styles.stage}>
        {/* Scene 1 — intro */}
        <div className={`${styles.scene} ${styles.scene1}`}>
          <p className={styles.sceneTitle}>LedgerLens</p>
          <p className={styles.sceneSub}>
            AI-assisted bookkeeping workflow for small businesses.
          </p>
        </div>

        {/* Scene 2 — the mess */}
        <div className={`${styles.scene} ${styles.scene2}`}>
          <p className={styles.sceneTitle}>Messy bank activity</p>
          <p className={styles.sceneSub}>
            Payroll, subscriptions, fuel, vendors, and vague ACH transfers.
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

        {/* Scene 3 — layered decisioning */}
        <div className={`${styles.scene} ${styles.scene3}`}>
          <p className={styles.sceneTitle}>Layered decisioning</p>
          <p className={styles.sceneSub}>
            Correction memory and deterministic rules run before any model fallback.
          </p>
          <div className={styles.pipeline} aria-hidden="true">
            <div className={styles.pipeNode}>
              <b>Memory</b>
              <span>prior correction</span>
            </div>
            <span className={styles.pipeArrow}>→</span>
            <div className={styles.pipeNode}>
              <b>Rules</b>
              <span>matched rule</span>
            </div>
            <span className={styles.pipeArrow}>→</span>
            <div className={styles.pipeNode}>
              <b>Review</b>
              <span>needs review</span>
            </div>
          </div>
        </div>

        {/* Scene 4 — review is the safety layer */}
        <div className={`${styles.scene} ${styles.scene4}`}>
          <p className={styles.sceneTitle}>Review is the safety layer</p>
          <p className={styles.sceneSub}>
            Uncertain rows are routed to a human instead of being silently finalized.
          </p>
          <div className={styles.reviewCard} aria-hidden="true">
            <p className={styles.reviewLine}>2026-03-20</p>
            <p className={styles.reviewLineMain}>ACH TRANSFER VENDOR REF 99812</p>
            <p className={styles.reviewLine}>amount −$421.00 · merchant unknown</p>
            <span className={styles.pill}>Needs Review</span>
          </div>
        </div>

        {/* Scene 5 — corrections become memory */}
        <div className={`${styles.scene} ${styles.scene5}`}>
          <p className={styles.sceneTitle}>Corrections become memory</p>
          <p className={styles.sceneSub}>
            Human decisions can be reused for similar future transactions.
          </p>
          <div className={styles.memoryCard} aria-hidden="true">
            <p className={styles.memLabel}>New memory rule</p>
            <p className={styles.memMapping}>
              UNKNOWN VENDOR <span className={styles.memArrow}>→</span> [6140] Repairs &amp;
              Maintenance
            </p>
            <p className={styles.memNote}>
              Future matching transactions categorize from this rule at zero model cost.
            </p>
          </div>
        </div>

        {/* Scene 6 — verified ledger export */}
        <div className={`${styles.scene} ${styles.scene6}`}>
          <p className={styles.sceneTitle}>Verified ledger export</p>
          <p className={styles.sceneSub}>
            Finalized rows are backed by review, rules, or correction memory.
          </p>
          <div className={styles.trustCard}>
            <p className={styles.trustLabel}>Trust boundary</p>
            <p className={styles.trustNumber}>100%</p>
            <p className={styles.trustHeadline}>verified finalized demo ledger</p>
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
