import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { FlowerProduct } from '../data/flower-data';
import { AddedNotice, CartLine, CustomBouquet, ResolvedCartLine } from './cart.model';
import { CatalogService } from './catalog.service';

const CART_KEY = 'sky-flower.cart.v1';
const WISH_KEY = 'sky-flower.wishlist.v1';
const MAX_QTY = 9;

/**
 * Tiny client-side store (signals): catalogue, bag and wishlist.
 * Bag and wishlist survive reloads through localStorage.
 */
@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly catalog = inject(CatalogService);

  /** What the site sells: the built-in catalogue with the admin's prices, minus hidden products. */
  get products(): readonly FlowerProduct[] {
    return this.catalog.visible();
  }

  readonly cart = signal<readonly CartLine[]>(this.read<CartLine[]>(CART_KEY, []));
  readonly wishlist = signal<ReadonlySet<string>>(new Set(this.read<string[]>(WISH_KEY, [])));
  readonly cartOpen = signal(false);
  /** The most recent add-to-bag, drives the toast. */
  readonly lastAdded = signal<AddedNotice | null>(null);

  readonly cartLines = computed<readonly ResolvedCartLine[]>(() =>
    this.cart().flatMap((line): ResolvedCartLine[] => {
      if (line.custom) {
        return [
          {
            productId: line.productId,
            qty: line.qty,
            name: line.custom.name,
            nameAr: line.custom.nameAr,
            unitPrice: line.custom.unitPrice,
            custom: line.custom,
          },
        ];
      }
      // Hidden products stay resolvable, so a bag filled earlier does not lose a line.
      const product = this.catalog.all().find((p) => p.id === line.productId);
      return product
        ? [
            {
              productId: line.productId,
              qty: line.qty,
              name: product.nameEn,
              nameAr: product.nameAr,
              unitPrice: product.price,
              imageId: product.imageId,
            },
          ]
        : [];
    }),
  );
  readonly cartCount = computed(() => this.cart().reduce((n, l) => n + l.qty, 0));
  readonly cartTotal = computed(() => this.cartLines().reduce((sum, l) => sum + l.unitPrice * l.qty, 0));

  constructor() {
    effect(() => this.write(CART_KEY, this.cart()));
    effect(() => this.write(WISH_KEY, [...this.wishlist()]));
  }

  add(product: FlowerProduct, qty = 1): void {
    if (product.soldOut) return;
    this.cart.update((lines) => {
      const existing = lines.find((l) => l.productId === product.id);
      return existing
        ? lines.map((l) => (l.productId === product.id ? { ...l, qty: Math.min(MAX_QTY, l.qty + qty) } : l))
        : [...lines, { productId: product.id, qty }];
    });
    this.lastAdded.set({ name: product.nameEn, nameAr: product.nameAr, imageId: product.imageId, stamp: Date.now() });
  }

  /** Adds a studio-composed bouquet as its own line (every composition is unique). */
  addCustom(bouquet: CustomBouquet): void {
    const productId = `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    this.cart.update((lines) => [...lines, { productId, qty: 1, custom: bouquet }]);
    this.lastAdded.set({ name: bouquet.name, nameAr: bouquet.nameAr, swatches: bouquet.swatches, stamp: Date.now() });
  }

  changeQty(productId: string, delta: number): void {
    this.cart.update((lines) =>
      lines
        .map((l) => (l.productId === productId ? { ...l, qty: Math.min(MAX_QTY, l.qty + delta) } : l))
        .filter((l) => l.qty > 0),
    );
  }

  remove(productId: string): void {
    this.cart.update((lines) => lines.filter((l) => l.productId !== productId));
  }

  toggleWish(productId: string): void {
    this.wishlist.update((set) => {
      const next = new Set(set);
      if (!next.delete(productId)) next.add(productId);
      return next;
    });
  }

  isWished(productId: string): boolean {
    return this.wishlist().has(productId);
  }

  // ---- persistence (guarded: private mode / SSR / jsdom quirks) -------------------------
  private read<T>(key: string, fallback: T): T {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private write(key: string, value: unknown): void {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable - the store keeps working in memory */
    }
  }
}
