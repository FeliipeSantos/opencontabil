import { addListItem, removeListItem, setListItem } from '@/modules/projects/model';
import { EditableList } from '@/modules/projects/report/EditableList';
import {
  type Accent,
  AttentionCard,
  AttentionRow,
  AttentionTitle,
  Bullet,
  BulletList,
} from '@/modules/projects/report/styles';
import type { Activity, ActivityListKey, Project } from '@/modules/projects/types';

interface SectionProps {
  project: Project;
  editing: boolean;
  onChange: (project: Project) => void;
}

const ATTENTION_CARDS: { key: ActivityListKey; title: string; accent: Accent }[] = [
  { key: 'attentionPoints', title: 'Pontos de atenção', accent: 'blue' },
  { key: 'projectImpacts', title: 'Impactos no projeto', accent: 'green' },
  { key: 'actionPlans', title: 'Planos de ação', accent: 'orange' },
];

/** The three lists of the selected activity: attention points, impacts and action plans. */
export function AttentionCards({ project, editing, onChange, activity }: SectionProps & { activity: Activity | null }) {
  return (
    <AttentionRow>
      {ATTENTION_CARDS.map(({ key, title, accent }) => (
        <AttentionCard key={key} $accent={accent}>
          <AttentionTitle $accent={accent}>
            <span>{title}</span>
            <span>{activity ? `de: ${activity.name}` : 'Nenhuma atividade selecionada'}</span>
          </AttentionTitle>
          {activity ? (
            <EditableList
              items={activity[key]}
              editing={editing}
              field="listItem"
              itemLabel="Item"
              emptyText="Nenhum item registrado."
              onAdd={() => onChange(addListItem(project, activity.id, key))}
              onCommit={(index, text) => onChange(setListItem(project, activity.id, key, index, text))}
              onRemove={(index) => onChange(removeListItem(project, activity.id, key, index))}
            />
          ) : (
            <BulletList>
              <Bullet $plain>Selecione uma atividade para visualizar.</Bullet>
            </BulletList>
          )}
        </AttentionCard>
      ))}
    </AttentionRow>
  );
}
