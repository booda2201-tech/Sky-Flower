import { Injectable, signal } from '@angular/core';
import { BRAND, SETTINGS_KEY, whatsappNumber } from '../data/brand';
import { waNumber } from './order.model';
import { SEEDED_KEY } from './orders.service';

const DEFAULT_FEE = 40;
const PREFIX = 'sky-flower.';
/** Kept out of backups: a customer's own bag and favourites are not the shop's data. */
const NOT_BACKED_UP = new Set(['sky-flower.cart.v1', 'sky-flower.wishlist.v1']);

interface Stored {
  whatsapp?: string;
  deliveryFee?: number;
}

/** The shop's own settings (order number, default delivery fee) plus backup / restore of everything the admin holds. */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  /** The number orders go to right now. */
  readonly whatsapp = signal(whatsappNumber());
  readonly deliveryFee = signal(this.read().deliveryFee ?? DEFAULT_FEE);

  /** True when the shop changed the number from the built-in default. */
  isCustomWhatsapp(): boolean {
    return this.whatsapp() !== BRAND.whatsapp;
  }

  /** Accepts `01012345678`, `+20 101 234 5678`... Returns false when it is not a mobile number. */
  setWhatsapp(input: string): boolean {
    const number = waNumber(input);
    if (!/^20\d{10}$/.test(number)) return false;
    this.write({ whatsapp: number });
    this.whatsapp.set(number);
    return true;
  }

  resetWhatsapp(): void {
    const stored = this.read();
    delete stored.whatsapp;
    this.save(stored);
    this.whatsapp.set(BRAND.whatsapp);
  }

  setDeliveryFee(fee: number): void {
    if (!Number.isFinite(fee) || fee < 0) return;
    const rounded = Math.round(fee);
    this.write({ deliveryFee: rounded });
    this.deliveryFee.set(rounded);
  }

  /** Everything the admin holds (orders, products, prices, settings) as one JSON text. */
  exportBackup(): string {
    const data: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX) && !NOT_BACKED_UP.has(key)) data[key] = JSON.parse(localStorage.getItem(key) ?? 'null');
      }
    } catch {
      /* storage unreadable: an empty backup */
    }
    return JSON.stringify({ app: 'sky-flower-admin', version: 1, savedAt: new Date().toISOString(), data }, null, 2);
  }

  /** Puts a backup back. Returns false (and changes nothing) when the file is not one of ours. */
  importBackup(text: string): boolean {
    try {
      const parsed = JSON.parse(text) as { app?: string; data?: Record<string, unknown> };
      if (parsed.app !== 'sky-flower-admin' || !parsed.data || typeof parsed.data !== 'object') return false;
      const entries = Object.entries(parsed.data).filter(([key]) => key.startsWith(PREFIX) && !NOT_BACKED_UP.has(key));
      for (const [key, value] of entries) localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }

  /** Wipes the admin's data (orders, products, prices, settings): the site goes back to how it was built. */
  eraseAll(): void {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(PREFIX) && !NOT_BACKED_UP.has(key)) keys.push(key);
      }
      for (const key of keys) localStorage.removeItem(key);
      // Erased means empty: do not re-fill the demo orders on the next visit.
      localStorage.setItem(SEEDED_KEY, '1');
    } catch {
      /* nothing to wipe */
    }
  }

  private write(patch: Stored): void {
    this.save({ ...this.read(), ...patch });
  }

  private save(value: Stored): void {
    try {
      globalThis.localStorage?.setItem(SETTINGS_KEY, JSON.stringify(value));
    } catch {
      /* settings last until reload */
    }
  }

  private read(): Stored {
    try {
      const raw = globalThis.localStorage?.getItem(SETTINGS_KEY);
      return raw ? (JSON.parse(raw) as Stored) : {};
    } catch {
      return {};
    }
  }
}
