import { FLOWER_PRODUCTS } from '../data/flower-data';
import { NewOrder, Order, OrderLine, OrderStatus, PAY_METHODS } from './order.model';

const DAY = 86_400_000;
const DELIVERY_FEE = 40;
const iso = (t: number): string => {
  const d = new Date(t);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const slotText = (from: number): string => {
  const f = (h: number): string => `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}`;
  return `${f(from)} – ${f(from + 2)}`;
};

const item = (productIndex: number, qty = 1): OrderLine => {
  const p = FLOWER_PRODUCTS[productIndex];
  return { name: p.nameAr, qty, unitPrice: p.price, imageId: p.imageId, kind: 'item' };
};
const extra = (name: string, unitPrice: number): OrderLine => ({ name, qty: 1, unitPrice, kind: 'extra' });
const custom = (name: string, unitPrice: number, details: string[], swatches: string[]): OrderLine => ({
  name,
  qty: 1,
  unitPrice,
  details,
  swatches,
  kind: 'item',
});
const sum = (lines: readonly OrderLine[]): number => lines.reduce((n, l) => n + l.qty * l.unitPrice, 0);

interface Seed {
  /** Days before now the order came in (0 = today) and the hour. */
  readonly ago: number;
  readonly hour: number;
  readonly status: OrderStatus;
  readonly name: string;
  readonly phone: string;
  readonly to?: string;
  readonly address?: string;
  /** Delivery day relative to today (0 = today, 1 = tomorrow) and the slot start. */
  readonly day: number;
  readonly from: number;
  readonly lines: readonly OrderLine[];
  readonly card?: string;
  readonly sign?: string;
  readonly notes?: string;
  readonly source?: 'site' | 'studio';
}

const SEEDS: readonly Seed[] = [
  { ago: 0, hour: 0, status: 'new', name: 'أحمد سمير', phone: '01000000101', to: 'منى سمير', address: 'طنطا - شارع الجيش، برج النور، الدور الرابع', day: 0, from: 18, lines: [item(0), extra('بطاقة رسالة', 15)], card: 'كل سنة وإنتي طيبة يا قلبي', sign: 'أحمد' },
  { ago: 0, hour: 0, status: 'new', name: 'سارة إبراهيم', phone: '01000000102', to: 'ندى إبراهيم', address: 'طنطا - السكة الجديدة، عمارة 12', day: 1, from: 12, lines: [item(2), extra('بالون هيليوم', 90)], notes: 'لو سمحتوا التغليف وردي فاتح' },
  { ago: 0, hour: 1, status: 'preparing', name: 'محمد خالد', phone: '01000000103', to: 'هبة محمد', address: 'طنطا - الاستاد، عمارة 7 شقة 9', day: 0, from: 20, lines: [item(1), extra('فيريرو روشيه', 150), extra('بطاقة رسالة', 15)], card: 'هتفضلي دايمًا أجمل حاجة في حياتي', sign: 'محمد' },
  { ago: 0, hour: 2, status: 'new', name: 'يوسف حسن', phone: '01000000104', address: 'طنطا - شارع النحاس، عمارة 5', day: 0, from: 16, lines: [custom('باقة من تصميم العميل', 1236, ['40 جوري (26 أحمر + 14 أبيض)', 'جيبسوفيلا (4)', 'تغليف أسود', 'شريط ذهبي'], ['#c8102e', '#f7f3ee', '#111'])], source: 'studio' },
  { ago: 1, hour: 15, status: 'delivering', name: 'نورهان مصطفى', phone: '01000000105', to: 'أمل مصطفى', address: 'المحلة الكبرى - شارع سعد زغلول', day: 0, from: 14, lines: [item(5), extra('دبدوب', 180)], card: 'ألف مبروك التخرج', sign: 'نورهان' },
  { ago: 1, hour: 11, status: 'done', name: 'عمر طارق', phone: '01000000106', to: 'ريم طارق', address: 'طنطا - سيجر، شارع الأمير', day: -1, from: 18, lines: [item(0), extra('بالون هيليوم', 90)], card: 'سنة جديدة أحلى', sign: 'عمر' },
  { ago: 2, hour: 17, status: 'done', name: 'هبة فتحي', phone: '01000000107', day: -2, from: 16, lines: [item(3, 2)], notes: 'استلام من المحل' },
  { ago: 2, hour: 13, status: 'done', name: 'محمد خالد', phone: '01000000103', to: 'جنى كريم', address: 'كفر الزيات - شارع الجمهورية', day: -1, from: 12, lines: [item(1), extra('دبدوب', 180)], card: 'بحبك', sign: 'كريم' },
  { ago: 3, hour: 19, status: 'done', name: 'آية محمود', phone: '01000000109', to: 'سلمى محمود', address: 'طنطا - شارع البحر، عمارة الأمل', day: -2, from: 20, lines: [item(4), extra('ألواح شوكولاتة', 120)] },
  { ago: 3, hour: 12, status: 'cancelled', name: 'مصطفى رضا', phone: '01000000110', day: -3, from: 14, lines: [item(2)], notes: 'العميل غيّر رأيه' },
  { ago: 4, hour: 16, status: 'done', name: 'سارة إبراهيم', phone: '01000000102', to: 'أسماء سعيد', address: 'السنطة - شارع المحطة', day: -3, from: 18, lines: [item(5), extra('بطاقة رسالة', 15)], card: 'مبروك الخطوبة', sign: 'دعاء' },
  { ago: 4, hour: 10, status: 'done', name: 'إسلام جمال', phone: '01000000112', to: 'مي إسلام', address: 'طنطا - الجلاء، عمارة 3', day: -4, from: 12, lines: [custom('باقة من تصميم العميل', 823, ['25 جوري أحمر', 'جيبسوفيلا (3)', 'تغليف أسود', 'شريط ذهبي'], ['#c8102e', '#111'])], source: 'studio' },
  { ago: 5, hour: 18, status: 'done', name: 'شيرين عادل', phone: '01000000113', to: 'أمي', address: 'طنطا - شارع الحلو، الدور الثاني', day: -4, from: 16, lines: [item(5), extra('ألواح شوكولاتة', 120)], card: 'كل سنة وإنتي أحلى أم', sign: 'شيرين' },
  { ago: 5, hour: 14, status: 'done', name: 'محمد خالد', phone: '01000000103', to: 'نهى طارق', address: 'طنطا - كفر المصيلحة', day: -5, from: 14, lines: [item(0), extra('فيريرو روشيه', 150)] },
  { ago: 6, hour: 20, status: 'done', name: 'رنا أيمن', phone: '01000000115', day: -5, from: 18, lines: [item(4, 2)] },
  { ago: 6, hour: 11, status: 'done', name: 'أحمد سمير', phone: '01000000101', to: 'دينا باسم', address: 'طنطا - الاستاد، شارع النحاس', day: -6, from: 12, lines: [item(1), extra('بطاقة رسالة', 15)], card: 'أحلى سنة معاكي', sign: 'باسم' },
];

/** Sample orders for the demo (relative to now, so the dashboard always looks alive). */
export function demoOrders(now = Date.now()): Order[] {
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  return SEEDS.map((s, i): Order => {
    // Today's orders came in a little while ago; older ones at their hour of that day.
    const created = s.ago === 0 ? now - (s.hour * 3600_000 + (i + 1) * 420_000) : midnight.getTime() - s.ago * DAY + s.hour * 3600_000;
    // Finished orders are paid; a few in-progress ones were paid up front (transfer / Instapay).
    const paid = s.status === 'done' || (s.status !== 'cancelled' && i % 3 === 2);
    const base: NewOrder = {
      source: s.source ?? 'site',
      customerName: s.name,
      customerPhone: s.phone,
      recipientName: s.to,
      mode: s.address ? 'delivery' : 'pickup',
      address: s.address,
      whenIso: iso(now + s.day * DAY),
      slot: slotText(s.from),
      slotFrom: s.from,
      lines: s.lines,
      cardMessage: s.card,
      cardSign: s.sign,
      notes: s.notes,
      deliveryFee: s.address ? DELIVERY_FEE : 0,
      total: sum(s.lines) + (s.address ? DELIVERY_FEE : 0),
      payStatus: paid ? 'paid' : 'unpaid',
      payMethod: paid ? PAY_METHODS[i % PAY_METHODS.length].id : undefined,
      demo: true,
    };
    // The list runs newest first, so the newest order gets the highest number.
    return { ...base, id: `SF-${1000 + SEEDS.length - i}`, createdAt: created, status: s.status };
  });
}
