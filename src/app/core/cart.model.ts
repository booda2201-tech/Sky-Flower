/**
 * Shared cart types. A bag line is either a catalogue product (resolved by id) or a
 * bouquet composed in the Studio, which carries its own price and description.
 */

/** A bouquet composed in the "Build Your Own" studio, frozen at the moment it was added. */
export interface CustomBouquet {
  readonly name: string;
  readonly nameAr: string;
  /** Final price in whole EGP. */
  readonly unitPrice: number;
  /** Human-readable composition, one entry per line ("12 x Velvet Red Rose", "Obsidian paper"...). */
  readonly details: readonly string[];
  /** The same lines in Arabic (absent on bouquets saved before the Arabic launch). */
  readonly detailsAr?: readonly string[];
  /** Hex colours used to draw a thumbnail: the blooms first, the wrapping paper last. */
  readonly swatches: readonly string[];
  /** One-line recap for the bag ("26 stems · Ivory Linen · 6 extras"). Older saved bags may lack it. */
  readonly summary?: string;
  /** Gift-card message, when the card add-on was chosen. */
  readonly message: string | null;
}

/** What is persisted: `productId` is a catalogue id, or `custom-...` for a studio bouquet. */
export interface CartLine {
  readonly productId: string;
  readonly qty: number;
  readonly custom?: CustomBouquet;
}

/** A bag line with everything the UI needs to render it, whatever its origin. */
export interface ResolvedCartLine {
  readonly productId: string;
  readonly qty: number;
  readonly name: string;
  readonly nameAr: string;
  readonly unitPrice: number;
  /** Unsplash id for catalogue products. */
  readonly imageId?: string;
  readonly custom?: CustomBouquet;
}

/** Drives the "added to your bag" toast. */
export interface AddedNotice {
  readonly name: string;
  readonly nameAr?: string;
  readonly imageId?: string;
  readonly swatches?: readonly string[];
  readonly stamp: number;
}
