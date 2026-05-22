import type { SVGProps } from 'react';

type Props = Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> & {
  size?: number;
};

/**
 * LedgerLens logomark.
 *
 * Source: /design/assets/logomark.svg. The L-frame uses `currentColor` so the
 * mark inherits text color from its parent (typically `text-brand-600`). The
 * three dots use the brand-300/500/600 ramp as a "confidence climb" —
 * increasing certainty as the model commits — reinforced by their growing
 * radius (1.0 → 1.4 → 1.8).
 */
export function Logomark({ size = 24, className, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      width={size}
      height={size}
      className={className}
      aria-label="LedgerLens"
      role="img"
      {...rest}
    >
      {/* L-frame: reads as letter L and ledger book corner */}
      <path
        d="M 6 5 L 6 27 L 26 27"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Ledger row 1: small dot, lightest */}
      <line x1="11" y1="11" x2="20" y2="11" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
      <circle cx="22.5" cy="11" r="1.0" fill="var(--brand-300)" />

      {/* Ledger row 2: medium dot */}
      <line x1="11" y1="16" x2="18" y2="16" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
      <circle cx="20.5" cy="16" r="1.4" fill="var(--brand-500)" />

      {/* Ledger row 3: large dot, darkest */}
      <line x1="11" y1="21" x2="16" y2="21" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" />
      <circle cx="18.5" cy="21" r="1.8" fill="var(--brand-600)" />
    </svg>
  );
}
