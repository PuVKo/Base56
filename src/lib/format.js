/** «1 заказ», «3 заказа», «11 заказов» */
export function formatOrderCountRu(n) {
  const count = Math.abs(Math.trunc(Number(n) || 0));
  if (count === 0) return '0 заказов';
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return `${count} заказов`;
  if (mod10 === 1) return `${count} заказ`;
  if (mod10 >= 2 && mod10 <= 4) return `${count} заказа`;
  return `${count} заказов`;
}

export function formatRub(amount) {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDateRu(isoDate) {
  if (!isoDate) return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

/** Компактно для плиток: `дд.мм` без года */
export function formatDateDdMm(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return '';
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dd}.${mm}`;
}

/** Таблица и короткий вывод: `дд.мм.гггг` */
export function formatDateDdMmYyyy(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  if (!y || !m || !d) return isoDate;
  const dd = String(d).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return `${dd}.${mm}.${y}`;
}
