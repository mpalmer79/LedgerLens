"""Shared sample-business-scenario profile.

LedgerLens ships one fictional sample business so the demo / cleanup /
handoff surfaces tell a coherent story instead of looking like a unit
test fixture. Everything that needs to display "the demo business name"
imports from this module so the identity is defined exactly once.

The business is fictional. It is not a real customer, not a real CDK
Global customer, not Michael Palmer's family business, not anyone else's
business. Use it only for demonstration of the LedgerLens cleanup
workflow.
"""

from __future__ import annotations

from typing import TypedDict


class SampleScenario(TypedDict):
    """Read-only sample-business-scenario record exposed by /demo/scenario."""

    business_name: str
    business_type: str
    location: str
    cleanup_month: str  # e.g. "March 2026"
    cleanup_period_start: str  # ISO date
    cleanup_period_end: str  # ISO date
    scenario_summary: str
    accountant_handoff_goal: str
    demo_disclaimer: str
    handoff_filename: str  # name used when /handoff renders the markdown export


SAMPLE_SCENARIO: SampleScenario = {
    "business_name": "Granite State Auto Repair",
    "business_type": "Independent auto repair shop",
    "location": "New Hampshire",
    "cleanup_month": "March 2026",
    "cleanup_period_start": "2026-03-01",
    "cleanup_period_end": "2026-03-31",
    "scenario_summary": (
        "Granite State Auto Repair is a fictional independent repair shop "
        "used to demonstrate how LedgerLens cleans up messy monthly bank "
        "activity before accountant handoff."
    ),
    "accountant_handoff_goal": (
        "Send a verified handoff package (markdown summary + CSV ledger) to "
        "the accountant covering March 2026 — verified rows, owner answers, "
        "unresolved items, and corrections learned."
    ),
    "demo_disclaimer": (
        "Fictional sample scenario. Not a real business, not tax advice, "
        "and not a substitute for accounting review."
    ),
    "handoff_filename": "handoff-granite-state-auto-repair-2026-03.md",
}
