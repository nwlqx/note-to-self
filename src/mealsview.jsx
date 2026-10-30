// The Meals page: a week of breakfasts, lunches and dinners, a recipe box and a grocery list,
// with the week's planned cost shown against the Food budget.
import React, { useMemo, useState } from 'react';
import { todayKey, startOfWeek, addDays, parseKey, uid } from './model.js';
import { SLOTS, weekDays, mealAt, mealInfo, liveRecipes, liveGroceries, newRecipe, newGrocery } from './meals.js';
import { liveCategories, liveExpenses, sgdOf, money, monthOf } from './money.js';
import { Sheet, Icon, ConfirmButton, rangeLabel } from './ui.jsx';

const FOOD = 'cat-food';
const dow = (k) => parseKey(k).toLocaleDateString('en-SG', { weekday: 'short' });
const dnum = (k) => parseKey(k).getDate();

export function MealsPage({ hub, onSheet }) {
  const m = hub.data.meals;
  const today = todayKey();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(today));
  const [note, setNote] = useState('');
  const days = weekDays(weekStart);
  const recipes = liveRecipes(m).sort((a, b) => a.name.localeCompare(b.name));
  const recipesById = useMemo(() => Object.fromEntries(recipes.map((r) => [r.id, r])), [recipes]);
  const groceries = liveGroceries(m);
  const toBuy = groceries.filter((g) => !g.done);
  const bought = groceries.filter((g) => g.done);

  // Planned cost this week, and the Food budget from Money.
  let planned = 0;
  let plannedCount = 0;
  for (const d of days) for (const s of SLOTS) {
    const info = mealInfo(mealAt(m, d, s.id), recipesById);
    if (info) { planned += info.cost; plannedCount += 1; }
  }
  const foodCat = liveCategories(hub.data.money).find((c) => c.id === FOOD);
  const foodBudget = Number(foodCat?.budget) || 0;
  const foodSpent = liveExpenses(hub.data.money).filter((x) => x.category === FOOD && monthOf(x.date) === monthOf(today)).reduce((s, x) => s + sgdOf(x), 0);
  const foodLeft = foodBudget - foodSpent;

  const [newItem, setNewItem] = useState('');
  const addItem = () => {
    const t = newItem.trim();
    if (!t) return;
    hub.saveGrocery(newGrocery(t));
    setNewItem('');
  };
  const flash = (t) => { setNote(t); setTimeout(() => setNote(''), 2600); };

  return (
    <section className="view meals" aria-label="Meals">
      <header className="view-head">
        <h1>Meals</h1>
      </header>

      <div className="m-month">
        <h2 className="m-month-name">{weekStart === startOfWeek(today) ? 'This week' : rangeLabel(weekStart, addDays(weekStart, 6))}</h2>
        <div className="m-month-nav">
          {weekStart !== startOfWeek(today) && <button className="text-btn small" onClick={() => setWeekStart(startOfWeek(today))}>This week</button>}
          <button className="icon-btn" aria-label="Previous week" onClick={() => setWeekStart(addDays(weekStart, -7))}><Icon name="left" /></button>
          <button className="icon-btn" aria-label="Next week" onClick={() => setWeekStart(addDays(weekStart, 7))}><Icon name="right" /></button>
        </div>
      </div>

      <div className="ml-summary">
        <span><strong>{plannedCount}</strong> of 21 meals planned</span>
        <span><strong>{money(planned)}</strong> planned this week</span>
        {foodBudget > 0 ? (
          <span className={foodLeft < 0 ? 'm-over' : undefined}>
            Food budget: <strong>{money(Math.abs(foodLeft))}</strong> {foodLeft < 0 ? 'over' : 'left'} this month
          </span>
        ) : <span>No Food budget set in Money</span>}
      </div>

      <div className="ml-week" role="grid" aria-label="Meal plan">
        {days.map((d) => (
          <div key={d} className="ml-day" role="row" data-today={d === today || undefined}>
            <div className="ml-day-head" role="rowheader">
              <span className="ml-dow">{dow(d)}</span>
              <span className="ml-dnum">{dnum(d)}</span>
            </div>
            {SLOTS.map((s) => {
              const meal = mealAt(m, d, s.id);
              const info = mealInfo(meal, recipesById);
              return (
                <button key={s.id} role="gridcell" className="ml-slot" data-slot={s.id} data-empty={!info || undefined}
                  onClick={() => onSheet({ type: 'meal', date: d, slot: s.id })}
                  aria-label={`${s.label}, ${dow(d)} ${dnum(d)}: ${info ? info.name : 'nothing planned'}`}>
                  <span className="ml-slot-label">{s.label}</span>
                  {info ? (
                    <>
                      <span className="ml-meal">{info.name}</span>
                      {info.cost > 0 && <span className="ml-cost">{money(info.cost)}</span>}
                    </>
                  ) : <span className="ml-add"><Icon name="plus" size={14} />Add</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="ml-cols">
        <section className="m-section" aria-labelledby="ml-groc">
          <div className="m-section-head">
            <h2 className="m-h2" id="ml-groc">Groceries</h2>
            <span className="m-sub">{toBuy.length} to buy</span>
          </div>
          <div className="ml-groc-actions">
            <button className="secondary" onClick={() => { const n = hub.addWeekToGroceries(weekStart); flash(n ? `Added ${n} item${n === 1 ? '' : 's'} from this week's recipes` : 'Everything from this week is already on the list'); }}>
              <Icon name="plus" size={16} />Add from this week's meals
            </button>
            <button className="text-btn small" onClick={() => onSheet({ type: 'expense', defaults: { category: FOOD, note: 'Groceries' } })}>Log grocery run</button>
          </div>
          {note && <p className="ml-note" role="status">{note}</p>}
          <ul className="ml-groc">
            {toBuy.map((g) => <GroceryRow key={g.id} g={g} hub={hub} />)}
          </ul>
          <div className="check-add plist-add">
            <span className="check-add-mark" aria-hidden="true"><Icon name="plus" size={16} /></span>
            <input value={newItem} placeholder="Add an item" aria-label="Add a grocery item"
              onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} />
          </div>
          {bought.length > 0 && (
            <>
              <div className="ml-bought-head">
                <span className="m-sub">In the basket ({bought.length})</span>
                <button className="text-btn small" onClick={hub.clearTickedGroceries}>Clear</button>
              </div>
              <ul className="ml-groc">{bought.map((g) => <GroceryRow key={g.id} g={g} hub={hub} />)}</ul>
            </>
          )}
        </section>

        <section className="m-section" aria-labelledby="ml-rec">
          <div className="m-section-head">
            <h2 className="m-h2" id="ml-rec">Recipes</h2>
            <button className="text-btn small" onClick={() => onSheet({ type: 'recipe' })}><Icon name="plus" size={14} />New recipe</button>
          </div>
          {recipes.length ? (
            <ul className="ml-recipes">
              {recipes.map((r) => (
                <li key={r.id}>
                  <button className="ml-recipe" onClick={() => onSheet({ type: 'recipe', id: r.id })}>
                    <span className="ml-recipe-name">{r.name}</span>
                    <span className="m-row-meta">{(r.ingredients || []).length ? `${r.ingredients.length} ingredient${r.ingredients.length === 1 ? '' : 's'}` : 'No ingredients'}{Number(r.cost) ? `, about ${money(Number(r.cost))}` : ''}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="tile-empty">Save meals you make often, with their ingredients, so you can plan them in a tap.</p>}
        </section>
      </div>
    </section>
  );
}

function GroceryRow({ g, hub }) {
  return (
    <li data-done={g.done || undefined}>
      <button className="check" aria-pressed={!!g.done} aria-label={g.done ? `Put back ${g.name}` : `Got ${g.name}`}
        onClick={() => hub.saveGrocery({ ...g, done: !g.done })}>{g.done && <Icon name="check" size={14} />}</button>
      <span className="ml-groc-text">
        <span className="ml-groc-name">{g.name}{g.qty ? <span className="ml-qty"> {g.qty}</span> : null}</span>
        {g.recipe && <span className="m-row-meta">for {g.recipe}</span>}
      </span>
      <button className="icon-btn" aria-label={`Remove ${g.name}`} onClick={() => hub.deleteGrocery(g.id)}><Icon name="close" size={15} /></button>
    </li>
  );
}

// ---------- pick a meal for a day and slot ----------
export function MealSheet({ hub, date, slot, onSheet, onClose }) {
  const m = hub.data.meals;
  const current = mealAt(m, date, slot);
  const recipes = liveRecipes(m);
  const [text, setText] = useState(current?.recipeId ? '' : current?.text || '');
  const [recipeId, setRecipeId] = useState(current?.recipeId || '');
  const [cost, setCost] = useState(current?.cost != null && current?.cost !== '' ? String(current.cost) : '');
  const [query, setQuery] = useState('');
  const slotLabel = SLOTS.find((s) => s.id === slot)?.label;
  const shown = recipes.filter((r) => !query.trim() || r.name.toLowerCase().includes(query.trim().toLowerCase()));
  const picked = recipes.find((r) => r.id === recipeId);

  const save = (e) => {
    e?.preventDefault();
    if (!recipeId && !text.trim()) { if (current) hub.clearMeal(date, slot); onClose(); return; }
    hub.setMeal(date, slot, { recipeId, text: recipeId ? '' : text.trim(), cost: cost === '' ? '' : Number(cost) || 0 });
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label={`${slotLabel}, ${parseKey(date).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'short' })}`} onSubmit={save}>
      <p className="project-area">{parseKey(date).toLocaleDateString('en-SG', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h2 className="sheet-heading">{slotLabel}</h2>
      <input data-autofocus className="title-input" value={picked ? picked.name : text} placeholder="What are you having?" aria-label="Meal"
        onChange={(e) => { setRecipeId(''); setText(e.target.value); }} />
      {recipes.length > 0 && (
        <fieldset>
          <legend>Or pick a recipe</legend>
          {recipes.length > 6 && <input value={query} placeholder="Search recipes" aria-label="Search recipes" onChange={(e) => setQuery(e.target.value)} />}
          <div className="filters ml-pick" role="radiogroup" aria-label="Recipes">
            {shown.map((r) => (
              <button type="button" key={r.id} role="radio" aria-checked={recipeId === r.id} className="chip"
                onClick={() => { setRecipeId(recipeId === r.id ? '' : r.id); setText(''); }}>
                {r.name}{Number(r.cost) ? <span className="chip-count">{money(Number(r.cost), 'SGD', { compact: Number(r.cost) >= 10 })}</span> : null}
              </button>
            ))}
          </div>
        </fieldset>
      )}
      <label className="money-input">
        <span className="money-prefix" aria-hidden="true">S$</span>
        <input type="text" inputMode="decimal" value={cost} aria-label="Estimated cost"
          placeholder={picked && Number(picked.cost) ? String(picked.cost) : 'Cost (optional)'}
          onChange={(e) => setCost(e.target.value.replace(/[^\d.]/g, ''))} />
      </label>
      <p className="hint">{picked ? 'Leave the cost empty to use the recipe\'s estimate.' : 'An estimate is enough; it adds up to this week\'s planned cost.'}</p>
      <div className="sheet-actions">
        <button className="primary" type="submit">Save</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
        <span className="push-right sheet-actions-end">
          {!recipes.length && <button className="text-btn" type="button" onClick={() => onSheet({ type: 'recipe' })}>New recipe</button>}
          {current && <button className="text-btn danger" type="button" onClick={() => { hub.clearMeal(date, slot); onClose(); }}>Clear</button>}
        </span>
      </div>
    </Sheet>
  );
}

// ---------- a recipe ----------
export function RecipeSheet({ hub, id, onClose }) {
  const stored = id ? liveRecipes(hub.data.meals).find((r) => r.id === id) : null;
  const [r, setR] = useState(() => {
    const base = stored || newRecipe();
    return { ...base, cost: base.cost === '' || base.cost == null ? '' : String(base.cost), ingredients: [...(base.ingredients || []), { id: 'i-' + uid(), name: '', qty: '' }] };
  });
  const [added, setAdded] = useState('');
  const set = (x) => setR((cur) => ({ ...cur, ...x }));
  const setIng = (i, x) => setR((cur) => {
    const ings = cur.ingredients.map((g, j) => (i === j ? { ...g, ...x } : g));
    if (i === ings.length - 1 && (x.name || x.qty)) ings.push({ id: 'i-' + uid(), name: '', qty: '' }); // always one empty row to type into
    return { ...cur, ingredients: ings };
  });
  const clean = () => ({ ...r, name: r.name.trim(), cost: r.cost === '' ? '' : Number(r.cost) || 0, ingredients: r.ingredients.filter((g) => g.name.trim()).map((g) => ({ ...g, name: g.name.trim(), qty: (g.qty || '').trim() })) });
  const save = (e) => {
    e.preventDefault();
    if (!r.name.trim()) return;
    hub.saveRecipe(clean());
    onClose();
  };

  return (
    <Sheet as="form" onClose={onClose} label={stored ? 'Recipe' : 'New recipe'} onSubmit={save}>
      <h2 className="sheet-heading">{stored ? 'Recipe' : 'New recipe'}</h2>
      <input data-autofocus className="title-input" value={r.name} placeholder="Name, e.g. Kimchi fried rice" aria-label="Recipe name" onChange={(e) => set({ name: e.target.value })} required />
      <label className="money-input">
        <span className="money-prefix" aria-hidden="true">S$</span>
        <input type="text" inputMode="decimal" value={r.cost} placeholder="Cost per meal (optional)" aria-label="Estimated cost per meal"
          onChange={(e) => set({ cost: e.target.value.replace(/[^\d.]/g, '') })} />
      </label>
      <fieldset>
        <legend>Ingredients</legend>
        <ul className="ml-ings">
          {r.ingredients.map((g, i) => (
            <li key={g.id}>
              <input value={g.name} placeholder={i === r.ingredients.length - 1 ? 'Add an ingredient' : 'Ingredient'} aria-label="Ingredient" onChange={(e) => setIng(i, { name: e.target.value })} />
              <input value={g.qty} placeholder="Amount" aria-label={`Amount of ${g.name || 'ingredient'}`} onChange={(e) => setIng(i, { qty: e.target.value })} />
              {i < r.ingredients.length - 1 ? (
                <button type="button" className="icon-btn" aria-label={`Remove ${g.name}`} onClick={() => setR((cur) => ({ ...cur, ingredients: cur.ingredients.filter((_, j) => j !== i) }))}><Icon name="close" size={15} /></button>
              ) : <span />}
            </li>
          ))}
        </ul>
      </fieldset>
      <label>Notes<textarea rows={3} value={r.notes || ''} placeholder="Steps, a link, or where you buy it" onChange={(e) => set({ notes: e.target.value })} /></label>
      {stored && (
        <div className="m-bill-actions">
          <button type="button" className="secondary" onClick={() => { const n = hub.addRecipeToGroceries(clean()); setAdded(n ? `Added ${n} to groceries` : 'Already on the list'); }}>
            <Icon name="plus" size={16} />Add ingredients to groceries
          </button>
          {added && <span className="hint" role="status">{added}</span>}
        </div>
      )}
      <div className="sheet-actions">
        <button className="primary" type="submit">{stored ? 'Save' : 'Save recipe'}</button>
        <button className="text-btn" type="button" onClick={onClose}>Cancel</button>
        {stored && (
          <span className="push-right">
            <ConfirmButton confirmText="Tap again to delete" onConfirm={() => { hub.deleteRecipe(stored.id); onClose(); }}>Delete</ConfirmButton>
          </span>
        )}
      </div>
    </Sheet>
  );
}
