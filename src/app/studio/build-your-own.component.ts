import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { Observable, combineLatest, map } from 'rxjs';
import { OrdersService } from '../admin/orders.service';
import {
  BouquetBuilderService,
  BouquetQuote,
  BouquetState,
  StepStatus,
  composeStems,
  orderMessage,
} from '../core/bouquet-builder.service';
import { I18nService } from '../core/i18n.service';
import { MotionService } from '../core/motion.service';
import { StoreService } from '../core/store.service';
import { formatEgp } from '../data/flower-data';
import { whatsappLink } from '../data/brand';
import {
  ADDON_ICON_PATHS,
  ADDON_OPTIONS,
  AddonOption,
  BouquetRecipe,
  DEFAULT_RECIPE,
  MESSAGE_MAX,
  MESSAGE_SUGGESTIONS,
  PAPER_OPTIONS,
  RIBBON_OPTIONS,
  SIZE_OPTIONS,
  STEM_OPTIONS,
  STUDIO_PRESETS,
  STUDIO_STEPS,
  StudioPreset,
  StudioStepId,
  findStem,
} from '../data/studio-data';
import { RevealChildrenDirective } from '../shared/reveal-children.directive';
import { BouquetPreviewComponent } from './bouquet-preview.component';
import { PriceCalculatorComponent } from './price-calculator.component';

/** A size card: the rose count with the price of those roses in the current colours. */
interface SizeCard {
  readonly count: number;
  readonly nameEn: string;
  readonly nameAr: string;
  readonly noteEn: string;
  readonly noteAr: string;
  readonly price: number;
}

/** Everything the template needs, emitted as one object so the view renders from a single snapshot. */
interface StudioVm {
  readonly state: BouquetState;
  readonly quote: BouquetQuote;
  readonly steps: readonly StepStatus[];
  /** What step one currently shows (the default recipe until the customer picks something). */
  readonly recipe: BouquetRecipe;
  readonly sizes: readonly SizeCard[];
  readonly activeIndex: number;
  readonly canAdvance: boolean;
  readonly isLast: boolean;
  readonly hint: string;
  readonly primaryLabel: string;
  readonly canPrimary: boolean;
  readonly messageRequired: boolean;
  /** The message-card add-on is selected, so the message editor is shown. */
  readonly wantsCard: boolean;
  /** `wa.me` link carrying the whole order, ready for the shop. */
  readonly whatsapp: string;
}

/** Price of the flowers a recipe works out to. */
const recipeCost = (recipe: BouquetRecipe): number =>
  composeStems(recipe).reduce((sum, s) => sum + (findStem(s.flowerId)?.price ?? 0), 0);

@Component({
  selector: 'app-build-your-own',
  standalone: true,
  imports: [
    AsyncPipe,
    BouquetPreviewComponent,
    PriceCalculatorComponent,
    RevealChildrenDirective,
  ],
  templateUrl: './build-your-own.component.html',
  styleUrl: './build-your-own.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BuildYourOwnComponent {
  private readonly builder = inject(BouquetBuilderService);
  private readonly store = inject(StoreService);
  private readonly motion = inject(MotionService);
  private readonly orders = inject(OrdersService);
  protected readonly i18n = inject(I18nService);

  /** The rose colours a customer can pick from. */
  protected readonly colors = STEM_OPTIONS.filter((s) => s.kind === 'rose');
  /** Ready-made starters with their colours and flower subtotal worked out once. */
  protected readonly presets = STUDIO_PRESETS.map((preset) => ({
    preset,
    price: recipeCost(preset),
    colors: [preset.mainId, preset.secondId]
      .map((id) => (id ? findStem(id)?.primary : undefined))
      .filter((c): c is string => !!c),
  }));
  protected readonly papers = PAPER_OPTIONS;
  protected readonly ribbons = RIBBON_OPTIONS;
  protected readonly addons = ADDON_OPTIONS;
  protected readonly suggestions = MESSAGE_SUGGESTIONS;
  protected readonly iconPaths = ADDON_ICON_PATHS;
  protected readonly stepList = STUDIO_STEPS;
  protected readonly messageMax = MESSAGE_MAX;
  protected readonly egp = formatEgp;

  protected readonly vm$: Observable<StudioVm> = combineLatest([
    this.builder.state$,
    this.builder.quote$,
    this.builder.steps$,
    // Re-derive the hint / button labels whenever the language changes.
    toObservable(this.i18n.lang),
  ]).pipe(map(([state, quote, steps]) => this.toViewModel(state, quote, steps)));

  constructor() {
    // Never show an empty bouquet: start from a sensible default the customer can change in a tap.
    this.builder.start();
  }

  // ---- template handlers ---------------------------------------------------------------
  protected pickSize(count: number): void {
    this.builder.setSize(count);
  }

  protected pickMain(id: string): void {
    this.builder.setMainColor(id);
  }

  protected pickSecond(id: string | null): void {
    this.builder.setSecondColor(id);
  }

  protected setFiller(on: boolean): void {
    this.builder.setFiller(on);
  }

  protected usePreset(preset: StudioPreset): void {
    this.builder.applyPreset(preset);
  }

  protected pickPaper(id: string): void {
    this.builder.setPaper(id);
  }

  protected pickRibbon(id: string): void {
    this.builder.setRibbon(id);
  }

  protected toggleAddon(id: string): void {
    this.builder.toggleAddon(id);
  }

  protected setMessage(value: string): void {
    this.builder.setMessage(value);
  }

  protected go(step: StudioStepId): void {
    this.builder.goTo(step);
  }

  protected back(): void {
    this.builder.back();
  }

  protected onPrimary(vm: StudioVm): void {
    if (vm.isLast) this.addToBag();
    else this.builder.next();
  }

  protected has(vm: StudioVm, addon: AddonOption): boolean {
    return vm.state.addonIds.includes(addon.id);
  }

  // ---- sending the order with a picture ------------------------------------------------
  /**
   * A WhatsApp link can only carry text, so the picture travels separately:
   *  - phones: the share sheet takes the picture and the text together (pick WhatsApp there);
   *  - computers: the picture is copied, WhatsApp opens on the shop's number, and a paste (Ctrl+V) attaches it;
   *  - anywhere neither works: the picture is downloaded instead.
   */
  protected prepareImage(vm: StudioVm): Promise<Blob | null> {
    if (this.image?.key !== vm.whatsapp) {
      this.image = { key: vm.whatsapp, blob: this.preview()?.toPng() ?? Promise.resolve(null) };
      this.imageNote.set(null);
    }
    return this.image.blob;
  }

  protected onOrder(event: Event, vm: StudioVm): void {
    if (vm.messageRequired) {
      event.preventDefault();
      return;
    }
    const blob = this.prepareImage(vm);
    this.saveOrder(vm);

    if (this.canShareFiles()) {
      event.preventDefault();
      void this.shareOrder(blob, vm);
      return;
    }
    // Must start inside the click, before the new tab takes focus. The link then opens WhatsApp as usual.
    void this.copyImage(blob);
  }

  /** Records the quick order for the shop's admin (once per distinct bouquet, however often the button is pressed). */
  private saveOrder(vm: StudioVm): void {
    if (this.savedKey === vm.whatsapp) return;
    const bouquet = this.builder.toBouquet();
    if (!bouquet) return;
    this.savedKey = vm.whatsapp;
    this.orders.create({
      source: 'studio',
      customerName: 'عميل من الأستوديو',
      customerPhone: '',
      mode: 'delivery',
      whenIso: '',
      slot: '',
      lines: [
        {
          name: bouquet.nameAr,
          qty: 1,
          unitPrice: bouquet.unitPrice,
          details: bouquet.detailsAr ?? bouquet.details,
          swatches: bouquet.swatches,
          kind: 'item',
        },
      ],
      cardMessage: bouquet.message ?? undefined,
      total: bouquet.unitPrice,
    });
  }

  private savedKey = '';
  private readonly preview = viewChild(BouquetPreviewComponent);
  protected readonly imageNote = signal<'copied' | 'saved' | null>(null);
  private image?: { readonly key: string; readonly blob: Promise<Blob | null> };

  private canShareFiles(): boolean {
    if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof matchMedia !== 'function') {
      return false;
    }
    return matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [new File([], 'a.png', { type: 'image/png' })] });
  }

  private async shareOrder(blob: Promise<Blob | null>, vm: StudioVm): Promise<void> {
    const png = await blob;
    const text = orderMessage(vm.state, vm.quote);
    try {
      if (png) {
        await navigator.share({ files: [new File([png], 'sky-flower-bouquet.png', { type: 'image/png' })], text });
      } else {
        window.open(vm.whatsapp, '_blank', 'noopener');
      }
    } catch (error) {
      // The customer closing the share sheet is fine; anything else falls back to the plain link.
      if ((error as DOMException)?.name !== 'AbortError') window.open(vm.whatsapp, '_blank', 'noopener');
    }
  }

  private async copyImage(blob: Promise<Blob | null>): Promise<void> {
    try {
      if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) throw new Error('no clipboard');
      const item = new ClipboardItem({ 'image/png': blob.then((b) => b ?? Promise.reject(new Error('no image'))) });
      await navigator.clipboard.write([item]);
      this.imageNote.set('copied');
    } catch {
      const png = await blob;
      if (!png) return;
      const url = URL.createObjectURL(png);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sky-flower-bouquet.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      this.imageNote.set('saved');
    }
  }

  protected readonly clearAll = (): void => {
    this.builder.reset();
    this.builder.start();
  };

  protected readonly inputValue = (event: Event): string => (event.target as HTMLTextAreaElement).value;

  // ---- internals -----------------------------------------------------------------------
  private addToBag(): void {
    const bouquet = this.builder.toBouquet();
    if (!bouquet) return;
    this.store.addCustom(bouquet);
    this.clearAll();
    this.motion.scrollTo('#studio');
  }

  private toViewModel(state: BouquetState, quote: BouquetQuote, steps: readonly StepStatus[]): StudioVm {
    const recipe = state.recipe ?? DEFAULT_RECIPE;
    const sizes = SIZE_OPTIONS.map((s): SizeCard => ({ ...s, price: recipeCost({ ...recipe, size: s.count }) }));
    const activeIndex = STUDIO_STEPS.findIndex((s) => s.id === state.step);
    const current = steps[activeIndex];
    const isLast = activeIndex === STUDIO_STEPS.length - 1;
    const wantsCard = quote.addons.some((a) => a.needsMessage);
    const messageRequired = wantsCard && state.message.trim().length === 0;
    const canAdvance = current?.valid ?? false;

    const i18n = this.i18n;
    let hint: string;
    switch (state.step) {
      case 'flowers':
        hint = i18n.t('byo.hint.recipe', { roses: String(recipe.size) });
        break;
      case 'wrapping':
        hint = quote.paper
          ? i18n.t('byo.hint.paper', {
              paper: i18n.pick(quote.paper.nameEn, quote.paper.nameAr),
              ribbon: i18n.isAr() ? quote.ribbon.nameAr : quote.ribbon.nameEn.toLowerCase(),
            })
          : i18n.t('byo.hint.choosePaper');
        break;
      default:
        hint = messageRequired ? i18n.t('byo.hint.writeCard') : i18n.t('byo.hint.ready');
    }

    return {
      state,
      quote,
      steps,
      recipe,
      sizes,
      activeIndex,
      canAdvance,
      isLast,
      hint,
      primaryLabel: isLast
        ? i18n.t('common.addToBag')
        : state.step === 'flowers'
          ? i18n.t('byo.next.wrapping')
          : i18n.t('byo.next.finishing'),
      canPrimary: canAdvance,
      messageRequired,
      wantsCard,
      whatsapp: whatsappLink(orderMessage(state, quote)),
    };
  }
}
