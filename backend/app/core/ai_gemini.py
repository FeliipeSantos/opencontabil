"""Gemini through the person's own free API key (Google AI Studio), for the Resumo IA.

Unlike Claude and ChatGPT (official CLIs with the subscription, see ai_cli.py), the Gemini is
called over HTTPS with an API key. The key is created for free at aistudio.google.com/apikey and
is kept in the database (core_settings): it never goes back to the screen, only its last digits.

On the free tier Google may use what is sent to improve its products; the publications are
public official texts. When the free limit is reached, the request fails and works again later.
"""

import json
import logging
import os
import re

import httpx

from app.core.database import utc_now_iso
from app.core.models import AppSetting
from app.extensions import db

logger = logging.getLogger(__name__)

KEY_SETTING = "ai.gemini_api_key"
DEFAULT_MODEL = "gemini-flash-latest"
# quando o modelo principal está sobrecarregado (503), sem cota gratuita (429) ou saiu do ar (404),
# o pedido vai para o próximo: modelos mais antigos costumam ter vaga no plano gratuito
DEFAULT_FALLBACK_MODELS = ("gemini-3-flash-preview", "gemini-flash-lite-latest", "gemini-2.5-flash")
SKIP_TO_NEXT_MODEL = {404, 429, 500, 503}
DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta"
CHECK_TIMEOUT_SECONDS = 20
# por modelo: um que passa disso é trocado pelo próximo (com folga para os atos longos)
MODEL_TIMEOUT_SECONDS = 120
# formatos do AI Studio: o antigo "AIza..." e o novo "AQ.Ab8..." (com ponto)
KEY_PATTERN = re.compile(r"^[A-Za-z0-9_.\-]{20,200}$")

# testes trocam o transporte para não sair para a internet
_transport: httpx.BaseTransport | None = None


class GeminiError(Exception):
    """Request that could not be done; the message is shown on the screen."""


def model() -> str:
    return os.environ.get("AI_GEMINI_MODEL") or DEFAULT_MODEL


def _base_url() -> str:
    return (os.environ.get("AI_GEMINI_BASE_URL") or DEFAULT_BASE_URL).rstrip("/")


def _client(timeout: float) -> httpx.Client:
    return httpx.Client(timeout=timeout, transport=_transport, follow_redirects=False)


def get_key() -> str | None:
    setting = db.session.get(AppSetting, KEY_SETTING)
    return setting.value if setting and setting.value else None


def key_hint(key: str | None) -> str | None:
    return f"Chave terminada em {key[-4:]}" if key else None


def _api_error(response: httpx.Response) -> str:
    """Message for the screen from an error answer of the Gemini API (never with the key)."""
    try:
        error = response.json().get("error") or {}
    except ValueError:
        error = {}
    reasons = json.dumps(error.get("details") or [])
    status = error.get("status") or ""
    if "API_KEY_INVALID" in reasons or response.status_code in (401, 403) or status in ("UNAUTHENTICATED", "PERMISSION_DENIED"):
        return "O Google não aceitou a chave do Gemini. Confira a chave em Ajustes > Integrações."
    if response.status_code == 429 or status == "RESOURCE_EXHAUSTED":
        return "O limite gratuito do Gemini foi atingido. Tente de novo mais tarde."
    if response.status_code == 404:
        return f"O modelo {model()} não está disponível para esta chave."
    if response.status_code >= 500:
        return "O Gemini está indisponível agora. Tente de novo em alguns minutos."
    message = str(error.get("message") or "").strip()
    return f"O Gemini recusou o pedido: {message[:300]}" if message else f"O Gemini recusou o pedido (HTTP {response.status_code})."


def check_key(key: str) -> None:
    """Asks Google whether the key works with the model in use (does not count as a generation)."""
    try:
        with _client(CHECK_TIMEOUT_SECONDS) as client:
            response = client.get(f"{_base_url()}/models/{model()}", headers={"x-goog-api-key": key})
    except httpx.HTTPError as err:
        raise GeminiError("Não foi possível falar com o Google para conferir a chave. Tente de novo.") from err
    if response.status_code != 200:
        raise GeminiError(_api_error(response))


def save_key(key: str, user: str | None) -> None:
    key = key.strip()
    if not KEY_PATTERN.match(key):
        raise GeminiError("Cole a chave de API do Gemini como o AI Studio mostra (começa com AQ. ou AIza).")
    check_key(key)
    now = utc_now_iso()
    setting = db.session.get(AppSetting, KEY_SETTING)
    if setting:
        setting.value, setting.updated_at, setting.updated_by = key, now, user
    else:
        db.session.add(AppSetting(key=KEY_SETTING, value=key, updated_at=now, updated_by=user))
    db.session.commit()


def remove_key() -> None:
    setting = db.session.get(AppSetting, KEY_SETTING)
    if setting:
        db.session.delete(setting)
        db.session.commit()


def status(online: bool = False) -> dict:
    """{installed, connected, account, error}; `online` also asks Google whether the key still works."""
    key = get_key()
    result = {"installed": True, "connected": bool(key), "account": key_hint(key), "error": None}
    if key and online:
        try:
            check_key(key)
        except GeminiError as err:
            result["connected"], result["error"] = False, str(err)
    return result


def _request_body(instruction: str, data: str, schema: dict) -> dict:
    # o formato vai junto das instruções, com a resposta em JSON: com o esquema imposto no pedido
    # (responseJsonSchema) alguns modelos levam minutos ou não respondem; clean_summary confere tudo
    instruction = f"{instruction}\n\nFormato da resposta (JSON Schema):\n{json.dumps(schema, ensure_ascii=False)}"
    return {
        "systemInstruction": {"parts": [{"text": instruction}]},
        "contents": [{"role": "user", "parts": [{"text": data}]}],
        "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
    }


def _parse_answer(payload: dict) -> dict:
    candidates = payload.get("candidates") or []
    if not candidates:
        reason = (payload.get("promptFeedback") or {}).get("blockReason")
        raise GeminiError(f"O Gemini não respondeu{f' (bloqueado: {reason})' if reason else ''}. Tente de novo.")
    candidate = candidates[0]
    text = "".join(part.get("text", "") for part in (candidate.get("content") or {}).get("parts") or [] if not part.get("thought"))
    if candidate.get("finishReason") == "MAX_TOKENS":
        raise GeminiError("A resposta do Gemini veio cortada. Tente de novo.")
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        parsed = json.loads(text)
    except ValueError as err:
        raise GeminiError("O Gemini respondeu fora do formato combinado. Tente de novo.") from err
    if not isinstance(parsed, dict):
        raise GeminiError("O Gemini respondeu fora do formato combinado. Tente de novo.")
    return parsed


def models_to_try() -> list[str]:
    """The model in use, then the fallbacks (AI_GEMINI_FALLBACK_MODELS, comma separated), without repeats."""
    configured = os.environ.get("AI_GEMINI_FALLBACK_MODELS")
    fallbacks = configured.split(",") if configured is not None else list(DEFAULT_FALLBACK_MODELS)
    names = [model(), *(name.strip() for name in fallbacks)]
    return list(dict.fromkeys(name for name in names if name))


def generate(instruction: str, data: str, schema: dict) -> dict:
    """One request with the saved key; returns the JSON answer that follows `schema`, with the
    model that answered in "_model". A model that is overloaded, out of free quota, gone, too slow
    or answers out of the format is skipped for the next one in models_to_try()."""
    key = get_key()
    if not key:
        raise GeminiError("Cadastre a chave do Gemini em Ajustes > Integrações.")
    headers = {"x-goog-api-key": key}
    body = _request_body(instruction, data, schema)
    error = GeminiError("Nenhum modelo do Gemini configurado.")
    with _client(MODEL_TIMEOUT_SECONDS) as client:
        for name in models_to_try():
            try:
                response = client.post(f"{_base_url()}/models/{name}:generateContent", headers=headers, json=body)
            except httpx.TimeoutException:
                logger.info("[ia] Gemini %s não respondeu em %ss; tentando o próximo modelo", name, MODEL_TIMEOUT_SECONDS)
                error = GeminiError("O Gemini demorou demais para responder. Tente de novo.")
                continue
            except httpx.HTTPError as err:
                raise GeminiError("Não foi possível falar com o Gemini. Confira a internet do servidor e tente de novo.") from err
            if response.status_code != 200:
                error = GeminiError(_api_error(response))
                if response.status_code in SKIP_TO_NEXT_MODEL:
                    logger.info("[ia] Gemini %s indisponível (HTTP %s); tentando o próximo modelo", name, response.status_code)
                    continue
                raise error
            try:
                answer = _parse_answer(response.json())
            except (ValueError, GeminiError) as err:
                logger.info("[ia] Gemini %s respondeu fora do formato; tentando o próximo modelo", name)
                error = err if isinstance(err, GeminiError) else GeminiError("O Gemini não respondeu como esperado. Tente de novo.")
                continue
            answer["_model"] = name
            return answer
    raise error
