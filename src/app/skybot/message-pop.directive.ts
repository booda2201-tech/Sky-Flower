import { AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, inject, input } from '@angular/core';
import { gsap } from 'gsap';

export type MessagePopMode = 'bot' | 'user' | 'cards' | 'chips';

/**
 * GSAP entrance for chat elements.
 *  - `bot`   springs up from the bottom-left (where SkyBot's avatar is)
 *  - `user`  springs up from the bottom-right
 *  - `cards` fades the container in and staggers its `.rec` children
 *  - `chips` staggers the quick-reply buttons
 * Runs outside the zone and leaves no inline styles behind (`clearProps`).
 */
@Directive({
  selector: '[appMsgPop]',
  standalone: true,
})
export class MessagePopDirective implements AfterViewInit, OnDestroy {
  readonly appMsgPop = input<MessagePopMode>('bot');

  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly zone = inject(NgZone);
  private tween?: gsap.core.Tween;

  ngAfterViewInit(): void {
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    this.zone.runOutsideAngular(() => {
      switch (this.appMsgPop()) {
        case 'user':
          this.tween = gsap.from(this.el, {
            autoAlpha: 0,
            x: 22,
            y: 14,
            scale: 0.9,
            transformOrigin: '100% 100%',
            duration: 0.55,
            ease: 'back.out(1.7)',
            clearProps: 'all',
          });
          break;
        case 'cards': {
          const cards = this.el.querySelectorAll('.rec');
          this.tween = gsap.from(cards.length ? cards : this.el, {
            autoAlpha: 0,
            y: 34,
            scale: 0.94,
            duration: 0.8,
            stagger: 0.14,
            ease: 'power3.out',
            clearProps: 'all',
          });
          break;
        }
        case 'chips':
          this.tween = gsap.from(this.el.children, {
            autoAlpha: 0,
            y: 14,
            scale: 0.9,
            duration: 0.5,
            stagger: 0.06,
            ease: 'back.out(1.6)',
            clearProps: 'all',
          });
          break;
        default:
          this.tween = gsap.from(this.el, {
            autoAlpha: 0,
            x: -22,
            y: 14,
            scale: 0.9,
            transformOrigin: '0% 100%',
            duration: 0.55,
            ease: 'back.out(1.7)',
            clearProps: 'all',
          });
      }
    });
  }

  ngOnDestroy(): void {
    this.tween?.kill();
  }
}
