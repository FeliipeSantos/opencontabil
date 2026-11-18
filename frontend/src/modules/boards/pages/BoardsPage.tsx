import { PlusOutlined } from '@ant-design/icons';
import { LayoutDashboard } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { useLoad } from '@/core/hooks/useLoad';
import { Page } from '@/core/layout/Page';
import { ErrorState, LoadingState } from '@/core/ui';
import { boardsApi } from '@/modules/boards/api';
import { CreateBoardModal } from '@/modules/boards/components/CreateBoardModal';
import { boardPath } from '@/modules/boards/paths';
import type { BoardColor, BoardSummary } from '@/modules/boards/types';
import { colors, fontSize, iconTones, radius, shadows } from '@/theme';

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 16px;
`;

// quadro na lista: faixa colorida em cima, nome e contagens embaixo
const Tile = styled.button<{ $color: BoardColor }>`
  display: flex;
  flex-direction: column;
  min-height: 116px;
  padding: 0;
  overflow: hidden;
  text-align: left;
  font: inherit;
  color: ${colors.textDark};
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow: ${shadows.sm};
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease,
    transform 0.15s ease;

  &::before {
    content: '';
    height: 44px;
    background: ${({ $color }) => iconTones[$color].fg};
    opacity: 0.85;
  }

  &:hover {
    border-color: ${colors.borderStrong};
    box-shadow: ${shadows.md};
    transform: translateY(-1px);
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 2px;
  }

  strong {
    padding: 12px 14px 2px;
    font-size: ${fontSize.cardTitle}px;
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    padding: 0 14px 12px;
    font-size: 12.5px;
    color: ${colors.textMuted};
  }
`;

const NewTile = styled.button`
  min-height: 116px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font: inherit;
  font-weight: 500;
  color: ${colors.textMuted};
  background: ${colors.bgSubtle};
  border: 1px dashed ${colors.borderStrong};
  border-radius: ${radius.card}px;
  cursor: pointer;

  &:hover {
    color: ${colors.blue};
    border-color: ${colors.blue};
  }
`;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Controle > Quadros: the boards, like Trello's home; a click opens the board. */
export function BoardsPage() {
  const navigate = useNavigate();
  const state = useLoad(() => boardsApi.list(), []);
  const [creating, setCreating] = useState(false);
  const openCreate = () => setCreating(true);

  return (
    <Page
      icon={<LayoutDashboard size="1em" />}
      title="Quadros"
      description="Organize tarefas em listas e cartões, no estilo Kanban: arraste os cartões conforme o trabalho anda."
    >
      {state.error ? (
        <ErrorState message={state.error} onRetry={state.reload} />
      ) : !state.data ? (
        <LoadingState rows={3} />
      ) : (
        <Grid>
          {state.data.map((board: BoardSummary) => (
            <Tile key={board.id} type="button" $color={board.color} onClick={() => navigate(boardPath(board.id))}>
              <strong title={board.name}>{board.name}</strong>
              <span>
                {count(board.lists, 'lista', 'listas')} · {count(board.cards, 'cartão', 'cartões')}
              </span>
            </Tile>
          ))}
          <NewTile type="button" onClick={openCreate}>
            <PlusOutlined /> Criar novo quadro
          </NewTile>
        </Grid>
      )}

      <CreateBoardModal open={creating} onClose={() => setCreating(false)} />
    </Page>
  );
}
