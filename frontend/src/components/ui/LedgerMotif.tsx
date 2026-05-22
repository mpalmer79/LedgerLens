import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

const ROW_1_DOTS = [32, 84, 121, 178, 225, 259];
const ROW_2_DOTS = [20, 67, 112, 155, 208, 248, 271];
const ROW_3_DOTS = [44, 92, 138, 191, 236];

/**
 * Horizontal ledger motif — three thin parallel lines with transaction dots.
 *
 * Source: /design/assets/ledger-motif.svg. Static render for now; animation
 * (line draw-in left-to-right, dot fade-in stagger) arrives in Session 9 when
 * the landing page is rebuilt.
 */
export function LedgerMotif({ className, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 80"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      strokeLinecap="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <g opacity={0.4}>
        <line x1="0" y1="16" x2="280" y2="16" />
        {ROW_1_DOTS.map((cx) => (
          <circle key={`r1-${cx}`} cx={cx} cy="16" r="2" fill="currentColor" stroke="none" />
        ))}
        <line x1="0" y1="40" x2="280" y2="40" />
        {ROW_2_DOTS.map((cx) => (
          <circle key={`r2-${cx}`} cx={cx} cy="40" r="2" fill="currentColor" stroke="none" />
        ))}
        <line x1="0" y1="64" x2="280" y2="64" />
        {ROW_3_DOTS.map((cx) => (
          <circle key={`r3-${cx}`} cx={cx} cy="64" r="2" fill="currentColor" stroke="none" />
        ))}
      </g>
    </svg>
  );
}
