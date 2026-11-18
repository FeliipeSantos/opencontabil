/** Shapes of the Quadros module (see docs/api-contract.md, /api/boards). */
import type { IconTone } from '@/theme';

/** Colors of boards and labels: the six tones of the theme. */
export type BoardColor = IconTone;

export interface BoardLabel {
  id: string;
  name: string;
  color: BoardColor;
}

export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface BoardComment {
  id: string;
  /** Name shown for whoever wrote it. */
  author: string;
  text: string;
  createdAt: string;
  editedAt?: string | null;
}

/** Event of the card history ("adicionou este cartão a A fazer", "moveu este cartão..."). */
export interface CardActivity {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface BoardCard {
  id: string;
  title: string;
  description: string;
  labelIds: string[];
  /** Due date (YYYY-MM-DD) or null. */
  due: string | null;
  /** Due date marked as done. */
  dueDone: boolean;
  checklist: ChecklistItem[];
  /** Marked done with the circle next to the title. */
  completed: boolean;
  /** Archived: out of the list, kept in Itens arquivados. */
  archived: boolean;
  comments: BoardComment[];
  activity: CardActivity[];
  createdAt: string | null;
}

export interface BoardList {
  id: string;
  title: string;
  cards: BoardCard[];
}

export interface Board {
  id: string;
  name: string;
  color: BoardColor;
  labels: BoardLabel[];
  lists: BoardList[];
  createdAt: string | null;
}

/** One board in the list of boards (counts only). */
export interface BoardSummary {
  id: string;
  name: string;
  color: BoardColor;
  lists: number;
  cards: number;
  updatedAt: string;
}
