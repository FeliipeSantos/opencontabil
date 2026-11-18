"""HTTP routes of the Quadros module, mounted at /api/boards.

    GET    /api/boards        -> [{ id, name, color, lists, cards, updatedAt }] in display order
    GET    /api/boards/<id>   -> the board document (lists, cards, labels)
    PUT    /api/boards/<id>   -> creates or updates ONE board: { id, result, updatedAt }
    DELETE /api/boards/<id>   -> removes one board

The session and JSON content type are checked before these routes (app.core.http).
"""

import json
import re

from flask import Blueprint, Response, g, request
from werkzeug.exceptions import RequestEntityTooLarge

from app.core.http import json_error, json_response
from app.modules.boards import repository
from app.modules.boards.schemas import validate_board

MAX_BODY_BYTES = 4 * 1024 * 1024
ID_PATTERN = re.compile(r"[A-Za-z0-9_-]{1,64}", re.ASCII)
NOT_FOUND = "Quadro não encontrado"

bp = Blueprint("boards", __name__, url_prefix="/api/boards")


def _reject_constant(name: str):
    raise ValueError(f"invalid constant {name}")


@bp.get("")
def list_boards():
    return json_response(repository.list_boards())


@bp.get("/<board_id>")
def get_board(board_id: str):
    data = repository.get_board_json(board_id) if ID_PATTERN.fullmatch(board_id) else None
    if data is None:
        return json_error(404, NOT_FOUND)
    return Response(data, mimetype="application/json")


@bp.put("/<board_id>")
def save_board(board_id: str):
    request.max_content_length = MAX_BODY_BYTES
    try:
        document = json.loads(request.get_data(cache=False) or b"", parse_constant=_reject_constant)
    except ValueError:
        return json_error(400, "JSON inválido")
    error = validate_board(document)
    if error:
        return json_error(400, error)
    if document["id"] != board_id:
        return json_error(400, "O identificador do quadro não confere com o endereço")
    result, updated_at = repository.save_board(document, g.user)
    return json_response({"id": board_id, "result": result, "updatedAt": updated_at}, 201 if result == "created" else 200)


@bp.delete("/<board_id>")
def delete_board(board_id: str):
    if not ID_PATTERN.fullmatch(board_id) or not repository.delete_board(board_id):
        return json_error(404, NOT_FOUND)
    return json_response({"id": board_id})


@bp.errorhandler(RequestEntityTooLarge)
def _too_large(_error):
    return json_error(413, "Quadro muito grande")
