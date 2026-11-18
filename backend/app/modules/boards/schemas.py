"""Validation of a board document (strict: unknown fields are refused).

{ id, name, color, labels: [{ id, name, color }],
  lists: [{ id, title, cards: [{ id, title, description, labelIds, due, dueDone, checklist: [{ id, text, done }],
  completed, comments: [{ id, author, text, createdAt, editedAt }], activity: [{ id, author, text, createdAt }], createdAt }] }],
  createdAt }
"""

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, ValidationError

ID = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
COLOR = Annotated[str, StringConstraints(pattern=r"^(blue|green|orange|red|purple|gray)$")]
DATE = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d{2}-\d{2}$")]
TIMESTAMP = Annotated[str, StringConstraints(max_length=40)]

MAX_LISTS = 100
MAX_CARDS_PER_LIST = 1000
MAX_LABELS = 30
MAX_CHECKLIST = 200
MAX_COMMENTS = 500
MAX_ACTIVITY = 200

INVALID_BOARD = "Quadro inválido"
NAME_MESSAGE = "O quadro precisa de um nome (até 120 caracteres)"


def _text(max_length: int, min_length: int = 0):
    return Annotated[str, StringConstraints(min_length=min_length, max_length=max_length)]


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class Label(_Strict):
    id: ID
    name: _text(60)
    color: COLOR


class ChecklistItem(_Strict):
    id: ID
    text: _text(500, 1)
    done: bool


class Comment(_Strict):
    id: ID
    author: _text(120)
    text: _text(5000, 1)
    createdAt: TIMESTAMP
    editedAt: TIMESTAMP | None = None


class Activity(_Strict):
    """Event of the card history (created, moved, completed...), written by the screen."""

    id: ID
    author: _text(120)
    text: _text(300, 1)
    createdAt: TIMESTAMP


class Card(_Strict):
    id: ID
    title: _text(500, 1)
    description: _text(20000) = ""
    labelIds: list[ID] = Field(default_factory=list, max_length=MAX_LABELS)
    due: DATE | None = None
    dueDone: bool = False
    checklist: list[ChecklistItem] = Field(default_factory=list, max_length=MAX_CHECKLIST)
    completed: bool = False
    # arquivado: sai da lista, mas fica guardado (Itens arquivados do quadro)
    archived: bool = False
    comments: list[Comment] = Field(default_factory=list, max_length=MAX_COMMENTS)
    activity: list[Activity] = Field(default_factory=list, max_length=MAX_ACTIVITY)
    createdAt: TIMESTAMP | None = None


class BoardList(_Strict):
    id: ID
    title: _text(200, 1)
    cards: list[Card] = Field(default_factory=list, max_length=MAX_CARDS_PER_LIST)


class BoardDocument(_Strict):
    id: ID
    name: _text(120, 1)
    color: COLOR = "blue"
    labels: list[Label] = Field(default_factory=list, max_length=MAX_LABELS)
    lists: list[BoardList] = Field(default_factory=list, max_length=MAX_LISTS)
    createdAt: TIMESTAMP | None = None


def validate_board(document: Any) -> str | None:
    """Returns the error message for an invalid board, or None when it is valid."""
    if not isinstance(document, dict):
        return INVALID_BOARD
    try:
        board = BoardDocument.model_validate(document)
    except ValidationError as err:
        if any(error["loc"] and error["loc"][0] == "name" for error in err.errors()):
            return NAME_MESSAGE
        return INVALID_BOARD
    if not board.name.strip():
        return NAME_MESSAGE
    return None
