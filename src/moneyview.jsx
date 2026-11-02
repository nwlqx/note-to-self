// The Money page and its sheets: expenses, bills, budgets, currencies and a project's spending.
import React, { useMemo, useState } from 'react';
import { todayKey, addDays, daysBetween } from './model.js';
import {
  BASE, COMMON_CURRENCIES, EVERY, liveCategories, liveExpenses, liveBills, rateFor, sgdOf, money, decimalsFor,
  monthOf, addMonths, monthLabel, monthlyCost, newExpense, newBill, CATEGORY_ICONS, catIcon,
} from './money.js';
import { PROJECT_HUES, PALETTE } from './model.js';
import { ToBuy } from './buyview.jsx';
import { Sheet, Icon, ConfirmButton, areaStyle, projectStyle, ProjectIcon, shortDate, dayDate } from './ui.jsx';

const HUES = [...PROJECT_HUES, ...PALETTE.filter((p) => !PROJECT_HUES.some((h) => h.id === p.id))];

// ---------- shared bits ----------
// A category's mark: its icon in the category colour, or the colour dot when it has none.
export function CatMark({ c, size = 15 }) {
  const ic = catIcon(c);
  return ic ? <span className="m-cat-icon" aria-hidden="true"><Icon name={ic} size={size} /></span> : <span className="m-dot" aria-hidden="true" />;
}
const pct = (a, b) => (b > 0 ? Math.min(100, (a / b) * 100) : 0);

function Bar({ spent, budget, label }) {
  const over = budget > 0 && spent > budget;
  return (
    <span className="m-bar" data-over={over || undefined} role="img" aria-label={label}>
      <span style={{ width: `${budget > 0 ? pct(spent, budget) : 100}%` }} />
    </span>
  );
}

export function billDueLabel(b, today = todayKey()) {
  if (b.next < today) return `Overdue since ${shortDate(b.next)}`;
  if (b.next === today) return 'Due today';
  const n = daysBetween(today, b.next);
  if (n === 1) return 'Due tomorrow';
  if (n < 7) return `Due ${dayDate(b.next)}`;
  return `Due ${shortDate(b.next)}`;
}

// The Bills card lists this many; the rest open in the Bills drawer.
const BILLS_SHOWN = 5;

// Bill rows, shared by the Bills card and the Bills drawer.
function BillRows({ list, catsById, today, hub, onOpen }) {
  return (
    <ul className="m-bill-list">
      {list.map((b) => {
        const c = catsById[b.category];
        return (
          <li key={b.id} style={areaStyle(c ? { color: c.color } : null)} data-late={b.next < today || undefined} data-today={b.next === today || undefined}>
            {/* The bill button stretches over the whole row, so tapping the amount opens it too.
                Amount and Paid share a column that stacks on narrow screens. */}
            <button className="m-bill" onClick={() => onOpen(b.id)}>
              <span className="m-row-text">
                <span className="m-row-title">{b.name}</span>
                <span className="m-row-meta m-due">{billDueLabel(b, today)}</span>
              </span>
            </button>
            <span className="m-bill-side">
              <span className="m-amount-main">{money(b.amount, b.currency || BASE)}</span>
              {b.next <= addDays(today, 3) && (
                <button className="m-paid" onClick={() => hub.payBill(b.id)} aria-label={`Mark ${b.name} paid`}>
                  <Icon name="check" size={16} />Paid
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

export function AmountLine({ x }) {
  const foreign = x.currency && x.currency !== BASE;
  return (
    <span className="m-amount">
      <span className="m-amount-main">{money(x.amount, x.currency || BASE)}</span>
      {foreign && <span className="m-amount-sub">{money(sgdOf(x))}</span>}
    </span>
  );
}

export function ExpenseRows({ list, catsById, projectsById, onOpen, showDate = false, showProject = true, showCat = true }) {
  return (
    <ul className="m-rows">
      {list.map((x) => {
        const c = catsById[x.category];
        const p = projectsById[x.projectId];
        const meta = [showDate ? shortDate(x.date) : null, showCat ? c?.name : null, showProject && p ? p.name : null, x.billId ? 'bill' : null].filter(Boolean);
        return (
          <li key={x.id} style={areaStyle(c ? { color: c.color } : null)}>
            <button className="m-row" onClick={() => onOpen(x.id)}>
              <span className="m-dot" aria-hidden="true" />
              <span className="m-row-text">
                <span className="m-row-title">{x.note || c?.name || 'Expense'}</span>
                <span className="m-row-meta">{meta.join(', ')}</span>
              </span>
              <AmountLine x={x} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

// Spending grouped by day, newest first, each day with its total. Used by every spending drawer.
function ExpenseDays({ list, catsById, projectsById, onOpen, showCat = true, showProject = true, empty }) {
  const today = todayKey();
  const days = [];
  for (const x of list) {
    if (!days.length || days[days.length - 1].date !== x.date) days.push({ date: x.date, list: [] });
    days[days.length - 1].list.push(x);
  }
  // Older days outside this year show the year too.
  const label = (d) => (d === today ? 'Today' : d === addDays(today, -1) ? 'Yesterday' : d.slice(0, 4) === today.slice(0, 4) ? dayDate(d) : `${dayDate(d)} ${d.slice(0, 4)}`);
  return (
    <div className="m-drawer-list">
      {days.length ? days.map((d) => (
        <div key={d.date} className="m-day">
          <h3 className="m-day-head">
            <span>{label(d.date)}</span>
            <span>{money(d.list.reduce((s, x) => s + sgdOf(x), 0))}</span>
          </h3>
          <ExpenseRows list={d.list} catsById={catsById} projectsById={projectsById} showCat={showCat} showProject={showProject} onOpen={onOpen} />
        </div>
      )) : <p className="tile-empty">{empty}</p>}
    </div>
  );
}

// The month as one bar split by category, like the macOS storage bar: spent slices,
// then what's left of the budget in grey, with a legend underneath.
function StackBar({ rows, total, budget, label, onPick, onAll }) {
  const [hover, setHover] = useState(null);
  const scale = Math.max(total, budget || 0) || 1;
  let at = 0;
  const slices = rows.map((r) => { const from = at; at += r.spent; return { ...r, from }; });
  const h = slices.find((x) => (x.c.id || 'none') === hover);
  const mid = h ? ((h.from + h.spent / 2) / scale) * 100 : 0;
  const left = budget ? budget - total : 0;
  return (
    <div className="m-stack-card">
      <div className="m-stack-top">
        <button type="button" className="m-stack-title" onClick={onAll} aria-label={`See all of ${label}`}>{label}<Icon name="arrow" size={14} /></button>
        <span className="m-stack-sum">
          {money(total, BASE, { compact: true })}{budget ? <> of {money(budget, BASE, { compact: true })} {left < 0 ? <strong className="m-over">({money(-left, BASE, { compact: true })} over)</strong> : 'budget'}</> : ' spent'}
        </span>
      </div>
      <div className="m-stack-wrap" onPointerLeave={() => setHover(null)}>
        {h && (
          <span className="m-stack-tip" role="status" style={{ left: `clamp(5rem, ${mid}%, calc(100% - 5rem))` }}>
            <span className="m-dot" aria-hidden="true" style={areaStyle(h.c.color ? { color: h.c.color } : null)} />
            <strong>{h.c.name}</strong> {money(h.spent)}<span className="m-stack-pct">{Math.round((h.spent / total) * 100)}%</span>
          </span>
        )}
        <span className="m-stack" role="group" aria-label={`${label} by category`}>
          {slices.map(({ c, spent: s }) => {
            const id = c.id || 'none';
            return (
              <button key={id} type="button" className="m-stack-slice" data-dim={hover && hover !== id ? '' : undefined}
                style={{ ...areaStyle(c.color ? { color: c.color } : null), flexGrow: s }}
                aria-label={`${c.name}: ${money(s)}, ${Math.round((s / total) * 100)}% of the month`}
                onPointerEnter={() => setHover(id)} onFocus={() => setHover(id)} onBlur={() => setHover(null)}
                onClick={() => onPick(c)} />
            );
          })}
          {left > 0 && (
            <span className="m-stack-left" style={{ flexGrow: left }}>
              <span>{money(left, BASE, { compact: true })} left</span>
            </span>
          )}
        </span>
      </div>
      <ul className="m-stack-legend">
        {slices.map(({ c }) => (
          <li key={c.id || 'none'} style={areaStyle(c.color ? { color: c.color } : null)} data-dim={hover && hover !== (c.id || 'none') ? '' : undefined}>
            <button type="button" onClick={() => onPick(c)} onPointerEnter={() => setHover(c.id || 'none')} onPointerLeave={() => setHover(null)}>
              <span className="m-stack-key" aria-hidden="true" />{c.name}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- the page ----------
export function MoneyPage({ hub, projects, areasById, onSheet, onOpenProject }) {
  const m = hub.data.money;
  const today = todayKey();
  const [ym, setYm] = useState(monthOf(today));
  const cats = liveCategories(m);
  const catsById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const all = liveExpenses(m);

  const month = useMemo(() => all.filter((x) => monthOf(x.date) === ym).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)), [all, ym]);
  const lastMonth = all.filter((x) => monthOf(x.date) === addMonths(ym, -1));
  const spent = month.reduce((s, x) => s + sgdOf(x), 0);
  const spentLast = lastMonth.reduce((s, x) => s + sgdOf(x), 0);
  const budgetTotal = cats.reduce((s, c) => s + (c.budget || 0), 0);
  const byCat = {};
  for (const x of month) byCat[x.category] = (byCat[x.category] || 0) + sgdOf(x);
  const uncategorised = month.filter((x) => !catsById[x.category]).reduce((s, x) => s + sgdOf(x), 0);

  const bills = liveBills(m).sort((a, b) => a.next.localeCompare(b.next));
  const billsMonthly = bills.reduce((s, b) => s + monthlyCost(b, m), 0);
  const upcoming = bills.filter((b) => b.next <= addDays(today, 31));

  const trips = projects.filter((p) => !p.archived).map((p) => {
    const xs = all.filter((x) => x.projectId === p.id);
    return { p, spent: xs.reduce((s, x) => s + sgdOf(x), 0), count: xs.length };
  }).filter((r) => r.p.budget || r.count).sort((a, b) => (b.p.budget || 0) - (a.p.budget || 0) || b.spent - a.spent);

  const catTiles = [
    ...cats.map((c) => ({ c, spent: byCat[c.id] || 0, count: month.filter((x) => x.category === c.id).length })).filter((r) => r.c.budget || r.spent),
    ...(uncategorised > 0 ? [{ c: { id: '', name: 'No category' }, spent: uncategorised, count: month.filter((x) => !catsById[x.category]).length }] : []),
  ];

  const isThisMonth = ym === monthOf(today);
  const left = budgetTotal - spent;

  return (
    <section className="view money" aria-label="Budgeting">
      <header className="view-head">
        <h1>Budgeting</h1>
        <div className="m-head-tools">
          <button className="text-btn small" onClick={() => onSheet({ type: 'currencies' })}>Currencies</button>
          <button className="text-btn small" onClick={() => onSheet({ type: 'budgets' })}>Budgets</button>
        </div>
      </header>

      <div className="m-month">
        <h2 className="m-month-name">{monthLabel(ym)}</h2>
        <div className="m-month-nav">
          {!isThisMonth && <button className="text-btn small" onClick={() => setYm(monthOf(today))}>This month</button>}
          <button className="icon-btn" aria-label="Previous month" onClick={() => setYm(addMonths(ym, -1))}><Icon name="left" /></button>
          <button className="icon-btn" aria-label="Next month" onClick={() => setYm(addMonths(ym, 1))}><Icon name="right" /></button>
        </div>
      </div>

      <div className="m-top">
        <div className="m-card m-spent">
          <span className="tile-label">Spent</span>
          <span className="m-big">{money(spent)}</span>
          {budgetTotal > 0 ? (
            <>
              <Bar spent={spent} budget={budgetTotal} label={`${money(spent)} of ${money(budgetTotal)} budget`} />
              <span className="m-sub">
                {left >= 0 ? <><strong>{money(left)}</strong> left of {money(budgetTotal)}</> : <><strong className="m-over">{money(-left)} over</strong> a {money(budgetTotal)} budget</>}
              </span>
            </>
          ) : (
            <button className="text-btn small m-start" onClick={() => onSheet({ type: 'budgets' })}>Set monthly budgets</button>
          )}
          {spentLast > 0 && <span className="m-sub quiet">{money(spentLast)} in {monthLabel(addMonths(ym, -1)).split(' ')[0]}</span>}
          <button className="primary m-log" onClick={() => onSheet({ type: 'expense', defaults: isThisMonth ? {} : { date: `${ym}-01` } })}>
            <Icon name="plus" size={18} />Log spending
          </button>
        </div>

        <div className="m-card m-bills">
          {/* the whole header line, title and monthly total, opens the Bills drawer */}
          <button type="button" className="m-card-head m-bills-head" onClick={() => onSheet({ type: 'bills' })}>
            <span className="m-stack-title">Bills<Icon name="arrow" size={14} /></span>
            <span className="m-sub">{money(billsMonthly)} a month</span>
          </button>
          {upcoming.length ? (
            <BillRows list={upcoming.slice(0, BILLS_SHOWN)} catsById={catsById} today={today} hub={hub} onOpen={(id) => onSheet({ type: 'bill', id })} />
          ) : (
            <p className="tile-empty">{bills.length ? 'Nothing due in the next month' : 'No bills yet'}</p>
          )}
          {upcoming.length > BILLS_SHOWN && (
            <button className="text-btn small quiet m-bill-more" onClick={() => onSheet({ type: 'bills' })}>{upcoming.length - BILLS_SHOWN} more</button>
          )}
          <button className="m-card-foot" onClick={() => onSheet({ type: 'bill' })}>
            <Icon name="plus" size={16} />Add a bill or subscription
          </button>
        </div>
      </div>

      {(spent > 0 || catTiles.length > 0) && (
      <section className="m-section m-spend" aria-labelledby="m-budgets">
        <h2 className="sr-only" id="m-budgets">{isThisMonth ? "This month's spending" : `${monthLabel(ym).split(' ')[0]}'s spending`}</h2>
        {spent > 0 && (
          <StackBar rows={catTiles.filter((r) => r.spent > 0).sort((x, y) => y.spent - x.spent)} total={spent} budget={budgetTotal} label={monthLabel(ym).split(' ')[0]}
            onAll={() => onSheet({ type: 'category', catId: '', ym })}
            onPick={(c) => onSheet({ type: 'category', catId: c.id || 'none', ym })} />
        )}
        {catTiles.length ? (
          <>
            {[catTiles.filter((r) => r.c.budget), catTiles.filter((r) => !r.c.budget)].map((list, gi) => (list.length > 0 || (gi === 1 && trips.length > 0)) && (
              <React.Fragment key={gi}>
                {gi === 1 && trips.length > 0 && (
                  <>
                    <h3 className="m-tiles-label">Projects</h3>
                      <ul className="m-tiles">
                        {trips.map(({ p, spent: s }) => (
                          <li key={p.id} style={projectStyle(p, areasById[p.area])}>
                            <button className="m-tile" onClick={() => onSheet({ type: 'spending', projectId: p.id })}>
                              <span className="m-tile-name" title={p.name}><ProjectIcon project={p} size={15} /><span className="m-tile-text">{p.name}</span></span>
                              <span className="m-tile-num">{money(s, BASE, { compact: true })}{p.budget ? <span className="m-of"> / {money(p.budget, BASE, { compact: true })}</span> : null}</span>
                              {p.budget ? <Bar spent={s} budget={p.budget} label="" /> : null}
                              <span className={`m-tile-left${p.budget && s > p.budget ? ' m-over' : ''}`}>{p.budget ? (s > p.budget ? `${money(s - p.budget, BASE, { compact: true })} over` : `${money(p.budget - s, BASE, { compact: true })} left`) : 'All time'}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                  </>
                )}
                {gi === 1 && list.length > 0 && catTiles.some((r) => r.c.budget) && <h3 className="m-tiles-label">Unbudgeted</h3>}
                {list.length > 0 && <ul className="m-tiles">
            {list.map(({ c, spent: s, count }) => {
                  const over = c.budget && s > c.budget;
                  return (
                    <li key={c.id || 'none'} style={areaStyle(c.color ? { color: c.color } : null)}>
                      <button className="m-tile" onClick={() => onSheet({ type: 'category', catId: c.id || 'none', ym })} aria-label={`${c.name}, ${money(s)} spent${c.budget ? ` of ${money(c.budget)}` : ''}. Show details`}>
                        <span className="m-tile-name" title={c.name}><CatMark c={c} /><span className="m-tile-text">{c.name}</span></span>
                        <span className="m-tile-num">{money(s, BASE, { compact: true })}{c.budget ? <span className="m-of"> / {money(c.budget, BASE, { compact: true })}</span> : null}</span>
                        {c.budget ? <Bar spent={s} budget={c.budget} label="" /> : null}
                        {c.budget ? <span className={`m-tile-left${over ? ' m-over' : ''}`}>{over ? `${money(s - c.budget, BASE, { compact: true })} over` : `${money(c.budget - s, BASE, { compact: true })} left`}</span> : null}
                      </button>
                    </li>
                  );
                })}
                </ul>}
              </React.Fragment>
            ))}
          </>
        ) : null}
      </section>
      )}

      <ToBuy hub={hub} projects={projects} onSheet={onSheet} />
    </section>
  );
}

// ---------- amount + currency input ----------
function AmountField({ amount, currency, onAmount, onCurrency, currencies, autoFocus }) {
  return (
    <div className="m-amount-field">
      <select value={currency} onChange={(e) => onCurrency(e.target.value)} aria-label="Currency">
        {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input data-autofocus={autoFocus || undefined} type="text" inputMode="decimal" value={amount} placeholder="0.00" aria-label="Amount"
        onChange={(e) => onAmount(e.target.value.replace(/[^\d.,]/g, '').replace(/,/g, ''))} />
    </div>
  );
}

const currencyList = (m, extra) => [...new Set([...COMMON_CURRENCIES, ...Object.keys(m?.rates || {}), ...(extra ? [extra] : [])])];

function ProjectSelect({ value, onChange, projects, areasById }) {
  const groups = {};
  for (const p of projects.filter((x) => !x.archived || x.id === value)) (groups[p.area] ||= []).push(p);
  return (
    <label>Project
      <select value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">None</option>
        {Object.entries(groups).map(([a, list]) => (
          <optgroup key={a} label={areasById[a]?.name || 'No area'}>
            {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function CategoryChips({ value, onChange, cats }) {
  return (
    <div className="filters m-cat-chips" role="radiogroup" aria-label="Category">
      {cats.map((c) => (
        <button type="button" key={c.id} role="radio" aria-checked={value === c.id} className="chip" style={areaStyle({ color: c.color })}
          onClick={() => onChange(value === c.id ? '' : c.id)}>
          <span className="chip-dot" />{c.name}
        </button>
      ))}
    </div>
  );
}

// Rate line for a foreign currency: shows the conversion and lets you set or fix the rate.
function RateLine({ m, currency, amount, rate, onRate }) {
  if (currency === BASE) return null;
  const r = rate || '';
  const sgd = (Number(amount) || 0) * (Number(rate) || 0);
  return (
    <div className="m-rate">
      <label className="m-rate-input">1 {currency} =
        <input type="text" inputMode="decimal" value={r} placeholder="rate" aria-label={`Singapore dollars per ${currency}`}
          onChange={(e) => onRate(e.target.value.replace(/[^\d.]/g, ''))} /> SGD
      </label>
      <span className="m-rate-sgd">{Number(rate) ? `≈ ${money(sgd)}` : `Add a rate to count this in SGD`}</span>
    </div>
  );
}

// ---------- expense sheet ----------
export function ExpenseSheet({ hub, id, defaults, projects, areasById, onClose }) {
  const m = hub.data.money;
  const stored = id ? liveExpenses(m).find((x) => x.id === id) : null;
  const cats = liveCategories(m);
  const [f, setF] = useState(() => {
    const base = stored || newExpense(defaults);
    const decimals = decimalsFor(base.currency || BASE);
    return { ...base, amount: stored ? String(Number(stored.amount).toFixed(decimals)).replace(/\.0+$/, '') : '', rate: String(base.rate || rateFor(m, base.currency || BASE) || '') };
  });
  const set = (x) => setF((cur) => ({ ...cur, ...x }));
  const valid = Number(f.amount) > 0;

  const save = (e) => {
    e.preventDefault();
    if (!valid) return;
    const rate = f.currency === BASE ? 1 : Number(f.rate) || 0;
    if (f.currency !== BASE && rate && rate !== rateFor(m, f.currency)) hub.setRate(f.currency, rate);
    hub.saveExpense({ ...f, amount: Number(f.amount), rate });
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label={stored ? 'Edit expense' : 'Log spending'} onSubmit={save}>
      <h2 className="sheet-heading">{stored ? 'Expense' : 'Log spending'}</h2>
      <AmountField amount={f.amount} currency={f.currency} autoFocus currencies={currencyList(m, f.currency)}
        onAmount={(amount) => set({ amount })}
        onCurrency={(currency) => set({ currency, rate: String(rateFor(m, currency) || '') })} />
      <RateLine m={m} currency={f.currency} amount={f.amount} rate={f.rate} onRate={(rate) => set({ rate })} />
      <input className="m-note" value={f.note} placeholder="What was it for?" aria-label="Note" onChange={(e) => set({ note: e.target.value })} />
      <fieldset>
        <legend>Category</legend>
        <CategoryChips value={f.category} onChange={(category) => set({ category })} cats={cats} />
      </fieldset>
      <div className="field-grid">
        <label>Date<input type="date" value={f.date} onChange={(e) => set({ date: e.target.value || todayKey() })} /></label>
        <ProjectSelect value={f.projectId} onChange={(projectId) => set({ projectId })} projects={projects} areasById={areasById} />
      </div>
      <div className="sheet-actions">
        <button className="primary" type="submit" disabled={!valid}>{stored ? 'Save' : 'Log it'}</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
        {stored && (
          <span className="push-right">
            <ConfirmButton confirmText="Tap again to delete" onConfirm={() => { hub.deleteExpense(stored.id); onClose(); }}>Delete</ConfirmButton>
          </span>
        )}
      </div>
    </Sheet>
  );
}

// ---------- bill sheet ----------
export function BillSheet({ hub, id, projects, areasById, onClose }) {
  const m = hub.data.money;
  const stored = id ? liveBills(m).find((x) => x.id === id) : null;
  const cats = liveCategories(m);
  const [f, setF] = useState(() => ({ ...(stored || newBill()), amount: stored ? String(stored.amount) : '' }));
  const set = (x) => setF((cur) => ({ ...cur, ...x }));
  const valid = f.name.trim() && Number(f.amount) > 0;
  const paidList = liveExpenses(m).filter((x) => x.billId === f.id).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);

  const save = (e) => {
    e?.preventDefault();
    if (!valid) return;
    hub.saveBill({ ...f, name: f.name.trim(), amount: Number(f.amount) });
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label={stored ? 'Bill' : 'New bill'} onSubmit={save}>
      <h2 className="sheet-heading">{stored ? 'Bill or subscription' : 'New bill or subscription'}</h2>
      <input data-autofocus className="title-input" value={f.name} placeholder="Name, e.g. Spotify" aria-label="Name" onChange={(e) => set({ name: e.target.value })} />
      <AmountField amount={f.amount} currency={f.currency || BASE} currencies={currencyList(m, f.currency)}
        onAmount={(amount) => set({ amount })} onCurrency={(currency) => set({ currency })} />
      {f.currency && f.currency !== BASE && !rateFor(m, f.currency) && (
        <p className="hint">Add a {f.currency} rate under Currencies so this counts in your monthly total.</p>
      )}
      <fieldset>
        <legend>Repeats</legend>
        <div className="seg seg-small" role="radiogroup" aria-label="Repeats">
          {EVERY.map((r) => <button type="button" key={r.id} role="radio" aria-checked={f.every === r.id} onClick={() => set({ every: r.id })}>{r.label}</button>)}
        </div>
      </fieldset>
      <div className="field-grid">
        <label>Next due<input type="date" value={f.next} onChange={(e) => set({ next: e.target.value || todayKey() })} /></label>
        <ProjectSelect value={f.projectId} onChange={(projectId) => set({ projectId })} projects={projects} areasById={areasById} />
      </div>
      <fieldset>
        <legend>Category</legend>
        <CategoryChips value={f.category} onChange={(category) => set({ category })} cats={cats} />
      </fieldset>
      {stored && (
        <div className="m-bill-actions">
          <button type="button" className="secondary" aria-label={`Mark ${stored.name} paid`} onClick={() => { hub.payBill(stored.id); onClose(); }}><Icon name="check" size={16} />Paid</button>
          <button type="button" className="text-btn" onClick={() => { hub.skipBill(stored.id); onClose(); }}>Skip this one</button>
          {paidList.length > 0 && <span className="hint">Last paid {shortDate(paidList[0].date)}</span>}
        </div>
      )}
      <p className="hint">Bills show on your calendar on their due date. Marking one paid logs it as spending and moves it to the next date.</p>
      <div className="sheet-actions">
        <button className="primary" type="submit" disabled={!valid}>{stored ? 'Save' : 'Add bill'}</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
        {stored && (
          <span className="push-right">
            <ConfirmButton confirmText="Tap again to delete" onConfirm={() => { hub.deleteBill(stored.id); onClose(); }}>Delete</ConfirmButton>
          </span>
        )}
      </div>
    </Sheet>
  );
}

// ---------- budgets (categories) ----------
export function BudgetsSheet({ hub, onClose }) {
  const m = hub.data.money;
  const [list, setList] = useState(() => liveCategories(m).map((c) => ({ ...c, budget: c.budget ? String(c.budget) : '' })));
  const setAt = (i, x) => setList((l) => l.map((c, j) => (i === j ? { ...c, ...x } : c)));
  const [iconFor, setIconFor] = useState(null);
  const nextHue = (h) => HUES[(HUES.findIndex((x) => x.id === h) + 1) % HUES.length].id;
  const total = list.reduce((s, c) => s + (Number(c.budget) || 0), 0);

  const save = (e) => {
    e.preventDefault();
    const cats = list.filter((c) => c.name.trim()).map((c) => ({ ...c, name: c.name.trim(), budget: Number(c.budget) || 0 }));
    hub.saveCategories(cats);
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label="Budgets" onSubmit={save}>
      <h2 className="sheet-heading">Categories and monthly budgets</h2>
      <p className="hint">Leave a budget empty to just track a category. Tap the dot to change its colour, or the icon to pick another.</p>
      <ul className="m-cat-edit">
        {list.map((c, i) => (
          <li key={c.id} style={areaStyle({ color: c.color })}>
            <button type="button" className="m-swatch" aria-label={`Colour of ${c.name || 'category'}, change`} onClick={() => setAt(i, { color: nextHue(c.color) })} />
            <button type="button" className="m-icon-btn" aria-label={`Icon for ${c.name || 'category'}`} aria-expanded={iconFor === c.id} onClick={() => setIconFor(iconFor === c.id ? null : c.id)}>
              {catIcon(c) ? <Icon name={catIcon(c)} size={16} /> : <span className="m-icon-none">—</span>}
            </button>
            <input value={c.name} aria-label="Category name" placeholder="Category" onChange={(e) => setAt(i, { name: e.target.value })} />
            <label className="money-input small">
              <span className="money-prefix" aria-hidden="true">S$</span>
              <input type="text" inputMode="decimal" value={c.budget} placeholder="No budget" aria-label={`Monthly budget for ${c.name}`}
                onChange={(e) => setAt(i, { budget: e.target.value.replace(/[^\d.]/g, '') })} />
            </label>
            <ConfirmButton className="icon-btn" aria-label={`Remove ${c.name}`} confirmText={<span className="confirm-mini">Remove</span>}
              onConfirm={() => setList((l) => l.filter((_, j) => j !== i))}><Icon name="close" /></ConfirmButton>
            {iconFor === c.id && (
              <div className="icon-grid m-icon-grid" role="radiogroup" aria-label={`Icon for ${c.name || 'category'}`}>
                <button type="button" role="radio" aria-checked={!catIcon(c)} className="icon-choice icon-none" onClick={() => { setAt(i, { icon: '' }); setIconFor(null); }}>None</button>
                {CATEGORY_ICONS.map((ic) => (
                  <button type="button" key={ic} role="radio" aria-checked={catIcon(c) === ic} aria-label={ic} title={ic}
                    className="icon-choice" onClick={() => { setAt(i, { icon: ic }); setIconFor(null); }}><Icon name={ic} /></button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="text-btn" onClick={() => setList((l) => [...l, { id: 'cat-' + Math.random().toString(36).slice(2, 9), name: '', color: HUES[l.length % HUES.length].id, budget: '' }])}>
        Add a category
      </button>
      <p className="m-total">Monthly budget: <strong>{money(total)}</strong></p>
      <div className="sheet-actions">
        <button className="primary" type="submit">Save</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

// ---------- currencies ----------
export function CurrenciesSheet({ hub, onClose }) {
  const m = hub.data.money;
  const used = [...new Set(liveExpenses(m).map((x) => x.currency).concat(liveBills(m).map((b) => b.currency)).filter((c) => c && c !== BASE))];
  const [codes, setCodes] = useState(() => [...new Set([...Object.keys(m.rates || {}), ...used])].sort());
  const [vals, setVals] = useState(() => Object.fromEntries(codes.map((c) => [c, String(m.rates?.[c]?.rate || '')])));
  const [adding, setAdding] = useState('');
  const options = COMMON_CURRENCIES.filter((c) => c !== BASE && !codes.includes(c));

  const save = (e) => {
    e.preventDefault();
    for (const c of codes) {
      const v = Number(vals[c]);
      if (v && v !== m.rates?.[c]?.rate) hub.setRate(c, v);
    }
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label="Currencies" onSubmit={save}>
      <h2 className="sheet-heading">Currencies</h2>
      <p className="hint">Totals are in Singapore dollars. Each expense keeps the rate it was logged with, so changing a rate here only affects new spending.</p>
      {codes.length ? (
        <ul className="m-rates">
          {codes.map((c) => (
            <li key={c}>
              <label className="m-rate-input">1 {c} =
                <input type="text" inputMode="decimal" value={vals[c] || ''} placeholder="rate" aria-label={`Singapore dollars per ${c}`}
                  onChange={(e) => setVals((v) => ({ ...v, [c]: e.target.value.replace(/[^\d.]/g, '') }))} /> SGD
              </label>
              {Number(vals[c]) > 0 && <span className="hint">S$1 = {money(1 / Number(vals[c]), c)}</span>}
            </li>
          ))}
        </ul>
      ) : <p className="tile-empty">Only SGD so far.</p>}
      <div className="m-add-cur">
        <select value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="Currency to add">
          <option value="">Add a currency…</option>
          {options.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button type="button" className="secondary" disabled={!adding} onClick={() => { setCodes((l) => [...l, adding]); setAdding(''); }}>Add</button>
      </div>
      <div className="sheet-actions">
        <button className="primary" type="submit">Save</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

// ---------- a project's spending ----------
export function SpendingSheet({ hub, projectId, projects, areasById, onSheet, onClose }) {
  const m = hub.data.money;
  const p = projects.find((x) => x.id === projectId);
  if (!p) return null;
  const cats = liveCategories(m);
  const catsById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const list = liveExpenses(m).filter((x) => x.projectId === projectId).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const spent = list.reduce((s, x) => s + sgdOf(x), 0);
  const byCat = {};
  for (const x of list) byCat[x.category] = (byCat[x.category] || 0) + sgdOf(x);
  const bills = liveBills(m).filter((b) => b.projectId === projectId);

  // Same layout as a category's drawer: name and close at the top, the total, then spending by day.
  return (
    <Sheet onClose={onClose} label={`${p.name} spending`} side>
      <div className="m-drawer-head" style={projectStyle(p, areasById[p.area])}>
        <div className="m-drawer-top">
          <p className="project-area"><ProjectIcon project={p} size={16} />{p.name}</p>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <h2 className="sheet-heading">Spending</h2>
        <p className="m-big small">{money(spent)}{p.budget ? <span className="m-of"> of {money(p.budget)}</span> : null}</p>
        {p.budget ? <Bar spent={spent} budget={p.budget} label={`${money(spent)} of ${money(p.budget)}`} /> : null}
        <p className="m-sub">
          {p.budget
            ? (spent > p.budget ? <strong className="m-over">{money(spent - p.budget)} over budget</strong> : <><strong>{money(p.budget - spent)}</strong> left</>)
            : 'Set a budget in project settings to track against it.'}
        </p>
      </div>
      {Object.keys(byCat).length > 1 && (
        <ul className="m-split" aria-label="By category">
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cid, v]) => (
            <li key={cid} style={areaStyle(catsById[cid] ? { color: catsById[cid].color } : null)}>
              <span className="m-dot" aria-hidden="true" />{catsById[cid]?.name || 'No category'}<span>{money(v)}</span>
            </li>
          ))}
        </ul>
      )}
      <ExpenseDays list={list} catsById={catsById} projectsById={{}} showProject={false}
        empty="Nothing logged for this project yet." onOpen={(id) => onSheet({ type: 'expense', id })} />
      {bills.length > 0 && <p className="hint">Bills tagged here: {bills.map((b) => b.name).join(', ')}.</p>}
      <div className="sheet-actions">
        <button className="primary" onClick={() => onSheet({ type: 'expense', defaults: { projectId } })}><Icon name="plus" size={18} />Log spending</button>
      </div>
    </Sheet>
  );
}

// ---------- every bill, in a side drawer (opened from "N more" on the Bills card) ----------
export function BillsSheet({ hub, onSheet, onClose }) {
  const m = hub.data.money;
  const today = todayKey();
  const catsById = Object.fromEntries(liveCategories(m).map((c) => [c.id, c]));
  const bills = liveBills(m).sort((a, b) => a.next.localeCompare(b.next));
  const monthly = bills.reduce((s, b) => s + monthlyCost(b, m), 0);

  return (
    <Sheet onClose={onClose} label="Bills" side>
      <h2 className="sheet-heading m-bills-heading">Bills</h2>
      <p className="m-sub">{bills.length} bill{bills.length === 1 ? '' : 's'}, {money(monthly)} a month</p>
      {bills.length ? (
        <BillRows list={bills} catsById={catsById} today={today} hub={hub} onOpen={(id) => onSheet({ type: 'bill', id })} />
      ) : <p className="tile-empty">No bills yet</p>}
      <div className="sheet-actions">
        <button className="primary" onClick={() => onSheet({ type: 'bill' })}><Icon name="plus" size={18} />Add a bill</button>
        <button className="text-btn" onClick={onClose}>Close</button>
      </div>
    </Sheet>
  );
}

// ---------- one category's month, in a side drawer ----------
// catId: a category id, 'none' for uncategorised, or '' for everything.
export function CategorySheet({ hub, catId, ym: startYm, projects, onSheet, onClose }) {
  const m = hub.data.money;
  const today = todayKey();
  const [ym, setYm] = useState(startYm || monthOf(today));
  const cats = liveCategories(m);
  const catsById = Object.fromEntries(cats.map((c) => [c.id, c]));
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const cat = catId && catId !== 'none' ? catsById[catId] : null;
  const name = catId === 'none' ? 'No category' : cat ? cat.name : 'All spending';
  const match = (x) => (!catId ? true : catId === 'none' ? !catsById[x.category] : x.category === catId);
  const all = liveExpenses(m).filter(match);
  const list = all.filter((x) => monthOf(x.date) === ym).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const spent = list.reduce((s, x) => s + sgdOf(x), 0);
  const last = all.filter((x) => monthOf(x.date) === addMonths(ym, -1)).reduce((s, x) => s + sgdOf(x), 0);
  const budget = cat ? cat.budget || 0 : !catId ? cats.reduce((s, c) => s + (c.budget || 0), 0) : 0;
  const byCat = {};
  if (!catId) for (const x of list) byCat[x.category] = (byCat[x.category] || 0) + sgdOf(x);
  const diff = spent - last;

  return (
    <Sheet onClose={onClose} label={`${name}, ${monthLabel(ym)}`} side>
      <div className="m-drawer-head" style={areaStyle(cat ? { color: cat.color } : null)}>
        <div className="m-drawer-top">
          <p className="project-area">{cat && <CatMark c={cat} size={16} />}{name}</p>
          <button className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="m-drawer-month">
          <button className="icon-btn" aria-label="Previous month" onClick={() => setYm(addMonths(ym, -1))}><Icon name="left" size={18} /></button>
          <h2 className="sheet-heading">{monthLabel(ym)}</h2>
          <button className="icon-btn" aria-label="Next month" onClick={() => setYm(addMonths(ym, 1))}><Icon name="right" size={18} /></button>
        </div>
        <p className="m-big small">{money(spent)}{budget ? <span className="m-of"> of {money(budget)}</span> : null}</p>
        {budget ? <Bar spent={spent} budget={budget} label={`${money(spent)} of ${money(budget)}`} /> : null}
        <p className="m-sub">
          {budget ? (spent > budget ? <strong className="m-over">{money(spent - budget)} over budget</strong> : <><strong>{money(budget - spent)}</strong> left</>) : null}
          {budget && last ? ', ' : ''}
          {last ? (Math.abs(diff) < 0.005 ? 'same as last month' : `${money(Math.abs(diff))} ${diff > 0 ? 'more' : 'less'} than last month`) : null}
        </p>
      </div>
      {!catId && Object.keys(byCat).length > 1 && (
        <ul className="m-split" aria-label="By category">
          {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cid, v]) => (
            <li key={cid} style={areaStyle(catsById[cid] ? { color: catsById[cid].color } : null)}>
              <span className="m-dot" aria-hidden="true" />{catsById[cid]?.name || 'No category'}<span>{money(v)}</span>
            </li>
          ))}
        </ul>
      )}
      <ExpenseDays list={list} catsById={catsById} projectsById={projectsById} showCat={!catId}
        empty={`Nothing logged${catId ? ' here' : ''} in ${monthLabel(ym)}.`} onOpen={(id) => onSheet({ type: 'expense', id })} />
      <div className="sheet-actions">
        <button className="primary" onClick={() => onSheet({ type: 'expense', defaults: { ...(cat ? { category: cat.id } : {}), ...(ym !== monthOf(today) ? { date: `${ym}-01` } : {}) } })}>
          <Icon name="plus" size={18} />Log spending
        </button>
      </div>
    </Sheet>
  );
}
