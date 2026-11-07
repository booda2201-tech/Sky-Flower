/**
 * Sky Flower - real brand facts, in one place.
 *
 * Everything here was read from the brand's own public pages (Facebook, Instagram, TikTok,
 * YouTube, Google Maps) in November 2026. Change a value here and the whole site follows.
 */

export interface BrandSocial {
  readonly id: 'facebook' | 'instagram' | 'tiktok' | 'youtube';
  readonly label: string;
  readonly handle: string;
  readonly href: string;
  /** Short, display-ready follower figure (as of the date below). */
  readonly followers?: string;
}

export const BRAND = {
  nameEn: 'Sky Flower',
  nameAr: 'سكاي فلاور',
  cityEn: 'Tanta',
  cityAr: 'طنطا',
  addressEn: 'Omar Ibn Abdelaziz St., Tanta',
  addressAr: 'شارع عمر بن عبد العزيز، طنطا',
  hoursEn: 'Daily 9 AM – 10 PM',
  hoursAr: 'يوميًا من 9 ص إلى 10 م',
  /** Shop landline (Google Maps listing). */
  phone: '0403295995',
  /**
   * WhatsApp number for orders, international format without "+".
   * TEMPORARY test number (demo). Replace with the owner's confirmed number
   * (TikTok bio lists 01099147828) before going live.
   */
  whatsapp: '201557112803',
  /** Date the follower figures were read. */
  statsAsOf: '2026-11-02',
  /** TikTok total likes. */
  tiktokLikes: '8M',
} as const;

export const BRAND_SOCIALS: readonly BrandSocial[] = [
  { id: 'facebook', label: 'Facebook', handle: 'sky.flowerr', href: 'https://www.facebook.com/sky.flowerr', followers: '1.5M' },
  { id: 'tiktok', label: 'TikTok', handle: '@sky.flower098', href: 'https://www.tiktok.com/@sky.flower098', followers: '538K' },
  { id: 'instagram', label: 'Instagram', handle: '@sky.flowerrr', href: 'https://www.instagram.com/sky.flowerrr/', followers: '503K' },
  { id: 'youtube', label: 'YouTube', handle: '@skyflowerofficial', href: 'https://youtube.com/@skyflowerofficial' },
];

/** Where the admin's settings are kept (the shop can change its order number without a developer). */
export const SETTINGS_KEY = 'sky-flower.settings.v1';

/** The number orders go to: the one set in the admin, else the built-in default. */
export function whatsappNumber(): string {
  try {
    const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
    const saved = raw ? (JSON.parse(raw) as { whatsapp?: string }).whatsapp : undefined;
    if (saved && /^\d{10,15}$/.test(saved)) return saved;
  } catch {
    /* unreadable settings: use the default */
  }
  return BRAND.whatsapp;
}

/** `wa.me` link, optionally with a ready-made message. */
export function whatsappLink(message?: string): string {
  const base = `https://wa.me/${whatsappNumber()}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
