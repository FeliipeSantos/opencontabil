import { LeftOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Flex, Modal, Table } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { ErrorState, LoadingState, StatusBadge } from '@/core/ui';
import { formatMoney } from '@/modules/clients/format';
import { receiptsApi } from '@/modules/receipts/api';
import { balanceState, PAYMENT_METHODS, type PendingCharge, pendingCharges, roundMoney, serviceLabel, statement, type StatementLine } from '@/modules/receipts/format';
import type { ClientBalance, Receipt, ReceiptListing } from '@/modules/receipts/types';
import { colors, radius, tones } from '@/theme';

const Summary = styled.div`
  border: 1px solid ${colors.border};
  border-radius: ${radius.card}px;
  background: ${colors.bgSubtle};
  padding: 12px 14px;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;

  @media (max-width: 560px) {
    grid-template-columns: minmax(0, 1fr);
  }
`;

const SummaryItem = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;

  > span {
    font-size: 12px;
    color: ${colors.textMuted};
  }

  small {
    font-size: 12px;
    color: ${colors.textSubtle};
  }
`;

const SummaryValue = styled.strong<{ $tone?: 'warning' | 'success' }>`
  font-size: 15px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: ${({ $tone }) => ($tone ? tones[$tone].fg : colors.textDark)};
`;

const Heading = styled.h3`
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: ${colors.navy};
`;

const Block = styled.section`
  & + & {
    margin-top: 20px;
  }
`;

const Money = styled.span`
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
`;

const Sub = styled.div`
  color: ${colors.textMuted};
  font-size: 12px;
`;

const ClientLink = styled(Button)`
  &&& {
    padding: 0;
    height: auto;
    font-weight: 500;
    text-align: left;
    white-space: normal;
    overflow-wrap: anywhere;
  }
`;

const Note = styled.p`
  margin: 0;
  color: ${colors.textMuted};
  font-size: 13px;
`;

const date = (value: string) => dayjs(value).format('DD/MM/YYYY');
const daysSince = (value: string) => Math.max(dayjs().startOf('day').diff(dayjs(value), 'day'), 0);
const ago = (value: string) => {
  const days = daysSince(value);
  return days === 0 ? 'hoje' : `há ${days} dia${days === 1 ? '' : 's'}`;
};

function ServiceCell({ receipt }: { receipt: Receipt }) {
  return (
    <div>
      <div>{serviceLabel(receipt)}</div>
      {receipt.period && <Sub>competência {dayjs(`${receipt.period}-01`).format('MM/YYYY')}</Sub>}
    </div>
  );
}

function PendingTable({ pending, showClient = false }: { pending: PendingCharge[]; showClient?: boolean }) {
  return (
    <Table<PendingCharge>
      size="small"
      rowKey={(p) => p.receipt.id}
      dataSource={pending}
      pagination={false}
      scroll={{ x: 640 }}
      columns={[
        { title: 'Data', key: 'date', width: 100, render: (_, p) => <Money>{date(p.receipt.receivedOn)}</Money> },
        ...(showClient ? [{ title: 'Cliente', key: 'client', render: (_: unknown, p: PendingCharge) => p.receipt.clientName }] : []),
        { title: 'Trabalho', key: 'service', render: (_, p) => <ServiceCell receipt={p.receipt} /> },
        { title: 'Cobrado', key: 'charged', align: 'right', width: 110, render: (_, p) => <Money>{formatMoney(p.receipt.charged)}</Money> },
        { title: 'Já pago', key: 'paid', align: 'right', width: 110, render: (_, p) => <Money>{formatMoney(p.paid)}</Money> },
        { title: 'Falta', key: 'missing', align: 'right', width: 110, render: (_, p) => <StatusBadge tone="warning">{formatMoney(p.missing)}</StatusBadge> },
        { title: 'Em aberto', key: 'age', width: 110, render: (_, p) => <Sub>{ago(p.receipt.receivedOn)}</Sub> },
      ]}
    />
  );
}

interface ClientRow {
  balance: ClientBalance;
  pending: PendingCharge[];
  oldest: string;
}

/** All clients with something to receive, the largest amount first. */
function AllClients({ rows, onPick }: { rows: ClientRow[]; onPick: (clientId: number) => void }) {
  const total = roundMoney(rows.reduce((sum, r) => sum - r.balance.balance, 0));
  const oldest = rows.map((r) => r.oldest).sort()[0];
  if (!rows.length) return <Note>Nenhum cliente com valor em aberto.</Note>;
  return (
    <>
      <Summary>
        <SummaryItem>
          <span>Total a receber</span>
          <SummaryValue $tone="warning">{formatMoney(total)}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>Clientes em aberto</span>
          <SummaryValue>{rows.length}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>Serviço mais antigo em aberto</span>
          <SummaryValue>{date(oldest)}</SummaryValue>
          <small>{ago(oldest)}</small>
        </SummaryItem>
      </Summary>

      <Block>
        <Heading>Por cliente</Heading>
        <Table<ClientRow>
          size="small"
          rowKey={(r) => r.balance.clientId}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 560 }}
          expandable={{ expandedRowRender: (r) => <PendingTable pending={r.pending} /> }}
          columns={[
            {
              title: 'Cliente',
              key: 'client',
              render: (_, r) => (
                <ClientLink type="link" onClick={() => onPick(r.balance.clientId)}>
                  {r.balance.name}
                </ClientLink>
              ),
            },
            { title: 'Serviços pendentes', key: 'count', align: 'right', width: 170, render: (_, r) => r.pending.length },
            { title: 'Em aberto desde', key: 'oldest', width: 150, render: (_, r) => <Money>{date(r.oldest)}</Money> },
            { title: 'A receber', key: 'open', align: 'right', width: 130, render: (_, r) => <StatusBadge tone="warning">{formatMoney(-r.balance.balance)}</StatusBadge> },
          ]}
        />
      </Block>
    </>
  );
}

/** One client: totals, the charges still missing and the statement with the running balance. */
function OneClient({ balance, entries }: { balance: ClientBalance; entries: Receipt[] }) {
  const pending = useMemo(() => pendingCharges(entries), [entries]);
  const lines = useMemo(() => statement(entries).reverse(), [entries]);
  const state = balanceState(balance.balance);
  return (
    <>
      <Summary>
        <SummaryItem>
          <span>Total cobrado</span>
          <SummaryValue>{formatMoney(balance.charged)}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>Total recebido</span>
          <SummaryValue>{formatMoney(balance.received)}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>{state.label === 'Crédito' ? 'Crédito do cliente' : 'A receber'}</span>
          <SummaryValue $tone={state.label === 'Crédito' ? 'success' : state.label === 'Em aberto' ? 'warning' : undefined}>
            {formatMoney(Math.abs(roundMoney(balance.balance)))}
          </SummaryValue>
        </SummaryItem>
      </Summary>

      {pending.length > 0 && (
        <Block>
          <Heading>O que falta pagar</Heading>
          <PendingTable pending={pending} />
        </Block>
      )}

      <Block>
        <Heading>Extrato</Heading>
        <Table<StatementLine>
          size="small"
          rowKey={(l) => l.receipt.id}
          dataSource={lines}
          pagination={lines.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
          scroll={{ x: 640 }}
          columns={[
            { title: 'Data', key: 'date', width: 100, render: (_, l) => <Money>{date(l.receipt.receivedOn)}</Money> },
            { title: 'Trabalho', key: 'service', render: (_, l) => <ServiceCell receipt={l.receipt} /> },
            { title: 'Cobrado', key: 'charged', align: 'right', width: 110, render: (_, l) => <Money>{formatMoney(l.receipt.charged)}</Money> },
            { title: 'Recebido', key: 'received', align: 'right', width: 110, render: (_, l) => <Money>{formatMoney(l.receipt.received)}</Money> },
            {
              title: 'Saldo',
              key: 'balance',
              align: 'right',
              width: 150,
              render: (_, l) => {
                const s = balanceState(l.balance);
                return s.label === 'Quitado' ? <Sub>Sem saldo</Sub> : <StatusBadge tone={s.tone}>{s.label === 'Crédito' ? `+${formatMoney(l.balance)}` : `-${formatMoney(-l.balance)}`}</StatusBadge>;
              },
            },
          ]}
        />
      </Block>
    </>
  );
}

interface Group {
  key: string;
  label: string;
  count: number;
  charged: number;
  received: number;
}

/** Sums entries by a key (client, work, payment method), the largest amount first. */
function groupBy(items: Receipt[], keyOf: (r: Receipt) => string, labelOf: (r: Receipt) => string, metric: Metric): Group[] {
  const map = new Map<string, Group>();
  for (const r of items) {
    const key = keyOf(r);
    const g = map.get(key) ?? { key, label: labelOf(r), count: 0, charged: 0, received: 0 };
    g.count += 1;
    g.charged = roundMoney(g.charged + r.charged);
    g.received = roundMoney(g.received + r.received);
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b[metric] - a[metric] || a.label.localeCompare(b.label));
}

type Metric = 'received' | 'charged';

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function GroupTable({ title, column, groups, metric, onPick }: { title: string; column: string; groups: Group[]; metric: Metric; onPick?: (key: string) => void }) {
  if (!groups.length) return null;
  return (
    <Block>
      <Heading>{title}</Heading>
      <Table<Group>
        size="small"
        rowKey="key"
        dataSource={groups}
        pagination={false}
        scroll={{ x: 480 }}
        columns={[
          {
            title: column,
            key: 'label',
            render: (_, g) =>
              onPick ? (
                <ClientLink type="link" onClick={() => onPick(g.key)}>
                  {g.label}
                </ClientLink>
              ) : (
                g.label
              ),
          },
          { title: 'Lançamentos', key: 'count', align: 'right', width: 120, render: (_, g) => g.count },
          {
            title: metric === 'received' ? 'Cobrado' : 'Recebido',
            key: 'other',
            align: 'right',
            width: 130,
            render: (_, g) => <Money>{formatMoney(metric === 'received' ? g.charged : g.received)}</Money>,
          },
          {
            title: metric === 'received' ? 'Recebido' : 'Cobrado',
            key: 'value',
            align: 'right',
            width: 130,
            render: (_, g) => <strong>{formatMoney(g[metric])}</strong>,
          },
        ]}
      />
    </Block>
  );
}

/** "Recebido" or "Cobrado" in the month shown on the page: totals and where the money came from. */
function MonthReport({ items, metric, onPick }: { items: Receipt[]; metric: Metric; onPick: (clientId: number) => void }) {
  const relevant = items.filter((r) => r[metric] !== 0);
  const total = roundMoney(items.reduce((sum, r) => sum + r[metric], 0));
  const charged = roundMoney(items.reduce((sum, r) => sum + r.charged, 0));
  const received = roundMoney(items.reduce((sum, r) => sum + r.received, 0));
  const difference = roundMoney(received - charged);
  const clients = new Set(relevant.map((r) => r.clientId)).size;

  if (!relevant.length) return <Note>{metric === 'received' ? 'Nenhum valor recebido neste mês.' : 'Nenhum valor cobrado neste mês.'}</Note>;
  return (
    <>
      <Summary>
        <SummaryItem>
          <span>{metric === 'received' ? 'Total recebido' : 'Total cobrado'}</span>
          <SummaryValue $tone={metric === 'received' ? 'success' : undefined}>{formatMoney(total)}</SummaryValue>
          <small>{plural(relevant.length, 'lançamento', 'lançamentos')}</small>
        </SummaryItem>
        <SummaryItem>
          <span>{metric === 'received' ? 'Clientes que pagaram' : 'Clientes cobrados'}</span>
          <SummaryValue>{clients}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>{difference < 0 ? 'Ficou em aberto no mês' : difference > 0 ? 'Pago a mais (virou crédito)' : 'Diferença no mês'}</span>
          <SummaryValue $tone={difference < 0 ? 'warning' : difference > 0 ? 'success' : undefined}>{formatMoney(Math.abs(difference))}</SummaryValue>
          <small>
            cobrado {formatMoney(charged)} · recebido {formatMoney(received)}
          </small>
        </SummaryItem>
      </Summary>

      <GroupTable
        title="Por cliente"
        column="Cliente"
        groups={groupBy(relevant, (r) => String(r.clientId), (r) => r.clientName, metric)}
        metric={metric}
        onPick={(key) => onPick(Number(key))}
      />
      <GroupTable title="Por trabalho" column="Trabalho" groups={groupBy(relevant, serviceLabel, serviceLabel, metric)} metric={metric} />
      {metric === 'received' && (
        <GroupTable
          title="Por forma de pagamento"
          column="Forma de pagamento"
          groups={groupBy(
            relevant,
            (r) => r.method ?? 'none',
            (r) => (r.method ? PAYMENT_METHODS[r.method] : 'Não informada'),
            metric,
          )}
          metric={metric}
        />
      )}

      <Block>
        <Heading>Lançamentos</Heading>
        <Table<Receipt>
          size="small"
          rowKey="id"
          dataSource={[...relevant].sort((a, b) => a.receivedOn.localeCompare(b.receivedOn) || a.id - b.id)}
          pagination={relevant.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
          scroll={{ x: 640 }}
          columns={[
            { title: 'Data', key: 'date', width: 100, render: (_, r) => <Money>{date(r.receivedOn)}</Money> },
            { title: 'Cliente', key: 'client', render: (_, r) => r.clientName },
            { title: 'Trabalho', key: 'service', render: (_, r) => <ServiceCell receipt={r} /> },
            { title: 'Cobrado', key: 'charged', align: 'right', width: 110, render: (_, r) => <Money>{formatMoney(r.charged)}</Money> },
            { title: 'Recebido', key: 'received', align: 'right', width: 110, render: (_, r) => <Money>{formatMoney(r.received)}</Money> },
          ]}
        />
      </Block>
    </>
  );
}

/** Clients whose payments went over what was charged: the credit used on the next services. */
function CreditClients({ balances, entries, onPick }: { balances: ClientBalance[]; entries: Map<number, Receipt[]>; onPick: (clientId: number) => void }) {
  const rows = balances.filter((b) => roundMoney(b.balance) > 0).sort((a, b) => b.balance - a.balance);
  if (!rows.length) return <Note>Nenhum cliente com crédito. O crédito aparece quando um cliente paga mais do que foi cobrado.</Note>;
  const total = roundMoney(rows.reduce((sum, b) => sum + b.balance, 0));
  const lastPayment = (id: number) =>
    (entries.get(id) ?? [])
      .filter((r) => r.received > 0)
      .map((r) => r.receivedOn)
      .sort()
      .pop();
  return (
    <>
      <Summary>
        <SummaryItem>
          <span>Total em créditos</span>
          <SummaryValue $tone="success">{formatMoney(total)}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>Clientes com crédito</span>
          <SummaryValue>{rows.length}</SummaryValue>
        </SummaryItem>
        <SummaryItem>
          <span>Maior crédito</span>
          <SummaryValue>{formatMoney(rows[0].balance)}</SummaryValue>
          <small>{rows[0].name}</small>
        </SummaryItem>
      </Summary>
      <Block>
        <Heading>Por cliente</Heading>
        <Table<ClientBalance>
          size="small"
          rowKey="clientId"
          dataSource={rows}
          pagination={false}
          scroll={{ x: 640 }}
          columns={[
            {
              title: 'Cliente',
              key: 'client',
              render: (_, b) => (
                <ClientLink type="link" onClick={() => onPick(b.clientId)}>
                  {b.name}
                </ClientLink>
              ),
            },
            {
              title: 'Último pagamento',
              key: 'last',
              width: 150,
              render: (_, b) => {
                const last = lastPayment(b.clientId);
                return <Money>{last ? date(last) : '—'}</Money>;
              },
            },
            { title: 'Total cobrado', key: 'charged', align: 'right', width: 130, render: (_, b) => <Money>{formatMoney(b.charged)}</Money> },
            { title: 'Total recebido', key: 'received', align: 'right', width: 130, render: (_, b) => <Money>{formatMoney(b.received)}</Money> },
            { title: 'Crédito', key: 'credit', align: 'right', width: 130, render: (_, b) => <StatusBadge tone="success">{formatMoney(b.balance)}</StatusBadge> },
          ]}
        />
      </Block>
    </>
  );
}

/** Which report is open. The month ones use the entries shown on the page. */
export type ReportView =
  | { kind: 'open' }
  | { kind: 'credit' }
  | { kind: 'client'; clientId: number }
  | { kind: 'month'; metric: Metric; label: string; items: Receipt[] };

function titleOf(view: ReportView, clientName?: string): string {
  switch (view.kind) {
    case 'open':
      return 'Relatório de valores a receber';
    case 'credit':
      return 'Relatório de créditos de clientes';
    case 'month':
      return `Relatório do ${view.metric === 'received' ? 'recebido' : 'cobrado'} em ${view.label}`;
    case 'client':
      return `Relatório do cliente${clientName ? `: ${clientName}` : ''}`;
  }
}

const BACK_LABEL: Record<Exclude<ReportView['kind'], 'client'>, string> = {
  open: 'Valores a receber',
  credit: 'Créditos de clientes',
  month: 'Relatório do mês',
};

interface ReceiptsReportProps {
  /** null: closed. */
  view: ReportView | null;
  /** Bumped by the page when entries change, so an open report reloads. */
  reloadKey: number;
  onShowEntries: (clientId: number) => void;
  onClose: () => void;
}

/** Reports opened from the indicators and from "Saldos dos clientes" on the Recebimentos page. */
export function ReceiptsReport({ view, reloadKey, onShowEntries, onClose }: ReceiptsReportProps) {
  const open = view !== null;
  const [listing, setListing] = useState<ReceiptListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // cliente aberto a partir de outro relatório: o rodapé mostra o botão de voltar
  const [picked, setPicked] = useState<number | null>(null);

  useEffect(() => setPicked(null), [view]);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setListing(null);
    setError(null);
    // todos os lançamentos, sem filtro de mês: o saldo vem da conta inteira do cliente
    receiptsApi
      .list()
      .then((data) => active && setListing(data))
      .catch((err) => active && !(err instanceof SessionExpiredError) && setError(errorMessage(err)));
    return () => {
      active = false;
    };
  }, [open, reloadKey, retry]);

  const byClient = useMemo(() => {
    const map = new Map<number, Receipt[]>();
    for (const r of listing?.items ?? []) map.set(r.clientId, [...(map.get(r.clientId) ?? []), r]);
    return map;
  }, [listing]);

  const rows = useMemo<ClientRow[]>(
    () =>
      (listing?.balances ?? [])
        .filter((b) => roundMoney(b.balance) < 0)
        .map((balance) => {
          const pending = pendingCharges(byClient.get(balance.clientId) ?? []);
          return { balance, pending, oldest: pending[0]?.receipt.receivedOn ?? '' };
        })
        .sort((a, b) => a.balance.balance - b.balance.balance),
    [listing, byClient],
  );

  const current: ReportView | null = picked !== null ? { kind: 'client', clientId: picked } : view;
  const clientId = current?.kind === 'client' ? current.clientId : null;
  const client = clientId === null ? null : (listing?.balances.find((b) => b.clientId === clientId) ?? null);

  function body() {
    if (!current) return null;
    if (current.kind === 'month') return <MonthReport items={current.items} metric={current.metric} onPick={setPicked} />;
    if (error) return <ErrorState message={error} onRetry={() => setRetry((n) => n + 1)} />;
    if (!listing) return <LoadingState rows={4} />;
    if (current.kind === 'open') return <AllClients rows={rows} onPick={setPicked} />;
    if (current.kind === 'credit') return <CreditClients balances={listing.balances} entries={byClient} onPick={setPicked} />;
    return client ? <OneClient balance={client} entries={byClient.get(client.clientId) ?? []} /> : <Note>Este cliente não tem lançamentos.</Note>;
  }

  return (
    <Modal
      title={current ? titleOf(current, client?.name) : ''}
      open={open}
      width={920}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Flex justify="space-between" gap={8} wrap>
          <span>
            {picked !== null && view && view.kind !== 'client' && (
              <Button icon={<LeftOutlined />} onClick={() => setPicked(null)}>
                {BACK_LABEL[view.kind]}
              </Button>
            )}
          </span>
          <Flex gap={8}>
            {clientId !== null && (
              <Button icon={<UnorderedListOutlined />} onClick={() => onShowEntries(clientId)}>
                Ver lançamentos
              </Button>
            )}
            <Button type="primary" onClick={onClose}>
              Fechar
            </Button>
          </Flex>
        </Flex>
      }
    >
      {body()}
    </Modal>
  );
}
