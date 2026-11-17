"""reforma version analyses: Análise IA of a Calendário version, generated on request

Revision ID: c4d6e8f0a2b5
Revises: b8e2f4a6c1d3
Create Date: 2026-11-17 10:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "c4d6e8f0a2b5"
down_revision = "b8e2f4a6c1d3"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "reforma_version_analyses",
        sa.Column("version_id", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("provider", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column("source_hash", sa.Text(), nullable=False),
        sa.Column("prompt_version", sa.Text(), nullable=False),
        sa.Column("partial", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("requested_by", sa.Text(), nullable=True),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.ForeignKeyConstraint(["version_id"], ["reforma_document_versions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["requested_by"], ["core_users.username"], onupdate="CASCADE", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("version_id"),
    )


def downgrade():
    op.drop_table("reforma_version_analyses")
