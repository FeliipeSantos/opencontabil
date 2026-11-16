import { LeftOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Button, Flex, Modal, Table } from 'antd';
import dayjs from 'dayjs';
import { useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';

import { errorMessage, SessionExpiredError } from '@/core/api/client';
import { ErrorState, LoadingState, StatusBadge } from '@/core/ui';
import { formatMoney } from '@/modules/clients/format';
import { receiptsApi } from '@/modules/receipts/api';
import { balanceState, type PendingCharge, pendingCharges, roundMoney, serviceLabel, statement, type StatementLine } from '@/modules/receipts/format';
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

interface ReceivablesReportProps {
  open: boolean;
  /** null: every client with something to receive; a client: that client's report. */
  clientId: number | null;
  /** Bumped by the page when entries change, so an open report reloads. */
  reloadKey: number;
  onShowEntries: (clientId: number) => void;
  onClose: () => void;
}

/** Report opened from "A receber" and "Saldos dos clientes": what each client still owes and why. */
export function ReceivablesReport({ open, clientId, reloadKey, onShowEntries, onClose }: ReceivablesReportProps) {
  const [listing, setListing] = useState<ReceiptListing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // cliente aberto dentro do relatório; "fromAll" mostra o botão de voltar para a lista
  const [picked, setPicked] = useState<number | null>(clientId);
  const [fromAll, setFromAll] = useState(false);

  useEffect(() => {
    setPicked(clientId);
    setFromAll(false);
  }, [clientId, open]);

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

  const client = picked === null ? null : (listing?.balances.find((b) => b.clientId === picked) ?? null);

  return (
    <Modal
      title={picked === null ? 'Relatório de valores a receber' : `Relatório do cliente${client ? `: ${client.name}` : ''}`}
      open={open}
      width={920}
      onCancel={onClose}
      destroyOnHidden
      footer={
        <Flex justify="space-between" gap={8} wrap>
          <span>
            {picked !== null && fromAll && (
              <Button icon={<LeftOutlined />} onClick={() => setPicked(null)}>
                Todos os clientes
              </Button>
            )}
          </span>
          <Flex gap={8}>
            {picked !== null && (
              <Button icon={<UnorderedListOutlined />} onClick={() => onShowEntries(picked)}>
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
      {error ? (
        <ErrorState message={error} onRetry={() => setRetry((n) => n + 1)} />
      ) : !listing ? (
        <LoadingState rows={4} />
      ) : picked === null ? (
        <AllClients
          rows={rows}
          onPick={(id) => {
            setPicked(id);
            setFromAll(true);
          }}
        />
      ) : client ? (
        <OneClient balance={client} entries={byClient.get(client.clientId) ?? []} />
      ) : (
        <Note>Este cliente não tem lançamentos.</Note>
      )}
    </Modal>
  );
}
