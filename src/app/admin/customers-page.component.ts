import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { egp, timeAgo } from './admin-format';
import { Customer, TAG_LABEL, buildCustomers } from './customers';
import { statusLabel, waNumber } from './order.model';
import { OrdersService } from './orders.service';

/** `/admin/customers` - who orders, how often and how much, worked out from the orders themselves. */
@Component({
  selector: 'app-customers-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ad-head">
      <div>
        <h1>العملاء</h1>
        <p>بيتجمعوا تلقائي من الطلبات (نفس الرقم = نفس العميل).</p>
      </div>
    </header>

    <section class="ad-kpis" aria-label="ملخص العملاء">
      <div class="ad-kpi">
        <small>عدد العملاء</small>
        <strong>{{ customers().length }}</strong>
        <span>اللي ليهم رقم موبايل</span>
      </div>
      <div class="ad-kpi">
        <small>بيرجعوا تاني</small>
        <strong>{{ repeatCount() }}</strong>
        <span>طلبوا أكتر من مرة</span>
      </div>
      <div class="ad-kpi">
        <small>متوسط إنفاق العميل</small>
        <strong>{{ egp(average()) }}</strong>
        <span>بدون الطلبات الملغية</span>
      </div>
    </section>

    <div class="ad-tools">
      <input class="ad-search ad-search--start" type="search" placeholder="ابحث بالاسم أو الرقم" [value]="query()" (input)="query.set(val($event))" />
    </div>

    @if (visible().length) {
      <div class="ad-orders">
        @for (c of visible(); track c.key) {
          <div class="ad-cust" [class.is-open]="openKey() === c.key">
            <button type="button" class="ad-cust__row" [attr.aria-expanded]="openKey() === c.key" (click)="toggle(c.key)">
              <span>
                <strong>{{ c.name }}</strong>
                <small><bdi dir="ltr">{{ c.phone }}</bdi></small>
              </span>
              <span [class]="'ad-tag ad-tag--' + c.tag">{{ tag(c) }}</span>
              <span>
                <strong>{{ c.count }} طلب</strong>
                <small>آخر طلب {{ ago(c.lastAt) }}</small>
              </span>
              <span class="ad-order__total">{{ egp(c.spent) }}</span>
            </button>

            @if (openKey() === c.key) {
              <div class="ad-cust__more">
                <div class="ad-rows">
                  @for (o of c.orders; track o.id) {
                    <a class="ad-link-row" routerLink="/admin/orders" [queryParams]="{ open: o.id }">
                      <div class="ad-rows__main">
                        <strong>{{ o.id }} · {{ summary(o) }}</strong>
                        <small>{{ ago(o.createdAt) }}</small>
                      </div>
                      <span [class]="'ad-badge ad-badge--' + o.status">{{ statusLabel(o.status, o.mode) }}</span>
                      <span class="ad-rows__end">{{ egp(o.total) }}</span>
                    </a>
                  }
                </div>
                <div class="ad-box__acts">
                  <a class="ad-btn ad-btn--sm" [href]="'tel:' + c.phone">اتصال</a>
                  <a class="ad-btn ad-btn--sm ad-btn--wa" [href]="'https://wa.me/' + c.key" target="_blank" rel="noopener">واتساب</a>
                </div>
              </div>
            }
          </div>
        }
      </div>
    } @else {
      <section class="ad-card"><p class="ad-empty">لسه مفيش عملاء. أول طلب فيه رقم موبايل هيظهر هنا.</p></section>
    }
  `,
})
export class CustomersPageComponent {
  private readonly orders = inject(OrdersService);

  protected readonly egp = egp;
  protected readonly ago = timeAgo;
  protected readonly statusLabel = statusLabel;
  protected readonly waNumber = waNumber;
  protected readonly tag = (c: Customer): string => TAG_LABEL[c.tag];

  protected readonly query = signal('');
  protected readonly openKey = signal<string | null>(null);

  protected readonly customers = computed(() => buildCustomers(this.orders.orders()));
  protected readonly repeatCount = computed(() => this.customers().filter((c) => c.count >= 2).length);
  protected readonly average = computed(() => {
    const list = this.customers().filter((c) => c.count > 0);
    return list.length ? Math.round(list.reduce((n, c) => n + c.spent, 0) / list.length) : 0;
  });

  protected readonly visible = computed(() => {
    const q = this.query().trim().toLowerCase();
    return q ? this.customers().filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.key.includes(q)) : this.customers();
  });

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected toggle(key: string): void {
    this.openKey.update((cur) => (cur === key ? null : key));
  }

  protected summary(o: { lines: readonly { name: string; kind?: string }[] }): string {
    const first = o.lines.find((l) => l.kind !== 'extra');
    return first?.name ?? '—';
  }
}
