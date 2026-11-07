import { ChangeDetectionStrategy, Component, OnInit, inject, input, output, signal } from '@angular/core';
import { CatalogService } from '../core/catalog.service';
import {
  BADGE_AR,
  FlowerProduct,
  LEAD_TIME_AR,
  LeadTime,
  OCCASION_FILTERS,
  Occasion,
  ProductBadge,
  unsplashUrl,
} from '../data/flower-data';
import { photoToDataUrl } from './image-utils';

const OCCASIONS = OCCASION_FILTERS.filter((f) => f.id !== 'All') as readonly { id: Occasion; labelAr: string }[];
const BADGES = Object.keys(BADGE_AR) as ProductBadge[];
const LEADS = Object.keys(LEAD_TIME_AR) as LeadTime[];

/** Add a bouquet to the site, or edit one the shop added. */
@Component({
  selector: 'app-product-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ad-scrim" (click)="closed.emit()"></div>
    <form class="ad-drawer ad-drawer--form" role="dialog" aria-modal="true" [attr.aria-label]="product() ? 'تعديل الباقة' : 'باقة جديدة'" data-lenis-prevent (submit)="save($event)">
      <header class="ad-drawer__head">
        <div>
          <h2>{{ product() ? 'تعديل الباقة' : 'باقة جديدة' }}</h2>
          <small>بتظهر في الموقع فورًا</small>
        </div>
        <button type="button" class="ad-x" (click)="closed.emit()" aria-label="إغلاق">×</button>
      </header>

      <div class="ad-drawer__body">
        <section>
          <h3>الصورة</h3>
          <div class="ad-photo">
            @if (image()) {
              <img [src]="preview(image())" alt="معاينة الباقة" />
            } @else {
              <span class="ad-photo__empty">لسه مفيش صورة</span>
            }
            <div class="ad-photo__acts">
              <label class="ad-btn ad-btn--sm">
                ارفع صورة
                <input type="file" accept="image/*" hidden (change)="upload($event)" />
              </label>
              <input class="ad-input" placeholder="أو الصق رابط صورة (https://…)" [value]="url()" (change)="setUrl($event)" dir="ltr" />
            </div>
            @if (photoError()) {
              <em class="ad-err">{{ photoError() }}</em>
            }
            @if (tried() && !image()) {
              <em class="ad-err">الصورة مطلوبة</em>
            }
          </div>
        </section>

        <section>
          <h3>البيانات</h3>
          <div class="ad-fields">
            <label class="ad-field">
              <span>الاسم بالعربي</span>
              <input [value]="nameAr()" (input)="nameAr.set(val($event))" />
              @if (tried() && !nameAr().trim()) {
                <em>مطلوب</em>
              }
            </label>
            <label class="ad-field">
              <span>الاسم بالإنجليزي (اختياري)</span>
              <input [value]="nameEn()" (input)="nameEn.set(val($event))" dir="ltr" />
            </label>
            <label class="ad-field">
              <span>السعر (ج.م)</span>
              <input type="number" inputmode="numeric" min="1" step="1" [value]="price()" (input)="price.set(val($event))" />
              @if (tried() && !(+price() > 0)) {
                <em>اكتب سعر صحيح</em>
              }
            </label>
            <label class="ad-field">
              <span>التسليم</span>
              <select (change)="lead.set($any($event.target).value)">
                @for (l of leads; track l) {
                  <option [value]="l" [selected]="lead() === l">{{ leadAr[l] }}</option>
                }
              </select>
            </label>
            <label class="ad-field ad-field--wide">
              <span>وصف الباقة</span>
              <textarea rows="3" [value]="description()" (input)="description.set(val($event))" placeholder="باقة كبيرة من الورد الأحمر…"></textarea>
              @if (tried() && !description().trim()) {
                <em>مطلوب</em>
              }
            </label>
            <label class="ad-field ad-field--wide">
              <span>محتويات الباقة (واحدة في كل سطر)</span>
              <textarea rows="3" [value]="includes()" (input)="includes.set(val($event))" placeholder="ورد جوري طازج&#10;تغليف أسود"></textarea>
            </label>
          </div>
        </section>

        <section>
          <h3>المناسبات</h3>
          <div class="ad-chips ad-chips--tight">
            @for (o of occasions; track o.id) {
              <button type="button" [class.is-on]="picked().has(o.id)" (click)="toggle(o.id)">{{ o.labelAr }}</button>
            }
          </div>
        </section>

        <section>
          <h3>شارة (اختياري)</h3>
          <div class="ad-chips ad-chips--tight">
            <button type="button" [class.is-on]="!badge()" (click)="badge.set(null)">بدون</button>
            @for (b of badges; track b) {
              <button type="button" [class.is-on]="badge() === b" (click)="badge.set(b)">{{ badgeAr[b] }}</button>
            }
          </div>
        </section>
      </div>

      <footer class="ad-drawer__foot">
        <button type="submit" class="ad-btn ad-btn--primary">{{ product() ? 'حفظ التعديلات' : 'إضافة للموقع' }}</button>
        <button type="button" class="ad-btn" (click)="closed.emit()">إلغاء</button>
      </footer>
    </form>
  `,
})
export class ProductFormComponent implements OnInit {
  /** The bouquet being edited; absent when adding. */
  readonly product = input<FlowerProduct | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  private readonly catalog = inject(CatalogService);

  protected readonly occasions = OCCASIONS;
  protected readonly badges = BADGES;
  protected readonly badgeAr = BADGE_AR;
  protected readonly leads = LEADS;
  protected readonly leadAr = LEAD_TIME_AR;
  protected readonly preview = (id: string): string => unsplashUrl(id, 400, 500);

  protected readonly image = signal('');
  protected readonly url = signal('');
  protected readonly nameAr = signal('');
  protected readonly nameEn = signal('');
  protected readonly price = signal('');
  protected readonly description = signal('');
  protected readonly includes = signal('');
  protected readonly lead = signal<LeadTime>('Same-day delivery');
  protected readonly picked = signal<ReadonlySet<Occasion>>(new Set());
  protected readonly badge = signal<ProductBadge | null>(null);
  protected readonly tried = signal(false);
  protected readonly photoError = signal('');

  /** Fills the form once the bouquet to edit is known. */
  ngOnInit(): void {
    const p = this.product();
    if (!p) return;
    this.image.set(p.imageId);
    this.url.set(/^https?:/.test(p.imageId) ? p.imageId : '');
    this.nameAr.set(p.nameAr);
    this.nameEn.set(p.nameEn === p.nameAr ? '' : p.nameEn);
    this.price.set(String(p.price));
    this.description.set(p.descriptionAr);
    this.includes.set(p.includesAr.join('\n'));
    this.lead.set(p.leadTime);
    this.picked.set(new Set(p.occasions));
    this.badge.set(p.badge ?? null);
  }

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected toggle(id: Occasion): void {
    this.picked.update((set) => {
      const next = new Set(set);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  protected async upload(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.photoError.set('');
    try {
      this.image.set(await photoToDataUrl(file));
      this.url.set('');
    } catch {
      this.photoError.set('الملف ده مش صورة. جرّب JPG أو PNG.');
    }
  }

  protected setUrl(event: Event): void {
    const value = this.val(event).trim();
    this.url.set(value);
    this.photoError.set('');
    if (!value) return;
    if (/^https?:\/\//i.test(value)) this.image.set(value);
    else this.photoError.set('الرابط لازم يبدأ بـ https://');
  }

  protected save(event: Event): void {
    event.preventDefault();
    this.tried.set(true);
    const price = Number(this.price());
    if (!this.image() || !this.nameAr().trim() || !this.description().trim() || !(price > 0)) return;

    const input = {
      nameAr: this.nameAr(),
      nameEn: this.nameEn(),
      descriptionAr: this.description(),
      price,
      occasions: [...this.picked()],
      imageId: this.image(),
      badge: this.badge() ?? undefined,
      leadTime: this.lead(),
      includesAr: this.includes().split('\n'),
    };
    const editing = this.product();
    if (editing) this.catalog.updateCustom(editing.id, input);
    else this.catalog.addCustom(input);
    this.saved.emit();
  }
}
