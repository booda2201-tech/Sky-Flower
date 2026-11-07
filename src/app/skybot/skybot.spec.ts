import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { MotionService } from '../core/motion.service';
import { StoreService } from '../core/store.service';
import { currentLang } from '../core/lang';
import { FLOWER_PRODUCTS } from '../data/flower-data';
import { SkyBotComponent } from './skybot.component';
import { recommend, summarise } from './skybot.engine';
import { ChatState, RecommendationMessage } from './skybot.model';
import { SkyBotService } from './skybot.service';

// Arabic is the site default; these specs assert the English copy.
beforeEach(() => currentLang.set('en'));

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

const motionStub = { start: () => {}, scrollTo: vi.fn(), lock: () => {}, unlock: () => {}, prefersReducedMotion: true };

describe('SkyBot recommendation engine', () => {
  it('always returns two distinct products', () => {
    const occasions = ['birthday', 'anniversary', 'wedding', 'romantic', 'luxury'] as const;
    const budgets = ['low', 'mid', 'high'] as const;
    const vibes = ['bold', 'soft', 'fresh', 'classic'] as const;
    for (const occasion of occasions)
      for (const budget of budgets)
        for (const vibe of vibes) {
          const recs = recommend({ occasion, budget, vibe });
          expect(recs).toHaveLength(2);
          expect(new Set(recs.map((r) => r.product.id)).size).toBe(2);
          for (const r of recs) {
            expect(r.matchPct).toBeGreaterThan(0);
            expect(r.matchPct).toBeLessThanOrEqual(99);
            expect(r.reasons.length).toBeGreaterThan(0);
          }
        }
  });

  it('puts the best fit first: bold anniversary above EGP 1,400 -> Ferrero Crown', () => {
    const [first] = recommend({ occasion: 'anniversary', budget: 'high', vibe: 'bold' });
    expect(first.product.nameEn).toBe('Ferrero Crown');
    expect(first.withinBudget).toBe(true);
    expect(first.reasons).toContain('Within your budget');
  });

  it('respects occasion and vibe: fresh wedding up to EGP 700 -> Pink Cloud', () => {
    const [first] = recommend({ occasion: 'wedding', budget: 'low', vibe: 'fresh' });
    expect(first.product.nameEn).toBe('Pink Cloud');
  });

  it('prefers in-budget products over a perfect-vibe product far above the budget', () => {
    const recs = recommend({ occasion: 'luxury', budget: 'high', vibe: 'bold' });
    expect(recs.every((r) => r.product.price >= 1400)).toBe(true);
    expect(recs[0].product.nameEn).toBe('Ferrero Crown');
  });

  it('is deterministic and only recommends catalogue products', () => {
    const answers = { occasion: 'birthday', budget: 'mid', vibe: 'soft' } as const;
    expect(recommend(answers).map((r) => r.product.id)).toEqual(recommend(answers).map((r) => r.product.id));
    for (const r of recommend(answers)) expect(FLOWER_PRODUCTS).toContain(r.product);
  });

  it('summarises answers for the closing line', () => {
    expect(summarise({ occasion: 'anniversary', budget: 'mid', vibe: 'bold' })).toBe(
      'anniversaries, EGP 700 – 1,400, bold & dramatic',
    );
  });
});

describe('SkyBotService conversation', () => {
  let bot: SkyBotService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [{ provide: MotionService, useValue: motionStub }] });
    bot = TestBed.inject(SkyBotService);
  });
  afterEach(() => vi.useRealTimers());

  /** Advance the fake clock far enough for the bot to finish typing. */
  const settle = (): void => {
    vi.advanceTimersByTime(8000);
  };

  it('greets, then asks the occasion question with quick replies', () => {
    bot.open();
    expect(bot.snapshot.open).toBe(true);
    expect(bot.snapshot.typing).toBe(true);
    settle();
    const s = bot.snapshot;
    expect(s.typing).toBe(false);
    expect(s.step).toBe('occasion');
    expect(s.messages.length).toBe(3);
    expect(s.replies.map((r) => r.id)).toEqual(['birthday', 'anniversary', 'wedding', 'romantic', 'luxury']);
  });

  it('runs occasion -> budget -> vibe and ends with two recommendations', () => {
    bot.open();
    settle();
    bot.choose(bot.snapshot.replies.find((r) => r.id === 'anniversary')!);
    settle();
    expect(bot.snapshot.step).toBe('budget');
    expect(bot.snapshot.answers.occasion).toBe('anniversary');

    bot.choose(bot.snapshot.replies.find((r) => r.id === 'low')!);
    settle();
    expect(bot.snapshot.step).toBe('vibe');

    bot.choose(bot.snapshot.replies.find((r) => r.id === 'bold')!);
    settle();

    const s: ChatState = bot.snapshot;
    expect(s.step).toBe('done');
    expect(s.answers).toEqual({ occasion: 'anniversary', budget: 'low', vibe: 'bold' });
    const recs = s.messages.find((m): m is RecommendationMessage => m.kind === 'recommendations');
    expect(recs?.items).toHaveLength(2);
    expect(recs?.items[0].product.nameEn).toBe('Ferrero Crown');
    expect(s.replies.map((r) => r.id)).toEqual(['restart', 'studio']);
    // user bubbles echo the answers
    expect(s.messages.filter((m) => m.from === 'user').length).toBe(3);
  });

  it('ignores taps while typing and replies that do not belong to the question', () => {
    bot.open();
    settle();
    bot.choose({ id: 'bold', label: 'Bold & dramatic' }); // wrong question
    settle();
    expect(bot.snapshot.step).toBe('occasion');
    expect(bot.snapshot.answers).toEqual({});

    const before = bot.snapshot.messages.length;
    const first = bot.snapshot.replies[0];
    bot.choose(first); // echoes the user bubble, then starts typing the acknowledgement
    bot.choose(bot.snapshot.replies[0] ?? first); // typing: the tap is ignored
    expect(bot.snapshot.typing).toBe(true);
    expect(bot.snapshot.messages.length).toBe(before + 1); // just the first user bubble
  });

  it('restarts from scratch, cancelling anything in flight', () => {
    bot.open();
    settle();
    bot.choose(bot.snapshot.replies[0]);
    vi.advanceTimersByTime(300); // mid-typing
    bot.restart();
    settle();
    expect(bot.snapshot.step).toBe('occasion');
    expect(bot.snapshot.answers).toEqual({});
    expect(bot.snapshot.messages.length).toBe(3);
  });

  it('closes and scrolls to the studio from the final choices', () => {
    bot.open();
    settle();
    bot.choose(bot.snapshot.replies[0]);
    settle();
    bot.choose(bot.snapshot.replies[0]);
    settle();
    bot.choose(bot.snapshot.replies[0]);
    settle();
    expect(bot.snapshot.step).toBe('done');

    bot.choose({ id: 'studio', label: 'Design my own instead' });
    expect(bot.snapshot.open).toBe(false);
    vi.advanceTimersByTime(400);
    expect(motionStub.scrollTo).toHaveBeenCalledWith('#studio');
  });

  it('exposes open$ as a distinct stream', async () => {
    expect(await firstValueFrom(bot.open$)).toBe(false);
    bot.open();
    expect(await firstValueFrom(bot.open$)).toBe(true);
  });
});

describe('SkyBotComponent', () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    localStorage.clear();
    sessionStorage.clear();
    stubMatchMedia();
    await TestBed.configureTestingModule({
      imports: [SkyBotComponent],
      providers: [{ provide: MotionService, useValue: motionStub }],
    }).compileComponents();
  });
  afterEach(() => vi.useRealTimers());

  it('opens, answers three questions and adds a recommendation to the cart in one click', () => {
    const fixture = TestBed.createComponent(SkyBotComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const tick = (): void => {
      vi.advanceTimersByTime(8000);
      fixture.detectChanges();
    };

    el.querySelector<HTMLButtonElement>('.sb-launch')?.click();
    fixture.detectChanges();
    expect(el.querySelector('.sb')?.classList.contains('is-open')).toBe(true);
    tick();

    const answer = (label: string): void => {
      const chip = [...el.querySelectorAll<HTMLButtonElement>('.sb-chip')].find((b) => b.textContent?.includes(label));
      expect(chip, `chip "${label}"`).toBeTruthy();
      chip?.click();
      tick();
    };
    answer('Anniversary');
    answer('Up to EGP 700');
    answer('Bold');

    const cards = el.querySelectorAll('.rec');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('h3')?.textContent).toContain('Ferrero Crown');
    expect(cards[0].querySelector('.rec__row b')?.textContent).toContain('EGP 1,450');

    cards[0].querySelector<HTMLButtonElement>('.rec__add')?.click();
    fixture.detectChanges();
    expect(TestBed.inject(StoreService).cartCount()).toBe(1);
    expect(cards[0].querySelector('.rec__add')?.classList.contains('is-added')).toBe(true);
  });
});
