// Money: expenses, spending categories with monthly budgets, recurring bills and exchange rates.
// Everything is stored in money.json in the data repository. Totals are always in SGD.
import { mergeById, uid, nowIso, parseKey, dateKey, todayKey } from './model.js';

export const BASE = 'SGD';

// Currencies offered first in the picker. Any currency with a saved rate is offered too.
export const COMMON_CURRENCIES = ['SGD', 'KRW', 'MYR', 'JPY', 'USD', 'EUR', 'THB', 'IDR', 'TWD', 'HKD', 'GBP', 'AUD'];

export const DEFAULT_CATEGORIES = [
  { id: 'cat-food', name: 'Food', color: 'peach' },
  { id: 'cat-transport', name: 'Transport', color: 'aqua' },
  { id: 'cat-shopping', name: 'Shopping', color: 'lilac' },
  { id: 'cat-bills', name: 'Bills', color: 'sand' },
  { id: 'cat-fun', name: 'Fun', color: 'rose' },
  { id: 'cat-travel', name: 'Travel', color: 'lavender' },
  { id: 'cat-study', name: 'Study', color: 'snow' },
  { id: 'cat-health', name: 'Health', color: 'pistachio' },
].map((c, i) => ({ ...c, order: i }));

// Icons offered for spending categories, and the ones the starter categories use.
export const CATEGORY_ICONS = ['bowl', 'utensils', 'cup', 'bus', 'car', 'plane', 'bag', 'shirt', 'receipt', 'home', 'phone', 'ticket', 'music', 'book', 'pencil', 'heart', 'dumbbell', 'gift', 'paw', 'leaf', 'sparkle'];
const STARTER_ICONS = { 'cat-food': 'bowl', 'cat-transport': 'bus', 'cat-shopping': 'bag', 'cat-bills': 'receipt', 'cat-fun': 'ticket', 'cat-travel': 'plane', 'cat-study': 'book', 'cat-health': 'heart' };
// A category's icon: its own choice ('' means none), else the starter icon for built-in categories.
export const catIcon = (c) => (c?.icon != null ? c.icon : STARTER_ICONS[c?.id] || '');

export const emptyMoney = () => ({ expenses: [], categories: [], bills: [], rates: {}, buys: [] });

// Rates merge per currency: the most recent edit wins.
function mergeRates(l = {}, r = {}) {
  const out = { ...r };
  for (const [k, v] of Object.entries(l)) {
    if (!out[k] || (v.updatedAt || '') > (out[k].updatedAt || '')) out[k] = v;
  }
  return out;
}

export function mergeMoney(local, remote) {
  const l = local || {};
  const r = remote || {};
  return {
    expenses: mergeById(l.expenses, r.expenses).sort((a, b) => a.id.localeCompare(b.id)),
    categories: mergeById(l.categories, r.categories).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    bills: mergeById(l.bills, r.bills).sort((a, b) => a.id.localeCompare(b.id)),
    rates: mergeRates(l.rates, r.rates),
    buys: mergeById(l.buys, r.buys).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
  };
}

export const liveCategories = (money) => {
  const saved = (money?.categories || []).filter((c) => !c.deleted);
  return saved.length ? saved : DEFAULT_CATEGORIES;
};

export const rateFor = (money, cur) => (cur === BASE ? 1 : money?.rates?.[cur]?.rate || null);

// SGD value of an expense, using the rate saved with it (so old totals never shift).
export const sgdOf = (x) => (x.currency && x.currency !== BASE ? (x.amount || 0) * (x.rate || 0) : x.amount || 0);

const fmtCache = new Map();
export function money(amount, cur = BASE, { compact = false } = {}) {
  const key = cur + compact;
  if (!fmtCache.has(key)) {
    let f;
    try {
      f = new Intl.NumberFormat('en-SG', { style: 'currency', currency: cur, currencyDisplay: 'narrowSymbol', maximumFractionDigits: compact ? 0 : undefined });
    } catch {
      f = { format: (n) => `${cur} ${n.toFixed(2)}` };
    }
    fmtCache.set(key, f);
  }
  const s = fmtCache.get(key).format(amount || 0);
  // Singapore dollars read as S$ so they never get mistaken for US dollars.
  return cur === 'SGD' ? s.replace(/^(-?)\$/, '$1S$') : cur === 'USD' ? s.replace(/^(-?)\$/, '$1US$') : s;
}

// Decimal places a currency uses (KRW and JPY have none).
export const decimalsFor = (cur) => {
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency: cur }).resolvedOptions().maximumFractionDigits;
  } catch {
    return 2;
  }
};

export const monthOf = (k) => k.slice(0, 7);
export const addMonths = (ym, n) => {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const monthLabel = (ym) => parseKey(ym + '-01').toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });

export const liveExpenses = (m) => (m?.expenses || []).filter((x) => !x.deleted);
export const liveBills = (m) => (m?.bills || []).filter((x) => !x.deleted);

// ---------- bills ----------
export const EVERY = [
  { id: 'week', label: 'Weekly' },
  { id: 'month', label: 'Monthly' },
  { id: 'year', label: 'Yearly' },
];

export function nextDue(date, every) {
  const d = parseKey(date);
  if (every === 'week') d.setDate(d.getDate() + 7);
  else if (every === 'year') d.setFullYear(d.getFullYear() + 1);
  else {
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
  }
  return dateKey(d);
}

// Rough monthly cost of a bill, for the "bills a month" figure.
export const monthlyCost = (b, m) => {
  const sgd = (b.amount || 0) * (rateFor(m, b.currency || BASE) || 0);
  return b.every === 'week' ? (sgd * 52) / 12 : b.every === 'year' ? sgd / 12 : sgd;
};

export const newExpense = (fields = {}) => ({
  id: 'x-' + uid(), date: todayKey(), amount: 0, currency: BASE, rate: 1, category: '', note: '', projectId: '', ...fields,
});

export const newBill = (fields = {}) => ({
  id: 'b-' + uid(), name: '', amount: 0, currency: BASE, category: 'cat-bills', every: 'month', next: todayKey(), projectId: '', ...fields,
});

export const stamp = (x) => ({ ...x, updatedAt: nowIso() });

// Bills as calendar entries on their next due date.
export function billEntries(m) {
  return liveBills(m).map((b) => ({
    key: 'b:' + b.id, source: 'bill', kind: 'deadline', title: b.name, cost: money(b.amount, b.currency || BASE),
    area: null, project: '', projectId: b.projectId || '', date: b.next, endDate: '', time: '', done: false, notes: '', bill: b,
  }));
}

// ---------- to buy ----------
// The Eisenhower idea applied to shopping: need or want, soon or can wait.
// Ids match the to-do quadrants so the same colours carry over.
export const BUY_QUADRANTS = [
  { id: 'do', name: 'Buy soon', hint: 'Need it, soon' },
  { id: 'schedule', name: 'Save up for', hint: 'Need it, can wait' },
  { id: 'delegate', name: 'Think it over', hint: 'Want it, soon' },
  { id: 'drop', name: 'Wishlist', hint: 'Want it, can wait' },
];
export const liveBuys = (m) => (m?.buys || []).filter((x) => !x.deleted);
export const newBuy = (fields = {}) => ({
  id: 'w-' + uid(), name: '', price: '', currency: BASE, quadrant: 'do', category: 'cat-shopping', projectId: '', link: '', note: '',
  bought: false, order: Date.now(), addedOn: todayKey(), ...fields,
});
// Rough SGD value of a to-buy item, for quadrant totals.
export const buySgd = (b, m) => (Number(b.price) || 0) * (rateFor(m, b.currency || BASE) || 0);
