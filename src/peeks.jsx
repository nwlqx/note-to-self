// Quick views that open when you hover a tab in the menu bar (Mac and other mouse devices only).
// Projects has its own in App.jsx; these cover To-do, Calendar, Meals and Budgeting.
import React, { useEffect, useRef, useState } from 'react';
import { todayKey, sortEntries, isOpenTask } from './model.js';
import { Icon, areaStyle, projectStyle, ProjectIcon, shortDate, time12 } from './ui.jsx';
import { liveCategories, liveExpenses, liveBills, sgdOf, money, monthOf, monthLabel, BASE } from './money.js';
import { SLOTS, mealAt, mealInfo, liveRecipes, liveGroceries } from './meals.js';
import { billDueLabel } from './moneyview.jsx';

const canHover = () => typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

// Shared hover behaviour: a short delay in and out, Escape closes, focus opens it too.
export function HoverPeek({ label, children, render }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 120); };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);
  if (!canHover()) return children;
  const close = () => setOpen(false);
  return (
    <div className="peek-wrap" onMouseEnter={show} onMouseLeave={hide}
      onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(); }}>
      {children}
      {open && <div className="peek" role="group" aria-label={label}>{render(close)}</div>}
    </div>
  );
}

function Row({ style, icon, name, meta, end, onClick, current }) {
  return (
    <li style={style}>
      <button className="peek-row peek-row-plain" aria-current={current ? 'page' : undefined} onClick={onClick}>
        <span className="peek-icon">{icon}</span>
        <span className="peek-text">
          <span className="peek-name">{name}</span>
          {meta && <span className="peek-meta">{meta}</span>}
        </span>
        {end != null && <span className="peek-end">{end}</span>}
      </button>
    </li>
  );
}

function Foot({ label, onClick }) {
  return <button className="peek-all" onClick={onClick}>{label}<Icon name="arrow" size={14} /></button>;
}

const entryIcon = (e, projectsById) => {
  const p = projectsById[e.projectId];
  if (p?.icon) return <ProjectIcon project={p} size={16} />;
  if (e.source === 'bill') return <span className="peek-glyph">$</span>;
  if (e.kind === 'event' || e.source === 'calendar') return <Icon name="calendar" size={15} />;
  return <Icon name="check" size={15} />;
};
const entryStyle = (e, projectsById, areasById) => {
  const p = projectsById[e.projectId];
  return p ? projectStyle(p, areasById[p.area]) : areaStyle(areasById[e.area]);
};

// ---------- To-do: what's due or overdue, then what's in Do ----------
export function TodoPeek({ items, entries, projects, areasById, onOpenCard, onOpenEntry, onAll, children }) {
  const today = todayKey();
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const due = sortEntries(entries.filter((e) => (e.source === 'bill' || (e.source === 'item' && isOpenTask(e))) && e.date && e.date <= today));
  const doNow = (items || []).filter((c) => !c.deleted && !c.done && c.quadrant === 'do' && !(c.date && c.date <= today))
    .sort((a, b) => (a.qOrder ?? 0) - (b.qOrder ?? 0));
  const rows = [
    ...due.map((e) => ({ key: e.key, e, meta: e.source === 'bill' ? `${e.cost}, due today` : e.date < today ? `Overdue, ${shortDate(e.date)}` : 'Due today' })),
    ...doNow.map((c) => ({ key: 'i:' + c.id, e: { source: 'item', kind: 'task', title: c.title, projectId: c.projectId, area: c.area, item: c }, meta: c.date ? `Do, due ${shortDate(c.date)}` : 'Do' })),
  ];
  const overdue = due.filter((e) => e.date < today).length;
  return (
    <HoverPeek label="To-do at a glance" render={(close) => (
      <>
        <p className="peek-head">To-do{due.length ? `, ${due.length} due today${overdue ? ` (${overdue} overdue)` : ''}` : ''}</p>
        {rows.length ? (
          <ul className="peek-list">
            {rows.slice(0, 6).map(({ key, e, meta }) => (
              <Row key={key} style={entryStyle(e, projectsById, areasById)} icon={entryIcon(e, projectsById)} name={e.title}
                meta={<span className={meta.startsWith('Overdue') ? 'peek-late' : undefined}>{meta}</span>}
                onClick={() => { close(); if (e.source === 'item') onOpenCard(e.item.id); else onOpenEntry(e); }} />
            ))}
          </ul>
        ) : <p className="peek-empty">Nothing due today. Nice.</p>}
        <Foot label={rows.length > 6 ? `Open To-do, ${rows.length - 6} more` : 'Open To-do'} onClick={() => { close(); onAll(); }} />
      </>
    )}>{children}</HoverPeek>
  );
}

// ---------- Calendar: today's schedule ----------
export function CalendarPeek({ entries, projects, areasById, onOpenEntry, onAll, children }) {
  const today = todayKey();
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const events = sortEntries(entries.filter((e) => (e.source === 'calendar' || e.kind === 'event') && e.date <= today && (e.endDate || e.date) >= today));
  return (
    <HoverPeek label="Today's calendar" render={(close) => (
      <>
        <p className="peek-head">Today, {new Date().toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
        {events.length ? (
          <ul className="peek-list">
            {events.slice(0, 6).map((e) => (
              <Row key={e.key} style={entryStyle(e, projectsById, areasById)} icon={entryIcon(e, projectsById)} name={e.title}
                meta={e.time ? time12(e.time) : e.endDate ? `Until ${shortDate(e.endDate)}` : 'All day'}
                onClick={() => { close(); onOpenEntry(e); }} />
            ))}
          </ul>
        ) : <p className="peek-empty">Nothing on today</p>}
        <Foot label={events.length > 6 ? `Open Calendar, ${events.length - 6} more` : 'Open Calendar'} onClick={() => { close(); onAll(); }} />
      </>
    )}>{children}</HoverPeek>
  );
}

// ---------- Meals: today's three meals and the grocery list ----------
const SLOT_HUE = { breakfast: 'pink', lunch: 'sand', dinner: 'lavender', others: 'snow' }; // matches the meal grid
export function MealsPeek({ meals, onOpenMeal, onAll, children }) {
  const today = todayKey();
  const recipesById = Object.fromEntries(liveRecipes(meals).map((r) => [r.id, r]));
  const toBuy = liveGroceries(meals).filter((g) => !g.done).length;
  return (
    <HoverPeek label="Today's meals" render={(close) => (
      <>
        <p className="peek-head">Today's meals</p>
        <ul className="peek-list">
          {SLOTS.map((s) => {
            const info = mealInfo(mealAt(meals, today, s.id), recipesById);
            return (
              <Row key={s.id} style={areaStyle({ color: SLOT_HUE[s.id] })} icon={<Icon name="utensils" size={15} />}
                name={info?.name || <span className="peek-none">Nothing planned</span>} meta={s.label}
                end={info?.cost ? money(info.cost, BASE) : null}
                onClick={() => { close(); onOpenMeal(today, s.id); }} />
            );
          })}
        </ul>
        {toBuy > 0 && <p className="peek-note">{toBuy} thing{toBuy === 1 ? '' : 's'} on the grocery list</p>}
        <Foot label="Open Meals" onClick={() => { close(); onAll(); }} />
      </>
    )}>{children}</HoverPeek>
  );
}

// ---------- Budgeting: the month so far and the next bills ----------
export function MoneyPeek({ money: m, onOpenBill, onAll, children }) {
  const today = todayKey();
  const ym = monthOf(today);
  const spent = liveExpenses(m).filter((x) => monthOf(x.date) === ym).reduce((s, x) => s + sgdOf(x), 0);
  const budget = liveCategories(m).reduce((s, c) => s + (c.budget || 0), 0);
  const over = budget && spent > budget;
  const bills = liveBills(m).sort((a, b) => a.next.localeCompare(b.next)).slice(0, 3);
  const catsById = Object.fromEntries(liveCategories(m).map((c) => [c.id, c]));
  return (
    <HoverPeek label="Budgeting at a glance" render={(close) => (
      <>
        <p className="peek-head">{monthLabel(ym).split(' ')[0]} so far</p>
        <div className="peek-money">
          <span className="peek-money-num">{money(spent)}</span>
          {budget > 0 && <span className="peek-meta">of {money(budget, BASE, { compact: true })}</span>}
          {budget > 0 && (
            <span className="peek-money-bar" data-over={over || undefined} aria-hidden="true"><span style={{ width: `${Math.min(100, (spent / budget) * 100)}%` }} /></span>
          )}
          {budget > 0 && <span className={`peek-meta${over ? ' peek-late' : ''}`}>{over ? `${money(spent - budget)} over budget` : `${money(budget - spent)} left`}</span>}
        </div>
        {bills.length > 0 && (
          <>
            <p className="peek-head peek-sub">Next bills</p>
            <ul className="peek-list">
              {bills.map((b) => (
                <Row key={b.id} style={areaStyle(catsById[b.category] ? { color: catsById[b.category].color } : null)} icon={<span className="peek-glyph">$</span>}
                  name={b.name} meta={<span className={b.next < today ? 'peek-late' : undefined}>{billDueLabel(b, today)}</span>}
                  end={money(b.amount, b.currency || BASE)} onClick={() => { close(); onOpenBill(b.id); }} />
              ))}
            </ul>
          </>
        )}
        <Foot label="Open Budgeting" onClick={() => { close(); onAll(); }} />
      </>
    )}>{children}</HoverPeek>
  );
}
