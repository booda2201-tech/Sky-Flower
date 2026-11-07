import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService, DEMO_PASSWORD } from './admin-auth.service';

/** `/admin/login` - the demo gate. The password is shown on purpose: this is a preview, not a lock. */
@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 100svh;
      padding: 1.5rem;
      background:
        radial-gradient(40vmax 40vmax at 90% 5%, rgb(208 88 117 / 0.16), transparent 70%),
        linear-gradient(180deg, #fbf6f0, #fff5f8);
      font-family: var(--font-sans);
      color: #3b2129;
    }
    .box {
      display: grid;
      gap: 1rem;
      width: min(100%, 24rem);
      padding: 2rem 1.8rem;
      border: 1px solid rgb(181 66 91 / 0.18);
      border-radius: 1.8rem;
      background: rgb(255 255 255 / 0.9);
      box-shadow: 0 30px 70px -40px rgb(110 31 59 / 0.6);
      text-align: center;
    }
    .brand { margin: 0; font-family: var(--font-display); font-size: 2.2rem; line-height: 1; }
    .brand em { font-style: italic; color: #d05875; }
    h1 { margin: 0; font-size: 1rem; font-weight: 500; color: rgb(59 33 41 / 0.7); }
    input {
      padding: 0.85rem 1.1rem;
      border: 1px solid rgb(181 66 91 / 0.25);
      border-radius: 999px;
      font: inherit;
      text-align: center;
      color: inherit;
    }
    input:focus { outline: 2px solid rgb(181 66 91 / 0.4); outline-offset: 1px; }
    button {
      padding: 0.85rem 1.1rem;
      border: 0;
      border-radius: 999px;
      background: linear-gradient(135deg, #c84b69, #8a2a4a);
      font: inherit;
      font-weight: 600;
      color: #fff;
      cursor: pointer;
    }
    .err { margin: 0; font-size: 0.82rem; color: #b3261e; }
    .hint { margin: 0; padding: 0.6rem 0.8rem; border-radius: 0.9rem; background: #fff4d6; font-size: 0.78rem; color: #7a5400; }
    .hint b { direction: ltr; unicode-bidi: embed; }
    a { font-size: 0.8rem; color: rgb(59 33 41 / 0.6); }
  `,
  template: `
    <form class="box" dir="rtl" lang="ar" (submit)="submit($event)">
      <p class="brand">Sky<em> Flower</em></p>
      <h1>دخول لوحة التحكم</h1>
      <input
        type="password"
        name="password"
        autocomplete="current-password"
        placeholder="كلمة السر"
        aria-label="كلمة السر"
        [value]="password()"
        (input)="password.set(val($event))"
      />
      @if (failed()) {
        <p class="err" role="alert">كلمة السر غلط.</p>
      }
      <button type="submit">دخول</button>
      <p class="hint">نسخة تجريبية — كلمة السر: <b>{{ demo }}</b></p>
      <a routerLink="/">← الرجوع للموقع</a>
    </form>
  `,
})
export class AdminLoginComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  protected readonly demo = DEMO_PASSWORD;
  protected readonly password = signal('');
  protected readonly failed = signal(false);

  protected val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected submit(event: Event): void {
    event.preventDefault();
    if (this.auth.login(this.password())) void this.router.navigateByUrl('/admin');
    else this.failed.set(true);
  }
}
