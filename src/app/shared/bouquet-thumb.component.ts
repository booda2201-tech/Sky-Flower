import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Tiny bouquet illustration for the bag and the toast, drawn from a studio bouquet's swatches:
 * every colour but the last is a bloom, the last one is the wrapping paper.
 */
@Component({
  selector: 'app-bouquet-thumb',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 60 76" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="uid" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0" [attr.stop-color]="paper()" />
          <stop offset="1" [attr.stop-color]="paper()" stop-opacity="0.72" />
        </linearGradient>
      </defs>
      <g stroke="#2f6b4b" stroke-width="1.6" stroke-linecap="round" fill="none">
        <path d="M22 28Q26 46 30 58M30 20V58M38 28Q34 46 30 58" />
      </g>
      @for (c of blooms(); track $index) {
        <g [attr.transform]="'translate(' + spots[$index % spots.length][0] + ' ' + spots[$index % spots.length][1] + ')'">
          <circle r="10.5" [attr.fill]="c" />
          <circle r="6.2" [attr.fill]="c" stroke="rgb(0 0 0 / .22)" stroke-width="0.8" />
          <circle r="2.4" fill="rgb(0 0 0 / .22)" />
        </g>
      }
      <path d="M8 38Q30 31 52 38L42 72Q30 75 18 72Z" [attr.fill]="'url(#' + uid + ')'" stroke="rgb(110 31 59 / .2)" stroke-width="0.8" />
      <path d="M30 44L18 72Q24 74 30 74Z" fill="rgb(0 0 0 / .2)" />
      <path d="M22 56Q30 60 38 56L38.5 61Q30 65 21.5 61Z" fill="#e0a96d" />
    </svg>
  `,
  styles: `
    :host { display: block; aspect-ratio: 60 / 76; border-radius: 1rem; overflow: hidden;
      background: radial-gradient(circle at 50% 30%, rgb(255 255 255 / 0.7), transparent 70%), #fce4ec;
      border: 1px solid rgb(224 169 109 / 0.3); }
    svg { display: block; width: 100%; height: 100%; }
  `,
})
export class BouquetThumbComponent {
  readonly swatches = input<readonly string[]>([]);

  private static counter = 0;
  protected readonly uid = `sf-thumb-${BouquetThumbComponent.counter++}`;
  protected readonly spots: readonly (readonly [number, number])[] = [
    [22, 26],
    [38, 25],
    [30, 15],
  ];

  protected readonly blooms = computed(() => {
    const colours = this.swatches();
    const blooms = colours.slice(0, -1);
    // Always paint three blooms so a one-flower bouquet still looks full.
    return [0, 1, 2].map((i) => blooms[i % Math.max(blooms.length, 1)] ?? '#e11d48');
  });

  protected readonly paper = computed(() => this.swatches().at(-1) ?? '#fce4ec');
}
