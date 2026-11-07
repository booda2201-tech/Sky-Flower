import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { MotionService } from '../core/motion.service';
import { PageNavService } from '../core/page-nav.service';
import { AddedNotice } from '../core/cart.model';
import { StoreService } from '../core/store.service';
import { formatEgp, unsplashUrl } from '../data/flower-data';
import { BouquetThumbComponent } from './bouquet-thumb.component';

/** Slide-in bag drawer + "added to bag" toast. State lives in StoreService. */
@Component({
  selector: 'app-cart-panel',
  standalone: true,
  imports: [BouquetThumbComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Toast -->
    @if (toast(); as t) {
      @if (!store.cartOpen()) {
        @for (s of [t.stamp]; track s) {
          <div class="cp-toast backdrop-blur-xl" role="status">
            @if (t.imageId) {
              <img [src]="thumb(t.imageId)" alt="" width="44" height="55" />
            } @else {
              <app-bouquet-thumb class="cp-thumb cp-thumb--sm" [swatches]="t.swatches ?? []" />
            }
            <span>
              <small>{{ i18n.t('cart.added') }}</small>
              <strong>{{ i18n.pick(t.name, t.nameAr) }}</strong>
            </span>
            <button type="button" (click)="open()">{{ i18n.t('cart.view') }}</button>
          </div>
        }
      }
    }

    <!-- Drawer -->
    <div class="cp-backdrop" [class.is-open]="store.cartOpen()" (click)="close()" aria-hidden="true"></div>
    <aside class="cp-drawer backdrop-blur-xl" [class.is-open]="store.cartOpen()" role="dialog" aria-modal="true"
      [attr.aria-label]="i18n.t('cart.aria')" [attr.aria-hidden]="!store.cartOpen()" [attr.inert]="store.cartOpen() ? null : ''">
      <header>
        <div>
          <p>{{ i18n.t('cart.selection') }}</p>
          <h2>{{ i18n.t('cart.title.a') }} <em>{{ i18n.t('cart.title.em') }}</em></h2>
        </div>
        <button #closeBtn type="button" class="cp-close" (click)="close()" [attr.aria-label]="i18n.t('cart.close')">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </header>

      <div class="cp-body" data-lenis-prevent>
        @for (line of store.cartLines(); track line.productId) {
          <article class="cp-line">
            @if (line.imageId) {
              <img [src]="thumb(line.imageId)" [alt]="i18n.pick(line.name, line.nameAr)" width="72" height="90" />
            } @else {
              <app-bouquet-thumb class="cp-thumb" [swatches]="line.custom?.swatches ?? []" />
            }
            <div class="cp-line__info">
              <h3>{{ i18n.pick(line.name, line.nameAr) }}</h3>
              <span [attr.lang]="i18n.other()">{{ i18n.pickAlt(line.name, line.nameAr) }}</span>
              @if (line.custom; as c) {
                <details class="cp-details">
                  <summary>{{ c.summary ?? c.details.length + ' items' }}</summary>
                  <ul>
                    @for (d of i18n.pick(c.details, c.detailsAr); track d) {
                      <li>{{ d }}</li>
                    }
                    @if (c.message) {
                      <li class="cp-details__note">“{{ c.message }}”</li>
                    }
                  </ul>
                </details>
              }
              <div class="cp-qty">
                <button type="button" (click)="store.changeQty(line.productId, -1)" [attr.aria-label]="i18n.t('cart.dec')">&minus;</button>
                <span aria-live="polite">{{ line.qty }}</span>
                <button type="button" (click)="store.changeQty(line.productId, 1)" [attr.aria-label]="i18n.t('cart.inc')">+</button>
              </div>
            </div>
            <div class="cp-line__side">
              <b>{{ egp(line.unitPrice * line.qty) }}</b>
              <button type="button" (click)="store.remove(line.productId)">{{ i18n.t('cart.remove') }}</button>
            </div>
          </article>
        } @empty {
          <div class="cp-empty">
            <p>{{ i18n.t('cart.empty') }}</p>
            <button type="button" (click)="browse()">{{ i18n.t('hero.cta.explore') }}</button>
          </div>
        }
      </div>

      @if (store.cartLines().length) {
        <footer>
          <div class="cp-total">
            <span>{{ i18n.t('cart.subtotal') }}</span>
            <b>{{ egp(store.cartTotal()) }}</b>
          </div>
          <p>{{ i18n.t('cart.note') }}</p>
          <button type="button" class="cp-checkout" (click)="gift()">{{ i18n.t('cart.checkout') }}</button>
        </footer>
      }
    </aside>
  `,
  styles: `
    $ease: cubic-bezier(0.22, 1, 0.36, 1);
    $rose-soft: #d05875;
    $rose-ink: #8a2a4a;
    $ink: #3b2129;
    :host { display: contents; }

    .cp-toast {
      /* auto margins centre it while letting it size to its content (left:50% would cap it at half the screen) */
      position: fixed; z-index: 90; inset-inline: 0; bottom: 1.5rem; margin-inline: auto;
      width: max-content; max-width: calc(100vw - 2rem);
      display: flex; align-items: center; gap: 0.9rem; padding: 0.55rem;
      border-radius: 1.2rem; color: $ink; background: rgb(255 252 249 / 0.8);
      border: 1px solid rgb(208 88 117 / 0.35); box-shadow: 0 30px 70px -20px rgb(110 31 59 / 0.34);
      animation: cp-toast 3.4s $ease both;
      @media (max-width: 639px) { bottom: 6rem; } /* above the phone tab bar */
      img { width: 2.75rem; height: 3.4rem; object-fit: cover; border-radius: 0.8rem; }
      img { flex: none; }
      > span { min-width: 0; }
      small { display: block; font-size: 0.62rem; letter-spacing: 0.18em; text-transform: uppercase; color: $rose-ink; white-space: nowrap; }
      strong { display: block; font-family: var(--font-display); font-weight: 400; font-size: 1.15rem; line-height: 1.25;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      button { flex: none; margin-inline-start: 0.4rem; padding: 0.55rem 1.1rem; border-radius: 999px; font-size: 0.66rem; white-space: nowrap;
        letter-spacing: 0.18em; text-transform: uppercase; color: #0b090a; background: linear-gradient(120deg, #f4b6c6, $rose-soft); }
    }
    /* Arabic: no letter-spacing (it breaks the joins), larger type */
    :host-context(html[lang='ar']) .cp-toast {
      small { font-size: 0.82rem; letter-spacing: 0; text-transform: none; }
      strong { font-size: 1.3rem; }
      button { font-size: 0.9rem; letter-spacing: 0; text-transform: none; font-weight: 500; color: #fff;
        background: linear-gradient(120deg, $rose-soft, $rose-ink); }
    }
    @keyframes cp-toast {
      0% { opacity: 0; transform: translateY(1.5rem) scale(0.96); }
      9%, 88% { opacity: 1; transform: none; }
      100% { opacity: 0; transform: translateY(0.8rem); visibility: hidden; }
    }

    .cp-backdrop {
      position: fixed; inset: 0; z-index: 94; background: rgb(255 252 249 / 0.72);
      opacity: 0; visibility: hidden; transition: opacity 0.6s $ease, visibility 0.6s;
      &.is-open { opacity: 1; visibility: visible; }
    }

    .cp-drawer {
      position: fixed; z-index: 95; top: 0; right: 0; bottom: 0; display: flex; flex-direction: column;
      width: min(26rem, 100vw); color: $ink;
      background: linear-gradient(180deg, rgb(255 252 249 / 0.94), rgb(255 252 249 / 0.94));
      border-left: 1px solid rgb(181 66 91 / 0.15);
      transform: translateX(104%); visibility: hidden;
      transition: transform 0.8s $ease, visibility 0.8s;
      &.is-open { transform: none; visibility: visible; }

      header { display: flex; align-items: flex-start; justify-content: space-between; padding: 1.6rem 1.6rem 1.2rem;
        border-bottom: 1px solid rgb(181 66 91 / 0.14);
        p { margin: 0; font-size: 0.66rem; letter-spacing: 0.3em; text-transform: uppercase; color: $rose-ink; }
        h2 { margin: 0.3rem 0 0; font-family: var(--font-display); font-weight: 300; font-size: 2.3rem; line-height: 1;
          em { font-style: italic; color: #d05875; } } }
    }

    .cp-close { display: grid; place-items: center; width: 2.6rem; height: 2.6rem; border-radius: 50%;
      border: 1px solid rgb(181 66 91 / 0.21); transition: all 0.4s $ease;
      &:hover { border-color: $rose-ink; color: $rose-ink; transform: rotate(90deg); } }

    .cp-body { flex: 1; overflow-y: auto; padding: 0.4rem 1.6rem; overscroll-behavior: contain; }

    .cp-line { display: grid; grid-template-columns: auto 1fr auto; gap: 1rem; padding: 1.1rem 0;
      border-bottom: 1px solid rgb(181 66 91 / 0.14);
      img { width: 4.5rem; height: 5.6rem; object-fit: cover; border-radius: 1rem; }
      h3 { margin: 0; font-family: var(--font-display); font-weight: 400; font-size: 1.35rem; line-height: 1.1; }
      .cp-line__info { display: flex; flex-direction: column; align-items: flex-start; }
      .cp-line__info > span { font-family: var(--font-ar-display); font-size: 1rem; line-height: 1.5; color: $rose-ink; }
      .cp-line__side { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between;
        b { font-family: var(--font-display); font-weight: 500; font-size: 1.15rem; }
        button { font-size: 0.62rem; letter-spacing: 0.16em; text-transform: uppercase; color: rgb(59 33 41 / 0.6);
          &:hover { color: #b5425b; } } } }

    .cp-thumb { width: 4.5rem; align-self: start;
      &--sm { width: 2.75rem; } }
    .cp-details { margin: 0.3rem 0 0; font-size: 0.72rem; line-height: 1.5; color: rgb(59 33 41 / 0.7);
      summary { display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; list-style: none;
        letter-spacing: 0.04em; transition: color 0.3s;
        &::-webkit-details-marker { display: none; }
        &::after { content: ''; width: 0.4rem; height: 0.4rem; border-right: 1.5px solid currentColor;
          border-bottom: 1.5px solid currentColor; transform: rotate(45deg) translateY(-1px); transition: transform 0.4s $ease; }
        &:hover { color: $rose-ink; } }
      &[open] summary::after { transform: rotate(225deg); }
      ul { margin: 0.5rem 0 0; padding: 0.6rem 0.8rem; list-style: none; display: grid; gap: 0.2rem;
        border-radius: 0.8rem; background: rgb(255 255 255 / 0.66); border: 1px solid rgb(181 66 91 / 0.14); }
      &__note { margin-top: 0.3rem; font-family: var(--font-display); font-style: italic; font-size: 0.95rem; color: #d05875; } }

    .cp-qty { display: inline-flex; align-items: center; gap: 0.2rem; margin-top: 0.7rem; border-radius: 999px;
      border: 1px solid rgb(181 66 91 / 0.21);
      button { width: 1.9rem; height: 1.9rem; border-radius: 50%; font-size: 1rem; transition: background-color 0.3s;
        &:hover { background: rgb(181 66 91 / 0.1); } }
      span { min-width: 1.4rem; text-align: center; font-size: 0.82rem; } }

    .cp-empty { display: grid; justify-items: center; gap: 1.2rem; padding: 4rem 0; text-align: center;
      p { margin: 0; font-family: var(--font-display); font-style: italic; font-size: 1.5rem; color: rgb(59 33 41 / 0.85); }
      button { padding: 0.85rem 1.6rem; border-radius: 999px; font-size: 0.68rem; letter-spacing: 0.2em; text-transform: uppercase;
        border: 1px solid rgb(208 88 117 / 0.5); color: $rose-ink; transition: all 0.4s $ease;
        &:hover { background: $rose-soft; color: #0b090a; } } }

    .cp-drawer footer { padding: 1.3rem 1.6rem 1.6rem; border-top: 1px solid rgb(181 66 91 / 0.14);
      p { margin: 0.6rem 0 1.1rem; font-size: 0.76rem; line-height: 1.5; color: rgb(59 33 41 / 0.65); } }
    .cp-total { display: flex; align-items: baseline; justify-content: space-between;
      span { font-size: 0.7rem; letter-spacing: 0.22em; text-transform: uppercase; color: rgb(59 33 41 / 0.8); }
      b { font-family: var(--font-display); font-weight: 500; font-size: 1.8rem; } }
    .cp-checkout { width: 100%; padding: 1.05rem; border-radius: 999px; font-size: 0.74rem; letter-spacing: 0.22em;
      text-transform: uppercase; color: #fff; background: linear-gradient(120deg, #b5425b, #b5425b 45%, #8a2a4a);
      box-shadow: 0 20px 50px -16px rgb(181 66 91 / 0.8); transition: box-shadow 0.5s $ease, transform 0.5s $ease;
      &:hover { transform: translateY(-2px); box-shadow: 0 26px 60px -12px rgb(181 66 91 / 1); } }

    /* Short windows (laptops with toolbars, landscape phones): give the item list the room. */
    @media (max-height: 640px) {
      .cp-drawer {
        header { padding: 1rem 1.4rem 0.8rem; h2 { font-size: 1.8rem; } }
        footer { padding: 0.8rem 1.4rem 1rem; p { display: none; }
          .cp-checkout { padding: 0.85rem; } }
      }
      .cp-total { margin-bottom: 0.7rem; b { font-size: 1.5rem; } }
    }
  `,
})
export class CartPanelComponent {
  protected readonly store = inject(StoreService);
  protected readonly i18n = inject(I18nService);
  private readonly motion = inject(MotionService);
  private readonly pages = inject(PageNavService);
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  protected readonly egp = formatEgp;
  protected readonly thumb = (id: string): string => unsplashUrl(id, 160, 200);

  /** Current toast; cleared after its animation so re-opening the drawer never replays it. */
  protected readonly toast = signal<AddedNotice | null>(null);
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    effect(() => {
      const added = this.store.lastAdded();
      untracked(() => {
        clearTimeout(this.toastTimer);
        this.toast.set(added);
        if (added) this.toastTimer = setTimeout(() => this.toast.set(null), 3400);
      });
    });

    // Lock page scroll + move focus while the drawer is open.
    effect(() => {
      const open = this.store.cartOpen();
      untracked(() => {
        if (open) {
          this.motion.lock();
          queueMicrotask(() => this.closeBtn()?.nativeElement.focus());
        } else {
          this.motion.unlock();
        }
      });
    });
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.store.cartOpen()) this.close();
  }

  protected open(): void {
    this.store.cartOpen.set(true);
  }

  protected close(): void {
    this.store.cartOpen.set(false);
  }

  protected browse(): void {
    this.close();
    setTimeout(() => this.pages.toHome('#collections'), 350);
  }

  protected gift(): void {
    this.close();
    setTimeout(() => this.pages.toOrder(), 350);
  }
}
