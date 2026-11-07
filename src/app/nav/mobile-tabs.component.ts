import { ChangeDetectionStrategy, Component, HostListener, afterNextRender, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { PageNavService } from '../core/page-nav.service';
import { StoreService } from '../core/store.service';

type Tab = 'home' | 'shop' | 'design' | 'gift';

/**
 * Phone-only tab bar: a floating glass pill with the four things people do on the site
 * (home, browse, design their own, open the bag). It leaves the right corner free for SkyBot.
 * Hidden from 640px up, where the top navigation has room for all of it.
 */
@Component({
  selector: 'app-mobile-tabs',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="mt" [attr.aria-label]="i18n.t('tabs.aria')">
      <a href="#top" class="mt__tab" [class.is-on]="active() === 'home'" (click)="go($event, '#top')">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m3 11 9-8 9 8" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" />
        </svg>
        <span>{{ i18n.t('tabs.home') }}</span>
      </a>
      <a href="#collections" class="mt__tab" [class.is-on]="active() === 'shop'" (click)="go($event, '#collections')">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 21c-4-3-8-6-8-10a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 20 11c0 4-4 7-8 10Z" />
        </svg>
        <span>{{ i18n.t('tabs.shop') }}</span>
      </a>
      <a href="#studio" class="mt__tab" [class.is-on]="active() === 'design'" (click)="go($event, '#studio')">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3c1.6 2.6 1.6 5 0 7.5-1.6-2.5-1.6-4.9 0-7.5Z" /><path d="M21 12c-2.6 1.6-5 1.6-7.5 0 2.5-1.6 4.9-1.6 7.5 0Z" />
          <path d="M12 21c-1.6-2.6-1.6-5 0-7.5 1.6 2.5 1.6 4.9 0 7.5Z" /><path d="M3 12c2.6-1.6 5-1.6 7.5 0-2.5 1.6-4.9 1.6-7.5 0Z" />
        </svg>
        <span>{{ i18n.t('tabs.design') }}</span>
      </a>
      <a href="#gifting" class="mt__tab" [class.is-on]="active() === 'gift'" (click)="go($event, '#gifting')">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
          <path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" />
        </svg>
        <span>{{ i18n.t('tabs.gifts') }}</span>
      </a>
      <button type="button" class="mt__tab" data-bag (click)="store.cartOpen.set(true)" [attr.aria-label]="i18n.t('bag.open')">
        <span class="mt__icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          @if (store.cartCount() > 0) {
            <b>{{ store.cartCount() }}</b>
          }
        </span>
        <span>{{ i18n.t('bag.label') }}</span>
      </button>
    </nav>
  `,
  styles: `
    $ease: cubic-bezier(0.22, 1, 0.36, 1);
    $rose: #b5425b;
    $rose-ink: #8a2a4a;
    $ink: #3b2129;

    :host {
      display: none;
    }

    @media (max-width: 639px) {
      :host {
        display: block;
      }
      // Right edge leaves room for SkyBot's round launcher (2.9rem + its gap).
      .mt {
        position: fixed;
        z-index: 62;
        inset-block-end: max(1rem, env(safe-area-inset-bottom));
        left: 0.8rem;
        right: 4.5rem;
        display: flex;
        align-items: stretch;
        padding: 0.3rem;
        border: 1px solid rgb(181 66 91 / 0.16);
        border-radius: 1.6rem;
        background: rgb(255 252 249 / 0.84);
        -webkit-backdrop-filter: blur(12px) saturate(1.4);
        backdrop-filter: blur(12px) saturate(1.4);
        box-shadow: 0 20px 44px -18px rgb(59 33 41 / 0.5);
        animation: mt-in 0.9s $ease 0.6s both;
      }
      .mt__tab {
        position: relative;
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.12rem;
        min-width: 0;
        padding: 0.45rem 0.1rem 0.4rem;
        border: 0;
        border-radius: 1.25rem;
        background: none;
        font: inherit;
        font-size: 0.64rem;
        line-height: 1.2;
        white-space: nowrap;
        color: rgb(59 33 41 / 0.62);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
        transition: background-color 0.35s $ease, color 0.35s $ease, transform 0.3s $ease;
        &:active {
          transform: scale(0.94);
        }
        &.is-on {
          background: rgb(181 66 91 / 0.13);
          color: $rose-ink;
          font-weight: 600;
        }
      }
      .mt__icon {
        position: relative;
        display: grid;
        place-items: center;
        b {
          position: absolute;
          inset-block-start: -0.4rem;
          inset-inline-end: -0.7rem;
          min-width: 1.05rem;
          padding: 0 0.3rem;
          border-radius: 999px;
          background: $rose;
          font-size: 0.62rem;
          font-weight: 600;
          line-height: 1.05rem;
          text-align: center;
          color: #fff;
          box-shadow: 0 0 0 2px #fffcf9;
        }
      }
    }

    @keyframes mt-in {
      from {
        opacity: 0;
        transform: translateY(1.2rem);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .mt {
        animation: none !important;
      }
    }
  `,
})
export class MobileTabsComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(StoreService);
  private readonly pages = inject(PageNavService);

  protected readonly active = signal<Tab>('home');
  private frame = 0;

  constructor() {
    afterNextRender(() => this.update());
  }

  @HostListener('window:scroll')
  protected onScroll(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.update();
    });
  }

  protected go(event: Event, selector: string): void {
    event.preventDefault();
    this.pages.toHome(selector);
  }

  /** Home until the collection starts, Shop through the collection, Design from the studio on. */
  private update(): void {
    const line = window.innerHeight * 0.45;
    const passed = (id: string): boolean => {
      const el = document.getElementById(id);
      return !!el && el.getBoundingClientRect().top <= line;
    };
    this.active.set(
      passed('gifting') ? 'gift' : passed('studio') ? 'design' : passed('collections') ? 'shop' : 'home',
    );
  }
}
