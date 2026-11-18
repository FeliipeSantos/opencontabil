import { DeleteOutlined, UndoOutlined } from '@ant-design/icons';
import { App, Button, Empty, Modal } from 'antd';
import styled from 'styled-components';

import { archivedCards, removeCard, setCardArchived } from '@/modules/boards/model';
import type { Board } from '@/modules/boards/types';
import { colors, fontSize, radius } from '@/theme';

const Item = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.field}px;
  background: ${colors.bgSubtle};

  & + & {
    margin-top: 8px;
  }
`;

const Texts = styled.div`
  flex: 1;
  min-width: 0;

  strong {
    display: block;
    font-size: ${fontSize.support}px;
    font-weight: 500;
    color: ${colors.textDark};
    overflow-wrap: anywhere;
  }

  span {
    font-size: 12px;
    color: ${colors.textMuted};
  }
`;

/** Itens arquivados: cards taken out of the lists, which can come back or be deleted for good. */
export function ArchivedModal({ board, open, author, onChange, onClose }: { board: Board; open: boolean; author: string; onChange: (board: Board) => void; onClose: () => void }) {
  const { modal } = App.useApp();
  const items = archivedCards(board);

  function confirmDelete(cardId: string, title: string) {
    modal.confirm({
      title: 'Excluir cartão',
      content: `O cartão "${title}" será excluído de vez. Não é possível desfazer.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => onChange(removeCard(board, cardId)),
    });
  }

  return (
    <Modal open={open} title="Itens arquivados" onCancel={onClose} footer={<Button onClick={onClose}>Fechar</Button>} width={560}>
      {items.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nenhum cartão arquivado." />}
      {items.map(({ card, list }) => (
        <Item key={card.id}>
          <Texts>
            <strong>{card.title}</strong>
            <span>na lista {list.title}</span>
          </Texts>
          <Button size="small" icon={<UndoOutlined />} onClick={() => onChange(setCardArchived(board, card.id, false, author))}>
            Restaurar
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />} aria-label={`Excluir o cartão ${card.title}`} onClick={() => confirmDelete(card.id, card.title)} />
        </Item>
      ))}
    </Modal>
  );
}
