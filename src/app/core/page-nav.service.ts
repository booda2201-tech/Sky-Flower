import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MotionService } from './motion.service';

/**
 * Moves between the two pages (home `/` and the order page `/order`).
 * Section links work from either page: from the order page they go home first, then scroll.
 */
@Injectable({ providedIn: 'root' })
export class PageNavService {
  private readonly router = inject(Router);
  private readonly motion = inject(MotionService);

  /** Scroll to a home-page section (`#collections`...), going home first when needed. */
  toHome(selector?: string): void {
    if (this.onHome()) {
      if (selector) this.scroll(selector);
      return;
    }
    void this.router.navigateByUrl('/').then(() => {
      // let the home sections render (and Lenis re-measure) before scrolling to one
      if (selector) setTimeout(() => this.scroll(selector), 500);
    });
  }

  /** The hero (`#top`) is pinned while you scroll, so its own position is not "the top": go to 0. */
  private scroll(selector: string): void {
    this.motion.scrollTo(selector === '#top' ? 0 : selector);
  }

  toOrder(): void {
    void this.router.navigateByUrl('/order');
  }

  private onHome(): boolean {
    return this.router.url.split(/[?#]/)[0] === '/';
  }
}
