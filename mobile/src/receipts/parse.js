// Reads the text the phone found on a receipt photo and guesses the store,
// date, and total, plus which inventory items it might cover. Plain rules,
// no AI: dates and totals follow a few fixed patterns on nearly every
// receipt; item names are abbreviated ("GV WOOL SOCK 6PK"), so those are
// only suggestions for a person to confirm. Everything it fills in can be
// changed before saving.

const STORES = [
  ['Walmart', /wal[\s-]?mart/i],
  ['Dollar General', /dollar\s*general/i],
  ['Dollar Tree', /dollar\s*tree/i],
  ['Family Dollar', /family\s*dollar/i],
  ['Target', /\btarget\b/i],
  ['Costco', /costco/i],
  ["Sam's Club", /sam'?s\s*club/i],
  ['Hy-Vee', /hy[\s-]?vee/i],
  ['Aldi', /\baldi\b/i],
  ['Fareway', /fareway/i],
  ['Menards', /menards/i],
  ['Fleet Farm', /fleet\s*farm/i],
  ['Walgreens', /walgreens/i],
  ['CVS', /\bcvs\b/i],
  ["Casey's", /casey'?s/i],
  ['Kwik Star', /kwik\s*sta[rt]/i],
  ['Amazon', /amazon/i],
  ['Temu', /\btemu\b/i],
];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONEY = /\$?\s?(\d{1,5}(?:,\d{3})*[.,]\d{2})(?!\d)/g;

function lines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function validDate(y, m, d, today) {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, m - 1, d);
  if (date.getMonth() !== m - 1) return null; // e.g. Feb 31
  const ageDays = (today - date) / 86400000;
  if (ageDays < -2 || ageDays > 400) return null; // not a receipt from this year-ish
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function findStore(text) {
  const all = lines(text);
  // Chains first, looking at the top of the receipt before the rest.
  for (const chunk of [all.slice(0, 8).join('\n'), all.join('\n')]) {
    for (const [name, pattern] of STORES) if (pattern.test(chunk)) return name;
  }
  return null;
}

// "YYYY-MM-DD", or null.
export function findDate(text, today = new Date()) {
  const body = String(text || '');
  const found = [];
  for (const m of body.matchAll(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g)) {
    found.push(validDate(Number(m[3]), Number(m[1]), Number(m[2]), today));
  }
  for (const m of body.matchAll(/\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g)) {
    found.push(validDate(Number(m[1]), Number(m[2]), Number(m[3]), today));
  }
  for (const m of body.matchAll(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})\b/g)) {
    const month = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (month >= 0) found.push(validDate(Number(m[3]), month + 1, Number(m[2]), today));
  }
  return found.find(Boolean) || null;
}

function amounts(line) {
  return [...line.matchAll(MONEY)].map((m) => Number(m[1].replace(/,(?=\d{3})/g, '').replace(',', '.')));
}

const TOTAL_WORDS = /\b(grand\s*total|balance\s*due|amount\s*due|total\s*due|total)\b/i;
const NOT_TOTAL = /sub\s*-?\s*total|total\s*(savings|saved|discount|items?|tax)|you\s*saved|tax\b/i;
const PAYMENT = /\b(cash|tend|change|visa|master|debit|credit|card|amex|discover|ebt)\b/i;

// Receipts are often read as two columns: every label, then every amount
// ("SUBTOTAL / TAX / BALANCE DUE" then "14.50 / 0.94 / 15.44"). Labels and
// amounts line up counting from the bottom, so the label's place from the
// end of its block picks its amount from the end of the amounts that follow.
function columnAmount(all, i) {
  const isAmountOnly = (l) => amounts(l).length > 0 && !/[a-z]{3}/i.test(l);
  let end = i;
  while (end + 1 < all.length && !amounts(all[end + 1]).length) end += 1;
  const run = [];
  for (let j = end + 1; j < all.length && isAmountOnly(all[j]); j += 1) run.push(amounts(all[j])[0]);
  const fromEnd = end - i;
  if (run.length > fromEnd) return [run[run.length - 1 - fromEnd]];
  return all.slice(i + 1, i + 4).flatMap((l) => (PAYMENT.test(l) ? [] : amounts(l))).slice(0, 1);
}

// The amount paid, or null. Looks for the TOTAL / BALANCE DUE line; on
// receipts read as two columns the amount is often on a following line.
export function findTotal(text) {
  const all = lines(text);
  const candidates = [];
  all.forEach((line, i) => {
    if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) return;
    const strong = /grand|balance|due/i.test(line) ? 2 : 1;
    const here = amounts(line);
    const near = here.length ? here : columnAmount(all, i);
    near.forEach((value) => candidates.push({ value, strong }));
  });
  if (candidates.length) {
    const best = Math.max(...candidates.map((c) => c.strong));
    return Math.max(...candidates.filter((c) => c.strong === best).map((c) => c.value));
  }
  // No total line found: the biggest amount that isn't cash handed over or change.
  const fallback = all.filter((l) => !PAYMENT.test(l)).flatMap(amounts);
  return fallback.length ? Math.max(...fallback) : null;
}

const STOP = new Set(['individually', 'wrapped', 'travel', 'size', 'pack', 'fragrance', 'free', 'bulk', 'refill', 'with', 'adult', 'assorted', 'count', 'each']);

function words(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^\d/.test(w))
    .map((w) => w.replace(/(es|s)$/, ''));
}

function tokenMatches(token, word) {
  if (token.length < 3) return false;
  const stem = word.slice(0, Math.min(5, word.length));
  return token.startsWith(stem) || (token.length >= 4 && word.startsWith(token));
}

// How many came in: "2 @ 3.97" or "QTY 2" for packs, times "6PK"/"12 CT"
// for the units in each pack.
function quantityFrom(line) {
  const packs = Number((line.match(/\b(\d{1,2})\s*@/) || line.match(/\bqty\s*(\d{1,3})/i) || line.match(/\bx\s?(\d{1,2})\b/i) || [])[1]) || 1;
  const perPack = Number((line.match(/\b(\d{1,3})\s*(pk|pack|ct|count|pr|pairs?)\b/i) || [])[1]) || 1;
  return packs * perPack;
}

// Inventory items that seem to be on the receipt:
// [{ item, line, quantity }], best matches first.
export function suggestItems(text, items) {
  const receiptLines = lines(text).filter((l) => /[a-z]{3}/i.test(l) && !TOTAL_WORDS.test(l));
  const results = [];
  for (const item of items || []) {
    const keys = words(item.name);
    if (!keys.length) continue;
    let best = null;
    for (const line of receiptLines) {
      const tokens = line
        .toLowerCase()
        // OCR mix-ups inside words: "S0CKS" -> "socks", "SOA5P" -> "soasp".
        .replace(/([a-z])([015])(?=[a-z])/g, (m, before, d) => before + { 0: 'o', 1: 'l', 5: 's' }[d])
        .replace(/[^a-z0-9 ]+/g, ' ')
        .split(/\s+/);
      const hits = keys.filter((k) => tokens.some((t) => tokenMatches(t, k))).length;
      const score = hits / keys.length;
      if (hits && (!best || score > best.score)) best = { item, line, quantity: quantityFrom(line), score };
    }
    if (best && (best.score >= 0.5 || keys.length === 1)) results.push(best);
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function readReceiptText(text, items, today = new Date()) {
  return { store: findStore(text), date: findDate(text, today), total: findTotal(text), suggestions: suggestItems(text, items) };
}
