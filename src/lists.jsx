// Project lists: packing lists, documents to bring, software to install. Simple
// checklists that belong to the whole project rather than to one card.
import React, { useEffect, useRef, useState } from 'react';
import { uid, listsOf } from './model.js';
import { useDragSort } from './drag.js';
import { Icon, ConfirmButton } from './ui.jsx';
import { DragGhost } from './projects.jsx';

const COLLAPSE_KEY = 'hub.listsCollapsed';
const loadCollapsed = () => { try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY) || '{}'); } catch { return {}; } };

export function ProjectLists({ hub, project, onOpenCard, openNew = 0 }) {
  const lists = listsOf(hub.data.settings, project.id);
  const [collapsed, setCollapsedState] = useState(loadCollapsed);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const sectionRef = useRef(null);
  // "+ Checklist" at the top of the project opens the name box here and brings it into view.
  useEffect(() => {
    if (!openNew) return;
    setAdding(true);
    sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [openNew]);
  const setCollapsed = (id, v) => {
    const next = { ...collapsed, [id]: v };
    setCollapsedState(next);
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const listsRef = useRef(lists);
  listsRef.current = lists;
  // Drag items within a list or across lists. Zones are "list:<id>".
  const { drag, onPointerDown, rowsFor } = useDragSort({
    onDrop: ({ id, zone, index }) => {
      if (!zone?.startsWith('list:')) return;
      const all = listsRef.current;
      const from = all.find((l) => (l.items || []).some((i) => i.id === id));
      const to = all.find((l) => l.id === zone.slice(5));
      if (!from || !to) return;
      const item = from.items.find((i) => i.id === id);
      if (from.id === to.id) {
        const rest = from.items.filter((i) => i.id !== id);
        rest.splice(index, 0, item);
        hub.saveList({ ...from, items: rest });
      } else {
        const toItems = [...(to.items || [])];
        toItems.splice(index, 0, item);
        hub.saveList({ ...from, items: from.items.filter((i) => i.id !== id) });
        hub.saveList({ ...to, items: toItems });
      }
    },
  });

  const createList = () => {
    const name = newName.trim();
    if (!name) { setAdding(false); return; }
    hub.saveList({ id: 'l-' + uid(), projectId: project.id, name, items: [], order: lists.length ? Math.max(...lists.map((l) => l.order ?? 0)) + 1 : 0 });
    setNewName('');
    setAdding(false);
  };

  return (
    <section className="plists" ref={sectionRef} aria-labelledby={`plists-${project.id}`}>
      <div className="plists-head">
        <h2 id={`plists-${project.id}`} className="plists-title"><span className="hl-text">Checklists</span></h2>
        {!adding && <button className="text-btn small" onClick={() => setAdding(true)}><Icon name="plus" size={14} />New checklist</button>}
      </div>
      {adding && (
        <div className="plist-new">
          <input autoFocus value={newName} placeholder="Checklist name, e.g. Packing" aria-label="New checklist name"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createList(); } if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
            onBlur={createList} />
        </div>
      )}
      {!lists.length && !adding && (
        <p className="plists-empty">Keep simple checklists here, like packing or documents to bring.</p>
      )}
      {lists.map((l) => (
        <ListBlock key={l.id} hub={hub} list={l} collapsed={!!collapsed[l.id]} onCollapse={(v) => setCollapsed(l.id, v)}
          drag={drag} onPointerDown={onPointerDown} rowsFor={rowsFor} onOpenCard={onOpenCard} />
      ))}
      <DragGhost drag={drag} />
    </section>
  );
}

function ListBlock({ hub, list, collapsed, onCollapse, drag, onPointerDown, rowsFor, onOpenCard }) {
  const items = list.items || [];
  const done = items.filter((i) => i.done).length;
  const [text, setText] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(list.name);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  const zone = 'list:' + list.id;
  const { rows, lineAtEnd } = rowsFor(items, zone);

  useEffect(() => {
    if (!menu) return undefined;
    const off = (e) => { if (!menuRef.current?.contains(e.target)) setMenu(false); };
    const esc = (e) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', off);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', off); document.removeEventListener('keydown', esc); };
  }, [menu]);

  const save = (patch) => hub.saveList({ ...list, ...patch });
  const setItems = (next) => save({ items: next });
  const add = () => {
    const t = text.trim();
    if (!t) return;
    setItems([...items, { id: uid(), text: t, done: false }]);
    setText('');
  };
  const commitName = () => {
    const n = name.trim();
    setRenaming(false);
    if (n && n !== list.name) save({ name: n });
    else setName(list.name);
  };

  return (
    <div className="plist" data-collapsed={collapsed || undefined}>
      <div className="plist-head" ref={menuRef}>
        <button className="plist-toggle" aria-expanded={!collapsed} aria-label={`${collapsed ? 'Show' : 'Hide'} ${list.name}`} onClick={() => onCollapse(!collapsed)}>
          <Icon name={collapsed ? 'right' : 'down'} size={16} />
        </button>
        {renaming ? (
          <input className="plist-name-input" autoFocus value={name} aria-label="List name"
            onChange={(e) => setName(e.target.value)} onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitName(); } if (e.key === 'Escape') { setName(list.name); setRenaming(false); } }} />
        ) : (
          <button className="plist-name" onClick={() => onCollapse(!collapsed)}>{list.name}</button>
        )}
        <span className="plist-count" aria-label={`${done} of ${items.length} done`}>{done}/{items.length}</span>
        <button className="icon-btn plist-more" aria-label={`${list.name} options`} aria-expanded={menu} onClick={() => setMenu((m) => !m)}><Icon name="more" size={16} /></button>
        {menu && (
          <div className="section-menu" role="menu">
            <button role="menuitem" onClick={() => { setMenu(false); setName(list.name); setRenaming(true); }}>Rename</button>
            {done > 0 && <button role="menuitem" onClick={() => { setMenu(false); setItems(items.map((i) => ({ ...i, done: false }))); }}>Untick all</button>}
            {done > 0 && <button role="menuitem" onClick={() => { setMenu(false); setItems(items.filter((i) => !i.done)); }}>Clear ticked items</button>}
            <ConfirmButton className="danger-item" role="menuitem" confirmText={items.length ? `Delete ${items.length} item${items.length === 1 ? '' : 's'} too` : 'Tap again to delete'}
              onConfirm={() => { setMenu(false); hub.deleteList(list.id); }}>Delete list</ConfirmButton>
          </div>
        )}
      </div>
      {items.length > 0 && <span className="plist-bar" aria-hidden="true"><span style={{ width: `${(done / items.length) * 100}%` }} /></span>}

      {!collapsed && (
        <>
          <ul className="plist-items" data-drop={zone}>
            {rows.map(({ c: it, dragging, lineBefore }) => (
              <React.Fragment key={it.id}>
                {lineBefore && <li className="drop-line" style={{ height: drag.h }} />}
                <li hidden={dragging || undefined} data-drag-id={it.id} data-done={it.done || undefined}
                  onPointerDown={(e) => onPointerDown(e, { id: it.id, title: it.text, zone, mark: it.done ? '✓' : '○' })}
                  onContextMenu={(e) => e.preventDefault()}>
                  <span className="plist-grip" aria-hidden="true" title="Drag to reorder"><Icon name="grip" size={14} /></span>
                  <button className="check no-drag" aria-pressed={!!it.done} aria-label={it.done ? `Untick ${it.text}` : `Tick ${it.text}`}
                    onClick={() => setItems(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))}>
                    {it.done && <Icon name="check" size={14} />}
                  </button>
                  <ItemText value={it.text} onChange={(t) => setItems(items.map((x) => (x.id === it.id ? { ...x, text: t } : x)))} />
                  <span className="plist-actions no-drag">
                    <button className="icon-btn" aria-label={`Make "${it.text}" a card`} title="Make it a card"
                      onClick={() => { const id = hub.promoteListItem(list, it.id); if (id) onOpenCard?.(id); }}><Icon name="arrow" size={15} /></button>
                    <button className="icon-btn" aria-label={`Remove ${it.text}`} onClick={() => setItems(items.filter((x) => x.id !== it.id))}><Icon name="close" size={15} /></button>
                  </span>
                </li>
              </React.Fragment>
            ))}
            {lineAtEnd && <li className="drop-line" style={{ height: drag.h }} />}
          </ul>
          <div className="check-add plist-add">
            <span className="check-add-mark" aria-hidden="true"><Icon name="plus" size={16} /></span>
            <input value={text} placeholder="Add an item" aria-label={`Add to ${list.name}`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          </div>
        </>
      )}
    </div>
  );
}

// Item text edits in place and saves when you leave the field.
function ItemText({ value, onChange }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input className="plist-text no-drag" value={v} aria-label="List item"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const t = v.trim(); if (t && t !== value) onChange(t); else setV(value); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }} />
  );
}
