/**
 * Contracts for the shared LoadingState / EmptyState / ErrorState
 * components. These are the building blocks the workflow pages use
 * for every loading / empty / error surface — the assertions below
 * lock in the user-facing copy and accessibility shape.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { ApiError } from "@/lib/api/client";

import { EmptyState, ErrorState, LoadingState } from "./DataState";

describe("LoadingState", () => {
  it("renders the default label with an accessible role", () => {
    const html = renderToStaticMarkup(<LoadingState />);
    expect(html).toContain("Loading…");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
  });

  it("honors a custom label", () => {
    const html = renderToStaticMarkup(<LoadingState label="Loading the sample scenario…" />);
    expect(html).toContain("Loading the sample scenario…");
  });
});

describe("EmptyState", () => {
  it("renders title + message + actions", () => {
    const html = renderToStaticMarkup(
      <EmptyState
        title="No questions right now"
        message="Everything is auto-categorized or already reviewed."
        action={<a href="/handoff">View handoff</a>}
        secondaryAction={<a href="/cleanup">Open cleanup</a>}
      />,
    );
    expect(html).toContain("No questions right now");
    expect(html).toContain("auto-categorized or already reviewed");
    expect(html).toContain('href="/handoff"');
    expect(html).toContain('href="/cleanup"');
  });
});

describe("ErrorState", () => {
  it("renders a generic title + message when no error is provided", () => {
    const html = renderToStaticMarkup(
      <ErrorState message="The backend responded, but this data could not be loaded." />,
    );
    expect(html).toContain("Something went wrong");
    expect(html).toContain("could not be loaded");
    expect(html).toContain('role="alert"');
  });

  it("uses ApiError.userMessage when an ApiError is passed", () => {
    const err = new ApiError("boom", 0, "network_error");
    const html = renderToStaticMarkup(<ErrorState error={err} />);
    // Title swaps to the network-aware copy.
    expect(html).toContain("Demo backend unavailable");
    // userMessage is the plain-English copy on the ApiError.
    expect(html).toContain("could not reach the demo backend");
    // Technical details panel includes the underlying error code.
    expect(html).toContain("network_error");
  });

  it("renders a Retry button when onRetry is provided", () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(<ErrorState error="boom" onRetry={onRetry} />);
    expect(html).toContain("Try again");
  });

  it("does not render a Retry button when onRetry is omitted", () => {
    const html = renderToStaticMarkup(<ErrorState error="boom" />);
    expect(html).not.toContain("Try again");
  });

  it("renders a secondary action when provided", () => {
    const html = renderToStaticMarkup(
      <ErrorState
        error={new ApiError("boom", 503)}
        secondaryAction={<a href="/technical-story">Read the technical story</a>}
      />,
    );
    expect(html).toContain('href="/technical-story"');
  });

  it("surfaces ApiError details in the technical-details panel", () => {
    const err = new ApiError("nope", 503, "service_unavailable");
    const html = renderToStaticMarkup(<ErrorState error={err} />);
    expect(html).toContain("Technical details");
    expect(html).toContain("HTTP 503");
    expect(html).toContain("service_unavailable");
  });
});
