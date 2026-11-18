import { AlignLeftOutlined, CheckCircleFilled, CheckSquareOutlined, ClockCircleOutlined, EditOutlined, InboxOutlined, MessageOutlined } from '@ant-design/icons';
import { Tooltip } from 'antd';
import dayjs from 'dayjs';
import type { DragEvent, MouseEvent, ReactNode } from 'react';
import styled, { css } from 'styled-components';

import { LabelPill } from '@/modules/boards/components/LabelPill';
import { checklistProgress, type DueState, dueState } from '@/modules/boards/model';
import type { BoardCard, BoardLabel } from '@/modules/boards/types';
import { colors, fontSize, radius, shadows, tones } from '@/theme';

// o círculo de concluir e os botões do canto aparecem ao passar o mouse, como no Trello
const Tile = styled.div<{ $dragging: boolean; $completed: boolean }>`
  position: relative;
  padding: 8px 10px;
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  border-radius: ${radius.field}px;
  box-shadow: ${shadows.sm};
  cursor: pointer;
  user-select: none;
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  transition:
    border-color 0.12s ease,
    box-shadow 0.12s ease;

  &:hover,
  &:focus-within {
    border-color: ${colors.blue};
  }

  &:focus-visible {
    outline: 2px solid ${colors.blue};
    outline-offset: 1px;
  }

  /* círculo: escondido até passar o mouse (sempre visível quando concluído) */
  .card-done {
    width: ${({ $completed }) => ($completed ? '18px' : '0')};
    margin-right: ${({ $completed }) => ($completed ? '6px' : '0')};
    opacity: ${({ $completed }) => ($completed ? 1 : 0)};
  }

  &:hover .card-done,
  &:focus-within .card-done {
    width: 18px;
    margin-right: 6px;
    opacity: 1;
  }

  .card-actions {
    opacity: 0;
  }

  &:hover .card-actions,
  &:focus-within .card-actions {
    opacity: 1;
  }
`;

const Labels = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 6px;
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  padding-right: 52px;
`;

const Title = styled.div<{ $completed: boolean }>`
  flex: 1;
  min-width: 0;
  font-size: ${fontSize.support}px;
  line-height: 1.4;
  color: ${({ $completed }) => ($completed ? colors.textMuted : colors.textDark)};
  overflow-wrap: anywhere;
  white-space: pre-wrap;
`;

const DoneToggle = styled.button<{ $completed: boolean }>`
  flex-shrink: 0;
  height: 18px;
  margin-top: 1px;
  display: grid;
  place-items: center;
  padding: 0;
  overflow: hidden;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: ${tones.success.solid};
  font-size: 16px;
  cursor: pointer;
  /* sem animar a largura: o círculo já está no lugar quando o clique chega */
  transition: opacity 0.12s ease;

  /* aberto: só o contorno do círculo */
  ${({ $completed }) =>
    !$completed &&
    css`
      &::before {
        content: '';
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1.5px solid ${colors.textMuted};
      }

      &:hover::before {
        border-color: ${tones.success.solid};
      }
    `}
`;

const Actions = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  transition: opacity 0.12s ease;
`;

const ActionButton = styled.button`
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  padding: 0;
  border: 1px solid ${colors.border};
  border-radius: 50%;
  background: ${colors.bgSubtle};
  color: ${colors.textMuted};
  font-size: 12px;
  cursor: pointer;

  &:hover,
  &:focus-visible {
    color: ${colors.textDark};
    border-color: ${colors.borderStrong};
  }
`;

const Badges = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  font-size: 12px;
  color: ${colors.textMuted};

  &:empty {
    display: none;
  }
`;

const Badge = styled.span<{ $tone?: DueState | 'complete' }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: ${radius.badge}px;

  ${({ $tone }) =>
    ($tone === 'done' || $tone === 'complete') &&
    css`
      color: ${tones.success.fg};
      background: ${tones.success.bg};
    `}
  ${({ $tone }) =>
    $tone === 'overdue' &&
    css`
      color: ${tones.danger.fg};
      background: ${tones.danger.bg};
    `}
  ${({ $tone }) =>
    $tone === 'soon' &&
    css`
      color: ${tones.warning.fg};
      background: ${tones.warning.bg};
    `}
`;

const DUE_TITLES: Record<DueState, string> = {
  done: 'Prazo concluído',
  overdue: 'Prazo vencido',
  soon: 'Vence hoje ou amanhã',
  later: 'Prazo',
};

interface CardTileProps {
  card: BoardCard;
  labels: BoardLabel[];
  today: string;
  dragging: boolean;
  onOpen: () => void;
  /** Circle before the title: marks the card done or not, without opening it. */
  onToggleComplete: () => void;
  /** Archive (offered on done cards): the card leaves the list and goes to Itens arquivados. */
  onArchive: () => void;
  onDragStart: (event: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
}

// botões dentro do cartão: o clique não abre o cartão
const only = (action: () => void) => (event: MouseEvent) => {
  event.stopPropagation();
  action();
};

function Hint({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Tooltip title={title} mouseEnterDelay={0.3}>
      {children}
    </Tooltip>
  );
}

/** Card face, like Trello's: labels, done circle, title, quick buttons and badges (due date, description, comments, checklist). */
export function CardTile({ card, labels, today, dragging, onOpen, onToggleComplete, onArchive, onDragStart, onDragEnd, onDragOver }: CardTileProps) {
  const cardLabels = labels.filter((l) => card.labelIds.includes(l.id));
  const due = dueState(card, today);
  const checklist = checklistProgress(card);
  const doneLabel = card.completed ? 'Marcar como incompleto' : 'Marcar como concluído';
  return (
    <Tile
      role="button"
      tabIndex={0}
      draggable
      $dragging={dragging}
      $completed={card.completed}
      aria-label={`Cartão ${card.title}`}
      onClick={onOpen}
      onKeyDown={(e) => e.target === e.currentTarget && e.key === 'Enter' && onOpen()}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
    >
      {cardLabels.length > 0 && (
        <Labels>
          {cardLabels.map((label) => (
            <LabelPill key={label.id} $color={label.color} title={label.name}>
              {label.name}
            </LabelPill>
          ))}
        </Labels>
      )}
      <TitleRow>
        <Hint title={doneLabel}>
          <DoneToggle type="button" className="card-done" $completed={card.completed} aria-label={doneLabel} aria-pressed={card.completed} onClick={only(onToggleComplete)}>
            {card.completed && <CheckCircleFilled aria-hidden />}
          </DoneToggle>
        </Hint>
        <Title $completed={card.completed}>{card.title}</Title>
      </TitleRow>

      <Actions className="card-actions">
        {card.completed && (
          <Hint title="Arquivar">
            <ActionButton type="button" aria-label={`Arquivar o cartão ${card.title}`} onClick={only(onArchive)}>
              <InboxOutlined />
            </ActionButton>
          </Hint>
        )}
        <Hint title="Abrir cartão">
          <ActionButton type="button" aria-label={`Abrir o cartão ${card.title}`} onClick={only(onOpen)}>
            <EditOutlined />
          </ActionButton>
        </Hint>
      </Actions>

      <Badges>
        {due && card.due && (
          <Badge $tone={due} title={DUE_TITLES[due]}>
            <ClockCircleOutlined aria-hidden /> {dayjs(card.due).format('DD MMM')}
          </Badge>
        )}
        {card.description.trim() && (
          <Badge title="Este cartão tem descrição">
            <AlignLeftOutlined aria-label="Tem descrição" />
          </Badge>
        )}
        {card.comments.length > 0 && (
          <Badge title="Comentários">
            <MessageOutlined aria-hidden /> {card.comments.length}
          </Badge>
        )}
        {checklist && (
          <Badge $tone={checklist.done === checklist.total ? 'complete' : undefined} title="Checklist">
            <CheckSquareOutlined aria-hidden /> {checklist.done}/{checklist.total}
          </Badge>
        )}
      </Badges>
    </Tile>
  );
}
