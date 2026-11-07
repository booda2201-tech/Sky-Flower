import { formatEgp } from '../data/flower-data';

const DAY = 86_400_000;

/** Money in the admin is always Arabic: `1,850 ج.م`. */
export const egp = (value: number): string => formatEgp(value, 'ar');

export const startOfDay = (t: number): number => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const isoDay = (t: number): string => {
  const d = new Date(t);
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const parseIso = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
};

/** `اليوم`, `بكرة`, or `الجمعة 14 نوفمبر`. Empty when the day is not set. */
export function dayLabel(iso: string, now = Date.now()): string {
  if (!iso) return '';
  const diff = Math.round((parseIso(iso) - startOfDay(now)) / DAY);
  if (diff === 0) return 'النهارده';
  if (diff === 1) return 'بكرة';
  if (diff === -1) return 'امبارح';
  return new Date(parseIso(iso)).toLocaleDateString('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' });
}

/** Egyptian Arabic count: "ساعة", "ساعتين", "5 ساعات", "12 ساعة". */
function plural(n: number, one: string, two: string, few: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  return `${n} ${n <= 10 ? few : one}`;
}

/** `دلوقتي`, `من 5 دقايق`, `من 3 ساعات`, or the date. */
export function timeAgo(t: number, now = Date.now()): string {
  const minutes = Math.floor((now - t) / 60_000);
  if (minutes < 1) return 'دلوقتي';
  if (minutes < 60) return `من ${plural(minutes, 'دقيقة', 'دقيقتين', 'دقايق')}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `من ${plural(hours, 'ساعة', 'ساعتين', 'ساعات')}`;
  return new Date(t).toLocaleDateString('ar-EG-u-nu-latn', { day: 'numeric', month: 'long' });
}

export const clock = (t: number): string =>
  new Date(t).toLocaleTimeString('ar-EG-u-nu-latn', { hour: 'numeric', minute: '2-digit' });
