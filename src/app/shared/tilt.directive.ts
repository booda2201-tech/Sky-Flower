import { Directive, ElementRef, NgZone, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * 3D hover tilt + cursor-tracking glow.
 * Writes four CSS custom properties on the host - `--rx`, `--ry` (degrees) and `--mx`, `--my`
 * (pointer position in px) - so ALL visuals (transform, glowing border, glare) live in SCSS.
 * Updates are rAF-throttled and run outside Angular's zone. Inert on touch / reduced motion.
 */
@Directive({
  selector: '[appTilt]',
  standalone: true,
})
export class TiltDirective implements OnInit, OnDestroy {
  /** Maximum tilt in degrees. */
  readonly appTilt = input<number | string>(7);

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);

  private raf = 0;
  private px = 0;
  private py = 0;
  private enabled = false;

  ngOnInit(): void {
    this.enabled =
      matchMedia('(hover: hover) and (pointer: fine)').matches &&
      !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!this.enabled) return;

    this.zone.runOutsideAngular(() => {
      this.el.addEventListener('pointerenter', this.onEnter, { passive: true });
      this.el.addEventListener('pointermove', this.onMove, { passive: true });
      this.el.addEventListener('pointerleave', this.onLeave, { passive: true });
    });
  }

  private readonly onEnter = (): void => {
    this.el.classList.add('is-tilting');
  };

  private readonly onMove = (e: PointerEvent): void => {
    const r = this.el.getBoundingClientRect();
    this.px = e.clientX - r.left;
    this.py = e.clientY - r.top;
    if (!this.raf) this.raf = requestAnimationFrame(() => this.apply(r));
  };

  private apply(r: DOMRect): void {
    this.raf = 0;
    const max = Number(this.appTilt()) || 7;
    const nx = this.px / r.width - 0.5;
    const ny = this.py / r.height - 0.5;
    const s = this.el.style;
    s.setProperty('--ry', `${(nx * max * 2).toFixed(2)}deg`);
    s.setProperty('--rx', `${(-ny * max * 2).toFixed(2)}deg`);
    s.setProperty('--mx', `${this.px.toFixed(0)}px`);
    s.setProperty('--my', `${this.py.toFixed(0)}px`);
  }

  private readonly onLeave = (): void => {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.el.classList.remove('is-tilting');
    const s = this.el.style;
    s.setProperty('--rx', '0deg');
    s.setProperty('--ry', '0deg');
  };

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.el.removeEventListener('pointerenter', this.onEnter);
    this.el.removeEventListener('pointermove', this.onMove);
    this.el.removeEventListener('pointerleave', this.onLeave);
  }
}
