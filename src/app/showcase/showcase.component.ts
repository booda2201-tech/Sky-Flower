import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import { OccasionService } from '../core/occasion.service';
import { MessageKey } from '../core/messages';
import { StoreService } from '../core/store.service';
import {
  BADGE_AR,
  LEAD_TIME_AR,
  FlowerProduct,
  OCCASION_FILTERS,
  Occasion,
  formatEgp,
  formatNumber,
  unsplashSrcset,
  unsplashUrl,
} from '../data/flower-data';
import { DeckDirective } from '../shared/deck.directive';
import { MagneticDirective } from '../shared/magnetic.directive';
import { TiltDirective } from '../shared/tilt.directive';

type SortKey = 'featured' | 'price-asc' | 'price-desc';

interface SortOption {
  readonly id: SortKey;
  readonly label: MessageKey;
}

@Component({
  selector: 'app-showcase',
  standalone: true,
  imports: [DeckDirective, MagneticDirective, TiltDirective],
  templateUrl: './showcase.component.html',
  styleUrl: './showcase.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShowcaseComponent {
  protected readonly store = inject(StoreService);
  protected readonly i18n = inject(I18nService);

  protected readonly filters = OCCASION_FILTERS;
  protected readonly sorts: readonly SortOption[] = [
    { id: 'featured', label: 'sort.featured' },
    { id: 'price-asc', label: 'sort.priceAsc' },
    { id: 'price-desc', label: 'sort.priceDesc' },
  ];

  protected readonly activeFilter = inject(OccasionService).selected;
  protected readonly activeSort = signal<SortKey>('featured');

  /** Number of products per filter, shown inside the chips. */
  protected readonly counts = computed(() => {
    const products = this.store.products;
    const map = new Map<string, number>([['All', products.length]]);
    for (const f of this.filters) {
      if (f.id !== 'All') map.set(f.id, products.filter((p) => p.occasions.includes(f.id as Occasion)).length);
    }
    return map;
  });

  protected readonly visible = computed<readonly FlowerProduct[]>(() => {
    const filter = this.activeFilter();
    const list = this.store.products.filter((p) => filter === 'All' || p.occasions.includes(filter));
    switch (this.activeSort()) {
      case 'price-asc':
        return [...list].sort((a, b) => a.price - b.price);
      case 'price-desc':
        return [...list].sort((a, b) => b.price - a.price);
      default:
        return list;
    }
  });

  protected readonly badgeAr = BADGE_AR;
  protected readonly leadTimeAr = LEAD_TIME_AR;
  protected readonly formatEgp = formatEgp;
  protected readonly formatNumber = formatNumber;
  protected readonly img = (id: string, w: number): string => unsplashUrl(id, w, Math.round(w * 1.25));
  protected readonly srcset = (id: string): string => unsplashSrcset(id, [420, 640, 860]);

  /** Product whose details panel is open (one at a time, accordion style). */
  protected readonly openId = signal<string | null>(null);

  protected toggleDetails(id: string): void {
    this.openId.update((cur) => (cur === id ? null : id));
  }

  protected setFilter(id: Occasion | 'All'): void {
    this.activeFilter.set(id);
  }

  protected setSort(id: SortKey): void {
    this.activeSort.set(id);
  }
}
