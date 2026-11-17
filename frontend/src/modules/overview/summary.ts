/** Numbers of the Visão Geral, computed from what the modules already return (no AI). */
import type { DasItem } from '@/modules/das/types';
import { pendingCharges, roundMoney } from '@/modules/receipts/format';
import type { ClientBalance, Receipt } from '@/modules/receipts/types';

export interface OpenClient {
  clientId: number;
  name: string;
  /** Still to receive (reais). */
  amount: number;
  /** Date of the oldest charge still unpaid (AAAA-MM-DD). */
  since: string;
}

/** Clients with something to receive, the oldest unpaid charge first. */
export function oldestOpenClients(items: Receipt[], balances: ClientBalance[], limit = 5): OpenClient[] {
  const byClient = new Map<number, Receipt[]>();
  for (const r of items) byClient.set(r.clientId, [...(byClient.get(r.clientId) ?? []), r]);
  return balances
    .filter((b) => roundMoney(b.balance) < 0)
    .map((b) => {
      const pending = pendingCharges(byClient.get(b.clientId) ?? []);
      return { clientId: b.clientId, name: b.name, amount: roundMoney(-b.balance), since: pending[0]?.receipt.receivedOn ?? '' };
    })
    .sort((a, b) => a.since.localeCompare(b.since) || b.amount - a.amount)
    .slice(0, limit);
}

/** Received and charged in one month (AAAA-MM), by the date of the entry. */
export function monthTotals(items: Receipt[], month: string) {
  const inMonth = items.filter((r) => r.receivedOn.startsWith(month));
  return {
    received: roundMoney(inMonth.reduce((sum, r) => sum + r.received, 0)),
    charged: roundMoney(inMonth.reduce((sum, r) => sum + r.charged, 0)),
    entries: inMonth.length,
  };
}

/** Total still to receive and how many clients owe something. */
export function openTotals(balances: ClientBalance[]) {
  const owing = balances.filter((b) => roundMoney(b.balance) < 0);
  return { amount: roundMoney(-owing.reduce((sum, b) => sum + b.balance, 0)), clients: owing.length };
}

/** DAS of one competência: guides still to issue and issued but not paid. */
export function dasCounts(items: Pick<DasItem, 'status'>[]) {
  return {
    total: items.length,
    pending: items.filter((i) => i.status === 'pendente').length,
    unpaid: items.filter((i) => i.status === 'gerada').length,
  };
}
