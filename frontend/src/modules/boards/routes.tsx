import type { RouteObject } from 'react-router-dom';

import { lazyRoute } from '@/core/layout/lazyRoute';

export const boardsRoutes: RouteObject[] = [
  lazyRoute('quadros', () => import('@/modules/boards/pages/BoardsPage').then((m) => m.BoardsPage)),
  lazyRoute('quadros/:boardId', () => import('@/modules/boards/pages/BoardPage').then((m) => m.BoardPage)),
];
