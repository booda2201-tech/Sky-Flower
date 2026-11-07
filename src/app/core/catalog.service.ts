import { Injectable, computed, signal } from '@angular/core';
import { FLOWER_PRODUCTS, FlowerProduct, LeadTime, Occasion, ProductBadge } from '../data/flower-data';

const OVERRIDES_KEY = 'sky-flower.catalog.v1';
const CUSTOM_KEY = 'sky-flower.catalog.custom.v1';

/** What the shop changed on one of the built-in products. */
export interface ProductOverride {
  readonly price?: number;
  readonly hidden?: boolean;
  readonly soldOut?: boolean;
}

/** What the shop types when it adds (or edits) a bouquet of its own. */
export interface CustomProductInput {
  readonly nameAr: string;
  readonly nameEn?: string;
  readonly descriptionAr: string;
  readonly price: number;
  readonly occasions: readonly Occasion[];
  /** A `data:` URL (uploaded) or a web address. */
  readonly imageId: string;
  readonly badge?: ProductBadge;
  readonly leadTime: LeadTime;
  readonly includesAr: readonly string[];
}

/**
 * The catalogue the storefront sells from: the built-in products with the admin's changes applied,
 * plus the bouquets the shop added itself. Browser-only for the demo; the real version reads the same
 * shape from the API.
 */
@Injectable({ providedIn: 'root' })
export class CatalogService {
  readonly overrides = signal<Readonly<Record<string, ProductOverride>>>(this.readJson(OVERRIDES_KEY, {}));
  readonly customs = signal<readonly FlowerProduct[]>(this.readJson(CUSTOM_KEY, []));
  /** Set when the browser refused to save (usually a very large photo): changes last until reload. */
  readonly storageFull = signal(false);

  /** Every product, hidden ones included (the admin lists them all). */
  readonly all = computed<readonly FlowerProduct[]>(() =>
    [...FLOWER_PRODUCTS, ...this.customs()].map((p) => {
      const o = this.overrides()[p.id];
      if (!o) return p;
      const price = o.price !== undefined && o.price !== p.price ? o.price : p.price;
      const soldOut = o.soldOut === true || p.soldOut === true;
      return price === p.price && soldOut === (p.soldOut === true) ? p : { ...p, price, soldOut };
    }),
  );

  /** What customers see. */
  readonly visible = computed<readonly FlowerProduct[]>(() => this.all().filter((p) => !this.overrides()[p.id]?.hidden));

  isHidden(id: string): boolean {
    return !!this.overrides()[id]?.hidden;
  }

  isCustom(id: string): boolean {
    return this.customs().some((p) => p.id === id);
  }

  /** Something differs from the built-in product (a new price, hidden, sold out). */
  isChanged(id: string): boolean {
    const o = this.overrides()[id];
    if (!o) return false;
    const base = FLOWER_PRODUCTS.find((p) => p.id === id);
    return o.hidden === true || o.soldOut === true || (o.price !== undefined && o.price !== base?.price);
  }

  setPrice(id: string, price: number): void {
    if (!Number.isFinite(price) || price <= 0) return;
    this.patch(id, { price: Math.round(price) });
  }

  setHidden(id: string, hidden: boolean): void {
    this.patch(id, { hidden });
  }

  setSoldOut(id: string, soldOut: boolean): void {
    this.patch(id, { soldOut });
  }

  reset(id: string): void {
    const next = { ...this.overrides() };
    delete next[id];
    this.commitOverrides(next);
  }

  // ---- the shop's own bouquets ----------------------------------------------------------
  addCustom(input: CustomProductInput): FlowerProduct {
    const product = buildProduct(`cp-${Date.now().toString(36)}`, input);
    this.commitCustoms([...this.customs(), product]);
    return product;
  }

  updateCustom(id: string, input: CustomProductInput): void {
    this.commitCustoms(this.customs().map((p) => (p.id === id ? buildProduct(id, input) : p)));
  }

  removeCustom(id: string): void {
    this.commitCustoms(this.customs().filter((p) => p.id !== id));
    this.reset(id);
  }

  /** Back to the built-in six, with the original prices. */
  resetAll(): void {
    this.commitCustoms([]);
    this.commitOverrides({});
  }

  // ---- internals ------------------------------------------------------------------------
  private patch(id: string, change: ProductOverride): void {
    this.commitOverrides({ ...this.overrides(), [id]: { ...this.overrides()[id], ...change } });
  }

  private commitOverrides(next: Readonly<Record<string, ProductOverride>>): void {
    this.overrides.set(next);
    this.writeJson(OVERRIDES_KEY, next);
  }

  private commitCustoms(next: readonly FlowerProduct[]): void {
    this.customs.set(next);
    this.writeJson(CUSTOM_KEY, next);
  }

  private readJson<T>(key: string, fallback: T): T {
    try {
      const raw = globalThis.localStorage?.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  }

  private writeJson(key: string, value: unknown): void {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value));
      this.storageFull.set(false);
    } catch {
      this.storageFull.set(true);
    }
  }
}

/** A catalogue entry from the few things the shop types; the rest follows the built-ins' house style. */
function buildProduct(id: string, input: CustomProductInput): FlowerProduct {
  const nameEn = input.nameEn?.trim() || input.nameAr.trim();
  const description = input.descriptionAr.trim();
  const includes = input.includesAr.map((s) => s.trim()).filter(Boolean);
  return {
    id,
    slug: id,
    nameEn,
    nameAr: input.nameAr.trim(),
    taglineEn: description.split(/[.!؟\n]/)[0] || nameEn,
    taglineAr: description.split(/[.!؟\n]/)[0] || input.nameAr.trim(),
    descriptionEn: description,
    descriptionAr: description,
    price: Math.round(input.price),
    currency: 'EGP',
    imageId: input.imageId,
    imageAltId: input.imageId,
    accent: '#b5425b',
    tags: [],
    tagsAr: [],
    occasions: input.occasions,
    includes,
    includesAr: includes,
    badge: input.badge,
    leadTime: input.leadTime,
    custom: true,
  };
}
