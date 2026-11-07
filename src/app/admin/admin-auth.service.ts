import { Injectable, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

const KEY = 'sky-flower.admin.session';

/** Demo password, shown on the login page. The real login (accounts, server-side) replaces this. */
export const DEMO_PASSWORD = 'sky2026';

/** Just enough of a gate for the demo: it keeps the page out of casual view, it is not security. */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  readonly loggedIn = signal(this.stored());

  login(password: string): boolean {
    if (password.trim() !== DEMO_PASSWORD) return false;
    this.loggedIn.set(true);
    try {
      globalThis.sessionStorage?.setItem(KEY, '1');
    } catch {
      /* the session just lasts until reload */
    }
    return true;
  }

  logout(): void {
    this.loggedIn.set(false);
    try {
      globalThis.sessionStorage?.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }

  private stored(): boolean {
    try {
      return globalThis.sessionStorage?.getItem(KEY) === '1';
    } catch {
      return false;
    }
  }
}

export const adminGuard: CanActivateFn = () =>
  inject(AdminAuthService).loggedIn() ? true : inject(Router).parseUrl('/admin/login');
