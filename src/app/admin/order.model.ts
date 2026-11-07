/** Orders as the admin sees them (mock data in the browser for now; a real API later). */

export type OrderStatus = 'new' | 'preparing' | 'delivering' | 'done' | 'cancelled';
/** site = the bag, studio = quick order from the studio, manual = typed in by the shop (phone / WhatsApp). */
export type OrderSource = 'site' | 'studio' | 'manual';
export type PayStatus = 'unpaid' | 'paid';
export type PayMethod = 'cash' | 'transfer' | 'instapay' | 'wallet';
export type OrderMode = 'delivery' | 'pickup';

export interface OrderLine {
  readonly name: string;
  readonly qty: number;
  readonly unitPrice: number;
  /** Composition of a studio bouquet, one entry per line. */
  readonly details?: readonly string[];
  readonly imageId?: string;
  readonly swatches?: readonly string[];
  /** `extra` lines are add-ons (Ferrero, balloon, message card...). */
  readonly kind?: 'item' | 'extra';
}

export interface Order {
  readonly id: string;
  readonly createdAt: number;
  readonly source: OrderSource;
  readonly status: OrderStatus;
  readonly customerName: string;
  readonly customerPhone: string;
  readonly recipientName?: string;
  readonly recipientPhone?: string;
  readonly mode: OrderMode;
  readonly address?: string;
  /** Delivery / pick-up day as `YYYY-MM-DD`; empty when it is still to be agreed on WhatsApp. */
  readonly whenIso: string;
  readonly slot: string;
  /** Start hour of the slot, for sorting. */
  readonly slotFrom?: number;
  readonly lines: readonly OrderLine[];
  readonly cardMessage?: string;
  readonly cardSign?: string;
  readonly notes?: string;
  /** What the customer owes, delivery fee included. */
  readonly total: number;
  /** The delivery part of `total` (0 / absent for pick-up). */
  readonly deliveryFee?: number;
  /** Absent on orders from before payments were tracked: they count as unpaid. */
  readonly payStatus?: PayStatus;
  readonly payMethod?: PayMethod;
  /** For the team only; the customer never sees it. */
  readonly internalNote?: string;
  /** Sample data that the "clear demo data" button removes. */
  readonly demo?: boolean;
}

export type NewOrder = Omit<Order, 'id' | 'createdAt' | 'status'>;

export const STATUS_FLOW: readonly OrderStatus[] = ['new', 'preparing', 'delivering', 'done'];
export const ALL_STATUSES: readonly OrderStatus[] = [...STATUS_FLOW, 'cancelled'];

const LABELS: Readonly<Record<OrderStatus, string>> = {
  new: 'جديد',
  preparing: 'بيتجهز',
  delivering: 'في الطريق',
  done: 'اتسلّم',
  cancelled: 'ملغي',
};

export function statusLabel(status: OrderStatus, mode: OrderMode = 'delivery'): string {
  if (mode === 'pickup') {
    if (status === 'delivering') return 'جاهز للاستلام';
    if (status === 'done') return 'اتستلم';
  }
  return LABELS[status];
}

/** The action that moves an order forward (the button text). */
export function advanceLabel(status: OrderStatus, mode: OrderMode = 'delivery'): string | null {
  switch (status) {
    case 'new':
      return 'ابدأ التجهيز';
    case 'preparing':
      return mode === 'pickup' ? 'جاهز للاستلام' : 'خرج للتوصيل';
    case 'delivering':
      return mode === 'pickup' ? 'تم الاستلام' : 'تم التسليم';
    default:
      return null;
  }
}

export function nextStatus(status: OrderStatus): OrderStatus | null {
  const i = STATUS_FLOW.indexOf(status);
  return i >= 0 && i < STATUS_FLOW.length - 1 ? STATUS_FLOW[i + 1] : null;
}

/** `01012345678` -> `201012345678` (the format wa.me wants). Empty when there is no number. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10) return '';
  if (digits.startsWith('20')) return digits;
  return digits.startsWith('0') ? `20${digits.slice(1)}` : `20${digits}`;
}

/** A ready-to-send WhatsApp update for the customer, by status. */
export function customerUpdate(order: Order): string {
  const name = order.customerName.split(' ')[0];
  switch (order.status) {
    case 'preparing':
      return `أهلاً ${name} 🌸\nطلبك رقم ${order.id} بيتجهز دلوقتي على إيد الفلورست عندنا 💐`;
    case 'delivering':
      return order.mode === 'pickup'
        ? `أهلاً ${name} 🌸\nطلبك رقم ${order.id} جاهز للاستلام من المحل.`
        : `أهلاً ${name} 🌸\nطلبك رقم ${order.id} خرج للتوصيل وهيوصلك في ميعاده 🚚`;
    case 'done':
      return `شكرًا ليك يا ${name} 🌸\nنتمنى الباقة تعجبكم! لو عندك أي ملاحظة قولنا.`;
    case 'cancelled':
      return `أهلاً ${name}\nتم إلغاء الطلب رقم ${order.id}. لو احتجت أي حاجة إحنا موجودين 🌸`;
    default:
      return `أهلاً ${name} 🌸\nوصلنا طلبك رقم ${order.id}، وبنراجع التفاصيل ونأكد معاك حالًا.`;
  }
}

export const PAY_METHODS: readonly { readonly id: PayMethod; readonly label: string }[] = [
  { id: 'cash', label: 'كاش عند الاستلام' },
  { id: 'transfer', label: 'تحويل بنكي' },
  { id: 'instapay', label: 'إنستاباي' },
  { id: 'wallet', label: 'محفظة (فودافون كاش)' },
];

export const payMethodLabel = (m: PayMethod | undefined): string => PAY_METHODS.find((p) => p.id === m)?.label ?? '';

/** A cancelled order owes nothing; otherwise it is paid when marked so. */
export const isPaid = (o: Order): boolean => o.payStatus === 'paid';
export const amountDue = (o: Order): number => (o.status === 'cancelled' || isPaid(o) ? 0 : o.total);

export const SOURCE_LABEL: Readonly<Record<OrderSource, string>> = {
  site: 'سلة الموقع',
  studio: 'الأستوديو',
  manual: 'تليفون / واتساب',
};