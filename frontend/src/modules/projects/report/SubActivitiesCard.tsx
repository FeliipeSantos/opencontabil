import { DeleteOutlined, HolderOutlined, PlusOutlined, StopOutlined, UndoOutlined } from '@ant-design/icons';
import { Button, Checkbox, Flex, Input } from 'antd';
import { useState } from 'react';

import { useCharLimit } from '@/core/hooks/useCharLimit';
import { addSubActivity, moveSubActivity, removeSubActivity, renameSubActivity, setSubActivityCancelled } from '@/modules/projects/model';
import { EditableText } from '@/modules/projects/report/EditableText';
import {
  CountBadge,
  DragHandle,
  EmptyBox,
  MiddleCard,
  MiddleTitle,
  ScreenOnly,
  ScrollList,
  SubActivitiesColumn,
  SubActivityItem,
  Subtitle,
} from '@/modules/projects/report/styles';
import type { Activity, Project } from '@/modules/projects/types';
import { colors } from '@/theme';

interface SubActivitiesCardProps {
  project: Project;
  activity: Activity | null;
  editing: boolean;
  onChange: (project: Project) => void;
  /** Checking an item outside edit mode is saved right away. */
  onToggle: (index: number, completed: boolean) => void;
}

export function SubActivitiesCard({ project, activity, editing, onChange, onToggle }: SubActivitiesCardProps) {
  const [newName, setNewName] = useState('');
  const nameLimit = useCharLimit('subActivityName');
  // arrastar para reordenar (modo de edição), como nas atividades
  const [dragging, setDragging] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  function drop(target: number) {
    setOver(null);
    if (activity && dragging !== null && dragging !== target) onChange(moveSubActivity(project, activity.id, dragging, target));
    setDragging(null);
  }

  function add() {
    if (!activity || !newName.trim()) return;
    onChange(addSubActivity(project, activity.id, newName));
    setNewName('');
  }

  return (
    <SubActivitiesColumn>
      <MiddleCard>
      <MiddleTitle>
        <span>
          Subatividades <Subtitle>{activity ? `de: ${activity.name}` : 'Selecione uma atividade para detalhar'}</Subtitle>
        </span>
        {activity && <CountBadge $color={colors.blue}>{activity.subActivities.length}</CountBadge>}
      </MiddleTitle>

      {!activity && <EmptyBox>Selecione uma atividade à esquerda clicando em sua linha para visualizar e gerenciar suas subatividades.</EmptyBox>}

      {activity && editing && (
        <ScreenOnly>
          <Flex gap={8}>
            <Input
              size="small"
              placeholder="Nova subatividade..."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onPressEnter={add}
              aria-label="Nova subatividade"
              {...nameLimit}
            />
            <Button type="primary" size="small" icon={<PlusOutlined />} onClick={add}>
              Adicionar
            </Button>
          </Flex>
        </ScreenOnly>
      )}

      {activity && !activity.subActivities.length && <EmptyBox>Nenhuma subatividade nesta etapa. Adicione uma acima!</EmptyBox>}

      {activity && activity.subActivities.length > 0 && (
        <ScrollList>
          {activity.subActivities.map((sub, index) => (
            <SubActivityItem
              key={`${activity.id}-${index}-${sub.name}`}
              $completed={sub.completed}
              $cancelled={Boolean(sub.cancelled)}
              $dragging={index === dragging}
              $dropTarget={index === over && dragging !== index}
              onDragOver={(e) => {
                if (dragging === null || dragging === index) return;
                e.preventDefault();
                setOver(index);
              }}
              onDragLeave={() => setOver((current) => (current === index ? null : current))}
              onDrop={(e) => {
                e.preventDefault();
                drop(index);
              }}
            >
              <Flex gap={8} align="center" flex={1}>
                {editing && (
                  <DragHandle
                    draggable
                    title="Arraste para reordenar"
                    aria-hidden
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(index));
                      setDragging(index);
                    }}
                    onDragEnd={() => {
                      setDragging(null);
                      setOver(null);
                    }}
                  >
                    <HolderOutlined />
                  </DragHandle>
                )}
                <Checkbox
                  checked={sub.completed}
                  disabled={Boolean(sub.cancelled)}
                  onChange={(e) => onToggle(index, e.target.checked)}
                  aria-label={`Concluir: ${sub.name}`}
                />
                <EditableText
                  value={sub.name}
                  editing={editing}
                  field="subActivityName"
                  ariaLabel={`Subatividade ${index + 1}`}
                  onCommit={(name) => onChange(renameSubActivity(project, activity.id, index, name))}
                />
              </Flex>
              {editing && (
                <Flex className="cancel-keep" gap={2}>
                  <Button
                    type="text"
                    size="small"
                    icon={sub.cancelled ? <UndoOutlined /> : <StopOutlined />}
                    title={sub.cancelled ? 'Reativar a subatividade' : 'Cancelar a subatividade'}
                    aria-label={sub.cancelled ? `Reativar subatividade ${sub.name}` : `Cancelar subatividade ${sub.name}`}
                    aria-pressed={Boolean(sub.cancelled)}
                    onClick={() => onChange(setSubActivityCancelled(project, activity.id, index, !sub.cancelled))}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<DeleteOutlined />}
                    title="Excluir a subatividade"
                    aria-label={`Excluir subatividade ${sub.name}`}
                    onClick={() => onChange(removeSubActivity(project, activity.id, index))}
                  />
                </Flex>
              )}
            </SubActivityItem>
          ))}
        </ScrollList>
      )}
      </MiddleCard>
    </SubActivitiesColumn>
  );
}
