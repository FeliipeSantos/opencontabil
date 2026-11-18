"""Terminal commands of the Quadros module: move boards between installations.

flask boards export [ARQUIVO]          -> every board as a JSON list (stdout when no file)
flask boards import ARQUIVO|-          -> creates the boards of the file (- reads stdin)
                    [--replace]        -> overwrites boards with the same id (default: keeps them)
"""

import json
import sys

import click
from flask.cli import AppGroup
from sqlalchemy import select

from app.core.models import User
from app.extensions import db
from app.modules.boards import repository
from app.modules.boards.models import Board
from app.modules.boards.schemas import validate_board

boards_group = AppGroup("boards", help="Quadros (Kanban): exportar e importar entre instalações.")


@boards_group.command("export", help="Exporta todos os quadros para um arquivo JSON (ou para a tela).")
@click.argument("destino", required=False, type=click.Path(dir_okay=False))
def export_command(destino: str | None) -> None:
    rows = db.session.scalars(select(Board).order_by(Board.position, Board.created_at))
    boards = [json.loads(row.data) for row in rows]
    text = json.dumps(boards, ensure_ascii=False, indent=1)
    if destino:
        with open(destino, "w", encoding="utf-8") as file:
            file.write(text)
        click.echo(f"{len(boards)} quadro(s) exportado(s) para {destino}", err=True)
    else:
        sys.stdout.write(text)


@boards_group.command("import", help="Importa os quadros de um arquivo JSON exportado (use - para ler da entrada).")
@click.argument("origem", type=click.File("r", encoding="utf-8"))
@click.option("--replace", is_flag=True, help="Substitui quadros que já existem com o mesmo id.")
def import_command(origem, replace: bool) -> None:
    try:
        boards = json.load(origem)
    except ValueError as err:
        raise click.ClickException(f"Arquivo não é um JSON válido: {err}") from err
    if not isinstance(boards, list):
        raise click.ClickException("O arquivo deve ter uma lista de quadros (gerada por flask boards export).")
    # quem aparece como autor da gravação: o primeiro usuário da instalação
    user = db.session.scalar(select(User.username).order_by(User.created_at))
    created = skipped = replaced = 0
    for board in boards:
        error = validate_board(board)
        if error:
            raise click.ClickException(f"Quadro inválido ({board.get('name') if isinstance(board, dict) else '?'}): {error}")
    for board in boards:
        exists = repository.get_board_json(board["id"]) is not None
        if exists and not replace:
            skipped += 1
            click.echo(f"  já existe, mantido: {board['name']}")
            continue
        repository.save_board(board, user)
        if exists:
            replaced += 1
            click.echo(f"  substituído: {board['name']}")
        else:
            created += 1
            click.echo(f"  criado: {board['name']}")
    click.echo(f"Importação concluída: {created} criado(s), {replaced} substituído(s), {skipped} mantido(s).")
