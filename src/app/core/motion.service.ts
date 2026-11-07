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
  private visibility?: IntersectionObserver;
  private readonly watched = new WeakSet<Element>();

  private readonly coarsePointer =
    typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

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

      gsap.ticker.lagSmoothing(0);
      this.watchVisibility();

      if (this.prefersReducedMotion) return; // native scroll only

      // Touch screens already scroll with native momentum (Lenis never smoothed touch here), so
      // running it on phones only added a per-frame loop and scroll hijacking - skip it there.
      if (this.coarsePointer) return;

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
    });
  }

  /** `offset` (px) is applied to the destination: negative leaves room above the target. */
  scrollTo(target: string | HTMLElement | number, offset = 0): void {
    if (this.lenis) {
      this.lenis.scrollTo(target as never, { offset, duration: 1.6 });
      return;
    }
    // native path (phones / reduced motion)
    const el = typeof target === 'string' ? this.doc.querySelector<HTMLElement>(target) : target;
    const top =
      typeof el === 'number' || el == null
        ? (el ?? null)
        : el.getBoundingClientRect().top + window.scrollY + offset;
    if (top == null) return;
    window.scrollTo({ top, behavior: this.prefersReducedMotion ? 'auto' : 'smooth' });
  }

  /**
   * Looping CSS animations (floating cards, glows, pulses) keep the compositor busy even when
   * their section is far off-screen. This marks every section that is not near the viewport
   * with `.is-offscreen`, which pauses its animations (see styles.scss). They resume exactly
   * where they stopped, so nothing looks different - the work just isn't done unseen.
   * Safe to call again after a route change: new sections are picked up.
   */
  watchVisibility(): void {
    if (typeof IntersectionObserver === 'undefined') return;
    this.visibility ??= new IntersectionObserver(
      (entries) => {
        for (const e of entries) e.target.classList.toggle('is-offscreen', !e.isIntersecting);
      },
      { rootMargin: '160px 0px' },
    );
    // Pausing only starts once the page has settled, so first-view entrance animations are never held.
    setTimeout(() => {
      this.doc.querySelectorAll('section, footer').forEach((el) => {
        if (this.watched.has(el)) return;
        this.watched.add(el);
        this.visibility?.observe(el);
      });
    }, 3000);
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
    this.visibility?.disconnect();
    this.visibility = undefined;
    if (this.tick) gsap.ticker.remove(this.tick);
    this.lenis?.destroy();
    this.lenis = undefined;
    this.started = false;
  }
}
