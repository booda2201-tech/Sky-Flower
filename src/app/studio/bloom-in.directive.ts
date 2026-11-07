import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { gsap } from 'gsap';

/**
 * Pops an SVG bloom into place when it is added: a springy scale-up with a quarter turn.
 * Put it on a `<g>` drawn around its own origin (0,0): the outer element carries the position,
 * so the two transforms never fight. The bbox centre is the pivot.
 */
@Directive({
  selector: '[appBloomIn]',
  standalone: true,
})
export class BloomInDirective implements OnInit, OnDestroy {
  private readonly el = inject<ElementRef<SVGGElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private tween?: gsap.core.Tween;

  ngOnInit(): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.zone.runOutsideAngular(() => {
      this.tween = gsap.from(this.el, {
        scale: 0,
        rotation: -70,
        opacity: 0,
        transformOrigin: '50% 50%',
        duration: 0.9,
        ease: 'elastic.out(1, 0.55)',
        clearProps: 'opacity',
      });
    });
  }

  ngOnDestroy(): void {
    this.tween?.kill();
  }
}
