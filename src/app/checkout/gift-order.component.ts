import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { OrderLine } from '../admin/order.model';
import { OrdersService } from '../admin/orders.service';
import { I18nService } from '../core/i18n.service';
import { PageNavService } from '../core/page-nav.service';
import { StoreService } from '../core/store.service';
import { BRAND, whatsappLink } from '../data/brand';
import { formatEgp, unsplashUrl } from '../data/flower-data';
import { ADDON_ICON_PATHS, ADDON_OPTIONS, AddonOption } from '../data/studio-data';

type Mode = 'delivery' | 'pickup';
type Field = 'date' | 'slot' | 'senderName' | 'senderPhone' | 'recipientName' | 'address';

/** Two-hour delivery windows inside the shop's opening hours (9 AM - 10 PM). */
const SLOTS: readonly { readonly id: string; readonly from: number; readonly to: number }[] = [10, 12, 14, 16, 18, 20].map(
  (h) => ({ id: `${h}-${h + 2}`, from: h, to: h + 2 }),
);

/** Message-card price (same add-on the Studio sells). */
const CARD = ADDON_OPTIONS.find((a) => a.id === 'card');
const EXTRAS: readonly AddonOption[] = ADDON_OPTIONS.filter((a) => a.id !== 'card');
const MESSAGE_MAX = 180;

/** Copy for this block, [English, Arabic]. */
const COPY = {
  mode: ['How would you like it?', 'عايزها إزاي؟'],
  delivery: ['Delivery', 'توصيل'],
  deliveryNote: ['To any governorate', 'لكل المحافظات'],
  pickup: ['Pick up', 'استلام من المحل'],
  pickupNote: ['From our Tanta shop', 'من محلنا في طنطا'],
  s1: ['Choose the moment', 'اختر اللحظة'],
  s1x: ['Pick the date and a two-hour slot - we arrive when it matters.', 'حدد اليوم وفترة من ساعتين — نصل في الوقت الذي يهم.'],
  s1p: ['Pick-up time', 'ميعاد الاستلام'],
  today: ['Today', 'النهارده'],
  tomorrow: ['Tomorrow', 'بكرة'],
  date: ['Another date', 'تاريخ تاني'],
  slot: ['Time slot', 'الفترة'],
  slotsGone: ['Today’s slots are over - pick tomorrow.', 'فترات النهارده خلصت — اختار بكرة.'],
  s2: ['Write the message', 'اكتب الرسالة'],
  s2x: ['A card with your own words, signed by you - or anonymous.', 'بطاقة بكلماتك أنت، موقّعة باسمك — أو بدون اسم.'],
  msg: ['Your message', 'كلمتك'],
  msgPh: ['Write what you want to say…', 'اكتب اللي عايز تقوله…'],
  msgPrice: ['Message card', 'بطاقة الرسالة'],
  signAs: ['Signed by', 'من'],
  signPh: ['Your name on the card', 'اسمك على البطاقة'],
  anon: ['No name on the card', 'بدون اسم على البطاقة'],
  s3: ['Add a little extra', 'أضف حاجة زيادة'],
  s3x: ['Ferrero, chocolate bars, a helium balloon or a teddy bear, added to the bouquet.', 'فيريرو أو ألواح شوكولاتة أو بالون هيليوم أو دبدوب، نضيفها للباقة.'],
  s4: ['Delivery details', 'بيانات التوصيل'],
  s4p: ['Your details', 'بياناتك'],
  s4x: ['So we can confirm with you and reach the right door.', 'عشان نأكد معاك ونوصل للعنوان الصح.'],
  s4px: ['So we can confirm your order.', 'عشان نأكد طلبك معاك.'],
  you: ['You (the sender)', 'أنت (المُرسِل)'],
  yourName: ['Your name', 'اسمك'],
  yourPhone: ['Your mobile', 'موبايلك'],
  to: ['The recipient', 'المُستلِم'],
  toName: ['Recipient name', 'اسم المُستلِم'],
  toPhone: ['Recipient mobile (optional)', 'موبايل المُستلِم (اختياري)'],
  address: ['Address - area, street, building, floor', 'العنوان — المنطقة والشارع والعمارة والدور'],
  notes: ['Notes for us (optional)', 'ملاحظات لنا (اختياري)'],
  required: ['Please fill this in', 'من فضلك املا الحقل ده'],
  badPhone: ['Check the mobile number', 'راجع رقم الموبايل'],
  summary: ['Your order', 'طلبك'],
  empty: ['Your bag is empty - pick a bouquet first.', 'سلتك فاضية — اختار باقة الأول.'],
  browse: ['Browse the collection', 'تصفح المجموعة'],
  bouquets: ['Bouquets', 'الباقات'],
  extras: ['Extras', 'الإضافات'],
  total: ['Estimated total', 'الإجمالي التقريبي'],
  totalNote: ['Delivery fee for your area is confirmed on WhatsApp.', 'مصاريف التوصيل لمنطقتك بنأكدها معاك على واتساب.'],
  totalNotePickup: ['No delivery fee for pick-up.', 'مفيش مصاريف توصيل للاستلام.'],
  send: ['Send the order on WhatsApp', 'ابعت الطلب على واتساب'],
  fix: ['Please complete the highlighted fields.', 'من فضلك كمّل الحقول الملوّنة.'],
  sentT: ['WhatsApp is opening', 'واتساب بيتفتح'],
  sentX: ['Press send in the chat - we reply to confirm the details and the payment.', 'اضغط إرسال في المحادثة — بنرد عليك نأكد التفاصيل والدفع.'],
  edit: ['Edit order', 'عدّل الطلب'],
  remove: ['Remove', 'إزالة'],
} as const satisfies Record<string, readonly [string, string]>;

type CopyKey = keyof typeof COPY;

/**
 * "Gifting": the last step before ordering. Collects when and where, the card message, extras
 * and contact details, shows the bag with an estimated total and hands the whole thing to the
 * shop as one WhatsApp message (the same channel the Studio uses - the shop has no payment backend).
 */
@Component({
  selector: 'app-gift-order',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './gift-order.component.html',
  styleUrl: './gift-order.component.scss',
})
export class GiftOrderComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(StoreService);
  private readonly pages = inject(PageNavService);
  private readonly orders = inject(OrdersService);

  protected readonly slots = SLOTS;
  protected readonly extras = EXTRAS;
  protected readonly iconPath = ADDON_ICON_PATHS;
  protected readonly messageMax = MESSAGE_MAX;
  protected readonly cardPrice = CARD?.price ?? 0;
  protected readonly egp = formatEgp;
  protected readonly thumb = (id: string): string => unsplashUrl(id, 120, 150);

  // ---- form state -----------------------------------------------------------------------
  protected readonly mode = signal<Mode>('delivery');
  protected readonly date = signal('');
  protected readonly slot = signal('');
  protected readonly message = signal('');
  protected readonly signName = signal('');
  protected readonly anonymous = signal(false);
  protected readonly picked = signal<ReadonlySet<string>>(new Set());
  protected readonly senderName = signal('');
  protected readonly senderPhone = signal('');
  protected readonly recipientName = signal('');
  protected readonly recipientPhone = signal('');
  protected readonly address = signal('');
  protected readonly notes = signal('');

  protected readonly attempted = signal(false);
  protected readonly sent = signal(false);

  protected readonly todayIso = this.iso(new Date());
  protected readonly tomorrowIso = this.iso(new Date(Date.now() + 86_400_000));

  protected readonly isDelivery = computed(() => this.mode() === 'delivery');
  protected readonly hasCard = computed(() => this.message().trim().length > 0);

  /** Slots already started today can't be booked. */
  protected readonly slotsGone = computed(
    () => this.date() === this.todayIso && SLOTS.every((s) => this.slotPast(s.from)),
  );

  // ---- money ----------------------------------------------------------------------------
  protected readonly extraLines = computed(() => EXTRAS.filter((e) => this.picked().has(e.id)));
  protected readonly extrasTotal = computed(() => this.extraLines().reduce((n, e) => n + e.price, 0));
  protected readonly total = computed(
    () => this.store.cartTotal() + this.extrasTotal() + (this.hasCard() ? this.cardPrice : 0),
  );

  // ---- validation -----------------------------------------------------------------------
  protected readonly errors = computed<ReadonlyMap<Field, CopyKey>>(() => {
    const e = new Map<Field, CopyKey>();
    const d = this.date();
    if (!d || d < this.todayIso) e.set('date', 'required');
    const s = this.slot();
    if (!s || this.slotDisabled(s)) e.set('slot', 'required');
    if (!this.senderName().trim()) e.set('senderName', 'required');
    if (!this.senderPhone().trim()) e.set('senderPhone', 'required');
    else if (!this.validPhone(this.senderPhone())) e.set('senderPhone', 'badPhone');
    if (this.isDelivery()) {
      if (!this.recipientName().trim()) e.set('recipientName', 'required');
      if (!this.address().trim()) e.set('address', 'required');
    }
    return e;
  });

  protected readonly canSend = computed(() => this.store.cartLines().length > 0);

  // ---- template helpers -----------------------------------------------------------------
  protected c(key: CopyKey): string {
    const [en, ar] = COPY[key];
    return this.i18n.pick(en, ar);
  }

  protected err(field: Field): string | null {
    if (!this.attempted()) return null;
    const key = this.errors().get(field);
    return key ? this.c(key) : null;
  }

  protected slotLabel(from: number, to: number): string {
    const ar = this.i18n.isAr();
    const fmt = (h: number): string => `${h % 12 || 12} ${h < 12 ? (ar ? 'ص' : 'AM') : ar ? 'م' : 'PM'}`;
    return `${fmt(from)} – ${fmt(to)}`;
  }

  protected slotPast(from: number): boolean {
    return from <= new Date().getHours();
  }

  protected slotDisabled(id: string): boolean {
    const s = SLOTS.find((x) => x.id === id);
    return !s || (this.date() === this.todayIso && this.slotPast(s.from));
  }

  // ---- actions --------------------------------------------------------------------------
  protected setDate(value: string): void {
    this.date.set(value);
    if (this.slot() && this.slotDisabled(this.slot())) this.slot.set('');
  }

  protected toggleExtra(id: string): void {
    this.picked.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  protected browse(): void {
    this.pages.toHome('#collections');
  }

  protected send(): void {
    if (!this.canSend()) return;
    this.attempted.set(true);
    if (this.errors().size) {
      // bring the first unhappy field into view
      queueMicrotask(() => {
        const el = document.querySelector<HTMLElement>('app-gift-order [aria-invalid="true"], app-gift-order .go__bad');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el?.focus?.({ preventScroll: true });
      });
      return;
    }
    this.saveOrder();
    window.open(whatsappLink(this.orderMessage()), '_blank', 'noopener');
    this.sent.set(true);
  }

  /** Records the order for the shop's admin, alongside the WhatsApp message. */
  private saveOrder(): void {
    const slot = SLOTS.find((s) => s.id === this.slot());
    const lines: OrderLine[] = this.store.cartLines().map((l) => ({
      name: l.nameAr,
      qty: l.qty,
      unitPrice: l.unitPrice,
      details: l.custom?.detailsAr ?? l.custom?.details,
      imageId: l.imageId,
      swatches: l.custom?.swatches,
      kind: 'item',
    }));
    for (const e of this.extraLines()) lines.push({ name: e.nameAr, qty: 1, unitPrice: e.price, kind: 'extra' });
    if (this.hasCard()) lines.push({ name: 'بطاقة رسالة', qty: 1, unitPrice: this.cardPrice, kind: 'extra' });

    const customMessage = this.store.cartLines().find((l) => l.custom?.message)?.custom?.message;
    const delivery = this.isDelivery();
    this.orders.create({
      source: 'site',
      customerName: this.senderName().trim(),
      customerPhone: this.senderPhone().trim(),
      recipientName: delivery ? this.recipientName().trim() : undefined,
      recipientPhone: delivery ? this.recipientPhone().trim() || undefined : undefined,
      mode: this.mode(),
      address: delivery ? this.address().trim() : undefined,
      whenIso: this.date(),
      slot: slot ? this.slotText(slot.from, slot.to) : '',
      slotFrom: slot?.from,
      lines,
      cardMessage: this.message().trim() || customMessage || undefined,
      cardSign: this.hasCard() ? (this.anonymous() ? '' : this.signName().trim()) : undefined,
      notes: this.notes().trim() || undefined,
      total: this.total(),
    });
  }

  protected editAgain(): void {
    this.sent.set(false);
  }

  // ---- WhatsApp message (always Arabic: that's what the florists read) -------------------
  private orderMessage(): string {
    const ar = (n: number): string => formatEgp(n, 'ar');
    const lines: string[] = ['أهلاً سكاي فلاور 🌸', 'عايز أطلب:', ''];

    lines.push('🛍 *الطلب*');
    for (const l of this.store.cartLines()) {
      lines.push(`   ▫️ ${l.qty} × ${l.nameAr} — ${ar(l.unitPrice * l.qty)}`);
      if (l.custom) {
        for (const d of l.custom.detailsAr ?? l.custom.details) lines.push(`        · ${d}`);
        if (l.custom.message) lines.push(`        💌 «${l.custom.message}»`);
      }
    }

    const extras = this.extraLines();
    if (extras.length) {
      lines.push('', '🎁 *إضافات*');
      for (const e of extras) lines.push(`   ▫️ ${e.nameAr} — ${ar(e.price)}`);
    }

    const card = this.message().trim();
    if (card) {
      lines.push('', `💌 *كلمة البطاقة* (${ar(this.cardPrice)})`, `   «${card}»`);
      lines.push(this.anonymous() || !this.signName().trim() ? '   ✍️ بدون اسم' : `   ✍️ من: ${this.signName().trim()}`);
    }

    const [y, m, d] = this.date().split('-').map(Number);
    const day = new Date(y, m - 1, d).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
    const slot = SLOTS.find((s) => s.id === this.slot());
    const when = slot ? `${day} · ${this.slotText(slot.from, slot.to)}` : day;
    lines.push('', this.isDelivery() ? '📅 *ميعاد التوصيل*' : '📅 *ميعاد الاستلام*', `   ${when}`);
    if (this.isDelivery()) lines.push('', '📍 *العنوان*', `   ${this.address().trim()}`);
    else lines.push('', `📍 *استلام من المحل* (${BRAND.addressAr})`);

    lines.push('', '👤 *المُرسِل*', `   ${this.senderName().trim()} — ${this.senderPhone().trim()}`);
    if (this.isDelivery()) {
      const phone = this.recipientPhone().trim();
      lines.push('', '🎀 *المُستلِم*', `   ${this.recipientName().trim()}${phone ? ` — ${phone}` : ''}`);
    }
    const notes = this.notes().trim();
    if (notes) lines.push('', '📝 *ملاحظات*', `   ${notes}`);

    lines.push('', `💰 *الإجمالي التقريبي: ${ar(this.total())}*${this.isDelivery() ? ' (بدون مصاريف التوصيل)' : ''}`);
    lines.push('', 'ممكن تأكدلي التفاصيل والدفع؟ 🙏');
    return lines.join('\n');
  }

  private slotText(from: number, to: number): string {
    const fmt = (h: number): string => `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}`;
    return `${fmt(from)} – ${fmt(to)}`;
  }

  private validPhone(value: string): boolean {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 14;
  }

  private iso(d: Date): string {
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
}
