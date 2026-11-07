import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { LANG_KEY, Lang, currentLang, stemsLabel, stemsMoreLabel } from './lang';
import { AR, EN, MessageKey } from './messages';

export type TextDir = 'ltr' | 'rtl';

/**
 * English / Arabic switching.
 *
 * Every read goes through the `currentLang` signal, so any OnPush template that calls
 * `t()`, `pick()` or `alt()` re-renders by itself when the language changes. The service also
 * keeps `<html lang dir>`, the document title and the meta description in step with the choice,
 * and remembers it in localStorage.
 *
 * The page always shows one language as the main text; the "other" language (`alt`, `other`)
 * is what the small accent lines under each heading show, so the bilingual identity of the
 * brand is kept in both directions.
 */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly doc = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  readonly lang = currentLang.asReadonly();
  readonly isAr = computed(() => this.lang() === 'ar');
  readonly dir = computed<TextDir>(() => (this.lang() === 'ar' ? 'rtl' : 'ltr'));
  /** The language that is NOT being shown: used by the accent lines. */
  readonly other = computed<Lang>(() => (this.lang() === 'ar' ? 'en' : 'ar'));
  readonly otherDir = computed<TextDir>(() => (this.lang() === 'ar' ? 'ltr' : 'rtl'));

  constructor() {
    effect(() => {
      const lang = this.lang();
      const root = this.doc.documentElement;
      root.lang = lang;
      root.dir = lang === 'ar' ? 'rtl' : 'ltr';
      this.title.setTitle(this.dict(lang)['meta.title']);
      this.meta.updateTag({ name: 'description', content: this.dict(lang)['meta.description'] });
      try {
        globalThis.localStorage?.setItem(LANG_KEY, lang);
      } catch {
        /* storage unavailable - the choice just won't survive a reload */
      }
    });
  }

  set(lang: Lang): void {
    currentLang.set(lang);
  }

  toggle(): void {
    currentLang.set(this.lang() === 'ar' ? 'en' : 'ar');
  }

  /** Interface string in the current language. */
  t(key: MessageKey, params?: Readonly<Record<string, string | number>>): string {
    return this.fill(this.dict(this.lang())[key], params);
  }

  /** The same string in the other language (accent lines). */
  alt(key: MessageKey, params?: Readonly<Record<string, string | number>>): string {
    return this.fill(this.dict(this.other())[key], params);
  }

  /** Chooses between two literal values by language: `pick(p.nameEn, p.nameAr)`. */
  pick<T>(en: T, ar: T | undefined | null): T {
    return this.lang() === 'ar' && ar != null ? ar : en;
  }

  /** The value for the language that is not shown. */
  pickAlt<T>(en: T, ar: T | undefined | null): T {
    return this.lang() === 'ar' ? en : (ar ?? en);
  }

  /** "5 stems" / "٥ سيقان" with Arabic plural rules. */
  stems(n: number): string {
    return stemsLabel(n, this.lang());
  }

  /** "3 more stems" / "3 سيقان أخرى". */
  stemsMore(n: number): string {
    return stemsMoreLabel(n, this.lang());
  }

  /** Bare unit word for "Add <b>3</b> more {unit}". */
  stemUnit(n: number): string {
    if (this.lang() === 'en') return n === 1 ? 'stem' : 'stems';
    return n === 1 || n === 2 ? 'ساق' : n <= 10 ? 'سيقان' : 'ساقًا';
  }

  /** Locale for dates and numbers (Latin digits in both, to match the price tags). */
  get dateLocale(): string {
    return this.lang() === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB';
  }

  private dict(lang: Lang): Readonly<Record<MessageKey, string>> {
    return lang === 'ar' ? AR : EN;
  }

  private fill(template: string, params?: Readonly<Record<string, string | number>>): string {
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
  }
}
