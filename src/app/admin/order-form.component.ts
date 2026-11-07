import { ChangeDetectionStrategy, Component, computed, inject, output, signal } from '@angular/core';
import { CatalogService } from '../core/catalog.service';
import { ADDON_OPTIONS } from '../data/studio-data';
import { egp, isoDay } from './admin-format';
import { NewOrder, Order, OrderLine, PAY_METHODS, PayMethod, PayStatus, waNumber } from './order.model';
import { OrdersService } from './orders.service';
import { SettingsService } from './settings.service';

type Mode = 'delivery' | 'pickup';

/** Two-hour windows inside opening hours, same as the storefront's. */
const SLOTS = [10, 12, 14, 16, 18, 20].map((from) => {
  const f = (h: number): string => `${h % 12 || 12} ${h < 12 ? 'ص' : 'م'}`;
  return { from, label: `${f(from)} – ${f(from + 2)}` };
});

/** A plain-text card extra is added through the message box, so it is not offered as a chip. */
const EXTRAS = ADDON_OPTIONS.filter((a) => !a.needsMessage);

/**
 * "طلب جديد": the shop types in an order that came by phone or WhatsApp, so every order lives in one place
 * (and shows up in the customers list, the dashboard and the delivery schedule).
 */
@Component({
  selector: 'app-order-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ad-scrim" (click)="closed.emit()"></div>
    <form class="ad-drawer ad-drawer--form" role="dialog" aria-modal="true" aria-label="طلب جديد" data-lenis-prevent (submit)="save($event)">
      <header class="ad-drawer__head">
        <div>
          <h2>طلب جديد</h2>
          <small>طلب جه بالتليفون أو الواتساب</small>
        </div>
        <button type="button" class="ad-x" (click)="closed.emit()" aria-label="إغلاق">×</button>
      </header>

      <div class="ad-drawer__body">
        <section>
          <h3>العميل</h3>
          <div class="ad-fields">
            <label class="ad-field">
              <span>الاسم</span>
              <input [value]="name()" (input)="name.set(val($event))" autocomplete="off" />
              @if (tried() && !name().trim()) {
                <em>مطلوب</em>
              }
            </label>
            <label class="ad-field">
              <span>الموبايل</span>
              <input type="tel" inputmode="tel" dir="ltr" [value]="phone()" (input)="phone.set(val($event))" placeholder="01xxxxxxxxx" />
              @if (tried() && !phoneOk()) {
                <em>رقم موبايل مصري صحيح</em>
              }
            </label>
          </div>
        </section>

        <section>
          <h3>الطلب</h3>
          <div class="ad-fields">
            <label class="ad-field ad-field--wide">
              <span>أضف باقة</span>
              <select (change)="addProduct($event)">
                <option value="">اختر من الباقات…</option>
                @for (p of catalog.visible(); track p.id) {
                  <option [value]="p.id">{{ p.nameAr }} — {{ egp(p.price) }}</option>
                }
              </select>
            </label>
          </div>

          <div class="ad-chips ad-chips--tight">
            @for (e of extras; track e.id) {
              <button type="button" [class.is-on]="has(e.nameAr)" (click)="toggleExtra(e.nameAr, e.price)">
                {{ e.nameAr }} <b>{{ egp(e.price) }}</b>
              </button>
            }
          </div>

          <div class="ad-fields">
            <label class="ad-field">
              <span>أو بند حر (اسم)</span>
              <input [value]="freeName()" (input)="freeName.set(val($event))" placeholder="مثلًا: باقة 50 جوري" />
            </label>
            <label class="ad-field">
              <span>سعره</span>
              <input type="number" inputmode="numeric" min="0" [value]="freePrice()" (input)="freePrice.set(val($event))" />
            </label>
            <button type="button" class="ad-btn ad-btn--sm" (click)="addFree()" [disabled]="!freeName().trim() || !(+freePrice() > 0)">إضافة</button>
          </div>

          @if (lines().length) {
            <div class="ad-box">
              @for (l of lines(); track $index) {
                <div class="ad-line ad-line--extra">
                  <span class="ad-line__main">
                    @if (l.kind === 'extra') {
                      +
                    }
                    {{ l.qty }} × {{ l.name }}
                  </span>
                  <span class="ad-line__price">{{ egp(l.unitPrice * l.qty) }}</span>
                  <button type="button" class="ad-x ad-x--sm" (click)="remove($index)" aria-label="حذف البند">×</button>
                </div>
              }
            </div>
          } @else if (tried()) {
            <em class="ad-err">ضيف بند واحد على الأقل</em>
          }
        </section>

        <section>
          <h3>الاستلام</h3>
          <div class="ad-chips ad-chips--tight" role="radiogroup" aria-label="طريقة الاستلام">
            <button type="button" role="radio" [attr.aria-checked]="mode() === 'delivery'" [class.is-on]="mode() === 'delivery'" (click)="setMode('delivery')">توصيل</button>
            <button type="button" role="radio" [attr.aria-checked]="mode() === 'pickup'" [class.is-on]="mode() === 'pickup'" (click)="setMode('pickup')">استلام من المحل</button>
          </div>
          <div class="ad-fields">
            <label class="ad-field">
              <span>اليوم</span>
              <input type="date" [value]="date()" [min]="today" (input)="date.set(val($event))" />
            </label>
            <label class="ad-field">
              <span>الفترة</span>
              <select (change)="slot.set(val($event))">
                @for (s of slots; track s.from) {
                  <option [value]="s.from" [selected]="+slot() === s.from">{{ s.label }}</option>
                }
              </select>
            </label>
            @if (mode() === 'delivery') {
              <label class="ad-field">
                <span>اسم المُستلِم</span>
                <input [value]="recipient()" (input)="recipient.set(val($event))" />
              </label>
              <label class="ad-field">
                <span>رسوم التوصيل</span>
                <input type="number" inputmode="numeric" min="0" [value]="fee()" (input)="fee.set(+val($event))" />
              </label>
              <label class="ad-field ad-field--wide">
                <span>العنوان</span>
                <input [value]="address()" (input)="address.set(val($event))" placeholder="المنطقة، الشارع، العمارة، الدور" />
                @if (tried() && !address().trim()) {
                  <em>مطلوب للتوصيل</em>
                }
              </label>
            }
          </div>
        </section>

        <section>
          <h3>كلمة البطاقة وملاحظات</h3>
          <div class="ad-fields">
            <label class="ad-field ad-field--wide">
              <span>كلمة على البطاقة (اختياري)</span>
              <textarea rows="2" maxlength="180" [value]="card()" (input)="card.set(val($event))"></textarea>
            </label>
            <label class="ad-field ad-field--wide">
              <span>ملاحظات الطلب (اختياري)</span>
              <input [value]="notes()" (input)="notes.set(val($event))" />
            </label>
          </div>
        </section>

        <section>
          <h3>الدفع</h3>
          <div class="ad-chips ad-chips--tight">
            <button type="button" [class.is-on]="pay() === 'unpaid'" (click)="pay.set('unpaid')">لسه مدفعش</button>
            <button type="button" [class.is-on]="pay() === 'paid'" (click)="pay.set('paid')">اتدفع</button>
          </div>
          @if (pay() === 'paid') {
            <div class="ad-chips ad-chips--tight">
              @for (m of methods; track m.id) {
                <button type="button" [class.is-on]="method() === m.id" (click)="method.set(m.id)">{{ m.label }}</button>
              }
            </div>
          }
        </section>
      </div>

      <footer class="ad-drawer__foot">
        <div class="ad-total ad-total--foot">
          <span>الإجمالي</span>
          <strong>{{ egp(total()) }}</strong>
        </div>
        <button type="submit" class="ad-btn ad-btn--primary">حفظ الطلب</button>
        <button type="button" class="ad-btn" (click)="closed.emit()">إلغاء</button>
      </footer>
    </form>
  `,
})
export class OrderFormComponent {
  readonly closed = output<void>();
  readonly saved = output<Order>();

  protected readonly catalog = inject(CatalogService);
  private readonly orders = inject(OrdersService);
  private readonly settings = inject(SettingsService);

  protected readonly egp = egp;
  protected readonly slots = SLOTS;
  protected readonly extras = EXTRAS;
  protected readonly methods = PAY_METHODS;
  protected readonly today = isoDay(Date.now());

  protected readonly name = signal('');
  protected readonly phone = signal('');
  protected readonly mode = signal<Mode>('delivery');
  protected readonly date = signal(this.today);
  protected readonly slot = signal(String(SLOTS[2].from));
  protected readonly recipient = signal('');
  protected readonly address = signal('');
  protected readonly fee = signal(this.settings.deliveryFee());
  protected readonly card = signal('');
  protected readonly notes = signal('');
  protected readonly pay = signal<PayStatus>('unpaid');
  protected readonly method = signal<PayMethod>('cash');
  protected readonly lines = signal<readonly OrderLine[]>([]);
  protected readonly freeName = signal('');
  protected readonly freePrice = signal('');
  protected readonly tried = signal(false);

  protected readonly phoneOk = computed(() => !!waNumber(this.phone()));
  protected readonly subtotal = computed(() => this.lines().reduce((n, l) => n + l.qty * l.unitPrice, 0));
  protected readonly total = computed(() => this.subtotal() + (this.mode() === 'delivery' ? this.fee() : 0));

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
  }

  protected addProduct(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const product = this.catalog.all().find((p) => p.id === select.value);
    select.value = '';
    if (!product) return;
    this.lines.update((list) => {
      const same = list.findIndex((l) => l.kind !== 'extra' && l.name === product.nameAr && l.unitPrice === product.price);
      return same >= 0
        ? list.map((l, i) => (i === same ? { ...l, qty: l.qty + 1 } : l))
        : [...list, { name: product.nameAr, qty: 1, unitPrice: product.price, imageId: product.imageId, kind: 'item' }];
    });
  }

  protected has(name: string): boolean {
    return this.lines().some((l) => l.kind === 'extra' && l.name === name);
  }

  protected toggleExtra(name: string, price: number): void {
    this.lines.update((list) =>
      this.has(name) ? list.filter((l) => !(l.kind === 'extra' && l.name === name)) : [...list, { name, qty: 1, unitPrice: price, kind: 'extra' }],
    );
  }

  protected addFree(): void {
    const name = this.freeName().trim();
    const price = Number(this.freePrice());
    if (!name || !(price > 0)) return;
    this.lines.update((list) => [...list, { name, qty: 1, unitPrice: Math.round(price), kind: 'item' }]);
    this.freeName.set('');
    this.freePrice.set('');
  }

  protected remove(index: number): void {
    this.lines.update((list) => list.filter((_, i) => i !== index));
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.tried.set(true);
    const delivery = this.mode() === 'delivery';
    if (!this.name().trim() || !this.phoneOk() || !this.lines().length || (delivery && !this.address().trim())) return;

    const slot = SLOTS.find((s) => s.from === Number(this.slot()));
    const order: NewOrder = {
      source: 'manual',
      customerName: this.name().trim(),
      customerPhone: this.phone().trim(),
      recipientName: delivery ? this.recipient().trim() || undefined : undefined,
      mode: this.mode(),
      address: delivery ? this.address().trim() : undefined,
      whenIso: this.date(),
      slot: slot?.label ?? '',
      slotFrom: slot?.from,
      lines: this.lines(),
      cardMessage: this.card().trim() || undefined,
      notes: this.notes().trim() || undefined,
      deliveryFee: delivery ? this.fee() : 0,
      total: this.total(),
      payStatus: this.pay(),
      payMethod: this.pay() === 'paid' ? this.method() : undefined,
    };
    this.saved.emit(this.orders.create(order));
  }
}
