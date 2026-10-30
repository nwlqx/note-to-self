// Drag and drop for sortable lists that sit side by side (board sections,
// matrix quadrants). Works with a mouse, a pen, and touch.
//
// Drop zones carry data-drop="<zone id>"; draggable items carry
// data-drag-id="<item id>". On a phone, a short press-and-hold starts the
// drag so ordinary swipes still scroll the page.
import { useEffect, useRef, useState } from 'react';

export function useDragSort({ onDrop, scrollRef }) {
  const [drag, setDrag] = useState(null); // { id, title, x, y, dx, dy, w, h, zone, index }
  const dragRef = useRef(null);
  const press = useRef(null);
  const justDragged = useRef(false);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;

  const targetAt = (x, y, id) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-drop]');
    if (!el) return null;
    const items = [...el.querySelectorAll('[data-drag-id]')].filter((t) => t.dataset.dragId !== id);
    let index = items.length;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { index = i; break; }
    }
    return { zone: el.dataset.drop, index };
  };

  const start = (p, x, y) => {
    const r = p.el.getBoundingClientRect();
    const t = targetAt(x, y, p.id) || { zone: p.zone, index: 0 };
    const d = { id: p.id, title: p.title, mark: p.mark, x, y, dx: x - r.left, dy: y - r.top, w: r.width, h: r.height, ...t };
    dragRef.current = d;
    setDrag(d);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const onPointerDown = (e, { id, title, zone, mark }) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (e.target.closest('.mark, .no-drag')) return;
    const p = { id, title, zone, mark, el: e.currentTarget, x0: e.clientX, y0: e.clientY, type: e.pointerType };
    press.current = p;
    if (e.pointerType === 'touch') {
      p.timer = setTimeout(() => { if (press.current === p) start(p, p.lastX ?? p.x0, p.lastY ?? p.y0); }, 280);
    }
  };

  // Scroll the container and page when dragging near an edge.
  useEffect(() => {
    if (!drag) return;
    let raf;
    const tick = () => {
      const d = dragRef.current;
      if (!d) return;
      const b = scrollRef?.current;
      if (b) {
        const r = b.getBoundingClientRect();
        if (d.x < r.left + 48) b.scrollLeft -= 10;
        else if (d.x > r.right - 48) b.scrollLeft += 10;
      }
      if (d.y < 80) window.scrollBy(0, -10);
      else if (d.y > window.innerHeight - 90) window.scrollBy(0, 10);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [!!drag]); // eslint-disable-line

  // Mouse and pen use pointer events. Touch uses touch events, because the
  // browser cancels pointer events as soon as it thinks you're scrolling;
  // after a long press, touchmove is cancelled instead so the page holds still.
  useEffect(() => {
    const moveTo = (x, y) => {
      const p = press.current;
      if (!p) return;
      p.lastX = x; p.lastY = y;
      if (!dragRef.current) {
        const moved = Math.hypot(x - p.x0, y - p.y0);
        if (p.type === 'mouse' || p.type === 'pen') { if (moved > 6) start(p, x, y); }
        else if (moved > 10) { clearTimeout(p.timer); press.current = null; } // it's a scroll
        return;
      }
      const t = targetAt(x, y, p.id);
      const next = { ...dragRef.current, x, y, ...(t || {}) };
      dragRef.current = next;
      setDrag(next);
    };
    const finish = () => {
      const p = press.current;
      press.current = null;
      if (p) clearTimeout(p.timer);
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      justDragged.current = true;
      setTimeout(() => { justDragged.current = false; }, 400);
      setDrag(null);
      dropRef.current({ id: d.id, zone: d.zone, index: d.index });
    };
    const cancel = () => {
      if (press.current) clearTimeout(press.current.timer);
      press.current = null; dragRef.current = null; setDrag(null);
    };
    const pMove = (e) => { if (e.pointerType !== 'touch') moveTo(e.clientX, e.clientY); };
    const pUp = (e) => { if (e.pointerType !== 'touch') finish(); };
    const pCancel = (e) => { if (e.pointerType !== 'touch') cancel(); };
    const tMove = (e) => {
      if (!press.current || press.current.type !== 'touch') return;
      if (dragRef.current) e.preventDefault();
      const t = e.touches[0];
      if (t) moveTo(t.clientX, t.clientY);
    };
    const tEnd = () => { if (press.current?.type === 'touch') finish(); };
    const tCancel = () => { if (press.current?.type === 'touch') cancel(); };
    const key = (e) => { if (e.key === 'Escape' && dragRef.current) cancel(); };
    window.addEventListener('pointermove', pMove);
    window.addEventListener('pointerup', pUp);
    window.addEventListener('pointercancel', pCancel);
    window.addEventListener('touchmove', tMove, { passive: false });
    window.addEventListener('touchend', tEnd);
    window.addEventListener('touchcancel', tCancel);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointermove', pMove);
      window.removeEventListener('pointerup', pUp);
      window.removeEventListener('pointercancel', pCancel);
      window.removeEventListener('touchmove', tMove);
      window.removeEventListener('touchend', tEnd);
      window.removeEventListener('touchcancel', tCancel);
      window.removeEventListener('keydown', key);
    };
  }, []); // eslint-disable-line

  // Pairs each item with its position among the items that aren't being
  // dragged. The dragged item stays in the page (hidden) so touch events
  // keep reaching us.
  const rowsFor = (list, zone) => {
    let n = -1;
    const rows = list.map((c) => {
      const dragging = !!drag && c.id === drag.id;
      if (!dragging) n += 1;
      return { c, dragging, i: dragging ? -1 : n, lineBefore: !!drag && !dragging && drag.zone === zone && drag.index === n };
    });
    const lineAtEnd = !!drag && drag.zone === zone && drag.index >= n + 1;
    return { rows, lineAtEnd };
  };

  return { drag, onPointerDown, rowsFor, wasDrag: () => justDragged.current };
}

// Where a dropped item lands: an order value between its new neighbours.
export function dropOrder(list, id, index, key = 'order') {
  const others = list.filter((c) => c.id !== id);
  const before = others[index - 1]?.[key];
  const after = others[index]?.[key];
  if (before == null && after == null) return 1000;
  if (before == null) return after - 1000;
  if (after == null) return before + 1000;
  return (before + after) / 2;
}
