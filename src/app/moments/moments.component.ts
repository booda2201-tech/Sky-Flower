import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { I18nService } from '../core/i18n.service';
import { BRAND_REELS, BrandReel, reelEmbedUrl, reelFile, reelThumb } from '../data/brand-media';
/**
 * "From our shop": the brand's real reels. A snap-scrolling strip of vertical thumbnails;
 * tapping one plays it in a lightbox through YouTube's official embed.
 */
@Component({
  selector: 'app-moments',
  standalone: true,
  templateUrl: './moments.component.html',
  styleUrl: './moments.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MomentsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly sanitizer = inject(DomSanitizer);

  private readonly track = viewChild.required<ElementRef<HTMLElement>>('track');
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  protected readonly reels = BRAND_REELS;
  protected readonly thumb = reelThumb;
  protected readonly file = reelFile;

  /** Reels whose original file could not be loaded: they play through the YouTube embed instead. */
  protected readonly missing = signal<ReadonlySet<string>>(new Set());

  /** The reel currently open in the lightbox, if any. */
  protected readonly playing = signal<BrandReel | null>(null);
  protected readonly embed = computed<SafeResourceUrl | null>(() => {
    const reel = this.playing();
    return reel ? this.sanitizer.bypassSecurityTrustResourceUrl(reelEmbedUrl(reel.id)) : null;
  });

  private opener: HTMLElement | null = null;

  protected open(reel: BrandReel, event: Event): void {
    this.opener = event.currentTarget as HTMLElement;
    this.playing.set(reel);
    // The dialog is rendered on the next change-detection pass.
    setTimeout(() => this.closeBtn()?.nativeElement.focus(), 0);
  }

  protected fileMissing(reel: BrandReel): void {
    this.missing.update((s) => new Set(s).add(reel.id));
  }

  /** Tap the video to pause / resume (local files only). */
  protected togglePlay(event: Event): void {
    const video = event.currentTarget as HTMLVideoElement;
    if (video.paused) void video.play();
    else video.pause();
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    if (!this.playing()) return;
    this.playing.set(null);
    this.opener?.focus();
    this.opener = null;
  }

  /** Scrolls roughly one card; RTL scrolls towards negative offsets. */
  protected scrollBy(direction: 1 | -1): void {
    const el = this.track().nativeElement;
    const step = (el.querySelector('li')?.clientWidth ?? 280) + 16;
    const sign = this.i18n.isAr() ? -1 : 1;
    el.scrollBy({ left: direction * sign * step * 1.5, behavior: 'smooth' });
  }
}
