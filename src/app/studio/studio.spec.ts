import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import {
  BouquetBuilderService,
  INITIAL_BOUQUET_STATE,
  composeStems,
  computeQuote,
  orderMessage,
  stemOnSlot,
  isStepValid,
} from '../core/bouquet-builder.service';
import { MotionService } from '../core/motion.service';
import { StoreService } from '../core/store.service';
import { currentLang } from '../core/lang';
import { CROWDED_DISTANCE, insideArea, slotPosition } from '../data/bouquet-geometry';
import { HAND_TIE_FEE, MAX_STEMS, MIN_STEMS, SIZE_OPTIONS } from '../data/studio-data';
import { BuildYourOwnComponent } from './build-your-own.component';

// Arabic is the site default; these specs assert the English copy.
beforeEach(() => currentLang.set('en'));

function stubMatchMedia(): void {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('reduce'), // reduced motion: GSAP directives stay inert
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

describe('computeQuote', () => {
  it('is zero for an empty bouquet (no fee for nothing)', () => {
    const q = computeQuote(INITIAL_BOUQUET_STATE);
    expect(q.total).toBe(0);
    expect(q.breakdown).toEqual([]);
    expect(q.stemsMissing).toBe(MIN_STEMS);
  });

  it('adds stems, paper, ribbon, add-ons and the hand-tie fee', () => {
    const stems = Array.from({ length: 10 }, (_, i) => stemOnSlot(i + 1, 'rose-red', i)); // 10 x 30
    const q = computeQuote({
      ...INITIAL_BOUQUET_STATE,
      stems,
      paperId: 'black', // 40
      ribbonId: 'gold', //     15
      addonIds: ['chocolates'], // 150
    });
    expect(q.flowersSubtotal).toBe(300);
    expect(q.total).toBe(300 + 40 + 15 + 150 + HAND_TIE_FEE);
    expect(q.volumeDiscount).toBe(0);
    expect(q.stemsToSaving).toBe(14);
  });

  it('waives 8% of the flowers from 24 stems', () => {
    const stems = Array.from({ length: 24 }, (_, i) => stemOnSlot(i + 1, 'rose-red', i)); // 720
    const q = computeQuote({ ...INITIAL_BOUQUET_STATE, stems });
    expect(q.volumeDiscount).toBe(58);
    expect(q.total).toBe(720 - 58 + HAND_TIE_FEE);
    expect(q.stemsToSaving).toBe(0);
  });

  it('does not charge for paper/ribbon until a paper is chosen', () => {
    const stems = [stemOnSlot(1, 'rose-yellow', 0)];
    const q = computeQuote({ ...INITIAL_BOUQUET_STATE, stems });
    expect(q.total).toBe(28 + HAND_TIE_FEE);
  });
});

describe('BouquetBuilderService', () => {
  let builder: BouquetBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    builder = TestBed.inject(BouquetBuilderService);
    builder.reset();
  });

  const addMany = (id: string, n: number): void => {
    for (let i = 0; i < n; i++) builder.addStem(id);
  };

  it('blocks the step change until the current step is valid', () => {
    builder.next();
    expect(builder.snapshot.step).toBe('flowers');

    addMany('rose-red', MIN_STEMS);
    builder.next();
    expect(builder.snapshot.step).toBe('wrapping');

    builder.next(); // no paper yet
    expect(builder.snapshot.step).toBe('wrapping');

    builder.setPaper('white');
    builder.next();
    expect(builder.snapshot.step).toBe('addons');
  });

  it('refuses to jump ahead past an invalid step', () => {
    builder.goTo('addons');
    expect(builder.snapshot.step).toBe('flowers');
    addMany('rose-pink', MIN_STEMS);
    builder.goTo('addons'); // wrapping still invalid
    expect(builder.snapshot.step).toBe('flowers');
    builder.setPaper('pink');
    builder.goTo('addons');
    expect(builder.snapshot.step).toBe('addons');
  });

  it('keeps slots stable: removal frees the outermost stem and the slot is reused', () => {
    addMany('rose-red', 3);
    builder.addStem('rose-yellow'); // slot 3
    const before = builder.snapshot.stems.map((s) => s.slot);
    expect(before).toEqual([0, 1, 2, 3]);

    builder.removeStem('rose-red'); // outermost rose = slot 2
    expect(builder.snapshot.stems.map((s) => s.slot)).toEqual([0, 1, 3]);

    builder.addStem('rose-white');
    expect(builder.snapshot.stems.find((s) => s.flowerId === 'rose-white')?.slot).toBe(2);
  });

  it('places a stem exactly where the customer pointed', () => {
    builder.placeStem('rose-red', 150, 180);
    const [stem] = builder.snapshot.stems;
    expect(stem.flowerId).toBe('rose-red');
    expect(stem.x).toBe(150);
    expect(stem.y).toBe(180);
  });

  it('pulls a stem placed outside the paper back onto its edge', () => {
    builder.placeStem('rose-red', 5, 5);
    const [stem] = builder.snapshot.stems;
    expect(insideArea(stem.x, stem.y, 1.001)).toBe(true);
    expect(stem.x).toBeGreaterThan(5);
  });

  it('moves one stem without touching the others', () => {
    builder.placeStem('rose-red', 180, 190);
    builder.placeStem('rose-pink', 230, 200);
    const [a, b] = builder.snapshot.stems;
    builder.moveStem(a.uid, 120, 210);
    const [a2, b2] = builder.snapshot.stems;
    expect(a2.x).toBe(120);
    expect(a2.y).toBe(210);
    expect(b2).toBe(b);
  });

  it('removes a single stem by id and ignores unknown ones', () => {
    builder.placeStem('rose-red', 180, 190);
    builder.placeStem('rose-red', 220, 190);
    const [a, b] = builder.snapshot.stems;
    builder.removeStemByUid(a.uid);
    expect(builder.snapshot.stems.map((s) => s.uid)).toEqual([b.uid]);
    const before = builder.snapshot;
    builder.removeStemByUid(9999);
    expect(builder.snapshot).toBe(before);
  });

  it('does not stack an automatic stem on top of one the customer moved there', () => {
    const { x, y } = slotPosition(2);
    builder.addStem('rose-red'); // slot 0
    builder.addStem('rose-pink'); // slot 1
    builder.moveStem(builder.snapshot.stems[1].uid, x, y); // now sits on the spot slot 2 would take
    builder.addStem('rose-yellow');
    const auto = builder.snapshot.stems.find((s) => s.flowerId === 'rose-yellow')!;
    expect(auto.slot).not.toBe(2);
    for (const other of builder.snapshot.stems.filter((s) => s !== auto)) {
      expect(Math.hypot(auto.x - other.x, auto.y - other.y)).toBeGreaterThanOrEqual(CROWDED_DISTANCE);
    }
  });

  it('arranges every stem back onto its tidy slot', () => {
    addMany('rose-red', 4);
    const first = builder.snapshot.stems[0];
    builder.moveStem(first.uid, 100, 250);
    builder.arrange();
    const again = builder.snapshot.stems[0];
    expect(again.x).toBeCloseTo(slotPosition(first.slot).x, 5);
    expect(again.y).toBeCloseTo(slotPosition(first.slot).y, 5);
  });

  it('caps the bouquet and ignores unknown ids', () => {
    addMany('gypsophila', MAX_STEMS + 5);
    expect(builder.snapshot.stems.length).toBe(MAX_STEMS);
    builder.addStem('does-not-exist');
    expect(builder.snapshot.stems.length).toBe(MAX_STEMS);
  });

  it('requires a message when the handwritten card is chosen', () => {
    addMany('rose-red', MIN_STEMS);
    builder.setPaper('black');
    builder.toggleAddon('card');
    expect(isStepValid('addons', builder.snapshot)).toBe(false);
    expect(builder.toBouquet()).toBeNull();

    builder.setMessage('  Happy birthday  ');
    expect(builder.toBouquet()?.message).toBe('Happy birthday');
  });

  it('freezes a complete bouquet into a bag line with the quoted price', async () => {
    addMany('rose-red', 7);
    addMany('gypsophila', 2);
    builder.setPaper('gold');
    builder.setRibbon('rose');
    builder.toggleAddon('balloon');

    const quote = await firstValueFrom(builder.quote$);
    const bouquet = builder.toBouquet();
    expect(bouquet).not.toBeNull();
    expect(bouquet?.unitPrice).toBe(quote.total);
    expect(bouquet?.details).toContain('7 × Red Rose');
    expect(bouquet?.details).toContain('Helium balloon');
    expect(bouquet?.message).toBeNull();
  });

  it('exposes step statuses for the stepper', async () => {
    addMany('rose-red', MIN_STEMS);
    const steps = await firstValueFrom(builder.steps$);
    expect(steps.map((s) => s.valid)).toEqual([true, false, true]);
    expect(steps.map((s) => s.reachable)).toEqual([true, true, false]);
    expect(steps[0].active).toBe(true);
  });
});

describe('Recipe composition', () => {
  const recipe = { size: 25, mainId: 'rose-red', secondId: null, filler: true } as const;

  it('works out roses plus a ring of baby\'s breath from the size', () => {
    const stems = composeStems(recipe);
    expect(stems.filter((s) => s.flowerId === 'rose-red')).toHaveLength(25);
    expect(stems.filter((s) => s.flowerId === 'gypsophila')).toHaveLength(3);
    expect(composeStems({ ...recipe, filler: false })).toHaveLength(25);
  });

  it('spreads the second colour evenly (about a third of the roses)', () => {
    const stems = composeStems({ ...recipe, size: 40, secondId: 'rose-pink' });
    const second = stems.filter((s) => s.flowerId === 'rose-pink').length;
    expect(second).toBeGreaterThanOrEqual(11);
    expect(second).toBeLessThanOrEqual(17);
    // never the whole first ring: the centre stays the main colour
    expect(stems[0].flowerId).toBe('rose-red');
  });

  it('keeps every size inside the paper and under the stem cap', () => {
    for (const { count } of SIZE_OPTIONS) {
      const stems = composeStems({ ...recipe, size: count });
      expect(stems.length).toBeLessThanOrEqual(MAX_STEMS);
      for (const s of stems) expect(insideArea(s.x, s.y, 1.001)).toBe(true);
    }
  });
});

describe('BouquetBuilderService recipe', () => {
  let builder: BouquetBuilderService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    builder = TestBed.inject(BouquetBuilderService);
    builder.reset();
  });

  it('starts from a sensible bouquet with a paper already chosen', () => {
    builder.start();
    expect(builder.snapshot.recipe?.size).toBe(25);
    expect(builder.snapshot.paperId).toBe('black');
    expect(isStepValid('flowers', builder.snapshot)).toBe(true);
    expect(isStepValid('wrapping', builder.snapshot)).toBe(true);
    builder.start(); // no-op once there are flowers
    expect(builder.snapshot.recipe?.size).toBe(25);
  });

  it('re-prices when the size or colours change and keeps untouched blooms in place', async () => {
    builder.start();
    const small = await firstValueFrom(builder.quote$);
    const firstBefore = builder.snapshot.stems[0];

    builder.setSize(60);
    const big = await firstValueFrom(builder.quote$);
    expect(big.total).toBeGreaterThan(small.total);
    expect(builder.snapshot.stems.filter((s) => s.flowerId === 'rose-red')).toHaveLength(60);

    builder.setSecondColor('rose-white');
    expect(builder.snapshot.stems.some((s) => s.flowerId === 'rose-white')).toBe(true);
    // same uid, still the main colour in the centre
    expect(builder.snapshot.stems[0].uid).toBe(firstBefore.uid);
    expect(builder.snapshot.stems[0].flowerId).toBe('rose-red');
  });

  it('drops the second colour when it becomes the main one, and ignores non-roses', () => {
    builder.start();
    builder.setSecondColor('rose-pink');
    builder.setMainColor('rose-pink');
    expect(builder.snapshot.recipe?.mainId).toBe('rose-pink');
    expect(builder.snapshot.recipe?.secondId).toBeNull();
    builder.setMainColor('gypsophila');
    expect(builder.snapshot.recipe?.mainId).toBe('rose-pink');
  });

  it('turns baby\'s breath on and off', () => {
    builder.start();
    builder.setFiller(false);
    expect(builder.snapshot.stems.some((s) => s.flowerId === 'gypsophila')).toBe(false);
    builder.setFiller(true);
    expect(builder.snapshot.stems.some((s) => s.flowerId === 'gypsophila')).toBe(true);
  });

  it('writes the order for the shop in Arabic, with the same price as the quote', async () => {
    builder.start();
    builder.setSecondColor('rose-pink');
    builder.toggleAddon('chocolates');
    const quote = await firstValueFrom(builder.quote$);
    const text = orderMessage(builder.snapshot, quote);
    expect(text).toContain('*الباقة (');
    expect(text).toContain('جوري أحمر');
    expect(text).toContain('فيريرو روشيه');
    expect(text).toContain('جيبسوفيلا');
    expect(text).toContain(String(quote.total));
  });
});

describe('BuildYourOwnComponent', () => {
  beforeEach(async () => {
    localStorage.clear();
    stubMatchMedia();
    await TestBed.configureTestingModule({
      imports: [BuildYourOwnComponent],
      providers: [
        {
          provide: MotionService,
          useValue: { start: () => {}, watchVisibility: () => {}, scrollTo: () => {}, lock: () => {}, unlock: () => {}, prefersReducedMotion: true },
        },
      ],
    }).compileComponents();
    TestBed.inject(BouquetBuilderService).reset();
  });

  it('orders a bouquet in a few taps: size, colour, extras, bag', async () => {
    const fixture = TestBed.createComponent(BuildYourOwnComponent);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const click = async (node: Element | null | undefined): Promise<void> => {
      (node as HTMLElement | null)?.click();
      await fixture.whenStable();
    };
    const primary = (): HTMLButtonElement => el.querySelector('.pc__primary') as HTMLButtonElement;

    // Step 1: a bouquet is already there, five sizes, seven colour chips; nothing to fill in first
    expect(el.querySelector('.byo__meta b')?.textContent).toBe('25');
    expect(el.querySelectorAll('.sz').length).toBe(5);
    expect(primary().disabled).toBe(false);

    const total = (): string => el.querySelector('.pc__total')?.textContent ?? '';
    const before = total();
    await click(el.querySelectorAll('.sz')[2]); // 40 roses
    expect(el.querySelector('.byo__meta b')?.textContent).toBe('40');
    expect(total()).not.toBe(before);
    await click(el.querySelectorAll('.swatches')[0].querySelectorAll('.sw')[2]); // another main colour
    expect(el.querySelectorAll('.swatches')[0].querySelector('.sw.is-selected')).toBeTruthy();

    // Step 2: black wrapping is already chosen
    await click(primary());
    expect(el.querySelectorAll('.pp').length).toBe(6);
    expect(primary().disabled).toBe(false);

    // Step 3: add one extra, the WhatsApp order link carries the order, then add to the bag
    await click(primary());
    await click(el.querySelector('.ad'));
    const wa = el.querySelector<HTMLAnchorElement>('.order__wa');
    expect(wa?.href).toContain('https://wa.me/');
    expect(decodeURIComponent(wa?.href ?? '')).toContain('40');
    expect(primary().textContent).toContain('Add to bag');
    await click(primary());

    const store = TestBed.inject(StoreService);
    expect(store.cartCount()).toBe(1);
    const line = store.cartLines()[0];
    expect(line.custom).toBeTruthy();
    expect(line.unitPrice).toBeGreaterThan(0);
    // the studio starts again from the default bouquet
    expect(el.querySelector('.byo__meta b')?.textContent).toBe('25');
  });
});
