import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CatalogService } from '../core/catalog.service';
import { FLOWER_PRODUCTS, FlowerProduct, unsplashUrl } from '../data/flower-data';
import {
  StudioPriceKind,
  StudioPriceRow,
  resetStudioPrice,
  setStudioPrice,
  studioPriceRows,
} from '../data/studio-data';
import { egp } from './admin-format';
import { ProductFormComponent } from './product-form.component';

type Tab = 'bouquets' | 'studio';

const GROUPS: readonly { readonly kind: StudioPriceKind; readonly title: string; readonly unit: string }[] = [
  { kind: 'stem', title: 'الورد (سعر الوردة)', unit: 'للوردة' },
  { kind: 'paper', title: 'ورق التغليف', unit: 'للباقة' },
  { kind: 'ribbon', title: 'الشريط', unit: 'للباقة' },
  { kind: 'addon', title: 'الإضافات', unit: 'للقطعة' },
];

/** `/admin/products` - the ready bouquets (prices, stock, your own bouquets) and the studio's per-rose prices. */
@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [ProductFormComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ad-head">
      <div>
        <h1>المنتجات</h1>
        <p>اللي بتغيّره هنا بيتحدّث في الموقع فورًا.</p>
      </div>
      @if (tab() === 'bouquets') {
        <div class="ad-head__actions">
          <button type="button" class="ad-btn ad-btn--primary" (click)="adding.set(true)">+ باقة جديدة</button>
        </div>
      }
    </header>

    <div class="ad-chips ad-chips--tabs" role="tablist">
      <button type="button" role="tab" [class.is-on]="tab() === 'bouquets'" (click)="tab.set('bouquets')">الباقات الجاهزة <b>{{ catalog.all().length }}</b></button>
      <button type="button" role="tab" [class.is-on]="tab() === 'studio'" (click)="tab.set('studio')">أسعار الأستوديو</button>
    </div>

    @if (catalog.storageFull()) {
      <p class="ad-alert" role="alert">مساحة التخزين في المتصفح اتملت (غالبًا من صور كبيرة). اللي عملته هيفضل لحد ما تقفل الصفحة. جرّب صور أصغر أو احذف باقات مش محتاجها.</p>
    }

    @if (tab() === 'bouquets') {
      <div class="ad-products">
        @for (p of catalog.all(); track p.id) {
          <article class="ad-product" [class.is-hidden]="catalog.isHidden(p.id)">
            <img [src]="thumb(p.imageId)" alt="" loading="lazy" />
            <div>
              <strong>
                {{ p.nameAr }}
                @if (p.custom) {
                  <span class="ad-src">من إضافتك</span>
                }
                @if (p.soldOut) {
                  <span class="ad-badge ad-badge--cancelled">الكمية خلصت</span>
                }
              </strong>
              <small>
                @if (p.custom) {
                  {{ occasionsText(p) }}
                } @else {
                  {{ p.nameEn }} · الأصلي {{ egp(original(p.id)) }}
                }
              </small>
            </div>
            @if (p.custom) {
              <span class="ad-price-fixed">{{ egp(p.price) }}</span>
            } @else {
              <label class="ad-price">
                <input type="number" inputmode="numeric" min="1" step="1" [value]="p.price" [attr.aria-label]="'سعر ' + p.nameAr" (change)="setPrice(p.id, $event)" />
                <span>ج.م</span>
              </label>
            }
            <div class="ad-product__acts">
              <label class="ad-switch">
                <input type="checkbox" [checked]="!catalog.isHidden(p.id)" (change)="catalog.setHidden(p.id, !checked($event))" />
                <i></i>
                <span>{{ catalog.isHidden(p.id) ? 'مخفي' : 'ظاهر في الموقع' }}</span>
              </label>
              <label class="ad-switch">
                <input type="checkbox" [checked]="!!p.soldOut" (change)="catalog.setSoldOut(p.id, checked($event))" />
                <i></i>
                <span>الكمية خلصت</span>
              </label>
              @if (p.custom) {
                <button type="button" class="ad-btn ad-btn--sm" (click)="editing.set(p)">تعديل</button>
                <button type="button" class="ad-btn ad-btn--sm ad-btn--danger" (click)="removeCustom(p)">حذف</button>
              } @else if (catalog.isChanged(p.id)) {
                <button type="button" class="ad-btn ad-btn--sm" (click)="catalog.reset(p.id)">رجّع الأصلي</button>
              }
            </div>
          </article>
        }
      </div>
    } @else {
      <p class="ad-note ad-note--top">
        سعر الوردة في الأستوديو بيتغيّر مع السوق. غيّره هنا، وأي عميل بيصمم باقة هيشوف السعر الجديد.
      </p>
      @for (g of groups; track g.kind) {
        <section class="ad-card ad-card--table">
          <h2>{{ g.title }}</h2>
          @for (r of rows(g.kind); track r.id) {
            <div class="ad-pricerow">
              <span>{{ r.nameAr }}</span>
              <small>{{ r.price !== r.original ? 'الأصلي ' + egp(r.original) : '' }}</small>
              <label class="ad-price">
                <input type="number" inputmode="numeric" min="1" step="1" [value]="r.price" [attr.aria-label]="'سعر ' + r.nameAr" (change)="setStudio(r, $event)" />
                <span>ج.م {{ g.unit }}</span>
              </label>
              @if (r.price !== r.original) {
                <button type="button" class="ad-btn ad-btn--sm" (click)="resetStudio(r)">رجّع</button>
              } @else {
                <span></span>
              }
            </div>
          }
        </section>
      }
    }

    <p class="ad-note">
      ده عرض تجريبي: التغييرات بتتحفظ على المتصفح ده بس. في النسخة الفعلية بتتحفظ على السيرفر وتظهر لكل الناس.
    </p>

    @if (adding()) {
      <app-product-form (closed)="adding.set(false)" (saved)="adding.set(false)" />
    }
    @if (editing(); as p) {
      <app-product-form [product]="p" (closed)="editing.set(null)" (saved)="editing.set(null)" />
    }
  `,
})
export class ProductsPageComponent {
  protected readonly catalog = inject(CatalogService);
  protected readonly egp = egp;
  protected readonly groups = GROUPS;
  protected readonly tab = signal<Tab>('bouquets');
  protected readonly adding = signal(false);
  protected readonly editing = signal<FlowerProduct | null>(null);

  /** Bumped after each studio price change, so the table re-reads the (mutable) option lists. */
  private readonly studioVersion = signal(0);
  private readonly allRows = computed(() => {
    this.studioVersion();
    return studioPriceRows();
  });

  protected readonly thumb = (id: string): string => unsplashUrl(id, 160, 200);
  protected readonly original = (id: string): number => FLOWER_PRODUCTS.find((p) => p.id === id)?.price ?? 0;
  protected readonly rows = (kind: StudioPriceKind): StudioPriceRow[] => this.allRows().filter((r) => r.kind === kind);
  protected readonly occasionsText = (p: FlowerProduct): string => p.occasions.join(' · ') || 'بدون مناسبة';

  protected checked(event: Event): boolean {
    return (event.target as HTMLInputElement).checked;
  }

  protected setPrice(id: string, event: Event): void {
    const input = event.target as HTMLInputElement;
    const price = Number(input.value);
    if (Number.isFinite(price) && price > 0) this.catalog.setPrice(id, price);
    else input.value = String(this.catalog.all().find((p) => p.id === id)?.price ?? '');
  }

  protected removeCustom(p: FlowerProduct): void {
    if (confirm(`حذف «${p.nameAr}» من الموقع نهائيًا؟`)) this.catalog.removeCustom(p.id);
  }

  protected setStudio(row: StudioPriceRow, event: Event): void {
    const input = event.target as HTMLInputElement;
    const price = Number(input.value);
    if (Number.isFinite(price) && price > 0) setStudioPrice(row.kind, row.id, price);
    else input.value = String(row.price);
    this.studioVersion.update((n) => n + 1);
  }

  protected resetStudio(row: StudioPriceRow): void {
    resetStudioPrice(row.kind, row.id);
    this.studioVersion.update((n) => n + 1);
  }
}
