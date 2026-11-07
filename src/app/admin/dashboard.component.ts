import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { clock, dayLabel, egp, isoDay, startOfDay, timeAgo } from './admin-format';
import { ALL_STATUSES, Order, OrderStatus, SOURCE_LABEL, amountDue, statusLabel } from './order.model';
import { OrdersService } from './orders.service';

const DAY = 86_400_000;

/** `/admin` - how the shop is doing today: what needs an answer, what goes out, what sells. */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ad-head">
      <div>
        <h1>أهلاً بيك 🌸</h1>
        <p>{{ today }}</p>
      </div>
      <div class="ad-head__actions">
        @if (orders.hasDemo()) {
          <button type="button" class="ad-btn ad-btn--sm" (click)="orders.clearDemo()">امسح البيانات التجريبية</button>
        } @else {
          <button type="button" class="ad-btn ad-btn--sm" (click)="orders.restoreDemo()">رجّع البيانات التجريبية</button>
        }
      </div>
    </header>

    <section class="ad-kpis" aria-label="ملخص">
      <a class="ad-kpi ad-kpi--hot" routerLink="/admin/orders">
        <small>طلبات جديدة</small>
        <strong>{{ stats().newCount }}</strong>
        <span>{{ stats().newCount ? 'محتاجة رد دلوقتي' : 'مفيش حاجة منتظرة' }}</span>
      </a>
      <div class="ad-kpi">
        <small>طلبات النهارده</small>
        <strong>{{ stats().todayCount }}</strong>
        <span>من أول اليوم</span>
      </div>
      <div class="ad-kpi">
        <small>إيراد النهارده</small>
        <strong>{{ egp(stats().todayRevenue) }}</strong>
        <span>بدون الملغي</span>
      </div>
      <div class="ad-kpi">
        <small>إيراد آخر 7 أيام</small>
        <strong>{{ egp(stats().weekRevenue) }}</strong>
        <span>{{ stats().weekCount }} طلب</span>
      </div>
      <a class="ad-kpi ad-kpi--warn" routerLink="/admin/orders">
        <small>لسه مدفوعش</small>
        <strong>{{ egp(stats().unpaidTotal) }}</strong>
        <span>{{ stats().unpaidCount }} طلب مستني تحصيل</span>
      </a>
      <div class="ad-kpi">
        <small>متوسط الطلب</small>
        <strong>{{ egp(stats().average) }}</strong>
        <span>آخر 7 أيام</span>
      </div>
    </section>

    <div class="ad-grid ad-grid--wide">
      <section class="ad-card">
        <h2>الإيراد آخر 7 أيام</h2>
        <div class="ad-chart" role="img" aria-label="رسم بياني للإيراد اليومي">
          @for (d of stats().days; track d.label) {
            <div class="ad-chart__col">
              <i class="ad-chart__bar" [class.is-today]="d.today" [style.height.%]="d.height"></i>
              <span class="ad-chart__val">{{ d.revenue ? compact(d.revenue) : '—' }}</span>
              <span>{{ d.label }}</span>
            </div>
          }
        </div>
      </section>

      <section class="ad-card">
        <h2>حالة الطلبات</h2>
        @for (s of stats().byStatus; track s.status) {
          <div class="ad-bar">
            <div class="ad-bar__top">
              <span>{{ s.label }}</span>
              <b>{{ s.count }}</b>
            </div>
            <div class="ad-bar__track"><i [style.width.%]="s.percent"></i></div>
          </div>
        }
      </section>
    </div>

    <div class="ad-grid">
      <section class="ad-card">
        <h2>جدول التسليم</h2>
        @if (stats().upcoming.length) {
          <div class="ad-rows">
            @for (o of stats().upcoming; track o.id) {
              <a class="ad-link-row" routerLink="/admin/orders" [queryParams]="{ open: o.id }">
                <div class="ad-rows__main">
                  <strong>{{ o.recipientName || o.customerName }}</strong>
                  <small>{{ day(o.whenIso) }} · {{ o.slot }} · {{ o.mode === 'pickup' ? 'استلام من المحل' : 'توصيل' }}</small>
                </div>
                <span class="ad-badge" [class]="'ad-badge ad-badge--' + o.status">{{ label(o) }}</span>
              </a>
            }
          </div>
        } @else {
          <p class="ad-empty">مفيش تسليمات جاية.</p>
        }
      </section>

      <section class="ad-card">
        <h2>الأكثر طلبًا</h2>
        @if (stats().top.length) {
          @for (t of stats().top; track t.name) {
            <div class="ad-bar">
              <div class="ad-bar__top">
                <span>{{ t.name }}</span>
                <b>{{ t.qty }}</b>
              </div>
              <div class="ad-bar__track"><i [style.width.%]="t.percent"></i></div>
            </div>
          }
        } @else {
          <p class="ad-empty">لسه مفيش طلبات.</p>
        }
      </section>
    </div>

    <section class="ad-card">
      <h2>آخر الطلبات</h2>
      @if (recent().length) {
        <div class="ad-rows">
          @for (o of recent(); track o.id) {
            <a class="ad-link-row" routerLink="/admin/orders" [queryParams]="{ open: o.id }">
              <div class="ad-rows__main">
                <strong>{{ o.customerName }} <span class="ad-src">{{ sourceLabel[o.source] }}</span></strong>
                <small>{{ o.id }} · {{ ago(o.createdAt) }} · {{ time(o.createdAt) }}</small>
              </div>
              <span class="ad-badge" [class]="'ad-badge ad-badge--' + o.status">{{ label(o) }}</span>
              <span class="ad-rows__end">{{ egp(o.total) }}</span>
            </a>
          }
        </div>
      } @else {
        <p class="ad-empty">لسه مفيش طلبات. أول طلب هيظهر هنا فورًا.</p>
      }
    </section>
  `,
})
export class DashboardComponent {
  protected readonly orders = inject(OrdersService);
  protected readonly egp = egp;
  protected readonly sourceLabel = SOURCE_LABEL;
  protected readonly ago = timeAgo;
  protected readonly time = clock;
  protected readonly day = (iso: string): string => dayLabel(iso);
  protected readonly label = (o: Order): string => statusLabel(o.status, o.mode);
  protected readonly compact = (n: number): string => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : String(n));

  protected readonly today = new Date().toLocaleDateString('ar-EG-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  protected readonly recent = computed(() => this.orders.sorted().slice(0, 5));

  protected readonly stats = computed(() => {
    const all = this.orders.orders();
    const live = all.filter((o) => o.status !== 'cancelled');
    const now = Date.now();
    const midnight = startOfDay(now);
    const sum = (list: readonly Order[]): number => list.reduce((n, o) => n + o.total, 0);

    const days = Array.from({ length: 7 }, (_, i) => {
      const start = midnight - (6 - i) * DAY;
      const list = live.filter((o) => o.createdAt >= start && o.createdAt < start + DAY);
      return {
        label: i === 6 ? 'النهارده' : new Date(start).toLocaleDateString('ar-EG', { weekday: 'short' }),
        today: i === 6,
        revenue: sum(list),
        count: list.length,
        height: 0,
      };
    });
    const peak = Math.max(1, ...days.map((d) => d.revenue));
    for (const d of days) d.height = Math.max(3, (d.revenue / peak) * 100);

    const week = live.filter((o) => o.createdAt >= midnight - 6 * DAY);
    const today = live.filter((o) => o.createdAt >= midnight);

    const counts = new Map<OrderStatus, number>(ALL_STATUSES.map((s) => [s, all.filter((o) => o.status === s).length]));
    const most = Math.max(1, ...counts.values());
    const byStatus = ALL_STATUSES.map((status) => ({
      status,
      label: statusLabel(status),
      count: counts.get(status) ?? 0,
      percent: ((counts.get(status) ?? 0) / most) * 100,
    }));

    const todayIso = isoDay(now);
    const upcoming = all
      .filter((o) => ['new', 'preparing', 'delivering'].includes(o.status) && o.whenIso >= todayIso)
      .sort((a, b) => (a.whenIso + String(a.slotFrom ?? 0).padStart(2, '0')).localeCompare(b.whenIso + String(b.slotFrom ?? 0).padStart(2, '0')))
      .slice(0, 6);

    const sold = new Map<string, number>();
    for (const o of live) for (const l of o.lines) if (l.kind !== 'extra') sold.set(l.name, (sold.get(l.name) ?? 0) + l.qty);
    const ranked = [...sold.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const top = ranked.map(([name, qty]) => ({ name, qty, percent: (qty / ranked[0][1]) * 100 }));

    return {
      newCount: counts.get('new') ?? 0,
      unpaidTotal: all.reduce((n, o) => n + amountDue(o), 0),
      unpaidCount: all.filter((o) => amountDue(o) > 0).length,
      todayCount: today.length,
      todayRevenue: sum(today),
      weekRevenue: sum(week),
      weekCount: week.length,
      average: week.length ? Math.round(sum(week) / week.length) : 0,
      days,
      byStatus,
      upcoming,
      top,
    };
  });
}
