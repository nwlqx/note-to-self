// Data shapes, merging and date helpers. No React here so it can be tested in Node.

export const PALETTE = [
  // in colour order: reds and pinks, purple, blue, green, yellow
  { id: 'peach', name: 'Light red' },
  { id: 'pink', name: 'Baby pink' },
  { id: 'rose', name: 'Light rose' },
  { id: 'lavender', name: 'Pastel purple' },
  { id: 'snow', name: 'Snow' },
  { id: 'pistachio', name: 'Pistachio' },
  { id: 'yellow', name: 'Pale yellow' },
];

// Colours saved by earlier versions of the app, mapped onto the current palette.
const LEGACY_HUES = {
  violet: 'lavender',
  tomato: 'pink', olive: 'pistachio', mustard: 'yellow', sky: 'snow', mint: 'pistachio', slate: 'rose',
  indigo: 'snow', moss: 'pistachio', ochre: 'yellow', plum: 'lavender', teal: 'pistachio', rust: 'pink',
};
// Project colours: the two area hues the matrix doesn't use, plus four of their own.
// Pink, pistachio, yellow and snow stay with the matrix quadrants.
export const PROJECT_HUES = [
  { id: 'rose', name: 'Light rose' },
  { id: 'lavender', name: 'Lavender' },
  { id: 'peach', name: 'Light red' },
  { id: 'aqua', name: 'Aqua' },
  { id: 'lilac', name: 'Lilac' },
  { id: 'sand', name: 'Sand' },
];
// Area icons: a suggestion from the area's name, which you can change in Settings.
export const AREA_ICONS = ['briefcase', 'book', 'plane', 'dumbbell', 'heart', 'home', 'wallet', 'palette', 'camera', 'laptop', 'music', 'leaf', 'cup', 'utensils', 'pencil', 'star', 'flag', 'sparkle'];
const AREA_ICON_WORDS = [
  [/work|job|office|career|edupass/, 'briefcase'], [/stud|school|uni|class|course|learn|suss/, 'book'],
  [/travel|trip|holiday|vacation/, 'plane'], [/fit|gym|run|sport|exercise|health/, 'dumbbell'],
  [/personal|self|life|me\b/, 'heart'], [/home|house|family|chore/, 'home'], [/money|financ|budget/, 'wallet'],
  [/art|design|creat|hobby|craft|knit/, 'palette'], [/photo/, 'camera'], [/side|project|dev|code/, 'laptop'],
  [/music/, 'music'], [/garden|plant/, 'leaf'], [/food|cook|meal/, 'utensils'], [/writ|journal|blog/, 'pencil'],
];
export const suggestAreaIcon = (name) => {
  const n = (name || '').toLowerCase();
  const hit = AREA_ICON_WORDS.find(([re]) => re.test(n));
  return hit ? hit[1] : '';
};
// An area's icon: its own choice ('' means none), otherwise the suggestion from its name.
export const areaIcon = (a) => (a?.icon != null ? a.icon : suggestAreaIcon(a?.name));

export const PROJECT_ICONS = ['book', 'plane', 'briefcase', 'dumbbell', 'heart', 'star', 'palette', 'camera', 'laptop', 'music', 'leaf', 'home', 'cup', 'pencil', 'flag', 'sparkle'];

// Projects saved without a colour get a steady one from the project palette.
export const fallbackHue = (id = '') => {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return PROJECT_HUES[n % PROJECT_HUES.length].id;
};

export const hueOf = (color) => LEGACY_HUES[color] || (PALETTE.some((p) => p.id === color) || PROJECT_HUES.some((p) => p.id === color) ? color : 'rose');

export const KINDS = [
  { id: 'task', label: 'Task', mark: '•' },
  { id: 'event', label: 'Event', mark: '○' },
];

// The Eisenhower matrix, in reading order: top row is important, left column is urgent.
export const QUADRANTS = [
  { id: 'do', name: 'Do', hint: 'Urgent and important' },
  { id: 'schedule', name: 'Schedule', hint: 'Important, not urgent' },
  { id: 'delegate', name: 'Squeeze in', hint: 'Urgent, not important' },
  { id: 'drop', name: 'Later', hint: 'Neither urgent nor important' },
];

// Trips are events that span several days. Earlier versions saved them as their own kind.
// Tasks have no separate "deadline" type any more: a task with a date is due on that date.
export const normKind = (k, date) => {
  if (k === 'trip' || k === 'event') return 'event';
  return date ? 'deadline' : 'task';
};
export const isEventKind = (k) => k === 'event' || k === 'trip';

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const nowIso = () => new Date().toISOString();

// ---------- dates (all local, as YYYY-MM-DD) ----------
const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseKey = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const todayKey = () => dateKey(new Date());
export const addDays = (k, n) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return dateKey(d);
};
export const startOfWeek = (k) => {
  const d = parseKey(k);
  const dow = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - dow);
  return dateKey(d);
};
export const monthKey = (k) => k.slice(0, 7);
export const daysBetween = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);

// ---------- merging ----------
const TOMBSTONE_DAYS = 30;

export function mergeById(local = [], remote = []) {
  const map = new Map();
  for (const x of remote) map.set(x.id, x);
  for (const x of local) {
    const r = map.get(x.id);
    if (!r || (x.updatedAt || '') > (r.updatedAt || '')) map.set(x.id, x);
  }
  const cutoff = new Date(Date.now() - TOMBSTONE_DAYS * 864e5).toISOString();
  return [...map.values()].filter((x) => !(x.deleted && (x.updatedAt || '') < cutoff));
}

export function mergeItems(local, remote) {
  return { items: mergeById(local?.items, remote?.items).sort((a, b) => a.id.localeCompare(b.id)) };
}

export function mergeSettings(local, remote) {
  const l = local || {};
  const r = remote || {};
  const calNewer = (l.calendarAreasUpdatedAt || '') >= (r.calendarAreasUpdatedAt || '');
  return {
    areas: mergeById(l.areas, r.areas).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    projects: mergeById(l.projects, r.projects).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
    lists: mergeById(l.lists, r.lists).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
    calendarAreas: calNewer ? l.calendarAreas || {} : r.calendarAreas || {},
    calendarAreasUpdatedAt: calNewer ? l.calendarAreasUpdatedAt : r.calendarAreasUpdatedAt,
    ...(((l.nameUpdatedAt || '') >= (r.nameUpdatedAt || '')) ? { name: l.name || '', nameUpdatedAt: l.nameUpdatedAt } : { name: r.name || '', nameUpdatedAt: r.nameUpdatedAt }),
  };
}

export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------- projects and cards ----------
export const DEFAULT_SECTIONS = () => [
  { id: 's-' + uid(), name: 'To do' },
  { id: 's-' + uid(), name: 'Doing' },
  { id: 's-' + uid(), name: 'Done', done: true },
];

export const newProject = (area, name, order = 0) => ({
  id: 'p-' + uid(), area, name, sections: DEFAULT_SECTIONS(), order, updatedAt: nowIso(),
});

export const doneSection = (p) => p?.sections?.find((s) => s.done);
export const firstOpenSection = (p) => p?.sections?.find((s) => !s.done) || p?.sections?.[0];

// The section a card is shown in. Cards whose section was removed fall back to
// the first section (or Done, if the card is done).
export function sectionOf(card, project) {
  if (!project) return null;
  if (project.sections.some((s) => s.id === card.section)) return card.section;
  return (card.done ? doneSection(project) : firstOpenSection(project))?.id || null;
}

// An order value that sorts after `before` and ahead of `after`.
export function orderBetween(before, after) {
  if (before == null && after == null) return 1000;
  if (before == null) return after - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}

export const cardArea = (card, projectsById) => projectsById[card.projectId]?.area || card.area || null;

// Older data stored the project as free text on each item. Turn those into
// real projects once, so nothing is lost.
export function migrate(items, settings) {
  const legacy = (items?.items || []).filter((x) => !x.deleted && x.project && !x.projectId);
  if (!legacy.length) return null;
  const projects = [...(settings?.projects || [])];
  const nextItems = (items.items || []).map((it) => {
    if (it.deleted || !it.project || it.projectId) return it;
    let p = projects.find((q) => !q.deleted && q.area === it.area && q.name === it.project);
    if (!p) {
      p = newProject(it.area, it.project, projects.length);
      projects.push(p);
    }
    const { project, ...rest } = it;
    const sec = (it.done ? doneSection(p) : firstOpenSection(p)).id;
    return { ...rest, projectId: p.id, section: sec, order: rest.order ?? 1000, updatedAt: nowIso() };
  });
  return { items: { items: nextItems }, settings: { ...settings, projects } };
}

// ---------- entries: items and calendar events in one shape ----------
export function buildEntries(items, events, settings) {
  const out = [];
  const projectsById = Object.fromEntries((settings?.projects || []).filter((p) => !p.deleted).map((p) => [p.id, p]));
  for (const it of items || []) {
    if (it.deleted) continue;
    const project = projectsById[it.projectId];
    out.push({
      key: 'i:' + it.id,
      source: 'item',
      kind: normKind(it.kind, it.date),
      title: it.title,
      area: project?.area || it.area || null,
      project: project?.name || '',
      projectId: project ? project.id : '',
      projectIcon: project?.icon || '',
      date: it.date || '',
      endDate: isEventKind(it.kind) && it.endDate && it.endDate > it.date ? it.endDate : '',
      time: it.kind === 'event' ? it.time || '' : '',
      endTime: it.kind === 'event' && it.time && it.endTime > it.time ? it.endTime : '',
      done: !!it.done,
      notes: it.notes || '',
      item: it,
    });
  }
  for (const ev of events || []) {
    const area = settings?.calendarAreas?.[ev.calendar] || null;
    if (area === 'hidden') continue;
    let date, endDate = '', time = '';
    if (ev.allDay) {
      date = ev.start;
      if (ev.end && ev.end > ev.start) endDate = ev.end;
    } else {
      const s = new Date(ev.start);
      date = dateKey(s);
      time = `${pad(s.getHours())}:${pad(s.getMinutes())}`;
    }
    out.push({
      key: 'c:' + ev.id,
      source: 'calendar',
      kind: 'event',
      title: ev.title,
      area,
      project: '',
      date,
      endDate,
      time,
      done: false,
      notes: ev.location || '',
      calendar: ev.calendar,
      ev,
    });
  }
  return out;
}

const kindOrder = { event: 0, deadline: 1, task: 2 };
export const isOpenTask = (e) => !e.done && (e.kind === 'task' || e.kind === 'deadline');
export function sortEntries(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return (a.date || '9999') < (b.date || '9999') ? -1 : 1;
    const ka = kindOrder[a.kind], kb = kindOrder[b.kind];
    if (ka !== kb) return ka - kb;
    if (a.time !== b.time) return (a.time || '99') < (b.time || '99') ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

export const isRange = (e) => !!e.endDate;
export const covers = (e, day) => (e.endDate ? e.date <= day && day <= e.endDate : e.date === day);

// ---------- project lists (packing lists and other simple checklists) ----------
export const listsOf = (settings, projectId) => (settings?.lists || []).filter((l) => !l.deleted && l.projectId === projectId);

// Progress for a project counts its cards and the items on its lists.
export function projectProgress(projectId, items, settings) {
  const cards = (items || []).filter((c) => !c.deleted && c.projectId === projectId);
  const listItems = listsOf(settings, projectId).flatMap((l) => l.items || []);
  return {
    cards,
    total: cards.length + listItems.length,
    done: cards.filter((c) => c.done).length + listItems.filter((i) => i.done).length,
  };
}
