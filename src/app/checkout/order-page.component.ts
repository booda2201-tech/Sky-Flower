import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../core/i18n.service';
import { BRAND } from '../data/brand';
import { GiftOrderComponent } from './gift-order.component';

/** `/order` - the dedicated page for finishing an order (date, card, extras, details, WhatsApp). */
@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [GiftOrderComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-page.component.html',
  styleUrl: './order-page.component.scss',
})
export class OrderPageComponent {
  protected readonly i18n = inject(I18nService);
  protected readonly brand = BRAND;
}
