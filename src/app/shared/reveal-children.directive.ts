import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject, input } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Staggers a container's children in with GSAP when the container is created - used for the
 * studio's step panels, which are re-created every time the step changes.
 */
@Directive({
  selector: '[appRevealChildren]',
  standalone: true,
})
export class RevealChildrenDirective implements AfterViewInit, OnDestroy {
  /** Optional CSS selector for the children to animate (defaults to direct children). */
  readonly appRevealChildren = input<string>('');
  readonly revealStagger = input(0.06);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private tween?: gsap.core.Tween;

  ngAfterViewInit(): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const selector = this.appRevealChildren();
    const targets = selector ? this.el.querySelectorAll(selector) : this.el.children;
    if (!targets.length) return;

    this.zone.runOutsideAngular(() => {
      this.tween = gsap.from(targets, {
        y: 26,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: this.revealStagger(),
        clearProps: 'transform,opacity',
      });
    });
  }

  ngOnDestroy(): void {
    this.tween?.kill();
  }
}
