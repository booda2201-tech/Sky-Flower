import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { StoreService } from '../core/store.service';
import { FLOWER_PRODUCTS } from '../data/flower-data';
import { GiftOrderComponent } from './gift-order.component';

function setup() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({ matches: false, media: query, addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {} }),
  });
  localStorage.clear();
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(GiftOrderComponent);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const store = TestBed.inject(StoreService);
  const click = (selector: string, index = 0): void => {
    (root.querySelectorAll(selector)[index] as HTMLElement).click();
    fixture.detectChanges();
  };
  const fill = (el: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
    el.value = value;
    el.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };
  return { fixture, root, store, click, fill };
}

describe('GiftOrderComponent', () => {
  it('shows an empty state with no send button while the bag is empty', () => {
    const { root } = setup();
    expect(root.querySelector('.go__empty')).toBeTruthy();
    expect(root.querySelector('.go__send')).toBeNull();
  });

  it('adds extras and the message card to the estimated total', () => {
    const { fixture, root, store, click, fill } = setup();
    const product = FLOWER_PRODUCTS[0];
    store.add(product);
    fixture.detectChanges();
    const total = (): string => root.querySelector('.go__total b')?.textContent ?? '';
    const before = total();

    click('.go__extra', 0);
    expect(total()).not.toBe(before);

    fill(root.querySelector('textarea[placeholder]') as HTMLTextAreaElement, 'Happy birthday');
    expect(root.querySelector('.go__lines--extras')?.textContent).toBeTruthy();
    expect(root.querySelector('.go__sign')).toBeTruthy();
  });

  it('refuses to send until the required fields are filled, then opens WhatsApp with the order', () => {
    const { fixture, root, store, click, fill } = setup();
    store.add(FLOWER_PRODUCTS[0]);
    fixture.detectChanges();
    const open = vi.spyOn(window, 'open').mockReturnValue(null);

    click('.go__send');
    expect(open).not.toHaveBeenCalled();
    expect(root.querySelectorAll('[aria-invalid="true"]').length).toBeGreaterThan(0);

    // fill everything the form needs
    click('.go__chip', 1); // tomorrow
    click('.go__slot', 0);
    const grid = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('.go__grid input, .go__grid textarea');
    fill(grid[0], 'Ahmed');
    fill(grid[1], '01012345678');
    fill(grid[2], 'Sara');
    fill(grid[4], 'Tanta, Street 1');

    click('.go__send');
    expect(open).toHaveBeenCalledTimes(1);
    const url = decodeURIComponent(String(open.mock.calls[0][0]));
    expect(url).toContain('wa.me/');
    expect(url).toContain(FLOWER_PRODUCTS[0].nameAr);
    expect(url).toContain('Tanta, Street 1');
    expect(root.querySelector('.go__sent')).toBeTruthy();
    open.mockRestore();
  });

  it('does not ask for an address on pick-up', () => {
    const { root, click } = setup();
    click('.go__mode button', 1);
    expect(root.querySelectorAll('.go__grid textarea').length).toBe(0);
  });
});
