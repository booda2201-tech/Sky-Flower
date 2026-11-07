import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { BRAND, BRAND_SOCIALS, whatsappLink } from '../data/brand';

/**
 * "Our community": the brand's real social following and shop details.
 * All numbers and contacts come from `BRAND` / `BRAND_SOCIALS`, so nothing here is invented.
 */
@Component({
  selector: 'app-community',
  standalone: true,
  templateUrl: './community.component.html',
  styleUrl: './community.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityComponent {
  protected readonly i18n = inject(I18nService);

  protected readonly brand = BRAND;
  protected readonly socials = BRAND_SOCIALS;

  protected readonly whatsapp = (): string => whatsappLink(this.i18n.t('wa.hello'));
}
