import { ChangeDetectionStrategy, Component, ViewEncapsulation, effect, inject, signal, untracked } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { OrdersService } from './orders.service';
import { LogoComponent } from '../shared/logo.component';

interface NavLink {
  readonly path: string;
  readonly label: string;
  /** SVG path (24x24, stroked). */
  readonly icon: string;
  readonly exact: boolean;
  readonly badge?: boolean;
}

/** A short two-note chime for a new order. Browsers may refuse sound before a click: then it is silent. */
function chime(): void {
  try {
    const ctx = new AudioContext();
    const notes = [880, 1318.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime + i * 0.16;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => void ctx.close(), 900);
  } catch {
    /* no sound available */
  }
}

/**
 * The admin frame: side menu (a bottom bar on phones), the routed page, and a toast when a new
 * order arrives. The styles are global (`ad-*`) so the pages inside share one look.
 */
@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, LogoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  styleUrl: './admin.scss',
  template: `
    <div class="ad" dir="rtl" lang="ar">
      <aside class="ad-side">
        <a class="ad-brand" routerLink="/admin"><app-logo size="sm" /></a>
        <span class="ad-brand__sub">لوحة التحكم</span>

        <nav class="ad-nav" aria-label="الإدارة">
          @for (l of links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="is-on" [routerLinkActiveOptions]="{ exact: l.exact }">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path [attr.d]="l.icon" />
              </svg>
              <span>{{ l.label }}</span>
              @if (l.badge && orders.newCount() > 0) {
                <b class="ad-nav__badge">{{ orders.newCount() }}</b>
              }
            </a>
          }
        </nav>

        <div class="ad-side__foot">
          <p class="ad-demo">نسخة تجريبية<br />البيانات افتراضية</p>
          <a class="ad-side__link" routerLink="/" target="_blank">عرض الموقع ↗</a>
          <button type="button" class="ad-side__link" (click)="logout()">تسجيل الخروج</button>
        </div>
      </aside>

      <main class="ad-main">
        <router-outlet />
      </main>

      @if (toast(); as t) {
        <div class="ad-toast" role="status">
          <span class="ad-toast__dot"></span>
          <div>
            <strong>طلب جديد وصل 🌸</strong>
            <small>{{ t }}</small>
          </div>
          <a routerLink="/admin/orders" (click)="toast.set(null)">اعرضه</a>
        </div>
      }
    </div>
  `,
})
export class AdminShellComponent {
  protected readonly orders = inject(OrdersService);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected readonly links: readonly NavLink[] = [
    { path: '/admin', label: 'الرئيسية', exact: true, icon: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
    { path: '/admin/orders', label: 'الطلبات', exact: false, badge: true, icon: 'M6 7h12l1 13H5zM9 7a3 3 0 0 1 6 0' },
    { path: '/admin/customers', label: 'العملاء', exact: false, icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8' },
    { path: '/admin/products', label: 'المنتجات', exact: false, icon: 'M3 3h8l10 10-8 8L3 11zM7.5 7.5h.01' },
    { path: '/admin/settings', label: 'الإعدادات', exact: false, icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z' },
  ];

  protected readonly toast = signal<string | null>(null);
  private seen: number;
  private timer?: ReturnType<typeof setTimeout>;

  constructor() {
    this.orders.seedDemoOnce();
    this.seen = this.orders.orders().length;
    // An order placed on the storefront (another tab) shows up here by itself.
    effect(() => {
      const all = this.orders.orders();
      untracked(() => {
        if (all.length > this.seen) {
          const newest = this.orders.sorted()[0];
          this.toast.set(`${newest.customerName} · ${newest.id}`);
          chime();
          clearTimeout(this.timer);
          this.timer = setTimeout(() => this.toast.set(null), 7000);
        }
        this.seen = all.length;
      });
    });
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/admin/login');
  }
}
