"""boards: Kanban boards of the Quadros module (Controle)

Revision ID: f7a9b1c3d5e8
Revises: e6f8a0b2c4d7
Create Date: 2026-11-18 11:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "f7a9b1c3d5e8"
down_revision = "e6f8a0b2c4d7"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "boards_boards",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("data", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.Text(), nullable=False),
        sa.Column("updated_at", sa.Text(), nullable=False),
        sa.Column("updated_by", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["updated_by"], ["core_users.username"], onupdate="CASCADE", ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("boards_boards", schema=None) as batch_op:
        batch_op.create_index("boards_boards_position", ["position"], unique=False)


def downgrade():
    with op.batch_alter_table("boards_boards", schema=None) as batch_op:
        batch_op.drop_index("boards_boards_position")
    op.drop_table("boards_boards")
