// To buy: a shopping list sorted the Eisenhower way, by need or want and soon or can wait.
// Lives on the Budgeting page; items are stored in money.json under `buys`.
import React, { useRef, useState } from 'react';
import { todayKey, addDays, daysBetween } from './model.js';
import { BASE, BUY_QUADRANTS, liveBuys, liveCategories, buySgd, money, newBuy, rateFor, COMMON_CURRENCIES } from './money.js';
import { useDragSort, dropOrder } from './drag.js';
import { Sheet, Icon, ConfirmButton, ProjectIcon, areaStyle, shortDate } from './ui.jsx';
import { DragGhost, InlineAdd } from './projects.jsx';
import { useWide } from './todo.jsx';

const KEEP_BOUGHT_DAYS = 7; // bought items stay, greyed out, for a week so you can log them

export function ToBuy({ hub, projects, onSheet }) {
  const wide = useWide();
  const m = hub.data.money;
  const today = todayKey();
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const [focus, setFocus] = useState(null); // a quadrant opened full width on phones, as on To-do
  const all = liveBuys(m);
  const shown = all.filter((b) => !b.bought || (b.boughtOn && b.boughtOn >= addDays(today, -KEEP_BOUGHT_DAYS)));
  const zones = {};
  for (const q of BUY_QUADRANTS) {
    const list = shown.filter((b) => (b.quadrant || 'do') === q.id);
    zones[q.id] = [...list.filter((b) => !b.bought).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), ...list.filter((b) => b.bought)];
  }
  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const { drag, onPointerDown, rowsFor, wasDrag } = useDragSort({
    onDrop: ({ id, zone, index }) => {
      const q = BUY_QUADRANTS.find((x) => x.id === zone);
      const b = all.find((x) => x.id === id);
      if (!q || !b) return;
      const list = (zonesRef.current[zone] || []).filter((x) => !x.bought);
      hub.saveBuy({ ...b, quadrant: zone, order: dropOrder(list, id, index, 'order') });
    },
  });

  const add = (quadrant, name, price) => {
    const list = zonesRef.current[quadrant] || [];
    hub.saveBuy(newBuy({ name, price, quadrant, order: list.reduce((mx, b) => Math.max(mx, b.order ?? 0), 0) + 1000 }));
  };

  const renderRow = ({ c: b, dragging, lineBefore }, zone) => {
    const p = projectsById[b.projectId];
    const waited = b.addedOn ? daysBetween(b.addedOn, today) : 0;
    return (
      <React.Fragment key={b.id}>
        {lineBefore && <li className="drop-line" style={{ height: drag.h }} />}
        <li hidden={dragging || undefined}>
          <div className="todo-row buy-row" data-drag-id={b.bought ? undefined : b.id} data-done={b.bought || undefined}
            onPointerDown={(e) => !b.bought && onPointerDown(e, { id: b.id, title: b.name, zone, mark: '•' })}
            onContextMenu={(e) => e.preventDefault()}>
            <button className="todo-body" onClick={() => !wasDrag() && onSheet({ type: 'buy', id: b.id })}>
              <span className="todo-title">
                {p?.icon && (
                  <span className="todo-proj-icon" title={p.name}><ProjectIcon project={p} size={15} /><span className="sr-only">{p.name}: </span></span>
                )}
                {b.name}
              </span>
              {(Number(b.price) > 0 || (zone === 'delegate' && !b.bought) || b.bought) && (
                <span className="card-meta">
                  {Number(b.price) > 0 && <span className="buy-price">{money(Number(b.price), b.currency || BASE, { compact: Number.isInteger(Number(b.price)) })}</span>}
                  {zone === 'delegate' && !b.bought && <span>{waited < 1 ? 'Added today' : waited === 1 ? 'Added yesterday' : `Added ${waited} days ago`}</span>}
                  {b.bought && <span>{b.expenseId ? 'Bought and logged' : `Bought ${b.boughtOn === today ? 'today' : shortDate(b.boughtOn)}`}</span>}
                </span>
              )}
            </button>
            {b.bought && !b.expenseId && (
              <button className="text-btn small buy-log no-drag" onClick={() => hub.logBuy(b.id)} aria-label={`Log ${b.name} as spending`}>Log it</button>
            )}
            <button className="check todo-check no-drag" aria-pressed={!!b.bought} aria-label={b.bought ? `Mark "${b.name}" not bought` : `Mark "${b.name}" bought`}
              onClick={() => hub.toggleBought(b.id)}>
              {b.bought && <Icon name="check" size={14} />}
            </button>
          </div>
        </li>
      </React.Fragment>
    );
  };

  const renderQuadrant = (q) => {
    const list = zones[q.id];
    const { rows, lineAtEnd } = rowsFor(list, q.id);
    const limit = wide || focus === q.id ? Infinity : 4;
    const vis = rows.slice(0, drag ? rows.length : limit);
    const more = rows.length - vis.length;
    const left = list.filter((b) => !b.bought);
    const count = left.length;
    const total = left.reduce((s, b) => s + buySgd(b, m), 0);
    return (
      <section key={q.id} className="quad-cell" data-drop={q.id} data-q={q.id} aria-labelledby={`bq-${q.id}`}>
        <header className="quad-head">
          <button className="quad-title" id={`bq-${q.id}`} onClick={() => !wide && setFocus(focus === q.id ? null : q.id)} disabled={wide}>
            <span className="quad-name">{q.name}</span>
            {!wide && focus !== q.id && <span className="sr-only">, open full screen</span>}
            {!wide && focus !== q.id && <span className="quad-open" aria-hidden="true"><Icon name="arrow" size={14} /></span>}
          </button>
          <span className="quad-hint">{q.hint}</span>
        </header>
        <div className="quad" data-q={q.id}>
          <ul className="todo-list">
            {vis.map((r) => renderRow(r, q.id))}
            {lineAtEnd && <li className="drop-line" style={{ height: drag.h }} />}
          </ul>
          {more > 0 && <button className="text-btn small quiet" onClick={() => setFocus(q.id)}>{more} more</button>}
          <InlineAdd label="Add an item" placeholder="Item" extra="price" onAdd={(t, price) => add(q.id, t, price)} />
          <div className="buy-foot">
            {count > 0 && (
              <span className="buy-total">{count} item{count === 1 ? '' : 's'}{total > 0 ? <>, <strong>{money(total, BASE, { compact: total >= 100 || Number.isInteger(total) })}</strong></> : ''}</span>
            )}
          </div>
        </div>
      </section>
    );
  };

  return (
    <section className="m-section to-buy" aria-labelledby="m-tobuy">
      <h2 className="sr-only" id="m-tobuy">To buy</h2>
      {focus && !wide ? (
        <div className="quad-focus">
          <button className="back" onClick={() => setFocus(null)}><Icon name="left" size={18} />Back</button>
          {renderQuadrant(BUY_QUADRANTS.find((q) => q.id === focus))}
        </div>
      ) : (
        <div className="matrix-wrap">
          <div className="axis axis-top" aria-hidden="true"><span>Soon</span><span>Can wait</span></div>
          <div className="axis axis-side" aria-hidden="true"><span>Need</span><span>Want</span></div>
          <div className="matrix">{BUY_QUADRANTS.map(renderQuadrant)}</div>
        </div>
      )}
      <DragGhost drag={drag} />
    </section>
  );
}

// ---------- the item sheet ----------
const currencyList = (m, extra) => [...new Set([...COMMON_CURRENCIES, ...Object.keys(m?.rates || {}), ...(extra ? [extra] : [])])];

export function BuySheet({ hub, id, defaults, projects, onClose }) {
  const m = hub.data.money;
  const stored = id ? liveBuys(m).find((x) => x.id === id) : null;
  const cats = liveCategories(m);
  const [f, setF] = useState(() => {
    const base = stored || newBuy(defaults);
    return { ...base, price: base.price === '' || base.price == null ? '' : String(base.price) };
  });
  const set = (x) => setF((cur) => ({ ...cur, ...x }));
  const valid = f.name.trim();
  const cur = f.currency || BASE;

  const save = (e) => {
    e?.preventDefault();
    if (!valid) return;
    const moved = stored && stored.quadrant !== f.quadrant;
    hub.saveBuy({ ...f, name: f.name.trim(), price: f.price === '' ? '' : Number(f.price) || 0, ...(moved || !stored ? { order: Date.now() } : {}) });
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label={stored ? 'To buy' : 'New item to buy'} onSubmit={save}>
      <h2 className="sheet-heading">{stored ? 'To buy' : 'Something to buy'}</h2>
      <input data-autofocus className="title-input" value={f.name} placeholder="What is it? e.g. Thermal gloves" aria-label="Item" onChange={(e) => set({ name: e.target.value })} />
      <fieldset>
        <legend>Where it goes</legend>
        <div className="quad-picker buy-picker" role="radiogroup" aria-label="Where it goes">
          {BUY_QUADRANTS.map((q) => (
            <button type="button" key={q.id} role="radio" data-q={q.id} aria-checked={f.quadrant === q.id} onClick={() => set({ quadrant: q.id })}>
              <strong>{q.name}</strong><small>{q.hint}</small>
            </button>
          ))}
        </div>
      </fieldset>
      <label className="m-field-label">Rough price
        <div className="m-amount-field">
          <select value={cur} onChange={(e) => set({ currency: e.target.value })} aria-label="Currency">
            {currencyList(m, cur).map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input type="text" inputMode="decimal" value={f.price} placeholder="0.00" aria-label="Rough price"
            onChange={(e) => set({ price: e.target.value.replace(/[^\d.,]/g, '').replace(/,/g, '') })} />
        </div>
      </label>
      {cur !== BASE && !rateFor(m, cur) && <p className="hint">Add a {cur} rate under Currencies to count this in SGD.</p>}
      <div className="field-grid">
        <label>Project
          <select value={f.projectId || ''} onChange={(e) => set({ projectId: e.target.value })}>
            <option value="">None</option>
            {projects.filter((p) => !p.archived || p.id === f.projectId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
        <label>Link<input type="url" value={f.link || ''} placeholder="https://" onChange={(e) => set({ link: e.target.value })} /></label>
      </div>
      <fieldset>
        <legend>Category, when you log it</legend>
        <div className="filters m-cat-chips" role="radiogroup" aria-label="Category">
          {cats.map((c) => (
            <button type="button" key={c.id} role="radio" aria-checked={f.category === c.id} className="chip" style={areaStyle({ color: c.color })}
              onClick={() => set({ category: f.category === c.id ? '' : c.id })}>
              <span className="chip-dot" />{c.name}
            </button>
          ))}
        </div>
      </fieldset>
      <label>Notes<textarea rows={2} value={f.note || ''} placeholder="Size, colour, where to get it" onChange={(e) => set({ note: e.target.value })} /></label>
      {f.link && /^https?:\/\//.test(f.link) && <a className="text-btn small buy-open" href={f.link} target="_blank" rel="noreferrer">Open link<Icon name="arrow" size={14} /></a>}
      {stored && !stored.expenseId && (
        <div className="m-bill-actions">
          <button type="button" className="secondary" onClick={() => { hub.logBuy(stored.id, { ...f, name: f.name.trim() || stored.name, price: Number(f.price) || 0 }); onClose(); }}>
            <Icon name="check" size={16} />Bought it, log spending
          </button>
        </div>
      )}
      {stored?.expenseId && <p className="hint">Bought and logged as spending{stored.boughtOn ? ` on ${shortDate(stored.boughtOn)}` : ''}.</p>}
      <div className="sheet-actions">
        <button className="primary" type="submit" disabled={!valid}>{stored ? 'Save' : 'Add'}</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
        {stored && (
          <span className="push-right">
            <ConfirmButton confirmText="Tap again to delete" onConfirm={() => { hub.deleteBuy(stored.id); onClose(); }}>Delete</ConfirmButton>
          </span>
        )}
      </div>
    </Sheet>
  );
}
