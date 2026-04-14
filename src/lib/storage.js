const KEY = 'base56-bookings-v1';
const LEGACY_KEY = 'photocrm-bookings-v1';

/** @param {unknown[]} bookings */
export function saveBookings(bookings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(bookings));
  } catch {
    /* ignore quota */
  }
}

/** @returns {unknown[] | null} */
export function loadBookings() {
  try {
    let raw = localStorage.getItem(KEY);
    if (!raw) {
      raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        try {
          localStorage.setItem(KEY, raw);
        } catch {
          /* ignore */
        }
      }
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}
