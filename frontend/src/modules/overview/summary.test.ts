import { describe, expect, it } from 'vitest';

import { dasCounts, monthTotals, oldestOpenClients, openTotals } from '@/modules/overview/summary';
import type { ClientBalance, Receipt } from '@/modules/receipts/types';

const entry = (id: number, clientId: number, receivedOn: string, charged: number, received: number) => ({ id, clientId, receivedOn, charged, received }) as Receipt;
const balance = (clientId: number, name: string, value: number) => ({ clientId, name, charged: 0, received: 0, balance: value }) as ClientBalance;

describe('overview summary', () => {
  const items = [
    entry(1, 1, '2026-09-10', 100, 0),
    entry(2, 1, '2026-11-05', 100, 150),
    entry(3, 2, '2026-11-10', 30, 0),
    entry(4, 3, '2026-11-12', 50, 80),
  ];
  const balances = [balance(1, 'Ana', -50), balance(2, 'Bruno', -30), balance(3, 'Carla', 30)];

  it('lists the clients that owe, the oldest unpaid charge first', () => {
    expect(oldestOpenClients(items, balances)).toEqual([
      // os R$ 150 pagos cobrem a cobrança de setembro: falta a de novembro
      { clientId: 1, name: 'Ana', amount: 50, since: '2026-11-05' },
      { clientId: 2, name: 'Bruno', amount: 30, since: '2026-11-10' },
    ]);
    expect(oldestOpenClients(items, balances, 1)).toHaveLength(1);
  });

  it('sums the month and what is still open', () => {
    expect(monthTotals(items, '2026-11')).toEqual({ received: 230, charged: 180, entries: 3 });
    expect(openTotals(balances)).toEqual({ amount: 80, clients: 2 });
  });

  it('counts the DAS still to issue and not paid', () => {
    expect(dasCounts([{ status: 'pendente' }, { status: 'gerada' }, { status: 'paga' }, { status: 'pendente' }])).toEqual({ total: 4, pending: 2, unpaid: 1 });
  });
});
