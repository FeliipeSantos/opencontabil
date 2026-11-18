import { apiRequest } from '@/core/api/client';
import { normalizeBoard } from '@/modules/boards/model';
import type { Board, BoardSummary } from '@/modules/boards/types';

const BASE = '/api/boards';

export const boardsApi = {
  list: () => apiRequest<BoardSummary[]>(BASE),
  get: (id: string) => apiRequest<Board>(`${BASE}/${encodeURIComponent(id)}`).then(normalizeBoard),
  /** Saves the whole board (creates it the first time). */
  save: (board: Board) => apiRequest<{ id: string; result: 'created' | 'updated'; updatedAt: string }>(`${BASE}/${encodeURIComponent(board.id)}`, { method: 'PUT', body: board }),
  remove: (id: string) => apiRequest(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
