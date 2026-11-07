import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';

/**
 * Drives the "deck" effect of a horizontally scrolling card row.
 * Writes `--deck` (0 = centred, 1 = a full card away) and `--deck-dir` (-1 / 1, which side the
 * card sits on) on every direct child, so the lean / dim / scale lives entirely in SCSS.
 * It measures real positions, so it works the same in LTR and RTL (scroll-driven CSS timelines
 * mis-handle RTL scrollers in some engines). rAF-throttled, outside Angular's zone.
 */
@Directive({
  selector: '[appDeck]',
  standalone: true,
})
export class DeckDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  private raf = 0;
  private mo?: MutationObserver;
  private ro?: ResizeObserver;

  ngOnInit(): void {
    this.zone.runOutsideAngular(() => {
      this.el.addEventListener('scroll', this.schedule, { passive: true });
      if (typeof MutationObserver !== 'undefined') {
        this.mo = new MutationObserver(this.schedule);
        this.mo.observe(this.el, { childList: true });
      }
      if (typeof ResizeObserver !== 'undefined') {
        this.ro = new ResizeObserver(this.schedule);
        this.ro.observe(this.el);
      }
      this.schedule();
    });
  }

  private readonly schedule = (): void => {
    if (!this.raf) this.raf = requestAnimationFrame(() => this.update());
  };

  private update(): void {
    this.raf = 0;
    const host = this.el.getBoundingClientRect();
    const mid = host.left + host.width / 2;
    for (const child of Array.from(this.el.children) as HTMLElement[]) {
      const r = child.getBoundingClientRect();
      if (!r.width) continue;
      const off = (r.left + r.width / 2 - mid) / (r.width * 0.85);
      child.style.setProperty('--deck', Math.min(1, Math.abs(off)).toFixed(3));
      child.style.setProperty('--deck-dir', off < 0 ? '-1' : '1');
    }
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.el.removeEventListener('scroll', this.schedule);
    this.mo?.disconnect();
    this.ro?.disconnect();
  }
}
