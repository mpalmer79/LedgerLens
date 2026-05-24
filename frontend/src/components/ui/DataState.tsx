/**
 * Reusable data-state components: LoadingState, EmptyState, ErrorState.
 *
 * Used by every workflow page to render loading / empty / error UI
 * consistently. Copy is plain-English. Mobile-friendly by default.
 *
 * Honesty rule: ErrorState never shows the same UI to a small-business
 * owner that it shows to a technical reviewer — backend stack traces
 * live inside a collapsed <details> panel.
 */

import { AlertTriangle, Inbox, Loader2, WifiOff } from "lucide-react";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/client";

// ── LoadingState ──────────────────────────────────────────────────────────

type LoadingStateProps = {
  /** Plain-English label. Default "Loading…". */
  label?: string;
  /** Optional compact mode for inline use (no large padding). */
  compact?: boolean;
};

export function LoadingState({ label = "Loading…", compact }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={
        compact
          ? "inline-flex items-center gap-2 text-[13px] text-text-subtle"
          : "mt-6 flex items-center gap-2 text-[14px] text-text-subtle"
      }
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────

type EmptyStateProps = {
  /** Heading text. */
  title: string;
  /** Body explaining the state in plain English. */
  message?: ReactNode;
  /** Primary action — usually a Link to the next step. */
  action?: ReactNode;
  /** Optional secondary action. */
  secondaryAction?: ReactNode;
  /** Optional icon override. Defaults to Inbox. */
  icon?: ReactNode;
};

export function EmptyState({
  title,
  message,
  action,
  secondaryAction,
  icon,
}: EmptyStateProps) {
  return (
    <section
      role="status"
      className="mt-6 rounded-lg border border-surface-border bg-surface-panel p-6 text-center"
    >
      <div className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-page text-text-subtle">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h2 className="mt-3 font-display text-[18px] font-medium text-text-primary">{title}</h2>
      {message && <p className="mt-1 text-[13px] text-text-secondary">{message}</p>}
      {(action || secondaryAction) && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </section>
  );
}

// ── ErrorState ────────────────────────────────────────────────────────────

type ErrorVariant = "default" | "warning" | "demo";

type ErrorStateProps = {
  /** Plain-English title. */
  title?: string;
  /** Plain-English body. If an ApiError is passed, defaults to its userMessage. */
  message?: ReactNode;
  /** ApiError that triggered the state. Surfaces technical details + retryable hint. */
  error?: unknown;
  /** Optional retry handler — renders a primary "Try again" button. */
  onRetry?: () => void;
  /** Optional secondary action node — usually a Link. */
  secondaryAction?: ReactNode;
  /** Visual variant. `demo` is a softer panel used on /demo. */
  variant?: ErrorVariant;
};

const VARIANT_CLASSES: Record<ErrorVariant, string> = {
  default: "border-red-200 bg-red-50 text-red-900",
  warning: "border-amber-300 bg-amber-50 text-amber-900",
  demo: "border-surface-border bg-surface-panel text-text-primary",
};

function defaultTitleFor(error: unknown, variant: ErrorVariant): string {
  if (error instanceof ApiError) {
    if (error.code === "network_error" || error.code === "timeout") {
      return "Demo backend unavailable";
    }
    if (error.status === 503) return "Demo backend unavailable";
    if (error.status === 404) return "Not found";
  }
  return variant === "warning" ? "Heads up" : "Something went wrong";
}

function defaultMessageFor(error: unknown): string {
  if (error instanceof ApiError) return error.userMessage;
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "An unexpected error occurred.";
}

function technicalDetailsFor(error: unknown): string | null {
  if (error instanceof ApiError) {
    const parts: string[] = [];
    if (error.status) parts.push(`HTTP ${error.status}`);
    if (error.code) parts.push(error.code);
    parts.push(error.message);
    return parts.join(" · ");
  }
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === "string") return error;
  return null;
}

export function ErrorState({
  title,
  message,
  error,
  onRetry,
  secondaryAction,
  variant = "default",
}: ErrorStateProps) {
  const resolvedTitle = title ?? defaultTitleFor(error, variant);
  const resolvedMessage = message ?? defaultMessageFor(error);
  const tech = technicalDetailsFor(error);
  const isNetwork =
    error instanceof ApiError && (error.code === "network_error" || error.code === "timeout");

  return (
    <section
      role="alert"
      className={`mt-6 rounded-md border p-4 ${VARIANT_CLASSES[variant]}`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          {isNetwork ? (
            <WifiOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">{resolvedTitle}</p>
          {resolvedMessage && (
            <p className="mt-1 text-[13px] opacity-90">{resolvedMessage}</p>
          )}
          {(onRetry || secondaryAction) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center rounded-md bg-brand-600 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-brand-500"
                >
                  Try again
                </button>
              )}
              {secondaryAction}
            </div>
          )}
          {tech && (
            <details className="mt-3 text-[11px] opacity-80">
              <summary className="cursor-pointer select-none">Technical details</summary>
              <p className="mt-1 font-mono">{tech}</p>
            </details>
          )}
        </div>
      </div>
    </section>
  );
}
