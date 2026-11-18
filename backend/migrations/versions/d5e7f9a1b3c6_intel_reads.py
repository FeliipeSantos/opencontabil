"""intel reads: publications each user marked as read

Revision ID: d5e7f9a1b3c6
Revises: c4d6e8f0a2b5
Create Date: 2026-11-17 18:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "d5e7f9a1b3c6"
down_revision = "c4d6e8f0a2b5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "intel_reads",
        sa.Column("username", sa.Text(), nullable=False),
        sa.Column("publication_id", sa.Text(), nullable=False),
        sa.Column("read_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["publication_id"], ["intel_publications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["username"], ["core_users.username"], onupdate="CASCADE", ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("username", "publication_id"),
    )


def downgrade():
    op.drop_table("intel_reads")
