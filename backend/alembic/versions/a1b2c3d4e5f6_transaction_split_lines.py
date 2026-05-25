"""transaction split lines

Revision ID: a1b2c3d4e5f6
Revises: 5d5603a94bf4
Create Date: 2026-05-25

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: str = "5d5603a94bf4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "transaction_split_lines",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("transaction_id", sa.String(32), sa.ForeignKey("transactions.id"), nullable=False),
        sa.Column("business_id", sa.String(32), nullable=True),
        sa.Column("line_index", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("amount_cents", sa.Integer(), nullable=False),
        sa.Column("category_code", sa.String(16), nullable=True),
        sa.Column("category_name", sa.String(128), nullable=True),
        sa.Column("note", sa.String(512), nullable=True),
        sa.Column("source", sa.String(64), nullable=False, server_default="owner_review"),
        sa.Column("created_at", sa.DateTime(timezone=True)),
        sa.Column("updated_at", sa.DateTime(timezone=True)),
    )
    with op.batch_alter_table("transaction_split_lines") as batch_op:
        batch_op.create_index("ix_split_transaction_id", ["transaction_id"])
        batch_op.create_index("ix_split_business_id", ["business_id"])


def downgrade() -> None:
    op.drop_table("transaction_split_lines")
