import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Magnetic hover effect: the host (and optionally its inner `[data-magnetic-inner]`)
 * is gently pulled toward the cursor. Uses gsap.quickTo for allocation-free 60fps updates.
 * Disabled on touch devices and for reduced-motion users.
 */
@Directive({
  selector: '[appMagnetic]',
  standalone: true,
})
export class MagneticDirective implements OnInit, OnDestroy {
  /** 0 - 1: how far (relative to element size) the element follows the pointer. */
  readonly appMagnetic = input<number | string>(0.35);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  private moveX?: (v: number) => void;
  private moveY?: (v: number) => void;
  private enabled = false;

  ngOnInit(): void {
    this.enabled =
      matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.enabled) return;

    this.zone.runOutsideAngular(() => {
      this.moveX = gsap.quickTo(this.el, 'x', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      this.moveY = gsap.quickTo(this.el, 'y', { duration: 0.9, ease: 'elastic.out(1, 0.45)' });
      this.el.addEventListener('pointermove', this.onMove, { passive: true });
      this.el.addEventListener('pointerleave', this.onLeave, { passive: true });
    });
  }

  private readonly onMove = (e: PointerEvent): void => {
    const strength = Number(this.appMagnetic()) || 0.35;
    const r = this.el.getBoundingClientRect();
    this.moveX?.((e.clientX - (r.left + r.width / 2)) * strength);
    this.moveY?.((e.clientY - (r.top + r.height / 2)) * strength);
  };

  private readonly onLeave = (): void => {
    this.moveX?.(0);
    this.moveY?.(0);
  };

  ngOnDestroy(): void {
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
    gsap.killTweensOf(this.el);
  }
}
