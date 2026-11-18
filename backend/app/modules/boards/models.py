"""Quadros tables (prefix boards_)."""

from sqlalchemy import ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.extensions import db


class Board(db.Model):
    """One Kanban board stored as a JSON document (lists, cards, labels), in the shape the screen uses."""

    __tablename__ = "boards_boards"
    __table_args__ = (Index("boards_boards_position", "position"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    data: Mapped[str] = mapped_column(Text, nullable=False)
    position: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_at: Mapped[str] = mapped_column(Text, nullable=False)
    updated_by: Mapped[str | None] = mapped_column(Text, ForeignKey("core_users.username", ondelete="SET NULL", onupdate="CASCADE"))
