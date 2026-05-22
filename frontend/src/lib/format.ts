export function formatAmount(cents: number, currency = "USD"): string {
  const v = cents / 100;
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const symbol = currency === "USD" ? "$" : `${currency} `;
  return `${sign}${symbol}${abs}`;
}

export function formatConfidence(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  // Tolerate both YYYY-MM-DD and ISO datetimes.
  return value.slice(0, 10);
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    const d = new Date(value);
    return d.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return value;
  }
}

export function statusLabel(status: string): string {
  return status
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}
