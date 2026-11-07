/**
 * Sky Flower - "Build Your Own Bouquet" catalogue.
 * Every option is priced in whole EGP. Colours drive both the picker swatches and the live SVG preview.
 */

export type StudioStepId = 'flowers' | 'wrapping' | 'addons';
export type BloomKind = 'rose' | 'peony' | 'tulip' | 'hydrangea' | 'orchid' | 'filler';
export type AddonIcon = 'chocolate' | 'card' | 'candle' | 'balloon' | 'plush' | 'vase';

export interface StudioStep {
  readonly id: StudioStepId;
  readonly index: number;
  readonly titleEn: string;
  readonly titleAr: string;
  readonly hintEn: string;
}

export interface StemOption {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly blurbEn: string;
  readonly blurbAr: string;
  readonly kind: BloomKind;
  /** Price per stem. */
  readonly price: number;
  /** Bloom colours: face and shadow/centre. */
  readonly primary: string;
  readonly secondary: string;
}

export interface PaperOption {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly price: number;
  readonly from: string;
  readonly to: string;
}

export interface RibbonOption {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly price: number;
  readonly color: string;
}

export interface AddonOption {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly blurbEn: string;
  readonly blurbAr: string;
  readonly price: number;
  readonly icon: AddonIcon;
  /** The add-on needs the customer to write something (the gift card). */
  readonly needsMessage?: boolean;
}

// -------------------------------------------------------------------------------------
// Rules
// -------------------------------------------------------------------------------------
/** Fewest stems that still make a bouquet. */
export const MIN_STEMS = 9;
/** Most stems the preview (and the florists' hands) can hold. */
export const MAX_STEMS = 120;
/** Longest gift-card message. */
export const MESSAGE_MAX = 140;
/** Hand-tying and finishing fee, charged once per bouquet. */
export const HAND_TIE_FEE = 50;
/** Volume saving: this share of the flower subtotal is waived from `VOLUME_MIN_STEMS` stems. */
export const VOLUME_DISCOUNT_RATE = 0.08;
export const VOLUME_MIN_STEMS = 24;

export const STUDIO_STEPS: readonly StudioStep[] = [
  { id: 'flowers', index: 0, titleEn: 'Your bouquet', titleAr: 'باقتك', hintEn: 'Pick a size and colours' },
  { id: 'wrapping', index: 1, titleEn: 'Wrapping', titleAr: 'التغليف', hintEn: 'Pick a paper and a ribbon' },
  { id: 'addons', index: 2, titleEn: 'Extras & order', titleAr: 'إضافات وطلب', hintEn: 'Ferrero, chocolate, a card, then order' },
];

// -------------------------------------------------------------------------------------
// Options (prices are placeholders until the owner confirms his own)
// -------------------------------------------------------------------------------------
export const STEM_OPTIONS: readonly StemOption[] = [
  {
    id: 'rose-red',
    nameEn: 'Red Rose',
    nameAr: 'جوري أحمر',
    blurbEn: 'The classic deep red, full and velvety',
    blurbAr: 'الأحمر الكلاسيكي العميق، ممتلئ وناعم',
    kind: 'rose',
    price: 30,
    primary: '#c81d3a',
    secondary: '#7f1228',
  },
  {
    id: 'rose-burgundy',
    nameEn: 'Burgundy Rose',
    nameAr: 'جوري عنابي',
    blurbEn: 'Dark and dramatic, perfect with black wrap',
    blurbAr: 'داكن وجريء، مثالي مع التغليف الأسود',
    kind: 'rose',
    price: 32,
    primary: '#7a1230',
    secondary: '#4a0a1e',
  },
  {
    id: 'rose-pink',
    nameEn: 'Hot Pink Rose',
    nameAr: 'ورد وردي فوشيا',
    blurbEn: 'Bright, bold and joyful',
    blurbAr: 'مشرق وجريء ومبهج',
    kind: 'rose',
    price: 28,
    primary: '#ec4899',
    secondary: '#be185d',
  },
  {
    id: 'rose-blush',
    nameEn: 'Baby Pink Rose',
    nameAr: 'ورد بيبي بينك',
    blurbEn: 'Soft and sweet, a gentle gift',
    blurbAr: 'ناعم وحلو، هدية هادئة',
    kind: 'rose',
    price: 28,
    primary: '#f9c0d2',
    secondary: '#ef8fb0',
  },
  {
    id: 'rose-white',
    nameEn: 'White Rose',
    nameAr: 'ورد أبيض',
    blurbEn: 'Clean and calm, for weddings and new beginnings',
    blurbAr: 'نقي وهادئ، للأفراح والبدايات الجديدة',
    kind: 'rose',
    price: 28,
    primary: '#fbf7f2',
    secondary: '#e6ddd2',
  },
  {
    id: 'rose-yellow',
    nameEn: 'Yellow Rose',
    nameAr: 'ورد أصفر',
    blurbEn: 'Sunny and cheerful, for a bright day',
    blurbAr: 'مشمس ومبهج، ليوم مشرق',
    kind: 'rose',
    price: 28,
    primary: '#fbd34d',
    secondary: '#e8a617',
  },
  {
    id: 'gypsophila',
    nameEn: "Baby's Breath",
    nameAr: 'جيبسوفيلا',
    blurbEn: 'Light white filler that softens the bouquet',
    blurbAr: 'حشوة بيضاء خفيفة تُنعّم الباقة',
    kind: 'filler',
    price: 10,
    primary: '#ffffff',
    secondary: '#e5e7eb',
  },
];

export const PAPER_OPTIONS: readonly PaperOption[] = [
  { id: 'black', nameEn: 'Black & Gold', nameAr: 'أسود بحواف ذهبية', price: 40, from: '#3a3a42', to: '#0b090a' },
  { id: 'white', nameEn: 'White Lace', nameAr: 'أبيض شفاف', price: 35, from: '#fafaf9', to: '#d6d3d1' },
  { id: 'pink', nameEn: 'Soft Pink', nameAr: 'وردي ناعم', price: 35, from: '#fbcfe8', to: '#f472b6' },
  { id: 'red', nameEn: 'Deep Red', nameAr: 'أحمر غامق', price: 40, from: '#be123c', to: '#4c0519' },
  { id: 'gold', nameEn: 'Gold Foil', nameAr: 'ذهبي لامع', price: 50, from: '#f6e0bd', to: '#c98f4f' },
  { id: 'kraft', nameEn: 'Natural Kraft', nameAr: 'كرافت طبيعي', price: 30, from: '#e7d3b5', to: '#b99a6b' },
];

export const RIBBON_OPTIONS: readonly RibbonOption[] = [
  { id: 'gold', nameEn: 'Gold satin', nameAr: 'ساتان ذهبي', price: 15, color: '#e0a96d' },
  { id: 'rose', nameEn: 'Red satin', nameAr: 'ساتان أحمر', price: 15, color: '#e11d48' },
  { id: 'ivory', nameEn: 'Ivory', nameAr: 'عاجي', price: 10, color: '#f5f0e6' },
  { id: 'noir', nameEn: 'Black', nameAr: 'أسود', price: 10, color: '#18181b' },
];

export const DEFAULT_RIBBON_ID = 'gold';

export const ADDON_OPTIONS: readonly AddonOption[] = [
  {
    id: 'chocolates',
    nameEn: 'Ferrero Rocher',
    nameAr: 'فيريرو روشيه',
    blurbEn: 'Golden Ferrero pieces tucked between the roses',
    blurbAr: 'حبات فيريرو ذهبية بين الورد',
    price: 150,
    icon: 'chocolate',
  },
  {
    id: 'bars',
    nameEn: 'Chocolate bars fan',
    nameAr: 'مروحة ألواح شوكولاتة',
    blurbEn: 'An assortment of chocolate bars, fanned beside the bouquet',
    blurbAr: 'تشكيلة ألواح شوكولاتة على شكل مروحة بجانب الباقة',
    price: 120,
    icon: 'chocolate',
  },
  {
    id: 'card',
    nameEn: 'Message card',
    nameAr: 'بطاقة رسالة',
    blurbEn: 'Your words, written for you on a card',
    blurbAr: 'كلماتك مكتوبة لك على بطاقة',
    price: 15,
    icon: 'card',
    needsMessage: true,
  },
  {
    id: 'balloon',
    nameEn: 'Helium balloon',
    nameAr: 'بالون هيليوم',
    blurbEn: 'A foil heart that floats above the bouquet',
    blurbAr: 'قلب فويل يطفو فوق الباقة',
    price: 90,
    icon: 'balloon',
  },
  {
    id: 'plush',
    nameEn: 'Teddy bear',
    nameAr: 'دبدوب',
    blurbEn: 'A soft teddy bear, 22 cm',
    blurbAr: 'دبدوب ناعم، 22 سم',
    price: 180,
    icon: 'plush',
  },
];

/** A bouquet size: the number of roses (baby's breath is added on top when chosen). */
export interface SizeOption {
  readonly count: number;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly noteEn: string;
  readonly noteAr: string;
}

export const SIZE_OPTIONS: readonly SizeOption[] = [
  { count: 12, nameEn: 'Petite', nameAr: 'صغيرة', noteEn: 'A simple, sweet gift', noteAr: 'هدية بسيطة وحلوة' },
  { count: 25, nameEn: 'Classic', nameAr: 'وسط', noteEn: 'The one most people pick', noteAr: 'الأكثر طلبًا' },
  { count: 40, nameEn: 'Large', nameAr: 'كبيرة', noteEn: 'Full and impressive', noteAr: 'ممتلئة وتلفت النظر' },
  { count: 60, nameEn: 'Grand', nameAr: 'فخمة', noteEn: 'For a big occasion', noteAr: 'لمناسبة كبيرة' },
  { count: 100, nameEn: 'Royal', nameAr: 'ملكية', noteEn: 'As big as it gets', noteAr: 'أكبر حجم' },
];

/** Share of the roses that take the second colour when one is chosen. */
export const SECOND_SHARE = 0.35;
/** Baby's breath added per rose when "with baby's breath" is on. */
export const FILLER_SHARE = 0.1;
/** Id of the filler flower. */
export const FILLER_ID = 'gypsophila';

/** What a customer picks in the first step; stems are worked out from it. */
export interface BouquetRecipe {
  readonly size: number;
  readonly mainId: string;
  readonly secondId: string | null;
  readonly filler: boolean;
}

/** The bouquet shown before the customer has chosen anything. */
export const DEFAULT_RECIPE: BouquetRecipe = { size: 25, mainId: 'rose-red', secondId: null, filler: true };
export const DEFAULT_PAPER_ID = 'black';

/** A ready-made bouquet: one tap fills the recipe, paper and ribbon; the customer can then tweak it. */
export interface StudioPreset extends BouquetRecipe {
  readonly id: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly noteEn: string;
  readonly noteAr: string;
  readonly paperId: string;
  readonly ribbonId: string;
}

export const STUDIO_PRESETS: readonly StudioPreset[] = [
  {
    id: 'red',
    nameEn: 'Classic Red',
    nameAr: 'الجوري الأحمر',
    noteEn: 'Full red roses in black and gold',
    noteAr: 'جوري أحمر ممتلئ بتغليف أسود وذهبي',
    size: 40,
    mainId: 'rose-red',
    secondId: null,
    filler: true,
    paperId: 'black',
    ribbonId: 'gold',
  },
  {
    id: 'pink',
    nameEn: 'Pink Cloud',
    nameAr: 'سحابة وردية',
    noteEn: 'Hot pink and baby pink, soft and full',
    noteAr: 'فوشيا وبيبي بينك، ناعمة وممتلئة',
    size: 40,
    mainId: 'rose-pink',
    secondId: 'rose-blush',
    filler: true,
    paperId: 'pink',
    ribbonId: 'ivory',
  },
  {
    id: 'white',
    nameEn: 'White Love',
    nameAr: 'الأبيض الناعم',
    noteEn: 'White roses with a touch of pink',
    noteAr: 'ورد أبيض مع لمسة وردية',
    size: 25,
    mainId: 'rose-white',
    secondId: 'rose-blush',
    filler: true,
    paperId: 'white',
    ribbonId: 'gold',
  },
  {
    id: 'duo',
    nameEn: 'Red & Pink',
    nameAr: 'أحمر ووردي',
    noteEn: 'Red roses with hot pink, wrapped in black',
    noteAr: 'جوري أحمر مع فوشيا بتغليف أسود',
    size: 25,
    mainId: 'rose-red',
    secondId: 'rose-pink',
    filler: true,
    paperId: 'black',
    ribbonId: 'rose',
  },
];

/** Suggested card messages (EN + AR) so nobody stares at an empty box. */
export interface MessageSuggestion {
  readonly en: string;
  readonly ar: string;
}

export const MESSAGE_SUGGESTIONS: readonly MessageSuggestion[] = [
  { en: 'Happy birthday to someone who makes every room brighter.', ar: 'عيد ميلاد سعيد لمن يجعل كل مكان أكثر إشراقًا.' },
  { en: 'Every year with you is my favourite chapter.', ar: 'كل سنة معاك هي أجمل فصل في حكايتي.' },
  { en: 'You are the best thing in my life, every year.', ar: 'كل سنة وانتي أحلى حاجة في حياتي.' },
  { en: 'Congratulations - so proud of you.', ar: 'مبروك — فخور بيك جدًا.' },
];

/** 24x24 stroke paths for the add-on icons. */
export const ADDON_ICON_PATHS: Readonly<Record<AddonIcon, string>> = {
  chocolate: 'M4 6h16v12H4z M4 12h16 M10 6v12 M16 6v12',
  card: 'M3 6h18v12H3z M3 7l9 6 9-6',
  candle: 'M12 2.5c1.6 2 2.2 3.2 0 5-2.2-1.8-1.6-3 0-5z M9 11h6v10H9z M12 8v3',
  balloon: 'M12 3a5 5 0 0 1 5 5c0 4-3 7-5 8-2-1-5-4-5-8a5 5 0 0 1 5-5z M12 16l-1 2h2l-1-2z M12 18c0 1.5-1 2.5-1 3.5',
  plush:
    'M6 13a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M4.8 6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0 M14.8 6a2.2 2.2 0 1 0 4.4 0a2.2 2.2 0 1 0-4.4 0 M10 12.5h.01 M14 12.5h.01 M11 15.5h2',
  vase: 'M9 3h6 M10 3v3c-3 2-4 5-4 8a6 6 0 0 0 12 0c0-3-1-6-4-8V3',
};

export function findStem(id: string): StemOption | undefined {
  return STEM_OPTIONS.find((s) => s.id === id);
}
export function findPaper(id: string | null): PaperOption | undefined {
  return id ? PAPER_OPTIONS.find((p) => p.id === id) : undefined;
}
export function findRibbon(id: string): RibbonOption | undefined {
  return RIBBON_OPTIONS.find((r) => r.id === id);
}
export function findAddon(id: string): AddonOption | undefined {
  return ADDON_OPTIONS.find((a) => a.id === id);
}

// -------------------------------------------------------------------------------------
// Prices the shop sets from the admin
// -------------------------------------------------------------------------------------
// The option lists above are read everywhere (quotes, size cards, the order form), so a price change
// is applied to the option objects themselves: every reader sees it at once, with no extra plumbing.
// This is the one place that writes to them. The changes are kept in localStorage and re-applied on load.
export type StudioPriceKind = 'stem' | 'paper' | 'ribbon' | 'addon';

export interface StudioPriceRow {
  readonly kind: StudioPriceKind;
  readonly id: string;
  readonly nameAr: string;
  /** What the price was before the shop changed it. */
  readonly original: number;
  readonly price: number;
}

const STUDIO_PRICES_KEY = 'sky-flower.studio-prices.v1';
const studioTables: Readonly<Record<StudioPriceKind, readonly { id: string; nameAr: string; price: number }[]>> = {
  stem: STEM_OPTIONS,
  paper: PAPER_OPTIONS,
  ribbon: RIBBON_OPTIONS,
  addon: ADDON_OPTIONS,
};
const priceKey = (kind: StudioPriceKind, id: string): string => `${kind}:${id}`;
const ORIGINAL_PRICES = new Map<string, number>(
  (Object.keys(studioTables) as StudioPriceKind[]).flatMap((kind) =>
    studioTables[kind].map((o): [string, number] => [priceKey(kind, o.id), o.price]),
  ),
);

function readStudioPrices(): Record<string, number> {
  try {
    const raw = globalThis.localStorage?.getItem(STUDIO_PRICES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeStudioPrices(saved: Record<string, number>): void {
  try {
    globalThis.localStorage?.setItem(STUDIO_PRICES_KEY, JSON.stringify(saved));
  } catch {
    /* storage unavailable: the change lasts until reload */
  }
}

/** Every priced option with its current and original price, for the admin table. */
export function studioPriceRows(): StudioPriceRow[] {
  return (Object.keys(studioTables) as StudioPriceKind[]).flatMap((kind) =>
    studioTables[kind].map((o) => ({
      kind,
      id: o.id,
      nameAr: o.nameAr,
      original: ORIGINAL_PRICES.get(priceKey(kind, o.id)) ?? o.price,
      price: o.price,
    })),
  );
}

function applyStudioPrice(kind: StudioPriceKind, id: string, price: number): void {
  const option = studioTables[kind].find((o) => o.id === id);
  if (option) (option as { price: number }).price = price;
}

export function setStudioPrice(kind: StudioPriceKind, id: string, price: number): void {
  if (!Number.isFinite(price) || price <= 0) return;
  const rounded = Math.round(price);
  const key = priceKey(kind, id);
  applyStudioPrice(kind, id, rounded);
  const saved = readStudioPrices();
  if (rounded === ORIGINAL_PRICES.get(key)) delete saved[key];
  else saved[key] = rounded;
  writeStudioPrices(saved);
}

export function resetStudioPrice(kind: StudioPriceKind, id: string): void {
  const original = ORIGINAL_PRICES.get(priceKey(kind, id));
  if (original !== undefined) setStudioPrice(kind, id, original);
}

/** Applies the saved prices (runs once when this file loads). */
function applyStoredStudioPrices(): void {
  for (const [key, price] of Object.entries(readStudioPrices())) {
    const [kind, id] = key.split(':') as [StudioPriceKind, string];
    if (studioTables[kind] && Number.isFinite(price) && price > 0) applyStudioPrice(kind, id, price);
  }
}
applyStoredStudioPrices();