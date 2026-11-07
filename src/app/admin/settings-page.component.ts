import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';
import { isoDay } from './admin-format';
import { downloadText } from './export';
import { SettingsService } from './settings.service';

/** `201557112803` -> `01557112803`, the way people write it. */
const local = (wa: string): string => (wa.startsWith('20') ? `0${wa.slice(2)}` : wa);

/** `/admin/settings` - the order number, the default delivery fee, and backup / restore. */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ad-head">
      <div>
        <h1>الإعدادات</h1>
        <p>الحاجات اللي بتتغير من غير ما تحتاج مبرمج.</p>
      </div>
    </header>

    <div class="ad-grid">
      <section class="ad-card">
        <h2>رقم واتساب الطلبات</h2>
        <p class="ad-muted">كل أزرار «اطلب على واتساب» في الموقع بتفتح على الرقم ده.</p>
        <label class="ad-field">
          <span>الرقم الحالي</span>
          <input type="tel" inputmode="tel" dir="ltr" [value]="numberInput()" (input)="numberInput.set(val($event))" placeholder="01xxxxxxxxx" />
        </label>
        @if (numberError()) {
          <em class="ad-err">{{ numberError() }}</em>
        }
        @if (numberSaved()) {
          <em class="ad-ok">اتحفظ. الموقع بيستخدم الرقم الجديد دلوقتي.</em>
        }
        <div class="ad-box__acts">
          <button type="button" class="ad-btn ad-btn--primary ad-btn--sm" (click)="saveNumber()">حفظ الرقم</button>
          <a class="ad-btn ad-btn--sm ad-btn--wa" [href]="'https://wa.me/' + settings.whatsapp()" target="_blank" rel="noopener">جرّب الرقم</a>
          @if (settings.isCustomWhatsapp()) {
            <button type="button" class="ad-btn ad-btn--sm" (click)="resetNumber()">رجّع الرقم الأصلي</button>
          }
        </div>
      </section>

      <section class="ad-card">
        <h2>رسوم التوصيل الافتراضية</h2>
        <p class="ad-muted">بتتحط تلقائي في الطلب الجديد، وتقدر تغيّرها في أي طلب.</p>
        <label class="ad-price ad-price--block">
          <input type="number" inputmode="numeric" min="0" step="1" [value]="settings.deliveryFee()" (change)="saveFee($event)" aria-label="رسوم التوصيل الافتراضية" />
          <span>ج.م</span>
        </label>
      </section>
    </div>

    <section class="ad-card">
      <h2>نسخة احتياطية</h2>
      <p class="ad-muted">
        كل الطلبات والباقات والأسعار متخزنة على المتصفح ده. نزّل نسخة تحتفظ بيها، أو ارجع نسخة قديمة (لو فتحت اللوحة من جهاز تاني).
      </p>
      <div class="ad-box__acts">
        <button type="button" class="ad-btn ad-btn--sm" (click)="backup()">تنزيل نسخة احتياطية</button>
        <label class="ad-btn ad-btn--sm">
          استرجاع من ملف
          <input type="file" accept="application/json,.json" hidden (change)="restore($event)" />
        </label>
      </div>
      @if (backupMessage()) {
        <em [class]="backupOk() ? 'ad-ok' : 'ad-err'">{{ backupMessage() }}</em>
      }
    </section>

    <section class="ad-card ad-only-phone">
      <h2>الحساب</h2>
      <div class="ad-box__acts">
        <a class="ad-btn ad-btn--sm" href="/" target="_blank" rel="noopener">عرض الموقع</a>
        <button type="button" class="ad-btn ad-btn--sm" (click)="logout()">تسجيل الخروج</button>
      </div>
    </section>

    <section class="ad-card ad-card--danger">
      <h2>مسح كل البيانات</h2>
      <p class="ad-muted">بيمسح الطلبات والباقات اللي ضفتها وتعديلات الأسعار والإعدادات، والموقع يرجع زي ما اتبنى. مفيش رجوع.</p>
      <button type="button" class="ad-btn ad-btn--danger ad-btn--sm" (click)="erase()">امسح كل حاجة</button>
    </section>
  `,
})
export class SettingsPageComponent {
  protected readonly settings = inject(SettingsService);
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected readonly numberInput = signal(local(this.settings.whatsapp()));
  protected readonly numberError = signal('');
  protected readonly numberSaved = signal(false);
  protected readonly backupMessage = signal('');
  protected readonly backupOk = signal(false);

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/admin/login');
  }

  protected saveNumber(): void {
    this.numberSaved.set(false);
    if (this.settings.setWhatsapp(this.numberInput())) {
      this.numberError.set('');
      this.numberInput.set(local(this.settings.whatsapp()));
      this.numberSaved.set(true);
    } else {
      this.numberError.set('اكتب رقم موبايل مصري صحيح، زي 01012345678.');
    }
  }

  protected resetNumber(): void {
    this.settings.resetWhatsapp();
    this.numberInput.set(local(this.settings.whatsapp()));
    this.numberError.set('');
    this.numberSaved.set(false);
  }

  protected saveFee(event: Event): void {
    const input = event.target as HTMLInputElement;
    const fee = Number(input.value);
    if (Number.isFinite(fee) && fee >= 0) this.settings.setDeliveryFee(fee);
    else input.value = String(this.settings.deliveryFee());
  }

  protected backup(): void {
    downloadText(`sky-flower-backup-${isoDay(Date.now())}.json`, this.settings.exportBackup(), 'application/json');
    this.backupOk.set(true);
    this.backupMessage.set('نزلت النسخة الاحتياطية.');
  }

  protected async restore(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const ok = this.settings.importBackup(await file.text());
    this.backupOk.set(ok);
    this.backupMessage.set(ok ? 'اتسترجعت النسخة. الصفحة بتتحدّث…' : 'الملف ده مش نسخة احتياطية من اللوحة.');
    if (ok) setTimeout(() => location.reload(), 800);
  }

  protected erase(): void {
    if (!confirm('تمسح كل بيانات اللوحة (الطلبات والباقات والأسعار والإعدادات)؟ مفيش رجوع.')) return;
    this.settings.eraseAll();
    location.reload();
  }
}
