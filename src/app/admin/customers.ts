import { Order, waNumber } from './order.model';

export type CustomerTag = 'new' | 'repeat' | 'vip';

export interface Customer {
  /** The WhatsApp-format number: one customer, however the number was typed. */
  readonly key: string;
  readonly name: string;
  readonly phone: string;
  /** Newest first. */
  readonly orders: readonly Order[];
  /** Orders that were not cancelled. */
  readonly count: number;
  readonly spent: number;
  readonly lastAt: number;
  readonly tag: CustomerTag;
}

export const TAG_LABEL: Readonly<Record<CustomerTag, string>> = {
  new: 'جديد',
  repeat: 'بيرجع تاني',
  vip: 'عميل مميز',
};

/** Three orders or 5,000 EGP and the shop should know the name. */
const VIP_ORDERS = 3;
const VIP_SPENT = 5000;

/**
 * Customers are worked out from the orders (same phone = same person). Orders without a phone
 * (a quick order from the studio) cannot be tied to anyone, so they are left out.
 */
export function buildCustomers(orders: readonly Order[]): Customer[] {
  const groups = new Map<string, Order[]>();
  for (const order of orders) {
    const key = waNumber(order.customerPhone);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), order]);
  }

  return [...groups.entries()]
    .map(([key, list]): Customer => {
      const sorted = [...list].sort((a, b) => b.createdAt - a.createdAt);
      const live = sorted.filter((o) => o.status !== 'cancelled');
      const spent = live.reduce((sum, o) => sum + o.total, 0);
      const tag: CustomerTag = live.length >= VIP_ORDERS || spent >= VIP_SPENT ? 'vip' : live.length >= 2 ? 'repeat' : 'new';
      return {
        key,
        name: sorted[0].customerName,
        phone: sorted[0].customerPhone,
        orders: sorted,
        count: live.length,
        spent,
        lastAt: sorted[0].createdAt,
        tag,
      };
    })
    .sort((a, b) => b.lastAt - a.lastAt);
}
