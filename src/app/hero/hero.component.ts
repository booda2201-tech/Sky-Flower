import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { I18nService } from '../core/i18n.service';
import { MessageKey } from '../core/messages';
import { MotionService } from '../core/motion.service';
import { StoreService } from '../core/store.service';
import {
  CATALOG_STATS,
  FlowerProduct,
  formatEgp,
  formatNumber,
  unsplashSrcset,
  unsplashUrl,
} from '../data/flower-data';
import { BRAND_SOCIALS, whatsappLink } from '../data/brand';
import { MagneticDirective } from '../shared/magnetic.directive';
import type { BouquetScene } from './bouquet-scene';

interface HeroDetail {
  readonly n: number;
  readonly k: MessageKey;
  readonly t: MessageKey;
  readonly x: MessageKey;
}

const AUTOPLAY_SECONDS = 7;
/** Scroll progress (0..1 through the hero) after which the featured carousel stops cycling. */
const AUTOPLAY_UNTIL = 0.08;

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [MagneticDirective],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroComponent implements AfterViewInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly motion = inject(MotionService);
  protected readonly store = inject(StoreService);
  protected readonly i18n = inject(I18nService);

  // ---- template refs -------------------------------------------------------------------
  private readonly wrapEl = viewChild.required<ElementRef<HTMLElement>>('wrap');
  private readonly heroEl = viewChild.required<ElementRef<HTMLElement>>('hero');
  private readonly canvasEl = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly pickEl = viewChild.required<ElementRef<HTMLElement>>('pick');
  private readonly fabsEl = viewChild.required<ElementRef<HTMLElement>>('fabs');

  // ---- view state ----------------------------------------------------------------------
  protected readonly products = this.store.products;
  protected readonly activeIndex = signal(0);
  protected readonly active = computed<FlowerProduct>(() => this.products[this.activeIndex()]);
  protected readonly webglFailed = signal(false);

  protected readonly stats = CATALOG_STATS;

  /** The three captions that appear while the camera dives into the hero rose. */
  protected readonly details: readonly HeroDetail[] = [
    { n: 1, k: 'hero.d1.k', t: 'hero.d1.t', x: 'hero.d1.x' },
    { n: 2, k: 'hero.d2.k', t: 'hero.d2.t', x: 'hero.d2.x' },
    { n: 3, k: 'hero.d3.k', t: 'hero.d3.t', x: 'hero.d3.x' },
  ];

  protected readonly socials = BRAND_SOCIALS;
  /** Opens a WhatsApp chat with the shop, greeting already typed. */
  protected readonly whatsapp = (): string => whatsappLink(this.i18n.t('wa.hello'));
  /** The brand's real Facebook following, in millions (e.g. `1.5`). */
  protected readonly followersMillions = parseFloat(BRAND_SOCIALS.find((s) => s.id === 'facebook')?.followers ?? '0');

  // ---- template helpers ----------------------------------------------------------------
  protected readonly formatEgp = formatEgp;
  protected readonly formatNumber = formatNumber;
  protected readonly img = (id: string, w: number): string => unsplashUrl(id, w, Math.round(w * 1.25));
  protected readonly srcset = (id: string): string => unsplashSrcset(id, [360, 560, 760]);

  // ---- runtime (non-reactive on purpose) ----------------------------------------------
  private ctx?: gsap.Context;
  private splits: SplitText[] = [];
  private destroyed = false;
  private autoplay?: gsap.core.Tween;
  private readonly progress = { value: 0 };
  private autoplayEnabled = false;
  private hoverPaused = false;
  private scrollPaused = false;

  private scene?: BouquetScene;
  private rafId = 0;
  private running = false;
  private inView = true;
  private lastTime = 0;
  private resizeObserver?: ResizeObserver;
  private intersectionObserver?: IntersectionObserver;
  private readonly introState = { value: 0 };

  constructor() {
    // The bouquet sits opposite the copy: swap sides when the language flips the layout.
    effect(() => {
      this.i18n.isAr();
      this.ngZone.runOutsideAngular(() => this.resize());
    });
  }

  // ===================================================================================
  // Lifecycle
  // ===================================================================================
  ngAfterViewInit(): void {
    // Rendering loops, GSAP and pointer handlers all live OUTSIDE Angular's zone so a
    // 60fps stream of events never triggers change detection.
    this.ngZone.runOutsideAngular(async () => {
      window.addEventListener('pointermove', this.onPointerMove, { passive: true });
      document.addEventListener('pointerleave', this.onPointerLeave);
      window.addEventListener('blur', this.onPointerLeave);
      document.addEventListener('visibilitychange', this.onVisibility);

      // Load the WebGL chunk and the web fonts in parallel, then play the intro.
      await Promise.all([this.initScene(), this.waitForFonts()]);
      if (this.destroyed) return;
      this.initAnimations();
    });
  }

  ngOnDestroy(): void {
    this.destroyed = true;

    this.running = false;
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('pointermove', this.onPointerMove);
    document.removeEventListener('pointerleave', this.onPointerLeave);
    window.removeEventListener('blur', this.onPointerLeave);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.resizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();
    const canvas = this.canvasEl().nativeElement;
    canvas.removeEventListener('webglcontextlost', this.onContextLost);
    canvas.removeEventListener('webglcontextrestored', this.onContextRestored);

    // GSAP: reverts tweens, timelines, SplitText and every ScrollTrigger made in the context.
    this.autoplay?.kill();
    this.ctx?.revert();
    this.splits.forEach((s) => s.revert());
    this.splits = [];

    this.scene?.dispose();
    this.scene = undefined;
  }

  // ===================================================================================
  // Three.js scene (the bouquet itself lives in bouquet-scene.ts, code-split)
  // ===================================================================================
  private async initScene(): Promise<void> {
    const canvas = this.canvasEl().nativeElement;
    const coarse = matchMedia('(pointer: coarse)').matches || window.innerWidth < 768;
    try {
      const { BouquetScene: Scene } = await import('./bouquet-scene');
      if (this.destroyed) return; // component died while the chunk was loading
      const scene = await Scene.create({ canvas, coarse, calm: this.motion.prefersReducedMotion });
      if (this.destroyed) {
        scene.dispose();
        return;
      }
      this.scene = scene;
      scene.setPalette(this.activeIndex(), true);

      canvas.addEventListener('webglcontextlost', this.onContextLost);
      canvas.addEventListener('webglcontextrestored', this.onContextRestored);

      const host = this.heroEl().nativeElement;
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(host);
      this.intersectionObserver = new IntersectionObserver(
        ([entry]) => {
          this.inView = entry.isIntersecting;
          this.syncLoop();
        },
        { threshold: 0 },
      );
      this.intersectionObserver.observe(this.wrapEl().nativeElement);

      this.resize();
      this.syncLoop();
    } catch (err) {
      console.warn('[SkyFlower] WebGL unavailable - using the photo fallback.', err);
      this.ngZone.run(() => this.webglFailed.set(true));
    }
  }

  // ---- loop control ------------------------------------------------------------------
  private syncLoop(): void {
    const shouldRun = !this.destroyed && !!this.scene && this.inView && !document.hidden;
    if (shouldRun && !this.running) {
      this.running = true;
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    } else if (!shouldRun && this.running) {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    }
  }

  private readonly loop = (now: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const dt = Math.min((now - this.lastTime) / 1000, 0.05); // clamp: tab-switch spikes
    this.lastTime = now;
    this.scene?.render(dt);
  };

  private resize(): void {
    const scene = this.scene;
    if (!scene || this.destroyed) return;
    const host = this.heroEl().nativeElement;
    scene.resize(host.clientWidth, host.clientHeight, window.innerWidth >= 1024 ? 'side' : 'stack', this.i18n.isAr());
  }

  // ---- events ------------------------------------------------------------------------
  private readonly onPointerMove = (e: PointerEvent): void => {
    if (!this.scene) return;
    this.scene.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
  };

  private readonly onPointerLeave = (): void => this.scene?.setPointer(0, 0);

  private readonly onVisibility = (): void => this.syncLoop();

  private readonly onContextLost = (e: Event): void => {
    e.preventDefault(); // allow restoration
    this.running = false;
    cancelAnimationFrame(this.rafId);
  };

  private readonly onContextRestored = (): void => this.syncLoop();

  // ===================================================================================
  // GSAP: intro timeline, the scroll-driven dive, floating buttons
  // ===================================================================================
  private initAnimations(): void {
    const wrap = this.wrapEl().nativeElement;
    const root = this.heroEl().nativeElement;
    const fabs = this.fabsEl().nativeElement;
    const reduced = this.motion.prefersReducedMotion;

    if (reduced) {
      root.classList.add('is-ready');
      fabs.classList.add('is-ready');
      this.setStatsFinal(root);
      this.scene?.setIntro(1);
      this.scene?.render(0);
      return;
    }

    this.ctx = gsap.context(() => {
      const q = gsap.utils.selector(root);
      const qf = gsap.utils.selector(fabs);

      // Headline: SplitText (the SplitType equivalent bundled with GSAP) -> masked chars.
      // Arabic letters join each other, so the headline is split by WORD there: wrapping single
      // characters would break the joins and the text would read as disconnected glyphs.
      const arabic = this.i18n.lang() === 'ar';
      const titleSplit = SplitText.create(q('.hero__title')[0], {
        type: arabic ? 'lines,words' : 'lines,chars',
        mask: 'lines',
        linesClass: 'hero__split-line',
      });
      const titlePieces = arabic ? titleSplit.words : titleSplit.chars;
      const leadSplit = SplitText.create(q('.hero__lead')[0], { type: 'lines', mask: 'lines' });
      this.splits.push(titleSplit, leadSplit);

      // "From" state first, THEN reveal the container: no flash of unstyled content.
      gsap.set(titlePieces, { yPercent: 125, rotate: arabic ? 0 : 7, transformOrigin: '0% 100%' });
      gsap.set(leadSplit.lines, { yPercent: 110 });
      gsap.set(q('[data-reveal]'), { autoAlpha: 0, y: 30 });
      gsap.set(q('.hero__ar'), { autoAlpha: 0, y: 14, filter: 'blur(8px)' });
      gsap.set(q('.hero__ornament'), { scaleX: 0 });
      gsap.set(qf('.hero__fab'), { autoAlpha: 0, x: 90, scale: 0.7 });
      gsap.set(q('.hero__detail'), { autoAlpha: 0, y: 28 });
      root.classList.add('is-ready');
      fabs.classList.add('is-ready');

      const tl = gsap.timeline({
        defaults: { ease: 'expo.out' },
        delay: 0.1,
        onComplete: () => {
          // Re-flow naturally on resize once the intro is done.
          titleSplit.revert();
          leadSplit.revert();
          this.splits = [];
        },
      });

      // The bouquet grows in while the typography reveals.
      tl.to(
        this.introState,
        { value: 1, duration: 2.6, ease: 'power3.out', onUpdate: () => this.scene?.setIntro(this.introState.value) },
        0.15,
      );

      tl.to(q('.hero__bg-glow'), { autoAlpha: 1, scale: 1, duration: 2.6, stagger: 0.25 }, 0)
        .to(q('[data-reveal="eyebrow"]'), { autoAlpha: 1, y: 0, duration: 1.1 }, 0.35)
        .to(titlePieces, { yPercent: 0, rotate: 0, duration: 1.6, stagger: { each: arabic ? 0.12 : 0.028, from: 'start' } }, 0.5)
        .to(q('.hero__ar'), { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 1.4 }, 1.15)
        .to(q('.hero__ornament'), { scaleX: 1, duration: 1.6, ease: 'power3.inOut' }, 1.1)
        .to(leadSplit.lines, { yPercent: 0, duration: 1.2, stagger: 0.12 }, 1.25)
        .to(q('[data-reveal="cta"]'), { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.12 }, 1.5)
        .to(q('[data-reveal="stat"]'), { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, 1.7)
        .to(q('[data-reveal="pick"]'), { autoAlpha: 1, y: 0, duration: 1.2 }, 1.9)
        .to(q('[data-reveal="foot"]'), { autoAlpha: 1, y: 0, duration: 1.1, stagger: 0.1 }, 2.0)
        // Floating action buttons spring in from the edge of the screen.
        .to(qf('.hero__fab'), { autoAlpha: 1, x: 0, scale: 1, duration: 1.3, stagger: 0.13, ease: 'elastic.out(1, 0.6)' }, 2.2);

      // Count-up stats.
      q('[data-count]').forEach((el) => {
        const target = Number(el.dataset['count']);
        const decimals = Number(el.dataset['decimals'] ?? 0);
        const obj = { v: 0 };
        gsap.to(obj, {
          v: target,
          duration: 2.2,
          delay: 1.9,
          ease: 'power2.out',
          onUpdate: () => (el.textContent = this.formatCount(obj.v, decimals)),
        });
      });

      // ---- the dive ------------------------------------------------------------------
      // 1) Progress through the pinned hero drives the camera.
      ScrollTrigger.create({
        trigger: wrap,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          this.scene?.setScroll(self.progress);
          const paused = self.progress > AUTOPLAY_UNTIL;
          if (paused !== this.scrollPaused) {
            this.scrollPaused = paused;
            this.syncAutoplay();
          }
        },
        onRefresh: (self) => this.scene?.setScroll(self.progress),
      });

      // 2) The page chrome steps aside, and three captions take turns while the lens closes in.
      const heroEl = this.heroEl().nativeElement;
      const occasions = document.querySelector<HTMLElement>('app-occasions');
      const portal = { v: -20 };
      const applyPortal = (): void => {
        const v = portal.v;
        heroEl.style.setProperty('--portal', v.toFixed(2));
        heroEl.classList.toggle('is-portal', v > -19.9);
        heroEl.classList.toggle('is-through', v >= 99.9);
        // the first section lands as the portal opens: it settles from slightly zoomed to rest
        occasions?.style.setProperty('--land', Math.min(1, Math.max(0, (v + 20) / 120)).toFixed(3));
      };
      applyPortal();
      const dive = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: wrap, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      });
      dive
        .to(q('.hero__copy'), { autoAlpha: 0, y: -50, duration: 0.14 }, 0.02)
        .to(q('.hero__vignette'), { autoAlpha: 0, duration: 0.2 }, 0.02)
        .to(q('.hero__bar'), { autoAlpha: 0, y: 30, duration: 0.12 }, 0.03)
        .to(q('.hero__foot'), { autoAlpha: 0, duration: 0.08 }, 0.03)
        // The very last frames: the world is page colour, grain and all (the portal is long open by now).
        .to(q('.hero__page'), { opacity: 1, duration: 0.03, ease: 'power1.inOut' }, 0.97)
        .to(q('.hero__grain'), { opacity: 0, duration: 0.03 }, 0.97)
        // THE PORTAL: the light at the end of the tunnel opens up and the site is simply there,
        // already in place behind it - no sliding in from below. Radius is driven by scroll.
        .to(portal, { v: 100, duration: 0.2, ease: 'power2.in', onUpdate: applyPortal }, 0.79);
      const spans: readonly [number, number, number, number][] = [
        [0.17, 0.25, 0.44, 0.5],
        [0.52, 0.6, 0.74, 0.8],
        [0.8, 0.86, 0.885, 0.925],
      ];
      q('.hero__detail').forEach((el, i) => {
        const [inA, inB, outA, outB] = spans[i];
        dive.fromTo(el, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: inB - inA, ease: 'power2.out' }, inA);
        if (outB > outA) dive.to(el, { autoAlpha: 0, y: -28, duration: outB - outA, ease: 'power2.in' }, outA);
      });
      dive.set({}, {}, 1); // pad the timeline to exactly 1 so progress maps 1:1

      // Endless micro-motion on the scroll cue.
      gsap.to(q('.hero__cue-line i'), { yPercent: 100, duration: 1.6, ease: 'power2.inOut', repeat: -1, repeatDelay: 0.3 });

      // Start the featured-product carousel once the bouquet has landed.
      tl.add(() => this.startAutoplay(), 3.2);
    }, root);
  }

  private formatCount(v: number, decimals: number): string {
    return decimals ? v.toFixed(decimals) : formatNumber(Math.round(v));
  }

  private setStatsFinal(root: HTMLElement): void {
    root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
      el.textContent = this.formatCount(Number(el.dataset['count']), Number(el.dataset['decimals'] ?? 0));
    });
  }

  private waitForFonts(): Promise<void> {
    const ready = document.fonts?.ready ?? Promise.resolve();
    const timeout = new Promise<void>((r) => setTimeout(r, 1500));
    return Promise.race([ready.then(() => undefined), timeout]);
  }

  // ===================================================================================
  // Featured creation carousel (GSAP-driven progress, pausable). Each pick re-dyes the bouquet.
  // ===================================================================================
  private startAutoplay(): void {
    this.autoplayEnabled = true;
    this.restartAutoplay();
  }

  private restartAutoplay(): void {
    this.autoplay?.kill();
    if (!this.autoplayEnabled || this.destroyed) return;
    const pick = this.pickEl().nativeElement;
    this.progress.value = 0;
    pick.style.setProperty('--progress', '0');
    this.autoplay = gsap.to(this.progress, {
      value: 1,
      duration: AUTOPLAY_SECONDS,
      ease: 'none',
      onUpdate: () => pick.style.setProperty('--progress', this.progress.value.toFixed(4)),
      onComplete: () => this.select((this.activeIndex() + 1) % this.products.length),
    });
    this.syncAutoplay();
  }

  private syncAutoplay(): void {
    if (this.hoverPaused || this.scrollPaused) this.autoplay?.pause();
    else this.autoplay?.resume();
  }

  protected select(index: number): void {
    if (index !== this.activeIndex()) {
      this.activeIndex.set(index);
      this.scene?.setPalette(index);
    }
    this.restartAutoplay();
  }

  protected pauseAutoplay(): void {
    this.hoverPaused = true;
    this.syncAutoplay();
  }

  protected resumeAutoplay(): void {
    this.hoverPaused = false;
    this.syncAutoplay();
  }

  // ===================================================================================
  // Template handlers
  // ===================================================================================
  protected addToBag(product: FlowerProduct): void {
    this.store.add(product);
    gsap.fromTo(
      '[data-bag]',
      { scale: 1 },
      { scale: 1.18, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1, overwrite: 'auto' },
    );
  }

  protected scrollTo(event: Event, selector: string): void {
    event.preventDefault();
    this.motion.scrollTo(selector);
  }

  protected openBag(): void {
    this.store.cartOpen.set(true);
  }
}
