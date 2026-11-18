import {
  CheckCircleFilled,
  CheckSquareOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  MessageOutlined,
  MoreOutlined,
  TagOutlined,
} from '@ant-design/icons';
import { App, Button, Checkbox, DatePicker, Dropdown, Flex, Input, Modal, Popover, Progress, Select } from 'antd';
import dayjs from 'dayjs';
import { AlignLeft } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { useAuth } from '@/core/auth/authContext';
import { displayName } from '@/core/auth/profile';
import { UserAvatar } from '@/core/ui/UserAvatar';
import { LabelPill } from '@/modules/boards/components/LabelPill';
import {
  addComment,
  checklistProgress,
  dueState,
  editComment,
  findCard,
  moveCard,
  newChecklistItem,
  removeCard,
  removeComment,
  setCardCompleted,
  toggleCardLabel,
  updateCard,
} from '@/modules/boards/model';
import type { Board, BoardCard, BoardComment, CardActivity } from '@/modules/boards/types';
import { colors, fontSize, radius, tones } from '@/theme';

// janela no estilo do verso do cartão do Trello: detalhes à esquerda, comentários e atividade à direita
const Frame = styled.div`
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid ${colors.border};
`;

const HeadSpacer = styled.div`
  flex: 1;
`;

const Columns = styled.div`
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);

  @media (max-width: 860px) {
    grid-template-columns: minmax(0, 1fr);
    overflow-y: auto;
  }
`;

const Main = styled.div`
  padding: 18px 22px 22px;
  overflow-y: auto;
`;

const Side = styled.aside`
  padding: 16px 18px;
  overflow-y: auto;
  background: ${colors.bgSubtle};
  border-left: 1px solid ${colors.border};

  @media (max-width: 860px) {
    border-left: none;
    border-top: 1px solid ${colors.border};
  }
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 10px;
`;

const DoneCircle = styled.button<{ $done: boolean }>`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-top: 8px;
  display: grid;
  place-items: center;
  padding: 0;
  border-radius: 50%;
  border: 2px solid ${({ $done }) => ($done ? tones.success.solid : colors.textMuted)};
  background: transparent;
  color: ${tones.success.solid};
  font-size: 20px;
  cursor: pointer;

  &:hover {
    border-color: ${tones.success.solid};
  }
`;

const TitleInput = styled(Input.TextArea)<{ $done: boolean }>`
  &&& {
    padding: 2px 6px;
    font-size: 22px;
    font-weight: 700;
    line-height: 1.3;
    color: ${({ $done }) => ($done ? colors.textMuted : colors.textDark)};
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 18px 30px;
`;

const Section = styled.section`
  margin: 0 0 22px;

  > h4 {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 10px;
    font-size: 15px;
    font-weight: 600;
    color: ${colors.textDark};
  }
`;

const Small = styled.div`
  margin: 0 0 18px 30px;
  display: flex;
  flex-wrap: wrap;
  gap: 24px;

  h5 {
    margin: 0 0 6px;
    font-size: 12px;
    font-weight: 600;
    color: ${colors.textMuted};
  }
`;

const LabelOption = styled.label`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
  cursor: pointer;
`;

const CheckItem = styled.div<{ $done: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 6px;
  border-radius: ${radius.field}px;

  &:hover {
    background: ${colors.bgSubtle};
  }

  .ant-input {
    text-decoration: ${({ $done }) => ($done ? 'line-through' : 'none')};
    color: ${({ $done }) => ($done ? colors.textMuted : colors.textDark)};
  }

  .ant-btn {
    opacity: 0;
  }

  &:hover .ant-btn,
  .ant-btn:focus-visible {
    opacity: 1;
  }
`;

// barra do checklist: espessura normal, só com as cores mais visíveis (definidas no uso)
const ChecklistProgress = styled(Progress)`
  &&& {
    margin: 0 0 8px;
  }
`;

// campo de novo item afastado dos itens
const AddItemRow = styled(Flex)`
  margin-top: 12px;
`;

const DueTag = styled.span<{ $tone: 'done' | 'overdue' | 'soon' | 'later' }>`
  padding: 1px 8px;
  border-radius: ${radius.badge}px;
  font-size: 12px;
  color: ${({ $tone }) => ($tone === 'done' ? tones.success.fg : $tone === 'overdue' ? tones.danger.fg : $tone === 'soon' ? tones.warning.fg : colors.textMuted)};
  background: ${({ $tone }) => ($tone === 'done' ? tones.success.bg : $tone === 'overdue' ? tones.danger.bg : $tone === 'soon' ? tones.warning.bg : colors.bgSubtle)};
`;

const SideHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;

  h4 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${colors.textDark};
  }
`;

const Entry = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 14px;
`;

const EntryBody = styled.div`
  flex: 1;
  min-width: 0;
  font-size: ${fontSize.support}px;
  color: ${colors.textDark};

  strong {
    font-weight: 600;
  }
`;

const When = styled.div`
  font-size: 12px;
  color: ${colors.textMuted};
`;

const Bubble = styled.div`
  margin-top: 4px;
  padding: 8px 12px;
  border-radius: ${radius.field}px;
  background: ${colors.bgCard};
  border: 1px solid ${colors.border};
  white-space: pre-wrap;
  overflow-wrap: anywhere;
`;

const LinkRow = styled.div`
  margin-top: 4px;
  font-size: 12px;
  color: ${colors.textMuted};

  button {
    padding: 0;
    border: none;
    background: none;
    font: inherit;
    color: inherit;
    text-decoration: underline;
    cursor: pointer;
  }

  button:hover {
    color: ${colors.textDark};
  }
`;

const DUE_TEXT = { done: 'concluído', overdue: 'vencido', soon: 'vence em breve', later: '' } as const;

const formatWhen = (iso: string) => dayjs(iso).format('D [de] MMM [de] YYYY, HH:mm');

type Feed = { kind: 'comment'; at: string; item: BoardComment } | { kind: 'activity'; at: string; item: CardActivity };

interface CardModalProps {
  board: Board;
  cardId: string | null;
  today: string;
  onChange: (board: Board) => void;
  onClose: () => void;
  onManageLabels: () => void;
}

function Heading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h4>
      {icon}
      {children}
    </h4>
  );
}

/** Back of the card, like Trello's: list, title, labels, dates, description, checklist, comments and history. */
export function CardModal({ board, cardId, today, onChange, onClose, onManageLabels }: CardModalProps) {
  const { modal } = App.useApp();
  const { session, profile } = useAuth();
  const me = profile ? displayName(profile) : session.status === 'authenticated' ? session.user : '';
  const found = cardId ? findCard(board, cardId) : null;
  const card = found?.card ?? null;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [newItem, setNewItem] = useState('');
  const [showChecklist, setShowChecklist] = useState(false);
  const [comment, setComment] = useState('');
  const [editingComment, setEditingComment] = useState<{ id: string; text: string } | null>(null);
  const [showDetails, setShowDetails] = useState(true);

  // ao abrir outro cartão, os campos mostram os dados dele
  useEffect(() => {
    setTitle(card?.title ?? '');
    setDescription(card?.description ?? '');
    setEditingDescription(false);
    setNewItem('');
    setShowChecklist(Boolean(card?.checklist.length));
    setComment('');
    setEditingComment(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só ao trocar de cartão
  }, [cardId]);

  const feed = useMemo<Feed[]>(() => {
    if (!card) return [];
    const items: Feed[] = [
      ...card.comments.map((item) => ({ kind: 'comment' as const, at: item.createdAt, item })),
      ...(showDetails ? card.activity.map((item) => ({ kind: 'activity' as const, at: item.createdAt, item })) : []),
    ];
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [card, showDetails]);

  if (!card || !found || !cardId) return <Modal open={false} footer={null} />;

  const change = (apply: (c: BoardCard) => void) => onChange(updateCard(board, cardId, apply));

  function saveTitle() {
    const next = title.trim() || card!.title;
    setTitle(next);
    if (next !== card!.title) change((c) => (c.title = next));
  }

  function saveDescription() {
    setEditingDescription(false);
    if (description !== card!.description) change((c) => (c.description = description));
  }

  function close() {
    saveTitle();
    if (editingDescription) saveDescription();
    onClose();
  }

  function addItem() {
    if (!newItem.trim()) return;
    change((c) => c.checklist.push(newChecklistItem(newItem)));
    setNewItem('');
  }

  function sendComment() {
    if (!comment.trim()) return;
    onChange(addComment(board, cardId!, me, comment));
    setComment('');
  }

  function confirmRemoveCard() {
    modal.confirm({
      title: 'Excluir cartão',
      content: `Deseja realmente excluir o cartão "${card!.title}"? Não é possível desfazer.`,
      okText: 'Excluir',
      okButtonProps: { danger: true },
      cancelText: 'Cancelar',
      onOk: () => {
        onChange(removeCard(board, cardId!));
        onClose();
      },
    });
  }

  const progress = checklistProgress(card);
  const due = dueState(card, today);
  const cardLabels = board.labels.filter((l) => card.labelIds.includes(l.id));

  const labelPicker = (
    <div>
      {board.labels.length === 0 && <p>Nenhuma etiqueta neste quadro.</p>}
      {board.labels.map((label) => (
        <LabelOption key={label.id}>
          <Checkbox checked={card.labelIds.includes(label.id)} onChange={() => onChange(toggleCardLabel(board, cardId, label.id))} />
          <LabelPill $color={label.color}>{label.name || ' '}</LabelPill>
        </LabelOption>
      ))}
      <Button type="link" size="small" onClick={onManageLabels}>
        Gerenciar etiquetas do quadro
      </Button>
    </div>
  );

  const datePicker = (
    <Flex vertical gap={8}>
      <DatePicker
        format="DD/MM/YYYY"
        value={card.due ? dayjs(card.due) : null}
        placeholder="Sem prazo"
        onChange={(date) =>
          change((c) => {
            c.due = date ? date.format('YYYY-MM-DD') : null;
            if (!date) c.dueDone = false;
          })
        }
      />
      {card.due && (
        <Checkbox checked={card.dueDone} onChange={(e) => change((c) => (c.dueDone = e.target.checked))}>
          Prazo concluído
        </Checkbox>
      )}
    </Flex>
  );

  return (
    <Modal open onCancel={close} footer={null} width={980} closable={false} destroyOnHidden styles={{ content: { padding: 0, overflow: 'hidden' } }}>
      <Frame>
        <Head>
          <Select
            size="small"
            variant="filled"
            popupMatchSelectWidth={false}
            value={found.list.id}
            aria-label="Lista do cartão"
            options={board.lists.map((list) => ({ value: list.id, label: list.title }))}
            onChange={(listId) => onChange(moveCard(board, cardId, listId, Number.MAX_SAFE_INTEGER, me))}
          />
          <HeadSpacer />
          <Dropdown trigger={['click']} menu={{ items: [{ key: 'delete', icon: <DeleteOutlined />, label: 'Excluir cartão', danger: true, onClick: confirmRemoveCard }] }}>
            <Button type="text" size="small" icon={<MoreOutlined />} aria-label="Mais ações do cartão" />
          </Dropdown>
          <Button type="text" size="small" icon={<CloseOutlined />} aria-label="Fechar" onClick={close} />
        </Head>

        <Columns>
          <Main>
            <TitleRow>
              <DoneCircle
                type="button"
                $done={card.completed}
                aria-pressed={card.completed}
                aria-label={card.completed ? 'Marcar como não concluído' : 'Marcar como concluído'}
                title={card.completed ? 'Marcar como não concluído' : 'Marcar como concluído'}
                onClick={() => onChange(setCardCompleted(board, cardId, !card.completed, me))}
              >
                {card.completed && <CheckCircleFilled />}
              </DoneCircle>
              <TitleInput
                $done={card.completed}
                variant="borderless"
                autoSize={{ minRows: 1, maxRows: 4 }}
                maxLength={500}
                value={title}
                aria-label="Título do cartão"
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onPressEnter={(e) => {
                  e.preventDefault();
                  e.currentTarget.blur();
                }}
              />
            </TitleRow>

            <Actions>
              <Popover trigger="click" placement="bottomLeft" title="Etiquetas" content={labelPicker}>
                <Button icon={<TagOutlined />}>Etiquetas</Button>
              </Popover>
              <Popover trigger="click" placement="bottomLeft" title="Datas" content={datePicker}>
                <Button icon={<ClockCircleOutlined />}>Datas</Button>
              </Popover>
              <Button icon={<CheckSquareOutlined />} onClick={() => setShowChecklist(true)}>
                Checklist
              </Button>
            </Actions>

            {(cardLabels.length > 0 || card.due) && (
              <Small>
                {cardLabels.length > 0 && (
                  <div>
                    <h5>Etiquetas</h5>
                    <Flex gap={6} wrap>
                      {cardLabels.map((label) => (
                        <LabelPill key={label.id} $color={label.color}>
                          {label.name}
                        </LabelPill>
                      ))}
                    </Flex>
                  </div>
                )}
                {card.due && (
                  <div>
                    <h5>Data de entrega</h5>
                    <Flex gap={8} align="center">
                      <Checkbox checked={card.dueDone} aria-label="Prazo concluído" onChange={(e) => change((c) => (c.dueDone = e.target.checked))} />
                      <span>{dayjs(card.due).format('DD/MM/YYYY')}</span>
                      {due && due !== 'later' && <DueTag $tone={due}>{DUE_TEXT[due]}</DueTag>}
                    </Flex>
                  </div>
                )}
              </Small>
            )}

            <Section>
              <Heading icon={<AlignLeft size={18} aria-hidden />}>Descrição</Heading>
              {editingDescription || !card.description ? (
                <>
                  <Input.TextArea
                    autoSize={{ minRows: 3, maxRows: 16 }}
                    maxLength={20000}
                    placeholder="Adicione uma descrição mais detalhada..."
                    value={description}
                    onFocus={() => setEditingDescription(true)}
                    onChange={(e) => setDescription(e.target.value)}
                    onBlur={saveDescription}
                  />
                </>
              ) : (
                <Bubble role="button" tabIndex={0} title="Clique para editar" onClick={() => setEditingDescription(true)}>
                  {card.description}
                </Bubble>
              )}
            </Section>

            {(showChecklist || card.checklist.length > 0) && (
              <Section>
                <Heading icon={<CheckSquareOutlined aria-hidden />}>Checklist</Heading>
                {progress && (
                  <ChecklistProgress
                    percent={Math.round((progress.done / progress.total) * 100)}
                    size="small"
                    // trilho com a cor de borda forte: visível nos dois temas, mesmo em 0%
                    trailColor={colors.borderStrong}
                    strokeColor={progress.done === progress.total ? tones.success.solid : colors.blue}
                    status={progress.done === progress.total ? 'success' : 'normal'}
                  />
                )}
                {card.checklist.map((item) => (
                  <CheckItem key={item.id} $done={item.done}>
                    <Checkbox
                      checked={item.done}
                      aria-label={`Concluir: ${item.text}`}
                      onChange={(e) => change((c) => (c.checklist.find((i) => i.id === item.id)!.done = e.target.checked))}
                    />
                    <Input
                      variant="borderless"
                      size="small"
                      defaultValue={item.text}
                      maxLength={500}
                      aria-label="Item do checklist"
                      onBlur={(e) => {
                        const text = e.target.value.trim();
                        if (text && text !== item.text) change((c) => (c.checklist.find((i) => i.id === item.id)!.text = text));
                      }}
                      onPressEnter={(e) => e.currentTarget.blur()}
                    />
                    <Button
                      type="text"
                      size="small"
                      icon={<DeleteOutlined />}
                      aria-label={`Excluir item ${item.text}`}
                      onClick={() => change((c) => (c.checklist = c.checklist.filter((i) => i.id !== item.id)))}
                    />
                  </CheckItem>
                ))}
                <AddItemRow gap={6}>
                  <Input size="small" placeholder="Adicionar um item..." maxLength={500} value={newItem} onChange={(e) => setNewItem(e.target.value)} onPressEnter={addItem} />
                  <Button size="small" onClick={addItem} disabled={!newItem.trim()}>
                    Adicionar
                  </Button>
                </AddItemRow>
              </Section>
            )}
          </Main>

          <Side aria-label="Comentários e atividade">
            <SideHead>
              <h4>
                <MessageOutlined aria-hidden /> Comentários e atividade
              </h4>
              <Button size="small" onClick={() => setShowDetails((v) => !v)}>
                {showDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
              </Button>
            </SideHead>
            <Input.TextArea
              autoSize={{ minRows: 1, maxRows: 8 }}
              maxLength={5000}
              placeholder="Escrever um comentário..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onPressEnter={(e) => {
                if (e.shiftKey) return;
                e.preventDefault();
                sendComment();
              }}
            />
            {comment.trim() && (
              <Flex gap={6} justify="flex-end">
                <Button type="primary" size="small" onClick={sendComment}>
                  Salvar
                </Button>
              </Flex>
            )}

            {feed.map((entry) =>
              entry.kind === 'comment' ? (
                <Entry key={entry.item.id}>
                  <UserAvatar avatar={entry.item.author === me ? profile?.avatar : undefined} name={entry.item.author || '?'} size={30} />
                  <EntryBody>
                    <strong>{entry.item.author || 'Alguém'}</strong> <When as="span">{formatWhen(entry.item.createdAt)}{entry.item.editedAt ? ' (editado)' : ''}</When>
                    {editingComment?.id === entry.item.id ? (
                      <Flex vertical gap={6}>
                        <Input.TextArea
                          autoSize={{ minRows: 2, maxRows: 8 }}
                          maxLength={5000}
                          value={editingComment.text}
                          onChange={(e) => setEditingComment({ id: entry.item.id, text: e.target.value })}
                        />
                        <Flex gap={6}>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => {
                              onChange(editComment(board, cardId, entry.item.id, editingComment.text));
                              setEditingComment(null);
                            }}
                          >
                            Salvar
                          </Button>
                          <Button size="small" onClick={() => setEditingComment(null)}>
                            Cancelar
                          </Button>
                        </Flex>
                      </Flex>
                    ) : (
                      <>
                        <Bubble>{entry.item.text}</Bubble>
                        <LinkRow>
                          <button type="button" onClick={() => setEditingComment({ id: entry.item.id, text: entry.item.text })}>
                            Editar
                          </button>
                          {' • '}
                          <button
                            type="button"
                            onClick={() =>
                              modal.confirm({
                                title: 'Excluir comentário',
                                content: 'O comentário será excluído. Não é possível desfazer.',
                                okText: 'Excluir',
                                okButtonProps: { danger: true },
                                cancelText: 'Cancelar',
                                onOk: () => onChange(removeComment(board, cardId, entry.item.id)),
                              })
                            }
                          >
                            Excluir
                          </button>
                        </LinkRow>
                      </>
                    )}
                  </EntryBody>
                </Entry>
              ) : (
                <Entry key={entry.item.id}>
                  <UserAvatar avatar={entry.item.author === me ? profile?.avatar : undefined} name={entry.item.author || '?'} size={30} />
                  <EntryBody>
                    <strong>{entry.item.author || 'Alguém'}</strong> {entry.item.text}
                    <When>{formatWhen(entry.item.createdAt)}</When>
                  </EntryBody>
                </Entry>
              ),
            )}
          </Side>
        </Columns>
      </Frame>
    </Modal>
  );
}
