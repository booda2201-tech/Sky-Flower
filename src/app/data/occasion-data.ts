import { FLOWER_PRODUCTS, FlowerProduct, Occasion, yt } from './flower-data';

/** A tall "shop by occasion" card. The cover is a frame from one of the brand's own videos. */
export interface OccasionCard {
  readonly id: Occasion;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly imageId: string;
  /** Glow colour for the cursor-tracking border. */
  readonly accent: string;
}

export const OCCASION_CARDS: readonly OccasionCard[] = [
  { id: 'Engagements', nameEn: 'Royal Engagements', nameAr: 'خطوبة ملكية', imageId: yt('7boFnY-gfds', 'oar2'), accent: '#b5425b' },
  { id: 'Graduation', nameEn: 'Graduation Gifts', nameAr: 'هدايا التخرّج', imageId: yt('XWvaijI0Xi8', 'oar2'), accent: '#a8365a' },
  { id: 'Birthdays', nameEn: 'Birthdays', nameAr: 'أعياد الميلاد', imageId: yt('CWQH5dHs4Kc', 'oar3'), accent: '#d05875' },
  { id: 'Weddings', nameEn: 'Weddings', nameAr: 'الأفراح', imageId: yt('3u2MtbQrWMw', 'oar2'), accent: '#e07d9a' },
  { id: 'Anniversaries', nameEn: 'Anniversaries', nameAr: 'الذكرى السنوية', imageId: yt('g7H4MLnEC3c', 'oar3'), accent: '#8a2a4a' },
];

/** How many catalogue designs belong to each occasion. */
export function occasionCount(id: Occasion, products: readonly FlowerProduct[] = FLOWER_PRODUCTS): number {
  return products.filter((p) => p.occasions.includes(id)).length;
}

/** "3 designs" / "٣ تصاميم" with Arabic plural rules (Latin digits, like the price tags). */
export function designsLabel(n: number, lang: 'en' | 'ar'): string {
  if (lang === 'en') return n === 1 ? '1 design' : `${n} designs`;
  if (n === 1) return 'تصميم واحد';
  if (n === 2) return 'تصميمان';
  return n <= 10 ? `${n} تصاميم` : `${n} تصميمًا`;
}