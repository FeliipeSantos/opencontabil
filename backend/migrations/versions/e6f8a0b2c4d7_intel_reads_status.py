"""intel reads status: a publication can be read or ignored

Revision ID: e6f8a0b2c4d7
Revises: d5e7f9a1b3c6
Create Date: 2026-11-17 22:30:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "e6f8a0b2c4d7"
down_revision = "d5e7f9a1b3c6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("intel_reads") as batch_op:
        batch_op.add_column(sa.Column("status", sa.Text(), server_default="read", nullable=False))


def downgrade():
    with op.batch_alter_table("intel_reads") as batch_op:
        batch_op.drop_column("status")
