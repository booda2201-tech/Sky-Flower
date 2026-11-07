import { ChangeDetectionStrategy, Component, HostListener, afterNextRender, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { MessageKey } from '../core/messages';
import { PageNavService } from '../core/page-nav.service';
import { StoreService } from '../core/store.service';
import { MagneticDirective } from '../shared/magnetic.directive';

interface NavLink {
  readonly id: string;
  readonly key: MessageKey;
}

/** Page sections in reading order; the ones without a link only mark where the previous one ends. */
const SECTIONS: readonly { readonly id: string; readonly linked: boolean }[] = [
  { id: 'top', linked: false },
  { id: 'occasions', linked: true },
  { id: 'collections', linked: true },
  { id: 'reviews', linked: true },
  { id: 'moments', linked: false },
  { id: 'studio', linked: true },
  { id: 'gifting', linked: true },
];

/**
 * The site's one navigation bar. It sits above every section (fixed), is see-through over the
 * hero and turns into frosted glass once the page scrolls, highlights the section you are in,
 * and folds into a menu on small screens.
 */
@Component({
  selector: 'app-site-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MagneticDirective],
  templateUrl: './site-nav.component.html',
  styleUrl: './site-nav.component.scss',
})
export class SiteNavComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly store = inject(StoreService);
  private readonly pages = inject(PageNavService);

  protected readonly links: readonly NavLink[] = [
    { id: 'occasions', key: 'nav.occasions' },
    { id: 'collections', key: 'nav.collections' },
    { id: 'studio', key: 'nav.studio' },
    { id: 'community', key: 'nav.community' },
    { id: 'gifting', key: 'nav.gifting' },
  ];

  protected readonly stuck = signal(false);
  protected readonly open = signal(false);
  protected readonly active = signal('');
  /** Scrolling down past the first screen tucks the bar away; scrolling up brings it back. */
  protected readonly hidden = signal(false);
  /** 0..1 - how far down the page you are; drawn as a hairline along the bottom of the bar. */
  protected readonly progress = signal(0);

  private frame = 0;
  private lastY = 0;

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

  @HostListener('window:resize')
  protected onResize(): void {
    if (window.innerWidth >= 768) this.open.set(false);
    this.onScroll();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.open.set(false);
  }

  protected go(event: Event, selector: string): void {
    event.preventDefault();
    this.open.set(false);
    this.pages.toHome(selector);
  }

  protected openBag(): void {
    this.open.set(false);
    this.store.cartOpen.set(true);
  }

  protected toggleMenu(): void {
    this.open.update((v) => !v);
  }

  private update(): void {
    const y = window.scrollY;
    this.stuck.set(y > 24);
    const max = document.documentElement.scrollHeight - window.innerHeight;
    this.progress.set(max > 0 ? Math.min(1, Math.max(0, y / max)) : 0);
    if (y < 240) {
      this.hidden.set(false);
      this.lastY = y;
    } else if (Math.abs(y - this.lastY) > 6) {
      this.hidden.set(y > this.lastY);
      this.lastY = y;
    }

    // The current section is the last one whose top has passed 40% of the viewport.
    const line = window.innerHeight * 0.4;
    let current = '';
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el && el.getBoundingClientRect().top <= line) current = s.linked ? s.id : '';
    }
    this.active.set(current);
  }
}
