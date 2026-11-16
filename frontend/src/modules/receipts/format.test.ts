import { describe, expect, it } from 'vitest';

import { balanceState, pendingCharges, preview, roundMoney, serviceLabel, statement, totals, typeChoices } from '@/modules/receipts/format';
import type { ClientBalance, Receipt, ServiceType } from '@/modules/receipts/types';

describe('balanceState', () => {
  it('reads credit, open and settled', () => {
    expect(balanceState(50).label).toBe('Crédito');
    expect(balanceState(-20.5).text.replace(/\s/g, ' ')).toBe('Em aberto R$ 20,50');
    expect(balanceState(0.1 + 0.2 - 0.3).label).toBe('Quitado');
  });
});

describe('preview', () => {
  it('uses the credit to reduce what the client pays', () => {
    expect(preview(50, 300, 250)).toEqual({ toPay: 250, after: 0 });
    expect(preview(50, 300, 400)).toEqual({ toPay: 250, after: 150 });
    expect(preview(-100, 300, 300)).toEqual({ toPay: 300, after: -100 });
    expect(preview(500, 300, 0)).toEqual({ toPay: 0, after: 200 });
  });
});

describe('list helpers', () => {
  it('names the service and sums the period and the balances', () => {
    expect(serviceLabel({ serviceName: 'Imposto de renda (IRPF)', serviceCode: 'irpf', description: 'Fulano' })).toBe('Imposto de renda (IRPF)');
    expect(serviceLabel({ serviceName: 'Outro serviço', serviceCode: 'outro', description: 'Adiantamento' })).toBe('Adiantamento');

    const items = [
      { received: 350.1, charged: 300 },
      { received: 0.2, charged: 0 },
    ] as Receipt[];
    const balances = [{ balance: 50 }, { balance: 20 }, { balance: -80.3 }, { balance: 0 }] as ClientBalance[];
    expect(totals(items, balances)).toEqual({ received: 350.3, charged: 300, credit: 70, creditClients: 2, open: 80.3, openClients: 1 });
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(Object.is(roundMoney(-0), 0)).toBe(true);
    expect(totals([], [{ balance: 10 }] as ClientBalance[]).open).toBe(0);
  });
});

describe('typeChoices', () => {
  it('offers the active types and keeps the entry own type even if deactivated', () => {
    const types = [
      { id: 1, active: true },
      { id: 2, active: false },
      { id: 3, active: true },
    ] as ServiceType[];
    expect(typeChoices(types).map((t) => t.id)).toEqual([1, 3]);
    expect(typeChoices(types, 2).map((t) => t.id)).toEqual([1, 2, 3]);
  });
});

describe('report helpers', () => {
  const entry = (id: number, receivedOn: string, charged: number, received: number) => ({ id, receivedOn, charged, received }) as Receipt;
  const entries = [entry(3, '2026-03-10', 300, 0), entry(1, '2026-01-10', 300, 300), entry(2, '2026-02-10', 300, 100), entry(4, '2026-03-20', 0, 50)];

  it('runs the balance in date order', () => {
    expect(statement(entries).map((l) => [l.receipt.id, l.balance])).toEqual([
      [1, 0],
      [2, -200],
      [3, -500],
      [4, -450],
    ]);
  });

  it('covers the oldest charges first', () => {
    expect(pendingCharges(entries).map((p) => [p.receipt.id, p.paid, p.missing])).toEqual([
      [2, 150, 150],
      [3, 0, 300],
    ]);
    expect(pendingCharges([entry(1, '2026-01-10', 100, 150)])).toEqual([]);
  });
});
