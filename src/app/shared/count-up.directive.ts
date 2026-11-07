import { DestroyRef, Directive, ElementRef, NgZone, effect, inject, input, untracked } from '@angular/core';
import { gsap } from 'gsap';
import { currentLang } from '../core/lang';
import { formatEgp } from '../data/flower-data';

/**
 * Rolls a number from its current value to the bound one with a GSAP tween.
 *
 *   <b [appCountUp]="total" [countFormat]="egp"></b>
 *
 * The tween writes `textContent` directly (outside Angular's zone), so a 60fps counter never
 * triggers change detection. Interrupted tweens continue from the *displayed* value, which makes
 * rapid add / remove clicks feel like one fluid odometer. Honours reduced motion.
 */
@Directive({
  selector: '[appCountUp]',
  standalone: true,
})
export class CountUpDirective {
  readonly appCountUp = input.required<number>();
  readonly countFormat = input<(value: number) => string>(formatEgp);
  /** Seconds. */
  readonly countDuration = input(0.85);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private readonly counter = { value: 0 };
  private tween?: gsap.core.Tween;
  private primed = false;
  private lastTarget?: number;

  constructor() {
    effect(() => {
      const target = this.appCountUp();
      const format = this.countFormat();
      const duration = this.countDuration();
      // Tracked on purpose: the figure re-renders in the new script when the language changes.
      currentLang();
      untracked(() => {
        if (this.primed && target === this.lastTarget) {
          // Same number, only the language changed: re-format in place, no odometer roll.
          this.tween?.kill();
          this.counter.value = target;
          this.el.textContent = format(target);
          return;
        }
        this.lastTarget = target;
        this.roll(target, format, duration);
      });
    });
    inject(DestroyRef).onDestroy(() => this.tween?.kill());
  }

  private roll(target: number, format: (v: number) => string, duration: number): void {
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.tween?.kill();

    // First paint (and reduced motion): show the value without animating from zero.
    if (!this.primed || reduced) {
      this.primed = true;
      this.counter.value = target;
      this.el.textContent = format(target);
      return;
    }

    this.zone.runOutsideAngular(() => {
      this.tween = gsap.to(this.counter, {
        value: target,
        duration,
        ease: 'power3.out',
        onUpdate: () => {
          this.el.textContent = format(Math.round(this.counter.value));
        },
        onComplete: () => {
          this.counter.value = target;
          this.el.textContent = format(target);
        },
      });
      // A brief lift so the eye catches the change.
      gsap.fromTo(
        this.el,
        { scale: 1.07, transformOrigin: '0% 60%' },
        { scale: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.5)', overwrite: 'auto' },
      );
    });
  }
}
