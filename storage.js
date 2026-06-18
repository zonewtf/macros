// ============================================================
// storage.js — Lecture/écriture localStorage + synchronisation
// foods.csv. Dépend de state.js (S, DEFAULT_GOALS) et de
// helpers.js (uid) — mais l'ordre de chargement n'a pas
// d'importance puisque rien ne s'exécute avant init().
// ============================================================

// ── Storage ──────────────────────────────────────────────────

function load() {
  S.days  = JSON.parse(localStorage.getItem('macros_days')  || '{}');
  S.foods = JSON.parse(localStorage.getItem('macros_foods') || '[]');
  S.meals = JSON.parse(localStorage.getItem('macros_meals') || '[]');
  S.goals = JSON.parse(localStorage.getItem('macros_goals') || JSON.stringify(DEFAULT_GOALS));
  if (!S.goals.sport) S.goals.sport = { ...DEFAULT_GOALS.sport };
  if (!S.goals.rest)  S.goals.rest  = { ...DEFAULT_GOALS.rest  };
}

function save() {
  localStorage.setItem('macros_days',  JSON.stringify(S.days));
  localStorage.setItem('macros_foods', JSON.stringify(S.foods));
  localStorage.setItem('macros_meals', JSON.stringify(S.meals));
  localStorage.setItem('macros_goals', JSON.stringify(S.goals));
}

// ── Synchronisation foods.csv ────────────────────────────────

async function loadCSVFoods(forceSync = false) {
  try {
    const res = await fetch('./foods.csv?v=' + Date.now()); // cache-bust
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.trim().split('\n').slice(1);

    // Build the set of names that SHOULD exist from the CSV
    const csvNames = new Set();
    const csvEntries = [];
    for (const line of lines) {
      const cols = line.split(',');
      if (cols.length < 6) continue;
      const [marque, nom, kcal, p, g, l, uw] = cols.map(c => c.trim());
      if (!nom || !kcal) continue;
      const fullName = marque ? `${marque} — ${nom}` : nom;
      csvNames.add(fullName);
      csvEntries.push({ fullName, kcal: +kcal||0, p: +p||0, g: +g||0, l: +l||0, unitWeight: uw ? +uw : null });
    }

    // Remove CSV foods that are no longer in the CSV file
    const before = S.foods.length;
    S.foods = S.foods.filter(f => {
      if (!f._fromCSV) return true;       // keep manually added
      if (f._virtual)  return true;        // keep virtual entries
      return csvNames.has(f.name);         // keep only if still in CSV
    });
    const removed = before - S.foods.length;

    // Add or update foods from CSV
    let added = 0;
    for (const entry of csvEntries) {
      const existing = S.foods.find(f => f.name === entry.fullName);
      if (existing) {
        // Update values in case CSV was edited, and ensure flag is set
        existing.kcal       = entry.kcal;
        existing.p          = entry.p;
        existing.g          = entry.g;
        existing.l          = entry.l;
        existing.unitWeight = entry.unitWeight;
        existing._fromCSV   = true;
      } else {
        S.foods.push({ id: uid(), name: entry.fullName, kcal: entry.kcal, p: entry.p, g: entry.g, l: entry.l, unitWeight: entry.unitWeight, _fromCSV: true });
        added++;
      }
    }

    if (added > 0 || removed > 0) {
      save();
      if (removed > 0) console.log(`[Macros] CSV sync: ${removed} aliment(s) supprimé(s), ${added} ajouté(s)`);
    }
  } catch (err) {
    console.warn('[Macros] Impossible de charger foods.csv :', err);
  }
}