import type { SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement> & {
  size?: number;
};

/**
 * LedgerLens logomark.
 *
 * Source: /design/assets/logomark.svg. This component inlines the SVG so it
 * can inherit `currentColor` from a parent (typically `text-brand-600`) and
 * be animated from JSX.
 */
export function Logomark({ size = 24, className, ...rest }: Props) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <line x1="4" y1="10" x2="20" y2="10" />
      <line x1="4" y1="22" x2="20" y2="22" />
      <circle cx="25" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="25" cy="22" r="1.6" fill="currentColor" stroke="none" />
      <path d="M25 11.6 L25 20.4" strokeWidth={1.5} opacity={0.55} />
    </svg>
  );
}
