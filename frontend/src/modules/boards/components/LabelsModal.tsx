import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Input, Modal } from 'antd';
import styled from 'styled-components';

import { ColorPicker } from '@/modules/boards/components/ColorPicker';
import { addLabel, removeLabel, updateLabel } from '@/modules/boards/model';
import type { Board } from '@/modules/boards/types';
import { colors, radius } from '@/theme';

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid ${colors.border};
  border-radius: ${radius.field}px;

  & + & {
    margin-top: 8px;
  }
`;

const AddLabel = styled(Button)`
  margin-top: 12px;
`;

const Hint = styled.p`
  margin: 0 0 12px;
  font-size: 12.5px;
  color: ${colors.textMuted};
`;

/** Labels of the board: name and color; removing one takes it out of every card. */
export function LabelsModal({ board, open, onChange, onClose }: { board: Board; open: boolean; onChange: (board: Board) => void; onClose: () => void }) {
  return (
    <Modal open={open} title="Etiquetas do quadro" onCancel={onClose} footer={<Button onClick={onClose}>Fechar</Button>} width={520}>
      <Hint>As etiquetas marcam os cartões por cor (ex.: Urgente, Cliente, Fiscal). Excluir uma etiqueta a tira de todos os cartões.</Hint>
      {board.labels.map((label) => (
        <Row key={label.id}>
          <Flex gap={6}>
            <Input
              size="small"
              defaultValue={label.name}
              maxLength={60}
              placeholder="Nome da etiqueta"
              aria-label="Nome da etiqueta"
              onBlur={(e) => e.target.value.trim() !== label.name && onChange(updateLabel(board, label.id, { name: e.target.value }))}
              onPressEnter={(e) => e.currentTarget.blur()}
            />
            <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Excluir etiqueta ${label.name}`} onClick={() => onChange(removeLabel(board, label.id))} />
          </Flex>
          <ColorPicker value={label.color} onChange={(color) => onChange(updateLabel(board, label.id, { color }))} label={`Cor da etiqueta ${label.name}`} />
        </Row>
      ))}
      <AddLabel type="dashed" block icon={<PlusOutlined />} onClick={() => onChange(addLabel(board, 'Nova etiqueta', 'blue'))}>
        Criar etiqueta
      </AddLabel>
    </Modal>
  );
}
