import { Order, SOURCE_LABEL, payMethodLabel, statusLabel } from './order.model';

const cell = (value: string | number | undefined): string => {
  const text = String(value ?? '');
  // A leading = + - @ would be run as a formula by Excel.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** The orders as CSV text (UTF-8 with a BOM so Excel shows Arabic properly). */
export function ordersCsv(orders: readonly Order[]): string {
  const header = ['رقم الطلب', 'التاريخ', 'العميل', 'الموبايل', 'المصدر', 'الحالة', 'التسليم', 'الفترة', 'العنوان', 'الطلب', 'رسوم التوصيل', 'الإجمالي', 'الدفع', 'طريقة الدفع'];
  const rows = orders.map((o) => [
    o.id,
    new Date(o.createdAt).toLocaleString('en-GB'),
    o.customerName,
    o.customerPhone,
    SOURCE_LABEL[o.source],
    statusLabel(o.status, o.mode),
    o.whenIso,
    o.slot,
    o.mode === 'pickup' ? 'استلام من المحل' : (o.address ?? ''),
    o.lines.map((l) => `${l.qty} × ${l.name}`).join(' + '),
    o.deliveryFee ?? 0,
    o.total,
    o.payStatus === 'paid' ? 'مدفوع' : 'لسه',
    payMethodLabel(o.payMethod),
  ]);
  return `\uFEFF${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`;
}

/** Hands a text file to the browser as a download. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
