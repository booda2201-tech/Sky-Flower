import { ChangeDetectionStrategy, Component, input } from '@angular/core';

let uid = 0;

/**
 * The Sky Flower mark: a layered bloom (outer, middle and inner petals, darker towards the heart)
 * with a small twinkle above it, next to the wordmark. Everything is drawn from the same few
 * petal shapes, so the mark is crisp at 24px and at 120px. The brand name is always Latin.
 *
 * `size` scales it (it is all in `em`): `sm` for the nav, `md` default, `lg` for footer/login.
 * `markOnly` drops the wordmark (favicon-style use).
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="lg" [class.lg--sm]="size() === 'sm'" [class.lg--lg]="size() === 'lg'">
      <svg class="lg__mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient [attr.id]="id + 'o'" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#f08aa6" />
            <stop offset="1" stop-color="#fcd0dc" />
          </linearGradient>
          <linearGradient [attr.id]="id + 'm'" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#d05875" />
            <stop offset="1" stop-color="#f4a3b9" />
          </linearGradient>
          <linearGradient [attr.id]="id + 'i'" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stop-color="#8a2a4a" />
            <stop offset="1" stop-color="#d05875" />
          </linearGradient>
        </defs>
        <g class="lg__bloom">
          @for (a of outer; track a) {
            <path [attr.transform]="'rotate(' + a + ' 32 33)'" [attr.fill]="'url(#' + id + 'o)'" [attr.d]="petal" />
          }
          @for (a of middle; track a) {
            <path
              [attr.transform]="'rotate(' + a + ' 32 33) translate(32 33) scale(.7) translate(-32 -33)'"
              [attr.fill]="'url(#' + id + 'm)'"
              [attr.d]="petal"
            />
          }
          @for (a of inner; track a) {
            <path
              [attr.transform]="'rotate(' + a + ' 32 33) translate(32 33) scale(.42) translate(-32 -33)'"
              [attr.fill]="'url(#' + id + 'i)'"
              [attr.d]="petal"
            />
          }
          <circle cx="32" cy="33" r="2" fill="#fff4f7" />
        </g>
        <path class="lg__star" d="M54 4.5l1.3 3.6 3.6 1.3-3.6 1.3L54 14.3l-1.3-3.6-3.6-1.3 3.6-1.3Z" />
      </svg>
      @if (!markOnly()) {
        <span class="lg__word"><span class="lg__sky">Sky</span><span class="lg__flower">Flower</span></span>
      }
    </span>
  `,
  styles: `
    :host {
      display: inline-flex;
    }
    $rose-soft: #d05875;
    $rose-ink: #8a2a4a;
    $ink: #3b2129;
    $ease: cubic-bezier(0.22, 1, 0.36, 1);

    .lg {
      --lg: 1.5rem; // wordmark size; the mark is 2x that
      // the brand name is Latin: it reads "mark - SKY FLOWER" on the RTL pages too
      direction: ltr;
      display: inline-flex;
      align-items: center;
      gap: calc(var(--lg) * 0.42);
      white-space: nowrap;
      line-height: 1;
      &--sm {
        --lg: 1.2rem;
      }
      &--lg {
        --lg: 2.1rem;
      }
    }
    .lg__mark {
      flex: none;
      width: calc(var(--lg) * 2);
      height: calc(var(--lg) * 2);
      overflow: visible;
      filter: drop-shadow(0 0.35em 0.45em rgb(138 42 74 / 0.22));
      font-size: 0.5rem;
    }
    .lg__bloom {
      transform-origin: 32px 33px;
      transition: transform 1.2s $ease;
    }
    :host(:hover) .lg__bloom {
      transform: rotate(36deg);
    }
    .lg__star {
      fill: $rose-soft;
      transform-origin: 54px 9px;
      animation: lg-twinkle 3.6s ease-in-out infinite;
    }
    .lg__word {
      display: inline-flex;
      align-items: baseline;
      gap: 0.32em;
      font-family: 'Cormorant Garamond', 'Times New Roman', serif;
      font-size: var(--lg);
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }
    .lg__sky {
      font-weight: 500;
      color: $ink;
    }
    .lg__flower {
      font-weight: 600;
      color: transparent;
      background: linear-gradient(100deg, $rose-soft, $rose-ink);
      -webkit-background-clip: text;
      background-clip: text;
      // keeps the last letter's spacing from clipping the gradient
      padding-inline-end: 0.12em;
      margin-inline-end: -0.12em;
    }
    @keyframes lg-twinkle {
      0%,
      100% {
        opacity: 0.95;
        transform: scale(1);
      }
      50% {
        opacity: 0.55;
        transform: scale(0.72) rotate(20deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .lg__star {
        animation: none;
      }
      .lg__bloom {
        transition: none;
      }
    }
  `,
})
export class LogoComponent {
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly markOnly = input(false);

  protected readonly id = `lgm${++uid}`;

  /** One teardrop petal pointing up from the heart (32,33). */
  protected readonly petal = 'M32 33C22.5 27.5 21.5 12 32 5.5 42.5 12 41.5 27.5 32 33Z';
  protected readonly outer = [0, 60, 120, 180, 240, 300];
  protected readonly middle = [30, 102, 174, 246, 318];
  protected readonly inner = [0, 90, 180, 270];
}
