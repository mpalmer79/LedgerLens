from typing import Literal

from pydantic import BaseModel, Field, model_validator

AccountType = Literal[
    "asset",
    "liability",
    "equity",
    "revenue",
    "cogs",
    "expense",
    "other_income",
    "other_expense",
]

LabelConfidence = Literal["high", "medium", "low"]


class Account(BaseModel):
    code: str
    name: str
    description: str
    parent_code: str | None = None
    type: AccountType


class Business(BaseModel):
    id: str
    name: str
    industry: str
    description: str
    fiscal_year_start: str
    typical_monthly_revenue_usd: int | None = None
    notes: str | None = None


class Transaction(BaseModel):
    id: str
    date: str
    amount_cents: int
    raw_description: str
    proposed_category_code: str
    label_confidence: LabelConfidence
    is_adversarial: bool
    reasoning: str
    labeler_notes: str | None = None


class BusinessData(BaseModel):
    business: Business
    chart_of_accounts: list[Account]
    transactions: list[Transaction]

    @model_validator(mode="after")
    def _validate_referential_integrity(self) -> "BusinessData":
        coa_codes = {a.code for a in self.chart_of_accounts}
        bad = [t.id for t in self.transactions if t.proposed_category_code not in coa_codes]
        if bad:
            preview = ", ".join(bad[:5])
            raise ValueError(
                f"Business {self.business.id}: {len(bad)} transaction(s) reference "
                f"unknown account codes (first {min(5, len(bad))}: {preview})"
            )
        return self


class Dataset(BaseModel):
    version: str
    businesses: dict[str, BusinessData] = Field(default_factory=dict)

    def iter_transactions(self) -> list[tuple[BusinessData, Transaction]]:
        out: list[tuple[BusinessData, Transaction]] = []
        for biz_id in sorted(self.businesses):
            bd = self.businesses[biz_id]
            for tx in sorted(bd.transactions, key=lambda t: t.id):
                out.append((bd, tx))
        return out

    @property
    def total_transactions(self) -> int:
        return sum(len(b.transactions) for b in self.businesses.values())
