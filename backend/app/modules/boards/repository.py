"""Data access of the Quadros module (table boards_boards). Each board is one JSON document."""

import json
from typing import Any, Literal

from sqlalchemy import delete, insert, literal, select, update
from sqlalchemy.exc import IntegrityError

from app.core.database import utc_now_iso
from app.core.jsontext import dumps_js
from app.extensions import db
from app.modules.boards.models import Board


def _summary(row: Board) -> dict[str, Any]:
    document = json.loads(row.data)
    lists = document.get("lists", [])
    # arquivados não contam
    cards = [card for item in lists for card in item.get("cards", []) if not card.get("archived")]
    return {
        "id": row.id,
        "name": row.name,
        "color": document.get("color", "blue"),
        "lists": len(lists),
        "cards": len(cards),
        "updatedAt": row.updated_at,
    }


def list_boards() -> list[dict[str, Any]]:
    """Every board in display order, with counts (the lists and cards stay in the board)."""
    rows = db.session.scalars(select(Board).order_by(Board.position, Board.created_at))
    return [_summary(row) for row in rows]


def get_board_json(board_id: str) -> str | None:
    return db.session.scalar(select(Board.data).where(Board.id == board_id))


def save_board(document: dict[str, Any], user: str | None) -> tuple[Literal["created", "updated"], str]:
    """Creates or updates one board; new boards go to the end. Returns the result and the save time."""
    now = utc_now_iso()
    data = dumps_js(document)
    board_id = document["id"]

    def update_existing() -> bool:
        result = db.session.execute(
            update(Board).where(Board.id == board_id).values(name=document["name"].strip(), data=data, updated_at=now, updated_by=user)
        )
        return bool(result.rowcount)

    if update_existing():
        db.session.commit()
        return "updated", now

    next_position = select(db.func.coalesce(db.func.max(Board.position), -1) + 1).scalar_subquery()
    try:
        db.session.execute(
            insert(Board).from_select(
                ["id", "name", "data", "position", "created_at", "updated_at", "updated_by"],
                select(
                    literal(board_id),
                    literal(document["name"].strip()),
                    literal(data),
                    next_position,
                    literal(now),
                    literal(now),
                    literal(user),
                ),
            )
        )
        db.session.commit()
        return "created", now
    except IntegrityError:
        db.session.rollback()
        update_existing()
        db.session.commit()
        return "updated", now


def delete_board(board_id: str) -> bool:
    result = db.session.execute(delete(Board).where(Board.id == board_id))
    db.session.commit()
    return bool(result.rowcount)
