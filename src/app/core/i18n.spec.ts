import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from '../app.routes';
import { MotionService } from './motion.service';
import { StoreService } from './store.service';
import { App } from '../app';
import { FLOWER_PRODUCTS, formatEgp } from '../data/flower-data';
import { MESSAGE_SUGGESTIONS, STEM_OPTIONS, ADDON_OPTIONS } from '../data/studio-data';
import { BouquetBuilderService, computeQuote, INITIAL_BOUQUET_STATE, stemOnSlot } from './bouquet-builder.service';
import { I18nService } from './i18n.service';
import { LANG_KEY, stemsLabel, stemsMoreLabel } from './lang';
import { AR, EN } from './messages';

const ARABIC = /[\u0600-\u06FF]/;

function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduce'),
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

describe('Arabic content coverage', () => {
  it('has an Arabic string for every interface key, and none is just a copy of the English', () => {
    expect(Object.keys(AR).sort()).toEqual(Object.keys(EN).sort());
    for (const key of Object.keys(EN) as (keyof typeof EN)[]) {
      expect(AR[key].trim().length, key).toBeGreaterThan(0);
      // Arabic copy contains Arabic letters, except the switch label (it names the *other* language).
      if (!['lang.switch'].includes(key)) expect(AR[key], key).toMatch(ARABIC);
    }
  });

  it('uses the same {placeholders} in both languages', () => {
    const slots = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(EN) as (keyof typeof EN)[]) {
      expect(slots(AR[key]), key).toEqual(slots(EN[key]));
    }
  });

  it('translates every product, tag and inclusion', () => {
    for (const p of FLOWER_PRODUCTS) {
      expect(p.tagsAr.length, p.id).toBe(p.tags.length);
      expect(p.includesAr.length, p.id).toBe(p.includes.length);
      for (const text of [p.nameAr, p.taglineAr, p.descriptionAr, ...p.tagsAr, ...p.includesAr]) {
        expect(text, p.id).toMatch(ARABIC);
      }
    }
  });

  it('translates the studio options and card suggestions', () => {
    for (const s of STEM_OPTIONS) expect(s.blurbAr, s.id).toMatch(ARABIC);
    for (const a of ADDON_OPTIONS) expect(a.blurbAr, a.id).toMatch(ARABIC);
    for (const m of MESSAGE_SUGGESTIONS) expect(m.ar).toMatch(ARABIC);
  });
});

describe('Arabic number words', () => {
  it('applies Arabic dual / plural rules to stems', () => {
    expect(stemsLabel(1, 'ar')).toBe('ساق واحدة');
    expect(stemsLabel(2, 'ar')).toBe('ساقان');
    expect(stemsLabel(5, 'ar')).toBe('5 سيقان');
    expect(stemsLabel(12, 'ar')).toBe('12 ساقًا');
    expect(stemsLabel(1, 'en')).toBe('1 stem');
    expect(stemsLabel(4, 'en')).toBe('4 stems');
    expect(stemsMoreLabel(3, 'ar')).toBe('3 سيقان أخرى');
    expect(stemsMoreLabel(1, 'en')).toBe('1 more stem');
  });

  it('formats the currency per language', () => {
    expect(formatEgp(2450, 'en')).toBe('EGP 2,450');
    expect(formatEgp(2450, 'ar')).toBe('2,450 ج.م');
  });

  it('labels the quote breakdown in both languages', () => {
    const stems = Array.from({ length: 6 }, (_, i) => stemOnSlot(i + 1, 'rose-red', i));
    const quote = computeQuote({ ...INITIAL_BOUQUET_STATE, stems, paperId: 'ivory', ribbonId: 'rose' });
    for (const line of quote.breakdown) {
      expect(line.label.length).toBeGreaterThan(0);
      expect(line.labelAr, line.key).toMatch(ARABIC);
    }
    expect(quote.breakdown[0].labelAr).toBe('الزهور · 6 سيقان');
  });
});

describe('I18nService', () => {
  let i18n: I18nService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    i18n = TestBed.inject(I18nService);
    i18n.set('en');
  });

  afterEach(() => i18n.set('en'));

  it('translates by key, with parameters', () => {
    expect(i18n.t('hero.cta.explore')).toBe('Explore the collection');
    expect(i18n.t('byo.qtyAria', { name: 'Rose' })).toBe('Quantity of Rose');
    expect(i18n.pick('English', 'عربي')).toBe('English');
    expect(i18n.pickAlt('English', 'عربي')).toBe('عربي');
  });

  it('switches every lookup to Arabic, falling back to English when there is no Arabic', () => {
    i18n.set('ar');
    expect(i18n.t('hero.cta.explore')).toBe('استكشف المجموعة');
    expect(i18n.alt('hero.cta.explore')).toBe('Explore the collection');
    expect(i18n.pick('English', 'عربي')).toBe('عربي');
    expect(i18n.pick('English', undefined)).toBe('English');
    expect(i18n.dir()).toBe('rtl');
    expect(i18n.stems(2)).toBe('ساقان');
  });

  it('toggles, remembers the choice and sets <html lang dir>', async () => {
    TestBed.tick();
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    i18n.toggle();
    TestBed.tick();
    expect(i18n.lang()).toBe('ar');
    expect(document.documentElement.lang).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(localStorage.getItem(LANG_KEY)).toBe('ar');
    expect(document.title).toBe(AR['meta.title']);

    i18n.toggle();
    TestBed.tick();
    expect(document.documentElement.dir).toBe('ltr');
    expect(localStorage.getItem(LANG_KEY)).toBe('en');
    expect(document.title).toBe(EN['meta.title']);
  });
});

describe('The page in Arabic', () => {
  beforeEach(async () => {
    localStorage.clear();
    stubMatchMedia();
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
    TestBed.inject(I18nService).set('en');
  });

  afterEach(() => TestBed.inject(I18nService).set('en'));

  it('re-renders the whole page when the switch is pressed, and back again', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('petal');
    expect(el.querySelector('.nav__lang span')?.textContent).toBe('العربية');

    el.querySelector<HTMLButtonElement>('[data-lang-toggle]')?.click();
    await fixture.whenStable();

    // headline, product card and prices are all Arabic now
    expect(el.querySelector('h1')?.textContent).toMatch(ARABIC);
    expect(el.querySelector('h1')?.textContent).not.toContain('petal');
    expect(el.querySelector('.hero__card-title')?.textContent).toContain('تاج فيريرو');
    expect(el.querySelector('.hero__add b')?.textContent).toContain('1,450 ج.م');
    expect(el.querySelector('.nav__lang span')?.textContent).toBe('English');
    // the accent line under the title now shows the English version
    expect(el.querySelector('.hero__ar')?.getAttribute('lang')).toBe('en');
    expect(el.querySelector('.hero__ar')?.textContent).toContain('Where every petal');
    // catalogue content
    expect(el.querySelector('.sc-card h3')?.textContent).toMatch(ARABIC);
    expect(el.querySelector('.sc__chip span')?.textContent).toBe('الكل');
    expect(el.querySelector('.gift__title')?.textContent).toContain('الهدية');
    expect(el.querySelector('.foot small')?.textContent).toContain('سكاي فلاور');

    el.querySelector<HTMLButtonElement>('[data-lang-toggle]')?.click();
    await fixture.whenStable();
    expect(el.querySelector('h1')?.textContent).toContain('petal');
    expect(el.querySelector('.hero__add b')?.textContent).toContain('EGP 1,450');
  });

  it('shows bag lines and the studio hints in Arabic', async () => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl('/');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const i18n = TestBed.inject(I18nService);
    const store = TestBed.inject(StoreService);
    const builder = TestBed.inject(BouquetBuilderService);
    builder.reset();
    store.cart.set([]);

    i18n.set('ar');
    store.add(FLOWER_PRODUCTS[0]);
    await fixture.whenStable();
    expect(el.querySelector('.cp-line h3')?.textContent).toBe('تاج فيريرو');
    expect(el.querySelector('.cp-total b')?.textContent).toContain('ج.م');

    builder.start();
    await fixture.whenStable();
    expect(el.querySelector('.pc__hint')?.textContent).toContain('25 وردة');
    i18n.set('en');
    await fixture.whenStable();
    expect(el.querySelector('.pc__hint')?.textContent).toContain('25 roses');
    builder.reset();
  });
});
