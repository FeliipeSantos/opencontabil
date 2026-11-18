import { forwardRef } from 'react';
import styled, { css } from 'styled-components';

import { statusTone } from '@/modules/projects/model';
import { BASE_ZOOM } from '@/modules/projects/report/print';
import { type Accent, PRINT_PAGE_WIDTH, PrintOnly, StatusBadge } from '@/modules/projects/report/styles';
import type { Project } from '@/modules/projects/types';
import { colors } from '@/theme';

// detalhamento em fluxo: as atividades seguem uma embaixo da outra e a folha só vira quando enche
const DetailFlow = styled.div`
  break-before: page;
  width: ${PRINT_PAGE_WIDTH}px;
  margin: 0 auto;
  padding: 0 50px;
  background-color: #fff;

  /* mesma escala da folha do relatório (a altura não é ajustada: a paginação é do navegador) */
  @media print {
    zoom: ${BASE_ZOOM};
  }
`;

/**
 * Tabela só para a paginação: o navegador repete o <thead> (cabeçalho do projeto) no topo de
 * cada folha impressa, e cada atividade é uma linha que não se parte entre folhas.
 */
const DetailTable = styled.table`
  width: 100%;
  border-collapse: collapse;

  th,
  td {
    padding: 0;
    text-align: left;
    font-weight: inherit;
  }

  /* margem de cima e de baixo de cada folha (thead e tfoot se repetem em todas) */
  thead th {
    padding: 28px 0 16px;
  }

  tfoot td {
    height: 28px;
  }

  tbody tr {
    break-inside: avoid;
  }

  tbody td {
    padding-bottom: 16px;
  }
`;

// uma atividade nunca fica partida entre duas folhas (a não ser que sozinha passe de uma folha)
const ActivityBlock = styled.section`
  break-inside: avoid;
  border: 1px solid ${colors.border};
  border-radius: 8px;
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ActivityHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
`;

const PrintPageHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid ${colors.navy};
  padding-bottom: 15px;

  h2 {
    font-size: 1.8rem;
    font-weight: 700;
    color: ${colors.navy};
    margin: 0;
  }

  p {
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 2px;
    color: ${colors.textMuted};
    margin: 0;
  }
`;

// cancelada: riscada e apagada também no PDF
const struck = css`
  opacity: 0.5;
  text-decoration: line-through;
`;

const ActivityName = styled.span<{ $cancelled: boolean }>`
  font-weight: 700;
  font-size: 1.05rem;
  color: ${colors.navy};
  ${({ $cancelled }) => $cancelled && struck}
`;

const SectionTitle = styled.h4`
  font-size: 0.85rem;
  font-weight: 600;
  color: ${colors.textMuted};
  margin: 0 0 8px;
`;

const Checklist = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px 12px;
`;

const CheckItem = styled.li<{ $completed: boolean; $cancelled?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.85rem;
  padding: 5px 10px;
  background: ${({ $completed }) => ($completed ? colors.bgMuted : colors.bgSubtle)};
  border: 1px solid ${colors.border};
  border-radius: 4px;
  color: ${({ $completed }) => ($completed ? colors.textMuted : colors.textDark)};

  span:first-child {
    font-size: 1.05rem;
    font-weight: bold;
    color: ${colors.blue};
  }

  ${({ $cancelled }) => $cancelled && struck}
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
`;

const accent = { blue: colors.blue, green: colors.green, orange: colors.orange } as const;

const ListCard = styled.div<{ $accent: Accent }>`
  border-radius: 8px;
  padding: 10px 14px;
  border: 1px solid ${colors.border};
  border-top: 3px solid ${({ $accent }) => accent[$accent]};

  h4 {
    font-size: 0.8rem;
    margin: 0 0 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: ${({ $accent }) => accent[$accent]};
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  li {
    position: relative;
    padding-left: 12px;
  }

  li::before {
    content: '•';
    position: absolute;
    left: 0;
  }
`;

const WideBadge = styled(StatusBadge)`
  ${css`
    width: auto;
    font-size: 0.8rem;
    padding: 4px 12px;
  `}
`;

const LISTS = [
  { key: 'attentionPoints', title: 'Pontos de Atenção', accent: 'blue' },
  { key: 'projectImpacts', title: 'Impactos no Projeto', accent: 'green' },
  { key: 'actionPlans', title: 'Planos de Ação', accent: 'orange' },
] as const;

/**
 * Activity details after the report: every activity with something to detail (checklist and
 * lists), one after another; the sheet turns only when it is full. Activities with nothing to
 * detail are skipped.
 */
export const PrintPages = forwardRef<HTMLDivElement, { project: Project }>(function PrintPages({ project }, ref) {
  const detailed = project.activities.filter(
    (a) => a.subActivities.length || a.attentionPoints.length || a.projectImpacts.length || a.actionPlans.length,
  );

  return (
    <PrintOnly ref={ref}>
      {detailed.length > 0 && (
        <DetailFlow>
          <DetailTable>
            <thead>
              <tr>
                <th>
                  <PrintPageHeader>
                    <div>
                      <h2>{project.name}</h2>
                      <p>DETALHAMENTO DAS ATIVIDADES</p>
                    </div>
                  </PrintPageHeader>
                </th>
              </tr>
            </thead>
            <tbody>
              {detailed.map((activity) => (
                <tr key={activity.id}>
                  <td>
                    <ActivityBlock>
                      <ActivityHeader>
                        <ActivityName $cancelled={Boolean(activity.cancelled)}>
                          #{activity.id} {activity.name}
                        </ActivityName>
                        <WideBadge $tone={statusTone(activity.status)}>
                          {activity.status} ({activity.progress}%)
                        </WideBadge>
                      </ActivityHeader>
                      {activity.subActivities.length > 0 && (
                        <div>
                          <SectionTitle>Subatividades</SectionTitle>
                          <Checklist>
                            {activity.subActivities.map((sub, index) => (
                              <CheckItem key={index} $completed={sub.completed} $cancelled={Boolean(sub.cancelled)}>
                                <span>{sub.completed ? '☑' : '☐'}</span>
                                <span>{sub.name}</span>
                              </CheckItem>
                            ))}
                          </Checklist>
                        </div>
                      )}
                      {LISTS.some(({ key }) => activity[key].length) && (
                        <Grid>
                          {LISTS.filter(({ key }) => activity[key].length).map(({ key, title, accent: tone }) => (
                            <ListCard key={key} $accent={tone}>
                              <h4>{title}</h4>
                              <ul>
                                {activity[key].map((item, index) => (
                                  <li key={index}>{item}</li>
                                ))}
                              </ul>
                            </ListCard>
                          ))}
                        </Grid>
                      )}
                    </ActivityBlock>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td aria-hidden />
              </tr>
            </tfoot>
          </DetailTable>
        </DetailFlow>
      )}
    </PrintOnly>
  );
});
