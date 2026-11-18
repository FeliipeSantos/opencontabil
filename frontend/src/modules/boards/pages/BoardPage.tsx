import { BgColorsOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, InboxOutlined, LoadingOutlined, MoreOutlined, PlusOutlined, SearchOutlined, TagsOutlined, WarningOutlined } from '@ant-design/icons';
import { App, Button, Dropdown, Flex, Input, Popover, Result, Typography } from 'antd';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { ApiError, errorMessage, SessionExpiredError } from '@/core/api/client';
import { useAuth } from '@/core/auth/authContext';
import { displayName } from '@/core/auth/profile';
import { Page } from '@/core/layout/Page';
import { ErrorState, LoadingState } from '@/core/ui';
import { boardsApi } from '@/modules/boards/api';
import { ArchivedModal } from '@/modules/boards/components/ArchivedModal';
import { CardModal } from '@/modules/boards/components/CardModal';
import { ColorPicker } from '@/modules/boards/components/ColorPicker';
import { LabelsModal } from '@/modules/boards/components/LabelsModal';
import { LIST_WIDTH, ListColumn } from '@/modules/boards/components/ListColumn';
import {
  addCard,
  addList,
  matchesSearch,
  moveCard,
  moveList,
  removeList,
  renameList,
  setBoardColor,
  setBoardName,
  setCardArchived,
  setCardCompleted,
} from '@/modules/boards/model';
import { BOARDS_PATH } from '@/modules/boards/paths';
import type { Board } from '@/modules/boards/types';
import { colors, GLOBAL_HEADER_HEIGHT, radius } from '@/theme';

// espera depois da última mudança antes de salvar (várias mudanças seguidas viram um salvamento)
const SAVE_DELAY_MS = 600;

// nome no título da página, renomeável pelo lápis
const BoardName = styled(Typography.Text)`
  &&& {
    font-size: inherit;
    font-weight: inherit;
    color: inherit;
  }
`;

const SearchBox = styled(Input)`
  width: 240px;
`;

const SaveStatus = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  color: ${colors.textMuted};
  white-space: nowrap;
`;

// as listas lado a lado, rolando de lado dentro da página; cada lista rola por dentro quando enche
// as listas passam da largura máxima da página (até 1640px, centralizadas, com folga nas bordas) e descem até o rodapé
const Canvas = styled.div`
  height: calc(100vh - ${GLOBAL_HEADER_HEIGHT}px - 122px);
  min-height: 420px;
  margin: 0 calc(50% - min(50vw - 24px, 820px)) -28px;
  padding: 0 0 12px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  overflow-x: auto;
  overflow-y: hidden;

  @media (max-width: 768px) {
    margin: 0 calc(50% - 50vw + 16px) -28px;
  }
`;

const AddListBox = styled.div<{ $dropBefore: boolean }>`
  flex: 0 0 ${LIST_WIDTH}px;
  padding: 6px;
  border-radius: ${radius.card}px;
  border: 1px dashed ${colors.borderStrong};
  background: ${colors.bgSubtle};
  outline: ${({ $dropBefore }) => ($dropBefore ? `3px solid ${colors.blue}` : 'none')};
  outline-offset: 3px;

  .ant-btn-text {
    color: ${colors.textMuted};
  }

  .ant-btn-text:hover {
    color: ${colors.blue};
  }
`;

const Composer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 4px;
`;

type SaveState = 'saved' | 'pending' | 'saving' | 'error';
type Drag = { kind: 'card' | 'list'; id: string } | null;

/** One board: lists side by side, cards dragged between them, details in a window. */
export function BoardPage() {
  const { boardId = '' } = useParams();
  const navigate = useNavigate();
  const { message, modal } = App.useApp();
  // nome de quem age, para o histórico dos cartões
  const { session, profile } = useAuth();
  const me = profile ? displayName(profile) : session.status === 'authenticated' ? session.user : '';
  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [newListTitle, setNewListTitle] = useState('');
  const [drag, setDrag] = useState<Drag>(null);
  const [cardDrop, setCardDrop] = useState<{ listId: string; index: number } | null>(null);
  const [listDrop, setListDrop] = useState<number | null>(null);
  const today = useMemo(() => new Date().toLocaleDateString('sv-SE'), []);

  // salvamento: a última versão espera um pouco e os envios saem um de cada vez, na ordem
  const pending = useRef<Board | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    let active = true;
    // outro quadro: começa do zero (sem o erro ou o quadro anterior)
    setLoadError(null);
    setMissing(false);
    setBoard(null);
    boardsApi
      .get(boardId)
      .then((loaded) => active && setBoard(loaded))
      .catch((error) => {
        if (!active || error instanceof SessionExpiredError) return;
        if (error instanceof ApiError && error.status === 404) setMissing(true);
        else setLoadError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [boardId, attempt]);

  const flush = useCallback(() => {
    window.clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return queue.current;
    pending.current = null;
    setSaveState('saving');
    queue.current = queue.current.then(() =>
      boardsApi
        .save(next)
        .then(() => setSaveState(pending.current ? 'pending' : 'saved'))
        .catch((error) => {
          // mantém a versão para tentar de novo na próxima mudança
          pending.current ??= next;
          setSaveState('error');
          if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível salvar o quadro: ${errorMessage(error)}`);
        }),
    );
    return queue.current;
  }, [message]);

  // ao sair da tela, o que falta salvar vai na hora; fechar a aba com algo pendente pede confirmação
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (pending.current) {
        void flush();
        event.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      void flush();
    };
  }, [flush]);

  const change = useCallback(
    (next: Board) => {
      setBoard(next);
      pending.current = next;
      setSaveState('pending');
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  if (missing) {
    return (
      <Page title="Quadro" onBack={() => navigate(BOARDS_PATH)} backLabel="Voltar aos quadros">
        <Result status="404" title="Quadro não encontrado" subTitle="Ele pode ter sido excluído." extra={<Button onClick={() => navigate(BOARDS_PATH)}>Ver os quadros</Button>} />
      </Page>
    );
  }
  if (loadError) {
    return (
      <Page title="Quadro" onBack={() => navigate(BOARDS_PATH)} backLabel="Voltar aos quadros">
        <ErrorState message={loadError} onRetry={() => setAttempt((n) => n + 1)} />
      </Page>
    );
  }
  if (!board) {
    return (
      <Page title="Quadro" onBack={() => navigate(BOARDS_PATH)} backLabel="Voltar aos quadros">
        <LoadingState rows={6} />
      </Page>
    );
  }

  const current = board;
  const searching = search.trim().length > 0;
  const shownCards = (listId: string) => {
    const list = current.lists.find((l) => l.id === listId)!;
    // arquivados ficam fora das listas (estão em Itens arquivados)
    const visible = list.cards.filter((card) => !card.archived);
    return searching ? visible.filter((card) => matchesSearch(card, current.labels, search)) : visible;
  };

  function endDrag() {
    setDrag(null);
    setCardDrop(null);
    setListDrop(null);
  }

  function dropCard() {
    if (drag?.kind === 'card' && cardDrop) change(moveCard(current, drag.id, cardDrop.listId, cardDrop.index, me));
    endDrag();
  }

  function dropList() {
    if (drag?.kind === 'list' && listDrop !== null) {
      const from = current.lists.findIndex((l) => l.id === drag.id);
      const to = listDrop > from ? listDrop - 1 : listDrop;
      change(moveList(current, drag.id, to));
    }
    endDrag();
  }

  function confirmDeleteBoard() {
    modal.confirm({
      title: 'Excluir quadro',
      content: `O quadro "${current.name}" e todos os cartões dele serão excluídos. Não é possível desfazer.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: async () => {
        window.clearTimeout(timer.current);
        pending.current = null;
        try {
          await boardsApi.remove(current.id);
          navigate(BOARDS_PATH);
        } catch (error) {
          if (!(error instanceof SessionExpiredError)) message.error(`Não foi possível excluir: ${errorMessage(error)}`);
        }
      },
    });
  }

  function addNewList() {
    if (!newListTitle.trim()) return;
    change(addList(current, newListTitle));
    setNewListTitle('');
  }

  const status = {
    saved: { icon: <CheckOutlined />, text: 'Salvo' },
    pending: { icon: <LoadingOutlined />, text: 'Salvando...' },
    saving: { icon: <LoadingOutlined />, text: 'Salvando...' },
    error: { icon: <WarningOutlined />, text: 'Não salvo' },
  }[saveState];

  return (
    <Page
      onBack={() => navigate(BOARDS_PATH)}
      // linha abaixo do nome, como no editor de projetos
      stickyHeader
      backLabel="Voltar aos quadros"
      title={<BoardName editable={{ onChange: (name) => change(setBoardName(current, name)), maxLength: 120, tooltip: 'Renomear quadro' }}>{current.name}</BoardName>}
      actions={
        <Flex gap={8} align="center" wrap>
          <SaveStatus role="status">
            {status.icon} {status.text}
          </SaveStatus>
          <SearchBox allowClear prefix={<SearchOutlined />} placeholder="Buscar cartões" aria-label="Buscar cartões" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Button icon={<TagsOutlined />} onClick={() => setLabelsOpen(true)}>
            Etiquetas
          </Button>
          <Popover trigger="click" title="Cor do quadro" content={<ColorPicker value={current.color} onChange={(color) => change(setBoardColor(current, color))} label="Cor do quadro" />}>
            <Button icon={<BgColorsOutlined />} aria-label="Cor do quadro" title="Cor do quadro" />
          </Popover>
          <Dropdown trigger={['click']} menu={{
              items: [
                { key: 'archived', icon: <InboxOutlined />, label: 'Itens arquivados', onClick: () => setArchivedOpen(true) },
                { type: 'divider' },
                { key: 'delete', icon: <DeleteOutlined />, label: 'Excluir quadro', danger: true, onClick: confirmDeleteBoard },
              ],
            }}>
            <Button icon={<MoreOutlined />} aria-label="Mais ações do quadro" />
          </Dropdown>
        </Flex>
      }
    >
      <Canvas onDragEnd={endDrag}>
        {current.lists.map((list, index) => (
          <ListColumn
            key={list.id}
            list={list}
            accent={current.color}
            cards={shownCards(list.id)}
            labels={current.labels}
            today={today}
            draggingCardId={drag?.kind === 'card' ? drag.id : null}
            dropIndex={cardDrop?.listId === list.id ? cardDrop.index : null}
            dragging={drag?.kind === 'list' && drag.id === list.id}
            dropBefore={drag?.kind === 'list' && listDrop === index}
            onOpenCard={setOpenCardId}
            onToggleComplete={(card) => change(setCardCompleted(current, card.id, !card.completed, me))}
            onArchiveCard={(cardId) => {
              change(setCardArchived(current, cardId, true, me));
              message.success('Cartão arquivado. Ele fica em Itens arquivados, no menu do quadro.');
            }}
            onRename={(title) => change(renameList(current, list.id, title))}
            onRemove={() => change(removeList(current, list.id))}
            onAddCard={(title) => change(addCard(current, list.id, title, me))}
            onCardDragStart={(cardId, event) => {
              event.stopPropagation();
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', cardId);
              setDrag({ kind: 'card', id: cardId });
            }}
            onCardDragEnd={endDrag}
            onCardDragOver={(cardIndex, event) => {
              if (drag?.kind !== 'card') return;
              event.preventDefault();
              event.stopPropagation();
              if (cardDrop?.listId !== list.id || cardDrop.index !== cardIndex) setCardDrop({ listId: list.id, index: cardIndex });
            }}
            onCardDrop={(event: DragEvent) => {
              if (drag?.kind !== 'card') return;
              event.preventDefault();
              dropCard();
            }}
            onListDragStart={(event) => {
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', list.id);
              setDrag({ kind: 'list', id: list.id });
            }}
            onListDragEnd={endDrag}
            onListDragOver={(event) => {
              if (drag?.kind !== 'list') return;
              event.preventDefault();
              const rect = event.currentTarget.getBoundingClientRect();
              const target = event.clientX < rect.left + rect.width / 2 ? index : index + 1;
              if (listDrop !== target) setListDrop(target);
            }}
            onListDrop={(event) => {
              if (drag?.kind !== 'list') return;
              event.preventDefault();
              dropList();
            }}
          />
        ))}

        <AddListBox
          $dropBefore={drag?.kind === 'list' && listDrop === current.lists.length}
          onDragOver={(event) => {
            if (drag?.kind !== 'list') return;
            event.preventDefault();
            setListDrop(current.lists.length);
          }}
          onDrop={(event) => {
            if (drag?.kind !== 'list') return;
            event.preventDefault();
            dropList();
          }}
        >
          {addingList ? (
            <Composer>
              <Input
                autoFocus
                size="small"
                maxLength={200}
                placeholder="Insira o título da lista..."
                value={newListTitle}
                onChange={(e) => setNewListTitle(e.target.value)}
                onPressEnter={addNewList}
                onKeyDown={(e) => e.key === 'Escape' && setAddingList(false)}
              />
              <Flex gap={4}>
                <Button type="primary" size="small" onClick={addNewList} disabled={!newListTitle.trim()}>
                  Adicionar lista
                </Button>
                <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Fechar" onClick={() => setAddingList(false)} />
              </Flex>
            </Composer>
          ) : (
            <Button type="text" block icon={<PlusOutlined />} onClick={() => setAddingList(true)}>
              Adicionar outra lista
            </Button>
          )}
        </AddListBox>
      </Canvas>

      <CardModal board={current} cardId={openCardId} today={today} onChange={change} onClose={() => setOpenCardId(null)} onManageLabels={() => setLabelsOpen(true)} />
      <LabelsModal board={current} open={labelsOpen} onChange={change} onClose={() => setLabelsOpen(false)} />
      <ArchivedModal board={current} open={archivedOpen} author={me} onChange={change} onClose={() => setArchivedOpen(false)} />
    </Page>
  );
}
