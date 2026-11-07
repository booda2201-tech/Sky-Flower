import { FLOWER_PRODUCTS, FlowerProduct, Occasion, formatEgp } from '../data/flower-data';
import {
  Answers,
  BudgetAnswer,
  OccasionAnswer,
  Question,
  QuestionId,
  Recommendation,
  VibeAnswer,
} from './skybot.model';

// -------------------------------------------------------------------------------------
// Script: the three questions
// -------------------------------------------------------------------------------------
export const QUESTIONS: Readonly<Record<QuestionId, Question>> = {
  occasion: {
    id: 'occasion',
    prompt: "First - what's the occasion?",
    promptAr: 'أولاً، ما هي المناسبة؟',
    replies: [
      { id: 'birthday', label: 'Birthday', labelAr: 'عيد ميلاد' },
      { id: 'anniversary', label: 'Anniversary', labelAr: 'ذكرى سنوية' },
      { id: 'wedding', label: 'Wedding or engagement', labelAr: 'زفاف أو خطوبة' },
      { id: 'romantic', label: 'A romantic surprise', labelAr: 'مفاجأة رومانسية' },
      { id: 'luxury', label: 'A luxury gift', labelAr: 'هدية فاخرة' },
    ],
  },
  budget: {
    id: 'budget',
    prompt: 'And what feels comfortable for your budget?',
    promptAr: 'وما هي ميزانيتك المناسبة؟',
    replies: [
      { id: 'low', label: 'Up to EGP 700', labelAr: 'حتى 700 جنيه' },
      { id: 'mid', label: 'EGP 700 – 1,400', labelAr: '700 – 1,400 جنيه' },
      { id: 'high', label: 'EGP 1,400 and above', labelAr: '1,400 جنيه فأكثر' },
    ],
  },
  vibe: {
    id: 'vibe',
    prompt: "Last one - what's the recipient's vibe?",
    promptAr: 'آخر سؤال: ما هو ذوق الشخص المهدى إليه؟',
    replies: [
      { id: 'bold', label: 'Bold & dramatic', labelAr: 'جريء ودرامي' },
      { id: 'soft', label: 'Soft & dreamy', labelAr: 'ناعم وحالم' },
      { id: 'fresh', label: 'Fresh & cheerful', labelAr: 'منعش ومبهج' },
      { id: 'classic', label: 'Classic & elegant', labelAr: 'كلاسيكي وأنيق' },
    ],
  },
};

export const OCCASION_ACKS: Readonly<Record<OccasionAnswer, string>> = {
  birthday: "A birthday - lovely. Let's make them feel celebrated.",
  anniversary: 'An anniversary - beautiful. Time to say it without words.',
  wedding: 'A wedding or engagement - congratulations! Something unforgettable, then.',
  romantic: 'A romantic surprise - I like your style.',
  luxury: 'A luxury gift - then it deserves a grand entrance.',
};

export const OCCASION_ACKS_AR: Readonly<Record<OccasionAnswer, string>> = {
  birthday: 'عيد ميلاد، جميل! لنجعله يشعر بالاحتفاء.',
  anniversary: 'ذكرى سنوية، رائع. حان وقت التعبير دون كلمات.',
  wedding: 'زفاف أو خطوبة، مبروك! إذن نحتاج شيئًا لا يُنسى.',
  romantic: 'مفاجأة رومانسية، أعجبني ذوقك.',
  luxury: 'هدية فاخرة، تستحق دخولًا مهيبًا.',
};

// -------------------------------------------------------------------------------------
// Matching data
// -------------------------------------------------------------------------------------
const OCCASION_TO_CATALOGUE: Readonly<Record<OccasionAnswer, Occasion>> = {
  birthday: 'Birthdays',
  anniversary: 'Anniversaries',
  wedding: 'Weddings',
  romantic: 'Romantic',
  luxury: 'Luxury Boxes',
};

const OCCASION_PHRASE: Readonly<Record<OccasionAnswer, string>> = {
  birthday: 'birthdays',
  anniversary: 'anniversaries',
  wedding: 'weddings & engagements',
  romantic: 'romantic surprises',
  luxury: 'luxury gifting',
};

const OCCASION_PHRASE_AR: Readonly<Record<OccasionAnswer, string>> = {
  birthday: 'أعياد الميلاد',
  anniversary: 'الذكرى السنوية',
  wedding: 'الأفراح والخطوبة',
  romantic: 'المفاجآت الرومانسية',
  luxury: 'الهدايا الفاخرة',
};

export const VIBE_LABEL: Readonly<Record<VibeAnswer, string>> = {
  bold: 'Bold & dramatic',
  soft: 'Soft & dreamy',
  fresh: 'Fresh & cheerful',
  classic: 'Classic & elegant',
};

export const VIBE_LABEL_AR: Readonly<Record<VibeAnswer, string>> = {
  bold: 'جريء ودرامي',
  soft: 'ناعم وحالم',
  fresh: 'منعش ومبهج',
  classic: 'كلاسيكي وأنيق',
};

/** Which vibes each product expresses, strongest first. Unknown products simply score no vibe points. */
const PRODUCT_VIBES: Readonly<Record<string, readonly VibeAnswer[]>> = {
  'sf-001': ['bold', 'classic'], //  Ferrero Crown - full round of red roses with Ferrero
  'sf-002': ['bold', 'soft'], //     Heart of Roses - red roses shaped into a heart
  'sf-003': ['soft', 'fresh'], //    Pink Cloud - a soft mass of pink roses
  'sf-004': ['fresh', 'classic'], // Chocolate Rose Bouquet - red roses with chocolate bars
  'sf-005': ['fresh', 'soft'], //    Surprise Gift Box - flowers, chocolates and a collectible
  'sf-006': ['classic', 'soft'], //  Roses & Lilies - red roses and pink lilies in white
};

interface BudgetRange {
  readonly min: number;
  readonly max: number;
  readonly label: string;
  readonly labelAr: string;
}

export const BUDGETS: Readonly<Record<BudgetAnswer, BudgetRange>> = {
  low: { min: 0, max: 700, label: 'up to EGP 700', labelAr: 'حتى 700 جنيه' },
  mid: { min: 700, max: 1400, label: 'EGP 700 – 1,400', labelAr: '700 – 1,400 جنيه' },
  high: { min: 1400, max: Number.POSITIVE_INFINITY, label: 'EGP 1,400 and above', labelAr: '1,400 جنيه فأكثر' },
};

const POINTS = { occasion: 45, vibePrimary: 30, vibeSecondary: 18, budget: 25 } as const;
const MAX_SCORE = POINTS.occasion + POINTS.vibePrimary + POINTS.budget;

// -------------------------------------------------------------------------------------
// Engine
// -------------------------------------------------------------------------------------
/** Closeness of `price` to a budget: 1 inside the range, falling to 0 at +/-60% outside it. */
function budgetFit(price: number, range: BudgetRange): number {
  if (price >= range.min && price <= range.max) return 1;
  const edge = price < range.min ? range.min : range.max;
  const distance = Math.abs(price - edge) / edge;
  return Math.max(0, 1 - distance / 0.6);
}

/**
 * Scores every product against the three answers and returns the best `count`.
 * Deterministic: ties fall back to catalogue order.
 */
export function recommend(
  answers: Required<Answers>,
  products: readonly FlowerProduct[] = FLOWER_PRODUCTS,
  count = 2,
): readonly Recommendation[] {
  const range = BUDGETS[answers.budget];
  const wantedOccasion = OCCASION_TO_CATALOGUE[answers.occasion];

  const scored = products.map((product, index) => {
    const occasionMatch = product.occasions.includes(wantedOccasion);
    const vibes = PRODUCT_VIBES[product.id] ?? [];
    const vibeRank = vibes.indexOf(answers.vibe);
    const fit = budgetFit(product.price, range);

    const score =
      (occasionMatch ? POINTS.occasion : 0) +
      (vibeRank === 0 ? POINTS.vibePrimary : vibeRank > 0 ? POINTS.vibeSecondary : 0) +
      POINTS.budget * fit;

    const withinBudget = fit === 1;
    const reasons: string[] = [];
    const reasonsAr: string[] = [];
    if (occasionMatch) {
      reasons.push(`Made for ${OCCASION_PHRASE[answers.occasion]}`);
      reasonsAr.push(`مصممة لـ${OCCASION_PHRASE_AR[answers.occasion]}`);
    }
    if (vibeRank >= 0) {
      reasons.push(VIBE_LABEL[answers.vibe]);
      reasonsAr.push(VIBE_LABEL_AR[answers.vibe]);
    }
    if (withinBudget) {
      reasons.push('Within your budget');
      reasonsAr.push('ضمن ميزانيتك');
    } else if (product.price < range.min) {
      reasons.push(`A little under your budget · ${formatEgp(product.price, 'en')}`);
      reasonsAr.push(`أقل قليلًا من ميزانيتك · ${formatEgp(product.price, 'ar')}`);
    } else {
      reasons.push(`A stretch above your budget · ${formatEgp(product.price, 'en')}`);
      reasonsAr.push(`أعلى قليلًا من ميزانيتك · ${formatEgp(product.price, 'ar')}`);
    }

    return { product, score, index, withinBudget, reasons, reasonsAr };
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, count)
    .map(
      (s): Recommendation => ({
        product: s.product,
        matchPct: Math.min(99, Math.round((s.score / MAX_SCORE) * 100)),
        reasons: s.reasons,
        reasonsAr: s.reasonsAr,
        withinBudget: s.withinBudget,
      }),
    );
}

/** A readable recap such as "an anniversary, up to EGP 2,500, bold & dramatic". */
export function summarise(answers: Required<Answers>): string {
  return `${OCCASION_PHRASE[answers.occasion]}, ${BUDGETS[answers.budget].label}, ${VIBE_LABEL[answers.vibe].toLowerCase()}`;
}

/** Arabic counterpart of `summarise`. */
export function summariseAr(answers: Required<Answers>): string {
  return `${OCCASION_PHRASE_AR[answers.occasion]}، ${BUDGETS[answers.budget].labelAr}، ${VIBE_LABEL_AR[answers.vibe]}`;
}

/** How long SkyBot "types" a line for: long lines take a little longer. */
export function typingDelay(text: string): number {
  return Math.min(1500, 520 + text.length * 13);
}
