import { CloseOutlined, DeleteOutlined, MoreOutlined, PlusOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Input } from 'antd';
import { type DragEvent, Fragment, useState } from 'react';
import styled from 'styled-components';

import { CardTile } from '@/modules/boards/components/CardTile';
import type { BoardCard, BoardColor, BoardLabel, BoardList } from '@/modules/boards/types';
import { colors, fontSize, iconTones, radius, shadows } from '@/theme';

export const LIST_WIDTH = 280;

const Column = styled.section<{ $dragging: boolean; $dropBefore: boolean; $accent: BoardColor }>`
  flex: 0 0 ${LIST_WIDTH}px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  /* lista como os cartões da plataforma, com a cor do quadro numa faixa em cima */
  background: ${colors.bgSubtle};
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  box-shadow:
    inset 0 3px 0 ${({ $accent }) => iconTones[$accent].fg},
    ${shadows.sm};
  opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
  outline: ${({ $dropBefore }) => ($dropBefore ? `3px solid ${colors.blue}` : 'none')};
  outline-offset: 3px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 4px 12px;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
`;

const TitleButton = styled.button`
  flex: 1;
  min-width: 0;
  padding: 4px 0;
  border: none;
  background: transparent;
  text-align: left;
  font: inherit;
  font-size: ${fontSize.support}px;
  font-weight: 600;
  color: ${colors.textDark};
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Count = styled.span`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const Cards = styled.div`
  flex: 1;
  min-height: 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 8px;
`;

// marca onde o cartão arrastado vai cair
const DropLine = styled.div`
  height: 3px;
  margin: -5px 0;
  border-radius: 2px;
  background: ${colors.blue};
`;

const Footer = styled.div`
  padding: 4px 8px 8px;
`;

const AddButton = styled(Button)`
  &&& {
    width: 100%;
    justify-content: flex-start;
    color: ${colors.textMuted};
  }
`;

const Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

interface ListColumnProps {
  list: BoardList;
  /** Color of the board (strip on top of the list). */
  accent: BoardColor;
  /** Cards shown (all, or the ones matching the search). */
  cards: BoardCard[];
  labels: BoardLabel[];
  today: string;
  draggingCardId: string | null;
  /** Index where the dragged card would land in this list (null: not over this list). */
  dropIndex: number | null;
  dragging: boolean;
  dropBefore: boolean;
  onOpenCard: (cardId: string) => void;
  onToggleComplete: (card: BoardCard) => void;
  onArchiveCard: (cardId: string) => void;
  onRename: (title: string) => void;
  onRemove: () => void;
  onAddCard: (title: string) => void;
  onCardDragStart: (cardId: string, event: DragEvent) => void;
  onCardDragEnd: () => void;
  /** Mouse over the list while dragging a card: index under the mouse. */
  onCardDragOver: (index: number, event: DragEvent) => void;
  onCardDrop: (event: DragEvent) => void;
  onListDragStart: (event: DragEvent) => void;
  onListDragEnd: () => void;
  onListDragOver: (event: DragEvent) => void;
  onListDrop: (event: DragEvent) => void;
}

/** One list of the board: title (rename, delete, drag), its cards and "Adicionar um cartão". */
export function ListColumn(props: ListColumnProps) {
  const { list, cards, labels, today, draggingCardId, dropIndex } = props;
  const { modal } = App.useApp();
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(list.title);
  const [composing, setComposing] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  function saveTitle() {
    setEditingTitle(false);
    if (title.trim() && title.trim() !== list.title) props.onRename(title);
    else setTitle(list.title);
  }

  function addCard() {
    if (!newTitle.trim()) return;
    props.onAddCard(newTitle);
    setNewTitle('');
  }

  function confirmRemove() {
    if (!list.cards.length) {
      props.onRemove();
      return;
    }
    modal.confirm({
      title: 'Excluir lista',
      content: `A lista "${list.title}" e os ${list.cards.length} cartões dela serão excluídos.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: props.onRemove,
    });
  }

  // posição do mouse em relação ao meio do cartão: antes ou depois dele
  const overCard = (index: number) => (event: DragEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    props.onCardDragOver(event.clientY < rect.top + rect.height / 2 ? index : index + 1, event);
  };

  return (
    <Column
      aria-label={`Lista ${list.title}`}
      $dragging={props.dragging}
      $dropBefore={props.dropBefore}
      $accent={props.accent}
      onDragOver={(event) => {
        props.onListDragOver(event);
        // fora de um cartão: o cartão cai no fim da lista
        if (event.target === event.currentTarget || (event.target as HTMLElement).dataset.listArea) props.onCardDragOver(list.cards.length, event);
      }}
      onDrop={(event) => {
        props.onListDrop(event);
        props.onCardDrop(event);
      }}
    >
      <Header draggable={!editingTitle} onDragStart={props.onListDragStart} onDragEnd={props.onListDragEnd} data-list-area="1">
        {editingTitle ? (
          <Input size="small" autoFocus value={title} maxLength={200} onChange={(e) => setTitle(e.target.value)} onBlur={saveTitle} onPressEnter={saveTitle} />
        ) : (
          <TitleButton type="button" title="Clique para renomear" onClick={() => setEditingTitle(true)}>
            {list.title}
          </TitleButton>
        )}
        <Count>{list.cards.filter((c) => !c.archived).length}</Count>
        <Dropdown trigger={['click']} menu={{ items: [{ key: 'delete', icon: <DeleteOutlined />, label: 'Excluir lista', danger: true, onClick: confirmRemove }] }}>
          <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`Ações da lista ${list.title}`} />
        </Dropdown>
      </Header>

      {/* com cartões, o espaço entre eles mantém a última posição (não pula para o fim) */}
      <Cards data-list-area={cards.length ? undefined : '1'}>
        {cards.map((card) => {
          // posição real na lista (com busca, alguns cartões ficam escondidos)
          const index = list.cards.indexOf(card);
          return (
            <Fragment key={card.id}>
              {dropIndex === index && <DropLine aria-hidden />}
              <CardTile
                card={card}
                labels={labels}
                today={today}
                dragging={draggingCardId === card.id}
                onOpen={() => props.onOpenCard(card.id)}
                onToggleComplete={() => props.onToggleComplete(card)}
                onArchive={() => props.onArchiveCard(card.id)}
                onDragStart={(event) => props.onCardDragStart(card.id, event)}
                onDragEnd={props.onCardDragEnd}
                onDragOver={overCard(index)}
              />
            </Fragment>
          );
        })}
        {dropIndex !== null && dropIndex >= list.cards.length && <DropLine aria-hidden />}
      </Cards>

      <Footer data-list-area="1">
        {composing ? (
          <Composer>
            <Input.TextArea
              autoFocus
              autoSize={{ minRows: 2, maxRows: 6 }}
              maxLength={500}
              placeholder="Insira um título para este cartão..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onPressEnter={(e) => {
                e.preventDefault();
                addCard();
              }}
              onKeyDown={(e) => e.key === 'Escape' && setComposing(false)}
            />
            <div>
              <Button type="primary" size="small" onClick={addCard} disabled={!newTitle.trim()}>
                Adicionar cartão
              </Button>{' '}
              <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Fechar" onClick={() => setComposing(false)} />
            </div>
          </Composer>
        ) : (
          <AddButton type="text" icon={<PlusOutlined />} onClick={() => setComposing(true)}>
            Adicionar um cartão
          </AddButton>
        )}
      </Footer>
    </Column>
  );
}
