import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { MotionService } from '../core/motion.service';
import { OccasionService } from '../core/occasion.service';
import { unsplashSrcset, unsplashUrl } from '../data/flower-data';
import { OCCASION_CARDS, OccasionCard, designsLabel, occasionCount } from '../data/occasion-data';
import { TiltDirective } from '../shared/tilt.directive';

/**
 * "Shop by occasion": tall portrait cards with a 3D tilt and a cursor-following glow.
 * Choosing one filters the catalogue below and scrolls to it.
 */
@Component({
  selector: 'app-occasions',
  standalone: true,
  imports: [TiltDirective],
  templateUrl: './occasions.component.html',
  styleUrl: './occasions.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OccasionsComponent {
  protected readonly i18n = inject(I18nService);
  private readonly occasion = inject(OccasionService);
  private readonly motion = inject(MotionService);

  protected readonly cards = OCCASION_CARDS.map((c, i) => ({
    ...c,
    no: String(i + 1).padStart(2, '0'),
    count: occasionCount(c.id),
  }));

  protected readonly img = (id: string): string => unsplashUrl(id, 560, 760);
  protected readonly srcset = (id: string): string => unsplashSrcset(id, [360, 560, 760], 1.36);

  protected countLabel(n: number): string {
    return designsLabel(n, this.i18n.lang());
  }

  protected open(card: OccasionCard, event: Event): void {
    event.preventDefault();
    this.occasion.select(card.id);
    this.motion.scrollTo('#collections-controls', -140);
  }
}
