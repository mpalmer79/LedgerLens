from ledgerlens.categorizers.prompts import (
    build_system_prompt,
    build_user_prompt,
    format_amount,
)
from ledgerlens.evals.schemas import Account, Business, Transaction


def _coffee_business() -> Business:
    return Business(
        id="coffee-shop",
        name="Lighthouse Roasters",
        industry="Specialty coffee retail",
        description="Single-location coffee shop on the NH seacoast.",
        fiscal_year_start="01-01",
    )


def _coffee_accounts() -> list[Account]:
    return [
        Account(
            code="5010",
            name="COGS - Green Coffee",
            description="Unroasted green coffee inventory expensed at roast time.",
            type="cogs",
        ),
        Account(
            code="6010",
            name="Rent - Storefront",
            description="Monthly rent on the storefront and roasting space.",
            type="expense",
        ),
        Account(
            code="6170",
            name="Software Subscriptions",
            description="Recurring software: Square, QuickBooks Online, Mailchimp.",
            type="expense",
        ),
    ]


def _coffee_tx() -> Transaction:
    return Transaction(
        id="coffee-shop-tx-001",
        date="2025-07-08",
        amount_cents=-45200,
        raw_description="ROYAL COFFEE NY INV 89221",
        proposed_category_code="5010",
        label_confidence="high",
        is_adversarial=False,
        reasoning="t",
    )


def test_system_prompt_mentions_bookkeeping() -> None:
    assert "bookkeeping" in build_system_prompt().lower()


def test_user_prompt_contains_transaction_description() -> None:
    p = build_user_prompt(_coffee_tx(), _coffee_business(), _coffee_accounts())
    assert "ROYAL COFFEE NY INV 89221" in p


def test_user_prompt_contains_all_chart_codes() -> None:
    accounts = _coffee_accounts()
    p = build_user_prompt(_coffee_tx(), _coffee_business(), accounts)
    for a in accounts:
        assert f"[{a.code}]" in p


def test_user_prompt_contains_account_descriptions() -> None:
    accounts = _coffee_accounts()
    p = build_user_prompt(_coffee_tx(), _coffee_business(), accounts)
    for a in accounts:
        assert a.description in p


def test_user_prompt_contains_business_context() -> None:
    biz = _coffee_business()
    p = build_user_prompt(_coffee_tx(), biz, _coffee_accounts())
    assert biz.name in p
    assert biz.industry in p


def test_user_prompt_amount_formatted_as_dollars_signed() -> None:
    p = build_user_prompt(_coffee_tx(), _coffee_business(), _coffee_accounts())
    assert "-$452.00" in p


def test_format_amount_positive_and_negative() -> None:
    assert format_amount(-45200) == "-$452.00"
    assert format_amount(45200) == "$452.00"
    assert format_amount(0) == "$0.00"


def test_user_prompt_does_not_contain_other_business_data() -> None:
    p = build_user_prompt(_coffee_tx(), _coffee_business(), _coffee_accounts())
    # Defense against cross-business contamination — names of the other two v0
    # businesses must not appear in a coffee-shop prompt.
    assert "Northwind Design" not in p
    assert "Granite State Auto" not in p
