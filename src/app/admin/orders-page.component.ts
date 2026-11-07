import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { unsplashUrl } from '../data/flower-data';
import { clock, dayLabel, egp, isoDay, timeAgo } from './admin-format';
import { downloadText, ordersCsv } from './export';
import { OrderFormComponent } from './order-form.component';
import {
  ALL_STATUSES,
  Order,
  OrderStatus,
  PAY_METHODS,
  PayMethod,
  SOURCE_LABEL,
  STATUS_FLOW,
  advanceLabel,
  amountDue,
  customerUpdate,
  isPaid,
  nextStatus,
  payMethodLabel,
  statusLabel,
  waNumber,
} from './order.model';
import { OrdersService } from './orders.service';
import { printOrder } from './print-order';
import { SettingsService } from './settings.service';

type Filter = 'all' | OrderStatus;
type Day = 'any' | 'today' | 'tomorrow';

/** `/admin/orders` - every order: filter, search, add one by hand, and a drawer to work it through its steps. */
@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [OrderFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ad-head">
      <div>
        <h1>الطلبات</h1>
        <p>{{ orders.orders().length }} طلب · {{ orders.newCount() }} منتظر الرد · {{ unpaidCount() }} لسه مدفوعش</p>
      </div>
      <div class="ad-head__actions">
        <button type="button" class="ad-btn ad-btn--sm" (click)="exportCsv()" [disabled]="!visible().length">تصدير Excel</button>
        <button type="button" class="ad-btn ad-btn--primary" (click)="creating.set(true)">+ طلب جديد</button>
      </div>
    </header>

    <div class="ad-tools">
      <div class="ad-chips" role="tablist" aria-label="تصفية الطلبات بالحالة">
        <button type="button" role="tab" [class.is-on]="filter() === 'all'" (click)="filter.set('all')">
          الكل <b>{{ counts().get('all') }}</b>
        </button>
        @for (s of statuses; track s) {
          <button type="button" role="tab" [class.is-on]="filter() === s" (click)="filter.set(s)">
            {{ label(s) }} <b>{{ counts().get(s) }}</b>
          </button>
        }
      </div>
      <input class="ad-search" type="search" placeholder="ابحث بالاسم أو الرقم أو رقم الطلب" [value]="query()" (input)="query.set(val($event))" />
    </div>
    <div class="ad-tools ad-tools--sub">
      <div class="ad-chips" aria-label="تصفية بميعاد التسليم">
        <button type="button" [class.is-on]="day() === 'any'" (click)="day.set('any')">كل المواعيد</button>
        <button type="button" [class.is-on]="day() === 'today'" (click)="day.set('today')">تسليم النهارده</button>
        <button type="button" [class.is-on]="day() === 'tomorrow'" (click)="day.set('tomorrow')">تسليم بكرة</button>
        <button type="button" [class.is-on]="unpaidOnly()" (click)="unpaidOnly.set(!unpaidOnly())">لسه مدفوعش</button>
      </div>
    </div>

    @if (visible().length) {
      <div class="ad-orders">
        @for (o of visible(); track o.id) {
          <button type="button" class="ad-order" [class.ad-order--new]="o.status === 'new'" (click)="open(o.id)">
            <span class="ad-order__id">{{ o.id }}</span>
            <span>
              <strong>{{ o.customerName }}</strong>
              <small>{{ ago(o.createdAt) }} · {{ source(o) }}</small>
            </span>
            <span>
              <strong>{{ summary(o) }}</strong>
              <small>{{ when(o) }}</small>
            </span>
            <span class="ad-order__badges">
              <span [class]="'ad-badge ad-badge--' + o.status">{{ statusText(o) }}</span>
              @if (paid(o)) {
                <span class="ad-badge ad-badge--done">مدفوع</span>
              } @else if (o.status !== 'cancelled') {
                <span class="ad-badge ad-badge--unpaid">مش مدفوع</span>
              }
            </span>
            <span class="ad-order__total">{{ egp(o.total) }}</span>
          </button>
        }
      </div>
    } @else {
      <section class="ad-card"><p class="ad-empty">مفيش طلبات بالشكل ده.</p></section>
    }

    @if (creating()) {
      <app-order-form (closed)="creating.set(false)" (saved)="created($event)" />
    }

    @if (current(); as o) {
      <div class="ad-scrim" (click)="close()"></div>
      <aside class="ad-drawer" role="dialog" aria-modal="true" [attr.aria-label]="'الطلب ' + o.id" data-lenis-prevent>
        <header class="ad-drawer__head">
          <div>
            <h2>{{ o.id }}</h2>
            <small>{{ ago(o.createdAt) }} · {{ time(o.createdAt) }} · {{ source(o) }}</small>
          </div>
          <span [class]="'ad-badge ad-badge--' + o.status">{{ statusText(o) }}</span>
          <button type="button" class="ad-x" (click)="close()" aria-label="إغلاق">×</button>
        </header>

        <div class="ad-drawer__body">
          @if (o.status !== 'cancelled') {
            <ol class="ad-steps" aria-label="مراحل الطلب">
              @for (s of flow; track s; let i = $index) {
                <li [class.is-done]="stepIndex(o) >= i" [class.is-now]="stepIndex(o) === i">{{ labelFor(s, o) }}</li>
              }
            </ol>
          }

          <section>
            <h3>العميل</h3>
            <div class="ad-box">
              <p><strong>{{ o.customerName }}</strong></p>
              @if (o.customerPhone) {
                <p><bdi dir="ltr">{{ o.customerPhone }}</bdi></p>
                <div class="ad-box__acts">
                  <a class="ad-btn ad-btn--sm" [href]="'tel:' + o.customerPhone">اتصال</a>
                  <a class="ad-btn ad-btn--sm ad-btn--wa" [href]="whatsapp(o, '')" target="_blank" rel="noopener">واتساب</a>
                </div>
              } @else {
                <p class="ad-muted">لسه مفيش رقم. العميل هيكلمنا على واتساب المحل.</p>
              }
            </div>
          </section>

          <section>
            <h3>{{ o.mode === 'pickup' ? 'الاستلام' : 'التوصيل' }}</h3>
            <div class="ad-box">
              @if (o.whenIso) {
                <p><strong>{{ day2(o.whenIso) }}</strong> · {{ o.slot }}</p>
              } @else {
                <p>الميعاد هيتأكد مع العميل على واتساب.</p>
              }
              @if (o.mode === 'pickup') {
                <p>استلام من المحل</p>
              } @else if (o.address) {
                @if (o.recipientName) {
                  <p>المُستلِم: <strong>{{ o.recipientName }}</strong>{{ o.recipientPhone ? ' — ' + o.recipientPhone : '' }}</p>
                }
                <p>{{ o.address }}</p>
                <div class="ad-box__acts">
                  <a class="ad-btn ad-btn--sm" [href]="mapLink(o.address)" target="_blank" rel="noopener">افتح على الخريطة</a>
                </div>
              }
            </div>
          </section>

          <section>
            <h3>الطلب</h3>
            <div class="ad-box">
              @for (l of o.lines; track $index) {
                @if (l.kind === 'extra') {
                  <div class="ad-line ad-line--extra">
                    <span class="ad-line__main">+ {{ l.name }}</span>
                    <span class="ad-line__price">{{ egp(l.unitPrice * l.qty) }}</span>
                  </div>
                } @else {
                  <div class="ad-line">
                    @if (l.imageId) {
                      <img [src]="thumb(l.imageId)" alt="" loading="lazy" />
                    } @else if (l.swatches?.length) {
                      <span class="ad-swatch">
                        <span class="ad-dots">
                          @for (c of l.swatches; track $index) {
                            <i [style.background]="c"></i>
                          }
                        </span>
                      </span>
                    }
                    <div class="ad-line__main">
                      <strong>{{ l.qty }} × {{ l.name }}</strong>
                      @if (l.details?.length) {
                        <small>{{ l.details!.join(' · ') }}</small>
                      }
                    </div>
                    <span class="ad-line__price">{{ egp(l.unitPrice * l.qty) }}</span>
                  </div>
                }
              }
              @if (o.mode === 'delivery') {
                <div class="ad-line ad-line--extra">
                  <label class="ad-line__main ad-inline">
                    <span>رسوم التوصيل</span>
                    <input type="number" inputmode="numeric" min="0" step="1" [value]="o.deliveryFee ?? 0" (change)="setFee(o, $event)" aria-label="رسوم التوصيل" />
                    <span>ج.م</span>
                  </label>
                  @if (!o.deliveryFee) {
                    <button type="button" class="ad-btn ad-btn--sm" (click)="useDefaultFee(o)">الافتراضي ({{ settings.deliveryFee() }})</button>
                  }
                </div>
              }
              <div class="ad-total">
                <span>الإجمالي</span>
                <span>{{ egp(o.total) }}</span>
              </div>
            </div>
          </section>

          <section>
            <h3>الدفع</h3>
            <div class="ad-box">
              <div class="ad-chips ad-chips--tight">
                <button type="button" [class.is-on]="!paid(o)" (click)="setPay(o, 'unpaid')">لسه مدفعش</button>
                <button type="button" [class.is-on]="paid(o)" (click)="setPay(o, 'paid', o.payMethod ?? 'cash')">اتدفع</button>
              </div>
              @if (paid(o)) {
                <div class="ad-chips ad-chips--tight">
                  @for (m of methods; track m.id) {
                    <button type="button" [class.is-on]="o.payMethod === m.id" (click)="setPay(o, 'paid', m.id)">{{ m.label }}</button>
                  }
                </div>
              } @else if (o.status !== 'cancelled') {
                <p class="ad-muted">المطلوب تحصيله: <strong>{{ egp(due(o)) }}</strong></p>
              }
            </div>
          </section>

          @if (o.cardMessage) {
            <section>
              <h3>كلمة البطاقة</h3>
              <div class="ad-box ad-box--card">
                «{{ o.cardMessage }}»
                <p class="ad-box__sign">{{ o.cardSign ? '✍️ من: ' + o.cardSign : '✍️ بدون اسم' }}</p>
              </div>
            </section>
          }

          @if (o.notes) {
            <section>
              <h3>ملاحظات العميل</h3>
              <div class="ad-box"><p>{{ o.notes }}</p></div>
            </section>
          }

          <section>
            <h3>ملاحظة داخلية (العميل مش بيشوفها)</h3>
            <textarea class="ad-textarea" rows="2" placeholder="مثلًا: العميل عايز الباقة تتصور قبل التسليم" [value]="o.internalNote ?? ''" (change)="setNote(o, $event)"></textarea>
          </section>

          @if (waNumber(o.customerPhone)) {
            <section>
              <h3>ابعت تحديث للعميل</h3>
              <div class="ad-box">
                <p class="ad-pre">{{ update(o) }}</p>
                <div class="ad-box__acts">
                  <a class="ad-btn ad-btn--sm ad-btn--wa" [href]="whatsapp(o, update(o))" target="_blank" rel="noopener">ابعتها على واتساب</a>
                </div>
              </div>
            </section>
          }
        </div>

        <footer class="ad-drawer__foot">
          @if (advance(o); as next) {
            <button type="button" class="ad-btn ad-btn--primary" (click)="move(o, next.status)">{{ next.label }}</button>
          }
          <button type="button" class="ad-btn" (click)="print(o)">طباعة</button>
          @if (o.status === 'cancelled') {
            <button type="button" class="ad-btn" (click)="move(o, 'new')">رجّع الطلب</button>
          } @else if (o.status !== 'done') {
            <button type="button" class="ad-btn ad-btn--danger" (click)="move(o, 'cancelled')">إلغاء الطلب</button>
          }
          <button type="button" class="ad-btn ad-btn--danger ad-btn--sm" (click)="remove(o)">حذف</button>
        </footer>
      </aside>
    }
  `,
})
export class OrdersPageComponent {
  protected readonly orders = inject(OrdersService);
  protected readonly settings = inject(SettingsService);

  protected readonly statuses = ALL_STATUSES;
  protected readonly flow = STATUS_FLOW;
  protected readonly methods = PAY_METHODS;
  protected readonly filter = signal<Filter>('all');
  protected readonly day = signal<Day>('any');
  protected readonly unpaidOnly = signal(false);
  protected readonly query = signal('');
  protected readonly creating = signal(false);
  private readonly openId = signal<string | null>(inject(ActivatedRoute).snapshot.queryParamMap.get('open'));

  protected readonly egp = egp;
  protected readonly ago = timeAgo;
  protected readonly time = clock;
  protected readonly day2 = (iso: string): string => dayLabel(iso);
  protected readonly waNumber = waNumber;
  protected readonly paid = isPaid;
  protected readonly due = amountDue;
  protected readonly source = (o: Order): string => SOURCE_LABEL[o.source];
  protected readonly label = (s: OrderStatus): string => statusLabel(s);
  protected readonly labelFor = (s: OrderStatus, o: Order): string => statusLabel(s, o.mode);
  protected readonly statusText = (o: Order): string => statusLabel(o.status, o.mode);
  protected readonly thumb = (id: string): string => unsplashUrl(id, 160, 200);
  protected readonly update = customerUpdate;
  protected readonly payLabel = payMethodLabel;

  protected readonly unpaidCount = computed(() => this.orders.orders().filter((o) => o.status !== 'cancelled' && !isPaid(o)).length);

  protected readonly counts = computed(() => {
    const all = this.orders.orders();
    const map = new Map<string, number>([['all', all.length]]);
    for (const s of ALL_STATUSES) map.set(s, all.filter((o) => o.status === s).length);
    return map;
  });

  protected readonly visible = computed(() => {
    const status = this.filter();
    const day = this.day();
    const q = this.query().trim().toLowerCase();
    const today = isoDay(Date.now());
    const tomorrow = isoDay(Date.now() + 86_400_000);
    return this.orders.sorted().filter((o) => {
      if (status !== 'all' && o.status !== status) return false;
      if (day === 'today' && o.whenIso !== today) return false;
      if (day === 'tomorrow' && o.whenIso !== tomorrow) return false;
      if (this.unpaidOnly() && (isPaid(o) || o.status === 'cancelled')) return false;
      if (!q) return true;
      return [o.id, o.customerName, o.customerPhone, o.recipientName ?? ''].some((v) => v.toLowerCase().includes(q));
    });
  });

  /** The order in the drawer, read live so a change shows at once. */
  protected readonly current = computed(() => {
    const id = this.openId();
    return id ? this.orders.get(id) ?? null : null;
  });

  protected open(id: string): void {
    this.openId.set(id);
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (this.creating()) return;
    this.openId.set(null);
  }

  protected created(order: Order): void {
    this.creating.set(false);
    this.filter.set('all');
    this.openId.set(order.id);
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected summary(o: Order): string {
    const items = o.lines.filter((l) => l.kind !== 'extra');
    const first = items[0];
    if (!first) return '—';
    return items.length > 1 ? `${first.name} + ${items.length - 1}` : `${first.qty > 1 ? first.qty + ' × ' : ''}${first.name}`;
  }

  protected when(o: Order): string {
    if (!o.whenIso) return 'الميعاد يتأكد على واتساب';
    return `${o.mode === 'pickup' ? 'استلام' : 'توصيل'} ${dayLabel(o.whenIso)} · ${o.slot}`;
  }

  protected stepIndex(o: Order): number {
    return STATUS_FLOW.indexOf(o.status);
  }

  protected advance(o: Order): { status: OrderStatus; label: string } | null {
    const status = nextStatus(o.status);
    const label = advanceLabel(o.status, o.mode);
    return status && label ? { status, label } : null;
  }

  protected move(o: Order, status: OrderStatus): void {
    this.orders.setStatus(o.id, status);
  }

  protected setPay(o: Order, status: 'paid' | 'unpaid', method?: PayMethod): void {
    this.orders.setPayment(o.id, status, method);
  }

  protected setFee(o: Order, event: Event): void {
    const fee = Number(this.val(event));
    if (Number.isFinite(fee) && fee >= 0) this.orders.setDeliveryFee(o.id, fee);
  }

  protected useDefaultFee(o: Order): void {
    this.orders.setDeliveryFee(o.id, this.settings.deliveryFee());
  }

  protected setNote(o: Order, event: Event): void {
    this.orders.update(o.id, { internalNote: this.val(event).trim() || undefined });
  }

  protected print(o: Order): void {
    if (!printOrder(o)) alert('المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع.');
  }

  protected remove(o: Order): void {
    if (!confirm(`حذف الطلب ${o.id} نهائيًا؟`)) return;
    this.openId.set(null);
    this.orders.remove(o.id);
  }

  protected exportCsv(): void {
    downloadText(`sky-flower-orders-${isoDay(Date.now())}.csv`, ordersCsv(this.visible()));
  }

  protected whatsapp(o: Order, text: string): string {
    const base = `https://wa.me/${waNumber(o.customerPhone)}`;
    return text ? `${base}?text=${encodeURIComponent(text)}` : base;
  }

  protected mapLink(address: string): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  }
}
