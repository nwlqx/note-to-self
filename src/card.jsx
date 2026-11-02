// The card sheet. Changes save as you go, like Asana: there is no Save button.
import React, { useEffect, useRef, useState } from 'react';
import { KINDS, uid, sectionOf, googleCalendarUrl } from './model.js';
import { Sheet, Icon, areaColor, findLinks, linkLabel, rangeLabel, longDate, time12, ConfirmButton } from './ui.jsx';
import { formatSize } from './files.js';
import { QuadPicker } from './todo.jsx';

const FIELDS = ['id', 'title', 'kind', 'projectId', 'section', 'area', 'date', 'endDate', 'time', 'endTime', 'notes', 'checklist', 'order', 'quadrant', 'qOrder'];
const pick = (o) => Object.fromEntries(FIELDS.map((k) => [k, o[k]]));

// Moving an event's start keeps its length, the way Google Calendar does.
const hm = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const mh = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
function moveStart(f, time) {
  if (!time) return { time: '', endTime: '' };
  if (!f.time || !f.endTime) return { time };
  const end = hm(time) + (hm(f.endTime) - hm(f.time));
  return { time, endTime: end < 24 * 60 ? mh(end) : '' };
}

export function CardSheet({ hub, cardId, defaults, areas, projects, onClose }) {
  const stored = cardId ? hub.data.items.items.find((x) => x.id === cardId) : null;
  const [f, setF] = useState(() => ({
    id: cardId || 'c-' + uid(),
    title: '', kind: 'task', projectId: '', section: '', area: areas[0]?.id || '',
    date: '', endDate: '', time: '', endTime: '', notes: '', checklist: [],
    ...(stored ? pick(stored) : defaults),
  }));
  if (f.kind === 'trip') f.kind = 'event';
  const live = hub.data.items.items.find((x) => x.id === f.id); // includes attachments and done state
  const saved = useRef(!!stored);
  const timer = useRef(null);
  const latest = useRef(f);
  latest.current = f;

  const project = projects.find((p) => p.id === f.projectId);
  const projectsByArea = areas.map((a) => ({ area: a, list: projects.filter((p) => p.area === a.id && !p.archived) }));

  const flush = () => {
    clearTimeout(timer.current);
    const cur = latest.current;
    if (!cur.title.trim()) return;
    const out = hub.saveCard({ ...cur, title: cur.title.trim() });
    saved.current = true;
    return out;
  };

  const set = (patch, { now = false } = {}) => {
    setF((cur) => {
      const next = { ...cur, ...patch };
      latest.current = next;
      return next;
    });
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, now ? 0 : 500);
  };

  // Pick up the section the store chose (for example after a project change).
  useEffect(() => {
    if (live && (live.section !== f.section || live.order !== f.order)) {
      setF((cur) => ({ ...cur, section: live.section, order: live.order }));
    }
  }, [live?.section, live?.order]); // eslint-disable-line

  const close = () => {
    flush();
    onClose();
  };

  // ---------- checklist ----------
  const [newItem, setNewItem] = useState('');
  const checklist = f.checklist || [];
  const setChecklist = (list) => set({ checklist: list }, { now: true });
  const addCheck = () => {
    if (!newItem.trim()) return;
    setChecklist([...checklist, { id: uid(), text: newItem.trim(), done: false }]);
    setNewItem('');
  };

  // ---------- attachments ----------
  const [uploading, setUploading] = useState(0);
  const [fileError, setFileError] = useState('');
  const fileInput = useRef(null);
  const onFiles = async (files) => {
    setFileError('');
    if (!latest.current.title.trim()) set({ title: 'Untitled card' });
    latest.current = { ...latest.current, title: latest.current.title.trim() || 'Untitled card' };
    flush();
    for (const file of files) {
      setUploading((n) => n + 1);
      try {
        await hub.uploadAttachment(latest.current.id, file);
      } catch (e) {
        setFileError(e.message);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  // Grow the title box to fit long titles.
  const titleRef = useRef(null);
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [f.title]);

  const links = findLinks(f.notes);
  const done = live ? !!live.done : false;
  const sec = project && live ? sectionOf(live, project) : f.section;

  return (
    <Sheet onClose={close} label={f.title || 'New card'} wide>
      <div className="card-sheet-top">
        <button className="text-btn small quiet" onClick={close}>Close</button>
        {live && (live.kind === 'task' || live.kind === 'deadline' || !live.kind) && (
          <button className={`done-btn${done ? ' is-done' : ''}`} aria-pressed={done}
            onClick={() => { flush(); hub.toggleDone(f.id); }}>
            <Icon name="check" size={18} />{done ? 'Done' : 'Mark done'}
          </button>
        )}
      </div>

      <textarea ref={titleRef} data-autofocus className="title-input" rows="1" value={f.title} placeholder="Title" aria-label="Title"
        onChange={(e) => set({ title: e.target.value.replace(/\n/g, ' ') })}
        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()} />

      <div className="field-grid">
        <label>Project
          <select value={f.projectId} onChange={(e) => {
            const p = projects.find((x) => x.id === e.target.value);
            set({ projectId: e.target.value, section: '', area: p ? p.area : f.area }, { now: true });
          }}>
            <option value="">No project</option>
            {projectsByArea.filter((g) => g.list.length).map((g) => (
              <optgroup key={g.area.id} label={g.area.name}>
                {g.list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
        {project ? (
          <label>Section
            <select value={sec || ''} onChange={(e) => set({ section: e.target.value }, { now: true })}>
              {project.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
        ) : (
          <label>Area
            <select value={f.area || ''} onChange={(e) => set({ area: e.target.value }, { now: true })}>
              <option value="">No area</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
        )}
      </div>

      <div className="seg" role="radiogroup" aria-label="Type">
        {KINDS.map((k) => (
          <button type="button" key={k.id} role="radio" aria-checked={(f.kind === 'event' ? 'event' : 'task') === k.id} onClick={() => set(k.id === 'event' ? { kind: 'event' } : { kind: f.date ? 'deadline' : 'task', endDate: '', time: '', endTime: '' }, { now: true })}>
            <span className="seg-mark" aria-hidden="true">{k.mark}</span>{k.label}
          </button>
        ))}
      </div>

      <div className="field-grid">
        <label>{f.kind === 'event' ? (f.endDate ? 'From' : 'Date') : 'Due date (optional)'}
          <input type="date" value={f.date || ''} onChange={(e) => set(f.kind === 'event' ? { date: e.target.value } : { date: e.target.value, kind: e.target.value ? 'deadline' : 'task' }, { now: true })} />
        </label>
        {f.kind === 'event' && (
          <label>Until (optional)<input type="date" value={f.endDate || ''} min={f.date || undefined}
            onChange={(e) => set({ endDate: e.target.value, ...(e.target.value && e.target.value > f.date ? { time: '', endTime: '' } : {}) }, { now: true })} /></label>
        )}
      </div>
      {f.kind === 'event' && !(f.endDate && f.endDate > f.date) && (
        <div className="field-grid field-grid-two">
          <>
            <label>{f.time ? 'Starts' : 'Time (optional)'}<input type="time" value={f.time || ''} onChange={(e) => set(moveStart(f, e.target.value), { now: true })} /></label>
            {f.time && (
              <label>Ends<input type="time" value={f.endTime || ''} min={f.time} onChange={(e) => set({ endTime: e.target.value && e.target.value > f.time ? e.target.value : '' }, { now: true })} /></label>
            )}
          </>
        </div>
      )}
      {/* Opens Google Calendar with this event filled in; you pick Work or Personal there and save.
          The hourly sync then brings it back here from Google. */}
      {f.kind === 'event' && f.date && f.title.trim() && (
        <a className="secondary gcal-add" href={googleCalendarUrl(f)} target="_blank" rel="noreferrer">
          <Icon name="calendar" size={16} />Add to Google Calendar
        </a>
      )}


      {(f.kind === 'task' || f.kind === 'deadline') && (
        <div className="card-part" role="group" aria-labelledby="prio-head">
          <h3 id="prio-head">Priority</h3>
          <QuadPicker value={f.quadrant || ''} onPick={(q) => set({ quadrant: q }, { now: true })}
            onClear={() => set({ quadrant: '' }, { now: true })} />
        </div>
      )}

      <section className="card-part" aria-labelledby="cl-head">
        <h3 id="cl-head">Checklist{checklist.length > 0 && <span className="count"> {checklist.filter((c) => c.done).length} of {checklist.length}</span>}</h3>
        <ul className="checklist">
          {checklist.map((c) => (
            <li key={c.id} data-done={c.done || undefined}>
              <button className="check" aria-pressed={c.done} aria-label={c.done ? `Untick ${c.text}` : `Tick ${c.text}`}
                onClick={() => setChecklist(checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))}>
                {c.done && <Icon name="check" size={16} />}
              </button>
              <input value={c.text} aria-label="Checklist item"
                onChange={(e) => set({ checklist: checklist.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)) })} />
              <button className="icon-btn" aria-label={`Remove ${c.text}`}
                onClick={() => setChecklist(checklist.filter((x) => x.id !== c.id))}><Icon name="close" size={16} /></button>
            </li>
          ))}
        </ul>
        <div className="check-add">
          <span className="check-add-mark" aria-hidden="true"><Icon name="plus" size={16} /></span>
          <input value={newItem} placeholder="Add an item" aria-label="Add a checklist item"
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCheck(); } }} />
          {newItem.trim() && <button className="text-btn small" onClick={addCheck}>Add</button>}
        </div>
      </section>

      <section className="card-part">
        <label>Notes and links
          <textarea rows="4" value={f.notes || ''} onChange={(e) => set({ notes: e.target.value })}
            placeholder="Paste a link or write anything" />
        </label>
        {links.length > 0 && (
          <ul className="links">
            {links.map((u) => (
              <li key={u}><a href={u} target="_blank" rel="noreferrer"><Icon name="link" size={16} />{linkLabel(u)}</a></li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-part" aria-labelledby="att-head">
        <h3 id="att-head">Photos and files</h3>
        <Attachments hub={hub} card={live} />
        {uploading > 0 && <p className="hint" role="status">Uploading {uploading === 1 ? 'a file' : `${uploading} files`}</p>}
        {fileError && <p className="error" role="alert">{fileError}</p>}
        <input ref={fileInput} type="file" multiple hidden onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />
        <button className="text-btn" onClick={() => fileInput.current.click()}><Icon name="clip" size={16} /> Add photo or file</button>
      </section>

      {saved.current && (
        <div className="sheet-actions">
          <ConfirmButton className="text-btn danger push-right" confirmText="Delete for good?"
            onConfirm={() => { clearTimeout(timer.current); hub.deleteItem(f.id); onClose(); }}>Delete card</ConfirmButton>
        </div>
      )}
    </Sheet>
  );
}

function Attachments({ hub, card }) {
  const list = card?.attachments || [];
  if (!list.length) return null;
  return (
    <ul className="attachments">
      {list.map((a) => <Attachment key={a.id} hub={hub} card={card} att={a} />)}
    </ul>
  );
}

function Attachment({ hub, card, att }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  const [viewing, setViewing] = useState(false);
  const isImage = att.type?.startsWith('image/');
  useEffect(() => {
    let live = true;
    hub.attachmentUrl(att).then((u) => live && setUrl(u)).catch(() => live && setErr(true));
    return () => { live = false; };
  }, [att.path]); // eslint-disable-line
  return (
    <li className={`attachment${isImage ? ' is-image' : ''}`}>
      {isImage ? (
        <button className="att-open" onClick={() => url && setViewing(true)} aria-label={`View ${att.name}`}>
          {url ? <img src={url} alt="" /> : <span className="att-ph">{err ? "Couldn't load" : 'Loading'}</span>}
        </button>
      ) : (
        <a className="att-open att-file" href={url || undefined} target="_blank" rel="noreferrer" download={att.name}>
          <Icon name="clip" size={16} />{att.name}<span className="count"> {err ? "couldn't load" : formatSize(att.size)}</span>
        </a>
      )}
      <ConfirmButton className="att-remove" aria-label={`Remove ${att.name}`}
        confirmText={<span className="confirm-mini">Remove</span>}
        onConfirm={() => hub.removeAttachment(card.id, att.id)}>
        <Icon name="close" size={14} />
      </ConfirmButton>
      {viewing && (
        <div className="lightbox" role="dialog" aria-label={att.name} onClick={() => setViewing(false)}
          onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setViewing(false))}>
          <img src={url} alt={att.name} />
          <button className="icon-btn lightbox-close" autoFocus aria-label="Close photo" onClick={() => setViewing(false)}><Icon name="close" /></button>
        </div>
      )}
    </li>
  );
}

export const colorFor = areaColor;
