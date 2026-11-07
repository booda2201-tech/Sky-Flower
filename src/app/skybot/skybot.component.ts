import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Observable, distinctUntilChanged, map } from 'rxjs';
import { I18nService } from '../core/i18n.service';
import { StoreService } from '../core/store.service';
import { FlowerProduct, formatEgp, unsplashUrl } from '../data/flower-data';
import { MagneticDirective } from '../shared/magnetic.directive';
import { MessagePopDirective } from './message-pop.directive';
import { ChatState, QuickReply } from './skybot.model';
import { SkyBotService } from './skybot.service';

const NUDGE_KEY = 'sky-flower.skybot-nudge.v1';

/**
 * The floating "SkyBot" concierge: launcher, glass chat panel and recommendation cards.
 * All conversation logic lives in `SkyBotService`; this component only renders its state
 * (`async` pipe) and forwards taps.
 */
@Component({
  selector: 'app-skybot',
  standalone: true,
  imports: [AsyncPipe, MessagePopDirective, MagneticDirective],
  templateUrl: './skybot.component.html',
  styleUrl: './skybot.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SkyBotComponent {
  private readonly bot = inject(SkyBotService);
  private readonly store = inject(StoreService);
  protected readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly body = viewChild<ElementRef<HTMLElement>>('body');
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  protected readonly state$: Observable<ChatState> = this.bot.state$;

  /** Product ids already added from a recommendation card (button flips to "Added"). */
  protected readonly added = signal<ReadonlySet<string>>(new Set());
  /** One-time speech bubble that invites a first-time visitor to chat. */
  protected readonly nudge = signal(false);

  protected readonly egp = formatEgp;
  protected readonly img = (id: string): string => unsplashUrl(id, 220, 280);

  constructor() {
    // Keep the newest message in view: re-run when the transcript, typing or reply set changes.
    this.bot.state$
      .pipe(
        map((s) => `${s.messages.length}:${s.typing}:${s.replies.length}`),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.scrollToEnd());

    // Move focus into the panel when it opens.
    this.bot.open$.pipe(takeUntilDestroyed()).subscribe((open) => {
      if (!open) return;
      this.nudge.set(false);
      setTimeout(() => this.closeBtn()?.nativeElement.focus(), 80);
    });

    this.scheduleNudge();
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.bot.snapshot.open) this.bot.close();
  }

  protected toggle(): void {
    this.bot.toggle();
  }

  protected close(): void {
    this.bot.close();
  }

  protected restart(): void {
    this.added.set(new Set());
    this.bot.restart();
  }

  protected choose(reply: QuickReply): void {
    if (reply.id === 'restart') this.added.set(new Set());
    this.bot.choose(reply);
  }

  /** The 1-click add-to-cart on a recommendation card. */
  protected addToCart(product: FlowerProduct): void {
    this.store.add(product);
    this.added.update((set) => new Set(set).add(product.id));
  }

  protected openBag(): void {
    this.store.cartOpen.set(true);
  }

  protected isAdded(id: string): boolean {
    return this.added().has(id);
  }

  // ---- internals -----------------------------------------------------------------------
  private scrollToEnd(): void {
    // Two frames: the first lets the new bubble render, the second lets GSAP settle its height.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = this.body()?.nativeElement;
        el?.scrollTo?.({ top: el.scrollHeight, behavior: 'smooth' });
      }),
    );
  }

  private scheduleNudge(): void {
    let seen = false;
    try {
      seen = globalThis.sessionStorage?.getItem(NUDGE_KEY) === '1';
    } catch {
      /* storage unavailable: just show it once per page load */
    }
    if (seen) return;

    const show = setTimeout(() => {
      if (this.bot.snapshot.open) return;
      this.nudge.set(true);
      try {
        globalThis.sessionStorage?.setItem(NUDGE_KEY, '1');
      } catch {
        /* ignore */
      }
    }, 9000);
    const hide = setTimeout(() => this.nudge.set(false), 9000 + 7000);
    this.destroyRef.onDestroy(() => {
      clearTimeout(show);
      clearTimeout(hide);
    });
  }
}
