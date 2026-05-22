"""Seed data for the demo database.

A minimal, realistic chart of accounts that covers the categories the
ClaudeHaikuCategorizer is most likely to return on typical SMB transactions.
Not derived from any specific business in the eval dataset — those are eval
fixtures and should stay separate from production data.
"""

from sqlalchemy.orm import Session

from ledgerlens.models import AccountCategory
from ledgerlens.repositories import CategoryRepo

DEFAULT_COA: list[tuple[str, str, str, str]] = [
    # (code, name, type, description)
    ("1010", "Cash - Operating", "asset", "Primary operating checking account."),
    ("1020", "Cash - Reserve", "asset", "Reserve / savings account."),
    ("1200", "Prepaid Expenses", "asset", "Annual subscriptions and insurance paid up front."),
    ("2010", "Accounts Payable", "liability", "Outstanding balances owed to vendors."),
    ("2020", "Sales Tax Payable", "liability", "Sales tax collected, owed to the state."),
    ("3010", "Owner's Equity", "equity", "Owner-contributed capital."),
    ("3030", "Owner Distributions", "equity", "Owner draws / distributions."),
    ("4010", "Sales Revenue", "revenue", "Primary sales revenue."),
    ("4020", "Service Revenue", "revenue", "Service-based revenue."),
    ("5010", "Cost of Goods Sold", "cogs", "Direct cost of goods or services delivered."),
    ("6010", "Rent", "expense", "Office or storefront rent."),
    ("6020", "Utilities", "expense", "Electric, gas, water, internet."),
    ("6030", "Wages & Salaries", "expense", "Employee compensation."),
    ("6040", "Payroll Taxes", "expense", "Employer share of payroll taxes."),
    ("6050", "Insurance", "expense", "Insurance premiums (excluding prepaid)."),
    ("6060", "Office Supplies", "expense", "Paper, pens, printer ink."),
    ("6070", "Software Subscriptions", "expense", "Recurring software / SaaS."),
    ("6080", "Professional Services", "expense", "Accounting, legal, consultants."),
    ("6090", "Marketing & Advertising", "expense", "Ads, paid promotion, content."),
    ("6100", "Bank & Merchant Fees", "expense", "Card processing, ACH, wires, account fees."),
    ("6110", "Travel & Lodging", "expense", "Business travel and lodging."),
    ("6120", "Meals & Entertainment", "expense", "Client meals; 50% deductible."),
    ("6130", "Fuel & Vehicle", "expense", "Vehicle fuel and minor maintenance."),
    ("6140", "Repairs & Maintenance", "expense", "Service and minor repairs."),
    ("6150", "Telephone & Internet", "expense", "Business phone lines."),
    ("6160", "Training & Education", "expense", "Conferences, courses, certifications."),
    ("6170", "Equipment - Expensed", "expense", "Tools under the capitalization threshold."),
    ("6180", "Supplies - General", "expense", "Non-resale operational supplies."),
    ("7010", "Interest Income", "other_income", "Interest earned on deposits."),
    ("8010", "Interest Expense", "other_expense", "Interest paid on credit balances."),
]


def seed_chart_of_accounts(db: Session) -> int:
    """Idempotently insert the default chart of accounts.

    Returns the number of rows that ended up active.
    """
    repo = CategoryRepo(db)
    for code, name, type_, description in DEFAULT_COA:
        repo.upsert(
            AccountCategory(code=code, name=name, type=type_, description=description, active=True)
        )
    db.commit()
    return len(DEFAULT_COA)
