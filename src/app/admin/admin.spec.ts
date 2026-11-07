import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { CatalogService } from '../core/catalog.service';
import { StoreService } from '../core/store.service';
import { BRAND, whatsappLink } from '../data/brand';
import { FLOWER_PRODUCTS, unsplashSrcset, unsplashUrl } from '../data/flower-data';
import { findStem, resetStudioPrice, setStudioPrice, studioPriceRows } from '../data/studio-data';
import { AdminAuthService, DEMO_PASSWORD } from './admin-auth.service';
import { demoOrders } from './demo-orders';
import { buildCustomers } from './customers';
import { ordersCsv } from './export';
import { NewOrder, Order, advanceLabel, amountDue, customerUpdate, nextStatus, waNumber } from './order.model';
import { OrdersService } from './orders.service';
import { SettingsService } from './settings.service';

const sample: NewOrder = {
  source: 'site',
  customerName: 'منى أحمد',
  customerPhone: '01012345678',
  mode: 'delivery',
  address: 'طنطا',
  whenIso: '2026-11-08',
  slot: '2 م – 4 م',
  lines: [{ name: 'تاج فيريرو', qty: 1, unitPrice: 1450, kind: 'item' }],
  total: 1450,
};

describe('Orders', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('numbers new orders after the last one and starts them as "new"', () => {
    const orders = TestBed.inject(OrdersService);
    const a = orders.create(sample);
    const b = orders.create(sample);
    expect(a.status).toBe('new');
    expect(Number(b.id.replace(/\D/g, ''))).toBe(Number(a.id.replace(/\D/g, '')) + 1);
    expect(orders.newCount()).toBe(2);
  });

  it('moves an order through its steps and persists it', () => {
    const orders = TestBed.inject(OrdersService);
    const { id } = orders.create(sample);
    orders.setStatus(id, 'preparing');
    expect(orders.get(id)?.status).toBe('preparing');
    expect(JSON.parse(localStorage.getItem('sky-flower.orders.v1') ?? '[]')[0].status).toBe('preparing');
    TestBed.resetTestingModule();
    expect(TestBed.inject(OrdersService).get(id)?.status).toBe('preparing');
  });

  it('fills the demo once, and can clear and restore it without touching real orders', () => {
    const orders = TestBed.inject(OrdersService);
    orders.seedDemoOnce();
    expect(orders.orders().length).toBe(demoOrders().length);
    orders.seedDemoOnce();
    expect(orders.orders().length).toBe(demoOrders().length);

    orders.create(sample);
    orders.clearDemo();
    expect(orders.orders().length).toBe(1);
    expect(orders.hasDemo()).toBe(false);
    orders.restoreDemo();
    expect(orders.orders().length).toBe(demoOrders().length + 1);
  });

  it('knows the next step and the right wording for pick-up', () => {
    expect(nextStatus('new')).toBe('preparing');
    expect(nextStatus('done')).toBeNull();
    expect(nextStatus('cancelled')).toBeNull();
    expect(advanceLabel('preparing', 'pickup')).toBe('جاهز للاستلام');
    expect(advanceLabel('preparing', 'delivery')).toBe('خرج للتوصيل');
  });

  it('turns an Egyptian mobile number into a wa.me number', () => {
    expect(waNumber('01012345678')).toBe('201012345678');
    expect(waNumber('+20 101 234 5678')).toBe('201012345678');
    expect(waNumber('')).toBe('');
    expect(waNumber('123')).toBe('');
  });

  it('writes a status update that names the order', () => {
    const order = { ...sample, id: 'SF-1100', createdAt: 0, status: 'delivering' as const };
    expect(customerUpdate(order)).toContain('SF-1100');
    expect(customerUpdate(order)).toContain('منى');
  });
});

describe('Catalog overrides', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('changes the price the storefront sells at, and can restore it', () => {
    const catalog = TestBed.inject(CatalogService);
    const store = TestBed.inject(StoreService);
    const id = FLOWER_PRODUCTS[0].id;

    catalog.setPrice(id, 1600);
    expect(store.products.find((p) => p.id === id)?.price).toBe(1600);
    expect(catalog.isChanged(id)).toBe(true);

    catalog.reset(id);
    expect(store.products.find((p) => p.id === id)?.price).toBe(FLOWER_PRODUCTS[0].price);
    expect(catalog.isChanged(id)).toBe(false);
  });

  it('hides a product from the site but keeps it in the admin list', () => {
    const catalog = TestBed.inject(CatalogService);
    const store = TestBed.inject(StoreService);
    const id = FLOWER_PRODUCTS[1].id;

    catalog.setHidden(id, true);
    expect(store.products.some((p) => p.id === id)).toBe(false);
    expect(catalog.all().some((p) => p.id === id)).toBe(true);
  });

  it('ignores a nonsense price', () => {
    const catalog = TestBed.inject(CatalogService);
    catalog.setPrice(FLOWER_PRODUCTS[0].id, -5);
    catalog.setPrice(FLOWER_PRODUCTS[0].id, Number.NaN);
    expect(catalog.isChanged(FLOWER_PRODUCTS[0].id)).toBe(false);
  });
});

describe('Admin login', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.resetTestingModule();
  });

  it('only opens with the demo password', () => {
    const auth = TestBed.inject(AdminAuthService);
    expect(auth.login('wrong')).toBe(false);
    expect(auth.loggedIn()).toBe(false);
    expect(auth.login(DEMO_PASSWORD)).toBe(true);
    expect(auth.loggedIn()).toBe(true);
    auth.logout();
    expect(auth.loggedIn()).toBe(false);
  });
});

describe('Payments, fees and notes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('moves the total with the delivery fee, and tracks what is still owed', () => {
    const orders = TestBed.inject(OrdersService);
    const { id } = orders.create({ ...sample, total: 1450 });
    orders.setDeliveryFee(id, 40);
    expect(orders.get(id)?.total).toBe(1490);
    orders.setDeliveryFee(id, 60);
    expect(orders.get(id)?.total).toBe(1510);

    expect(amountDue(orders.get(id)!)).toBe(1510);
    orders.setPayment(id, 'paid', 'instapay');
    expect(amountDue(orders.get(id)!)).toBe(0);
    expect(orders.get(id)?.payMethod).toBe('instapay');
    orders.setPayment(id, 'unpaid', 'instapay');
    expect(orders.get(id)?.payMethod).toBeUndefined();

    orders.setStatus(id, 'cancelled');
    expect(amountDue(orders.get(id)!)).toBe(0);
  });

  it('keeps an internal note and can delete an order', () => {
    const orders = TestBed.inject(OrdersService);
    const { id } = orders.create(sample);
    orders.update(id, { internalNote: 'تصوير قبل التسليم' });
    expect(orders.get(id)?.internalNote).toBe('تصوير قبل التسليم');
    orders.remove(id);
    expect(orders.get(id)).toBeUndefined();
  });
});

describe('Customers', () => {
  const at = (id: string, phone: string, total: number, status: 'new' | 'cancelled' = 'new', createdAt = 1): Order => ({
    ...sample,
    id,
    customerPhone: phone,
    total,
    status,
    createdAt,
  });

  it('groups orders by phone however it is typed, and tags repeat and VIP customers', () => {
    const list = buildCustomers([
      at('SF-1', '01012345678', 500, 'new', 1),
      at('SF-2', '+20 101 234 5678', 600, 'new', 2),
      at('SF-3', '01099999999', 800, 'new', 3),
      at('SF-4', '01055555555', 6000, 'new', 4),
    ]);
    expect(list.length).toBe(3);
    const repeat = list.find((c) => c.key === '201012345678')!;
    expect(repeat.count).toBe(2);
    expect(repeat.spent).toBe(1100);
    expect(repeat.tag).toBe('repeat');
    expect(list.find((c) => c.key === '201099999999')!.tag).toBe('new');
    expect(list.find((c) => c.key === '201055555555')!.tag).toBe('vip');
  });

  it('ignores cancelled orders in the totals and orders with no phone', () => {
    const list = buildCustomers([at('SF-1', '01012345678', 500, 'cancelled'), at('SF-2', '', 900)]);
    expect(list.length).toBe(1);
    expect(list[0].count).toBe(0);
    expect(list[0].spent).toBe(0);
  });
});

describe('Admin-made products', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  const input = {
    nameAr: 'باقة العيد',
    descriptionAr: 'باقة كبيرة من الجوري الأحمر. مغلفة بالأسود.',
    price: 900,
    occasions: ['Romantic'] as const,
    imageId: 'data:image/jpeg;base64,AAAA',
    leadTime: 'Same-day delivery' as const,
    includesAr: ['جوري طازج', ' ', 'تغليف أسود'],
  };

  it('shows a new bouquet on the site, and edits and removes it', () => {
    const catalog = TestBed.inject(CatalogService);
    const store = TestBed.inject(StoreService);
    const added = catalog.addCustom({ ...input, occasions: [...input.occasions] });

    expect(store.products.some((p) => p.id === added.id)).toBe(true);
    expect(added.custom).toBe(true);
    expect(added.includesAr).toEqual(['جوري طازج', 'تغليف أسود']);
    expect(added.taglineAr).toBe('باقة كبيرة من الجوري الأحمر');

    catalog.updateCustom(added.id, { ...input, occasions: [...input.occasions], price: 950 });
    expect(store.products.find((p) => p.id === added.id)?.price).toBe(950);

    catalog.removeCustom(added.id);
    expect(store.products.some((p) => p.id === added.id)).toBe(false);
  });

  it('keeps a sold-out bouquet visible but out of the bag', () => {
    const catalog = TestBed.inject(CatalogService);
    const store = TestBed.inject(StoreService);
    const id = FLOWER_PRODUCTS[0].id;
    catalog.setSoldOut(id, true);

    const product = store.products.find((p) => p.id === id)!;
    expect(product.soldOut).toBe(true);
    store.add(product);
    expect(store.cartCount()).toBe(0);

    catalog.setSoldOut(id, false);
    store.add(store.products.find((p) => p.id === id)!);
    expect(store.cartCount()).toBe(1);
  });

  it('lets an uploaded photo or a web address through as the image', () => {
    expect(unsplashUrl('data:image/jpeg;base64,AAAA', 400)).toBe('data:image/jpeg;base64,AAAA');
    expect(unsplashUrl('https://example.com/a.jpg', 400)).toBe('https://example.com/a.jpg');
    expect(unsplashSrcset('data:image/jpeg;base64,AAAA', [400])).toBe('');
  });
});

describe('Studio prices', () => {
  beforeEach(() => {
    localStorage.clear();
    for (const row of studioPriceRows()) resetStudioPrice(row.kind, row.id);
  });

  it('changes what the studio charges, and puts it back', () => {
    const before = findStem('rose-red')!.price;
    setStudioPrice('stem', 'rose-red', before + 10);
    expect(findStem('rose-red')!.price).toBe(before + 10);
    expect(studioPriceRows().find((r) => r.id === 'rose-red')?.original).toBe(before);
    expect(JSON.parse(localStorage.getItem('sky-flower.studio-prices.v1') ?? '{}')['stem:rose-red']).toBe(before + 10);

    resetStudioPrice('stem', 'rose-red');
    expect(findStem('rose-red')!.price).toBe(before);
    expect(JSON.parse(localStorage.getItem('sky-flower.studio-prices.v1') ?? '{}')['stem:rose-red']).toBeUndefined();
  });

  it('ignores a nonsense price', () => {
    const before = findStem('rose-red')!.price;
    setStudioPrice('stem', 'rose-red', 0);
    setStudioPrice('stem', 'rose-red', Number.NaN);
    expect(findStem('rose-red')!.price).toBe(before);
  });
});

describe('Settings and backup', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('sends orders to the number the shop sets, and back to the default', () => {
    const settings = TestBed.inject(SettingsService);
    expect(whatsappLink()).toBe(`https://wa.me/${BRAND.whatsapp}`);
    expect(settings.setWhatsapp('01012345678')).toBe(true);
    expect(whatsappLink('hi')).toBe('https://wa.me/201012345678?text=hi');
    expect(settings.setWhatsapp('123')).toBe(false);
    expect(whatsappLink()).toBe('https://wa.me/201012345678');
    settings.resetWhatsapp();
    expect(whatsappLink()).toBe(`https://wa.me/${BRAND.whatsapp}`);
  });

  it('backs up and restores orders, and refuses a file that is not a backup', () => {
    const orders = TestBed.inject(OrdersService);
    const settings = TestBed.inject(SettingsService);
    const { id } = orders.create(sample);
    const backup = settings.exportBackup();

    localStorage.clear();
    expect(settings.importBackup('{"hello":1}')).toBe(false);
    expect(settings.importBackup('not json')).toBe(false);
    expect(settings.importBackup(backup)).toBe(true);
    TestBed.resetTestingModule();
    expect(TestBed.inject(OrdersService).get(id)?.customerName).toBe('منى أحمد');
  });

  it('does not put the customer bag in a backup', () => {
    localStorage.setItem('sky-flower.cart.v1', '[1]');
    localStorage.setItem('sky-flower.orders.v1', '[]');
    const keys = Object.keys(JSON.parse(TestBed.inject(SettingsService).exportBackup()).data);
    expect(keys).toContain('sky-flower.orders.v1');
    expect(keys).not.toContain('sky-flower.cart.v1');
  });

  it('exports orders as Excel-friendly CSV and defuses formulas', () => {
    const csv = ordersCsv([{ ...sample, id: 'SF-9', createdAt: 0, status: 'new', customerName: '=HYPERLINK("x")' }]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('SF-9');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
  });
});