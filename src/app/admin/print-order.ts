import { dayLabel, egp } from './admin-format';
import { Order, SOURCE_LABEL, payMethodLabel, statusLabel } from './order.model';

const esc = (s: string | number | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

/** The order as a printable sheet: what the florist reads at the bench and the driver takes along. */
export function orderSheet(order: Order): string {
  const items = order.lines
    .map((l) => {
      const detail = l.details?.length ? `<small>${esc(l.details.join(' · '))}</small>` : '';
      const mark = l.kind === 'extra' ? '+ ' : '';
      return `<tr><td>${mark}${esc(l.qty)} × ${esc(l.name)}${detail}</td><td class="n">${esc(egp(l.qty * l.unitPrice))}</td></tr>`;
    })
    .join('');

  const when = order.whenIso ? `${dayLabel(order.whenIso)} · ${esc(order.slot)}` : 'الميعاد يتأكد مع العميل';
  const place =
    order.mode === 'pickup'
      ? 'استلام من المحل'
      : `${order.recipientName ? `المُستلِم: <b>${esc(order.recipientName)}</b><br>` : ''}${esc(order.address)}`;
  const paid = order.payStatus === 'paid' ? `مدفوع${order.payMethod ? ` (${esc(payMethodLabel(order.payMethod))})` : ''}` : 'لسه مدفوعش';

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(order.id)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;padding:18px;font:14px/1.6 Tahoma,Arial,sans-serif;color:#222}
  header{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #222;padding-bottom:8px;margin-bottom:12px}
  h1{margin:0;font:italic 26px Georgia,serif} .id{font-size:20px;font-weight:700}
  h2{margin:14px 0 4px;font-size:12px;letter-spacing:.04em;color:#666}
  table{width:100%;border-collapse:collapse} td{padding:5px 0;border-bottom:1px dashed #bbb;vertical-align:top} td.n{text-align:left;white-space:nowrap}
  small{display:block;color:#555} .card{margin-top:6px;padding:10px 12px;border:2px dashed #222;font-size:18px}
  .total{display:flex;justify-content:space-between;margin-top:10px;padding-top:8px;border-top:2px solid #222;font-size:18px;font-weight:700}
  .tag{display:inline-block;padding:1px 10px;border:1px solid #222;border-radius:99px;font-size:12px}
  @media print{body{padding:0}}
</style></head><body>
<header><h1>Sky Flower</h1><div class="id">${esc(order.id)}</div></header>
<p><span class="tag">${esc(statusLabel(order.status, order.mode))}</span> <span class="tag">${esc(SOURCE_LABEL[order.source])}</span> <span class="tag">${paid}</span></p>
<h2>العميل</h2><p><b>${esc(order.customerName)}</b>${order.customerPhone ? ` — <span dir="ltr">${esc(order.customerPhone)}</span>` : ''}</p>
<h2>${order.mode === 'pickup' ? 'الاستلام' : 'التوصيل'}</h2><p><b>${when}</b><br>${place}</p>
<h2>الطلب</h2><table>${items}</table>
${order.deliveryFee ? `<p>رسوم التوصيل: ${esc(egp(order.deliveryFee))}</p>` : ''}
<div class="total"><span>الإجمالي</span><span>${esc(egp(order.total))}</span></div>
${order.cardMessage ? `<h2>كلمة البطاقة${order.cardSign ? ` (من: ${esc(order.cardSign)})` : ''}</h2><div class="card">«${esc(order.cardMessage)}»</div>` : ''}
${order.notes ? `<h2>ملاحظات العميل</h2><p>${esc(order.notes)}</p>` : ''}
${order.internalNote ? `<h2>ملاحظات داخلية</h2><p>${esc(order.internalNote)}</p>` : ''}
</body></html>`;
}

/** Opens the sheet in a new window and starts printing. False when the browser blocked the window. */
export function printOrder(order: Order): boolean {
  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) return false;
  w.document.write(orderSheet(order));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
  return true;
}
