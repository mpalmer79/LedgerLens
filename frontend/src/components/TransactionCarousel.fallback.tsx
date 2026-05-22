import type { SVGProps } from "react";

import { LedgerMotif } from "@/components/ui/LedgerMotif";

type Props = Pick<SVGProps<SVGSVGElement>, "className">;

/**
 * Static fallback rendered when prefers-reduced-motion is set or on mobile
 * widths (<=768px). Re-uses the original LedgerMotif so the hero still has
 * visual interest without the WebGL cost.
 */
export function TransactionCarouselFallback({ className }: Props) {
  return <LedgerMotif className={className} />;
}
