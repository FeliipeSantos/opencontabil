"""Quadros module: Kanban boards (lists and cards), like Trello, inside Controle."""

from app.modules.boards.cli import boards_group as cli_group
from app.modules.boards.routes import bp as blueprint

__all__ = ["blueprint", "cli_group"]
