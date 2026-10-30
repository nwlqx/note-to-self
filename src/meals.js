// Meals: a weekly plan (breakfast, lunch, dinner), a recipe box and a grocery list.
// Stored in meals.json in the data repository. Costs are estimates in SGD.
import { mergeById, uid, nowIso, addDays } from './model.js';

export const SLOTS = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'others', label: 'Others', extra: true }, // desserts, snacks, drinks: optional, not counted as a meal
];

export const emptyMeals = () => ({ recipes: [], plan: [], groceries: [] });

export function mergeMeals(local, remote) {
  const l = local || {};
  const r = remote || {};
  return {
    recipes: mergeById(l.recipes, r.recipes).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    plan: mergeById(l.plan, r.plan).sort((a, b) => a.id.localeCompare(b.id)),
    groceries: mergeById(l.groceries, r.groceries).sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.id.localeCompare(b.id)),
  };
}

export const mealId = (date, slot) => `${date}:${slot}`;
export const liveRecipes = (m) => (m?.recipes || []).filter((x) => !x.deleted);
export const liveGroceries = (m) => (m?.groceries || []).filter((x) => !x.deleted);
export const mealAt = (m, date, slot) => (m?.plan || []).find((x) => x.id === mealId(date, slot) && !x.deleted && (x.recipeId || x.text));

// Days of the week starting on `weekStart` (a Monday).
export const weekDays = (weekStart) => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

// What a planned meal is called and what it should cost.
export function mealInfo(meal, recipesById) {
  if (!meal) return null;
  const r = meal.recipeId ? recipesById[meal.recipeId] : null;
  const name = r ? r.name : meal.text || '';
  const cost = meal.cost != null && meal.cost !== '' ? Number(meal.cost) || 0 : r ? Number(r.cost) || 0 : 0;
  return { name, cost, recipe: r };
}

export const newRecipe = (fields = {}) => ({ id: 'r-' + uid(), name: '', cost: '', ingredients: [], notes: '', ...fields });
export const newGrocery = (name, fields = {}) => ({ id: 'g-' + uid(), name, qty: '', done: false, order: Date.now(), ...fields });
export const stampMeal = (x) => ({ ...x, updatedAt: nowIso() });
