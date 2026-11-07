import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, distinctUntilChanged, map, shareReplay } from 'rxjs';
import { CustomBouquet } from './cart.model';
import {
  AddonOption,
  BouquetRecipe,
  DEFAULT_PAPER_ID,
  DEFAULT_RECIPE,
  DEFAULT_RIBBON_ID,
  FILLER_ID,
  FILLER_SHARE,
  HAND_TIE_FEE,
  MAX_STEMS,
  MESSAGE_MAX,
  MIN_STEMS,
  PaperOption,
  RibbonOption,
  SECOND_SHARE,
  STEM_OPTIONS,
  STUDIO_STEPS,
  StemOption,
  StudioPreset,
  StudioStep,
  StudioStepId,
  VOLUME_DISCOUNT_RATE,
  VOLUME_MIN_STEMS,
  findAddon,
  findPaper,
  findRibbon,
  findStem,
} from '../data/studio-data';
import { formatEgp } from '../data/flower-data';
import { CROWDED_DISTANCE, DEFAULT_SPACING, clampToArea, minDistance, slotPosition, slotRotation, spacingFor } from '../data/bouquet-geometry';
import { stemsLabel } from './lang';

// -------------------------------------------------------------------------------------
// State
// -------------------------------------------------------------------------------------

/**
 * One stem in the bouquet. `x` / `y` are where the customer put it (preview coordinates);
 * `slot` is its place in the default spiral, used for "arrange for me" and as a rotation seed.
 */
export interface StemEntry {
  readonly uid: number;
  readonly slot: number;
  readonly flowerId: string;
  readonly x: number;
  readonly y: number;
  readonly rot: number;
}

/** A stem sitting on its default spiral slot. */
export function stemOnSlot(uid: number, flowerId: string, slot: number, spacing = DEFAULT_SPACING): StemEntry {
  return { uid, flowerId, slot, ...slotPosition(slot, spacing), rot: slotRotation(slot) };
}

/**
 * Works the stems out from what the customer chose: size roses in one or two colours (the second
 * colour is spread evenly through the bouquet) plus an optional ring of baby's breath. Uids follow the
 * slot, so changing a colour or the size keeps every untouched bloom in place.
 */
export function composeStems(recipe: BouquetRecipe): StemEntry[] {
  const roses = Math.max(0, Math.round(recipe.size));
  const filler = recipe.filler && roses > 0 ? Math.max(2, Math.round(roses * FILLER_SHARE)) : 0;
  const spacing = spacingFor(roses + filler);
  const stems: StemEntry[] = [];
  for (let slot = 0; slot < roses; slot++) {
    const t = ((slot + 1) * 0.6180339887) % 1;
    const flowerId = recipe.secondId !== null && t < SECOND_SHARE ? recipe.secondId : recipe.mainId;
    stems.push(stemOnSlot(slot + 1, flowerId, slot, spacing));
  }
  for (let i = 0; i < filler; i++) stems.push(stemOnSlot(1000 + i, FILLER_ID, roses + i, spacing));
  return stems;
}

/** Lowest free slot. */
function lowestFreeSlot(stems: readonly StemEntry[]): number {
  const used = new Set(stems.map((e) => e.slot));
  let slot = 0;
  while (used.has(slot)) slot++;
  return slot;
}

/**
 * Slot for an automatically added stem: the lowest free one, unless a stem the customer moved
 * is already sitting there - then the free slot with the most breathing room wins.
 */
function pickAutoSlot(stems: readonly StemEntry[]): number {
  const used = new Set(stems.map((e) => e.slot));
  let best = -1;
  let bestDistance = -1;
  let checked = 0;
  for (let slot = 0; checked < stems.length + 12; slot++) {
    if (used.has(slot)) continue;
    checked++;
    const distance = minDistance(slotPosition(slot), stems);
    if (distance >= CROWDED_DISTANCE) return slot;
    if (distance > bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  return best;
}

export interface BouquetState {
  readonly step: StudioStepId;
  /** What the customer picked in step one; 
ull for a hand-built bouquet. */
  readonly recipe: BouquetRecipe | null;
  readonly stems: readonly StemEntry[];
  readonly paperId: string | null;
  readonly ribbonId: string;
  readonly addonIds: readonly string[];
  readonly message: string;
}

export const INITIAL_BOUQUET_STATE: BouquetState = {
  step: 'flowers',
  recipe: null,
  stems: [],
  paperId: null,
  ribbonId: DEFAULT_RIBBON_ID,
  addonIds: [],
  message: '',
};

// -------------------------------------------------------------------------------------
// Derived models
// -------------------------------------------------------------------------------------
export interface QuoteStemLine {
  readonly option: StemOption;
  readonly qty: number;
  readonly total: number;
}

export interface QuoteLine {
  /** Stable key for list tracking. */
  readonly key: string;
  readonly label: string;
  readonly labelAr: string;
  /** Negative for savings. */
  readonly amount: number;
}

export interface BouquetQuote {
  readonly stemCount: number;
  readonly stemLines: readonly QuoteStemLine[];
  readonly flowersSubtotal: number;
  readonly volumeDiscount: number;
  readonly paper: PaperOption | null;
  readonly ribbon: RibbonOption;
  readonly addons: readonly AddonOption[];
  readonly handTieFee: number;
  readonly total: number;
  /** Non-zero lines for the calculator breakdown. */
  readonly breakdown: readonly QuoteLine[];
  /** Stems still needed before the bouquet is valid, 0 when ready. */
  readonly stemsMissing: number;
  /** Stems the volume saving still needs, 0 once unlocked (or when the bouquet is empty). */
  readonly stemsToSaving: number;
}

export interface StepStatus {
  readonly step: StudioStep;
  readonly active: boolean;
  readonly valid: boolean;
  /** The user may jump here (every earlier step is valid). */
  readonly reachable: boolean;
  readonly done: boolean;
}

/** Pure pricing: the same function backs the UI, the cart line and the tests. */
export function computeQuote(state: BouquetState): BouquetQuote {
  const counts = new Map<string, number>();
  for (const s of state.stems) counts.set(s.flowerId, (counts.get(s.flowerId) ?? 0) + 1);

  const stemLines: QuoteStemLine[] = STEM_OPTIONS.filter((o) => counts.has(o.id)).map((option) => {
    const qty = counts.get(option.id) ?? 0;
    return { option, qty, total: qty * option.price };
  });

  const stemCount = state.stems.length;
  const flowersSubtotal = stemLines.reduce((sum, l) => sum + l.total, 0);
  const volumeDiscount = stemCount >= VOLUME_MIN_STEMS ? Math.round(flowersSubtotal * VOLUME_DISCOUNT_RATE) : 0;

  const paper = findPaper(state.paperId) ?? null;
  const ribbon = findRibbon(state.ribbonId) ?? findRibbon(DEFAULT_RIBBON_ID)!;
  const addons = state.addonIds.map(findAddon).filter((a): a is AddonOption => !!a);

  const handTieFee = stemCount > 0 ? HAND_TIE_FEE : 0;
  const wrapping = stemCount > 0 ? (paper?.price ?? 0) + (paper ? ribbon.price : 0) : 0;
  const addonsTotal = stemCount > 0 ? addons.reduce((sum, a) => sum + a.price, 0) : 0;
  const total = stemCount > 0 ? flowersSubtotal - volumeDiscount + wrapping + addonsTotal + handTieFee : 0;

  const breakdown: QuoteLine[] = [];
  if (stemCount > 0) {
    breakdown.push({
      key: 'flowers',
      label: `Flowers · ${stemsLabel(stemCount, 'en')}`,
      labelAr: `الزهور · ${stemsLabel(stemCount, 'ar')}`,
      amount: flowersSubtotal,
    });
    if (volumeDiscount) {
      const pct = Math.round(VOLUME_DISCOUNT_RATE * 100);
      breakdown.push({ key: 'volume', label: `Volume saving · ${pct}%`, labelAr: `خصم الكمية · ${pct}%`, amount: -volumeDiscount });
    }
    if (paper) breakdown.push({ key: 'paper', label: paper.nameEn, labelAr: paper.nameAr, amount: paper.price });
    if (paper) {
      breakdown.push({ key: 'ribbon', label: `${ribbon.nameEn} ribbon`, labelAr: `شريط ${ribbon.nameAr}`, amount: ribbon.price });
    }
    for (const a of addons) breakdown.push({ key: `addon-${a.id}`, label: a.nameEn, labelAr: a.nameAr, amount: a.price });
    breakdown.push({ key: 'tie', label: 'Hand-tied & prepared', labelAr: 'تجهيز وربط الباقة', amount: handTieFee });
  }

  return {
    stemCount,
    stemLines,
    flowersSubtotal,
    volumeDiscount,
    paper,
    ribbon,
    addons,
    handTieFee,
    total,
    breakdown,
    stemsMissing: Math.max(0, MIN_STEMS - stemCount),
    stemsToSaving: stemCount > 0 ? Math.max(0, VOLUME_MIN_STEMS - stemCount) : 0,
  };
}

/** Whether a given step's requirements are met. */
export function isStepValid(id: StudioStepId, state: BouquetState): boolean {
  switch (id) {
    case 'flowers':
      return state.stems.length >= MIN_STEMS;
    case 'wrapping':
      return state.paperId !== null;
    case 'addons': {
      const wantsCard = state.addonIds.some((a) => findAddon(a)?.needsMessage);
      return !wantsCard || state.message.trim().length > 0;
    }
  }
}

// -------------------------------------------------------------------------------------
// Service
// -------------------------------------------------------------------------------------

/**
 * Single source of truth for the Studio. State is an immutable snapshot inside a `BehaviorSubject`;
 * every view (preview, pickers, calculator, stepper) subscribes to a derived stream, so they can
 * never disagree about what is in the bouquet.
 */
@Injectable({ providedIn: 'root' })
export class BouquetBuilderService {
  private readonly stateSubject = new BehaviorSubject<BouquetState>(INITIAL_BOUQUET_STATE);
  private nextUid = 1;

  readonly state$: Observable<BouquetState> = this.stateSubject.asObservable();

  readonly quote$: Observable<BouquetQuote> = this.state$.pipe(
    map(computeQuote),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  readonly steps$: Observable<readonly StepStatus[]> = this.state$.pipe(
    map((state) => {
      let priorValid = true;
      return STUDIO_STEPS.map((step): StepStatus => {
        const valid = isStepValid(step.id, state);
        const status: StepStatus = {
          step,
          active: state.step === step.id,
          valid,
          reachable: priorValid,
          done: valid && step.index < this.indexOf(state.step),
        };
        priorValid = priorValid && valid;
        return status;
      });
    }),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /** `true` when the current step may be left. */
  readonly canAdvance$: Observable<boolean> = this.state$.pipe(
    map((s) => isStepValid(s.step, s)),
    distinctUntilChanged(),
  );

  /** Synchronous snapshot, for event handlers. */
  get snapshot(): BouquetState {
    return this.stateSubject.value;
  }

  // ---- flowers -----------------------------------------------------------------------
  /** Adds a stem and finds it a spot automatically (the +/- buttons). */
  addStem(flowerId: string): void {
    if (!findStem(flowerId)) return;
    this.patch((s) => {
      if (s.stems.length >= MAX_STEMS) return s;
      const slot = pickAutoSlot(s.stems);
      return { ...s, stems: [...s.stems, stemOnSlot(this.nextUid++, flowerId, slot)] };
    });
  }

  /** Puts a stem exactly where the customer pointed (clamped to the open mouth of the paper). */
  placeStem(flowerId: string, x: number, y: number): void {
    if (!findStem(flowerId)) return;
    this.patch((s) => {
      if (s.stems.length >= MAX_STEMS) return s;
      const slot = lowestFreeSlot(s.stems);
      const at = clampToArea(x, y);
      return { ...s, stems: [...s.stems, { uid: this.nextUid++, flowerId, slot, ...at, rot: slotRotation(slot) }] };
    });
  }

  /** Drags one stem somewhere else; the others never move. */
  moveStem(uid: number, x: number, y: number): void {
    this.patch((s) => {
      const current = s.stems.find((e) => e.uid === uid);
      if (!current) return s;
      const at = clampToArea(x, y);
      if (at.x === current.x && at.y === current.y) return s;
      return { ...s, stems: s.stems.map((e) => (e.uid === uid ? { ...e, ...at } : e)) };
    });
  }

  removeStemByUid(uid: number): void {
    this.patch((s) => (s.stems.some((e) => e.uid === uid) ? { ...s, stems: s.stems.filter((e) => e.uid !== uid) } : s));
  }

  /** Replaces the flowers with a ready-made bouquet and pre-selects its paper and ribbon. */
  applyPreset(preset: StudioPreset): void {
    this.patch((s) => ({
      ...this.withRecipe(s, { size: preset.size, mainId: preset.mainId, secondId: preset.secondId, filler: preset.filler }),
      paperId: findPaper(preset.paperId) ? preset.paperId : s.paperId,
      ribbonId: findRibbon(preset.ribbonId) ? preset.ribbonId : s.ribbonId,
    }));
  }

  /** Shows a sensible bouquet straight away (25 red roses in black), so nobody starts from an empty page. */
  start(): void {
    this.patch((s) => {
      if (s.stems.length) return s;
      const withStems = this.withRecipe(s, DEFAULT_RECIPE);
      return { ...withStems, paperId: s.paperId ?? DEFAULT_PAPER_ID };
    });
  }

  /** Number of roses. */
  setSize(size: number): void {
    this.patch((s) => this.withRecipe(s, { ...(s.recipe ?? DEFAULT_RECIPE), size: Math.min(Math.max(size, 1), 100) }));
  }

  /** The main colour (a rose id). If it equals the second colour, the second one is dropped. */
  setMainColor(flowerId: string): void {
    if (findStem(flowerId)?.kind !== 'rose') return;
    this.patch((s) => {
      const r = s.recipe ?? DEFAULT_RECIPE;
      return this.withRecipe(s, { ...r, mainId: flowerId, secondId: r.secondId === flowerId ? null : r.secondId });
    });
  }

  /** The optional second colour, or `null` for a single-colour bouquet. */
  setSecondColor(flowerId: string | null): void {
    if (flowerId !== null && findStem(flowerId)?.kind !== 'rose') return;
    this.patch((s) => {
      const r = s.recipe ?? DEFAULT_RECIPE;
      return this.withRecipe(s, { ...r, secondId: flowerId === r.mainId ? null : flowerId });
    });
  }

  setFiller(on: boolean): void {
    this.patch((s) => this.withRecipe(s, { ...(s.recipe ?? DEFAULT_RECIPE), filler: on }));
  }

  /** Puts every stem back on its tidy spiral slot ("arrange for me"). */
  arrange(): void {
    this.patch((s) => ({ ...s, stems: s.stems.map((e) => stemOnSlot(e.uid, e.flowerId, e.slot)) }));
  }

  /** Removes the outermost stem of that flower, so the heart of the bouquet stays put. */
  removeStem(flowerId: string): void {
    this.patch((s) => {
      const mine = s.stems.filter((e) => e.flowerId === flowerId);
      if (!mine.length) return s;
      const outer = mine.reduce((a, b) => (b.slot > a.slot ? b : a));
      return { ...s, stems: s.stems.filter((e) => e.uid !== outer.uid) };
    });
  }

  // ---- wrapping ----------------------------------------------------------------------
  setPaper(paperId: string): void {
    if (findPaper(paperId)) this.patch((s) => ({ ...s, paperId }));
  }

  setRibbon(ribbonId: string): void {
    if (findRibbon(ribbonId)) this.patch((s) => ({ ...s, ribbonId }));
  }

  // ---- add-ons -----------------------------------------------------------------------
  toggleAddon(addonId: string): void {
    if (!findAddon(addonId)) return;
    this.patch((s) => ({
      ...s,
      addonIds: s.addonIds.includes(addonId) ? s.addonIds.filter((id) => id !== addonId) : [...s.addonIds, addonId],
    }));
  }

  setMessage(message: string): void {
    this.patch((s) => ({ ...s, message: message.slice(0, MESSAGE_MAX) }));
  }

  // ---- navigation --------------------------------------------------------------------
  goTo(step: StudioStepId): void {
    this.patch((s) => {
      const target = this.indexOf(step);
      // Every step before the target must be valid.
      const blocked = STUDIO_STEPS.slice(0, target).some((st) => !isStepValid(st.id, s));
      return blocked ? s : { ...s, step };
    });
  }

  next(): void {
    this.patch((s) => {
      const i = this.indexOf(s.step);
      const nextStep = STUDIO_STEPS[i + 1];
      return nextStep && isStepValid(s.step, s) ? { ...s, step: nextStep.id } : s;
    });
  }

  back(): void {
    this.patch((s) => {
      const prev = STUDIO_STEPS[this.indexOf(s.step) - 1];
      return prev ? { ...s, step: prev.id } : s;
    });
  }

  reset(): void {
    this.stateSubject.next(INITIAL_BOUQUET_STATE);
  }

  // ---- output ------------------------------------------------------------------------
  /** `true` when every step is valid, i.e. the bouquet can go to the bag. */
  get isComplete(): boolean {
    const s = this.snapshot;
    return s.stems.length > 0 && STUDIO_STEPS.every((st) => isStepValid(st.id, s));
  }

  /** Freezes the current composition into a bag line, or `null` while it is incomplete. */
  toBouquet(): CustomBouquet | null {
    if (!this.isComplete) return null;
    const state = this.snapshot;
    const quote = computeQuote(state);
    const hasCard = quote.addons.some((a) => a.needsMessage);

    const details = [
      ...quote.stemLines.map((l) => `${l.qty} × ${l.option.nameEn}`),
      `${quote.paper?.nameEn ?? 'Paper'} · ${quote.ribbon.nameEn} ribbon`,
      ...quote.addons.map((a) => a.nameEn),
    ];

    // Bag thumbnail colours: the three most numerous blooms, then the paper.
    const blooms = [...quote.stemLines].sort((a, b) => b.qty - a.qty).map((l) => l.option.primary);
    const swatches = [...blooms.slice(0, 3), quote.paper?.to ?? '#16161a'];

    const extras = quote.addons.length;
    const summary = [
      `${quote.stemCount} ${quote.stemCount === 1 ? 'stem' : 'stems'}`,
      quote.paper?.nameEn,
      extras ? `${extras} ${extras === 1 ? 'extra' : 'extras'}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    const detailsAr = [
      ...quote.stemLines.map((l) => `${l.qty} × ${l.option.nameAr}`),
      `${quote.paper?.nameAr ?? 'ورق'} · شريط ${quote.ribbon.nameAr}`,
      ...quote.addons.map((a) => a.nameAr),
    ];

    return {
      name: 'Atelier Bouquet',
      nameAr: 'باقة من تصميمك',
      unitPrice: quote.total,
      details,
      detailsAr,
      swatches,
      summary,
      message: hasCard ? state.message.trim() : null,
    };
  }

  // ---- internals ---------------------------------------------------------------------
  private withRecipe(s: BouquetState, recipe: BouquetRecipe): BouquetState {
    return { ...s, recipe, stems: composeStems(recipe) };
  }

  private patch(fn: (s: BouquetState) => BouquetState): void {
    const current = this.stateSubject.value;
    const next = fn(current);
    if (next !== current) this.stateSubject.next(next);
  }

  private indexOf(step: StudioStepId): number {
    return STUDIO_STEPS.findIndex((s) => s.id === step);
  }
}

/**
 * The order as a WhatsApp message for the shop (always Arabic, since that is what the florists read).
 * Built from the quote, so it can never disagree with the price on screen.
 */
export function orderMessage(state: BouquetState, quote: BouquetQuote): string {
  const roses = quote.stemLines.filter((l) => l.option.kind !== 'filler');
  const filler = quote.stemLines.find((l) => l.option.kind === 'filler');
  const roseCount = roses.reduce((sum, l) => sum + l.qty, 0);
  // WhatsApp renders *bold*; short sections with one emoji each read well on a phone.
  const lines = ['أهلاً سكاي فلاور 🌸', 'عايز أطلب باقة من تصميمي:', ''];
  lines.push(`🌹 *الباقة (${roseCount} وردة)*`);
  for (const l of roses) lines.push(`   ▫️ ${l.qty} ${l.option.nameAr}`);
  if (filler) lines.push(`   ▫️ جيبسوفيلا (${filler.qty})`);
  if (quote.paper) {
    lines.push('', '🎀 *التغليف*', `   ▫️ ${quote.paper.nameAr}`, `   ▫️ شريط ${quote.ribbon.nameAr}`);
  }
  if (quote.addons.length) {
    lines.push('', '🎁 *إضافات*');
    for (const a of quote.addons) lines.push(`   ▫️ ${a.nameAr}`);
  }
  const card = state.message.trim();
  if (card && quote.addons.some((a) => a.needsMessage)) {
    lines.push('', '💌 *كلمة البطاقة*', `   «${card}»`);
  }
  lines.push('', `💰 *السعر التقريبي: ${formatEgp(quote.total, 'ar')}*`);
  lines.push('', 'ممكن تأكدلي التفاصيل وميعاد التوصيل؟ 🙏');
  return lines.join('\n');
}

/** Convenience for templates/tests. */
export const formatQuoteAmount = (amount: number): string => (amount < 0 ? `− ${formatEgp(-amount)}` : formatEgp(amount));
