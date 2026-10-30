// Week, setup and settings.
import React, { useEffect, useState } from 'react';
import {
  PALETTE, hueOf, sortEntries, covers, todayKey, addDays, startOfWeek, parseKey, monthKey, uid,
} from './model.js';
import {
  Icon, EntryRow, metaFor, areaColor, areaStyle, dayName, shortDate, monthTitle, rangeLabel, ConfirmButton, PALETTES } from './ui.jsx';

// ---------- week ----------
export function assignLanes(ranges) {
  const ends = [];
  const lane = new Map();
  for (const r of [...ranges].sort((a, b) => a.date.localeCompare(b.date))) {
    let i = ends.findIndex((e) => e < r.date);
    if (i === -1) { i = ends.length; ends.push(''); }
    ends[i] = r.endDate;
    lane.set(r.key, i);
  }
  return { lane, count: ends.length };
}

export function WeekView({ entries, areasById, weekStart, setWeekStart, onToggle, onOpen, head }) {
  const today = todayKey();
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const isThisWeek = weekStart === startOfWeek(today);

  const ranges = entries.filter((e) => e.endDate && e.date <= weekEnd && e.endDate >= weekStart);
  const { lane, count: laneCount } = assignLanes(ranges);
  const carried = isThisWeek
    ? sortEntries(entries.filter((e) => e.source === 'item' && !e.done && e.date && e.date < weekStart && (e.kind === 'task' || e.kind === 'deadline')))
    : [];
  const unscheduled = entries.filter((e) => e.source === 'item' && !e.done && !e.date && e.kind !== 'event');

  return (
    <section className="view week" aria-label="Week">
      {head}
      <header className="cal-sub">
        <h2>{isThisWeek ? 'This week' : `Week of ${shortDate(weekStart)}`}</h2>
        <div className="pager">
          <button className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week"><Icon name="left" /></button>
          {!isThisWeek && <button className="text-btn" onClick={() => setWeekStart(startOfWeek(today))}>This week</button>}
          <button className="icon-btn" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week"><Icon name="right" /></button>
        </div>
      </header>

      {carried.length > 0 && (
        <div className="carried">
          <h2 className="quiet-head">Still open from before</h2>
          <ul className="entries">
            {carried.map((e) => (
              <EntryRow key={e.key} entry={e} areasById={areasById} onToggle={onToggle} onOpen={onOpen}
                meta={metaFor(e, { showDate: true })} />
            ))}
          </ul>
        </div>
      )}

      <ol className="days" style={{ '--lanes': laneCount }}>
        {days.map((d) => {
          const dayEntries = sortEntries(entries.filter((e) => !e.endDate && e.date === d));
          const startingRanges = ranges.filter((r) => r.date === d || (d === weekStart && r.date < weekStart));
          const past = d < today;
          return (
            <li key={d} className="day" data-today={d === today || undefined} data-past={past || undefined}>
              <div className="gutter" aria-hidden="true">
                {ranges.filter((r) => covers(r, d)).map((r) => (
                  <span key={r.key} className="bracket"
                    data-start={r.date === d || undefined} data-end={r.endDate === d || undefined}
                    style={areaStyle(areasById[r.area], { '--lane': lane.get(r.key) })} />
                ))}
              </div>
              <div className="day-label">
                <span className="day-num">{parseKey(d).getDate()}</span>
                <span className="day-name">{d === today ? 'Today' : dayName(d)}</span>
              </div>
              <ul className="entries">
                {startingRanges.map((r) => (
                  <EntryRow key={r.key} entry={r} areasById={areasById} onToggle={onToggle} onOpen={onOpen}
                    meta={[rangeLabel(r.date, r.endDate), r.project].filter(Boolean).join(', ')} />
                ))}
                {dayEntries.map((e) => (
                  <EntryRow key={e.key} entry={e} areasById={areasById} onToggle={onToggle} onOpen={onOpen} meta={metaFor(e)} />
                ))}
              </ul>
            </li>
          );
        })}
      </ol>

      {unscheduled.length > 0 && (
        <details className="unscheduled">
          <summary>Not scheduled yet <span className="count">{unscheduled.length}</span></summary>
          <ul className="entries">
            {sortEntries(unscheduled).map((e) => (
              <EntryRow key={e.key} entry={e} areasById={areasById} onToggle={onToggle} onOpen={onOpen}
                meta={metaFor(e, { showArea: true, areasById })} />
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}


// ---------- areas editor (setup and settings) ----------
const SUGGESTIONS = ['Work', 'Study', 'Travel', 'Fitness', 'Personal'];

function AreasEditor({ areas, onChange }) {
  const used = new Set(areas.map((a) => a.color));
  const nextColor = () => (PALETTE.find((p) => !used.has(p.id)) || PALETTE[areas.length % PALETTE.length]).id;
  const add = (name = '') => onChange([...areas, { id: 'a-' + uid(), name, color: nextColor() }]);
  const set = (i, f) => onChange(areas.map((a, j) => (i === j ? { ...a, ...f } : a)));
  const move = (i, d) => {
    const n = [...areas];
    const [x] = n.splice(i, 1);
    n.splice(i + d, 0, x);
    onChange(n);
  };
  const names = new Set(areas.map((a) => a.name.trim().toLowerCase()));
  const unusedSuggestions = SUGGESTIONS.filter((s) => !names.has(s.toLowerCase()));

  return (
    <div className="areas-editor">
      <ul>
        {areas.map((a, i) => (
          <li key={a.id} className="area-row" style={areaStyle(a)}>
            <input className="area-name" value={a.name} placeholder="Area name" aria-label="Area name"
              onChange={(e) => set(i, { name: e.target.value })} />
            <div className="swatches" role="radiogroup" aria-label={`Colour for ${a.name || 'area'}`}>
              {PALETTE.map((p) => (
                <button key={p.id} className="swatch" role="radio" aria-checked={hueOf(a.color) === p.id} aria-label={p.name}
                  style={{ '--c': `var(--${p.id})` }} onClick={() => set(i, { color: p.id })} />
              ))}
            </div>
            <div className="row-actions">
              <button className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up"><Icon name="up" /></button>
              <button className="icon-btn" disabled={i === areas.length - 1} onClick={() => move(i, 1)} aria-label="Move down"><Icon name="down" /></button>
              <button className="icon-btn" onClick={() => onChange(areas.filter((_, j) => j !== i))} aria-label={`Remove ${a.name || 'area'}`}><Icon name="close" /></button>
            </div>
          </li>
        ))}
      </ul>
      <div className="add-areas">
        <button className="text-btn" onClick={() => add()}>Add an area</button>
        {unusedSuggestions.length > 0 && (
          <span className="suggest">
            or add
            {unusedSuggestions.map((s) => (
              <button key={s} className="chip chip-plain" onClick={() => add(s)}>{s}</button>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}

function CalendarMapping({ calendars, areas, value, onChange }) {
  return (
    <ul className="cal-map">
      {calendars.map((c) => (
        <li key={c.id}>
          <label htmlFor={`cal-${c.id}`}>{c.name} calendar</label>
          <select id={`cal-${c.id}`} value={value[c.id] || ''} onChange={(e) => onChange(c.id, e.target.value)}>
            <option value="">No area</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            <option value="hidden">Don't show</option>
          </select>
        </li>
      ))}
    </ul>
  );
}

function calendarsOf(calendar) {
  const list = [...(calendar?.calendars || [])];
  for (const e of calendar?.events || []) {
    if (!list.some((c) => c.id === e.calendar)) list.push({ id: e.calendar, name: e.calendar });
  }
  return list;
}

// ---------- setup ----------
export function Connect({ hub }) {
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('hub-data');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await hub.connect({ owner: owner.trim(), repo: repo.trim(), token: token.trim() });
    } catch (err) {
      setError(err.message?.includes('token') ? err.message
        : `Couldn't open ${owner}/${repo}. Check the username and repository name, and that the token can access it.`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="setup">
      <p className="setup-brand"><span>note to self</span></p>
      <h1 className="setup-title">One page for<br />everything you're carrying</h1>
      <p className="lede">Work, study, trips and everything in between, kept in your own GitHub repository and readable on every device.</p>
      <form onSubmit={submit} className="form">
        <label>GitHub username<input value={owner} onChange={(e) => setOwner(e.target.value)} autoCapitalize="off" autoCorrect="off" required /></label>
        <label>Data repository<input value={repo} onChange={(e) => setRepo(e.target.value)} autoCapitalize="off" autoCorrect="off" required /></label>
        <label>Access token<input type="password" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" required /></label>
        <p className="hint">The token stays on this device. Use a fine-grained token limited to the data repository.</p>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="primary" disabled={busy}>{busy ? 'Connecting' : 'Connect'}</button>
      </form>
      <button className="text-btn" onClick={hub.startDemo}>Try it with sample data</button>
    </main>
  );
}

export function Setup({ hub, activeAreas, onDone, keepOpen }) {
  const [step, setStep] = useState(activeAreas.length ? 'calendars' : 'areas');
  const [draft, setDraft] = useState(activeAreas);
  const calendars = calendarsOf(hub.data.calendar);
  const valid = draft.filter((a) => a.name.trim());

  if (step === 'areas') {
    return (
      <main className="setup">
        <h1 className="setup-title">What are you<br />keeping track of?</h1>
        <p className="lede">Areas are the big parts of your life. Projects sit inside them, like MTD359 inside Study, and cards sit inside projects. You can add or rename areas any time.</p>
        <AreasEditor areas={draft} onChange={setDraft} />
        <button className="primary" disabled={!valid.length} onClick={() => {
          keepOpen();
          hub.saveAreas(valid.map((a) => ({ ...a, name: a.name.trim() })));
          calendars.length ? setStep('calendars') : onDone();
        }}>Continue</button>
      </main>
    );
  }
  return (
    <main className="setup">
      <h1 className="setup-title">Where do your<br />calendars belong?</h1>
      <p className="lede">Events from each calendar take that area's colour. They stay read-only here; edit them in Google Calendar.</p>
      <CalendarMapping calendars={calendars} areas={activeAreas} value={hub.data.settings.calendarAreas || {}}
        onChange={hub.setCalendarArea} />
      <button className="primary" onClick={onDone}>Done</button>
    </main>
  );
}

// ---------- settings ----------
export function SettingsView({ hub, activeAreas, theme }) {
  const [draft, setDraft] = useState(activeAreas);
  useEffect(() => setDraft(activeAreas), [activeAreas.map((a) => a.id + a.name + a.color).join()]); // eslint-disable-line
  const changed = JSON.stringify(draft.map(({ id, name, color }) => [id, name, color])) !==
    JSON.stringify(activeAreas.map(({ id, name, color }) => [id, name, color]));
  const cal = hub.data.calendar || {};
  const calendars = calendarsOf(cal);
  return (
    <section className="view settings" aria-label="Settings">
      <header className="view-head"><h1>Settings</h1></header>

      <section className="panel">
        <h2>You</h2>
        <NameField hub={hub} />
      </section>

      {theme && (
        <section className="panel">
          <h2>Appearance</h2>
          <div className="seg seg-small" role="radiogroup" aria-label="Appearance">
            {[['system', 'Match device'], ['light', 'Light'], ['dark', 'Dark']].map(([id, label]) => (
              <button key={id} role="radio" aria-checked={theme.choice === id} onClick={() => theme.setChoice(id)}>{label}</button>
            ))}
          </div>
          <h3 className="panel-sub">Colour theme</h3>
          <div className="palette-pick" role="radiogroup" aria-label="Colour theme">
            {PALETTES.map((p, i) => (
              <button key={p.id} type="button" role="radio" aria-checked={theme.palette === p.id} className="palette-opt" onClick={() => theme.setPalette(p.id)}>
                <span className="palette-swatches" aria-hidden="true">{p.swatches.map((c) => <span key={c} style={{ background: c }} />)}</span>
                <span className="palette-name">Theme {i + 1}<small>{p.name}</small></span>
              </button>
            ))}
          </div>
          <p className="hint">Saved on this device. The moon and sun button at the top switches between light and dark, in either theme.</p>
        </section>
      )}

      <section className="panel">
        <h2>Areas</h2>
        <AreasEditor areas={draft} onChange={setDraft} />
        {changed && (
          <div className="panel-actions">
            <button className="primary" disabled={!draft.some((a) => a.name.trim())}
              onClick={() => hub.saveAreas(draft.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() })))}>
              Save areas
            </button>
            <button className="text-btn" onClick={() => setDraft(activeAreas)}>Cancel</button>
          </div>
        )}
        <p className="hint">Removing an area keeps its items. They'll show without a colour until you move them.</p>
      </section>

      <section className="panel">
        <h2>Calendars</h2>
        {calendars.length === 0 ? (
          <p className="hint">No calendars have synced yet. Once the calendar sync has run, your calendars appear here.</p>
        ) : (
          <>
            <CalendarMapping calendars={calendars} areas={activeAreas} value={hub.data.settings.calendarAreas || {}}
              onChange={hub.setCalendarArea} />
            {(cal.calendars || []).filter((c) => !c.ok).map((c) => (
              <p key={c.id} className="error">{c.name} didn't update on the last sync: {c.error}</p>
            ))}
            {cal.syncedAt && <p className="hint">Calendar last changed {new Date(cal.syncedAt).toLocaleString('en-SG', { dateStyle: 'medium', timeStyle: 'short' })}. It checks for updates every hour.</p>}
          </>
        )}
      </section>

      <section className="panel">
        <h2>Connection</h2>
        {hub.conn?.demo ? (
          <p className="hint">{typeof __PREVIEW__ !== 'undefined' && __PREVIEW__
            ? "This is a preview with sample data. Your changes stay in this browser on this device and aren't saved to GitHub."
            : "You're looking at sample data. Nothing is saved to GitHub."}</p>
        ) : (
          <p className="hint">Saving to {hub.conn?.owner}/{hub.conn?.repo}.</p>
        )}
        <div className="panel-actions">
          {!hub.conn?.demo && <button className="text-btn" onClick={hub.syncNow}>Sync now</button>}
          {!(typeof __PREVIEW__ !== 'undefined' && __PREVIEW__) && (
            <ConfirmButton onConfirm={hub.disconnect}
              confirmText={hub.conn?.demo ? 'Leave sample data?' : hub.pending ? 'Unsaved changes will be lost. Disconnect?' : 'Disconnect? Your data stays on GitHub'}>
              {hub.conn?.demo ? 'Leave sample data' : 'Disconnect this device'}
            </ConfirmButton>
          )}
          {typeof __PREVIEW__ !== 'undefined' && __PREVIEW__ && (
            <ConfirmButton onConfirm={hub.startDemo} confirmText="Reset all sample data?">Start over with fresh sample data</ConfirmButton>
          )}
        </div>
      </section>
    </section>
  );
}


function NameField({ hub }) {
  const [name, setName] = useState(hub.data.settings.name || '');
  const saved = (hub.data.settings.name || '') === name.trim();
  return (
    <form className="name-field" onSubmit={(e) => { e.preventDefault(); hub.setName(name.trim()); }}>
      <label htmlFor="your-name">Your name, for the greeting on To-do</label>
      <div className="name-row">
        <input id="your-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" autoComplete="given-name" />
        <button className="primary" disabled={saved}>{saved ? 'Saved' : 'Save'}</button>
      </div>
    </form>
  );
}
