// Shared pieces: formatting, marks, rows, icons and the sheet container.
import React, { useEffect, useRef } from 'react';
import { parseKey, hueOf, fallbackHue } from './model.js';

export const fmt = (k, opts) => parseKey(k).toLocaleDateString('en-SG', opts);
export const dayName = (k) => fmt(k, { weekday: 'short' });
export const shortDate = (k) => fmt(k, { day: 'numeric', month: 'short' });
export const dayDate = (k) => fmt(k, { weekday: 'short', day: 'numeric', month: 'short' });
export const longDate = (k) => fmt(k, { weekday: 'long', day: 'numeric', month: 'long' });
export const monthTitle = (m) => fmt(m + '-01', { month: 'long', year: 'numeric' });
export const time12 = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const hh = ((h + 11) % 12) + 1;
  return `${hh}${m ? ':' + String(m).padStart(2, '0') : ''}${h < 12 ? 'am' : 'pm'}`;
};
export const rangeLabel = (a, b) => {
  if (!b || a === b) return shortDate(a);
  const sameMonth = a.slice(0, 7) === b.slice(0, 7);
  return sameMonth ? `${fmt(a, { day: 'numeric' })}–${shortDate(b)}` : `${shortDate(a)} – ${shortDate(b)}`;
};
export const areaColor = (area) => (area ? `var(--${hueOf(area.color)}-ink)` : 'var(--ink-muted)');
// A project's colours: always from the project palette, so projects never look like a matrix quadrant.
export const projectStyle = (project, area, extra) =>
  project ? areaStyle({ color: project.color || fallbackHue(project.id) }, extra) : areaStyle(area, extra);

export function ProjectIcon({ project, size = 18 }) {
  if (!project?.icon) return null;
  return <span className="project-icon" aria-hidden="true"><Icon name={project.icon} size={size} /></span>;
}

// All four colours of an area's hue, for components that fill blocks or tints.
export const areaStyle = (area, extra) => {
  const h = area ? hueOf(area.color) : null;
  return {
    '--c': h ? `var(--${h}-ink)` : 'var(--ink-muted)',
    '--cb': h ? `var(--${h})` : 'var(--rose)',
    '--cs': h ? `var(--${h}-soft)` : 'var(--surface-sunken)',
    '--co': h ? `var(--on-${h})` : 'var(--on-rose)',
    ...extra,
  };
};

export function Icon({ name, size = 20 }) {
  const paths = {
    settings: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.4-2.3.1-1.2-.1-1.2 2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2-1.2L14.6 3h-4l-.4 2.6a7.6 7.6 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6-.1 1.2.1 1.2-2 1.6 2 3.4 2.4-1c.6.5 1.3.9 2 1.2l.4 2.6h4l.4-2.6c.7-.3 1.4-.7 2-1.2l2.4 1 2-3.4-2-1.6Z',
    left: 'M15 5l-7 7 7 7',
    right: 'M9 5l7 7-7 7',
    plus: 'M12 5v14M5 12h14',
    close: 'M6 6l12 12M18 6L6 18',
    up: 'M6 15l6-6 6 6',
    down: 'M6 9l6 6 6-6',
    more: 'M5 12h.01M12 12h.01M19 12h.01',
    clip: 'M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6',
    check: 'M5 12.5l4.5 4.5L19 7.5',
    list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
    board: 'M4 5h4v14H4zM10 5h4v9h-4zM16 5h4v11h-4z',
    notes: 'M5 6h14M5 10h14M5 14h9',
    grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
    todo: 'M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1ZM8 12l3 3 5-6',
    folder: 'M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z',
    calendar: 'M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM4 10h16M8 3v4M16 3v4',
    timeline: 'M4 6.5h9M8 12h12M4 17.5h7',
    arrow: 'M7 17 17 7M9 7h8v8',
    book: 'M5 4.5h5a2 2 0 0 1 2 2V20a1.5 1.5 0 0 0-1.5-1.5H5ZM19 4.5h-5a2 2 0 0 0-2 2V20a1.5 1.5 0 0 1 1.5-1.5H19Z',
    plane: 'M10.5 13.5 4 11l1.5-1.5 6.5 1 4-4.5a1.8 1.8 0 0 1 2.5 2.5l-4.5 4 1 6.5L13.5 21 11 14.5l-3 3v2L6.5 21l-1-2.5L3 17.5 4.5 16h2Z',
    briefcase: 'M4 8h16v11H4ZM9 8V5.5h6V8M4 13h16',
    dumbbell: 'M3 10v4M6 8v8M18 8v8M21 10v4M6 12h12',
    heart: 'M12 19.5s-7.5-4.5-7.5-10A4 4 0 0 1 12 7a4 4 0 0 1 7.5 2.5c0 5.5-7.5 10-7.5 10Z',
    star: 'M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z',
    palette: 'M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.4-1.3-1.6-1.3-2.8 0-1 .8-1.5 1.8-1.5h2.2A4 4 0 0 0 20.5 11 8 7.5 0 0 0 12 3.5ZM7.5 11h.01M10 7.5h.01M14.5 7.5h.01',
    camera: 'M4 8h3l2-2.5h6L17 8h3v11H4ZM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
    laptop: 'M5 6h14v9H5ZM3 18.5h18',
    music: 'M9 17.5V6l10-2v11.5M9 17.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0ZM19 15.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z',
    leaf: 'M5 19c0-8 5-13.5 14-14 0 9-5.5 14-14 14ZM5 19l8-8',
    home: 'M4 11 12 4.5l8 6.5V20h-5.5v-5h-5v5H4Z',
    cup: 'M5 8h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5ZM16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11 3.5v2',
    pencil: 'M15.5 4.5l4 4L9 19H5v-4ZM13 7l4 4',
    flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
    sparkle: 'M12 3.5c.6 4.4 2.1 5.9 6.5 6.5-4.4.6-5.9 2.1-6.5 6.5-.6-4.4-2.1-5.9-6.5-6.5 4.4-.6 5.9-2.1 6.5-6.5ZM18.5 15.5c.3 1.9.8 2.4 2.5 2.7-1.7.3-2.2.8-2.5 2.6-.3-1.8-.8-2.3-2.5-2.6 1.7-.3 2.2-.8 2.5-2.7Z',
    sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4',
    moon: 'M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z',
    bowl: 'M3.5 11.5h17a8.5 8.5 0 0 1-17 0ZM9 8c0-1.5 1.2-2 1.2-3.5M13 8c0-1.5 1.2-2 1.2-3.5M7 20h10',
    grip: 'M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01',
    utensils: 'M5 3v5.5a2.5 2.5 0 0 0 5 0V3M7.5 3v18M17 3c-1.7 0-3 2.1-3 4.6s1.3 4.4 3 4.4 3-1.9 3-4.4S18.7 3 17 3ZM17 12v9',
    bus: 'M6 17V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v11M6 17h12M6 11h12M8.5 14h.01M15.5 14h.01M8 17v2M16 17v2',
    car: 'M5 16v-3l2-5h10l2 5v3M5 16h14M5 16v2M19 16v2M7.5 13.5h.01M16.5 13.5h.01M5 13h14',
    receipt: 'M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4v-17ZM9 8h6M9 11.5h6M9 15h3',
    ticket: 'M4 8a2 2 0 0 0 0 4v4h16v-4a2 2 0 0 1 0-4V4H4v4ZM14 4v2M14 9v2M14 14v2',
    gift: 'M4 9h16v3H4zM5 12v8h14v-8M12 9v11M12 9c-1.5-3-5-3.5-5-1.2S10 9 12 9Zm0 0c1.5-3 5-3.5 5-1.2S14 9 12 9Z',
    shirt: 'M8 4l-4 3 2 3 2-1v11h8V9l2 1 2-3-4-3c-.5 1.5-2 2.5-4 2.5S8.5 5.5 8 4Z',
    phone: 'M8 3h8a1.5 1.5 0 0 1 1.5 1.5v15A1.5 1.5 0 0 1 16 21H8a1.5 1.5 0 0 1-1.5-1.5v-15A1.5 1.5 0 0 1 8 3ZM11 18h2',
    paw: 'M12 13c-2.5 0-5 2.8-5 4.6 0 1.6 1.5 2 2.6 1.6 1-.4 1.6-.6 2.4-.6s1.4.2 2.4.6c1.1.4 2.6 0 2.6-1.6 0-1.8-2.5-4.6-5-4.6ZM6 10.5h.01M9.5 7h.01M14.5 7h.01M18 10.5h.01',
    bag: 'M5 8h14l-1 12H6L5 8ZM9 8V6.5a3 3 0 0 1 6 0V8',
    wallet: 'M4 7.5A2.5 2.5 0 0 1 6.5 5H17v2.5M4 7.5V17a2 2 0 0 0 2 2h14V9.5a2 2 0 0 0-2-2H6.5A2.5 2.5 0 0 1 4 7.5ZM16 13.5h.01',
    link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  };
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor"
      strokeWidth={name === 'more' || name === 'grip' ? 3 : 1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d={paths[name]} />
    </svg>
  );
}

// The mark before an entry: its project's icon when it has one, otherwise the usual glyph
// (• task, ○ event, $ bill, × done).
export function entryGlyph(e, size = 13) {
  if (!e.done && e.source === 'item' && e.projectIcon) {
    return <span className="glyph-icon" title={e.project}><Icon name={e.projectIcon} size={size} /></span>;
  }
  return e.done ? '×' : e.source === 'bill' ? '$' : e.kind === 'event' ? '○' : '•';
}

export function Mark({ entry, onToggle }) {
  const canToggle = entry.source === 'item' && (entry.kind === 'task' || entry.kind === 'deadline');
  const glyph = entryGlyph(entry, 14);
  if (!canToggle) {
    return (
      <span className="mark" aria-hidden="true">
        <span className={`glyph glyph-${entry.kind}`}>{glyph}</span>
      </span>
    );
  }
  return (
    <button className="mark" onClick={(e) => { e.stopPropagation(); onToggle(entry.item.id); }}
      aria-label={entry.done ? `Mark "${entry.title}" not done` : `Mark "${entry.title}" done`} aria-pressed={entry.done}>
      <span className={`glyph glyph-${entry.kind}`}>{glyph}</span>
    </button>
  );
}

export function EntryRow({ entry, areasById, onToggle, onOpen, meta }) {
  const area = areasById[entry.area];
  return (
    <li className="entry" data-done={entry.done || undefined} data-kind={entry.kind} style={areaStyle(area)}>
      <Mark entry={entry} onToggle={onToggle} />
      <button className="entry-body" onClick={() => onOpen(entry)}>
        <span className="entry-title">{entry.title}</span>
        {meta && <span className="entry-meta">{meta}</span>}
      </button>
    </li>
  );
}

export function metaFor(entry, { showDate = false, showArea = false, showProject = true, areasById = {} } = {}) {
  const bits = [];
  if (showDate && entry.date) bits.push(entry.endDate ? rangeLabel(entry.date, entry.endDate) : shortDate(entry.date));
  if (entry.time) bits.push(time12(entry.time));
  if (entry.source === 'bill') bits.push(`${entry.cost} bill`);
  else if (entry.kind === 'deadline') bits.push('due');
  if (showArea && areasById[entry.area]) bits.push(areasById[entry.area].name);
  if (showProject && entry.project) bits.push(entry.project);
  if (entry.source === 'calendar') bits.push('calendar');
  return bits.join(', ');
}

// A modal sheet: slides up on phones, centred on wider screens. Traps focus
// and returns it to wherever it came from on close.
export function Sheet({ onClose, label, children, as: Tag = 'div', wide = false, side = false, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    const first = ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('button, input');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && ref.current) {
        const els = [...ref.current.querySelectorAll('button, input, select, textarea, a[href]')].filter((x) => !x.disabled && x.offsetParent);
        const a = els[0], z = els[els.length - 1];
        if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('sheet-open');
      prev?.focus?.();
    };
  }, []); // eslint-disable-line
  return (
    <div className={`scrim${side ? ' scrim-side' : ''}`} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <Tag className={`sheet${wide ? ' sheet-wide' : ''}${side ? ' sheet-side' : ''}`} role="dialog" aria-modal="true" aria-label={label} ref={ref} {...rest}>
        {children}
      </Tag>
    </div>
  );
}

// Finds links in free text, so Jira or Confluence URLs pasted into notes are one tap away.
export const findLinks = (text) => [...new Set((text || '').match(/https?:\/\/[^\s)>\]]+/g) || [])];
export const linkLabel = (u) => {
  try {
    const url = new URL(u);
    const path = url.pathname.replace(/\/$/, '');
    const tail = path.split('/').filter(Boolean).slice(-1)[0] || '';
    return `${url.hostname.replace(/^www\./, '')}${tail ? ' / ' + decodeURIComponent(tail.replace(/\+/g, ' ')).slice(0, 40) : ''}`;
  } catch {
    return u;
  }
};

// A two-step button for anything that can't be undone: the first press asks,
// the second does it. Works everywhere, unlike the browser's confirm dialog.
export function ConfirmButton({ onConfirm, children, confirmText, className = 'text-btn danger', ...rest }) {
  const [armed, setArmed] = React.useState(false);
  React.useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button type="button" {...rest} className={`${className}${armed ? ' armed' : ''}`}
      onClick={() => (armed ? (setArmed(false), onConfirm()) : setArmed(true))}
      onBlur={() => setArmed(false)}>
      {armed ? confirmText : children}
    </button>
  );
}

// Light, dark or follow the device, plus a colour theme (1 Pastel, 2 Linen).
// Both are stored per device and applied to the root element.
const THEME_KEY = 'hub.theme';
const PALETTE_KEY = 'hub.palette';
export const PALETTES = [
  { id: '1', name: 'Pastel', swatches: ['#F5D0D0', '#D2DDAE', '#F2EDC6', '#DAE9FA', '#2F2E35'] },
  { id: '2', name: 'Linen', swatches: ['#E8CCD7', '#CFC9DD', '#EBE1D8', '#DEE5ED', '#6C6C6A'] },
];
const BARS = { '1': ['#FAF9F7', '#1D1D21'], '2': ['#FAF9F7', '#262624'] };
const systemDark = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches;
const readKey = (k, d) => { try { return localStorage.getItem(k) || d; } catch { return d; } };
// Apply the saved colour theme before the first paint, so there's no flash of the other one.
if (typeof document !== 'undefined' && readKey(PALETTE_KEY, '1') !== '1') document.documentElement.setAttribute('data-palette', readKey(PALETTE_KEY, '1'));
export function useTheme() {
  const [choice, setChoice] = React.useState(() => readKey(THEME_KEY, 'system'));
  const [palette, setPalette] = React.useState(() => readKey(PALETTE_KEY, '1'));
  const [sysDark, setSysDark] = React.useState(systemDark);
  React.useEffect(() => {
    if (typeof matchMedia === 'undefined') return;
    const m = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setSysDark(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  React.useEffect(() => {
    const root = document.documentElement;
    if (choice === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', choice);
    if (palette === '1') root.removeAttribute('data-palette');
    else root.setAttribute('data-palette', palette);
    try { localStorage.setItem(THEME_KEY, choice); localStorage.setItem(PALETTE_KEY, palette); } catch { /* ignore */ }
    const dark = choice === 'dark' || (choice === 'system' && sysDark);
    const bars = BARS[palette] || BARS['1'];
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? bars[1] : bars[0]));
  }, [choice, palette, sysDark]);
  const isDark = choice === 'dark' || (choice === 'system' && sysDark);
  return { choice, setChoice, palette, setPalette, isDark, toggle: () => setChoice(isDark ? 'light' : 'dark') };
}
