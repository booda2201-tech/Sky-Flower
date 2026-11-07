/**
 * Sky Flower - catalogue dataset.
 *
 * Mock data that mirrors what the storefront API will return. Everything the UI needs lives
 * here (bilingual copy, EGP pricing, imagery, tags), so components stay presentational.
 * NOTE: the bouquets and their photos are the brand's own (frames from its YouTube videos, hot-linked,
 * never copied). Names, descriptions and PRICES are placeholders until the owner supplies the real
 * catalogue. Image ids are either an Unsplash photo id or `yt:<videoId>:<frame>` (see `yt()`).
 *
 * Every piece of customer-facing text exists in English (`...En` / unsuffixed) and Arabic (`...Ar`).
 */
import { Lang, currentLang } from '../core/lang';

export type Occasion =
  | 'Anniversaries'
  | 'Birthdays'
  | 'Weddings'
  | 'Engagements'
  | 'Graduation'
  | 'Romantic'
  | 'Luxury Boxes';
export type ProductBadge = 'Bestseller' | 'New season' | 'Limited edition' | 'Signature' | 'Gift favourite';
export type LeadTime = 'Same-day delivery' | 'Next-day delivery';

export const BADGE_AR: Readonly<Record<ProductBadge, string>> = {
  Bestseller: 'الأكثر مبيعًا',
  'New season': 'موسم جديد',
  'Limited edition': 'إصدار محدود',
  Signature: 'تصميم مميز',
  'Gift favourite': 'الهدية المفضلة',
};

export const LEAD_TIME_AR: Readonly<Record<LeadTime, string>> = {
  'Same-day delivery': 'توصيل في نفس اليوم',
  'Next-day delivery': 'توصيل في اليوم التالي',
};

export interface FlowerProduct {
  readonly id: string;
  readonly slug: string;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly taglineEn: string;
  readonly taglineAr: string;
  readonly descriptionEn: string;
  readonly descriptionAr: string;
  /** Price in whole Egyptian pounds. */
  readonly price: number;
  readonly compareAtPrice?: number;
  readonly currency: 'EGP';
  /** Id of the main (portrait) image: an Unsplash photo id or a brand video frame (`yt()`). */
  readonly imageId: string;
  /** Id of the secondary image, revealed on hover. */
  readonly imageAltId: string;
  /** Optional CSS `object-position` for the main image (brand frames are 9:16, cards are 4:5). */
  readonly imageFocus?: string;
  /** Product accent colour: drives glows, borders and the floating price tag. */
  readonly accent: string;
  readonly tags: readonly string[];
  readonly tagsAr: readonly string[];
  readonly occasions: readonly Occasion[];
  readonly includes: readonly string[];
  readonly includesAr: readonly string[];
  readonly badge?: ProductBadge;
  readonly leadTime: LeadTime;
  /** Out of stock: shown on the site but cannot be added to the bag (set from the admin). */
  readonly soldOut?: boolean;
  /** Added by the shop from the admin (the built-in six are not). */
  readonly custom?: boolean;
}

// -------------------------------------------------------------------------------------
// Catalogue
// -------------------------------------------------------------------------------------
export const FLOWER_PRODUCTS: readonly FlowerProduct[] = [
  {
    id: 'sf-001',
    slug: 'ferrero-crown',
    nameEn: 'Ferrero Crown',
    nameAr: 'تاج فيريرو',
    taglineEn: 'A full round of red roses studded with Ferrero.',
    taglineAr: 'دائرة كاملة من الورد الأحمر مرصّعة بالفيريرو',
    descriptionEn:
      'A generous, full-round bouquet of deep red roses with golden Ferrero chocolates tucked between them, finished in black and white wrap. Made to be the biggest thing in the room.',
    descriptionAr:
      'باقة مستديرة ممتلئة من الورد الأحمر الداكن بين وروده حبات فيريرو ذهبية، ومغلّفة بورق أسود وأبيض. صُنعت لتكون أكبر ما في المكان.',
    price: 1450,
    currency: 'EGP',
    imageId: yt('wizzPW8H1eU', 'oar3'),
    imageAltId: yt('wizzPW8H1eU', 'oar1'),
    accent: '#e11d48',
    tags: ['Red roses', 'Ferrero', 'Black & white wrap'],
    tagsAr: ['ورد أحمر', 'فيريرو', 'تغليف أسود وأبيض'],
    occasions: ['Romantic', 'Anniversaries', 'Engagements'],
    includes: ['Fresh red roses', 'Ferrero chocolates', 'Black & white wrap', 'Message card'],
    includesAr: ['ورد أحمر طازج', 'شوكولاتة فيريرو', 'تغليف أسود وأبيض', 'بطاقة رسالة'],
    badge: 'Bestseller',
    leadTime: 'Same-day delivery',
  },
  {
    id: 'sf-002',
    slug: 'heart-of-roses',
    nameEn: 'Heart of Roses',
    nameAr: 'قلب الورد',
    taglineEn: 'Red roses shaped into a heart.',
    taglineAr: 'ورد أحمر على شكل قلب',
    descriptionEn:
      'Hundreds of red roses packed tight and shaped into a heart, wrapped in black. The one you bring when words are not enough.',
    descriptionAr:
      'ورد أحمر كثيف مرصوص على شكل قلب ومغلّف بالأسود. هي اللي تجيبها لما الكلام ميكفيش.',
    price: 1850,
    currency: 'EGP',
    imageId: yt('2Buh_dQBUt8', 'oar3'),
    imageAltId: yt('2Buh_dQBUt8', 'oar1'),
    imageFocus: '50% 12%',
    accent: '#be123c',
    tags: ['Heart shape', 'Red roses', 'Black wrap'],
    tagsAr: ['شكل قلب', 'ورد أحمر', 'تغليف أسود'],
    occasions: ['Romantic', 'Anniversaries', 'Engagements'],
    includes: ['Fresh red roses', 'Heart-shaped arrangement', 'Black wrap', 'Message card'],
    includesAr: ['ورد أحمر طازج', 'تنسيق على شكل قلب', 'تغليف أسود', 'بطاقة رسالة'],
    badge: 'Signature',
    leadTime: 'Next-day delivery',
  },
  {
    id: 'sf-003',
    slug: 'pink-cloud',
    nameEn: 'Pink Cloud',
    nameAr: 'سحابة وردية',
    taglineEn: 'A soft mass of pink roses.',
    taglineAr: 'كتلة ناعمة من الورد الوردي',
    descriptionEn:
      'An oversized bouquet of pink roses, soft and full from every angle. A gentle, happy gift for her.',
    descriptionAr:
      'باقة كبيرة من الورد الوردي، ناعمة وممتلئة من كل زاوية. هدية هادئة وسعيدة لها.',
    price: 1250,
    currency: 'EGP',
    imageId: yt('dqI_i5Z2jl4', 'oar3'),
    imageAltId: yt('dqI_i5Z2jl4', 'oar2'),
    accent: '#f472b6',
    tags: ['Pink roses', 'Oversized'],
    tagsAr: ['ورد وردي', 'حجم كبير'],
    occasions: ['Birthdays', 'Weddings', 'Graduation'],
    includes: ['Fresh pink roses', 'Soft wrap', 'Message card'],
    includesAr: ['ورد وردي طازج', 'تغليف ناعم', 'بطاقة رسالة'],
    badge: 'Gift favourite',
    leadTime: 'Same-day delivery',
  },
  {
    id: 'sf-004',
    slug: 'chocolate-rose-bouquet',
    nameEn: 'Chocolate Rose Bouquet',
    nameAr: 'باقة الورد والشوكولاتة',
    taglineEn: 'Red roses with a fan of chocolate bars.',
    taglineAr: 'ورد أحمر مع مروحة من ألواح الشوكولاتة',
    descriptionEn:
      'Red roses and a fan of chocolate bars in one black-wrapped bouquet: flowers to look at, sweets to eat.',
    descriptionAr:
      'ورد أحمر ومروحة من ألواح الشوكولاتة في باقة واحدة مغلّفة بالأسود: ورد للتأمل وحلويات للأكل.',
    price: 650,
    currency: 'EGP',
    imageId: yt('3Uc-ga-zH40', 'oar3'),
    imageAltId: yt('3Uc-ga-zH40', 'oar2'),
    accent: '#b45309',
    tags: ['Red roses', 'Chocolate bars', 'Black wrap'],
    tagsAr: ['ورد أحمر', 'ألواح شوكولاتة', 'تغليف أسود'],
    occasions: ['Luxury Boxes', 'Romantic', 'Birthdays', 'Graduation'],
    includes: ['Fresh red roses', 'Assorted chocolate bars', 'Black wrap', 'Message card'],
    includesAr: ['ورد أحمر طازج', 'ألواح شوكولاتة متنوعة', 'تغليف أسود', 'بطاقة رسالة'],
    badge: 'New season',
    leadTime: 'Same-day delivery',
  },
  {
    id: 'sf-005',
    slug: 'surprise-gift-box',
    nameEn: 'Surprise Gift Box',
    nameAr: 'صندوق المفاجآت',
    taglineEn: 'Flowers, chocolates and a collectible, boxed.',
    taglineAr: 'ورد وشوكولاتة وهدية تذكارية في صندوق',
    descriptionEn:
      'A gift box overflowing with flowers and chocolates, with a collectible figure and a little surprise on top. Opens like a present.',
    descriptionAr:
      'صندوق هدايا مليان ورد وشوكولاتة، وفوقهم شخصية تذكارية ومفاجأة صغيرة. بيتفتح زي الهدية.',
    price: 550,
    currency: 'EGP',
    imageId: yt('e0usfdxx150', 'oar3'),
    imageAltId: yt('e0usfdxx150', 'oar2'),
    accent: '#a855f7',
    tags: ['Gift box', 'Chocolates', 'Collectible'],
    tagsAr: ['صندوق هدايا', 'شوكولاتة', 'هدية تذكارية'],
    occasions: ['Luxury Boxes', 'Birthdays', 'Graduation'],
    includes: ['Flower box', 'Chocolates', 'Collectible figure', 'Message card'],
    includesAr: ['صندوق ورد', 'شوكولاتة', 'شخصية تذكارية', 'بطاقة رسالة'],
    leadTime: 'Next-day delivery',
  },
  {
    id: 'sf-006',
    slug: 'roses-and-lilies',
    nameEn: 'Roses & Lilies',
    nameAr: 'ورد وزنبق',
    taglineEn: 'Red roses and pink lilies in white wrap.',
    taglineAr: 'ورد أحمر وزنبق وردي في تغليف أبيض',
    descriptionEn:
      'A big bouquet of red roses with pink lilies on top, wrapped in white. Fragrant, bright and made for a celebration.',
    descriptionAr:
      'باقة كبيرة من الورد الأحمر وفوقه زنبق وردي، ومغلّفة بالأبيض. عطرة ومبهجة ومصنوعة للاحتفال.',
    price: 1350,
    currency: 'EGP',
    imageId: yt('14hFI8pWhYo', 'oar3'),
    imageAltId: yt('14hFI8pWhYo', 'oar2'),
    accent: '#fb7185',
    tags: ['Red roses', 'Pink lilies', 'White wrap'],
    tagsAr: ['ورد أحمر', 'زنبق وردي', 'تغليف أبيض'],
    occasions: ['Weddings', 'Anniversaries', 'Engagements'],
    includes: ['Fresh red roses', 'Pink lilies', 'White wrap', 'Message card'],
    includesAr: ['ورد أحمر طازج', 'زنبق وردي', 'تغليف أبيض', 'بطاقة رسالة'],
    badge: 'Signature',
    leadTime: 'Next-day delivery',
  },
] as const;

// -------------------------------------------------------------------------------------
// Filters & derived data
// -------------------------------------------------------------------------------------
export interface OccasionFilter {
  readonly id: Occasion | 'All';
  readonly labelEn: string;
  readonly labelAr: string;
}

export const OCCASION_FILTERS: readonly OccasionFilter[] = [
  { id: 'All', labelEn: 'All creations', labelAr: 'الكل' },
  { id: 'Romantic', labelEn: 'Romantic', labelAr: 'رومانسية' },
  { id: 'Anniversaries', labelEn: 'Anniversaries', labelAr: 'الذكرى السنوية' },
  { id: 'Birthdays', labelEn: 'Birthdays', labelAr: 'أعياد الميلاد' },
  { id: 'Weddings', labelEn: 'Weddings', labelAr: 'الأفراح' },
  { id: 'Engagements', labelEn: 'Engagements', labelAr: 'الخطوبة' },
  { id: 'Graduation', labelEn: 'Graduation', labelAr: 'التخرّج' },
  { id: 'Luxury Boxes', labelEn: 'Luxury Boxes', labelAr: 'صناديق فاخرة' },
];

export const CATALOG_STATS = {
  productCount: FLOWER_PRODUCTS.length,
  startingPrice: Math.min(...FLOWER_PRODUCTS.map((p) => p.price)),
} as const;

// -------------------------------------------------------------------------------------
// Formatting / image helpers
// -------------------------------------------------------------------------------------
const egpFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/**
 * `2450` -> `EGP 2,450` (English) / `2,450 ج.م` (Arabic).
 * Reads the language signal when no language is passed, so templates stay reactive.
 */
export function formatEgp(value: number, lang: Lang = currentLang()): string {
  const n = egpFormatter.format(value);
  return lang === 'ar' ? `${n} ج.م` : `EGP ${n}`;
}

/** `2450` -> `2,450` (no currency; for compact tags). */
export function formatNumber(value: number): string {
  return egpFormatter.format(value);
}

/** Image id for a frame of one of the brand's videos (`oar1`..`oar3` are three tall frames). */
export function yt(videoId: string, frame: 'oar1' | 'oar2' | 'oar3' = 'oar2'): string {
  return `yt:${videoId}:${frame}`;
}

const YT_FRAME = /^yt:([\w-]{11}):(oar[123])$/;

/** An image the shop uploaded or linked from the admin: a data: URL or a full web address. */
export const isDirectImage = (id: string): boolean => /^(data:image\/|https?:\/\/)/.test(id);

/**
 * Resolves an image id to a URL: a brand video frame (`yt:...`, 720x1280, fixed size) or a
 * responsive Unsplash CDN URL for a photo id.
 */
export function unsplashUrl(photoId: string, width: number, height?: number): string {
  if (isDirectImage(photoId)) return photoId;
  const frame = YT_FRAME.exec(photoId);
  if (frame) return `https://i.ytimg.com/vi/${frame[1]}/${frame[2]}.jpg`;
  const crop = height ? `&h=${height}&fit=crop&crop=entropy` : '&fit=max';
  return `https://images.unsplash.com/${photoId}?auto=format&q=80&w=${width}${crop}`;
}

/** `srcset` for a portrait crop (4:5) at several widths (a brand frame has only one size). */
export function unsplashSrcset(photoId: string, widths: readonly number[], ratio = 1.25): string {
  if (isDirectImage(photoId)) return ''; // one size only (and a data: URL contains commas, which srcset cannot hold)
  if (YT_FRAME.test(photoId)) return `${unsplashUrl(photoId, 720)} 720w`;
  return widths.map((w) => `${unsplashUrl(photoId, w, Math.round(w * ratio))} ${w}w`).join(', ');
}
