import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { StemEntry } from '../core/bouquet-builder.service';
import { I18nService } from '../core/i18n.service';
import { AREA, GATHER_X, GATHER_Y, HEAD_X, Point, insideArea } from '../data/bouquet-geometry';
import { BloomKind, PaperOption, RibbonOption, StemOption, findStem } from '../data/studio-data';
import { BloomInDirective } from './bloom-in.directive';

interface Bloom {
  readonly uid: number;
  readonly kind: BloomKind;
  readonly x: number;
  readonly y: number;
  readonly transform: string;
  readonly c1: string;
  readonly c2: string;
  readonly stem: string;
  readonly name: string;
  /** Selection ring radius (the bloom's own size). */
  readonly ring: number;
  /** Drawing order: filler first, then blooms in the order they were placed (newest on top). */
  readonly order: number;
}

/** A pointer gesture that started on a bloom. */
interface DragState {
  readonly uid: number;
  readonly dx: number;
  readonly dy: number;
  readonly startX: number;
  readonly startY: number;
  moved: boolean;
}

export interface BloomMove {
  readonly uid: number;
  readonly x: number;
  readonly y: number;
}

/** Pointer travel (screen px) below which a press is a tap, not a drag. */
const TAP_SLOP = 5;
const KEY_STEP = 6;

interface Floret {
  readonly x: number;
  readonly y: number;
  readonly tone: 1 | 2;
}

const BLOOM_SCALE: Readonly<Record<BloomKind, number>> = {
  rose: 1.08,
  peony: 1.2,
  tulip: 1.04,
  hydrangea: 1.16,
  orchid: 1.08,
  filler: 0.9,
};

/** Evenly spaced angles in degrees. */
const ring = (n: number, offset = 0): readonly number[] => Array.from({ length: n }, (_, i) => offset + (360 / n) * i);

/** Hydrangea: a dome of florets - centre, inner ring, outer ring. */
const FLORETS: readonly Floret[] = [
  { x: 0, y: 0, tone: 2 },
  ...ring(6).map((a, i): Floret => ({ x: Math.cos((a * Math.PI) / 180) * 11, y: Math.sin((a * Math.PI) / 180) * 11, tone: i % 2 ? 1 : 2 })),
  ...ring(12, 15).map((a, i): Floret => ({ x: Math.cos((a * Math.PI) / 180) * 22, y: Math.sin((a * Math.PI) / 180) * 22, tone: i % 3 ? 1 : 2 })),
];

const FILLER: readonly { x: number; y: number; r: number }[] = [
  { x: 0, y: 0, r: 5 },
  { x: 9, y: -5, r: 4 },
  { x: -8, y: -8, r: 4.5 },
  { x: -10, y: 5, r: 4 },
  { x: 8, y: 9, r: 4.2 },
  { x: 1, y: -14, r: 3.6 },
  { x: 15, y: 2, r: 3.4 },
  { x: -16, y: -2, r: 3.4 },
];

/** The static look of the bouquet, for the exported PNG (keep in sync with the component styles). */
const EXPORT_CSS = `
  .c1 { fill: var(--c1); } .c2 { fill: var(--c2); }
  .petal { stroke: rgb(0 0 0 / 0.16); stroke-width: 0.7; }
  .soft { opacity: 0.5; }
  .swirl { fill: none; stroke: var(--c2); stroke-width: 1.6; stroke-linecap: round; }
  .vein { fill: none; stroke: rgb(255 255 255 / 0.32); stroke-width: 1.2; stroke-linecap: round; }
  .eye { fill: rgb(255 255 255 / 0.55); } .core { fill: #facc15; }
  .stems path { stroke: #2f6b4b; stroke-width: 2.6; opacity: 0.92; }
  .sheet { stroke: rgb(110 31 59 / 0.16); stroke-width: 1; }
  .sheet--back { filter: brightness(0.78); }
  .shade { fill: rgb(110 31 59 / 0.14); }
  .fold--r { fill: rgb(110 31 59 / 0.16); } .fold--l { fill: rgb(255 255 255 / 0.12); }
  .ribbon { fill: var(--rb); stroke: rgb(0 0 0 / 0.28); stroke-width: 0.8; }
  .knot { filter: brightness(0.86); }
  .ring { display: none; }
`;

/**
 * Live, resolution-independent bouquet illustration - and, in the flowers step, the canvas the
 * customer arranges it on:
 *  - tap an empty spot to place the armed flower there,
 *  - drag any bloom to move it, tap it to select it (then remove it),
 *  - arrow keys nudge the focused bloom, Delete removes it.
 * Colours come from CSS variables on each `<use>`, which lets six bloom shapes cover every flower.
 */
@Component({
  selector: 'app-bouquet-preview',
  standalone: true,
  imports: [BloomInDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg
      #svg
      class="bq"
      [class.is-interactive]="interactive()"
      [class.is-armed]="interactive() && !!armed()"
      [class.is-dragging]="dragging()"
      viewBox="0 0 400 540"
      [attr.role]="interactive() ? 'group' : 'img'"
      [attr.aria-label]="label()"
      preserveAspectRatio="xMidYMid meet"
      (pointerdown)="onDown($event)"
      (pointermove)="onMove($event)"
      (pointerup)="onUp($event)"
      (pointercancel)="onCancel()"
      (pointerleave)="ghost.set(null)"
    >
      <defs>
        <linearGradient id="sfb-paper" x1="0" y1="0" x2="0.35" y2="1">
          <stop offset="0" [attr.stop-color]="paper()?.from ?? '#ffffff'" />
          <stop offset="1" [attr.stop-color]="paper()?.to ?? '#ffffff'" />
        </linearGradient>
        <radialGradient id="sfb-shadow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#000" stop-opacity="0.55" />
          <stop offset="1" stop-color="#000" stop-opacity="0" />
        </radialGradient>

        <!-- ================= bloom shapes (drawn around 0,0, radius ~30) ================= -->
        <symbol id="sfb-rose" overflow="visible">
          <circle r="30" class="c2" />
          @for (a of ring6; track a) {
            <ellipse class="c1 petal" cx="0" cy="-16" rx="13" ry="15" [attr.transform]="'rotate(' + a + ')'" />
          }
          <circle r="15" class="c2 soft" />
          @for (a of ring5; track a) {
            <ellipse class="c1 petal" cx="0" cy="-8" rx="7.5" ry="9" [attr.transform]="'rotate(' + (a + 18) + ')'" />
          }
          <circle r="5" class="c2" />
          <path class="swirl" d="M0 -6c6-1 8 5 3 8-5 3-11-1-9-7 2-6 11-6 14 0" />
        </symbol>

        <symbol id="sfb-peony" overflow="visible">
          @for (a of ring8; track a) {
            <ellipse class="c1 petal" cx="0" cy="-19" rx="12" ry="14" [attr.transform]="'rotate(' + a + ')'" />
          }
          @for (a of ring8; track a) {
            <ellipse class="c2 petal soft" cx="0" cy="-12" rx="10.5" ry="12" [attr.transform]="'rotate(' + (a + 22.5) + ')'" />
          }
          @for (a of ring5; track a) {
            <ellipse class="c1 petal" cx="0" cy="-6" rx="7" ry="8.5" [attr.transform]="'rotate(' + a + ')'" />
          }
          <circle r="4" class="c2" />
        </symbol>

        <symbol id="sfb-tulip" overflow="visible">
          <path class="c2 petal" d="M-5 -30C-24 -22-26 2-3 16C-12-2-13-18-5-30Z" />
          <path class="c2 petal" d="M5 -30C24 -22 26 2 3 16C12-2 13-18 5-30Z" />
          <path class="c1 petal" d="M0 -36C16 -22 17 0 0 18C-17 0-16-22 0-36Z" />
          <path class="vein" d="M0 -28V8" />
        </symbol>

        <symbol id="sfb-hydrangea" overflow="visible">
          @for (f of florets; track $index) {
            <g [attr.transform]="'translate(' + f.x + ' ' + f.y + ')'">
              <circle r="8" [attr.class]="f.tone === 1 ? 'c1 petal' : 'c2 petal'" />
              <circle r="2.2" class="eye" />
            </g>
          }
        </symbol>

        <symbol id="sfb-orchid" overflow="visible">
          <ellipse class="c1 petal" cx="0" cy="-16" rx="9" ry="16" />
          <ellipse class="c1 petal" cx="0" cy="-15" rx="17" ry="12" transform="rotate(-78)" />
          <ellipse class="c1 petal" cx="0" cy="-15" rx="17" ry="12" transform="rotate(78)" />
          <ellipse class="c1 petal" cx="0" cy="-15" rx="8" ry="15" transform="rotate(150)" />
          <ellipse class="c1 petal" cx="0" cy="-15" rx="8" ry="15" transform="rotate(-150)" />
          <ellipse class="c2" cx="0" cy="7" rx="8" ry="10" />
          <circle r="3.6" cy="-2" class="core" />
        </symbol>

        <symbol id="sfb-filler" overflow="visible">
          @for (f of filler; track $index) {
            <circle class="c1 petal" [attr.cx]="f.x" [attr.cy]="f.y" [attr.r]="f.r" />
          }
        </symbol>
      </defs>

      <ellipse cx="200" cy="522" rx="96" ry="11" fill="url(#sfb-shadow)" />

      <g #sway class="bq__sway" [class.is-still]="interactive()">
        <!-- back sheet -->
        <path class="sheet sheet--back" [class.is-bare]="!paper()" d="M62 214Q200 150 338 214L266 508Q200 526 134 508Z" fill="url(#sfb-paper)" />
        <path class="shade" d="M62 214Q200 150 338 214L266 508Q200 526 134 508Z" />

        <!-- stems -->
        <g class="stems" fill="none" stroke-linecap="round">
          @for (b of blooms(); track b.uid) {
            <path [attr.d]="b.stem" />
          }
        </g>

        <!-- where blooms may be placed -->
        @if (interactive() && (armed() || !stems().length)) {
          <ellipse class="area" [attr.cx]="area.cx" [attr.cy]="area.cy" [attr.rx]="area.rx" [attr.ry]="area.ry" />
        }

        <!-- blooms -->
        @for (b of blooms(); track b.uid) {
          <g
            class="bloom"
            [class.is-selected]="selected() === b.uid"
            [attr.data-uid]="b.uid"
            [attr.transform]="b.transform"
            [attr.tabindex]="interactive() ? 0 : null"
            [attr.role]="interactive() ? 'button' : null"
            [attr.aria-label]="interactive() ? b.name : null"
            (keydown)="onKey($event, b)"
          >
            <circle class="ring" r="34" />
            <g appBloomIn>
              <use [attr.href]="'#sfb-' + b.kind" [style.--c1]="b.c1" [style.--c2]="b.c2" />
            </g>
          </g>
        }

        <!-- front sheet -->
        <path class="sheet sheet--front" [class.is-bare]="!paper()" d="M70 268Q135 292 200 334Q265 292 330 268L268 508Q200 526 132 508Z" fill="url(#sfb-paper)" />
        <path class="fold fold--r" d="M200 334Q218 424 192 516L268 508L330 268Q265 292 200 334Z" />
        <path class="fold fold--l" d="M70 268Q135 292 200 334L176 440Q150 380 70 268Z" />

        <!-- ribbon + bow -->
        @if (paper()) {
          <g class="ribbon" [style.--rb]="ribbon().color">
            <path d="M151 398Q200 414 249 398L252 418Q200 436 148 418Z" />
            <path d="M196 414Q180 442 168 470L186 461L192 476Q198 442 200 416Z" />
            <path d="M204 414Q220 442 232 470L214 461L208 476Q202 442 200 416Z" />
            <path d="M200 408C160 372 138 412 172 422C187 426 198 417 200 408Z" />
            <path d="M200 408C240 372 262 412 228 422C213 426 202 417 200 408Z" />
            <ellipse cx="200" cy="410" rx="9" ry="8" class="knot" />
          </g>
        }

        <!-- ghost of the flower about to be placed -->
        @if (ghostBloom(); as g) {
          <g class="ghost" [attr.transform]="g.transform">
            <use [attr.href]="'#sfb-' + g.kind" [style.--c1]="g.c1" [style.--c2]="g.c2" />
          </g>
        }

        <!-- selected bloom: remove button, kept upright and unscaled -->
        @if (selectedBloom(); as sb) {
          <g
            class="rm"
            data-rm
            role="button"
            tabindex="0"
            [attr.transform]="'translate(' + (sb.x + sb.ring * 0.78) + ' ' + (sb.y - sb.ring * 0.78) + ')'"
            [attr.aria-label]="i18n.t('byo.removeBloom')"
            (click)="removeSelected()"
            (keydown.enter)="removeSelected()"
            (keydown.space)="removeSelected(); $event.preventDefault()"
          >
            <title>{{ i18n.t('byo.removeBloom') }}</title>
            <circle r="12" />
            <path d="M-4.2 -4.2L4.2 4.2M4.2 -4.2L-4.2 4.2" />
          </g>
        }
      </g>
    </svg>
  `,
  styles: `
    :host { display: block; }
    .bq { display: block; width: 100%; height: auto; overflow: visible; }

    .c1 { fill: var(--c1); }
    .c2 { fill: var(--c2); }
    .petal { stroke: rgb(0 0 0 / 0.16); stroke-width: 0.7; }
    .soft { opacity: 0.5; }
    .swirl { fill: none; stroke: var(--c2); stroke-width: 1.6; stroke-linecap: round; }
    .vein { fill: none; stroke: rgb(255 255 255 / 0.32); stroke-width: 1.2; stroke-linecap: round; }
    .eye { fill: rgb(255 255 255 / 0.55); }
    .core { fill: #facc15; }

    .stems path { stroke: #2f6b4b; stroke-width: 2.6; opacity: 0.92; }

    .sheet { stroke: rgb(110 31 59 / 0.16); stroke-width: 1; pointer-events: none; }
    .sheet.is-bare { fill: rgb(181 66 91 / 0.06); stroke: rgb(181 66 91 / 0.4); stroke-dasharray: 5 6; }
    .sheet--back { filter: brightness(0.78); }
    .shade { fill: rgb(110 31 59 / 0.14); pointer-events: none; }
    .fold { pointer-events: none; }
    .fold--r { fill: rgb(110 31 59 / 0.16); }
    .fold--l { fill: rgb(255 255 255 / 0.12); }

    .ribbon { fill: var(--rb); stroke: rgb(0 0 0 / 0.28); stroke-width: 0.8; transition: fill 0.5s ease;
      .knot { filter: brightness(0.86); } }

    .bq__sway { transform-box: view-box; transform-origin: 50% 94%; animation: bq-sway 7s ease-in-out infinite alternate; }
    .bq__sway.is-still { animation: none; }
    @keyframes bq-sway { from { transform: rotate(-1.1deg); } to { transform: rotate(1.1deg); } }
    @media (prefers-reduced-motion: reduce) { .bq__sway { animation: none; } }

    /* ---- arranging ---- */
    .bq.is-interactive { user-select: none; -webkit-user-select: none; -webkit-tap-highlight-color: transparent; }
    .bq.is-armed { cursor: crosshair; }
    .bloom { outline: none; }
    .bq.is-interactive .bloom { cursor: grab; touch-action: none; }
    .bq.is-dragging, .bq.is-dragging .bloom { cursor: grabbing; }
    .ring { fill: none; stroke: #b5425b; stroke-width: 1.6; stroke-dasharray: 4 4; opacity: 0; transition: opacity 0.25s ease; pointer-events: none; }
    .bq.is-interactive .bloom:hover .ring { opacity: 0.45; }
    .bloom.is-selected .ring, .bloom:focus-visible .ring { opacity: 1; }
    .area { fill: rgb(181 66 91 / 0.05); stroke: rgb(181 66 91 / 0.5); stroke-width: 1.4; stroke-dasharray: 6 7; pointer-events: none; animation: bq-area 2.4s ease-in-out infinite alternate; }
    @keyframes bq-area { from { stroke-opacity: 0.35; } to { stroke-opacity: 1; } }
    .ghost { opacity: 0.55; pointer-events: none; }
    .rm { cursor: pointer; outline: none; }
    .rm circle { fill: #b5425b; stroke: #fff; stroke-width: 2; filter: drop-shadow(0 3px 6px rgb(110 31 59 / 0.4)); transition: fill 0.2s ease; }
    .rm path { fill: none; stroke: #fff; stroke-width: 2; stroke-linecap: round; }
    .rm:hover circle, .rm:focus-visible circle { fill: #8a2a4a; }
    @media (prefers-reduced-motion: reduce) { .area { animation: none; } }
  `,
})
export class BouquetPreviewComponent {
  protected readonly i18n = inject(I18nService);

  readonly stems = input.required<readonly StemEntry[]>();
  readonly paper = input<PaperOption | null>(null);
  readonly ribbon = input.required<RibbonOption>();
  /** The customer can arrange blooms (flowers step). */
  readonly interactive = input(false);
  /** The flower a tap on the bouquet will place. */
  readonly armed = input<StemOption | null>(null);

  readonly place = output<Point>();
  readonly move = output<BloomMove>();
  readonly remove = output<number>();

  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');
  private readonly sway = viewChild.required<ElementRef<SVGGElement>>('sway');

  protected readonly area = AREA;
  protected readonly selected = signal<number | null>(null);
  protected readonly ghost = signal<Point | null>(null);
  protected readonly dragging = signal(false);

  private drag: DragState | null = null;
  /** A press on empty canvas that becomes a placement if the pointer barely moves. */
  private pending: { readonly x: number; readonly y: number; readonly cx: number; readonly cy: number } | null = null;

  constructor() {
    // Leaving the flowers step (or losing the bloom) clears the selection.
    effect(() => {
      if (!this.interactive()) {
        this.selected.set(null);
        this.ghost.set(null);
      }
    });
  }

  protected readonly ring5 = ring(5);
  protected readonly ring6 = ring(6);
  protected readonly ring8 = ring(8);
  protected readonly florets = FLORETS;
  protected readonly filler = FILLER;

  protected readonly label = computed(() => {
    const n = this.stems().length;
    return n ? `Live preview of your bouquet with ${n} ${n === 1 ? 'stem' : 'stems'}` : 'Preview of your bouquet - add a flower to begin';
  });

  /** Blooms shrink a little as the bouquet fills up, so 100 roses still read as roses. */
  private readonly density = computed(() => {
    const n = this.stems().length;
    return n <= 36 ? 1 : Math.max(0.62, Math.sqrt(36 / n));
  });

  protected readonly blooms = computed<readonly Bloom[]>(() =>
    this.stems()
      .flatMap((entry): Bloom[] => {
        const flower = findStem(entry.flowerId);
        if (!flower) return [];
        const { x, y } = entry;
        const scale = BLOOM_SCALE[flower.kind] * this.density();
        const gx = GATHER_X + (x - HEAD_X) * 0.1;
        return [
          {
            uid: entry.uid,
            kind: flower.kind,
            x,
            y,
            transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${entry.rot}) scale(${scale})`,
            c1: flower.primary,
            c2: flower.secondary,
            stem: `M${x.toFixed(1)} ${y.toFixed(1)}Q${((x + gx) / 2).toFixed(1)} ${(y * 0.5 + GATHER_Y * 0.5).toFixed(1)} ${gx.toFixed(1)} ${GATHER_Y}`,
            name: this.i18n.t('byo.bloomAria', { name: this.i18n.pick(flower.nameEn, flower.nameAr) }),
            ring: 34 * scale,
            order: (flower.kind === 'filler' ? 0 : 1000) + entry.uid,
          },
        ];
      })
      .sort((a, b) => a.order - b.order),
  );

  protected readonly selectedBloom = computed(() => {
    const uid = this.selected();
    return uid === null ? undefined : this.blooms().find((b) => b.uid === uid);
  });

  protected readonly ghostBloom = computed(() => {
    const flower = this.armed();
    const at = this.ghost();
    if (!flower || !at || !this.interactive()) return null;
    return {
      kind: flower.kind,
      c1: flower.primary,
      c2: flower.secondary,
      transform: `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${BLOOM_SCALE[flower.kind]})`,
    };
  });

  /**
   * Draws the bouquet as a PNG (for sending with the order). The SVG is cloned together with the
   * few static rules it needs, since a standalone SVG image cannot see the component's stylesheet.
   */
  async toPng(width = 960): Promise<Blob | null> {
    const source = this.svg().nativeElement;
    const clone = source.cloneNode(true) as SVGSVGElement;
    clone.removeAttribute('class');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', '400');
    clone.setAttribute('height', '540');
    clone.querySelectorAll('.area, .ghost, .rm').forEach((el) => el.remove());
    const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    style.textContent = EXPORT_CSS;
    clone.prepend(style);

    const url = URL.createObjectURL(
      new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml;charset=utf-8' }),
    );
    try {
      const img = new Image();
      img.src = url;
      await img.decode();

      const height = Math.round((width * 540) / 400);
      const pad = Math.round(width * 0.06);
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height + pad * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;

      const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
      bg.addColorStop(0, '#fff8fa');
      bg.addColorStop(1, '#fce4ec');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, pad, pad * 0.6, width - pad * 2, ((width - pad * 2) * 540) / 400);

      ctx.fillStyle = '#8a2a4a';
      ctx.font = `italic ${Math.round(width * 0.04)}px Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Sky Flower', width / 2, canvas.height - pad * 0.55);

      return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    } catch {
      return null;
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  // ---- pointer handling ----------------------------------------------------------------
  protected onDown(e: PointerEvent): void {
    if (!this.interactive() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const target = e.target as Element;
    if (target.closest('[data-rm]')) return; // the remove button handles its own click

    const at = this.toSvg(e);
    const bloomEl = target.closest('[data-uid]');
    const uid = bloomEl ? Number(bloomEl.getAttribute('data-uid')) : NaN;
    const bloom = Number.isNaN(uid) ? undefined : this.blooms().find((b) => b.uid === uid);

    if (bloom) {
      this.drag = { uid, dx: bloom.x - at.x, dy: bloom.y - at.y, startX: e.clientX, startY: e.clientY, moved: false };
      this.svg().nativeElement.setPointerCapture(e.pointerId);
      this.ghost.set(null);
      return;
    }

    this.selected.set(null);
    this.pending = this.armed() && insideArea(at.x, at.y, 1.12) ? { x: at.x, y: at.y, cx: e.clientX, cy: e.clientY } : null;
  }

  protected onMove(e: PointerEvent): void {
    if (!this.interactive()) return;
    const drag = this.drag;
    if (drag) {
      if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > TAP_SLOP) {
        drag.moved = true;
        this.dragging.set(true);
      }
      if (drag.moved) {
        const at = this.toSvg(e);
        this.move.emit({ uid: drag.uid, x: at.x + drag.dx, y: at.y + drag.dy });
      }
      return;
    }
    if (this.armed() && e.pointerType !== 'touch') {
      const at = this.toSvg(e);
      this.ghost.set(insideArea(at.x, at.y) ? at : null);
    }
  }

  protected onUp(e: PointerEvent): void {
    const drag = this.drag;
    if (drag) {
      const el = this.svg().nativeElement;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      // a tap on a bloom toggles its selection; a drag leaves it selected
      this.selected.update((cur) => (drag.moved || cur !== drag.uid ? drag.uid : null));
      this.drag = null;
      this.dragging.set(false);
      return;
    }
    const pending = this.pending;
    this.pending = null;
    if (pending && Math.hypot(e.clientX - pending.cx, e.clientY - pending.cy) <= TAP_SLOP) {
      this.place.emit({ x: pending.x, y: pending.y });
    }
  }

  protected onCancel(): void {
    this.drag = null;
    this.pending = null;
    this.dragging.set(false);
  }

  protected onKey(e: KeyboardEvent, bloom: Bloom): void {
    if (!this.interactive()) return;
    const step = e.shiftKey ? KEY_STEP * 3 : KEY_STEP;
    const moves: Readonly<Record<string, readonly [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = moves[e.key];
    if (delta) {
      e.preventDefault();
      this.move.emit({ uid: bloom.uid, x: bloom.x + delta[0], y: bloom.y + delta[1] });
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.remove.emit(bloom.uid);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.selected.update((cur) => (cur === bloom.uid ? null : bloom.uid));
    }
  }

  protected removeSelected(): void {
    const uid = this.selected();
    if (uid === null) return;
    this.selected.set(null);
    this.remove.emit(uid);
  }

  /** Screen -> bouquet coordinates, through the swaying group so the answer stays exact. */
  private toSvg(e: { clientX: number; clientY: number }): Point {
    const matrix = this.sway().nativeElement.getScreenCTM();
    if (!matrix) return { x: HEAD_X, y: AREA.cy };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: p.x, y: p.y };
  }
}
