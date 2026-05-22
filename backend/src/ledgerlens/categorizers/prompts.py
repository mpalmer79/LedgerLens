from ledgerlens.evals.schemas import Account, Business, Transaction

SYSTEM_PROMPT = (
    "You are a bookkeeping categorization assistant. Given a single bank "
    "transaction and a business's chart of accounts, identify the single "
    "best account to categorize the transaction under. Reason from the "
    "transaction description, the amount, and the account descriptions. "
    "Score your confidence honestly: high when the transaction clearly "
    "matches one account, lower when the description is opaque or the "
    "decision rests on assumptions you cannot verify."
)


def format_amount(amount_cents: int) -> str:
    """Render integer cents as a signed dollar string, e.g. -45200 -> '-$452.00'."""
    dollars = amount_cents / 100.0
    if dollars < 0:
        return f"-${-dollars:.2f}"
    return f"${dollars:.2f}"


def _format_chart(chart_of_accounts: list[Account]) -> str:
    lines = []
    for a in chart_of_accounts:
        lines.append(f"[{a.code}] {a.name} ({a.type})")
        lines.append(f"    {a.description}")
        lines.append("")
    return "\n".join(lines).rstrip()


def build_system_prompt() -> str:
    return SYSTEM_PROMPT


def build_user_prompt(
    transaction: Transaction,
    business: Business,
    chart_of_accounts: list[Account],
) -> str:
    return (
        f"BUSINESS CONTEXT\n"
        f"Name: {business.name}\n"
        f"Industry: {business.industry}\n"
        f"Description: {business.description}\n"
        f"\n"
        f"CHART OF ACCOUNTS\n"
        f"{_format_chart(chart_of_accounts)}\n"
        f"\n"
        f"TRANSACTION TO CATEGORIZE\n"
        f"Date: {transaction.date}\n"
        f"Amount: {format_amount(transaction.amount_cents)}\n"
        f"Description: {transaction.raw_description}\n"
        f"\n"
        f"Choose the single best category code from the chart above. Provide a "
        f"brief reasoning (1-2 sentences) referencing the transaction and the "
        f"account description you matched. Optionally name an alternative "
        f"category code if a second choice is plausible. Confidence is a value "
        f"in [0, 1] reflecting how likely your chosen category is correct."
    )
