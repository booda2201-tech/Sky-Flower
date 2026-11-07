import { AfterViewInit, ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { I18nService } from './core/i18n.service';
import { MotionService } from './core/motion.service';
import { BRAND, BRAND_SOCIALS, whatsappLink } from './data/brand';
import { MobileTabsComponent } from './nav/mobile-tabs.component';
import { SiteNavComponent } from './nav/site-nav.component';
import { CartPanelComponent } from './shared/cart-panel.component';
import { SkyBotComponent } from './skybot/skybot.component';

/** The shell every storefront page shares: nav, the routed page, footer, bag drawer and SkyBot. The admin gets none of it. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SiteNavComponent, MobileTabsComponent, CartPanelComponent, SkyBotComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements AfterViewInit {
  private readonly motion = inject(MotionService);
  private readonly router = inject(Router);

  protected readonly i18n = inject(I18nService);

  protected readonly socials = BRAND_SOCIALS;
  protected readonly brand = BRAND;
  protected readonly whatsapp = (): string => whatsappLink(this.i18n.t('wa.hello'));

  protected readonly year = new Date().getFullYear();

  /** On `/admin...` the storefront chrome (nav, footer, bag, SkyBot) is hidden. */
  protected readonly isAdmin = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(globalThis.location?.pathname ?? '/'),
      map((url) => url.split(/[?#]/)[0].startsWith('/admin')),
    ),
    { initialValue: false },
  );

  /** The phone tab bar only makes sense on the home page (the order page has its own sticky bar). */
  protected readonly isHome = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects),
      startWith(globalThis.location?.pathname ?? '/'),
      map((url) => url.split(/[?#]/)[0] === '/'),
    ),
    { initialValue: true },
  );

  constructor() {
    // a new page brings new sections: let them pause their looping animations while off-screen too
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.motion.watchVisibility());
  }

  ngAfterViewInit(): void {
    // Lenis + AOS start once the DOM exists so AOS can measure the sections.
    this.motion.start();
  }
}
