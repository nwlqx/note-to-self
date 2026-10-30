// The to-do matrix (home). Tasks and deadlines from anywhere, placed by hand
// into one of four quadrants. Anything not placed yet waits in "To sort".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { QUADRANTS, todayKey, dateKey, uid, sortEntries, covers, addDays, startOfWeek, isOpenTask, hueOf } from './model.js';
import { useDragSort, dropOrder } from './drag.js';
import { Icon, Mark, entryGlyph, areaColor, areaStyle, projectStyle, ProjectIcon, shortDate, dayDate, time12 } from './ui.jsx';
import { DragGhost, InlineAdd, cardGlyph } from './projects.jsx';

export function useWide(query = '(min-width: 900px)') {
  const [wide, setWide] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setWide(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return wide;
}

const byQOrder = (a, b) => (a.qOrder ?? 0) - (b.qOrder ?? 0) || (a.createdAt || '').localeCompare(b.createdAt || '');
const byDue = (a, b) => (a.date || '9999') .localeCompare(b.date || '9999') || (b.createdAt || '').localeCompare(a.createdAt || '');

// A small 2×2 of buttons for placing a task without dragging.
export function QuadPicker({ value, onPick, onClear, compact = false }) {
  return (
    <div className={`quad-picker${compact ? ' compact' : ''}`} role="radiogroup" aria-label="Priority">
      {QUADRANTS.map((q) => (
        <button key={q.id} type="button" role="radio" aria-checked={value === q.id} data-q={q.id}
          onClick={() => onPick(q.id)} title={q.hint}>
          {q.name}
        </button>
      ))}
      {onClear && value && <button type="button" className="text-btn small quiet quad-clear" onClick={onClear}>Not sorted</button>}
    </div>
  );
}

export function TodoView({ hub, areas, areasById, projects, onOpenCard, entries = [], onOpen, onOpenProject, onOpenDay, onOpenWeek }) {
  const wide = useWide();
  const items = hub.data.items.items;
  const projectsById = useMemo(() => Object.fromEntries(projects.map((p) => [p.id, p])), [projects]);
  const [hidden, setHidden] = useState(() => new Set());
  const [focus, setFocus] = useState(null); // a quadrant opened full width on phones
  const [showAllTray, setShowAllTray] = useState(false);
  const [sorting, setSorting] = useState(null); // tray item whose picker is open
  // Show one project's tasks at a time: '' = all, 'none' = tasks outside projects.
  const [proj, setProjState] = useState(() => { try { return localStorage.getItem('hub.todoProject') || ''; } catch { return ''; } });
  const setProj = (v) => { setProjState(v); try { localStorage.setItem('hub.todoProject', v); } catch { /* ignore */ } };
  const today = todayKey();

  const areaOf = (c) => projectsById[c.projectId]?.area || c.area || 'none';
  const open = items.filter((c) => !c.deleted && !c.done && (c.kind === 'task' || c.kind === 'deadline' || !c.kind)
    && !(c.projectId && !projectsById[c.projectId]) && !projectsById[c.projectId]?.archived);
  const projOk = (c) => !proj || (proj === 'none' ? !projectsById[c.projectId] : c.projectId === proj);
  const visible = open.filter((c) => !hidden.has(areaOf(c)) && projOk(c));
  // Ticked off today: stays in its quadrant, greyed out at the bottom, until tomorrow.
  const doneHere = items.filter((c) => !c.deleted && c.done && c.quadrant && c.doneAt && dateKey(new Date(c.doneAt)) === today
    && !hidden.has(areaOf(c)) && projOk(c) && !(c.projectId && !projectsById[c.projectId]));
  const zones = useMemo(() => {
    const z = { tray: [] };
    for (const q of QUADRANTS) z[q.id] = [];
    for (const c of visible) (z[c.quadrant] || z.tray).push(c);
    for (const q of QUADRANTS) z[q.id].sort(byQOrder);
    for (const c of doneHere) if (z[c.quadrant]) z[c.quadrant].push(c);
    z.tray.sort(byDue);
    return z;
  }, [visible, doneHere.map((c) => c.id).join()]); // eslint-disable-line
  const zonesRef = useRef(zones);
  zonesRef.current = zones;
  const doneToday = items.filter((c) => !c.deleted && c.done && c.doneAt && dateKey(new Date(c.doneAt)) === today).length;
  const hasNoArea = open.some((c) => areaOf(c) === 'none');

  const place = (id, quadrant, index) => {
    const list = (zonesRef.current[quadrant] || []).filter((c) => !c.done);
    hub.upsertItem({ id, quadrant, qOrder: index == null ? (list.length ? (list[list.length - 1].qOrder ?? 0) + 1000 : 1000) : dropOrder(list, id, index, 'qOrder') });
  };
  const { drag, onPointerDown, rowsFor, wasDrag } = useDragSort({
    onDrop: ({ id, zone, index }) => {
      if (zone === 'tray') hub.upsertItem({ id, quadrant: '' });
      else place(id, zone, index);
    },
  });

  const toggleArea = (id) => setHidden((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const addTo = (quadrant, title) => {
    const onlyArea = areas.filter((a) => !hidden.has(a.id));
    hub.saveCard({
      id: 'c-' + uid(), title, kind: 'task', projectId: projectsById[proj] ? proj : '', area: onlyArea.length === 1 ? onlyArea[0].id : '',
      quadrant, qOrder: (zonesRef.current[quadrant] || []).reduce((m, c) => Math.max(m, c.qOrder ?? 0), 0) + 1000,
    });
  };

  const meta = (c) => {
    const bits = [];
    if (c.date) bits.push(<span key="d" className={`due-chip${c.date < today ? ' late' : ''}`}>Due {wide ? dayDate(c.date) : shortDate(c.date)}</span>);
    return bits.length ? <span className="card-meta">{bits}</span> : null;
  };

  // Render helpers (plain functions, not components, so inputs inside keep focus).
  const renderRow = ({ c, dragging, lineBefore }, zone) => {
    const area = areasById[areaOf(c)];
    return (
      <React.Fragment key={c.id}>
        {lineBefore && <li className="drop-line" style={{ height: drag.h }} />}
        <li hidden={dragging || undefined}>
          <div className="todo-row" data-drag-id={c.done ? undefined : c.id} data-done={c.done || undefined} style={areaStyle(area)}
            onPointerDown={(e) => !c.done && onPointerDown(e, { id: c.id, title: c.title, zone, mark: cardGlyph(c) })}
            onContextMenu={(e) => e.preventDefault()}>
            <button className="todo-body" onClick={() => !wasDrag() && onOpenCard(c.id)}>
              <span className="todo-title">
                {projectsById[c.projectId]?.icon && proj !== c.projectId && (
                  <span className="todo-proj-icon" title={projectsById[c.projectId].name}>
                    <ProjectIcon project={projectsById[c.projectId]} size={15} />
                    <span className="sr-only">{projectsById[c.projectId].name}: </span>
                  </span>
                )}
                {c.title}
              </span>
              {meta(c)}
            </button>
            {(
              <button className="check todo-check no-drag" aria-pressed={!!c.done} aria-label={c.done ? `Mark "${c.title}" not done` : `Mark "${c.title}" done`}
                onClick={() => hub.toggleDone(c.id)}>
                {c.done && <Icon name="check" size={14} />}
              </button>
            )}
            {zone === 'tray' && (
              <button className="icon-btn no-drag sort-btn" aria-expanded={sorting === c.id} aria-label={`Sort "${c.title}" into a quadrant`}
                onClick={() => setSorting(sorting === c.id ? null : c.id)}>
                <Icon name="grid" size={18} />
              </button>
            )}
          </div>
          {sorting === c.id && (
            <div className="row-picker">
              <QuadPicker compact onPick={(q) => { place(c.id, q); setSorting(null); }} />
            </div>
          )}
        </li>
      </React.Fragment>
    );
  };

  const renderQuadrant = (q) => {
    const list = zones[q.id];
    const { rows, lineAtEnd } = rowsFor(list, q.id);
    const limit = wide || focus === q.id ? Infinity : 4;
    const shown = rows.slice(0, drag ? rows.length : limit);
    const more = rows.length - shown.length;
    return (
      <section key={q.id} className="quad-cell" data-drop={q.id} data-q={q.id} aria-labelledby={`q-${q.id}`}>
        <header className="quad-head">
          <button className="quad-title" id={`q-${q.id}`} onClick={() => !wide && setFocus(focus === q.id ? null : q.id)} disabled={wide}>
            <span className="quad-name">{q.name}</span>
            <span className="sr-only">, {list.length}</span>
          </button>
          <span className="quad-hint">{q.hint}</span>
        </header>
        <div className="quad" data-q={q.id}>
          <ul className="todo-list">
            {shown.map((r) => renderRow(r, q.id))}
            {lineAtEnd && <li className="drop-line" style={{ height: drag.h }} />}
          </ul>
          {more > 0 && <button className="text-btn small quiet" onClick={() => setFocus(q.id)}>{more} more</button>}
          {(wide || focus === q.id) && <InlineAdd label="Add a task" placeholder="Task" onAdd={(t) => addTo(q.id, t)} />}
          {!wide && focus !== q.id && list.length === 0 && <p className="quad-empty">Empty</p>}
        </div>
      </section>
    );
  };

  const trayRows = rowsFor(zones.tray, 'tray');
  const trayShown = showAllTray || drag ? trayRows.rows : trayRows.rows.slice(0, 8);

  return (
    <section className="view todo" aria-label="To-do">
      <Greeting name={hub.data.settings.name} />
      <Bento entries={entries} items={items} projects={projects} areasById={areasById}
        onOpenDay={onOpenDay} onOpenWeek={onOpenWeek} onOpenProject={onOpenProject} />

      <header className="todo-head">
        <h2>To-do</h2>
        <ProjectFilter projects={projects.filter((p) => !p.archived)} value={proj} onChange={setProj} />
      </header>

      <div className="todo-layout">
        {focus && !wide ? (
          <div className="quad-focus">
            <button className="back" onClick={() => setFocus(null)}><Icon name="left" size={18} />All four</button>
            {renderQuadrant(QUADRANTS.find((q) => q.id === focus))}
          </div>
        ) : (
          <div className="matrix-wrap">
            <div className="axis axis-top" aria-hidden="true"><span>Urgent</span><span>Not urgent</span></div>
            <div className="axis axis-side" aria-hidden="true"><span>Important</span><span>Not important</span></div>
            <div className="matrix">
              {QUADRANTS.map((q) => renderQuadrant(q))}
            </div>
          </div>
        )}

        <section className="tray" data-drop="tray" aria-labelledby="tray-head">
          <header className="tray-head">
            <h2 id="tray-head"><span className="hl-text">To sort</span> <span className="count">{zones.tray.length}</span></h2>
            {!zones.tray.length && <p className="sticker">all sorted, nice work</p>}
          </header>
          <ul className="todo-list">
            {trayShown.map((r) => renderRow(r, 'tray'))}
            {trayRows.lineAtEnd && <li className="drop-line" style={{ height: drag.h }} />}
          </ul>
          {!showAllTray && trayRows.rows.length > 8 && (
            <button className="text-btn small quiet" onClick={() => setShowAllTray(true)}>Show all {trayRows.rows.length}</button>
          )}
          <InlineAdd label="Add a task" placeholder="Task" onAdd={(t) => addTo('', t)} />
        </section>
      </div>
      <DragGhost drag={drag} />
    </section>
  );
}

// A quiet picker beside the count: show every task, one project's, or tasks outside projects.
function ProjectFilter({ projects, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [open]);
  if (!projects.length) return null;
  const cur = projects.find((p) => p.id === value);
  const label = value === 'none' ? 'No project' : cur ? cur.name : 'All projects';
  const pick = (v) => { onChange(v); setOpen(false); };
  return (
    <div className="proj-filter" ref={ref}>
      <button className={`proj-filter-btn${value ? ' on' : ''}`} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {cur && <ProjectIcon project={cur} size={14} />}
        <span>{label}</span>
        <Icon name="down" size={14} />
      </button>
      {value && <button className="icon-btn proj-filter-clear" aria-label="Show all projects" onClick={() => onChange('')}><Icon name="close" size={14} /></button>}
      {open && (
        <div className="section-menu proj-filter-menu" role="menu">
          <button role="menuitemradio" aria-checked={!value} onClick={() => pick('')}>All projects</button>
          {projects.map((p) => (
            <button key={p.id} role="menuitemradio" aria-checked={value === p.id} onClick={() => pick(p.id)}>
              <ProjectIcon project={p} size={14} />{p.name}
            </button>
          ))}
          <button role="menuitemradio" aria-checked={value === 'none'} onClick={() => pick('none')}>No project</button>
        </div>
      )}
    </div>
  );
}

// ---------- greeting and summary tiles ----------
function Greeting({ name }) {
  const h = new Date().getHours();
  const hello = h < 5 ? 'Hello' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return (
    <header className="greeting">
      <h1>
        <span className="greeting-hello">{hello}{name ? ',' : ''}</span>
        {name && <span className="greeting-name">{name}</span>}
      </h1>
      <p className="greeting-date">{new Date().toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    </header>
  );
}

function Bento({ entries, items, projects, areasById, onOpenDay, onOpenWeek, onOpenProject }) {
  const today = todayKey();
  const now = new Date();
  const todays = sortEntries(entries.filter((e) => e.kind === 'event' && e.date && covers(e, today)));
  const weekEnd = addDays(startOfWeek(today), 6);
  const dueWeek = entries.filter((e) => e.source === 'item' && isOpenTask(e) && e.date && e.date <= weekEnd);
  const overdue = dueWeek.filter((e) => e.date < today).length;

  // Tasks and deadlines due today, with anything overdue first.
  const dueToday = sortEntries(entries.filter((e) => ((e.source === 'item' && isOpenTask(e)) || e.source === 'bill') && e.date && e.date <= today));
  const todayHue = null; // the Today tile is colourless, so no event can match it

  return (
    <div className="bento">
      <button className="tile tile-today"
        onClick={() => onOpenDay?.(today)} aria-label={`Today, ${todays.length ? `${todays.length} thing${todays.length === 1 ? '' : 's'} on` : 'nothing on'}`}>
        <span className="cal-head">
          <span className="cal-num">{now.getDate()}</span>
          <span className="cal-when">
            <span className="cal-dow">{now.toLocaleDateString('en-SG', { weekday: 'long' })}</span>
            <span className="cal-month">{now.toLocaleDateString('en-SG', { month: 'long' })}</span>
          </span>
          <span className="tile-arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
        </span>
        {todays.length ? (
          <ul className="cal-events">
            {todays.slice(0, 3).map((e) => (
              <li key={e.key} className="cal-event" data-kind={e.kind} style={areaStyle(areasById[e.area])}
                data-same={hueOf(areasById[e.area]?.color) === todayHue ? '' : undefined}>
                <span className="cal-time">{e.time ? time12(e.time) : e.kind === 'deadline' ? 'Due today' : 'All day'}</span>
                <span className="cal-title">{e.title}</span>
              </li>
            ))}
            {todays.length > 3 && <li className="cal-more">+{todays.length - 3} more</li>}
          </ul>
        ) : (
          <span className="tile-empty">Nothing on today</span>
        )}
      </button>

      <div className="tile tile-due-all">
        <button className="due-head" onClick={() => onOpenDay?.(today)}>
          <span className="tile-label">Due today</span>
          <span className="tile-arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
        </button>
        {dueToday.length ? (
          <ul className="due-list">
            {dueToday.slice(0, 4).map((e) => (
              <li key={e.key} data-kind={e.kind} data-bill={e.source === 'bill' || undefined}>
                <span className="due-mark" aria-hidden="true">{entryGlyph(e)}</span>
                <span className="due-text">
                  <span className="due-title">{e.title}</span>
                  {e.source === 'bill' && <span className="due-cost">{e.cost} <span className="due-cost-tag">{e.bill.every === 'year' ? 'yearly bill' : e.bill.every === 'week' ? 'weekly bill' : 'monthly bill'}</span></span>}
                  {e.date < today && <span className="due-late">Overdue, {shortDate(e.date)}</span>}
                </span>
              </li>
            ))}
            {dueToday.length > 4 && <li className="cal-more">+{dueToday.length - 4} more</li>}
          </ul>
        ) : (
          <span className="tile-empty">Nothing due today</span>
        )}
        <button className="due-week" onClick={() => onOpenWeek?.()}>
          <span className="due-week-num">{dueWeek.length}</span>
          <span className="due-week-text">
            <span>due this week</span>
            <span className="due-week-meta">{overdue ? `${overdue} overdue` : dueWeek.length ? 'tasks and deadlines' : 'all clear'}</span>
          </span>
          <Icon name="arrow" size={16} />
        </button>
      </div>

    </div>
  );
}

