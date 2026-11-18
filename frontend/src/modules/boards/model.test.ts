import { describe, expect, it } from 'vitest';

import {
  addCard,
  archivedCards,
  setCardArchived,
  addComment,
  editComment,
  removeComment,
  setCardCompleted,
  addList,
  checklistProgress,
  dueState,
  matchesSearch,
  moveCard,
  moveList,
  newBoard,
  removeLabel,
  toggleCardLabel,
  updateCard,
} from '@/modules/boards/model';
import type { Board } from '@/modules/boards/types';

function sample(): Board {
  let board = newBoard('Rotina');
  const [todo] = board.lists;
  board = addCard(board, todo.id, 'Um');
  board = addCard(board, todo.id, 'Dois');
  board = addCard(board, todo.id, 'Três');
  return board;
}

const titles = (board: Board, index: number) => board.lists[index].cards.map((c) => c.title);

describe('newBoard', () => {
  it('starts with the three usual lists and some labels', () => {
    const board = newBoard('  Escritório ');
    expect(board.name).toBe('Escritório');
    expect(board.lists.map((l) => l.title)).toEqual(['A fazer', 'Em andamento', 'Concluído']);
    expect(board.labels).toHaveLength(3);
  });
});

describe('moveCard', () => {
  it('reorders inside a list (the index is where the card ends up)', () => {
    const board = sample();
    const [one] = board.lists[0].cards;
    // soltar antes do "Três" (índice 2): o "Um" fica entre "Dois" e "Três"
    expect(titles(moveCard(board, one.id, board.lists[0].id, 2), 0)).toEqual(['Dois', 'Um', 'Três']);
    // soltar no fim
    expect(titles(moveCard(board, one.id, board.lists[0].id, 3), 0)).toEqual(['Dois', 'Três', 'Um']);
    const three = board.lists[0].cards[2];
    expect(titles(moveCard(board, three.id, board.lists[0].id, 0), 0)).toEqual(['Três', 'Um', 'Dois']);
  });

  it('moves to another list', () => {
    const board = sample();
    const two = board.lists[0].cards[1];
    const moved = moveCard(board, two.id, board.lists[1].id, 0);
    expect(titles(moved, 0)).toEqual(['Um', 'Três']);
    expect(titles(moved, 1)).toEqual(['Dois']);
    // o quadro original não muda
    expect(titles(board, 0)).toEqual(['Um', 'Dois', 'Três']);
  });
});

describe('lists', () => {
  it('adds and moves lists', () => {
    let board = addList(newBoard('X'), 'Revisão');
    expect(board.lists.map((l) => l.title)).toEqual(['A fazer', 'Em andamento', 'Concluído', 'Revisão']);
    board = moveList(board, board.lists[3].id, 1);
    expect(board.lists.map((l) => l.title)).toEqual(['A fazer', 'Revisão', 'Em andamento', 'Concluído']);
    expect(addList(board, '   ').lists).toHaveLength(4);
  });
});

describe('labels and checklist', () => {
  it('removing a label takes it out of the cards', () => {
    let board = sample();
    const card = board.lists[0].cards[0];
    const label = board.labels[0];
    board = toggleCardLabel(board, card.id, label.id);
    expect(board.lists[0].cards[0].labelIds).toEqual([label.id]);
    board = removeLabel(board, label.id);
    expect(board.lists[0].cards[0].labelIds).toEqual([]);
    expect(board.labels).toHaveLength(2);
  });

  it('counts the checklist', () => {
    const board = updateCard(sample(), sample().lists[0].cards[0].id, () => undefined);
    expect(checklistProgress(board.lists[0].cards[0])).toBeNull();
    expect(
      checklistProgress({
        checklist: [
          { id: 'a', text: 'a', done: true },
          { id: 'b', text: 'b', done: false },
        ],
      }),
    ).toEqual({ done: 1, total: 2 });
  });
});

describe('comments and history', () => {
  it('records who created, moved and completed the card', () => {
    let board = newBoard('X');
    board = addCard(board, board.lists[0].id, 'Guia', 'Felipe');
    const card = board.lists[0].cards[0];
    expect(card.activity.map((a) => `${a.author} ${a.text}`)).toEqual(['Felipe adicionou este cartão a A fazer']);
    board = moveCard(board, card.id, board.lists[1].id, 0, 'Felipe');
    board = setCardCompleted(board, card.id, true, 'Felipe');
    expect(board.lists[1].cards[0].activity.map((a) => a.text)).toEqual([
      'adicionou este cartão a A fazer',
      'moveu este cartão de A fazer para Em andamento',
      'marcou este cartão como concluído',
    ]);
    expect(board.lists[1].cards[0].completed).toBe(true);
  });

  it('archives and restores cards', () => {
    let board = sample();
    const id = board.lists[0].cards[1].id;
    board = setCardArchived(board, id, true, 'Felipe');
    expect(archivedCards(board).map(({ card, list }) => `${card.title} / ${list.title}`)).toEqual(['Dois / A fazer']);
    board = setCardArchived(board, id, false, 'Felipe');
    expect(archivedCards(board)).toEqual([]);
    expect(board.lists[0].cards[1].activity.map((a) => a.text).slice(-2)).toEqual(['arquivou este cartão', 'restaurou este cartão']);
  });

  it('adds, edits and removes comments', () => {
    let board = sample();
    const id = board.lists[0].cards[0].id;
    board = addComment(board, id, 'Felipe', '  Enviado ao cliente ');
    const [comment] = board.lists[0].cards[0].comments;
    expect(comment.text).toBe('Enviado ao cliente');
    board = editComment(board, id, comment.id, 'Enviado e confirmado');
    expect(board.lists[0].cards[0].comments[0]).toMatchObject({ text: 'Enviado e confirmado' });
    expect(board.lists[0].cards[0].comments[0].editedAt).toBeTruthy();
    board = removeComment(board, id, comment.id);
    expect(board.lists[0].cards[0].comments).toEqual([]);
  });
});

describe('dueState', () => {
  it('tells overdue, soon, later and done', () => {
    expect(dueState({ due: null, dueDone: false }, '2026-11-18')).toBeNull();
    expect(dueState({ due: '2026-11-17', dueDone: false }, '2026-11-18')).toBe('overdue');
    expect(dueState({ due: '2026-11-18', dueDone: false }, '2026-11-18')).toBe('soon');
    expect(dueState({ due: '2026-11-19', dueDone: false }, '2026-11-18')).toBe('soon');
    expect(dueState({ due: '2026-11-20', dueDone: false }, '2026-11-18')).toBe('later');
    expect(dueState({ due: '2026-11-17', dueDone: true }, '2026-11-18')).toBe('done');
  });
});

describe('matchesSearch', () => {
  it('finds by title, description, checklist and label, ignoring accents', () => {
    const board = sample();
    const card = { ...board.lists[0].cards[2], description: 'Guia do Simples', labelIds: [board.labels[0].id] };
    expect(matchesSearch(card, board.labels, 'tres')).toBe(true);
    expect(matchesSearch(card, board.labels, 'SIMPLES')).toBe(true);
    expect(matchesSearch(card, board.labels, 'urgente')).toBe(true);
    expect(matchesSearch(card, board.labels, 'folha')).toBe(false);
  });
});
