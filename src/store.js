// Holds the app's data, keeps a copy on the device, and syncs with GitHub.
// Edits apply instantly on the device; saving happens shortly after in the
// background. If a save collides with a change from another device, the two
// are merged item by item (newest edit wins) and saved again.

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient, ConflictError, AuthError } from './github.js';
import {
  mergeItems, mergeSettings, same, nowIso, uid, migrate, todayKey, doneSection, firstOpenSection, sectionOf, orderBetween,
} from './model.js';
import { prepareUpload } from './files.js';
import { demoData, DEMO_VERSION } from './demo.js';
import { mergeMeals, emptyMeals, mealId, mealAt, liveRecipes, liveGroceries, newGrocery, stampMeal, weekDays, SLOTS } from './meals.js';
import { mergeMoney, emptyMoney, stamp, nextDue, newExpense, liveCategories, rateFor, BASE } from './money.js';

const CONN_KEY = 'hub.connection';
const CACHE_KEY = 'hub.cache';

const FILES = {
  items: { path: 'items.json', merge: mergeItems, empty: { items: [] } },
  settings: { path: 'settings.json', merge: mergeSettings, empty: { areas: [], projects: [], calendarAreas: {} } },
  money: { path: 'money.json', merge: mergeMoney, empty: emptyMoney() },
  meals: { path: 'meals.json', merge: mergeMeals, empty: emptyMeals() },
};

const load = (k, fallback) => {
  try {
    const v = localStorage.getItem(k);
    return v ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};
const save = (k, v) => {
  try {
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, JSON.stringify(v));
  } catch {
    /* storage unavailable: the app still works for this session */
  }
};

const emptyCache = () => ({
  items: FILES.items.empty,
  settings: FILES.settings.empty,
  money: FILES.money.empty,
  meals: FILES.meals.empty,
  calendar: { events: [], calendars: [], syncedAt: null },
  shas: {},
  dirty: {},
  pulledAt: null,
});

export function useHub() {
  // The hosted preview always opens straight into sample data.
  const [conn, setConn] = useState(() => {
    const c = load(CONN_KEY, null);
    if (!__PREVIEW__) return c;
    // A new preview version (or a first visit) opens blank; the toggle at the top fills it with sample data.
    const cached = load(CACHE_KEY, null);
    if (!c || !cached || cached.demoVersion !== DEMO_VERSION) return { demo: true, blank: true };
    return c;
  });
  const [data, setData] = useState(() => {
    const c = load(CACHE_KEY, null);
    // The hosted preview refreshes its sample data whenever the sample set changes.
    if (c && !(__PREVIEW__ && c.demoVersion !== DEMO_VERSION)) return { ...c, money: c.money || emptyMoney(), meals: c.meals || emptyMeals() };
    if (__PREVIEW__ && conn?.blank) return { ...emptyCache(), demoVersion: DEMO_VERSION };
    return conn?.demo ? { ...emptyCache(), ...demoData() } : emptyCache();
  });
  const [status, setStatus] = useState({ state: 'idle' });
  const dataRef = useRef(data);
  useEffect(() => {
    const m = migrate(data.items, data.settings);
    if (m) commit((d) => ({ ...d, ...m, dirty: { ...d.dirty, items: true, settings: true } }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const busy = useRef(false);
  const timer = useRef(null);

  useEffect(() => save(CACHE_KEY, data), [data]);

  // All changes go through here so the ref and React state never disagree,
  // even when a save finishes before the next render.
  const commit = (fn) => {
    const next = fn(dataRef.current);
    dataRef.current = next;
    setData(next);
  };

  const client = conn && !conn.demo ? createClient(conn) : null;

  const pull = useCallback(async () => {
    if (!client || busy.current) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setStatus({ state: 'offline' });
      return;
    }
    busy.current = true;
    setStatus({ state: 'syncing' });
    try {
      const names = Object.keys(FILES);
      const [calText, ...remotes] = await Promise.all([
        client.readRaw('calendar/events.json'),
        ...names.map((n) => client.read(FILES[n].path)),
      ]);
      commit((cur) => {
        const next = { ...cur, shas: { ...cur.shas }, dirty: { ...cur.dirty } };
        names.forEach((name, i) => {
          const remote = remotes[i];
          const f = FILES[name];
          const remoteData = remote?.data || f.empty;
          const merged = f.merge(cur[name] || f.empty, remoteData);
          next[name] = merged;
          next.shas[name] = remote?.sha || null;
          next.dirty[name] = !remote || !same(merged, remoteData);
        });
        if (calText) {
          try {
            next.calendar = JSON.parse(calText);
          } catch {
            /* keep previous calendar */
          }
        }
        next.pulledAt = nowIso();
        const m = migrate(next.items, next.settings);
        if (m) {
          next.items = m.items;
          next.settings = m.settings;
          next.dirty = { ...next.dirty, items: true, settings: true };
        }
        return next;
      });
      setStatus({ state: 'synced', at: new Date() });
    } catch (e) {
      setStatus({ state: e instanceof AuthError ? 'auth' : 'error', message: e.message });
    } finally {
      busy.current = false;
    }
  }, [conn]); // eslint-disable-line react-hooks/exhaustive-deps

  const push = useCallback(async () => {
    if (!client) return;
    const names = Object.keys(FILES).filter((n) => dataRef.current.dirty?.[n]);
    if (!names.length) return;
    if (busy.current) {
      timer.current = setTimeout(push, 1000);
      return;
    }
    if (navigator.onLine === false) {
      setStatus({ state: 'offline' });
      return;
    }
    busy.current = true;
    setStatus({ state: 'saving' });
    try {
      for (const name of names) {
        const f = FILES[name];
        let attempt = 0;
        for (;;) {
          const cur = dataRef.current;
          const snapshot = cur[name];
          try {
            const sha = await client.write(f.path, snapshot, cur.shas[name], `Update ${name}`);
            commit((d) => ({
              ...d,
              shas: { ...d.shas, [name]: sha },
              // Only clear the flag if nothing changed while we were saving.
              dirty: { ...d.dirty, [name]: d[name] !== snapshot },
            }));
            break;
          } catch (e) {
            if (!(e instanceof ConflictError) || attempt++ >= 3) throw e;
            const remote = await client.read(f.path);
            const merged = f.merge(dataRef.current[name], remote?.data || f.empty);
            commit((d) => ({ ...d, [name]: merged, shas: { ...d.shas, [name]: remote?.sha || null } }));
          }
        }
      }
      setStatus({ state: 'synced', at: new Date() });
    } catch (e) {
      setStatus({ state: e instanceof AuthError ? 'auth' : navigator.onLine === false ? 'offline' : 'error', message: e.message });
    } finally {
      busy.current = false;
      if (Object.keys(FILES).some((n) => dataRef.current.dirty?.[n])) {
        clearTimeout(timer.current);
        timer.current = setTimeout(push, 4000);
      }
    }
  }, [conn]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pull when opened, when shown again, when the window is clicked back into (a Mac app window
  // usually stays visible behind others, so showing it again isn't enough), and every minute
  // while it's on screen. Checks closer together than 10 seconds are skipped.
  useEffect(() => {
    if (!client) return;
    let last = 0;
    const check = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 10000) return;
      last = Date.now();
      pull().then(() => push());
    };
    last = Date.now();
    pull().then(() => push());
    const onOnline = () => pull().then(() => push());
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    window.addEventListener('pageshow', check);
    window.addEventListener('online', onOnline);
    const iv = setInterval(check, 60 * 1000);
    return () => {
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('online', onOnline);
      clearInterval(iv);
    };
  }, [conn]); // eslint-disable-line react-hooks/exhaustive-deps

  const schedulePush = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(push, 800);
  };

  const update = (name, fn) => {
    commit((cur) => ({ ...cur, [name]: fn(cur[name]), dirty: { ...cur.dirty, [name]: true } }));
    schedulePush();
  };

  // ---------- actions ----------
  const upsertItem = (fields) =>
    update('items', (f) => {
      const id = fields.id || uid();
      const existing = f.items.find((x) => x.id === id);
      const item = { ...(existing || { createdAt: nowIso() }), ...fields, id, updatedAt: nowIso() };
      return { items: existing ? f.items.map((x) => (x.id === id ? item : x)) : [...f.items, item] };
    });

  const toggleDone = (id) => {
    const card = dataRef.current.items.items.find((x) => x.id === id);
    const proj = projectOf(card);
    const target = proj && (card.done ? firstOpenSection(proj) : doneSection(proj));
    if (proj && target && target.id !== sectionOf(card, proj)) {
      moveCard(id, { projectId: proj.id, section: target.id, order: orderBetween(lastOrderIn(proj.id, target.id), null) });
      return;
    }
    update('items', (f) => ({
      items: f.items.map((x) =>
        x.id === id ? { ...x, done: !x.done, doneAt: x.done ? null : nowIso(), updatedAt: nowIso() } : x,
      ),
    }));
  };

  const deleteItem = (id) => {
    const card = dataRef.current.items.items.find((x) => x.id === id);
    for (const a of card?.attachments || []) removeFile(a);
    update('items', (f) => ({
      items: f.items.map((x) => (x.id === id ? { id, deleted: true, updatedAt: nowIso() } : x)),
    }));
  };

  // ---------- projects ----------
  const saveProject = (project) =>
    update('settings', (s) => {
      const list = s.projects || [];
      const p = { ...project, updatedAt: nowIso() };
      return { ...s, projects: list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p] };
    });

  // ---------- attachments ----------
  // Files upload straight away (they're too big to queue), then the card records them.
  const blobCache = useRef(new Map());
  const uploadAttachment = async (cardId, file) => {
    const prepared = await prepareUpload(file);
    const id = uid();
    const safe = prepared.name.replace(/[^\w.\-]+/g, '-').slice(-80);
    const path = `attachments/${cardId}/${id}-${safe}`;
    let att;
    if (!client) {
      att = { id, name: prepared.name, type: prepared.type, size: prepared.size, path, local: `data:${prepared.type};base64,${prepared.base64}` };
    } else {
      if (navigator.onLine === false) throw new Error('Connect to the internet to add files.');
      const sha = await client.writeBinary(path, prepared.base64, `Add ${prepared.name}`);
      att = { id, name: prepared.name, type: prepared.type, size: prepared.size, path, sha };
    }
    update('items', (f) => ({
      items: f.items.map((x) => (x.id === cardId ? { ...x, attachments: [...(x.attachments || []), att], updatedAt: nowIso() } : x)),
    }));
    return att;
  };

  const removeFile = (att) => {
    if (client && att.sha) client.remove(att.path, att.sha, `Remove ${att.name}`).catch(() => {});
  };

  const removeAttachment = (cardId, attId) => {
    const card = dataRef.current.items.items.find((x) => x.id === cardId);
    const att = card?.attachments?.find((a) => a.id === attId);
    if (att) removeFile(att);
    update('items', (f) => ({
      items: f.items.map((x) => (x.id === cardId ? { ...x, attachments: (x.attachments || []).filter((a) => a.id !== attId), updatedAt: nowIso() } : x)),
    }));
  };

  const attachmentUrl = async (att) => {
    if (att.local) return att.local;
    if (!client) return null;
    const hit = blobCache.current.get(att.path);
    if (hit) return hit;
    const url = URL.createObjectURL(await client.readBlob(att.path));
    blobCache.current.set(att.path, url);
    return url;
  };

  const projectOf = (card) => (dataRef.current.settings.projects || []).find((p) => p.id === card?.projectId && !p.deleted);
  const lastOrderIn = (projectId, section) => {
    const orders = dataRef.current.items.items
      .filter((x) => !x.deleted && x.projectId === projectId && x.section === section)
      .map((x) => x.order ?? 0);
    return orders.length ? Math.max(...orders) : null;
  };

  // Moving a card into the Done section marks it done, and out of it undoes that.
  const moveCard = (id, { projectId, section, order }) =>
    update('items', (f) => {
      const proj = (dataRef.current.settings.projects || []).find((p) => p.id === projectId);
      const sec = proj?.sections.find((x) => x.id === section);
      return {
        items: f.items.map((x) => {
          if (x.id !== id) return x;
          const done = sec ? !!sec.done : x.done;
          return { ...x, projectId, section, order, done, doneAt: done ? x.doneAt || nowIso() : null, updatedAt: nowIso() };
        }),
      };
    });

  const saveCard = (fields) => {
    const existing = dataRef.current.items.items.find((x) => x.id === fields.id);
    const out = { ...fields };
    const proj = projectOf(out);
    if (proj) {
      out.area = proj.area;
      const projectChanged = !existing || existing.projectId !== out.projectId;
      if (projectChanged || !proj.sections.some((x) => x.id === out.section)) {
        out.section = out.section && proj.sections.some((x) => x.id === out.section)
          ? out.section : (out.done ? doneSection(proj) : firstOpenSection(proj)).id;
      }
      if (projectChanged || existing?.section !== out.section) out.order = orderBetween(lastOrderIn(proj.id, out.section), null);
      const sec = proj.sections.find((x) => x.id === out.section);
      if (sec) out.done = !!sec.done;
    } else {
      out.projectId = '';
      out.section = '';
    }
    upsertItem(out);
    return out.id;
  };

  const saveAreas = (areas) =>
    update('settings', (s) => {
      const old = new Map((s.areas || []).map((a) => [a.id, a]));
      const ids = new Set(areas.map((a) => a.id));
      const next = areas.map((a, i) => {
        const prev = old.get(a.id);
        const changed = !prev || prev.name !== a.name || prev.color !== a.color || (prev.icon ?? null) !== (a.icon ?? null) || prev.order !== i || prev.archived !== a.archived;
        return changed ? { ...a, order: i, updatedAt: nowIso() } : prev;
      });
      for (const a of s.areas || []) {
        if (ids.has(a.id)) continue;
        next.push(a.deleted ? a : { id: a.id, deleted: true, updatedAt: nowIso() });
      }
      return { ...s, areas: next };
    });

  // ---------- meals ----------
  const upsertMeal = (key, rec) => (m) => {
    const list = m[key] || [];
    const r = stampMeal(rec);
    return { ...m, [key]: list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r] };
  };
  const saveRecipe = (r) => update('meals', upsertMeal('recipes', r));
  const deleteRecipe = (id) => update('meals', upsertMeal('recipes', { id, deleted: true }));
  // One meal per day and slot; clearing it leaves a tombstone so other devices drop it too.
  const setMeal = (date, slot, fields) => update('meals', upsertMeal('plan', { id: mealId(date, slot), date, slot, recipeId: '', text: '', cost: '', ...fields }));
  const clearMeal = (date, slot) => update('meals', upsertMeal('plan', { id: mealId(date, slot), deleted: true }));
  const saveGrocery = (g) => update('meals', upsertMeal('groceries', g));
  const deleteGrocery = (id) => update('meals', upsertMeal('groceries', { id, deleted: true }));
  const clearTickedGroceries = () =>
    update('meals', (m) => ({ ...m, groceries: (m.groceries || []).map((g) => (g.done && !g.deleted ? stampMeal({ id: g.id, deleted: true }) : g)) }));
  // Adds every ingredient from the week's planned recipes that isn't already on the list.
  const addWeekToGroceries = (weekStart) => {
    const m = dataRef.current.meals;
    const recipes = Object.fromEntries(liveRecipes(m).map((r) => [r.id, r]));
    const have = new Set(liveGroceries(m).filter((g) => !g.done).map((g) => g.name.trim().toLowerCase()));
    const add = [];
    for (const d of weekDays(weekStart)) {
      for (const s of SLOTS) {
        const meal = mealAt(m, d, s.id);
        const r = meal?.recipeId && recipes[meal.recipeId];
        for (const ing of r?.ingredients || []) {
          const key = (ing.name || '').trim().toLowerCase();
          if (!key || have.has(key)) continue;
          have.add(key);
          add.push(newGrocery(ing.name.trim(), { qty: ing.qty || '', recipe: r.name, order: Date.now() + add.length }));
        }
      }
    }
    if (add.length) update('meals', (mm) => add.reduce((acc, g) => upsertMeal('groceries', g)(acc), mm));
    return add.length;
  };
  const addRecipeToGroceries = (recipe) => {
    const have = new Set(liveGroceries(dataRef.current.meals).filter((g) => !g.done).map((g) => g.name.trim().toLowerCase()));
    const add = (recipe.ingredients || []).filter((i) => i.name?.trim() && !have.has(i.name.trim().toLowerCase()))
      .map((i, n) => newGrocery(i.name.trim(), { qty: i.qty || '', recipe: recipe.name, order: Date.now() + n }));
    if (add.length) update('meals', (mm) => add.reduce((acc, g) => upsertMeal('groceries', g)(acc), mm));
    return add.length;
  };

  // ---------- project lists ----------
  const saveList = (list) =>
    update('settings', (st) => {
      const all = st.lists || [];
      const l = { ...list, updatedAt: nowIso() };
      return { ...st, lists: all.some((x) => x.id === l.id) ? all.map((x) => (x.id === l.id ? l : x)) : [...all, l] };
    });
  const deleteList = (id) => saveList({ id, deleted: true });
  // A list item that needs a date or more detail becomes a card in the project's first section.
  const promoteListItem = (list, itemId) => {
    const it = (list.items || []).find((x) => x.id === itemId);
    const proj = (dataRef.current.settings.projects || []).find((p) => p.id === list.projectId);
    if (!it || !proj) return null;
    const id = saveCard({ id: 'c-' + uid(), title: it.text, kind: 'task', projectId: proj.id, done: false, checklist: [], notes: '' });
    saveList({ ...list, items: list.items.filter((x) => x.id !== itemId) });
    return id;
  };

  // ---------- money ----------
  const upsertIn = (key, rec) => (m) => {
    const list = m[key] || [];
    const r = stamp(rec);
    return { ...m, [key]: list.some((x) => x.id === r.id) ? list.map((x) => (x.id === r.id ? r : x)) : [...list, r] };
  };
  const saveExpense = (x) => {
    const rate = x.currency === BASE ? 1 : x.rate || rateFor(dataRef.current.money, x.currency) || 0;
    update('money', upsertIn('expenses', { ...x, amount: Number(x.amount) || 0, rate }));
  };
  const deleteExpense = (id) => update('money', upsertIn('expenses', { id, deleted: true }));
  const saveBill = (b) => update('money', upsertIn('bills', { ...b, amount: Number(b.amount) || 0 }));
  const deleteBill = (id) => update('money', upsertIn('bills', { id, deleted: true }));
  // Paying a bill logs it as an expense and moves the bill to its next due date.
  const payBill = (id) => {
    const m = dataRef.current.money;
    const b = (m.bills || []).find((x) => x.id === id);
    if (!b) return;
    const cur = b.currency || BASE;
    const x = newExpense({ date: todayKey(), amount: b.amount, currency: cur, rate: rateFor(m, cur) || 0, category: b.category, note: b.name, projectId: b.projectId || '', billId: b.id });
    update('money', (mm) => upsertIn('bills', { ...b, next: nextDue(b.next, b.every), lastPaid: todayKey() })(upsertIn('expenses', x)(mm)));
  };
  const skipBill = (id) => {
    const b = (dataRef.current.money.bills || []).find((x) => x.id === id);
    if (b) update('money', upsertIn('bills', { ...b, next: nextDue(b.next, b.every) }));
  };
  const saveCategories = (cats) =>
    update('money', (m) => {
      const old = new Map((m.categories || []).map((c) => [c.id, c]));
      const ids = new Set(cats.map((c) => c.id));
      const next = cats.map((c, i) => {
        const prev = old.get(c.id);
        const changed = !prev || prev.name !== c.name || prev.color !== c.color || (prev.icon ?? null) !== (c.icon ?? null) || prev.order !== i || (prev.budget || 0) !== (c.budget || 0);
        return changed ? stamp({ ...c, order: i }) : prev;
      });
      for (const c of [...(m.categories || []), ...liveCategories(m)]) {
        if (!ids.has(c.id) && !next.some((x) => x.id === c.id)) next.push(stamp({ id: c.id, deleted: true }));
      }
      return { ...m, categories: next };
    });
  // To buy: items move between four quadrants; ticking one marks it bought, logging turns it into spending.
  const saveBuy = (b) => update('money', upsertIn('buys', b));
  const deleteBuy = (id) => update('money', upsertIn('buys', { id, deleted: true }));
  const toggleBought = (id) => {
    const b = (dataRef.current.money.buys || []).find((x) => x.id === id);
    if (b) update('money', upsertIn('buys', { ...b, bought: !b.bought, boughtOn: b.bought ? '' : todayKey() }));
  };
  const logBuy = (id, patch = {}) => {
    const m = dataRef.current.money;
    const found = (m.buys || []).find((x) => x.id === id);
    if (!found) return;
    const b = { ...found, ...patch };
    const cur = b.currency || BASE;
    const x = newExpense({ date: todayKey(), amount: Number(b.price) || 0, currency: cur, rate: rateFor(m, cur) || 0, category: b.category || '', note: b.name, projectId: b.projectId || '', buyId: b.id });
    update('money', (mm) => upsertIn('buys', { ...b, bought: true, boughtOn: b.boughtOn || todayKey(), expenseId: x.id })(upsertIn('expenses', x)(mm)));
    return x.id;
  };
  const setRate = (cur, rate) =>
    update('money', (m) => ({ ...m, rates: { ...(m.rates || {}), [cur]: { rate: Number(rate) || 0, updatedAt: nowIso() } } }));

  const setName = (name) =>
    update('settings', (st) => ({ ...st, name, nameUpdatedAt: nowIso() }));

  // Calendars switched off on the Calendar page; kept in settings so every device matches.
  const setCalendarShown = (calId, shown) =>
    update('settings', (s) => {
      const hidden = new Set(s.hiddenCalendars || []);
      if (shown) hidden.delete(calId); else hidden.add(calId);
      return { ...s, hiddenCalendars: [...hidden], hiddenCalendarsUpdatedAt: nowIso() };
    });

  const setCalendarArea = (calId, areaId) =>
    update('settings', (s) => ({
      ...s,
      calendarAreas: { ...(s.calendarAreas || {}), [calId]: areaId },
      calendarAreasUpdatedAt: nowIso(),
    }));

  const connect = async (c) => {
    const test = createClient(c);
    // A wrong owner or repo name comes back as a missing file, not an error.
    if ((await test.readRaw('calendars.json')) === null) throw new Error('Repository not found');
    save(CACHE_KEY, null);
    commit(() => emptyCache());
    save(CONN_KEY, c);
    setConn(c);
  };

  const startDemo = () => {
    const c = { demo: true };
    const d = { ...emptyCache(), ...demoData() };
    save(CONN_KEY, c);
    commit(() => d);
    setConn(c);
  };

  const startBlank = () => {
    const c = { demo: true, blank: true };
    save(CONN_KEY, c);
    commit(() => ({ ...emptyCache(), demoVersion: DEMO_VERSION }));
    setConn(c);
  };

  const disconnect = () => {
    save(CONN_KEY, null);
    save(CACHE_KEY, null);
    commit(() => emptyCache());
    setConn(null);
    setStatus({ state: 'idle' });
  };

  const pending = Object.values(data.dirty || {}).some(Boolean);

  return {
    conn, data, status, pending,
    syncNow: () => pull().then(() => push()),
    upsertItem, saveCard, moveCard, toggleDone, deleteItem, saveAreas, setCalendarArea, setCalendarShown, saveProject, setName,
    uploadAttachment, removeAttachment, attachmentUrl,
    saveList, deleteList, promoteListItem,
    saveRecipe, deleteRecipe, setMeal, clearMeal, saveGrocery, deleteGrocery, clearTickedGroceries, addWeekToGroceries, addRecipeToGroceries,
    saveExpense, deleteExpense, saveBill, deleteBill, payBill, skipBill, saveCategories, setRate, saveBuy, deleteBuy, toggleBought, logBuy,
    connect, startDemo, startBlank, disconnect,
  };
}
