/**
 * Rules of the Quadros module, as pure functions: every change returns a new board and
 * never touches the given one.
 */
import type { Board, BoardCard, BoardColor, BoardLabel, BoardList, CardActivity, ChecklistItem } from '@/modules/boards/types';

export const BOARD_COLORS: BoardColor[] = ['blue', 'green', 'orange', 'purple', 'red', 'gray'];

export const COLOR_NAMES: Record<BoardColor, string> = {
  blue: 'Azul',
  green: 'Verde',
  orange: 'Laranja',
  purple: 'Roxo',
  red: 'Vermelho',
  gray: 'Cinza',
};

/** Short random id (letters and digits), unique enough inside one board. */
export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function update(board: Board, change: (draft: Board) => void): Board {
  const draft = structuredClone(board);
  change(draft);
  return draft;
}

/** New board with the three usual lists of a Kanban (like Trello's first board). */
export function newBoard(name: string, color: BoardColor = 'blue'): Board {
  return {
    id: newId('board-'),
    name: name.trim(),
    color,
    labels: [
      { id: newId('l'), name: 'Urgente', color: 'red' },
      { id: newId('l'), name: 'Importante', color: 'orange' },
      { id: newId('l'), name: 'Aguardando', color: 'purple' },
    ],
    lists: [
      { id: newId('list-'), title: 'A fazer', cards: [] },
      { id: newId('list-'), title: 'Em andamento', cards: [] },
      { id: newId('list-'), title: 'Concluído', cards: [] },
    ],
    createdAt: new Date().toISOString(),
  };
}

/** Fills fields missing in boards saved by older versions. */
export function normalizeBoard(board: Board): Board {
  return update(board, (b) => {
    b.color ??= 'blue';
    b.labels ??= [];
    b.lists ??= [];
    b.lists.forEach((list) => {
      list.cards ??= [];
      list.cards.forEach((card) => {
        card.description ??= '';
        card.labelIds ??= [];
        card.due ??= null;
        card.dueDone ??= false;
        card.checklist ??= [];
        card.completed ??= false;
        card.archived ??= false;
        card.comments ??= [];
        card.activity ??= [];
        card.createdAt ??= null;
      });
    });
  });
}

export function setBoardName(board: Board, name: string): Board {
  return update(board, (b) => {
    if (name.trim()) b.name = name.trim();
  });
}

export function setBoardColor(board: Board, color: BoardColor): Board {
  return update(board, (b) => {
    b.color = color;
  });
}

// ---------- lists ----------

export function addList(board: Board, title: string): Board {
  return update(board, (b) => {
    if (title.trim()) b.lists.push({ id: newId('list-'), title: title.trim(), cards: [] });
  });
}

export function renameList(board: Board, listId: string, title: string): Board {
  return update(board, (b) => {
    const list = b.lists.find((l) => l.id === listId);
    if (list && title.trim()) list.title = title.trim();
  });
}

export function removeList(board: Board, listId: string): Board {
  return update(board, (b) => {
    b.lists = b.lists.filter((l) => l.id !== listId);
  });
}

/** Moves a list to the position of another (drag and drop); dropping on itself does nothing. */
export function moveList(board: Board, listId: string, targetIndex: number): Board {
  return update(board, (b) => {
    const from = b.lists.findIndex((l) => l.id === listId);
    if (from === -1) return;
    const to = Math.max(0, Math.min(targetIndex, b.lists.length - 1));
    if (from === to) return;
    const [moved] = b.lists.splice(from, 1);
    b.lists.splice(to, 0, moved);
  });
}

// ---------- cards ----------

export function newCard(title: string): BoardCard {
  return {
    id: newId('card-'),
    title: title.trim(),
    description: '',
    labelIds: [],
    due: null,
    dueDone: false,
    checklist: [],
    completed: false,
    archived: false,
    comments: [],
    activity: [],
    createdAt: new Date().toISOString(),
  };
}

// histórico do cartão: guarda os 200 eventos mais recentes
const MAX_ACTIVITY = 200;

function logActivity(card: BoardCard, author: string, text: string): void {
  const event: CardActivity = { id: newId('a'), author, text, createdAt: new Date().toISOString() };
  card.activity = [...card.activity, event].slice(-MAX_ACTIVITY);
}

export function addCard(board: Board, listId: string, title: string, author = ''): Board {
  return update(board, (b) => {
    const list = b.lists.find((l) => l.id === listId);
    if (!list || !title.trim()) return;
    const card = newCard(title);
    logActivity(card, author, `adicionou este cartão a ${list.title}`);
    list.cards.push(card);
  });
}

/** Where a card is: its list and index (null when it no longer exists). */
export function findCard(board: Board, cardId: string): { list: BoardList; index: number; card: BoardCard } | null {
  for (const list of board.lists) {
    const index = list.cards.findIndex((c) => c.id === cardId);
    if (index !== -1) return { list, index, card: list.cards[index] };
  }
  return null;
}

/** Applies a change to one card (title, description, labels, due date, checklist). */
export function updateCard(board: Board, cardId: string, change: (card: BoardCard) => void): Board {
  return update(board, (b) => {
    const found = findCard(b, cardId);
    if (found) change(found.card);
  });
}

export function removeCard(board: Board, cardId: string): Board {
  return update(board, (b) => {
    const found = findCard(b, cardId);
    if (found) found.list.cards.splice(found.index, 1);
  });
}

/**
 * Moves a card to a list, at an index of that list (drag and drop). The index is where the
 * card ends up; moving down inside the same list accounts for the card leaving its place.
 */
export function moveCard(board: Board, cardId: string, toListId: string, toIndex: number, author = ''): Board {
  return update(board, (b) => {
    const found = findCard(b, cardId);
    const target = b.lists.find((l) => l.id === toListId);
    if (!found || !target) return;
    let index = Math.max(0, Math.min(toIndex, target.cards.length));
    if (found.list.id === target.id && found.index < index) index -= 1;
    if (found.list.id === target.id && found.index === index) return;
    const [card] = found.list.cards.splice(found.index, 1);
    if (found.list.id !== target.id) logActivity(card, author, `moveu este cartão de ${found.list.title} para ${target.title}`);
    target.cards.splice(index, 0, card);
  });
}

/** Done mark of the card (the circle next to the title), recorded in the history. */
export function setCardCompleted(board: Board, cardId: string, completed: boolean, author = ''): Board {
  return updateCard(board, cardId, (card) => {
    if (card.completed === completed) return;
    card.completed = completed;
    logActivity(card, author, completed ? 'marcou este cartão como concluído' : 'marcou este cartão como não concluído');
  });
}

/** Archives a card (out of the list, kept in Itens arquivados) or brings it back. */
export function setCardArchived(board: Board, cardId: string, archived: boolean, author = ''): Board {
  return updateCard(board, cardId, (card) => {
    if (card.archived === archived) return;
    card.archived = archived;
    logActivity(card, author, archived ? 'arquivou este cartão' : 'restaurou este cartão');
  });
}

/** Archived cards of the board, with the list each one belongs to. */
export function archivedCards(board: Board): { card: BoardCard; list: BoardList }[] {
  return board.lists.flatMap((list) => list.cards.filter((card) => card.archived).map((card) => ({ card, list })));
}

// ---------- comments ----------

export function addComment(board: Board, cardId: string, author: string, text: string): Board {
  return updateCard(board, cardId, (card) => {
    if (text.trim()) card.comments.push({ id: newId('m'), author, text: text.trim(), createdAt: new Date().toISOString() });
  });
}

export function editComment(board: Board, cardId: string, commentId: string, text: string): Board {
  return updateCard(board, cardId, (card) => {
    const comment = card.comments.find((c) => c.id === commentId);
    if (!comment || !text.trim() || text.trim() === comment.text) return;
    comment.text = text.trim();
    comment.editedAt = new Date().toISOString();
  });
}

export function removeComment(board: Board, cardId: string, commentId: string): Board {
  return updateCard(board, cardId, (card) => {
    card.comments = card.comments.filter((c) => c.id !== commentId);
  });
}

// ---------- labels ----------

export function addLabel(board: Board, name: string, color: BoardColor): Board {
  return update(board, (b) => {
    b.labels.push({ id: newId('l'), name: name.trim(), color });
  });
}

export function updateLabel(board: Board, labelId: string, changes: Partial<Pick<BoardLabel, 'name' | 'color'>>): Board {
  return update(board, (b) => {
    const label = b.labels.find((l) => l.id === labelId);
    if (!label) return;
    if (changes.name !== undefined) label.name = changes.name.trim();
    if (changes.color) label.color = changes.color;
  });
}

/** Removes a label from the board and from every card that had it. */
export function removeLabel(board: Board, labelId: string): Board {
  return update(board, (b) => {
    b.labels = b.labels.filter((l) => l.id !== labelId);
    b.lists.forEach((list) => list.cards.forEach((card) => (card.labelIds = card.labelIds.filter((id) => id !== labelId))));
  });
}

export function toggleCardLabel(board: Board, cardId: string, labelId: string): Board {
  return updateCard(board, cardId, (card) => {
    card.labelIds = card.labelIds.includes(labelId) ? card.labelIds.filter((id) => id !== labelId) : [...card.labelIds, labelId];
  });
}

// ---------- checklist ----------

export function newChecklistItem(text: string): ChecklistItem {
  return { id: newId('k'), text: text.trim(), done: false };
}

/** Done and total items of a checklist (null without items). */
export function checklistProgress(card: Pick<BoardCard, 'checklist'>): { done: number; total: number } | null {
  if (!card.checklist.length) return null;
  return { done: card.checklist.filter((item) => item.done).length, total: card.checklist.length };
}

// ---------- due dates ----------

export type DueState = 'done' | 'overdue' | 'soon' | 'later';

/** Situation of a due date on the given day (YYYY-MM-DD): soon is today or tomorrow. */
export function dueState(card: Pick<BoardCard, 'due' | 'dueDone'>, today: string): DueState | null {
  if (!card.due) return null;
  if (card.dueDone) return 'done';
  if (card.due < today) return 'overdue';
  const tomorrow = new Date(`${today}T12:00:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  return card.due <= tomorrowIso ? 'soon' : 'later';
}

/** Cards matching a text (title, description or checklist), case and accents ignored. */
export function matchesSearch(card: BoardCard, labels: BoardLabel[], text: string): boolean {
  const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const query = normalize(text.trim());
  if (!query) return true;
  const labelNames = labels.filter((l) => card.labelIds.includes(l.id)).map((l) => l.name);
  return [card.title, card.description, ...card.checklist.map((i) => i.text), ...labelNames].some((value) => normalize(value).includes(query));
}
