"""Análise IA of a Calendário version: impact, who is affected and what to do, generated only
when the person asks for it (one version at a time), with the AI chosen in Ajustes > Integrações.

Same engine, schema and checks as the Resumo IA of the Publicações (intelligence/ai_summary.py):
every "fonte" point must quote the official text that was sent. The analysis is kept; a new one
is made only when asked ("Gerar de novo"). The version's analysis_status follows it: "done" after
an analysis, "error" when the last one failed.
"""

import threading

from flask import current_app

from app.core.database import utc_now_iso
from app.extensions import db
from app.modules.intelligence import ai_summary
from app.modules.reforma.catalog import KINDS, SOURCES
from app.modules.reforma.models import Document, DocumentVersion, VersionAnalysis

SOURCE_NAMES = {s["id"]: s["name"] for s in SOURCES}


def build_input(document: Document, version: DocumentVersion) -> tuple[str, bool]:
    """Version data sent to the AI and whether the full text had to be cut."""
    limit = ai_summary.MAX_TEXT_CHARS
    full_text = version.full_text or ""
    partial = len(full_text) > limit
    lines = [
        "INÍCIO",
        f"Título: {version.title or document.title}",
        f"Fonte: {SOURCE_NAMES.get(document.source_id, document.source_id)}",
        f"Tipo de documento: {KINDS.get(document.kind, document.kind)}",
        f"Versão: {version.version_label or 'sem número de versão'}",
        f"Data de publicação: {version.published_at or document.published_at or 'não informada'}",
        "",
        "Resumo da fonte:",
        version.summary or "(sem resumo)",
        "",
    ]
    if full_text:
        lines += [
            "Texto oficial completo:" if not partial else f"Texto oficial (só os primeiros {limit} caracteres; o documento é maior):",
            full_text[:limit],
        ]
    else:
        lines.append("Texto oficial completo: não disponível (a fonte publica só o resumo acima).")
    lines.append("FIM")
    return "\n".join(lines), partial


def _load(doc_id: str, version_id: str) -> tuple[Document, DocumentVersion] | None:
    version = db.session.get(DocumentVersion, version_id)
    if version is None or version.document_id != doc_id:
        return None
    return db.session.get(Document, doc_id), version


def get(doc_id: str, version_id: str) -> dict | None:
    loaded = _load(doc_id, version_id)
    if loaded is None:
        return None
    data, _ = build_input(*loaded)
    return ai_summary.to_json(db.session.get(VersionAnalysis, version_id), ai_summary.hash_input(data))


def _after(row: VersionAnalysis) -> None:
    version = db.session.get(DocumentVersion, row.version_id)
    if version is not None:
        version.analysis_status = "done" if row.status == "ok" else "error"


def request_analysis(doc_id: str, version_id: str, user: str, run_in_background: bool = True) -> dict:
    """Asks for the Análise IA of a version (also "Gerar de novo"). Returns the pending row."""
    loaded = _load(doc_id, version_id)
    if loaded is None:
        raise ai_summary.SummaryError(404, "Versão não encontrada")
    data, partial = build_input(*loaded)
    provider_id = ai_summary.ready_provider()

    row = db.session.get(VersionAnalysis, version_id)
    if row is not None and row.status == "pending" and not ai_summary.is_stale(row):
        return ai_summary.to_json(row)
    if row is None:
        row = VersionAnalysis(version_id=version_id, created_at=utc_now_iso())
        db.session.add(row)
    source_hash = ai_summary.mark_pending(row, provider_id, data, partial, user)
    db.session.commit()

    app = current_app._get_current_object()
    args = (app, lambda: db.session.get(VersionAnalysis, version_id), provider_id, data, source_hash, f"versão {version_id}", _after)
    if run_in_background:
        threading.Thread(target=ai_summary.run_generation, args=args, daemon=True).start()
    else:
        ai_summary.run_generation(*args)
    db.session.expire_all()
    return ai_summary.to_json(db.session.get(VersionAnalysis, version_id))
