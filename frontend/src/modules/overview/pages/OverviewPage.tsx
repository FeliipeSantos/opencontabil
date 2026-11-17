import {
  AppstoreOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  FileDoneOutlined,
  FileSyncOutlined,
  NotificationOutlined,
  ProjectOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import dayjs from 'dayjs';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { Page } from '@/core/layout/Page';
import { LoadingState, SectionCard, StatCard, StatGrid, StatusBadge } from '@/core/ui';
import { formatMoney } from '@/modules/clients/format';
import { dasApi } from '@/modules/das/api';
import { DAS_PATH, defaultPeriod, periodLabel } from '@/modules/das/format';
import type { DasListing } from '@/modules/das/types';
import { intelligenceApi } from '@/modules/intelligence/api';
import { formatDate as formatPublicationDate, groupSameAct, RELEVANCE } from '@/modules/intelligence/format';
import { publicationsPath } from '@/modules/intelligence/paths';
import type { Publication } from '@/modules/intelligence/types';
import { dasCounts, monthTotals, oldestOpenClients, openTotals } from '@/modules/overview/summary';
import { listProjects } from '@/modules/projects/api';
import { deadlineChip, upcomingDeadlines } from '@/modules/projects/portfolio';
import type { Project } from '@/modules/projects/types';
import { receiptsApi } from '@/modules/receipts/api';
import { RECEIPTS_PATH } from '@/modules/receipts/format';
import type { ReceiptListing } from '@/modules/receipts/types';
import { reformaApi } from '@/modules/reforma/api';
import { EventModal } from '@/modules/reforma/components/EventModal';
import { eventSubject, formatDate, isoDay, KIND_GROUPS, kindGroup, relativeDay } from '@/modules/reforma/format';
import { CALENDAR_PATH } from '@/modules/reforma/search';
import type { CalendarEvent, DocumentPage, Status } from '@/modules/reforma/types';
import { colors, fontSize, radius } from '@/theme';

// prazos dos próximos 15 dias na lista; o card conta os 7 primeiros
const LIST_DAYS = 15;
const CARD_DAYS = 7;
const RECENT_PUBLICATION_DAYS = 30;
const LIST_LIMIT = 8;

/** Data of one block: each block loads on its own, so one failure does not hide the others. */
interface Block<T> {
  data: T | null;
  error: string | null;
}

function useBlock<T>(load: () => Promise<T>): Block<T> {
  const [state, setState] = useState<Block<T>>({ data: null, error: null });
  useEffect(() => {
    let active = true;
    load()
      .then((data) => active && setState({ data, error: null }))
      .catch((err) => active && !(err instanceof SessionExpiredError) && setState({ data: null, error: errorMessage(err) }));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez, ao abrir a tela
  }, []);
  return state;
}

const Columns = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
  gap: 16px;
  align-items: start;

  @media (max-width: 1100px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const Stack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
`;

const CardTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: ${fontSize.cardTitle}px;
  font-weight: 600;
  color: ${colors.navy};
`;

const List = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

const Item = styled.li`
  border-bottom: 1px solid ${colors.border};

  &:last-child {
    border-bottom: none;
  }

  > button {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 20px;
    background: none;
    border: none;
    font: inherit;
    text-align: left;
    color: inherit;
    cursor: pointer;
  }

  > button:hover {
    background: ${colors.bgSubtle};
  }
`;

const DateBox = styled.div<{ $today: boolean }>`
  flex: 0 0 52px;
  padding: 4px 0;
  border-radius: ${radius.field}px;
  background: ${({ $today }) => ($today ? colors.blueSelected : colors.bgSubtle)};
  text-align: center;
  line-height: 1.2;

  strong {
    display: block;
    font-size: 16px;
    font-weight: 600;
    color: ${colors.navy};
  }

  span {
    font-size: 11px;
    text-transform: uppercase;
    color: ${colors.textMuted};
  }
`;

const Texts = styled.div`
  flex: 1;
  min-width: 0;
`;

const Title = styled.div`
  font-size: ${fontSize.support}px;
  font-weight: 500;
  color: ${colors.textDark};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Sub = styled.div`
  margin-top: 2px;
  font-size: 12px;
  color: ${colors.textMuted};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Empty = styled.p`
  margin: 0;
  padding: 16px 20px;
  font-size: ${fontSize.support}px;
  color: ${colors.textMuted};
`;

const Money = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const KindTag = styled(Tag)`
  &&& {
    margin: 0;
    flex-shrink: 0;
  }
`;

const LinkButton = styled.button`
  padding: 0;
  background: none;
  border: none;
  font: inherit;
  font-size: 13px;
  color: ${colors.blue};
  cursor: pointer;
`;

function BlockBody<T>({ block, rows = 3, children }: { block: Block<T>; rows?: number; children: (data: T) => ReactNode }) {
  if (block.error) return <Empty>Não foi possível carregar: {block.error}</Empty>;
  if (block.data === null) return <LoadingState rows={rows} />;
  return <>{children(block.data)}</>;
}

const TAG_COLOR: Record<string, string> = { orange: 'orange', green: 'green', purple: 'purple', blue: 'blue' };

/** Visão Geral: what needs attention today, from the data the modules already have. */
export function OverviewPage() {
  const navigate = useNavigate();
  const today = useMemo(() => isoDay(new Date()), []);
  const month = today.slice(0, 7);
  const dasPeriod = useMemo(() => defaultPeriod(), []);
  const listEnd = useMemo(() => dayjs(today).add(LIST_DAYS, 'day').format('YYYY-MM-DD'), [today]);
  const cardEnd = dayjs(today).add(CARD_DAYS, 'day').format('YYYY-MM-DD');
  const publicationsFrom = useMemo(() => dayjs(today).subtract(RECENT_PUBLICATION_DAYS, 'day').format('YYYY-MM-DD'), [today]);

  const receipts = useBlock<ReceiptListing>(() => receiptsApi.list());
  const events = useBlock<CalendarEvent[]>(() => reformaApi.events(today, listEnd, { hidePublications: true }));
  const das = useBlock<DasListing>(() => dasApi.list(dasPeriod));
  const projects = useBlock<Project[]>(() => listProjects());
  const publications = useBlock<Publication[]>(() =>
    Promise.all([intelligenceApi.publications({ relevance: 'critica', from: publicationsFrom }), intelligenceApi.publications({ relevance: 'alta', from: publicationsFrom })]).then(
      ([critical, high]) => [...critical.items, ...high.items],
    ),
  );
  const changed = useBlock<DocumentPage>(() => reformaApi.documents({ changed: 'versions' }));
  // nomes das fontes e tipos, usados pelo cartão do prazo
  const calendarStatus = useBlock<Status>(() => reformaApi.status());
  const [openEvent, setOpenEvent] = useState<CalendarEvent | null>(null);

  const open = receipts.data ? openTotals(receipts.data.balances) : null;
  const thisMonth = receipts.data ? monthTotals(receipts.data.items, month) : null;
  const upcoming = useMemo(() => [...(events.data ?? [])].sort((a, b) => a.date.localeCompare(b.date)), [events.data]);
  const dueSoon = upcoming.filter((e) => e.date <= cardEnd && (e.kind === 'prazo' || e.kind === 'obrigatoriedade'));
  const critical = (publications.data ?? []).filter((p) => p.relevance === 'critica');
  const recentPublications = useMemo(
    () =>
      groupSameAct(publications.data ?? [])
        .map(({ primary }) => primary)
        .sort((a, b) => (b.publishedAt ?? b.collectedAt).localeCompare(a.publishedAt ?? a.collectedAt))
        .slice(0, 5),
    [publications.data],
  );
  const projectDeadlines = useMemo(
    () => (projects.data ? upcomingDeadlines(projects.data, dayjs(), 20).filter(({ deadline }) => deadline.kind === 'overdue' || deadline.days <= CARD_DAYS) : []),
    [projects.data],
  );

  const value = (text: string | number | null) => (text === null ? '—' : text);
  const openDocument = (documentId: string) => navigate(CALENDAR_PATH, { state: { openDocument: documentId } });

  return (
    <Page icon={<AppstoreOutlined />} title="Visão Geral" description="O que pede atenção hoje: valores a receber, prazos, pendências e novidades.">
      <StatGrid $min={220}>
        <StatCard
          icon={<ClockCircleOutlined />}
          iconTone="orange"
          label="A receber"
          value={value(open ? formatMoney(open.amount) : null)}
          tone={open && open.amount > 0 ? 'warning' : undefined}
          hint={open ? (open.clients ? `${open.clients} cliente${open.clients > 1 ? 's' : ''} em aberto` : 'nada em aberto') : undefined}
          small
          onClick={() => navigate(RECEIPTS_PATH)}
          ariaLabel="Abrir Recebimentos"
        />
        <StatCard
          icon={<WalletOutlined />}
          iconTone="green"
          label={`Recebido em ${dayjs(today).format('MMMM')}`}
          value={value(thisMonth ? formatMoney(thisMonth.received) : null)}
          hint={thisMonth ? `de ${formatMoney(thisMonth.charged)} cobrados` : undefined}
          small
          onClick={() => navigate(RECEIPTS_PATH)}
          ariaLabel="Abrir Recebimentos"
        />
        <StatCard
          icon={<CalendarOutlined />}
          iconTone="blue"
          label={`Prazos nos próximos ${CARD_DAYS} dias`}
          value={value(events.data ? dueSoon.length : null)}
          tone={dueSoon.length > 0 ? 'warning' : undefined}
          hint={events.data ? (dueSoon[0] ? `o primeiro ${relativeDay(dueSoon[0].date, today)}` : 'nenhum prazo na semana') : undefined}
          small
          onClick={() => navigate(`${CALENDAR_PATH}?aba=painel`)}
          ariaLabel="Abrir o painel do Calendário"
        />
        <StatCard
          icon={<NotificationOutlined />}
          iconTone="red"
          label="Publicações críticas"
          value={value(publications.data ? groupSameAct(critical).length : null)}
          tone={critical.length > 0 ? 'danger' : undefined}
          hint={`nos últimos ${RECENT_PUBLICATION_DAYS} dias`}
          small
          onClick={() => navigate(publicationsPath({ relevance: 'critica', from: publicationsFrom }))}
          ariaLabel="Abrir as publicações críticas"
        />
      </StatGrid>

      <Columns>
        <Stack>
          <SectionCard
            title={
              <CardTitle>
                <CalendarOutlined /> Próximos prazos
              </CardTitle>
            }
            extra={<LinkButton onClick={() => navigate(CALENDAR_PATH)}>Abrir calendário</LinkButton>}
            flush
          >
            <BlockBody block={events} rows={5}>
              {() =>
                upcoming.length === 0 ? (
                  <Empty>Nada no calendário nos próximos {LIST_DAYS} dias.</Empty>
                ) : (
                  <List>
                    {upcoming.slice(0, 12).map((event) => {
                      const group = KIND_GROUPS[kindGroup(event.kind)];
                      return (
                        <Item key={event.id}>
                          <button type="button" onClick={() => setOpenEvent(event)}>
                            <DateBox $today={event.date === today}>
                              <strong>{event.date.slice(8, 10)}</strong>
                              <span>{dayjs(event.date).format('MMM')}</span>
                            </DateBox>
                            <Texts>
                              <Title title={eventSubject(event.title)}>{eventSubject(event.title)}</Title>
                              <Sub>
                                {relativeDay(event.date, today).replace(/^./, (c) => c.toUpperCase())} · {event.document.title}
                              </Sub>
                            </Texts>
                            <KindTag color={TAG_COLOR[group.tone]}>{group.label}</KindTag>
                          </button>
                        </Item>
                      );
                    })}
                  </List>
                )
              }
            </BlockBody>
          </SectionCard>

          <SectionCard
            title={
              <CardTitle>
                <NotificationOutlined /> Publicações relevantes
              </CardTitle>
            }
            extra={<LinkButton onClick={() => navigate(publicationsPath({ from: publicationsFrom }))}>Ver todas</LinkButton>}
            flush
          >
            <BlockBody block={publications}>
              {() =>
                recentPublications.length === 0 ? (
                  <Empty>Nenhuma publicação crítica ou alta nos últimos {RECENT_PUBLICATION_DAYS} dias.</Empty>
                ) : (
                  <List>
                    {recentPublications.map((pub) => (
                      <Item key={pub.id}>
                        <button type="button" onClick={() => navigate(publicationsPath({}), { state: { openPublication: pub } })}>
                          <Texts>
                            <Title title={pub.title}>{pub.title}</Title>
                            <Sub>{[pub.publishedAt && formatPublicationDate(pub.publishedAt), pub.organ || pub.actType].filter(Boolean).join(' · ')}</Sub>
                          </Texts>
                          <StatusBadge tone={RELEVANCE[pub.relevance].tone}>{RELEVANCE[pub.relevance].label}</StatusBadge>
                        </button>
                      </Item>
                    ))}
                  </List>
                )
              }
            </BlockBody>
          </SectionCard>
        </Stack>

        <Stack>
          <SectionCard
            title={
              <CardTitle>
                <WalletOutlined /> Em aberto há mais tempo
              </CardTitle>
            }
            extra={<LinkButton onClick={() => navigate(RECEIPTS_PATH)}>Recebimentos</LinkButton>}
            flush
          >
            <BlockBody block={receipts}>
              {(data) => {
                const clients = oldestOpenClients(data.items, data.balances);
                return clients.length === 0 ? (
                  <Empty>Nenhum cliente com valor em aberto.</Empty>
                ) : (
                  <List>
                    {clients.map((c) => (
                      <Item key={c.clientId}>
                        <button type="button" onClick={() => navigate(RECEIPTS_PATH)}>
                          <Texts>
                            <Title title={c.name}>{c.name}</Title>
                            <Sub>{c.since ? `em aberto desde ${formatDate(c.since)} (${relativeDay(c.since, today)})` : 'em aberto'}</Sub>
                          </Texts>
                          <StatusBadge tone="warning">
                            <Money>{formatMoney(c.amount)}</Money>
                          </StatusBadge>
                        </button>
                      </Item>
                    ))}
                  </List>
                );
              }}
            </BlockBody>
          </SectionCard>

          <SectionCard
            title={
              <CardTitle>
                <FileDoneOutlined /> DAS de {periodLabel(dasPeriod)}
              </CardTitle>
            }
            extra={<LinkButton onClick={() => navigate(DAS_PATH)}>Geração de DAS</LinkButton>}
            flush
          >
            <BlockBody block={das} rows={2}>
              {(data) => {
                const counts = dasCounts(data.items);
                if (counts.total === 0) return <Empty>Nenhum cliente MEI ativo.</Empty>;
                return (
                  <List>
                    <Item>
                      <button type="button" onClick={() => navigate(DAS_PATH)}>
                        <Texts>
                          <Title>{counts.pending ? `${counts.pending} de ${counts.total} sem guia gerada` : 'Todas as guias foram geradas'}</Title>
                          <Sub>
                            vence em {formatDate(data.dueDate)} ({relativeDay(data.dueDate, today)})
                            {counts.unpaid ? ` · ${counts.unpaid} gerada${counts.unpaid > 1 ? 's' : ''} sem pagamento` : ''}
                          </Sub>
                        </Texts>
                        <StatusBadge tone={counts.pending ? 'warning' : 'success'}>{counts.pending ? 'Pendente' : 'Em dia'}</StatusBadge>
                      </button>
                    </Item>
                  </List>
                );
              }}
            </BlockBody>
          </SectionCard>

          <SectionCard
            title={
              <CardTitle>
                <ProjectOutlined /> Projetos
              </CardTitle>
            }
            extra={<LinkButton onClick={() => navigate('/projetos')}>Portal de Projetos</LinkButton>}
            flush
          >
            <BlockBody block={projects} rows={2}>
              {() =>
                projectDeadlines.length === 0 ? (
                  <Empty>Nenhum projeto atrasado ou terminando nesta semana.</Empty>
                ) : (
                  <List>
                    {projectDeadlines.slice(0, LIST_LIMIT).map(({ project, deadline }) => (
                      <Item key={project.id}>
                        <button type="button" onClick={() => navigate(`/projetos/${encodeURIComponent(project.id)}`)}>
                          <Texts>
                            <Title title={project.name}>{project.name}</Title>
                            <Sub>{deadline.label}</Sub>
                          </Texts>
                          <StatusBadge tone={deadline.tone}>{deadlineChip(deadline)}</StatusBadge>
                        </button>
                      </Item>
                    ))}
                  </List>
                )
              }
            </BlockBody>
          </SectionCard>

          <SectionCard
            title={
              <CardTitle>
                <FileSyncOutlined /> Documentos alterados
              </CardTitle>
            }
            extra={<LinkButton onClick={() => navigate(`${CALENDAR_PATH}?aba=documentos`)}>Documentos</LinkButton>}
            flush
          >
            <BlockBody block={changed} rows={3}>
              {(page) =>
                page.items.length === 0 ? (
                  <Empty>Nenhum documento com versão nova.</Empty>
                ) : (
                  <List>
                    {page.items.slice(0, 5).map((doc) => (
                      <Item key={doc.id}>
                        <button type="button" onClick={() => openDocument(doc.id)}>
                          <Texts>
                            <Title title={doc.title}>{doc.title}</Title>
                            <Sub>
                              {doc.versionCount} versões · alterado em {formatDate(doc.updatedAt.slice(0, 10))}
                            </Sub>
                          </Texts>
                        </button>
                      </Item>
                    ))}
                  </List>
                )
              }
            </BlockBody>
          </SectionCard>
        </Stack>
      </Columns>

      {calendarStatus.data && <EventModal event={openEvent} status={calendarStatus.data} onClose={() => setOpenEvent(null)} />}
    </Page>
  );
}
