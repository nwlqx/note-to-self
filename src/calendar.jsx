// Calendar: the diary-style week, or a month grid. Also the two-week strip
// shown on Projects.
import React, { useMemo, useState } from 'react';
import { todayKey, addDays, startOfWeek, parseKey, dateKey, sortEntries, covers, isOpenTask } from './model.js';
import { WeekView, assignLanes } from './views.jsx';
import { Icon, EntryRow, Opener, metaFor, areaColor, areaStyle, longDate, time12, shortDate, rangeLabel, ProjectIcon, entryGlyph } from './ui.jsx';
import { useWide } from './todo.jsx';

const glyph = (e) => entryGlyph(e);
const firstOfMonth = (k) => k.slice(0, 8) + '01';
const shiftMonth = (k, n) => {
  const d = parseKey(firstOfMonth(k));
  d.setMonth(d.getMonth() + n);
  return dateKey(d);
};

export function CalendarPage({ mode = 'day', setMode, calendars = [], onShowCalendar, ...props }) {
  const head = (
    <>
      <header className="view-head">
        <h1>Calendar</h1>
        <div className="seg seg-small seg-three" role="radiogroup" aria-label="Show">
          <button role="radio" aria-checked={mode === 'day'} onClick={() => setMode('day')}>Day</button>
          <button role="radio" aria-checked={mode === 'week'} onClick={() => setMode('week')}>Week</button>
          <button role="radio" aria-checked={mode === 'month'} onClick={() => setMode('month')}>Month</button>
        </div>
      </header>
      {/* one chip per synced Google calendar; switching one off hides its events everywhere in the app */}
      {calendars.length > 0 && (
        <div className="filters cal-toggles" role="group" aria-label="Google calendars shown">
          {calendars.map((c) => (
            <button key={c.id} className="chip" aria-pressed={c.shown} style={areaStyle(c.area)} onClick={() => onShowCalendar(c.id, !c.shown)}>
              <span className="chip-dot" />{c.name}
            </button>
          ))}
        </div>
      )}
    </>
  );
  if (mode === 'week') return <WeekView {...props} head={head} />;
  if (mode === 'month') return <MonthView {...props} head={head} />;
  return <DayView {...props} head={head} />;
}

// ---------- day: a strip of days and an hour-by-hour schedule ----------
const HOUR_PX = 64;
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmtMin = (m) => time12(`${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

function DayView({ entries, areasById, onToggle, onOpen, onNewAt, draft, head, day, setDay }) {
  const today = todayKey();
  const weekStart = startOfWeek(day);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const onDay = entries.filter((e) => e.date && covers(e, day));
  const counts = Object.fromEntries(days.map((d) => [d, entries.filter((e) => e.date && covers(e, d)).length]));

  // Timed things go on the schedule; everything else sits in the all-day row.
  const timed = [];
  const allDay = [];
  for (const e of onDay) {
    if (e.time && !e.endDate) {
      const start = toMin(e.time);
      let end = start + 60;
      if (e.endTime) end = toMin(e.endTime);
      else if (e.ev && !e.ev.allDay) {
        const en = new Date(e.ev.end);
        end = dateKey(en) === day ? en.getHours() * 60 + en.getMinutes() : 24 * 60;
      }
      timed.push({ e, start, end: Math.max(end, start + 30) });
    } else allDay.push(e);
  }
  timed.sort((a, b) => a.start - b.start || b.end - a.end);
  // Side-by-side lanes for overlapping events.
  const lanesEnd = [];
  for (const t of timed) {
    let i = lanesEnd.findIndex((end) => end <= t.start);
    if (i === -1) { i = lanesEnd.length; lanesEnd.push(0); }
    lanesEnd[i] = t.end;
    t.lane = i;
  }
  for (const t of timed) t.lanes = Math.max(1, ...timed.filter((o) => o.start < t.end && o.end > t.start).map((o) => o.lane + 1));

  const firstHour = Math.min(8, ...timed.map((t) => Math.floor(t.start / 60)));
  const lastHour = Math.max(21, ...timed.map((t) => Math.ceil(t.end / 60)));
  const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, i) => firstHour + i);
  const y = (m) => ((m - firstHour * 60) / 60) * HOUR_PX;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const label = longDate(day);

  // Tap an empty spot on the timeline: a one-hour event starting at that half hour.
  const showDraft = draft && draft.date === day && draft.time && !entries.some((e) => e.key === 'i:' + draft.id);
  const draftStart = showDraft ? toMin(draft.time) : 0;
  const draftEnd = showDraft ? (draft.endTime ? toMin(draft.endTime) : draftStart + 60) : 0;
  const pickTime = (ev) => {
    if (!onNewAt || ev.target.closest('.slot')) return;
    const top = ev.currentTarget.getBoundingClientRect().top;
    const min = firstHour * 60 + ((ev.clientY - top) / HOUR_PX) * 60;
    const start = Math.max(0, Math.min(23 * 60 + 30, Math.floor(min / 30) * 30));
    const end = Math.min(start + 60, 23 * 60 + 59);
    const t = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
    onNewAt(day, t(start), t(end));
  };

  return (
    <section className="view day-view" aria-label="Day">
      {head}
      <header className="cal-sub">
        <h2>{label}</h2>
        <div className="pager">
          <button className="icon-btn" onClick={() => setDay(addDays(day, -7))} aria-label="Previous week"><Icon name="left" /></button>
          {day !== today && <button className="text-btn" onClick={() => setDay(today)}>Today</button>}
          <button className="icon-btn" onClick={() => setDay(addDays(day, 7))} aria-label="Next week"><Icon name="right" /></button>
        </div>
      </header>

      <div className="day-strip" role="radiogroup" aria-label="Day">
        {days.map((d) => (
          <button key={d} role="radio" aria-checked={d === day} className="day-pick" data-today={d === today || undefined}
            data-weekend={[0, 6].includes(parseKey(d).getDay()) || undefined}
            onClick={() => setDay(d)} aria-label={`${longDate(d)}, ${counts[d]} items`}>
            <span className="day-pick-dow">
              <span className="dp-long">{d === today ? 'Today' : parseKey(d).toLocaleDateString('en-SG', { weekday: 'short' })}</span>
              <span className="dp-short" aria-hidden="true">{parseKey(d).toLocaleDateString('en-SG', { weekday: 'narrow' })}</span>
            </span>
            <span className="day-pick-num">{parseKey(d).getDate()}</span>
            <span className="day-pick-dots" aria-hidden="true">{counts[d] ? '•'.repeat(Math.min(3, counts[d])) : ''}</span>
          </button>
        ))}
      </div>


      {allDay.length > 0 && (
        <ul className="all-day" aria-label="All day and due">
          {sortEntries(allDay).map((e) => (
            <li key={e.key} style={areaStyle(areasById[e.area])} data-kind={e.kind} data-done={e.done || undefined}>
              {e.source === 'item' && (e.kind === 'task' || e.kind === 'deadline') ? (
                <button className="all-day-mark" onClick={() => onToggle(e.item.id)}
                  aria-label={e.done ? `Mark "${e.title}" not done` : `Mark "${e.title}" done`} aria-pressed={e.done}>{glyph(e)}</button>
              ) : <span className="all-day-mark" aria-hidden="true">{glyph(e)}</span>}
              <Opener entry={e} onOpen={onOpen} className="all-day-body">
                {e.title}
                <span className="all-day-meta">{e.source === 'bill' ? `${e.cost} due` : e.endDate ? rangeLabel(e.date, e.endDate) : e.kind === 'deadline' ? 'Due today' : e.project || 'All day'}</span>
              </Opener>
            </li>
          ))}
        </ul>
      )}

      <div className="schedule" style={{ height: hours.length * HOUR_PX }} onClick={pickTime}
        title={onNewAt ? 'Click to add an event' : undefined}>
        {hours.map((h) => (
          <div key={h} className="hour-row" style={{ top: y(h * 60) }}>
            <span className="hour-label">{time12(`${String(h % 24).padStart(2, '0')}:00`)}</span>
          </div>
        ))}
        {day === today && nowMin >= firstHour * 60 && nowMin <= lastHour * 60 && (
          <div className="now-line" style={{ top: y(nowMin) }} aria-hidden="true" />
        )}
        <div className="schedule-lane">
          {timed.map((t) => {
            const short = t.end - t.start < 50;
            return (
              <Opener key={t.e.key} entry={t.e} onOpen={onOpen} className="slot" data-short={short || undefined}
                style={areaStyle(areasById[t.e.area], { top: y(t.start) + 2, height: Math.max(30, y(t.end) - y(t.start) - 4), left: `calc(${(t.lane / t.lanes) * 100}% + 2px)`, width: `calc(${100 / t.lanes}% - 4px)` })}>
                <span className="slot-title">{t.e.title}</span>
                <span className="slot-time">{fmtMin(t.start)}–{fmtMin(t.end)}</span>
              </Opener>
            );
          })}
          {showDraft && (
            <div className="slot slot-draft" aria-hidden="true" data-short={draftEnd - draftStart < 50 || undefined}
              style={{ top: y(draftStart) + 2, height: Math.max(30, y(draftEnd) - y(draftStart) - 4), left: 2, width: 'calc(100% - 4px)' }}>
              <span className="slot-time">{fmtMin(draftStart)}–{fmtMin(draftEnd)}</span>
              <span className="slot-title">New event</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MonthView({ entries, areasById, onToggle, onOpen, head, month, setMonth }) {
  const wide = useWide();
  const today = todayKey();
  const [selected, setSelected] = useState(today);
  const first = firstOfMonth(month);
  const gridStart = startOfWeek(first);
  const nextFirst = shiftMonth(first, 1);
  const weeks = [];
  for (let w = gridStart; w < nextFirst; w = addDays(w, 7)) weeks.push(w);
  const isThisMonth = first === firstOfMonth(today);
  const monthLabel = parseKey(first).toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
  const maxInCell = wide ? 3 : 3;

  const go = (n) => {
    const m = shiftMonth(first, n);
    setMonth(m);
    setSelected(firstOfMonth(today) === m ? today : m);
  };

  const dated = entries.filter((e) => e.date);
  const singles = useMemo(() => {
    const m = {};
    for (const e of dated) if (!e.endDate) (m[e.date] ||= []).push(e);
    for (const k of Object.keys(m)) m[k] = sortEntries(m[k]);
    return m;
  }, [entries]); // eslint-disable-line
  const ranges = dated.filter((e) => e.endDate);
  const selectedEntries = sortEntries(dated.filter((e) => covers(e, selected)));

  return (
    <section className="view month" aria-label="Month">
      {head}
      <header className="cal-sub">
        <h2>{monthLabel}</h2>
        <div className="pager">
          <button className="icon-btn" onClick={() => go(-1)} aria-label="Previous month"><Icon name="left" /></button>
          {!isThisMonth && <button className="text-btn" onClick={() => { setMonth(firstOfMonth(today)); setSelected(today); }}>Today</button>}
          <button className="icon-btn" onClick={() => go(1)} aria-label="Next month"><Icon name="right" /></button>
        </div>
      </header>

      <div className="month-grid" role="grid" aria-label={monthLabel}>
        <div className="month-days" role="row" aria-hidden="true">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => <span key={d}>{wide ? d : d[0]}</span>)}
        </div>
        {weeks.map((w) => {
          const days = Array.from({ length: 7 }, (_, i) => addDays(w, i));
          const end = days[6];
          const inWeek = ranges.filter((r) => r.date <= end && r.endDate >= w);
          const { lane, count } = assignLanes(inWeek);
          return (
            <div key={w} className="month-week" role="row" style={{ '--lanes': Math.min(count, 3) }}>
              {days.map((d) => {
                const list = singles[d] || [];
                const other = d.slice(0, 7) !== first.slice(0, 7);
                return (
                  <div key={d} role="gridcell" className="month-cell" data-other={other || undefined}
                    data-today={d === today || undefined} data-past={d < today || undefined} aria-selected={d === selected}>
                    <button className="cell-day" onClick={() => setSelected(d)}
                      aria-label={`${longDate(d)}, ${list.length + inWeek.filter((r) => covers(r, d)).length} items`}>
                      <span className="cell-num">{parseKey(d).getDate()}</span>
                    </button>
                    <ul className="cell-items">
                      {list.slice(0, maxInCell).map((e) => (
                        <li key={e.key} style={areaStyle(areasById[e.area])} data-done={e.done || undefined} data-kind={e.kind}>
                          {wide ? (
                            <Opener entry={e} onOpen={onOpen} className="cell-entry">
                              <span className="cell-mark" aria-hidden="true">{glyph(e)}</span>
                              <span className="cell-title">{e.time ? `${time12(e.time)} ` : ''}{e.title}</span>
                            </Opener>
                          ) : (
                            <span className="cell-dot" aria-hidden="true">{glyph(e)}</span>
                          )}
                        </li>
                      ))}
                      {list.length > maxInCell && (
                        <li className="cell-more">
                          <button className="cell-more-btn" onClick={() => setSelected(d)}>+{list.length - maxInCell}{wide ? ' more' : ''}</button>
                        </li>
                      )}
                    </ul>
                  </div>
                );
              })}
              {inWeek.filter((r) => lane.get(r.key) < 3).map((r) => {
                const s = Math.max(0, Math.round((parseKey(r.date) - parseKey(w)) / 864e5));
                const e = Math.min(6, Math.round((parseKey(r.endDate) - parseKey(w)) / 864e5));
                return (
                  <Opener key={r.key} entry={r} onOpen={onOpen} className="month-bar"
                    data-starts={r.date >= w || undefined} data-ends={r.endDate <= end || undefined}
                    style={areaStyle(areasById[r.area], { '--s': s, '--e': e, '--lane': lane.get(r.key) })}
                    aria-label={`${r.title}, ${shortDate(r.date)} to ${shortDate(r.endDate)}`}>
                    {wide && <span>{r.date >= w || s === 0 ? r.title : ''}</span>}
                  </Opener>
                );
              })}
            </div>
          );
        })}
      </div>

      <section className="day-detail" aria-live="polite">
        <h2 className="quiet-head">{selected === today ? 'Today' : longDate(selected)}</h2>
        {selectedEntries.length ? (
          <ul className="entries">
            {selectedEntries.map((e) => (
              <EntryRow key={e.key} entry={e} areasById={areasById} onToggle={onToggle} onOpen={onOpen}
                meta={metaFor(e, { showDate: !!e.endDate })} />
            ))}
          </ul>
        ) : (
          <p className="month-empty">Nothing on this day</p>
        )}
      </section>
    </section>
  );
}

// Two weeks of days with what's due on each, for the Projects page.
export function DueStrip({ entries, areasById, projects = [], onOpen, onToggle }) {
  const projectsById = Object.fromEntries(projects.map((p) => [p.id, p]));
  const today = todayKey();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const due = entries.filter((e) => e.source === 'item' && isOpenTask(e) && e.date);
  const overdue = sortEntries(due.filter((e) => e.date < today));
  const byDay = Object.fromEntries(days.map((d) => [d, sortEntries(due.filter((e) => e.date === d))]));
  const count = overdue.length + days.reduce((n, d) => n + byDay[d].length, 0);

  const item = (e) => (
    <li key={e.key} className="strip-item" style={areaStyle(areasById[e.area])} data-kind={e.kind}>
      <button className="strip-body" onClick={() => onOpen(e)}>
        <span className="strip-title">
          {projectsById[e.projectId]?.icon && (
            <span className="todo-proj-icon" title={e.project}><ProjectIcon project={projectsById[e.projectId]} size={13} /><span className="sr-only">{e.project}: </span></span>
          )}
          {e.title}
        </span>
      </button>
    </li>
  );

  return (
    <section className="due-strip-wrap" aria-labelledby="due-head">
      <h2 id="due-head" className="strip-label">Next 2 weeks<span className="sr-only">{count ? `, ${count}` : ''}</span></h2>
      {overdue.length > 0 && (
        <div className="strip-day strip-overdue">
          <div className="strip-head"><span className="strip-dow">Overdue</span></div>
          <ul className="overdue-list" aria-label="Overdue">
            {overdue.map((e) => (
              <li key={e.key} className="overdue-row">
                <button className="check overdue-check" aria-pressed="false" aria-label={`Mark "${e.title}" done`} onClick={() => onToggle?.(e.item.id)} />
                <button className="overdue-body" onClick={() => onOpen(e)}>
                  <span className="overdue-title">
                    {projectsById[e.projectId]?.icon && (
                      <span className="todo-proj-icon" title={e.project}><ProjectIcon project={projectsById[e.projectId]} size={14} /><span className="sr-only">{e.project}: </span></span>
                    )}
                    {e.title}
                  </span>
                  <span className="overdue-date">Due {shortDate(e.date)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="due-strip" role="list">
        {days.map((d, i) => {
          const dow = parseKey(d).getDay();
          return (
            <div key={d} className="strip-day" role="listitem" data-today={i === 0 || undefined}
              data-weekend={dow === 0 || dow === 6 || undefined} data-week-start={dow === 1 && i > 0 ? '' : undefined}>
              <div className="strip-head">
                <span className="strip-dow">{i === 0 ? 'Today' : parseKey(d).toLocaleDateString('en-SG', { weekday: 'short' })}</span>
                <span className="strip-num">{parseKey(d).getDate()}</span>
              </div>
              <ul aria-label={longDate(d)}>{byDay[d].map(item)}</ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}
