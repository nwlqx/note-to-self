// Projects overview (home), the project board and list, and project settings.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { normKind, listsOf, sectionOf, orderBetween, newProject, fallbackHue, PROJECT_HUES, PROJECT_ICONS, areaIcon, hueOf, todayKey, addDays, sortEntries, isOpenTask, uid } from './model.js';
import { useDragSort, dropOrder } from './drag.js';
import { DueStrip } from './calendar.jsx';
import { liveExpenses, sgdOf, money } from './money.js';
import { ProjectLists, addChecklist } from './lists.jsx';
import { Icon, EntryRow, areaColor, areaStyle, projectStyle, ProjectIcon, dayDate, shortDate, rangeLabel, metaFor, Sheet, Mark, ConfirmButton } from './ui.jsx';

const cardsOf = (items, projectId) => items.filter((x) => !x.deleted && x.projectId === projectId);
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt || '').localeCompare(b.createdAt || '');

// ---------- overview ----------
export function ProjectsOverview({ hub, areas, projects, entries, areasById, onOpenProject, onOpen, onToggle, onNewProject, onAddCard }) {
  const items = hub.data.items.items;
  const [showArchived, setShowArchived] = useState(false);
  const [only, setOnly] = useState('all');
  const archived = projects.filter((p) => p.archived);

  return (
    <section className="view overview" aria-label="Projects">
      <header className="view-head"><h1>Projects</h1></header>

      <DueStrip entries={entries} areasById={areasById} projects={projects} onOpen={onOpen} onToggle={onToggle} />

      <div className="filters" role="radiogroup" aria-label="Show projects from">
        <button className="chip chip-plain" role="radio" aria-checked={only === 'all'} aria-pressed={only === 'all'} onClick={() => setOnly('all')}>
          All<span className="chip-count">{projects.filter((p) => !p.archived).length}</span>
        </button>
        {areas.map((a) => (
          <button key={a.id} className="chip" role="radio" aria-checked={only === a.id} aria-pressed={only === 'all' || only === a.id}
            style={areaStyle(a)} onClick={() => setOnly(only === a.id ? 'all' : a.id)}>
            <span className="chip-dot" />{a.name}<span className="chip-count">{projects.filter((p) => p.area === a.id && !p.archived).length}</span>
          </button>
        ))}
      </div>

      {areas.filter((a) => only === 'all' || only === a.id).map((a) => {
        const list = projects.filter((p) => p.area === a.id && !p.archived);
        const loose = sortEntries(entries.filter((e) => e.source === 'item' && !e.projectId && e.area === a.id && !e.done));
        return (
          <section key={a.id} className="area-block" style={areaStyle(a)}>
            <div className="area-head">
              <h2>{areaIcon(a)
                ? <span className="area-icon" aria-hidden="true"><Icon name={areaIcon(a)} size={18} /></span>
                : <span className="area-swatch" aria-hidden="true" />}<span className="hl-text">{a.name}</span></h2>
              <button className="text-btn small add-inline" aria-label={`New project in ${a.name}`} onClick={() => onNewProject(a.id)}><Icon name="plus" size={14} />Add</button>
            </div>
            {list.length === 0 && loose.length === 0 && (
              <p className="month-empty">No projects yet</p>
            )}
            <ul className="project-list">
              {list.map((p) => <ProjectRow key={p.id} project={p} area={a} cards={cardsOf(items, p.id)} listItems={listsOf(hub.data.settings, p.id).flatMap((l) => l.items || [])} onOpen={() => onOpenProject(p.id)} />)}
            </ul>
            {loose.length > 0 && (
              <div className="loose">
                <h3 className="quiet-head">Not in a project</h3>
                <ul className="entries">
                  {loose.map((e) => (
                    <EntryRow key={e.key} entry={e} areasById={areasById} onToggle={onToggle} onOpen={onOpen}
                      meta={metaFor(e, { showDate: true })} />
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      {archived.length > 0 && (
        <div className="archived">
          <button className="text-btn small quiet" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? 'Hide archived projects' : `Show ${archived.length} archived ${archived.length === 1 ? 'project' : 'projects'}`}
          </button>
          {showArchived && (
            <ul className="project-list">
              {archived.map((p) => <ProjectRow key={p.id} project={p} area={areasById[p.area]} cards={cardsOf(items, p.id)} listItems={listsOf(hub.data.settings, p.id).flatMap((l) => l.items || [])} onOpen={() => onOpenProject(p.id)} />)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function ProjectRow({ project, cards, listItems = [], onOpen, area }) {
  const total = cards.length + listItems.length;
  const done = cards.filter((c) => c.done).length + listItems.filter((i) => i.done).length;
  const next = cards.filter((c) => !c.done && c.date).sort((a, b) => a.date.localeCompare(b.date))[0];
  const late = next && next.date < todayKey();
  return (
    <li style={projectStyle(project, area)}>
      <button className="project-row" onClick={onOpen}>
        <span className="project-top">
          <span className="project-name"><ProjectIcon project={project} size={24} /><span className="project-name-text">{project.name}</span></span>
          <span className="tile-arrow" aria-hidden="true"><Icon name="arrow" size={18} /></span>
        </span>
        <span className="entry-meta">{total ? `${done} of ${total} done` : 'Nothing added yet'}</span>
        {/* the next dated card, on its own line: date pill first, then what it is */}
        {next && (
          <span className="project-next">
            <span className="project-next-date" data-late={late || undefined}>{late ? 'Overdue, ' : ''}{shortDate(next.date)}</span>
            <span className="project-next-title"><span className="sr-only">Next: </span>{next.title}</span>
          </span>
        )}
        {total > 0 && (
          <span className="progress" aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></span>
        )}
      </button>
    </li>
  );
}

// ---------- project view ----------
const layoutKey = (id) => `hub.layout.${id}`;
const loadLayout = (id) => { try { return localStorage.getItem(layoutKey(id)) || 'board'; } catch { return 'board'; } };

export function ProjectView({ hub, project, areasById, onBack, onOpenCard, onEditProject, onOpenSpending }) {
  const [layout, setLayoutState] = useState(() => loadLayout(project.id));
  const setLayout = (l) => { setLayoutState(l); try { localStorage.setItem(layoutKey(project.id), l); } catch { /* ignore */ } };
  const area = areasById[project.area];
  const cards = cardsOf(hub.data.items.items, project.id);
  const bySection = useMemo(() => {
    const m = Object.fromEntries(project.sections.map((s) => [s.id, []]));
    for (const c of cards) {
      const s = sectionOf(c, project);
      if (m[s]) m[s].push(c);
    }
    for (const k of Object.keys(m)) m[k].sort(byOrder);
    return m;
  }, [cards, project]);

  const hasLists = listsOf(hub.data.settings, project.id).length > 0;

  const addCard = (section, title) => {
    const list = bySection[section] || [];
    hub.saveCard({
      id: 'c-' + uid(), title, kind: 'task', projectId: project.id, section, area: project.area,
      order: orderBetween(list.length ? list[list.length - 1].order ?? 0 : null, null),
    });
  };

  return (
    <section className={`view project layout-${layout}`} aria-label={project.name} style={projectStyle(project, area)}>
      <header className="proj-header">
        <button className="back" onClick={onBack}><Icon name="left" size={18} />Projects</button>
        <div className="project-title-row">
          <div>
            <p className="project-area"><span className="area-swatch" aria-hidden="true" />{area?.name || 'No area'}{project.archived ? ', archived' : ''}</p>
            <h1><ProjectIcon project={project} size={30} />{project.name}</h1>
            <SpendPill hub={hub} project={project} onOpen={onOpenSpending} />
          </div>
          <div className="project-tools">
            <div className="seg seg-small" role="radiogroup" aria-label="Layout">
              <button role="radio" aria-checked={layout === 'board'} onClick={() => setLayout('board')}><Icon name="board" size={16} />Board</button>
              <button role="radio" aria-checked={layout === 'list'} onClick={() => setLayout('list')}><Icon name="list" size={16} />List</button>
            </div>
            <button className="icon-btn" onClick={onEditProject} aria-label="Project settings"><Icon name="more" /></button>
          </div>
        </div>
      </header>

      <div className={`proj-body${hasLists ? ' has-lists' : ''}`}>
        <div className="proj-main">
          {layout === 'board' ? (
            <Board hub={hub} project={project} bySection={bySection} onOpenCard={onOpenCard} onAdd={addCard} />
          ) : (
            <ListLayout hub={hub} project={project} bySection={bySection} area={area} onOpenCard={onOpenCard} onAdd={addCard} />
          )}
        </div>
        {hasLists && <ProjectLists hub={hub} project={project} onOpenCard={onOpenCard} />}
      </div>
    </section>
  );
}

// A small money line under the project title: spent so far, against the budget if there is one.
function SpendPill({ hub, project, onOpen }) {
  const xs = liveExpenses(hub.data.money).filter((x) => x.projectId === project.id);
  if (!onOpen || (!xs.length && !project.budget)) return null;
  const spent = xs.reduce((s, x) => s + sgdOf(x), 0);
  const over = project.budget && spent > project.budget;
  return (
    <button className="spend-pill" data-over={over || undefined} onClick={onOpen}>
      <Icon name="wallet" size={16} />
      <span>{project.budget ? <>{money(spent)} <span className="spend-of">of {money(project.budget, 'SGD', { compact: true })}</span></> : <>{money(spent)} spent</>}</span>
      {project.budget ? <span className="spend-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (spent / project.budget) * 100)}%` }} /></span> : null}
    </button>
  );
}

// `extra` adds an optional second box: 'price' passes a number to onAdd ('' when left empty),
// 'date' passes a YYYY-MM-DD due date ('' when left empty).
export function InlineAdd({ onAdd, label = 'Add card', ariaLabel = label, placeholder = 'Card title', extra = '' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [second, setSecond] = useState('');
  const nameRef = useRef(null);
  const submit = () => {
    if (text.trim()) onAdd(text.trim(), extra === 'price' && second !== '' ? Number(second) || 0 : second);
    setText('');
    setSecond('');
  };
  const close = () => { setOpen(false); setText(''); setSecond(''); };
  const onKeyDown = (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); nameRef.current?.focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
  };
  if (!open) {
    // The words after the first are wrapped so very narrow cards can shorten "Add a task" to "Add".
    const [first, ...rest] = label.split(' ');
    return (
      <button className="inline-add" aria-label={ariaLabel} onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} /><span>{first}{rest.length > 0 && <span className="inline-add-rest">{' ' + rest.join(' ')}</span>}</span>
      </button>
    );
  }
  return (
    // Moving between the two boxes isn't leaving the form, so only submit when focus goes elsewhere.
    <div className="inline-add-form" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) { submit(); setOpen(false); } }}>
      <div className={extra ? 'inline-add-row' : undefined}>
        <input ref={nameRef} autoFocus value={text} placeholder={placeholder} aria-label={placeholder}
          onChange={(e) => setText(e.target.value)} onKeyDown={onKeyDown} />
        {extra === 'price' && (
          <input className="inline-add-price" type="text" inputMode="decimal" value={second} placeholder="Price" aria-label="Rough price (optional)"
            onChange={(e) => setSecond(e.target.value.replace(/[^\d.,]/g, '').replace(/,/g, ''))} onKeyDown={onKeyDown} />
        )}
        {extra === 'date' && (
          // Safari shows an empty date box as blank, so the label is drawn over it until a date is picked.
          <span className="inline-add-date" data-empty={second ? undefined : ''}>
            <input type="date" value={second} aria-label="Due date (optional)" onChange={(e) => setSecond(e.target.value)} onKeyDown={onKeyDown} />
            {!second && <span className="inline-add-date-label" aria-hidden="true">Due date</span>}
          </span>
        )}
      </div>
      <p className="hint key-hint">Enter to add another, Esc when done</p>
    </div>
  );
}

export function CardMeta({ card }) {
  const bits = [];
  if (card.date) {
    const late = !card.done && card.date < todayKey();
    bits.push(
      <span key="d" className={late ? 'late' : undefined}>
        {normKind(card.kind, card.date) === 'deadline' ? 'Due ' : ''}{card.endDate ? rangeLabel(card.date, card.endDate) : dayDate(card.date)}
      </span>,
    );
  }
  const cl = card.checklist || [];
  if (cl.length) bits.push(<span key="c"><Icon name="check" size={14} />{cl.filter((x) => x.done).length}/{cl.length}</span>);
  if (card.attachments?.length) bits.push(<span key="a"><Icon name="clip" size={14} />{card.attachments.length}</span>);
  if (card.notes?.trim()) bits.push(<span key="n" aria-label="Has notes"><Icon name="notes" size={14} /></span>);
  return bits.length ? <span className="card-meta">{bits}</span> : null;
}

const asEntry = (card) => ({ source: 'item', kind: card.kind || 'task', done: !!card.done, title: card.title, item: card });

// ---------- board with drag and drop (mouse, touch and pen) ----------
function Board({ hub, project, bySection, onOpenCard, onAdd }) {
  const boardRef = useRef(null);
  const { drag, onPointerDown, rowsFor, wasDrag } = useDragSort({
    scrollRef: boardRef,
    onDrop: ({ id, zone, index }) => {
      if (!project.sections.some((x) => x.id === zone)) return;
      hub.moveCard(id, { projectId: project.id, section: zone, order: dropOrder(bySectionRef.current[zone] || [], id, index) });
    },
  });
  const bySectionRef = useRef(bySection);
  bySectionRef.current = bySection;

  return (
    <>
      <div className="board" ref={boardRef} data-dragging={drag ? '' : undefined}>
        {project.sections.map((s) => {
          const list = bySection[s.id] || [];
          const { rows, lineAtEnd } = rowsFor(list, s.id);
          return (
            <section key={s.id} className="column" data-drop={s.id} data-section={s.id} data-done-section={s.done || undefined} aria-label={s.name}>
              <SectionHead hub={hub} project={project} section={s} cards={list} />
              <ul className="cards">
                {rows.map(({ c, dragging, lineBefore }) => (
                  <React.Fragment key={c.id}>
                    {lineBefore && <li className="drop-line" style={{ height: drag.h }} />}
                    <li hidden={dragging || undefined}>
                      <div className="card-tile" data-drag-id={c.id} data-card={c.id} data-done={c.done || undefined} data-kind={c.kind || 'task'}
                        role="button" tabIndex={0}
                        onPointerDown={(e) => onPointerDown(e, { id: c.id, title: c.title, zone: s.id })}
                        onClick={() => !wasDrag() && onOpenCard(c.id)}
                        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpenCard(c.id))}
                        onContextMenu={(e) => e.preventDefault()}>
                        <span className="card-mark" aria-hidden="true">{cardGlyph(c)}</span>
                        <span className="card-title">{c.title}</span>
                        <CardMeta card={c} />
                      </div>
                    </li>
                  </React.Fragment>
                ))}
                {lineAtEnd && <li className="drop-line" style={{ height: drag.h }} />}
              </ul>
              <InlineAdd onAdd={(t) => onAdd(s.id, t)} />
            </section>
          );
        })}
        <div className="column column-add">
          <InlineAdd label="Add section" placeholder="Section name" onAdd={(name) => addSection(hub, project, name)} />
          <InlineAdd label="Add checklist" placeholder="Checklist name, e.g. Packing" onAdd={(name) => addChecklist(hub, project, name)} />
        </div>
      </div>
      <DragGhost drag={drag} />
      <p className="hint board-hint">Drag cards between sections.</p>
    </>
  );
}

export const cardGlyph = (c) => { const k = normKind(c.kind, c.date); return c.done ? '×' : k === 'event' ? '○' : '•'; };

export function DragGhost({ drag }) {
  if (!drag) return null;
  return (
    <div className="card-tile drag-ghost" aria-hidden="true"
      style={{ width: drag.w, transform: `translate(${drag.x - drag.dx}px, ${drag.y - drag.dy}px) rotate(1.5deg)` }}>
      <span className="card-mark">{drag.mark || '•'}</span><span className="card-title">{drag.title}</span>
    </div>
  );
}

function ListLayout({ hub, project, bySection, area, onOpenCard, onAdd }) {
  const [openDone, setOpenDone] = useState(false);
  return (
    <div className="list-layout">
      {project.sections.map((s) => {
        const list = bySection[s.id] || [];
        const collapsed = s.done && !openDone && list.length > 0;
        return (
          <section key={s.id} className="list-section" aria-label={s.name}>
            <SectionHead hub={hub} project={project} section={s} cards={list} vertical />
            {collapsed ? (
              <button className="text-btn small quiet" onClick={() => setOpenDone(true)}>Show {list.length} done</button>
            ) : (
              <ul className="entries">
                {list.map((c) => (
                  <li key={c.id} className="entry" data-done={c.done || undefined} data-kind={c.kind || 'task'} style={projectStyle(project, area)}>
                    <Mark entry={asEntry(c)} onToggle={hub.toggleDone} />
                    <button className="entry-body" onClick={() => onOpenCard(c.id)}>
                      <span className="entry-title">{c.title}</span>
                      <CardMeta card={c} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {!s.done && <InlineAdd onAdd={(t) => onAdd(s.id, t)} />}
          </section>
        );
      })}
      <div className="list-section list-section-add">
        <InlineAdd label="Add section" placeholder="Section name" onAdd={(name) => addSection(hub, project, name)} />
        <InlineAdd label="Add checklist" placeholder="Checklist name, e.g. Packing" onAdd={(name) => addChecklist(hub, project, name)} />
      </div>
    </div>
  );
}

// ---------- sections, edited in place on the project page ----------
// New sections go just before the done section, so Done stays last.
function addSection(hub, project, name) {
  const cur = hub.data.settings.projects.find((x) => x.id === project.id) || project;
  const n = [...cur.sections];
  const doneIdx = n.findIndex((x) => x.done);
  n.splice(doneIdx === -1 ? n.length : doneIdx, 0, { id: 's-' + uid(), name });
  hub.saveProject({ ...cur, sections: n });
}

function SectionHead({ hub, project, section, cards, vertical }) {
  const count = cards.length;
  const doneCards = cards.filter((c) => c.done);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(section.name);
  const [menu, setMenu] = useState(false);
  const wrap = useRef(null);
  const all = project.sections;
  const index = all.findIndex((x) => x.id === section.id);

  useEffect(() => {
    if (!menu) return undefined;
    const off = (e) => { if (!wrap.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const save = (sections) => hub.saveProject({ ...project, sections });
  const startRename = () => { setMenu(false); setName(section.name); setEditing(true); };
  const commit = () => {
    const n = name.trim();
    setEditing(false);
    if (n && n !== section.name) save(all.map((x) => (x.id === section.id ? { ...x, name: n } : x)));
  };
  const move = (d) => {
    const n = [...all];
    const [x] = n.splice(index, 1);
    n.splice(index + d, 0, x);
    save(n);
    setMenu(false);
  };
  const remove = () => {
    let n = all.filter((x) => x.id !== section.id);
    // If the done section goes, the last one left takes over.
    if (section.done && n.length && !n.some((x) => x.done)) n = n.map((x, i) => (i === n.length - 1 ? { ...x, done: true } : x));
    setMenu(false);
    save(n);
  };

  return (
    <h2 className="column-head section-head" ref={wrap}>
      {editing ? (
        <input className="section-name-input" autoFocus value={name} aria-label="Section name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { e.stopPropagation(); setEditing(false); }
          }}
          onBlur={commit} />
      ) : (
        <button type="button" className="section-name" onClick={startRename} title="Rename">{section.name}</button>
      )}
      <span className="section-head-end">
        <span className="count">{count}</span>
        <button type="button" className="icon-btn section-more" aria-label={`${section.name} options`} aria-expanded={menu}
          onClick={() => setMenu((m) => !m)}><Icon name="more" size={16} /></button>
      </span>
      {menu && (
        <div className="section-menu" role="menu" aria-label={`${section.name} options`}>
          <button type="button" role="menuitem" onClick={startRename}>Rename</button>
          {index > 0 && <button type="button" role="menuitem" onClick={() => move(-1)}>{vertical ? 'Move up' : 'Move left'}</button>}
          {index < all.length - 1 && <button type="button" role="menuitem" onClick={() => move(1)}>{vertical ? 'Move down' : 'Move right'}</button>}
          {/* the done section stays (finished cards need somewhere to go); it can be emptied instead */}
          {section.done ? doneCards.length > 0 && (
            <ConfirmButton className="danger-item" role="menuitem" onConfirm={() => { setMenu(false); hub.deleteItems(doneCards.map((c) => c.id)); }}
              confirmText={`Delete ${doneCards.length} card${doneCards.length === 1 ? '' : 's'}?`}>
              Delete all done
            </ConfirmButton>
          ) : all.length > 1 && (
            <ConfirmButton className="danger-item" role="menuitem" onConfirm={remove}
              confirmText={count ? `Delete and move ${count} card${count === 1 ? '' : 's'}` : 'Tap again to delete'}>
              Delete section
            </ConfirmButton>
          )}
        </div>
      )}
    </h2>
  );
}

// ---------- project settings ----------
export function ProjectSheet({ hub, project, areas, defaultArea, onClose, onCreated, onDeleted }) {
  const isNew = !project;
  const [p, setP] = useState(() => {
    if (project) return project;
    // New projects start with a project colour nobody else is using yet.
    const used = new Set((hub.data.settings.projects || []).filter((x) => !x.deleted).map((x) => x.color));
    const color = (PROJECT_HUES.find((h) => !used.has(h.id)) || PROJECT_HUES[0]).id;
    return { ...newProject(defaultArea || areas[0]?.id, '', (hub.data.settings.projects || []).length), color, icon: '' };
  });
  const set = (x) => setP((cur) => ({ ...cur, ...x }));

  const save = (e) => {
    e.preventDefault();
    if (!p.name.trim()) return;
    const sections = p.sections.filter((s) => s.name.trim()).map((s) => ({ ...s, name: s.name.trim() }));
    if (!sections.length) sections.push({ id: 's-' + uid(), name: 'To do' });
    hub.saveProject({ ...p, name: p.name.trim(), sections });
    isNew ? onCreated(p.id) : onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label={isNew ? 'New project' : 'Project settings'} onSubmit={save}>
      <h2 className="sheet-heading">{isNew ? 'New project' : 'Project settings'}</h2>
      <input data-autofocus className="title-input" value={p.name} placeholder="Project name" aria-label="Project name"
        onChange={(e) => set({ name: e.target.value })} required />

      <fieldset className="area-pick">
        <legend>Area</legend>
        <div className="filters">
          {areas.map((a) => (
            <button type="button" key={a.id} className="chip" aria-pressed={p.area === a.id}
              style={areaStyle(a)} onClick={() => set({ area: a.id })}>
              <span className="chip-dot" />{a.name}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pick-colour">
        <legend>Colour</legend>
        <div className="swatch-row" role="radiogroup" aria-label="Colour">
          {PROJECT_HUES.map((h) => (
            <button type="button" key={h.id} role="radio" aria-checked={hueOf(p.color || fallbackHue(p.id)) === h.id} aria-label={h.name} title={h.name}
              className="swatch" style={areaStyle({ color: h.id })} onClick={() => set({ color: h.id })}>
              <span className="swatch-fill" />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="pick-icon">
        <legend>Icon</legend>
        <div className="icon-grid" role="radiogroup" aria-label="Icon" style={projectStyle(p, areas.find((a) => a.id === p.area))}>
          <button type="button" role="radio" aria-checked={!p.icon} className="icon-choice icon-none" onClick={() => set({ icon: '' })}>None</button>
          {PROJECT_ICONS.map((ic) => (
            <button type="button" key={ic} role="radio" aria-checked={p.icon === ic} aria-label={ic} title={ic}
              className="icon-choice" onClick={() => set({ icon: ic })}><Icon name={ic} /></button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Budget (optional)</legend>
        <label className="money-input">
          <span className="money-prefix" aria-hidden="true">S$</span>
          <input type="number" inputMode="decimal" min="0" step="any" value={p.budget ?? ''} placeholder="0" aria-label="Budget in Singapore dollars"
            onChange={(e) => set({ budget: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} />
        </label>
        <p className="hint">Spending you tag with this project counts against it, in any currency.</p>
      </fieldset>


      <div className="sheet-actions">
        <button className="primary" type="submit">{isNew ? 'Create project' : 'Save'}</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
        {!isNew && (
          <span className="push-right sheet-actions-end">
            <button className="text-btn" type="button" onClick={() => { hub.saveProject({ ...project, archived: !project.archived }); onClose(); }}>
              {project.archived ? 'Restore' : 'Archive'}
            </button>
            <ConfirmButton confirmText={(() => {
              const n = (hub.data.items.items || []).filter((c) => !c.deleted && c.projectId === project.id).length;
              return n ? `Delete with ${n} ${n === 1 ? 'card' : 'cards'}?` : 'Delete for good?';
            })()} onConfirm={() => {
              const n = (hub.data.items.items || []).filter((c) => !c.deleted && c.projectId === project.id);
              n.forEach((c) => hub.deleteItem(c.id));
              hub.saveProject({ id: project.id, deleted: true });
              onDeleted();
            }}>Delete</ConfirmButton>
          </span>
        )}
      </div>
    </Sheet>
  );
}
