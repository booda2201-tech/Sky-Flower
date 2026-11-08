import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommunityComponent } from '../community/community.component';
import { I18nService } from '../core/i18n.service';
import { MotionService } from '../core/motion.service';
import { HeroComponent } from '../hero/hero.component';
import { MomentsComponent } from '../moments/moments.component';
import { OccasionsComponent } from '../occasions/occasions.component';
import { ShowcaseComponent } from '../showcase/showcase.component';
import { BuildYourOwnComponent } from '../studio/build-your-own.component';

/** The storefront: hero, occasions, collections, community, moments, studio and the order teaser. */
@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [
    HeroComponent,
    OccasionsComponent,
    ShowcaseComponent,
    CommunityComponent,
    MomentsComponent,
    BuildYourOwnComponent,
  ],
  templateUrl: './home-page.component.html',
  styleUrl: './home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePageComponent {
  protected readonly i18n = inject(I18nService);
  private readonly motion = inject(MotionService);

  /** "Order your gift" always starts from the collection: pick a gift first, check out from the bag. */
  protected orderGift(event: Event): void {
    event.preventDefault();
    this.motion.scrollTo('#collections');
  }
}
