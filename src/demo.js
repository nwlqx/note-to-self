// Sample data for trying the app without connecting GitHub.
import { addDays, todayKey, startOfWeek, nowIso } from './model.js';

export const DEMO_VERSION = 16;

export function demoData() {
  const t = todayKey();
  const w = startOfWeek(t);
  const ts = nowIso();
  const areas = [
    { id: 'a-work', name: 'Work', color: 'snow', order: 0, updatedAt: ts },
    { id: 'a-study', name: 'Study', color: 'peach', order: 1, updatedAt: ts },
    { id: 'a-travel', name: 'Travel', color: 'yellow', order: 2, updatedAt: ts },
    { id: 'a-fit', name: 'Fitness', color: 'pistachio', order: 3, updatedAt: ts },
    { id: 'a-home', name: 'Personal', color: 'rose', order: 4, updatedAt: ts },
  ];
  const sec = (pid, names) => names.map((n, i) => ({ id: `${pid}-s${i}`, name: n, ...(i === names.length - 1 ? { done: true } : {}) }));
  const projects = [
    { id: 'p-mtd', area: 'a-study', name: 'MTD359 Visual Effects', icon: 'camera', color: 'lilac', budget: 300, sections: sec('p-mtd', ['To do', 'In progress', 'Submitted']), startDate: addDays(w, -91), endDate: addDays(w, 46), order: 0, updatedAt: ts },
    { id: 'p-korea', area: 'a-travel', name: 'Korea winter school', icon: 'plane', color: 'peach', budget: 3500, sections: sec('p-korea', ['Before I go', 'Booking', 'Sorted']), order: 1, updatedAt: ts },
    { id: 'p-edm', area: 'a-work', name: 'Edupass launch comms', icon: 'briefcase', color: 'lavender', sections: sec('p-edm', ['To do', 'Doing', 'Waiting on others', 'Done']), startDate: addDays(w, -28), endDate: addDays(w, 25), order: 2, updatedAt: ts },
    { id: 'p-folio', area: 'a-home', name: 'Portfolio refresh', icon: 'palette', color: 'aqua', sections: sec('p-folio', ['Ideas', 'Doing', 'Done']), order: 3, updatedAt: ts },
    { id: 'p-run', area: 'a-fit', name: '10k by March', icon: 'dumbbell', color: 'sand', sections: sec('p-run', ['This block', 'Next block', 'Done']), startDate: addDays(w, -14), endDate: addDays(w, 145), order: 4, updatedAt: ts },
  ];
  let n = 0;
  const card = (projectId, s, f) => {
    n += 1;
    const p = projects.find((x) => x.id === projectId);
    const section = p.sections[s];
    return {
      id: 'demo-' + n, kind: 'task', title: '', notes: '', date: '', endDate: '', time: '', checklist: [],
      projectId, area: p.area, section: section.id, order: n * 1000, done: !!section.done,
      createdAt: ts, updatedAt: ts, ...f,
    };
  };
  const cl = (...items) => items.map(([text, done], i) => ({ id: 'cl' + n + '-' + i, text, done: !!done }));
  const items = [
    card('p-mtd', 0, { title: 'Collect reference clips for compositing', checklist: cl(['Rain on glass', true], ['Smoke plates'], ['Light leaks']) }),
    card('p-mtd', 0, { title: 'Read chapter 4 on keying', quadrant: 'schedule', qOrder: 2000 }),
    card('p-mtd', 0, { title: 'TMA02 proposal', kind: 'deadline', date: addDays(w, 25), quadrant: 'schedule', qOrder: 1500 }),
    card('p-mtd', 1, { title: 'TMA01 storyboard', kind: 'deadline', quadrant: 'do', qOrder: 1000, date: addDays(w, 4), notes: 'Brief on Canvas: https://canvas.suss.edu.sg/courses/mtd359/assignments/tma01', checklist: cl(['Thumbnails', true], ['Shot list', true], ['Clean frames'], ['Export PDF']) }),
    card('p-mtd', 2, { title: 'Week 3 lecture notes', notes: 'Photos of handwritten notes go here.' }),
    card('p-korea', 0, { title: 'Buy a warm coat' }),
    card('p-korea', 0, { title: 'Get a T-money card' }),
    card('p-korea', 1, { title: 'Book airport transfer', date: addDays(w, 9), quadrant: 'schedule', qOrder: 1000 }),
    card('p-korea', 1, { title: 'Seoul, Yonsei winter school', kind: 'event', date: addDays(w, 54), endDate: addDays(w, 90) }),
    card('p-korea', 2, { title: 'Flights booked' }),
    card('p-edm', 0, { title: 'Review EDM copy', date: addDays(w, 2), quadrant: 'do', qOrder: 2000, notes: 'Ticket: https://example.atlassian.net/browse/EDU-412' }),
    card('p-edm', 1, { title: 'Launch readiness review', kind: 'event', date: addDays(w, 3), time: '14:00' }),
    card('p-edm', 2, { title: 'Chase legal sign-off on login copy', kind: 'deadline', date: addDays(w, 6), quadrant: 'delegate', qOrder: 1000 }),
    card('p-edm', 3, { title: 'Draft FAQ page' }),
    card('p-edm', 0, { title: 'Send EDM proof for sign-off', kind: 'deadline', date: t, quadrant: 'do', qOrder: 500 }),
    card('p-folio', 0, { title: 'Write up Edupass case study', quadrant: 'schedule', qOrder: 3000 }),
    card('p-folio', 0, { title: 'New hero for nwlqx.com', quadrant: 'drop', qOrder: 1000 }),
    card('p-run', 0, { title: 'Easy 5k run', date: addDays(w, 5) }),
    card('p-run', 2, { title: 'Upper body + mobility', date: addDays(w, 0) }),
    { id: 'demo-penang', kind: 'event', title: 'Weekend in Penang', area: 'a-travel', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: addDays(w, 5), endDate: addDays(w, 7), notes: '' },
    { id: 'demo-loose', kind: 'task', title: 'Renew library card', area: 'a-home', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: '', notes: '', quadrant: 'delegate', qOrder: 2000 },
    { id: 'demo-aircon', kind: 'task', title: 'Reply to landlord about the aircon', area: 'a-home', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: addDays(t, 1), notes: '', quadrant: 'do', qOrder: 3000 },
    { id: 'demo-photos', kind: 'task', title: 'Sort phone photos from Penang', area: 'a-home', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: '', notes: '', quadrant: 'drop', qOrder: 2000 },
    { id: 'demo-passport', kind: 'deadline', title: 'Renew passport before Seoul', area: 'a-travel', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: addDays(w, 18), notes: '', quadrant: 'schedule', qOrder: 2500 },
    { id: 'demo-tax', kind: 'deadline', title: 'File income tax', area: 'a-home', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: addDays(t, 2), notes: '', quadrant: 'do', qOrder: 1500 },
    { id: 'demo-books', kind: 'task', title: 'Return library books', area: 'a-home', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: addDays(t, -2), notes: '' },
    { id: 'demo-claim', kind: 'task', title: 'Submit Penang expense claim', area: 'a-travel', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: t, notes: '', quadrant: 'delegate', qOrder: 500 },
    { id: 'demo-gift', kind: 'task', title: 'Birthday gift for Mum', area: 'a-home', projectId: '', section: '', done: false, createdAt: ts, updatedAt: ts, date: addDays(w, 11), notes: '' },
  ];
  const at = (day, hh) => new Date(`${day}T${hh}:00`).toISOString();
  const events = [
    { id: 'work:standup:' + w, calendar: 'work', title: 'Team stand-up', allDay: false, start: at(addDays(w, 0), '09:30'), end: at(addDays(w, 0), '09:45') },
    { id: 'work:1on1:' + w, calendar: 'work', title: '1:1 with manager', allDay: false, start: at(addDays(w, 2), '11:00'), end: at(addDays(w, 2), '11:30') },
    { id: 'personal:dinner:' + w, calendar: 'personal', title: 'Dinner with friends', allDay: false, start: at(addDays(w, 4), '19:30'), end: at(addDays(w, 4), '21:30') },
    { id: 'personal:class:' + w, calendar: 'personal', title: 'MTD359 seminar', allDay: false, start: at(addDays(w, 3), '19:00'), end: at(addDays(w, 3), '21:00') },
    { id: 'work:review:' + t, calendar: 'work', title: 'Design crit: login screens', allDay: false, start: at(t, '11:00'), end: at(t, '12:00') },
    { id: 'personal:focus:' + t, calendar: 'personal', title: 'Focus block: TMA01 storyboard', allDay: false, start: at(t, '14:00'), end: at(t, '16:30') },
    { id: 'personal:gym:' + t, calendar: 'personal', title: 'Gym, upper body', allDay: false, start: at(t, '19:00'), end: at(t, '20:00') },
    { id: 'work:offsite:' + w, calendar: 'work', title: 'Team offsite', allDay: true, start: addDays(w, 23), end: addDays(w, 23) },
  ];
  // ---------- project lists ----------
  const li = (pre, arr) => arr.map(([text, done], i) => ({ id: `${pre}-${i}`, text, done: !!done }));
  const lists = [
    { id: 'l-pack', projectId: 'p-korea', name: 'Packing', order: 0, updatedAt: ts, items: li('pk', [
      ['Thermal innerwear', true], ['Winter coat', true], ['Gloves and beanie'], ['Hand warmers'], ['Moisturiser and lip balm'],
      ['Travel adaptor (type C/F)', true], ['Laptop and charger'], ['Sketchbook'], ['Comfortable walking shoes'], ['Dressier pair of shoes'],
    ]) },
    { id: 'l-docs', projectId: 'p-korea', name: 'Documents', order: 1, updatedAt: ts, items: li('dc', [
      ['Passport (renewed)'], ['Yonsei acceptance letter', true], ['Travel insurance certificate', true], ['K-ETA approval'], ['Accommodation booking'],
    ]) },
    { id: 'l-sw', projectId: 'p-mtd', name: 'Software to set up', order: 0, updatedAt: ts, items: li('sw', [
      ['After Effects', true], ['Blender', true], ['DaVinci Resolve'], ['Mocha plug-in'],
    ]) },
    { id: 'l-launch', projectId: 'p-edm', name: 'Launch day checks', order: 0, updatedAt: ts, items: li('ld', [
      ['EDM sent to all schools'], ['FAQ page live'], ['Helpdesk briefed'], ['Login page banner removed'],
    ]) },
  ];

  // ---------- money ----------
  const cats = [
    ['cat-food', 'Food', 'peach', 600], ['cat-transport', 'Transport', 'aqua', 150], ['cat-shopping', 'Shopping', 'lilac', 250],
    ['cat-bills', 'Bills', 'sand', 220], ['cat-fun', 'Fun', 'rose', 150], ['cat-travel', 'Travel', 'lavender', 0],
    ['cat-study', 'Study', 'snow', 100], ['cat-health', 'Health', 'pistachio', 0],
  ].map(([id, name, color, budget], i) => ({ id, name, color, budget, order: i, updatedAt: ts }));
  let xn = 0;
  const x = (daysAgo, amount, category, note, more = {}) => ({
    id: 'demo-x' + ++xn, date: addDays(t, -daysAgo), amount, currency: 'SGD', rate: 1, category, note, projectId: '', updatedAt: ts, ...more,
  });
  const food = [
    [0, 6.5, 'Kopi and kaya toast'], [1, 14.8, 'Lunch with team'], [2, 9.2, 'Chicken rice'], [3, 32.4, 'Groceries'], [4, 18, 'Ramen'],
    [5, 7.4, 'Bubble tea'], [6, 46.2, 'Dinner with friends'], [8, 11, 'Lunch'], [9, 28.6, 'Groceries'], [11, 12.5, 'Lunch'],
    [13, 22, 'Brunch'], [15, 8.8, 'Lunch'], [18, 36, 'Groceries'], [21, 15.5, 'Lunch'], [24, 41, 'Birthday dinner'],
    [27, 9.6, 'Lunch'], [30, 31.2, 'Groceries'], [33, 13, 'Lunch'], [36, 54, 'Omakase share'], [39, 10.4, 'Lunch'],
  ];
  const expenses = [
    ...food.map(([d, a, n]) => x(d, a, 'cat-food', n)),
    x(0, 2.1, 'cat-transport', 'Bus'), x(1, 18.4, 'cat-transport', 'Grab home'), x(3, 2.6, 'cat-transport', 'MRT'), x(7, 30, 'cat-transport', 'EZ-Link top up'),
    x(20, 30, 'cat-transport', 'EZ-Link top up'), x(26, 22.9, 'cat-transport', 'Grab to airport'),
    x(2, 59, 'cat-shopping', 'Sketchbook and pens', { projectId: 'p-mtd' }), x(10, 89, 'cat-shopping', 'Running shoes'), x(31, 45, 'cat-shopping', 'Uniqlo'),
    x(4, 24, 'cat-fun', 'Cinema'), x(12, 38, 'cat-fun', 'Pottery class'), x(29, 70, 'cat-fun', 'Concert ticket'),
    x(6, 120, 'cat-bills', 'Gym membership', { billId: 'demo-b-gym' }), x(9, 11.98, 'cat-bills', 'Spotify', { billId: 'demo-b-spotify' }),
    x(17, 20, 'cat-bills', 'Phone plan', { billId: 'demo-b-phone' }), x(36, 120, 'cat-bills', 'Gym membership', { billId: 'demo-b-gym' }),
    x(5, 35, 'cat-study', 'Adobe Creative Cloud', { projectId: 'p-mtd' }), x(16, 42, 'cat-study', 'Reference book', { projectId: 'p-mtd' }),
    x(14, 780, 'cat-travel', 'Flights to Seoul', { projectId: 'p-korea' }),
    x(14, 1200000, 'cat-travel', 'Yonsei programme fee', { projectId: 'p-korea', currency: 'KRW', rate: 0.00095 }),
    x(8, 68, 'cat-travel', 'Travel insurance', { projectId: 'p-korea' }),
    x(3, 129, 'cat-shopping', 'Winter coat', { projectId: 'p-korea' }),
    x(1, 50000, 'cat-travel', 'T-money card and top up', { projectId: 'p-korea', currency: 'KRW', rate: 0.00095 }),
    x(22, 45, 'cat-health', 'Physio'),
  ];
  const bill = (id, name, amount, nextIn, more = {}) => ({ id, name, amount, currency: 'SGD', category: 'cat-bills', every: 'month', next: addDays(t, nextIn), projectId: '', updatedAt: ts, ...more });
  const bills = [
    bill('demo-b-gym', 'Gym membership', 120, 0),
    bill('demo-b-spotify', 'Spotify', 11.98, 3),
    bill('demo-b-phone', 'Phone plan', 20, 8),
    bill('demo-b-icloud', 'iCloud+', 4.48, 15),
    bill('demo-b-domain', 'nwlqx.com domain', 22, 41, { every: 'year' }),
  ];
  let wn = 0;
  const wb = (quadrant, name, price, more = {}) => ({
    id: 'demo-w' + ++wn, name, price, currency: 'SGD', quadrant, category: 'cat-shopping', projectId: '', link: '', note: '',
    bought: false, order: wn * 1000, addedOn: addDays(t, -(more.ago || 0)), updatedAt: ts, ...more,
  });
  const buys = [
    wb('do', 'Thermal gloves', 25, { projectId: 'p-korea', ago: 2 }),
    wb('do', 'Universal adapter', 18, { projectId: 'p-korea', category: 'cat-travel', ago: 4 }),
    wb('do', 'Dish soap', 4.5, { category: 'cat-food', ago: 1 }),
    wb('do', 'Wool scarf yarn', 32, { projectId: 'p-korea', bought: true, boughtOn: t, ago: 6 }),
    wb('schedule', 'Wacom tablet', 389, { projectId: 'p-mtd', category: 'cat-study', ago: 12 }),
    wb('schedule', 'New running shoes', 189, { ago: 20 }),
    wb('delegate', 'Mechanical keyboard', 159, { ago: 3 }),
    wb('delegate', 'Matcha set', 48, { ago: 9 }),
    wb('drop', 'Film camera', 420, { ago: 40 }),
    wb('drop', 'Ceramic vase', 65, { ago: 15 }),
  ];
  const moneyData = {
    categories: cats, expenses, bills, buys,
    rates: { KRW: { rate: 0.00095, updatedAt: ts }, MYR: { rate: 0.29, updatedAt: ts }, JPY: { rate: 0.0088, updatedAt: ts }, USD: { rate: 1.29, updatedAt: ts } },
  };

  // ---------- meals ----------
  const ing = (pre, arr) => arr.map(([name, qty], i) => ({ id: `${pre}-${i}`, name, qty }));
  const recipes = [
    { id: 'r-oats', name: 'Overnight oats', cost: 2, notes: 'Make three jars on Sunday night.', ingredients: ing('ro', [['Rolled oats', '1 cup'], ['Greek yoghurt', '1 tub'], ['Milk', '1 carton'], ['Frozen berries', '1 bag'], ['Honey', '']]) },
    { id: 'r-kfr', name: 'Kimchi fried rice', cost: 3.5, notes: 'Day-old rice works best.', ingredients: ing('rk', [['Kimchi', '1 jar'], ['Eggs', '6'], ['Spring onion', '1 bunch'], ['Rice', ''], ['Gochujang', '']]) },
    { id: 'r-tomegg', name: 'Tomato egg stir-fry', cost: 3, notes: '', ingredients: ing('rt', [['Tomatoes', '4'], ['Eggs', '6'], ['Spring onion', '1 bunch'], ['Rice', '']]) },
    { id: 'r-soba', name: 'Salmon soba', cost: 7, notes: 'Cold soba with tsuyu, or warm with dashi.', ingredients: ing('rs', [['Salmon fillet', '2'], ['Soba noodles', '1 pack'], ['Tsuyu', '1 bottle'], ['Cucumber', '1']]) },
    { id: 'r-bowl', name: 'Chicken rice bowl', cost: 4.5, notes: '', ingredients: ing('rb', [['Chicken thigh', '500g'], ['Rice', ''], ['Cucumber', '1'], ['Chilli sauce', '']]) },
    { id: 'r-hawker', name: 'Hawker lunch', cost: 5, notes: 'Bought out, no cooking.', ingredients: [] },
  ].map((r) => ({ ...r, updatedAt: ts }));
  const plan = [];
  const pm = (d, slot, fields) => plan.push({ id: `${addDays(w, d)}:${slot}`, date: addDays(w, d), slot, recipeId: '', text: '', cost: '', updatedAt: ts, ...fields });
  for (const d of [0, 1, 2, 3, 4]) pm(d, 'breakfast', { recipeId: 'r-oats' });
  for (const d of [0, 1, 2, 3, 4]) pm(d, 'lunch', { recipeId: 'r-hawker' });
  pm(0, 'dinner', { recipeId: 'r-kfr' }); pm(1, 'dinner', { recipeId: 'r-tomegg' }); pm(2, 'dinner', { recipeId: 'r-soba' });
  pm(3, 'dinner', { text: 'MTD359 seminar, eat at SUSS', cost: 6 }); pm(4, 'dinner', { text: 'Dinner with friends', cost: 35 });
  pm(5, 'lunch', { recipeId: 'r-bowl' }); pm(6, 'breakfast', { text: 'Brunch at Tiong Bahru', cost: 22 });
  pm(1, 'others', { text: 'Bubble tea', cost: 6.2 }); pm(4, 'others', { text: 'Cheesecake slice', cost: 8.5 }); pm(5, 'others', { text: 'Fruit and nuts', cost: 4 });
  const groceries = [
    ['Rolled oats', '1 cup', 'Overnight oats', true], ['Greek yoghurt', '1 tub', 'Overnight oats'], ['Kimchi', '1 jar', 'Kimchi fried rice'],
    ['Eggs', '6', 'Kimchi fried rice'], ['Salmon fillet', '2', 'Salmon soba'], ['Soba noodles', '1 pack', 'Salmon soba'], ['Dish soap', '', ''],
  ].map(([name, qty, recipe, done], i) => ({ id: 'demo-g' + i, name, qty, recipe, done: !!done, order: i, updatedAt: ts }));

  return {
    demoVersion: DEMO_VERSION,
    meals: { recipes, plan, groceries },
    money: moneyData,
    settings: { name: 'Natasha', areas, projects, lists, calendarAreas: { work: 'a-work', personal: 'a-home' } },
    items: { items },
    calendar: {
      syncedAt: ts,
      calendars: [
        { id: 'work', name: 'Work', ok: true, count: 3 },
        { id: 'personal', name: 'Personal', ok: true, count: 2 },
      ],
      events,
    },
  };
}
