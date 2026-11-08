import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { MotionService } from './core/motion.service';
import { StoreService } from './core/store.service';
import { currentLang } from './core/lang';
import { FLOWER_PRODUCTS, formatEgp, unsplashUrl } from './data/flower-data';
import { App } from './app';

// Arabic is the site default; these specs assert the English copy.
beforeEach(() => currentLang.set('en'));

/** jsdom has neither matchMedia (GSAP, directives) nor WebGL: stub the global motion layer. */
function stubBrowserApis(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
      onchange: null,
    }),
  });
}

describe('Catalogue data', () => {
  it('has the six signature products with the specified EGP prices', () => {
    const prices = Object.fromEntries(FLOWER_PRODUCTS.map((p) => [p.nameEn, p.price]));
    expect(prices).toEqual({
      'Ferrero Crown': 1450,
      'Heart of Roses': 1850,
      'Pink Cloud': 1250,
      'Chocolate Rose Bouquet': 650,
      'Surprise Gift Box': 550,
      'Roses & Lilies': 1350,
    });
  });

  it('gives every product bilingual copy, tags and real brand imagery', () => {
    for (const p of FLOWER_PRODUCTS) {
      expect(p.nameAr).toMatch(/[\u0600-\u06FF]/);
      expect(p.tags.length).toBeGreaterThan(0);
      expect(unsplashUrl(p.imageId, 400)).toMatch(/^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/oar[123]\.jpg$/);
      expect(unsplashUrl(p.imageAltId, 400)).toMatch(/^https:\/\/i\.ytimg\.com\/vi\/[\w-]{11}\/oar[123]\.jpg$/);
    }
  });

  it('formats prices as EGP with thousands separators', () => {
    expect(formatEgp(2450)).toBe('EGP 2,450');
  });
});

describe('StoreService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('adds, increments and removes bag lines and totals them', () => {
    const store = TestBed.inject(StoreService);
    const [a, b] = FLOWER_PRODUCTS;
    store.add(a);
    store.add(a);
    store.add(b);
    expect(store.cartCount()).toBe(3);
    expect(store.cartTotal()).toBe(a.price * 2 + b.price);
    store.changeQty(a.id, -1);
    expect(store.cartCount()).toBe(2);
    store.remove(b.id);
    expect(store.cartLines().length).toBe(1);
  });

  it('toggles the wishlist', () => {
    const store = TestBed.inject(StoreService);
    store.toggleWish('sf-001');
    expect(store.isWished('sf-001')).toBe(true);
    store.toggleWish('sf-001');
    expect(store.isWished('sf-001')).toBe(false);
  });
});

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    // Arabic is the site default; these assertions read the English copy.
    currentLang.set('en');
    stubBrowserApis();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        {
          provide: MotionService,
          useValue: { start: () => {}, watchVisibility: () => {}, scrollTo: () => {}, lock: () => {}, unlock: () => {}, prefersReducedMotion: true },
        },
      ],
    }).compileComponents();
  });

  it('renders the hero headline and the featured product with its EGP price', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('petal');
    expect(el.querySelector('.hero__card-title')?.textContent).toContain('Ferrero Crown');
    expect(el.querySelector('.hero__add b')?.textContent).toContain('EGP 1,450');
  });

  it('renders one showcase card per product and filters by occasion', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.sc-card').length).toBe(6);

    const chip = [...el.querySelectorAll<HTMLButtonElement>('.sc__chip')].find((b) => b.textContent?.includes('Weddings'));
    chip?.click();
    await fixture.whenStable();
    expect(el.querySelectorAll('.sc-card').length).toBe(2);
  });

  it('adds a product to the bag from the hero', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.hero__add')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(StoreService).cartCount()).toBe(1);
    expect(el.querySelector('.nav__bag b')?.textContent).toContain('1');
  });

  it('has a dedicated /order page with the order form, the nav and the footer, but not the storefront', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/order');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.op__title')?.textContent).toContain('order');
    expect(el.querySelector('app-gift-order .go__step')).toBeTruthy();
    expect(el.querySelector('.nav__bag')).toBeTruthy();
    expect(el.querySelector('.foot')).toBeTruthy();
    expect(el.querySelector('app-hero')).toBeNull();
    expect(el.querySelector('app-showcase')).toBeNull();
  });

  it('"Order your gift" stays on the storefront and goes to the collection, never straight to checkout', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    TestBed.inject(StoreService).add(FLOWER_PRODUCTS[0]); // even with something in the bag
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('.gift__cta')?.click();
    await fixture.whenStable();
    expect(router.url).toBe('/');
  });

  it('sends the bag drawer button to the order page', async () => {
    const fixture = TestBed.createComponent(App);
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/');
    TestBed.inject(StoreService).add(FLOWER_PRODUCTS[0]);
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.cp-checkout')?.click();
    await new Promise((resolve) => setTimeout(resolve, 500)); // the drawer slides out first
    await fixture.whenStable();
    expect(router.url).toBe('/order');
  });
});