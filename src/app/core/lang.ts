import { signal } from '@angular/core';

/**
 * Language primitives that must be usable from plain functions (price formatting, quote
 * labels) as well as from components. The signal lives at module level so that reading it
 * inside a template makes that template reactive to language changes.
 */
export type Lang = 'en' | 'ar';

export const LANG_KEY = 'sky-flower.lang.v1';

function detectInitialLang(): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'ar') return stored;
  } catch {
    /* storage unavailable - fall through to the default language */
  }
  // The shop's customers are Arabic-speaking: Arabic is the default, English is one tap away.
  return 'ar';
}

/** The language currently shown. Change it through `I18nService.set()`. */
export const currentLang = signal<Lang>(detectInitialLang());

/** `3` -> "3 stems" / "3 سيقان" (Arabic dual and plural rules included). */
export function stemsLabel(n: number, lang: Lang): string {
  if (lang === 'en') return `${n} ${n === 1 ? 'stem' : 'stems'}`;
  if (n === 1) return 'ساق واحدة';
  if (n === 2) return 'ساقان';
  return n <= 10 ? `${n} سيقان` : `${n} ساقًا`;
}

/** `3` -> "3 more stems" / "3 سيقان أخرى". */
export function stemsMoreLabel(n: number, lang: Lang): string {
  if (lang === 'en') return `${n} more ${n === 1 ? 'stem' : 'stems'}`;
  if (n === 1) return 'ساقًا واحدة أخرى';
  if (n === 2) return 'ساقين أخريين';
  return n <= 10 ? `${n} سيقان أخرى` : `${n} ساقًا أخرى`;
}
