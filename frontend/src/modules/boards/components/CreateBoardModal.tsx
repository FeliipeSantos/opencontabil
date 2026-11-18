import { App, Form, Input, type InputRef, Modal } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { boardsApi } from '@/modules/boards/api';
import { ColorPicker } from '@/modules/boards/components/ColorPicker';
import { newBoard } from '@/modules/boards/model';
import { boardPath } from '@/modules/boards/paths';
import type { BoardColor } from '@/modules/boards/types';

/** "Criar quadro": name and color; the new board opens right after it is saved. */
export function CreateBoardModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [name, setName] = useState('');
  const [color, setColor] = useState<BoardColor>('blue');
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<InputRef>(null);

  // cada abertura começa vazia
  useEffect(() => {
    if (!open) return;
    setName('');
    setColor('blue');
    setSaving(false);
  }, [open]);

  async function create() {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const board = newBoard(name, color);
      await boardsApi.save(board);
      onClose();
      navigate(boardPath(board.id));
    } catch (error) {
      if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível criar o quadro: ${errorMessage(error)}`);
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Criar quadro"
      okText="Criar"
      cancelText="Cancelar"
      onOk={() => void create()}
      okButtonProps={{ disabled: !name.trim(), loading: saving }}
      onCancel={onClose}
      // o foco vai para o nome quando a janela termina de abrir (autoFocus não funciona dentro do Modal)
      afterOpenChange={(opened) => opened && nameRef.current?.focus()}
      destroyOnHidden
    >
      <Form layout="vertical" component="div">
        <Form.Item label="Nome do quadro" required>
          <Input ref={nameRef} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onPressEnter={() => void create()} placeholder="Ex.: Projetos" />
        </Form.Item>
        <Form.Item label="Cor">
          <ColorPicker value={color} onChange={setColor} label="Cor do quadro" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
