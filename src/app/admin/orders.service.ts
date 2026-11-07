import { Injectable, computed, signal } from '@angular/core';
import { demoOrders } from './demo-orders';
import { NewOrder, Order, OrderStatus, PayMethod, PayStatus } from './order.model';

const KEY = 'sky-flower.orders.v1';
export const SEEDED_KEY = 'sky-flower.orders.seeded.v1';

/**
 * The shop's orders. For the demo they live in this browser's localStorage, which is enough to show the
 * whole loop: a customer orders on the site, the order appears in the admin (even live, in another tab).
 * Swapping it for a real API later only touches this class.
 */
@Injectable({ providedIn: 'root' })
export class OrdersService {
  readonly orders = signal<readonly Order[]>(this.read());

  /** Newest first. */
  readonly sorted = computed(() => [...this.orders()].sort((a, b) => b.createdAt - a.createdAt));
  readonly newCount = computed(() => this.orders().filter((o) => o.status === 'new').length);
  readonly hasDemo = computed(() => this.orders().some((o) => o.demo));

  constructor() {
    // Another tab (the storefront) placed an order: pick it up.
    globalThis.addEventListener?.('storage', (e: StorageEvent) => {
      if (e.key === KEY) this.orders.set(this.read());
    });
  }

  create(input: NewOrder): Order {
    const last = Math.max(1000, ...this.orders().map((o) => Number(o.id.replace(/\D/g, '')) || 0));
    const order: Order = { ...input, id: `SF-${last + 1}`, createdAt: Date.now(), status: 'new' };
    this.commit([...this.orders(), order]);
    return order;
  }

  get(id: string): Order | undefined {
    return this.orders().find((o) => o.id === id);
  }

  setStatus(id: string, status: OrderStatus): void {
    this.update(id, { status });
  }

  update(id: string, patch: Partial<Omit<Order, 'id' | 'createdAt'>>): void {
    this.commit(this.orders().map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }

  /** Paid / unpaid, with how it was paid. */
  setPayment(id: string, payStatus: PayStatus, payMethod?: PayMethod): void {
    this.update(id, { payStatus, payMethod: payStatus === 'paid' ? payMethod : undefined });
  }

  /** Changes the delivery fee and moves the total with it. */
  setDeliveryFee(id: string, fee: number): void {
    const order = this.get(id);
    if (!order || !Number.isFinite(fee) || fee < 0) return;
    const next = Math.round(fee);
    this.update(id, { deliveryFee: next, total: order.total - (order.deliveryFee ?? 0) + next });
  }

  remove(id: string): void {
    this.commit(this.orders().filter((o) => o.id !== id));
  }

  /** Replaces everything (restoring a backup). Anything that is not an order is dropped. */
  replaceAll(orders: readonly Order[]): void {
    this.setFlag(SEEDED_KEY);
    this.commit(orders.filter((o) => o && typeof o.id === 'string' && Array.isArray(o.lines)));
  }

  /** Fills the admin with sample orders the first time it is opened. */
  seedDemoOnce(): void {
    if (this.flag(SEEDED_KEY)) return;
    this.setFlag(SEEDED_KEY);
    if (this.orders().length === 0) this.commit(demoOrders());
  }

  restoreDemo(): void {
    this.setFlag(SEEDED_KEY);
    this.commit([...this.orders().filter((o) => !o.demo), ...demoOrders()]);
  }

  clearDemo(): void {
    this.commit(this.orders().filter((o) => !o.demo));
  }

  // ---- persistence (guarded like the store: private mode must not break the app) --------
  private commit(next: readonly Order[]): void {
    this.orders.set(next);
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable - orders stay in memory */
    }
  }

  private read(): Order[] {
    try {
      const raw = globalThis.localStorage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as Order[]) : [];
    } catch {
      return [];
    }
  }

  private flag(key: string): boolean {
    try {
      return globalThis.localStorage?.getItem(key) === '1';
    } catch {
      return false;
    }
  }

  private setFlag(key: string): void {
    try {
      globalThis.localStorage?.setItem(key, '1');
    } catch {
      /* ignore */
    }
  }
}
