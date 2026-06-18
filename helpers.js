// ============================================================
// helpers.js — Fonctions de calcul pur et utilitaires
// Dates, macros, état d'un jour, recherche, échappement HTML.
// Dépend de state.js (S). Doit être chargé avant les fichiers
// render-*.js et handlers-*.js qui les utilisent.
// ============================================================

// ── Date Helpers ─────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fmtDate(ds) {
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' });
}
function fmtDateShort(ds) {
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ── Data Helpers ─────────────────────────────────────────────

function getDay(date) {
  if (!S.days[date]) {
    S.days[date] = { type: 'sport', meals: { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[], 7:[], 8:[], 9:[], 10:[] }, creatine: null, burned: null, estimated: null };
    save();
  }
  // Ensure all 6 meals exist (migration safety)
  for (let m = 1; m <= 10; m++) {
    if (!S.days[date].meals[m]) S.days[date].meals[m] = [];
  }
  return S.days[date];
}

function allEntries(day) {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].flatMap(m => day.meals[m] || []);
}

// Returns real macros if food logged, else estimation if set, else zeros
function getEffectiveTotals(day) {
  const entries = allEntries(day);
  if (entries.length > 0) return calcMacros(entries);
  if (day.estimated) return { ...day.estimated };
  return { kcal: 0, p: 0, g: 0, l: 0 };
}

// A day is "empty" (excluded from averages) if no food AND no estimation AND no burned data
function isDayEmpty(day) {
  return allEntries(day).length === 0 && !day.estimated && !day.burned;
}

function calcMacros(entries) {
  const t = { kcal: 0, p: 0, g: 0, l: 0 };
  for (const e of entries) {
    const f = S.foods.find(x => x.id === e.foodId);
    if (!f) continue;
    const r = e.grams / 100;
    t.kcal += f.kcal * r;
    t.p    += f.p    * r;
    t.g    += f.g    * r;
    t.l    += f.l    * r;
  }
  return {
    kcal: Math.round(t.kcal),
    p: +t.p.toFixed(1),
    g: +t.g.toFixed(1),
    l: +t.l.toFixed(1)
  };
}

function getRecentFoodIds(limit = 6) {
  // Walk all days from newest to oldest, collect foodIds in order of last use
  const seen = new Set();
  const result = [];
  const dates = Object.keys(S.days).sort((a, b) => b.localeCompare(a));
  for (const d of dates) {
    const day = S.days[d];
    for (let m = 6; m >= 1; m--) {
      for (const e of [...(day.meals[m] || [])].reverse()) {
        if (!seen.has(e.foodId)) {
          seen.add(e.foodId);
          result.push(e.foodId);
          if (result.length >= limit) return result;
        }
      }
    }
  }
  return result;
}

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// Macro density badges: % of total calories from each macro
function macroPct(kcal, grams, calPerG) {
  if (!kcal || kcal <= 0) return '';
  const pct = Math.min(99, Math.round((grams * calPerG / kcal) * 100));
  return `<span class="prot-density">${pct}%</span>`;
}
// Kept for compatibility
function protDensityBadge(kcal, p) { return macroPct(kcal, p, 4); }

// #9 — streak: consecutive days with at least 1 food entry
function getStreak() {
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const day = S.days[ds];
    if (!day || ![1,2,3,4,5,6,7,8,9,10].some(m => (day.meals[m]||[]).length > 0)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// #4/#7 — food usage helpers
function foodUseCount(foodId) {
  let n = 0;
  for (const day of Object.values(S.days))
    for (let m = 1; m <= 10; m++)
      for (const e of (day.meals[m]||[])) if (e.foodId === foodId) n++;
  return n;
}
function foodLastUsed(foodId) {
  let last = '';
  for (const [date, day] of Object.entries(S.days))
    for (let m = 1; m <= 10; m++)
      if ((day.meals[m]||[]).some(e => e.foodId === foodId) && date > last) last = date;
  return last;
}
function findFoodUsage(foodId) {
  const uses = [];
  for (const [date, day] of Object.entries(S.days))
    for (let m = 1; m <= 10; m++)
      if ((day.meals[m]||[]).some(e => e.foodId === foodId)) uses.push({ date, meal: m });
  return uses;
}

function clamp(v, min, max) {
  return Math.min(Math.max(v, min), max);
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}