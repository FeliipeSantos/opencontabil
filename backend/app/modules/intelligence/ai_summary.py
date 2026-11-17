"""Resumo IA of a publication, generated only when the person asks for it (one publication at a
time), with the AI chosen in Ajustes > Integrações: the person's own subscription (Claude, ChatGPT)
or free API key (Gemini).

The answer follows a fixed schema. Every point says where it comes from: "fonte" (taken from the
official text, with the exact excerpt) or "contexto" (general knowledge of the AI). After the
answer, each "fonte" excerpt is looked up in the text that was sent; one that is not there turns
into "contexto", so nothing invented is shown as coming from the official text.

The summary is kept: opening the publication again shows it without a new request. A new one is
made only when asked ("Gerar de novo").
"""

import hashlib
import json
import logging
import threading
import unicodedata
from datetime import UTC, datetime, timedelta

from flask import current_app

from app.core import ai_cli
from app.core.database import utc_now_iso
from app.core.integrations import active_provider
from app.extensions import db
from app.modules.intelligence import repository
from app.modules.intelligence.models import AiSummary

logger = logging.getLogger(__name__)

PROMPT_VERSION = "1"
# texto oficial enviado (cerca de 30 mil tokens); um ato maior vai em parte, e o resumo avisa
MAX_TEXT_CHARS = 120_000
MAX_EXCERPT_CHARS = 400
# um pedido "pendente" mais antigo que isto foi interrompido (por exemplo, o servidor reiniciou)
STALE_PENDING = timedelta(minutes=10)

KINDS = ["norma", "proposta", "comunicado", "documento_tecnico", "outro"]

_POINT = {
    "type": "object",
    "additionalProperties": False,
    "required": ["texto", "origem", "trecho"],
    "properties": {
        "texto": {"type": "string"},
        "origem": {"type": "string", "enum": ["fonte", "contexto"]},
        "trecho": {"type": "string"},
    },
}
_POINTS = {"type": "array", "items": _POINT}

# todos os campos obrigatórios e sem campos extras: o formato aceito pelos dois fornecedores
SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": [
        "tipo",
        "do_que_se_trata",
        "quem_e_afetado",
        "quem_nao_e_afetado",
        "o_que_muda",
        "o_que_fazer",
        "prazos",
        "vigencia",
        "confianca",
        "motivo_confianca",
        "informacoes_faltando",
    ],
    "properties": {
        "tipo": {"type": "string", "enum": KINDS},
        "do_que_se_trata": {"type": "string"},
        "quem_e_afetado": _POINTS,
        "quem_nao_e_afetado": _POINTS,
        "o_que_muda": _POINTS,
        "o_que_fazer": _POINTS,
        "prazos": {
            "type": "array",
            "items": {
                "type": "object",
                "additionalProperties": False,
                "required": ["data", "descricao", "origem", "trecho"],
                "properties": {
                    "data": {"type": "string"},
                    "descricao": {"type": "string"},
                    "origem": {"type": "string", "enum": ["fonte", "contexto"]},
                    "trecho": {"type": "string"},
                },
            },
        },
        "vigencia": _POINT,
        "confianca": {"type": "string", "enum": ["alta", "media", "baixa"]},
        "motivo_confianca": {"type": "string"},
        "informacoes_faltando": {"type": "array", "items": {"type": "string"}},
    },
}

INSTRUCTION = """Você apoia um escritório de contabilidade no Brasil. Resuma a publicação oficial enviada a seguir \
(entre as marcas INÍCIO e FIM), em português do Brasil, de forma objetiva, para um contador decidir se ela afeta \
os clientes do escritório e o que fazer.

Regras:
- Responda só no formato JSON combinado.
- Em cada ponto, "origem" diz de onde ele vem:
  - "fonte": está escrito na publicação. Copie em "trecho" a frase exata do texto, sem mudar nenhuma palavra \
(até 300 caracteres).
  - "contexto": vem do seu conhecimento geral (por exemplo, o que é um tributo ou quem costuma ser atingido). \
Nesse caso, "trecho" fica vazio.
- Nunca invente datas, prazos, valores ou números de normas. Uma data só entra em "prazos" se estiver no texto; \
use o formato AAAA-MM-DD em "data" (ou vazio, se o texto não der o dia).
- "tipo": norma (ato com força de lei), proposta (consulta pública, projeto), comunicado (notícia, aviso), \
documento_tecnico (leiaute, nota técnica) ou outro.
- "vigencia": quando passa a valer, ou que não tem força de norma.
- "o_que_fazer": providências práticas para o escritório; se não houver nenhuma, diga isso.
- Liste em "informacoes_faltando" o que um contador precisaria saber e o texto não traz.
- "confianca": alta quando o texto completo do ato foi enviado e é claro; baixa quando só há um trecho curto."""


def _normalize(text: str) -> str:
    text = unicodedata.normalize("NFD", text or "")
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.replace("“", '"').replace("”", '"').replace("’", "'").replace("‘", "'")
    return " ".join(text.lower().split())


def build_input(pub: dict, full_text: str | None) -> tuple[str, bool]:
    """Publication data sent to the AI and whether the full text had to be cut."""
    partial = bool(full_text and len(full_text) > MAX_TEXT_CHARS)
    lines = [
        "INÍCIO",
        f"Título: {pub['title']}",
        f"Órgão: {pub.get('organ') or 'não informado'}",
        f"Data de publicação: {pub.get('publishedAt') or 'não informada'}",
        f"Fonte: {pub['sourceId']}",
        f"Tipo de ato: {pub.get('actType') or 'não informado'}",
        f"Assuntos já classificados: {', '.join(pub.get('subjects') or []) or 'nenhum'}",
        "",
        "Trecho oficial:",
        pub.get("excerpt") or "(sem trecho)",
        "",
    ]
    if full_text:
        lines += [
            "Texto oficial completo:" if not partial else f"Texto oficial (só os primeiros {MAX_TEXT_CHARS} caracteres; o ato é maior):",
            full_text[:MAX_TEXT_CHARS],
        ]
    else:
        lines.append("Texto oficial completo: não disponível (a fonte publica só o trecho acima).")
    lines.append("FIM")
    return "\n".join(lines), partial


def _clean_point(raw, source: str, with_date: bool = False) -> dict | None:
    if not isinstance(raw, dict):
        return None
    text_key = "descricao" if with_date else "texto"
    text = str(raw.get(text_key) or "").strip()
    if not text:
        return None
    excerpt = str(raw.get("trecho") or "").strip()[:MAX_EXCERPT_CHARS]
    origin = "fonte" if raw.get("origem") == "fonte" else "contexto"
    # trecho que não está no texto enviado não pode aparecer como "do texto oficial"
    if origin == "fonte" and (not excerpt or _normalize(excerpt.strip(" .…\"'")) not in source):
        origin, excerpt = "contexto", ""
    point = {text_key: text, "origem": origin, "trecho": excerpt if origin == "fonte" else ""}
    if with_date:
        date = str(raw.get("data") or "").strip()
        point["data"] = date if len(date) == 10 and date[4] == "-" and date[7] == "-" else ""
        # data sem trecho do texto não é confiável: fica só a descrição
        if origin != "fonte":
            point["data"] = ""
    return point


def clean_summary(raw: dict, data: str) -> dict:
    """Keeps the schema shape and checks every "fonte" excerpt against the text that was sent."""
    source = _normalize(data)

    def points(key: str, with_date: bool = False) -> list[dict]:
        items = raw.get(key) if isinstance(raw.get(key), list) else []
        return [p for item in items if (p := _clean_point(item, source, with_date))]

    validity = _clean_point(raw.get("vigencia"), source)
    confidence = raw.get("confianca") if raw.get("confianca") in ("alta", "media", "baixa") else "baixa"
    return {
        "tipo": raw.get("tipo") if raw.get("tipo") in KINDS else "outro",
        "do_que_se_trata": str(raw.get("do_que_se_trata") or "").strip(),
        "quem_e_afetado": points("quem_e_afetado"),
        "quem_nao_e_afetado": points("quem_nao_e_afetado"),
        "o_que_muda": points("o_que_muda"),
        "o_que_fazer": points("o_que_fazer"),
        "prazos": points("prazos", with_date=True),
        "vigencia": validity,
        "confianca": confidence,
        "motivo_confianca": str(raw.get("motivo_confianca") or "").strip(),
        "informacoes_faltando": [str(item).strip() for item in raw.get("informacoes_faltando") or [] if str(item).strip()],
    }


def hash_input(data: str) -> str:
    return hashlib.sha256(f"{PROMPT_VERSION}\n{data}".encode()).hexdigest()


def _publication_input(publication_id: str) -> tuple[dict, str, bool] | None:
    pub = repository.get_publication(publication_id)
    if pub is None:
        return None
    stored = repository.get_publication_text(publication_id)
    full_text = stored["text"] if stored and stored["status"] == "ok" else None
    data, partial = build_input(pub, full_text)
    return pub, data, partial


def is_stale(row) -> bool:
    try:
        updated = datetime.fromisoformat(row.updated_at.replace("Z", "+00:00"))
    except ValueError:
        return True
    return datetime.now(UTC) - updated > STALE_PENDING


def to_json(row, current_hash: str | None = None) -> dict:
    """Summary row (AiSummary or a Calendário VersionAnalysis) for the screen."""
    if row is None:
        return {"status": "none"}
    status = row.status
    if status == "pending" and is_stale(row):
        status, error = "error", "O pedido anterior foi interrompido. Gere de novo."
    else:
        error = row.error
    return {
        "status": status,
        "provider": row.provider,
        "providerName": ai_cli.PROVIDERS[row.provider].name if row.provider in ai_cli.PROVIDERS else row.provider,
        # "key": gerado com a chave gratuita (Gemini), não com a assinatura
        "providerKind": ai_cli.PROVIDERS[row.provider].kind if row.provider in ai_cli.PROVIDERS else "cli",
        "model": row.model,
        "summary": json.loads(row.summary) if row.summary else None,
        "partial": bool(row.partial),
        "error": error,
        "requestedBy": row.requested_by,
        "updatedAt": row.updated_at,
        # o texto da publicação (ou as instruções) mudou depois do resumo
        "outdated": bool(current_hash and row.status == "ok" and row.source_hash != current_hash),
    }


def get(publication_id: str) -> dict | None:
    prepared = _publication_input(publication_id)
    if prepared is None:
        return None
    return to_json(db.session.get(AiSummary, publication_id), hash_input(prepared[1]))


# um pedido por vez: a assinatura atende uma pessoa, e os pedidos são raros
_generation_lock = threading.Lock()


def run_generation(app, load_row, provider_id: str, data: str, source_hash: str, label: str, on_done=None) -> None:
    """Asks the AI and saves the answer on the row returned by `load_row()` (a publication's
    summary or a Calendário version's analysis). `on_done(row)` runs before the commit."""
    with app.app_context():
        try:
            with _generation_lock:
                raw = ai_cli.generate(provider_id, INSTRUCTION, data, SCHEMA)
            # o Gemini informa o modelo que respondeu (pode ser um reserva)
            used_model = raw.pop("_model", None) if isinstance(raw, dict) else None
            summary, error, status = clean_summary(raw, data), None, "ok"
        except ai_cli.AiError as err:
            summary, error, status = None, str(err), "error"
        except Exception:  # noqa: BLE001 - qualquer falha vira erro na tela, nunca um pedido preso
            logger.exception("[ia] falha ao resumir %s", label)
            summary, error, status = None, "Falha inesperada ao gerar o resumo. Tente de novo.", "error"
        row = load_row()
        if row is None or row.source_hash != source_hash:
            return
        row.status, row.error, row.updated_at = status, error, utc_now_iso()
        if summary is not None:
            row.summary = json.dumps(summary, ensure_ascii=False)
            row.model = used_model or ai_cli.model_of(ai_cli.PROVIDERS[provider_id])
        if on_done:
            on_done(row)
        db.session.commit()
        logger.info("[ia] resumo de %s pelo %s: %s", label, provider_id, status)


class SummaryError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status
        self.message = message


def ready_provider() -> str:
    """The AI chosen in Ajustes > Integrações, when it can be used now; otherwise SummaryError."""
    provider_id = active_provider()
    provider = ai_cli.PROVIDERS[provider_id]
    connection = ai_cli.connection(provider_id)
    if not connection["installed"]:
        raise SummaryError(400, f"A ferramenta do {provider.name} não está instalada neste servidor.")
    if not connection["connected"]:
        if provider.kind == "key":
            raise SummaryError(400, f"Cadastre a chave do {provider.name} em Ajustes > Integrações.")
        raise SummaryError(400, f"Conecte a sua assinatura do {provider.name} em Ajustes > Integrações.")
    return provider_id


def mark_pending(row, provider_id: str, data: str, partial: bool, user: str) -> str:
    """Puts the row in "pending" for a new request and returns the hash of what is sent."""
    source_hash = hash_input(data)
    row.status, row.provider, row.error = "pending", provider_id, None
    row.source_hash, row.prompt_version, row.partial = source_hash, PROMPT_VERSION, int(partial)
    row.requested_by, row.updated_at = user, utc_now_iso()
    return source_hash


def request_summary(publication_id: str, user: str, run_in_background: bool = True) -> dict:
    """Asks for the Resumo IA of a publication (also "Gerar de novo"). Returns the pending row."""
    prepared = _publication_input(publication_id)
    if prepared is None:
        raise SummaryError(404, "Publicação não encontrada")
    _, data, partial = prepared
    provider_id = ready_provider()

    row = db.session.get(AiSummary, publication_id)
    if row is not None and row.status == "pending" and not is_stale(row):
        return to_json(row)
    if row is None:
        row = AiSummary(publication_id=publication_id, created_at=utc_now_iso())
        db.session.add(row)
    source_hash = mark_pending(row, provider_id, data, partial, user)
    db.session.commit()

    app = current_app._get_current_object()
    args = (app, lambda: db.session.get(AiSummary, publication_id), provider_id, data, source_hash, publication_id)
    if run_in_background:
        threading.Thread(target=run_generation, args=args, daemon=True).start()
    else:
        run_generation(*args)
    db.session.expire_all()
    return to_json(db.session.get(AiSummary, publication_id))
