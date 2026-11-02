import React, { useEffect, useMemo, useState } from 'react';
import { useHub } from './store.js';
import { buildEntries, todayKey, startOfWeek, firstOpenSection, projectProgress, uid } from './model.js';
import { Icon, useTheme, projectStyle, ProjectIcon } from './ui.jsx';
import { Connect, Setup, SettingsView, calendarsOf } from './views.jsx';
import { CalendarPage } from './calendar.jsx';
import { ProjectsOverview, ProjectView, ProjectSheet } from './projects.jsx';
import { CardSheet, CalendarSheet } from './card.jsx';
import { TodoView } from './todo.jsx';
import { MoneyPage, ExpenseSheet, BillSheet, BudgetsSheet, CurrenciesSheet, SpendingSheet, CategorySheet, BillsSheet } from './moneyview.jsx';
import { BuySheet } from './buyview.jsx';
import { billEntries } from './money.js';
import { MealsPage, MealSheet, RecipeSheet } from './mealsview.jsx';
import { TodoPeek, CalendarPeek, MealsPeek, MoneyPeek } from './peeks.jsx';

function SyncNote({ hub }) {
  const { status, conn, pending } = hub;
  if (conn?.demo) return <span className="sync">Sample data</span>;
  const map = {
    syncing: 'Checking for changes',
    saving: 'Saving',
    offline: 'Offline. Changes are kept on this device',
    synced: pending ? 'Waiting to save' : `Up to date${status.at ? ', ' + status.at.toLocaleTimeString('en-SG', { hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase() : ''}`,
    idle: pending ? 'Waiting to save' : '',
  };
  if (status.state === 'auth' || status.state === 'error') {
    return (
      <span className="sync sync-problem" role="status">
        {status.state === 'auth' ? 'GitHub token stopped working' : "Couldn't reach GitHub"}
        <button className="text-btn small" onClick={hub.syncNow}>Try again</button>
      </span>
    );
  }
  // Tapping the note checks GitHub for changes made on another device right away.
  if (status.state === 'synced' && !pending) {
    return (
      <button type="button" className="sync sync-now" role="status" onClick={hub.syncNow} title="Check for changes now">
        {map.synced}
      </button>
    );
  }
  return <span className="sync" role="status">{map[status.state]}</span>;
}

const TABS = [
  { id: 'todo', label: 'To-do', icon: 'todo' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar' },
  { id: 'projects', label: 'Projects', icon: 'folder' },
  { id: 'money', label: 'Budgeting', icon: 'wallet' },
  { id: 'meals', label: 'Meals', icon: 'utensils' },
];

// Preview only: flip between a brand-new, empty app and one full of sample data.
function PreviewToggle({ hub, onSwitch }) {
  if (!(typeof __PREVIEW__ !== 'undefined' && __PREVIEW__)) return null;
  const blank = !!hub.conn?.blank;
  const pick = (toBlank) => { if (toBlank === blank) return; onSwitch(); toBlank ? hub.startBlank() : hub.startDemo(); window.scrollTo(0, 0); };
  return (
    <div className="preview-toggle seg seg-small" role="radiogroup" aria-label="Preview data">
      <button role="radio" aria-checked={blank} onClick={() => pick(true)}>Empty</button>
      <button role="radio" aria-checked={!blank} onClick={() => pick(false)}>Filled</button>
    </div>
  );
}

export default function App() {
  const hub = useHub();
  const theme = useTheme();
  const [view, setView] = useState({ name: 'todo' });
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayKey()));
  const [month, setMonth] = useState(() => todayKey().slice(0, 8) + '01');
  const [day, setDay] = useState(() => todayKey());
  const [calMode, setCalModeState] = useState(() => { try { return localStorage.getItem('hub.calendarMode') || 'day'; } catch { return 'day'; } });
  const setCalMode = (m) => { setCalModeState(m); try { localStorage.setItem('hub.calendarMode', m); } catch { /* ignore */ } };
  const [sheet, setSheet] = useState(null);
  // The page title shares its row with the tool buttons; headers leave room for them.
  const barRef = React.useRef(null);
  const mainRef = React.useRef(null);
  React.useLayoutEffect(() => {
    const bar = barRef.current, main = mainRef.current;
    if (!bar || !main || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => main.style.setProperty('--bar-w', `${bar.offsetWidth}px`));
    ro.observe(bar);
    return () => ro.disconnect();
  });
  const [addOpen, setAddOpen] = useState(false);
  const [setupDone, setSetupDone] = useState(false);
  const [setupActive, setSetupActive] = useState(false);

  const settings = hub.data.settings || {};
  const activeAreas = useMemo(() => (settings.areas || []).filter((a) => !a.deleted && !a.archived), [settings.areas]);
  const areasById = useMemo(() => Object.fromEntries(activeAreas.map((a) => [a.id, a])), [activeAreas]);
  const projects = useMemo(() => (settings.projects || []).filter((p) => !p.deleted && p.sections), [settings.projects]);
  const entries = useMemo(
    () => [...buildEntries(hub.data.items?.items, hub.data.calendar?.events, settings), ...billEntries(hub.data.money)],
    [hub.data.items, hub.data.calendar, hub.data.money, settings],
  );
  const currentProject = view.name === 'project' ? projects.find((p) => p.id === view.id) : null;

  const newCard = () => {
    if (currentProject) {
      setSheet({ type: 'card', defaults: { projectId: currentProject.id, area: currentProject.area, section: firstOpenSection(currentProject)?.id } });
    } else {
      setSheet({ type: 'card', defaults: {} });
    }
  };

  useEffect(() => {
    const onKey = (e) => {
      if (sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'n') { e.preventDefault(); newCard(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  useEffect(() => {
    if (!addOpen) return;
    const close = (e) => { if (e.type === 'keydown' ? e.key === 'Escape' : !e.target.closest('.add-wrap')) setAddOpen(false); };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [addOpen]);

  // Start at the top when the app first opens after connecting or choosing sample data.
  useEffect(() => { window.scrollTo(0, 0); }, [hub.conn]);

  // If the open project disappears (deleted on another device), go home.
  useEffect(() => {
    if (view.name === 'project' && !currentProject) setView({ name: 'projects' });
  }, [view, currentProject]);

  if (!hub.conn) return <Connect hub={hub} />;
  const firstPullPending = !hub.conn.demo && !hub.data.pulledAt;
  if (firstPullPending) {
    const failed = hub.status.state === 'error' || hub.status.state === 'auth';
    return (
      <main className="setup">
        <p className="lede">{failed ? hub.status.message : 'Opening your plans'}</p>
        {failed && (
          <div className="panel-actions">
            <button className="primary" onClick={hub.syncNow}>Try again</button>
            <button className="text-btn" onClick={hub.disconnect}>Use a different repository</button>
          </div>
        )}
      </main>
    );
  }
  if (setupActive || (!activeAreas.length && !setupDone)) {
    return (
      <>
        <PreviewToggle hub={hub} onSwitch={() => { setSetupActive(false); setSetupDone(false); }} />
        <Setup hub={hub} activeAreas={activeAreas} keepOpen={() => setSetupActive(true)}
          onDone={() => { setSetupActive(false); setSetupDone(true); }} />
      </>
    );
  }

  const openEntry = (entry) => setSheet(
    entry.source === 'calendar' ? { type: 'calendar', entry }
      : entry.source === 'bill' ? { type: 'bill', id: entry.bill.id }
        : { type: 'card', cardId: entry.item.id },
  );
  // Sheets opened from another sheet (an expense from a project's spending) return to it when closed.
  const openSheet = (next) => setSheet((cur) => (cur && (cur.type === 'spending' || cur.type === 'category' || cur.type === 'bills') ? { ...next, back: cur } : next));
  const closeSheet = () => setSheet((cur) => cur?.back || null);
  const openCard = (id) => setSheet({ type: 'card', cardId: id });
  const props = { entries, areas: activeAreas, areasById, onToggle: hub.toggleDone, onOpen: openEntry };
  const tabFor = view.name === 'project' ? 'projects' : view.name;
  const go = (name) => () => { setView({ name }); window.scrollTo(0, 0); };

  return (
    <div className="shell">
      <PreviewToggle hub={hub} onSwitch={() => { setSetupActive(false); setSetupDone(false); setSheet(null); setView({ name: 'todo' }); }} />
      <nav className="rail" aria-label="Views">
        <ul className="dock">
          {TABS.map((t) => {
            const tab = (
              <button className="tab" aria-current={tabFor === t.id ? 'page' : undefined} aria-label={t.label}
                onClick={() => { setView({ name: t.id }); window.scrollTo(0, 0); }}>
                <Icon name={t.icon} /><span className="tab-label">{t.label}</span>
              </button>
            );
            return (
              <li key={t.id}>
                {t.id === 'projects' ? (
                  <ProjectsPeek projects={projects} items={hub.data.items.items} settings={settings} areasById={areasById} currentId={currentProject?.id}
                    onOpen={(id) => { setView({ name: 'project', id }); window.scrollTo(0, 0); }}
                    onAll={() => { setView({ name: 'projects' }); window.scrollTo(0, 0); }}>
                    {tab}
                  </ProjectsPeek>
                ) : t.id === 'todo' ? (
                  <TodoPeek items={hub.data.items.items} entries={entries} projects={projects} areasById={areasById}
                    onOpenCard={openCard} onOpenEntry={openEntry} onAll={go('todo')}>{tab}</TodoPeek>
                ) : t.id === 'calendar' ? (
                  <CalendarPeek entries={entries} projects={projects} areasById={areasById} onOpenEntry={openEntry} onAll={go('calendar')}>{tab}</CalendarPeek>
                ) : t.id === 'meals' ? (
                  <MealsPeek meals={hub.data.meals} onOpenMeal={(date, slot) => setSheet({ type: 'meal', date, slot })} onAll={go('meals')}>{tab}</MealsPeek>
                ) : t.id === 'money' ? (
                  <MoneyPeek money={hub.data.money} onOpenBill={(id) => setSheet({ type: 'bill', id })} onAll={go('money')}>{tab}</MoneyPeek>
                ) : tab}
              </li>
            );
          })}
        </ul>
        <div className="add-wrap">
          {addOpen && (
            <div className="add-menu" role="menu" aria-label="Add">
              <button role="menuitem" onClick={() => { setAddOpen(false); newCard(); }}>
                <span className="add-menu-icon" aria-hidden="true"><Icon name="todo" /></span>
                <span><strong>Card</strong><small>{currentProject ? `In ${currentProject.name}` : 'A task, deadline or event'}</small></span>
              </button>
              <button role="menuitem" onClick={() => { setAddOpen(false); setSheet({ type: 'project', area: currentProject?.area }); }}>
                <span className="add-menu-icon" aria-hidden="true"><Icon name="folder" /></span>
                <span><strong>Project</strong><small>A home for your cards</small></span>
              </button>
              <button role="menuitem" onClick={() => { setAddOpen(false); setSheet({ type: 'expense', defaults: currentProject ? { projectId: currentProject.id } : {} }); }}>
                <span className="add-menu-icon" aria-hidden="true"><Icon name="wallet" /></span>
                <span><strong>Expense</strong><small>{currentProject ? `For ${currentProject.name}` : 'Log what you spent'}</small></span>
              </button>
              <button role="menuitem" onClick={() => { setAddOpen(false); setSheet({ type: 'buy', defaults: currentProject ? { projectId: currentProject.id } : {} }); }}>
                <span className="add-menu-icon" aria-hidden="true"><Icon name="bag" /></span>
                <span><strong>To buy</strong><small>{currentProject ? `For ${currentProject.name}` : 'Something you need or want'}</small></span>
              </button>
            </div>
          )}
          <button className="add-btn" onClick={() => setAddOpen(!addOpen)} aria-expanded={addOpen} aria-haspopup="menu" aria-label="Add">
            <Icon name={addOpen ? 'close' : 'plus'} /><span className="add-label">Add</span>
          </button>
        </div>
      </nav>


      <main ref={mainRef} data-page={currentProject ? 'project' : view.name} className={`content${currentProject || ['todo', 'calendar', 'projects', 'money', 'meals'].includes(view.name) ? ' content-wide' : ''}`}>
        <div className="topbar" ref={barRef}>
          <SyncNote hub={hub} />
          <button className="icon-btn round" onClick={theme.toggle} aria-label={theme.isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            title={theme.isDark ? 'Light mode' : 'Dark mode'}><Icon name={theme.isDark ? 'sun' : 'moon'} /></button>
          <button className="icon-btn round" aria-label="Settings" aria-current={view.name === 'settings' ? 'page' : undefined}
            onClick={() => setView(view.name === 'settings' ? { name: 'todo' } : { name: 'settings' })}><Icon name="settings" /></button>
        </div>

        {view.name === 'todo' && (
          <TodoView hub={hub} areas={activeAreas} areasById={areasById} projects={projects} onOpenCard={openCard}
            entries={entries} onOpen={openEntry}
            onOpenProject={(id) => { setView({ name: 'project', id }); window.scrollTo(0, 0); }}
            onOpenDay={(d) => { setDay(d); setCalMode('day'); setView({ name: 'calendar' }); window.scrollTo(0, 0); }}
            onOpenWeek={() => { setCalMode('week'); setWeekStart(startOfWeek(todayKey())); setView({ name: 'calendar' }); window.scrollTo(0, 0); }} />
        )}
        {view.name === 'projects' && (
          <ProjectsOverview {...props} hub={hub} projects={projects}
            onOpenProject={(id) => { setView({ name: 'project', id }); window.scrollTo(0, 0); }}
            onNewProject={(area) => setSheet({ type: 'project', area })} />
        )}
        {currentProject && (
          <ProjectView hub={hub} project={currentProject} areasById={areasById}
            onBack={() => setView({ name: 'projects' })} onOpenCard={openCard}
            onEditProject={() => setSheet({ type: 'project', project: currentProject })}
            onOpenSpending={() => setSheet({ type: 'spending', projectId: currentProject.id })} />
        )}
        {view.name === 'calendar' && (
          <CalendarPage {...props} calendars={calendarsOf(hub.data.calendar).map((c) => ({ ...c, area: areasById[settings.calendarAreas?.[c.id]], shown: !(settings.hiddenCalendars || []).includes(c.id) }))}
            onShowCalendar={hub.setCalendarShown} weekStart={weekStart} setWeekStart={setWeekStart} month={month} setMonth={setMonth}
            day={day} setDay={setDay} mode={calMode} setMode={setCalMode}
            onNewAt={(date, time, endTime) => setSheet({ type: 'card', defaults: { id: 'c-' + uid(), kind: 'event', date, time, endTime } })}
            draft={sheet?.type === 'card' && !sheet.cardId && sheet.defaults?.time ? sheet.defaults : null} />
        )}
        {view.name === 'meals' && <MealsPage hub={hub} onSheet={setSheet} />}
        {view.name === 'money' && (
          <MoneyPage hub={hub} projects={projects} areasById={areasById} onSheet={setSheet}
            onOpenProject={(id) => { setView({ name: 'project', id }); window.scrollTo(0, 0); }} />
        )}
        {view.name === 'settings' && <SettingsView hub={hub} activeAreas={activeAreas} theme={theme} />}
      </main>

      {sheet?.type === 'card' && (
        <CardSheet key={sheet.cardId || 'new'} hub={hub} cardId={sheet.cardId} defaults={sheet.defaults}
          areas={activeAreas} projects={projects} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === 'calendar' && <CalendarSheet entry={sheet.entry} onClose={() => setSheet(null)} />}
      {sheet?.type === 'expense' && (
        <ExpenseSheet key={sheet.id || 'new-x'} hub={hub} id={sheet.id} defaults={sheet.defaults} projects={projects} areasById={areasById} onClose={closeSheet} />
      )}
      {sheet?.type === 'buy' && <BuySheet key={sheet.id || 'new-w'} hub={hub} id={sheet.id} defaults={sheet.defaults} projects={projects} onClose={closeSheet} />}
      {sheet?.type === 'bills' && <BillsSheet hub={hub} onSheet={openSheet} onClose={closeSheet} />}
      {sheet?.type === 'bill' && <BillSheet key={sheet.id || 'new-b'} hub={hub} id={sheet.id} projects={projects} areasById={areasById} onClose={closeSheet} />}
      {sheet?.type === 'meal' && <MealSheet key={sheet.date + sheet.slot} hub={hub} date={sheet.date} slot={sheet.slot} onSheet={setSheet} onClose={closeSheet} />}
      {sheet?.type === 'recipe' && <RecipeSheet key={sheet.id || 'new-r'} hub={hub} id={sheet.id} onClose={closeSheet} />}
      {sheet?.type === 'budgets' && <BudgetsSheet hub={hub} onClose={closeSheet} />}
      {sheet?.type === 'currencies' && <CurrenciesSheet hub={hub} onClose={closeSheet} />}
      {sheet?.type === 'category' && (
        <CategorySheet key={sheet.catId + sheet.ym} hub={hub} catId={sheet.catId} ym={sheet.ym} projects={projects} onSheet={openSheet} onClose={closeSheet} />
      )}
      {sheet?.type === 'spending' && (
        <SpendingSheet hub={hub} projectId={sheet.projectId} projects={projects} areasById={areasById} onSheet={openSheet} onClose={closeSheet} />
      )}
      {sheet?.type === 'project' && (
        <ProjectSheet hub={hub} project={sheet.project} defaultArea={sheet.area} areas={activeAreas}
          onClose={() => setSheet(null)}
          onCreated={(id) => { setSheet(null); setView({ name: 'project', id }); }}
          onDeleted={() => { setSheet(null); setView({ name: 'projects' }); }} />
      )}
    </div>
  );
}

// Hovering the Projects tab (on a mouse or trackpad) previews open projects, each one a shortcut in.
function ProjectsPeek({ projects, items, settings, areasById, currentId, onOpen, onAll, children }) {
  const [open, setOpen] = useState(false);
  const timer = React.useRef(null);
  const canHover = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const show = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(true), 120); };
  const hide = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!open) return undefined;
    const esc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [open]);

  const rows = projects.filter((p) => !p.archived).map((p) => {
    const { cards, total, done } = projectProgress(p.id, items, settings);
    const next = cards.filter((c) => !c.done && c.date).sort((a, b) => a.date.localeCompare(b.date))[0];
    return { p, total, done, next };
  }).sort((a, b) => (a.next?.date || '9999').localeCompare(b.next?.date || '9999'));

  if (!canHover) return children;
  return (
    <div className="peek-wrap" onMouseEnter={show} onMouseLeave={hide}
      onFocus={show} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) hide(); }}>
      {children}
      {open && (
        <div className="peek" role="group" aria-label="Your projects">
          <p className="peek-head">Projects</p>
          {rows.length ? (
            <ul className="peek-list">
              {rows.slice(0, 7).map(({ p, total, done }) => (
                <li key={p.id} style={projectStyle(p, areasById[p.area])}>
                  <button className="peek-row" aria-current={p.id === currentId ? 'page' : undefined}
                    onClick={() => { setOpen(false); onOpen(p.id); }}>
                    <span className="peek-icon"><ProjectIcon project={p} size={16} /></span>
                    <span className="peek-text">
                      <span className="peek-name">{p.name}</span>
                      <span className="peek-meta">{total ? `${done} of ${total} done` : 'Nothing added yet'}</span>
                    </span>
                    {total > 0 && <span className="peek-bar" aria-hidden="true"><span style={{ width: `${(done / total) * 100}%` }} /></span>}
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="peek-empty">No projects yet</p>}
          {rows.length > 7 && <p className="peek-note">{rows.length - 7} more</p>}
        </div>
      )}
    </div>
  );
}
