// What a receipt's money went to (same codes as the backend's Receipt model).
export const RECEIPT_CATEGORIES = [
  { key: 'hygiene', label: 'Hygiene' },
  { key: 'winter', label: 'Winter gear' },
  { key: 'other', label: 'Other supplies' },
  { key: 'operations', label: 'Operations', sub: 'Gas, bins, printing - not inventory' },
];

export function categoryLabel(key) {
  return RECEIPT_CATEGORIES.find((c) => c.key === key)?.label || (key ? key[0].toUpperCase() + key.slice(1) : 'Other');
}

// Quick picks for the store field; anything can be typed instead.
export const COMMON_STORES = ['Walmart', 'Dollar General', 'Target', 'Hy-Vee', 'Costco', "Sam's Club", 'Amazon', 'Temu'];

export function monthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function todayString() {
  const d = new Date();
  return `${monthKey(d)}-${String(d.getDate()).padStart(2, '0')}`;
}

export function formatDay(dateString) {
  const [y, m, d] = String(dateString).slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
