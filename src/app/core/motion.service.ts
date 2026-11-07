import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, NgZone, inject } from '@angular/core';
import AOS from 'aos';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from '@studio-freight/lenis';

/**
 * Single owner of every *global* motion system:
 *  - GSAP plugin registration (once)
 *  - Lenis momentum scrolling, driven by GSAP's ticker so ScrollTrigger stays in perfect sync
 *  - AOS (fade / zoom on scroll)
 *
 * Everything runs outside Angular's zone: scroll/raf work must never trigger change detection.
 */
@Injectable({ providedIn: 'root' })
export class MotionService {
  private readonly zone = inject(NgZone);
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private lenis?: Lenis;
  private tick?: (time: number) => void;
  private started = false;

  readonly prefersReducedMotion =
    typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    gsap.registerPlugin(ScrollTrigger);
    this.destroyRef.onDestroy(() => this.stop());
  }

  /** Idempotent - safe to call from the root component. */
  start(): void {
    if (this.started) return;
    this.started = true;

    this.zone.runOutsideAngular(() => {
      AOS.init({
        duration: 900,
        easing: 'ease-out-cubic',
        offset: 90,
        once: true,
        disable: this.prefersReducedMotion,
      });

      if (this.prefersReducedMotion) return; // native scroll only

      this.lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 0.95,
        touchMultiplier: 1.4,
      });

      // Lenis -> ScrollTrigger, and GSAP ticker -> Lenis (one single rAF loop).
      this.lenis.on('scroll', ScrollTrigger.update);
      this.tick = (time: number) => this.lenis?.raf(time * 1000);
      gsap.ticker.add(this.tick);
      gsap.ticker.lagSmoothing(0);
    });
  }

  /** `offset` (px) is applied to the destination: negative leaves room above the target. */
  scrollTo(target: string | HTMLElement | number, offset = 0): void {
    if (this.lenis) {
      this.lenis.scrollTo(target as never, { offset, duration: 1.6 });
    } else if (typeof target === 'string') {
      this.doc.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
    }
  }

  /** Freeze page scrolling (cart drawer open). */
  lock(): void {
    this.lenis?.stop();
    this.doc.documentElement.style.overflow = 'hidden';
  }

  unlock(): void {
    this.lenis?.start();
    this.doc.documentElement.style.overflow = '';
  }

  private stop(): void {
    if (this.tick) gsap.ticker.remove(this.tick);
    this.lenis?.destroy();
    this.lenis = undefined;
    this.started = false;
  }
}
