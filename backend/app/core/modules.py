"""Modules of the navigation turned on or off in Ajustes > Módulos (/api/modules).

    GET /           -> { disabled: [key, ...] }
    PUT /           { disabled: [key, ...] } -> the same, saved

A turned-off module leaves the navigation and the Visão Geral (screen), its API answers 403
and its daily collection stops. Clientes keeps its list readable: Recebimentos and Geração de
DAS use it; only its changes are blocked.
"""

import json

from flask import Blueprint, g, request

from app.core.database import utc_now_iso
from app.core.http import json_error, json_response
from app.core.models import AppSetting
from app.extensions import db

SETTING = "modules.disabled"
MAX_BODY_BYTES = 4 * 1024
# a Visão Geral fica sempre ligada: não entra na lista (um "overview" salvo antes é ignorado)
MODULE_KEYS = ("clients", "receipts", "das", "intelligence", "reforma", "projects", "boards")
DISABLED_MESSAGE = "Módulo desativado em Ajustes > Módulos"

# API de cada módulo; o mais específico primeiro (recebimentos e DAS ficam dentro de /api/clients)
_API_PREFIXES = (
    ("/api/clients/receipts", "receipts"),
    ("/api/clients/service-types", "receipts"),
    ("/api/clients/das", "das"),
    ("/api/intelligence", "intelligence"),
    ("/api/reforma", "reforma"),
    ("/api/projects", "projects"),
    ("/api/boards", "boards"),
    ("/api/clients", "clients"),
)

bp = Blueprint("modules", __name__, url_prefix="/api/modules")


def disabled_modules() -> list[str]:
    setting = db.session.get(AppSetting, SETTING)
    if not setting:
        return []
    try:
        saved = json.loads(setting.value)
    except ValueError:
        return []
    return [key for key in MODULE_KEYS if isinstance(saved, list) and key in saved]


def is_enabled(key: str) -> bool:
    return key not in disabled_modules()


def blocked_module(path: str, method: str) -> str | None:
    """Turned-off module that owns this API call (None: allowed)."""
    module = next((key for prefix, key in _API_PREFIXES if path == prefix or path.startswith(prefix + "/")), None)
    if module is None or is_enabled(module):
        return None
    # a lista de clientes alimenta Recebimentos e DAS: só as alterações param
    if module == "clients" and method == "GET":
        return None
    return module


@bp.get("")
def get_modules():
    return json_response({"disabled": disabled_modules()})


@bp.put("")
def put_modules():
    request.max_content_length = MAX_BODY_BYTES
    body = request.get_json(silent=True)
    disabled = body.get("disabled") if isinstance(body, dict) else None
    if not isinstance(disabled, list) or not all(isinstance(key, str) and key in MODULE_KEYS for key in disabled):
        return json_error(400, "Módulo inválido")
    value = json.dumps([key for key in MODULE_KEYS if key in disabled])
    setting = db.session.get(AppSetting, SETTING)
    if setting is None:
        db.session.add(AppSetting(key=SETTING, value=value, updated_at=utc_now_iso(), updated_by=g.user))
    else:
        setting.value, setting.updated_at, setting.updated_by = value, utc_now_iso(), g.user
    db.session.commit()
    return json_response({"disabled": disabled_modules()})
