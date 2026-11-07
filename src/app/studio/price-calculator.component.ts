import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { BouquetQuote, formatQuoteAmount } from '../core/bouquet-builder.service';
import { I18nService } from '../core/i18n.service';
import { VOLUME_DISCOUNT_RATE, VOLUME_MIN_STEMS } from '../data/studio-data';
import { formatEgp } from '../data/flower-data';
import { CountUpDirective } from '../shared/count-up.directive';
import { MagneticDirective } from '../shared/magnetic.directive';

/**
 * Floating glass price bar. Presentational: the studio feeds it the live quote and reacts to its
 * events. Every figure rolls with GSAP (`appCountUp`), including the breakdown lines.
 */
@Component({
  selector: 'app-price-calculator',
  standalone: true,
  imports: [CountUpDirective, MagneticDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pc backdrop-blur-xl" [class.is-open]="open()">
      <!-- breakdown popover -->
      <div class="pc__panel" [attr.aria-hidden]="!open()" [attr.inert]="open() ? null : ''" id="pc-panel">
        <p class="pc__panel-title">{{ i18n.t('pc.title') }}</p>
        @if (quote().breakdown.length) {
          <ul class="pc__lines">
            @for (line of quote().breakdown; track line.key) {
              <li [class.is-saving]="line.amount < 0">
                <span>{{ i18n.pick(line.label, line.labelAr) }}</span>
                <b [appCountUp]="line.amount" [countFormat]="signed" [countDuration]="0.7"></b>
              </li>
            }
          </ul>
        } @else {
          <p class="pc__empty">{{ i18n.t('pc.empty') }}</p>
        }

        @if (quote().stemCount > 0 && quote().stemsToSaving > 0) {
          <div class="pc__nudge">
            <span>
              {{ i18n.t('pc.nudge.a') }} <b>{{ quote().stemsToSaving }}</b>
              {{ i18n.t('pc.nudge.b', { unit: i18n.stemUnit(quote().stemsToSaving), pct: saving }) }}
            </span>
            <i aria-hidden="true"><em [style.width.%]="(quote().stemCount / volumeMin) * 100"></em></i>
          </div>
        } @else if (quote().volumeDiscount > 0) {
          <p class="pc__nudge pc__nudge--ok">{{ i18n.t('pc.unlocked', { amount: signed(-quote().volumeDiscount) }) }}</p>
        }
      </div>

      <!-- main bar -->
      <div class="pc__bar">
        <button type="button" class="pc__back" [disabled]="!canBack()" (click)="back.emit()" [attr.aria-label]="i18n.t('pc.prev')">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        </button>

        <button type="button" class="pc__total" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-controls="pc-panel">
          <small>{{ i18n.t('pc.total') }}</small>
          <b [appCountUp]="quote().total" aria-live="polite" aria-atomic="true"></b>
          <svg class="pc__chev" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
        </button>

        <p class="pc__hint" [class.is-ready]="canPrimary()">{{ hint() }}</p>

        <button type="button" class="pc__primary" appMagnetic="0.25" [disabled]="!canPrimary()" (click)="primary.emit()">
          {{ primaryLabel() }}
        </button>
      </div>
    </div>
  `,
  styleUrl: './price-calculator.component.scss',
})
export class PriceCalculatorComponent {
  protected readonly i18n = inject(I18nService);

  readonly quote = input.required<BouquetQuote>();
  readonly hint = input('');
  readonly primaryLabel = input('Continue');
  readonly canPrimary = input(false);
  readonly canBack = input(false);

  readonly back = output<void>();
  readonly primary = output<void>();

  protected readonly open = signal(false);
  protected readonly signed = formatQuoteAmount;
  protected readonly egp = formatEgp;
  protected readonly saving = Math.round(VOLUME_DISCOUNT_RATE * 100);
  protected readonly volumeMin = VOLUME_MIN_STEMS;
}
