// ============================================================
// app.js — Mes Macros PWA
// Vanilla JS ES6+, zero dependencies, localStorage only
// ============================================================

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_GOALS = {
  sport: { kcal: 2500, p: 180, g: 250, l: 70 },
  rest:  { kcal: 1850, p: 160, g: 180, l: 60 }
};

// ── State ────────────────────────────────────────────────────

let S = {
  tab:              'today',
  viewDate:         '',
  histSub:          'list',
  editDate:         null,
  modal:            null,
  md:               {},
  searchQ:          '',
  foodsSearch:      '',
  foodsSubTab:      'foods',
  foodsSort:        'alpha',     // #4: 'alpha' | 'used' | 'recent'
  foodsSelect:      false,       // #6: multi-select mode
  foodsSelectedIds: [],          // #6
  collapsedMeals:   {},          // #2: key "date-meal" → true
  settingsEdit:     null,
  settingsTemp:     {},
  days:             {},
  foods:            [],
  meals:            [],
  goals:            {}
};

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
    S.days[date] = { type: 'sport', meals: { 1:[], 2:[], 3:[], 4:[], 5:[], 6:[] } };
    save();
  }
  // Ensure all 6 meals exist (migration safety)
  for (let m = 1; m <= 6; m++) {
    if (!S.days[date].meals[m]) S.days[date].meals[m] = [];
  }
  return S.days[date];
}

function allEntries(day) {
  return [1, 2, 3, 4, 5, 6].flatMap(m => day.meals[m] || []);
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

// #9 — streak: consecutive days with at least 1 food entry
function getStreak() {
  let streak = 0;
  const d = new Date();
  while (true) {
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const day = S.days[ds];
    if (!day || ![1,2,3,4,5,6].some(m => (day.meals[m]||[]).length > 0)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

// #4/#7 — food usage helpers
function foodUseCount(foodId) {
  let n = 0;
  for (const day of Object.values(S.days))
    for (let m = 1; m <= 6; m++)
      for (const e of (day.meals[m]||[])) if (e.foodId === foodId) n++;
  return n;
}
function foodLastUsed(foodId) {
  let last = '';
  for (const [date, day] of Object.entries(S.days))
    for (let m = 1; m <= 6; m++)
      if ((day.meals[m]||[]).some(e => e.foodId === foodId) && date > last) last = date;
  return last;
}
function findFoodUsage(foodId) {
  const uses = [];
  for (const [date, day] of Object.entries(S.days))
    for (let m = 1; m <= 6; m++)
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

// ── SVG Ring ─────────────────────────────────────────────────

function renderRing(consumed, goal) {
  const r = 54, cx = 80, cy = 80, size = 160;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? clamp(consumed / goal, 0, 1) : 0;
  const offset = circ * (1 - pct);
  const over = consumed > goal;
  const color = over ? '#e87070' : '#7eb8f7';
  return `
  <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
      stroke-linecap="round"
      stroke-dasharray="${circ.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"
      class="ring-fill"/>
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="ring-val">${consumed}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="ring-sub">/ ${goal} kcal</text>
  </svg>`;
}

function renderBar(label, consumed, goal, color) {
  const pct = goal > 0 ? clamp(consumed / goal * 100, 0, 100) : 0;
  const over = consumed > goal;
  const c = over ? '#e87070' : color;
  return `
  <div class="bar-row">
    <span class="bar-label">${label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${c}"></div></div>
    <span class="bar-num" style="color:${c}">${consumed}g</span>
  </div>`;
}

function renderPill(label, val, goal, color) {
  const rem = goal - val;
  const over = rem < 0;
  const display = over ? `+${Math.abs(Math.round(rem))}g` : `${Math.round(rem)}g`;
  return `<span class="pill ${over ? 'pill-over' : ''}" style="--c:${color}">${label} ${display}</span>`;
}

// ── Tab: Day View (Today & History edit) ─────────────────────

function renderDayView(date) {
  const isToday    = date === todayStr();
  const isTomorrow = date === tomorrowStr();
  const day        = getDay(date);
  const goals      = S.goals[day.type];
  const totals     = calcMacros(allEntries(day));

  const badge = day.type === 'sport'
    ? `<span class="badge-sport">Sport ⚡</span>`
    : `<span class="badge-rest">Repos 🌙</span>`;

  const header = isToday
    ? `<div class="day-header">
         <h2>${fmtDate(date)}</h2>
         <button class="btn-toggle" data-action="toggleType" data-date="${date}">${badge}</button>
       </div>
       ${(() => { const s = getStreak(); return s >= 1 ? `<div class="streak-row">${'🔥'.repeat(Math.min(s,7))} <span class="streak-count">${s} jour${s>1?'s':''} d'affilée</span></div>` : ''; })()}`
    : `<div class="day-header">
         <button class="btn-back" data-action="back">← Retour</button>
         <button class="btn-toggle" data-action="toggleType" data-date="${date}">${badge}</button>
       </div>
       <h2 class="day-title">${isTomorrow ? 'Demain — ' : ''}${fmtDate(date)}</h2>`;

  const overAlert = '';

  const summary = `
  <div class="summary-card">
    ${renderRing(totals.kcal, goals.kcal)}
    <div class="macros-detail">
      ${renderBar('Protéines', totals.p, goals.p, '#7eb8f7')}
      ${renderBar('Glucides',  totals.g, goals.g, '#f0c040')}
      ${renderBar('Lipides',   totals.l, goals.l, '#e87070')}
      <div class="pills-row">
        ${renderPill('P', totals.p, goals.p, '#7eb8f7')}
        ${renderPill('G', totals.g, goals.g, '#f0c040')}
        ${renderPill('L', totals.l, goals.l, '#e87070')}
      </div>
    </div>
  </div>`;

  let mealsHtml = '<div class="meals">';
  for (let m = 1; m <= 6; m++) {
    const entries  = day.meals[m] || [];
    const mTotals  = calcMacros(entries);
    const hasFood  = entries.length > 0;
    const colKey   = `${date}-${m}`;
    const collapsed = !!S.collapsedMeals[colKey];

    const entriesHtml = entries.map((e, i) => {
      const f = S.foods.find(x => x.id === e.foodId);
      if (!f) return '';
      const qty = f.unitWeight
        ? `${+(e.grams / f.unitWeight).toFixed(1)} u.`
        : `${e.grams}g`;
      const mc = calcMacros([e]);
      return `<div class="meal-entry" data-action="editEntry" data-meal="${m}" data-idx="${i}" data-date="${date}">
        <div class="entry-left">
          <span class="entry-name">${escHtml(f.name)}</span>
          <div class="entry-macros-row">
            <span class="entry-macro-p">P ${mc.p}g</span>
            <span class="entry-macro-g">G ${mc.g}g</span>
            <span class="entry-macro-l">L ${mc.l}g</span>
          </div>
        </div>
        <div class="entry-right">
          <span class="entry-qty">${qty}</span>
          <span class="entry-kcal">${mc.kcal} kcal</span>
        </div>
      </div>`;
    }).join('');

    // #3 — P/G/L sub-line in meal header
    const mealMacroSub = hasFood
      ? `<div class="meal-macro-sub">
           <span style="color:#7eb8f7">P ${mTotals.p}g</span>
           <span style="color:#f0c040">G ${mTotals.g}g</span>
           <span style="color:#e87070">L ${mTotals.l}g</span>
         </div>`
      : '';

    mealsHtml += `
    <div class="meal-section">
      <div class="meal-header" data-action="toggleMeal" data-colkey="${colKey}">
        <span class="meal-chevron ${collapsed ? 'collapsed' : ''}">›</span>
        <div class="meal-header-left">
          <span class="meal-title">Repas ${m}${hasFood ? ` <span class="meal-kcal-inline">· ${mTotals.kcal} kcal</span>` : ''}</span>
          ${mealMacroSub}
        </div>
        <button class="btn-meal-icon" data-action="openQuickAdd" data-meal="${m}" data-date="${date}" title="Ajout rapide">⚡</button>
        ${hasFood ? `<button class="btn-meal-icon" data-action="openCopyMeal" data-meal="${m}" data-date="${date}" title="Copier ce repas">📋</button>` : ''}
        <button class="btn-meal-icon" data-action="openAddFood" data-meal="${m}" data-date="${date}">➕</button>
      </div>
      ${collapsed ? '' : entriesHtml}
    </div>`;
  }
  mealsHtml += '</div>';

  const tomorrowBtn = isToday
    ? `<button class="btn-tomorrow" data-action="viewTomorrow">Planifier demain →</button>`
    : '';

  // #8 — AI prompt button (shown in history edit view and today)
  const aiBtn = `<button class="btn-ai-prompt" data-action="copyAiPrompt" data-date="${date}">🤖 Générer un prompt IA</button>`;

  return `
  <div class="view-day">
    ${header}
    ${overAlert}
    ${summary}
    ${mealsHtml}
    ${tomorrowBtn}
    ${aiBtn}
  </div>`;
}

// ── Tab: History ──────────────────────────────────────────────

function renderHistory() {
  if (S.histSub === 'edit' && S.editDate) {
    return renderDayView(S.editDate);
  }

  const tom    = tomorrowStr();
  const tomDay = getDay(tom);
  const tomT   = calcMacros(allEntries(tomDay));
  const tomG   = S.goals[tomDay.type];
  const tomBadge = tomDay.type === 'sport'
    ? `<span class="badge-sport">Sport ⚡</span>`
    : `<span class="badge-rest">Repos 🌙</span>`;

  const tomorrowCard = `
  <div class="hist-card hist-tomorrow">
    <div class="hist-card-head">
      <span class="hist-date">Demain — ${fmtDateShort(tom)}</span>
      ${tomBadge}
      <button class="btn-edit-sm" data-action="editHistDay" data-date="${tom}">✎ Modifier</button>
    </div>
    <div class="hist-macros">
      <span class="hist-kcal">${tomT.kcal} kcal</span>
      <span class="pill-sm" style="color:#7eb8f7">P ${tomT.p}g</span>
      <span class="pill-sm" style="color:#f0c040">G ${tomT.g}g</span>
      <span class="pill-sm" style="color:#e87070">L ${tomT.l}g</span>
    </div>
  </div>`;

  const pastDates = Object.keys(S.days)
    .filter(d => d < todayStr())
    .sort((a, b) => b.localeCompare(a));

  const pastHtml = pastDates.map(d => {
    const day    = S.days[d];
    const totals = calcMacros(allEntries(day));
    const goals  = S.goals[day.type];
    const pct    = goals.kcal > 0 ? clamp(totals.kcal / goals.kcal * 100, 0, 100) : 0;
    const badge  = day.type === 'sport'
      ? `<span class="badge-sport">Sport ⚡</span>`
      : `<span class="badge-rest">Repos 🌙</span>`;

    // delta vs goals
    const dKcal = totals.kcal - goals.kcal;
    const dP    = +(totals.p - goals.p).toFixed(1);
    const dG    = +(totals.g - goals.g).toFixed(1);
    const dL    = +(totals.l - goals.l).toFixed(1);
    const fmtD  = (label, v, unit) => {
      const sign = v > 0 ? '+' : '';
      return `<span style="color:#666;font-size:11px">${label} ${sign}${v}${unit}</span>`;
    };
    const deltaRow = `
    <div class="hist-delta">
      ${fmtD('', dKcal, ' kcal')}
      <span style="color:#444;font-size:11px">·</span>
      ${fmtD('P', dP, 'g')}
      <span style="color:#444;font-size:11px">·</span>
      ${fmtD('G', dG, 'g')}
      <span style="color:#444;font-size:11px">·</span>
      ${fmtD('L', dL, 'g')}
    </div>`;
    return `
    <div class="hist-card">
      <div class="hist-card-head">
        <span class="hist-date">${fmtDate(d)}</span>
        ${badge}
        <button class="btn-edit-sm" data-action="editHistDay" data-date="${d}">✎ Modifier</button>
      </div>
      <div class="hist-macros">
        <span class="hist-kcal">${totals.kcal} kcal</span>
        <span class="pill-sm" style="color:#7eb8f7">P ${totals.p}g</span>
        <span class="pill-sm" style="color:#f0c040">G ${totals.g}g</span>
        <span class="pill-sm" style="color:#e87070">L ${totals.l}g</span>
      </div>
        <div class="hist-bar-fill" style="width:${pct}%"></div>
      </div>
      ${deltaRow}
    </div>`;
  }).join('');

  return `
  <div class="view-history">
    <h2>Historique</h2>
    ${tomorrowCard}
    ${pastHtml || '<p class="empty-state">Aucun historique pour l\'instant.<br>Commence à journaliser !</p>'}
  </div>`;
}

// ── Tab: Aliments ─────────────────────────────────────────────

function renderFoods() {
  if (S.foodsSubTab === 'meals') return renderFoodsMeals();
  return renderFoodsAliments();
}

function renderFoodsAliments() {
  const q       = S.foodsSearch || '';
  const sort    = S.foodsSort || 'alpha';
  const selMode = S.foodsSelect || false;
  const selIds  = S.foodsSelectedIds || [];

  // #1 — banner: manually added foods not in CSV
  const unsynced = S.foods.filter(f => !f._fromCSV).length;
  const syncBanner = unsynced > 0
    ? `<div class="sync-warning">⚠️ ${unsynced} aliment${unsynced>1?'s':''} ajouté${unsynced>1?'s':''} manuellement — pense à mettre à jour foods.csv depuis ton ordi</div>`
    : '';

  // Filter — search on name only (strip brand prefix), exclude virtual foods
  let filtered = q.length > 0
    ? S.foods.filter(f => !f._virtual && (() => {
        const nom = f.name.indexOf(' — ') > -1 ? f.name.slice(f.name.indexOf(' — ')+3) : f.name;
        return nom.toLowerCase().includes(q.toLowerCase()) || f.name.toLowerCase().includes(q.toLowerCase());
      })())
    : S.foods.filter(f => !f._virtual);

  // #4 — sort
  if (sort === 'alpha') {
    filtered.sort((a, b) => {
      const na = a.name.indexOf(' — ')>-1 ? a.name.slice(a.name.indexOf(' — ')+3) : a.name;
      const nb = b.name.indexOf(' — ')>-1 ? b.name.slice(b.name.indexOf(' — ')+3) : b.name;
      return na.localeCompare(nb, 'fr');
    });
  } else if (sort === 'used') {
    filtered.sort((a, b) => foodUseCount(b.id) - foodUseCount(a.id));
  } else if (sort === 'recent') {
    filtered.sort((a, b) => (foodLastUsed(b.id)||'').localeCompare(foodLastUsed(a.id)||''));
  }

  const rows = filtered.map(f => {
    const isSel  = selIds.includes(f.id);
    const notCSV = !f._fromCSV;
    const cnt    = sort === 'used' ? foodUseCount(f.id) : null;
    return `
    <div class="food-card ${selMode && isSel ? 'food-card-selected' : ''}"
      data-action="${selMode ? 'toggleSelectFood' : 'editFoodDB'}" data-id="${f.id}">
      ${selMode ? `<span class="food-select-box">${isSel ? '✓' : ''}</span>` : ''}
      <div class="food-card-body">
        <div class="food-name">${escHtml(f.name)}</div>
        <div class="food-macros">
          <span class="food-kcal">${f.kcal} kcal/100g</span>
          <span style="color:#7eb8f7">P ${f.p}g</span>
          <span style="color:#f0c040">G ${f.g}g</span>
          <span style="color:#e87070">L ${f.l}g</span>
          ${f.unitWeight ? `<span class="unit-badge">${f.unitWeight}g/u</span>` : ''}
          ${cnt !== null ? `<span class="unit-badge" style="color:#f0c040">${cnt}×</span>` : ''}
        </div>
      </div>
      ${notCSV ? `<button class="btn-not-synced" data-action="showNotSynced" onclick="event.stopPropagation()">
        <svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="8" fill="none" stroke="#f0c040" stroke-width="1.5"/><text x="9" y="13.5" text-anchor="middle" font-family="-apple-system,sans-serif" font-size="11" font-weight="700" fill="#f0c040">!</text></svg>
      </button>` : ''}
    </div>`;
  }).join('');

  // #6 — select toolbar
  const selectToolbar = selMode
    ? `<div class="select-toolbar">
        <button class="sort-btn" data-action="selectAllFoods">Tout sélect.</button>
        <button class="sort-btn ${selIds.length ? 'sort-btn-danger' : ''}" data-action="deleteSelectedFoods">Supprimer ${selIds.length ? `(${selIds.length})` : ''}</button>
       </div>`
    : '';

  return `
  <div class="view-foods">
    <div class="foods-header">
      <h2>Aliments</h2>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn-select-mode ${selMode ? 'btn-select-mode-active' : ''}" data-action="toggleSelectMode" title="Sélection multiple">☑</button>
        <button class="btn-primary-sm" data-action="openAddFoodDB">+ Nouveau</button>
      </div>
    </div>
    <div class="subtab-row">
      <button class="subtab-btn active" data-action="setFoodsSubTab" data-val="foods">Aliments</button>
      <button class="subtab-btn" data-action="setFoodsSubTab" data-val="meals">Repas favoris</button>
    </div>
    ${syncBanner}
    ${selectToolbar}
    <input class="search-input" type="search" placeholder="Rechercher par nom…"
      value="${escHtml(q)}" data-action="searchFoods" autocomplete="off">
    <div class="sort-row">
      <button class="sort-btn ${sort==='alpha'  ? 'active':''}" data-action="setFoodsSort" data-val="alpha">A→Z</button>
      <button class="sort-btn ${sort==='used'   ? 'active':''}" data-action="setFoodsSort" data-val="used">+ utilisés</button>
      <button class="sort-btn ${sort==='recent' ? 'active':''}" data-action="setFoodsSort" data-val="recent">Récents</button>
    </div>
    ${rows || '<p class="empty-state">Aucun aliment.<br>Appuie sur <strong>+ Nouveau</strong> pour commencer !</p>'}
  </div>`;
}

function renderFoodsMeals() {
  const mealCards = S.meals.map(m => {
    const isQuick = !!m._quick;
    const totals  = isQuick
      ? { kcal: m.kcal, p: m.p, g: m.g, l: m.l }
      : calcMacros(m.items);
    const action  = isQuick ? 'openEditQuickMeal' : 'editMeal';
    const badge   = isQuick
      ? `<span class="unit-badge" style="color:#f0c040">⚡ Rapide</span>`
      : `<span class="unit-badge" style="color:#7eb8f7">Ingrédients</span>`;
    const itemNames = isQuick ? '' : m.items.map(it => {
      const f = S.foods.find(x => x.id === it.foodId);
      return f ? `${f.name} (${it.grams}g)` : '';
    }).filter(Boolean).join(', ');
    return `
    <div class="food-card" data-action="${action}" data-id="${m.id}">
      <div class="food-card-body">
        <div class="food-name" style="display:flex;align-items:center;gap:6px">
          ${escHtml(m.name)} ${badge}
        </div>
        <div class="food-macros" style="margin-top:4px">
          <span class="food-kcal">${totals.kcal} kcal</span>
          <span style="color:#7eb8f7">P ${totals.p}g</span>
          <span style="color:#f0c040">G ${totals.g}g</span>
          <span style="color:#e87070">L ${totals.l}g</span>
        </div>
        ${itemNames ? `<div style="font-size:11px;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:3px">${escHtml(itemNames)}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  return `
  <div class="view-foods">
    <div class="foods-header">
      <h2>Repas favoris</h2>
      <div style="display:flex;gap:8px">
        <button class="btn-quick-add" style="padding:6px 10px;border-radius:10px;font-size:13px;font-weight:500" data-action="openQuickMeal">⚡ Rapide</button>
        <button class="btn-primary-sm" data-action="openAddMeal">+ Ingrédients</button>
      </div>
    </div>
    <div class="subtab-row">
      <button class="subtab-btn" data-action="setFoodsSubTab" data-val="foods">Aliments</button>
      <button class="subtab-btn active" data-action="setFoodsSubTab" data-val="meals">Repas favoris</button>
    </div>
    ${mealCards || '<p class="empty-state">Aucun repas favori.<br>Crée-en un pour ajouter un repas complet en un tap !</p>'}
  </div>`;
}

// ── Tab: Réglages ─────────────────────────────────────────────

function renderSettings() {
  const blocks = ['sport', 'rest'].map(type => {
    const g       = S.goals[type];
    const editing = S.settingsEdit === type;
    const t       = S.settingsTemp;
    const label   = type === 'sport' ? 'Jour Sport ⚡' : 'Jour Repos 🌙';
    
    const fields = [
      { key: 'kcal', label: 'Calories (kcal)' },
      { key: 'p',    label: 'Protéines (g)' },
      { key: 'g',    label: 'Glucides (g)' },
      { key: 'l',    label: 'Lipides (g)' }
    ];

    if (editing) {
      return `
      <div class="settings-block">
        <div class="settings-block-head">
          <span class="settings-label">${label}</span>
          <div class="settings-actions">
            <button class="btn-save" data-action="saveGoals" data-type="${type}">Enregistrer</button>
            <button class="btn-cancel" data-action="cancelGoals">Annuler</button>
          </div>
        </div>
        ${fields.map(f => `
        <div class="settings-field">
          <label>${f.label}</label>
          <input type="number" class="settings-input" data-key="${f.key}"
            value="${t[f.key] !== undefined ? t[f.key] : g[f.key]}" inputmode="decimal">
        </div>`).join('')}
      </div>`;
    }

    return `
    <div class="settings-block">
      <div class="settings-block-head">
        <span class="settings-label">${label}</span>
        <button class="btn-edit-sm" data-action="editGoals" data-type="${type}">✎ Modifier</button>
      </div>
      <div class="settings-values">
        <span>${g.kcal} kcal</span>
        <span style="color:#7eb8f7">P ${g.p}g</span>
        <span style="color:#f0c040">G ${g.g}g</span>
        <span style="color:#e87070">L ${g.l}g</span>
      </div>
    </div>`;
  }).join('');

  // Script pour récupérer dynamiquement la version du cache
  setTimeout(async () => {
    try {
      const keys = await caches.keys();
      // On cherche un cache qui commence par "macros-"
      const versionKey = keys.find(k => k.startsWith('macros-'));
      const displayEl = document.getElementById('version-number');
      if (versionKey && displayEl) {
        // On transforme "macros-v8" en "V8"
        const v = versionKey.split('-')[1].toUpperCase();
        displayEl.textContent = v;
      }
    } catch (e) {
      console.log("Erreur lecture version cache");
    }
  }, 0);

  return `
  <div class="view-settings">
    <h2>Réglages</h2>
    
    ${blocks}

    <div class="settings-block">
      <div class="settings-block-head">
        <span class="settings-label">Export des données</span>
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:10px">Historique des jours</div>
      <div class="export-row" style="margin-bottom:10px">
        <button class="btn-export" data-action="exportHistoryCSV">⬇ CSV Historique</button>
        <button class="btn-export" data-action="exportHistoryJSON">⬇ JSON Historique</button>
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:10px">Ma base d'aliments</div>
      <div class="export-row">
        <button class="btn-export" data-action="exportFoodsCSV">⬇ CSV Aliments</button>
        <button class="btn-export" data-action="exportFullJSON">⬇ JSON Complet</button>
      </div>
    </div>

    <div style="margin-top: 40px; text-align: center; padding-bottom: 30px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 20px;">
      <div style="color: #666; font-size: 12px; font-weight: 600; letter-spacing: 0.5px;">
        MES MACROS — <span id="version-number">...</span>
      </div>
      <div style="color: #444; font-size: 10px; margin-top: 6px; text-transform: uppercase; letter-spacing: 1px;">
        PWA Stable & Auto-update
      </div>
    </div>
  </div>`;
}

// ── Modals ────────────────────────────────────────────────────

function renderModal() {
  let content = '';
  switch (S.modal) {
    case 'addFood':    content = renderAddFoodModal();    break;
    case 'editEntry':  content = renderEditEntryModal();  break;
    case 'addFoodDB':  content = renderAddFoodDBModal();  break;
    case 'editFoodDB': content = renderEditFoodDBModal(); break;
    case 'quickAdd':   content = renderQuickAddModal();        break;
    case 'addMeal':    content = renderAddMealModal();         break;
    case 'editMeal':   content = renderEditMealModal();        break;
    case 'addFavMeal': content = renderAddFavMealModal();      break;
    case 'copyMeal':   content = renderCopyMealModal();        break;
    case 'deleteFoodConfirm': content = renderDeleteFoodConfirmModal(); break;
    case 'quickMeal':  content = renderQuickMealModal();  break;
    default: return '';
  }
  return `
  <div class="modal-overlay" data-action="closeModal">
    <div class="modal-sheet" data-action="noop">
      <div class="modal-handle"></div>
      ${content}
    </div>
  </div>`;
}

function renderAddFoodModal() {
  const q      = S.searchQ || '';
  const { meal, date } = S.md;
  const sel    = S.md.selectedFood;

  if (!sel) {
    // Search view
    const list = q.length >= 1
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
      : S.foods.slice().sort((a, b) => a.name.localeCompare(b, 'fr'));

    const items = list.map(f => `
    <div class="food-item" data-action="selectFood" data-id="${f.id}">
      <span class="food-item-name">${escHtml(f.name)}</span>
      <span class="food-item-kcal">${f.kcal} kcal/100g</span>
    </div>`).join('');

    // Recent foods shown when no query
    let recentSection = '';
    if (!q) {
      const recentIds = getRecentFoodIds(6);
      if (recentIds.length) {
        const recentItems = recentIds.map(id => {
          const f = S.foods.find(x => x.id === id);
          if (!f) return '';
          return `<div class="food-item" data-action="selectFood" data-id="${f.id}">
            <span class="food-item-name">${escHtml(f.name)}</span>
            <span class="food-item-kcal recent-badge">Récent</span>
          </div>`;
        }).filter(Boolean).join('');
        recentSection = `
        <div class="recent-label">Récents</div>
        ${recentItems}
        <div class="recent-divider"></div>`;
      }
    }

    // Fav meals section (always shown when no query, filtered when query)
    let favSection = '';
    const favFiltered = q.length >= 1
      ? S.meals.filter(m => m.name.toLowerCase().includes(q.toLowerCase()))
      : S.meals;
    if (favFiltered.length) {
      const favItems = favFiltered.map(m => {
        const isQuick = !!m._quick;
        const totals  = isQuick ? { kcal: m.kcal } : calcMacros(m.items);
        return `<div class="food-item" data-action="addFavMealToRepas" data-meal-id="${m.id}">
          <span class="food-item-name">${escHtml(m.name)}${isQuick ? ' ⚡' : ''}</span>
          <span class="food-item-kcal">${totals.kcal} kcal</span>
        </div>`;
      }).join('');
      favSection = `
      <div class="recent-label">Repas favoris</div>
      ${favItems}
      <div class="recent-divider"></div>
      <div class="recent-label">Tous les aliments</div>`;
    } else if (!q) {
      favSection = recentSection ? '' : '';
      // If no fav meals and no recents, just show "Tous les aliments"
    }

    const addNew = q
      ? `<button class="btn-add-new" data-action="addFoodToDBFromSearch"
           data-name="${escHtml(q)}">➕ Ajouter "${escHtml(q)}" à ma base</button>`
      : '';

    const allLabel = (!q && (recentSection || favSection))
      ? `<div class="recent-label">Tous les aliments</div>`
      : '';

    return `
    <h3 class="modal-title">Repas ${meal}</h3>
    <input id="food-search" class="search-input" type="search"
      placeholder="Rechercher un aliment ou repas…" value="${escHtml(q)}"
      data-action="filterFoods" autocomplete="off" autocorrect="off">
    <div class="food-list" style="padding-bottom:69px">
      ${!q ? (recentSection + favSection + allLabel) : ''}
      ${items || (q ? addNew : '<p class="empty-state" style="padding:20px 0">Aucun résultat</p>')}
      ${items && q ? addNew : ''}
    </div>`;
  }

  // Selected food — qty input
  const f        = sel;
  const hasUnit  = !!f.unitWeight;
  const useUnits = S.md.useUnits !== undefined ? S.md.useUnits : hasUnit;
  const qty      = S.md.qty !== undefined ? S.md.qty : (hasUnit ? 1 : 100);
  const grams    = useUnits ? qty * f.unitWeight : qty;
  const mc       = calcMacros([{ foodId: f.id, grams }]);

  let qtySection = '';
  if (hasUnit) {
    qtySection += `
    <div class="unit-toggle-wrap">
      <button class="unit-btn ${!useUnits ? 'active' : ''}" data-action="setUseUnits" data-val="0">Grammes</button>
      <button class="unit-btn ${useUnits  ? 'active' : ''}" data-action="setUseUnits" data-val="1">Unités</button>
    </div>`;
  }
  if (useUnits) {
    qtySection += `
    <div class="stepper">
      <button class="stepper-btn" data-action="stepQty" data-d="-1">−</button>
      <span class="stepper-val">${qty}</span>
      <button class="stepper-btn" data-action="stepQty" data-d="1">+</button>
    </div>
    <p class="grams-note">${grams}g au total</p>`;
  } else {
    qtySection += `<input type="number" class="qty-input" id="qty-input"
      value="${qty}" min="1" inputmode="decimal" placeholder="Grammes"
      data-action="setQty">`;
  }

  return `
  <h3 class="modal-title">Repas ${meal}</h3>
  <div class="modal-food-selected">
    <button class="btn-back-sm" data-action="unselectFood">← Retour</button>
    <h3 class="modal-food-name">${escHtml(f.name)}</h3>
    <div class="modal-macros-preview" id="macros-preview">
      <span>${mc.kcal} kcal</span>
      <span style="color:#7eb8f7">P ${mc.p}g</span>
      <span style="color:#f0c040">G ${mc.g}g</span>
      <span style="color:#e87070">L ${mc.l}g</span>
    </div>
    ${qtySection}
    <button class="btn-confirm nav-spacer" data-action="confirmAddFood">Ajouter au Repas ${meal}</button>
  </div>`;
}

function renderEditEntryModal() {
  const { meal, idx, date } = S.md;
  const day   = S.days[date];
  const entry = day?.meals[meal]?.[idx];
  if (!entry) return '<p style="padding:20px;color:#888">Entrée introuvable.</p>';
  const f = S.foods.find(x => x.id === entry.foodId);
  if (!f) return '<p style="padding:20px;color:#888">Aliment supprimé de la base.</p>';

  const hasUnit  = !!f.unitWeight;
  const useUnits = S.md.useUnits !== undefined ? S.md.useUnits : hasUnit;
  const grams    = S.md.grams !== undefined ? S.md.grams : entry.grams;
  const qtyUnits = useUnits ? +(grams / f.unitWeight).toFixed(1) : grams;
  const mc       = calcMacros([{ foodId: f.id, grams }]);

  let qtySection = '';
  if (hasUnit) {
    qtySection += `
    <div class="unit-toggle-wrap">
      <button class="unit-btn ${!useUnits ? 'active' : ''}" data-action="editSetUseUnits" data-val="0">Grammes</button>
      <button class="unit-btn ${useUnits  ? 'active' : ''}" data-action="editSetUseUnits" data-val="1">Unités</button>
    </div>`;
  }
  if (useUnits) {
    qtySection += `
    <div class="stepper">
      <button class="stepper-btn" data-action="editStepQty" data-d="-1">−</button>
      <span class="stepper-val">${qtyUnits}</span>
      <button class="stepper-btn" data-action="editStepQty" data-d="1">+</button>
    </div>
    <p class="grams-note">${grams}g au total</p>`;
  } else {
    qtySection += `<input type="number" class="qty-input" id="edit-qty-input"
      value="${grams}" min="1" inputmode="decimal" data-action="editSetQty">`;
  }

  return `
  <h3 class="modal-title">${escHtml(f.name)}</h3>
  <div class="modal-macros-preview" id="macros-preview">
    <span>${mc.kcal} kcal</span>
    <span style="color:#7eb8f7">P ${mc.p}g</span>
    <span style="color:#f0c040">G ${mc.g}g</span>
    <span style="color:#e87070">L ${mc.l}g</span>
  </div>
  ${qtySection}
  <div class="modal-edit-actions nav-spacer">
    <button class="btn-delete" data-action="deleteEntry">Supprimer</button>
    <button class="btn-confirm" data-action="saveEntry">Enregistrer</button>
  </div>`;
}

function renderAddFoodDBModal() {
  const d = S.md;
  return `
  <h3 class="modal-title">Nouvel aliment</h3>
  <div class="form-group">
    <label>Marque (optionnel)</label>
    <input type="text" class="form-input" id="db-brand"
      value="${escHtml(d.brand || '')}" placeholder="ex : Danone, Prozis…" autocomplete="off">
  </div>
  <div class="form-group">
    <label>Nom de l'aliment</label>
    <input type="text" class="form-input" id="db-name"
      value="${escHtml(d.name || '')}" placeholder="ex : Poulet grillé" autocomplete="off">
  </div>
  <div class="form-group">
    <label>Calories (kcal pour 100g)</label>
    <input type="number" class="form-input" id="db-kcal"
      value="${d.kcal || ''}" placeholder="165" inputmode="decimal">
  </div>
  <div class="form-row-3">
    <div class="form-group">
      <label>Protéines (g)</label>
      <input type="number" class="form-input" id="db-p"
        value="${d.p || ''}" placeholder="31" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Glucides (g)</label>
      <input type="number" class="form-input" id="db-g"
        value="${d.g || ''}" placeholder="0" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Lipides (g)</label>
      <input type="number" class="form-input" id="db-l"
        value="${d.l || ''}" placeholder="3.6" inputmode="decimal">
    </div>
  </div>
  <div class="form-group" style="margin-top:4px">
    <label>Poids unitaire (g/unité) — optionnel</label>
    <input type="number" class="form-input" id="db-unit"
      value="${d.unitWeight || ''}" placeholder="ex : 120 pour un œuf entier" inputmode="decimal">
  </div>
  <button class="btn-confirm nav-spacer" data-action="saveFoodDB">Enregistrer dans ma base</button>`;
}

function renderEditFoodDBModal() {
  const f = S.foods.find(x => x.id === S.md.foodId);
  if (!f) return '<p style="padding:20px;color:#888">Introuvable.</p>';
  // Extract brand and name (stored as "Marque — Nom" or just "Nom")
  const sep   = f.name.indexOf(' — ');
  const brand = sep > -1 ? f.name.slice(0, sep) : '';
  const nom   = sep > -1 ? f.name.slice(sep + 3) : f.name;
  return `
  <h3 class="modal-title">Modifier un aliment</h3>
  <div class="form-group">
    <label>Marque (optionnel)</label>
    <input type="text" class="form-input" id="db-brand" value="${escHtml(brand)}" placeholder="ex : Danone, Prozis…" autocomplete="off">
  </div>
  <div class="form-group">
    <label>Nom</label>
    <input type="text" class="form-input" id="db-name" value="${escHtml(nom)}" autocomplete="off">
  </div>
  <div class="form-group">
    <label>Calories (kcal/100g)</label>
    <input type="number" class="form-input" id="db-kcal" value="${f.kcal}" inputmode="decimal">
  </div>
  <div class="form-row-3">
    <div class="form-group">
      <label>Protéines</label>
      <input type="number" class="form-input" id="db-p" value="${f.p}" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Glucides</label>
      <input type="number" class="form-input" id="db-g" value="${f.g}" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Lipides</label>
      <input type="number" class="form-input" id="db-l" value="${f.l}" inputmode="decimal">
    </div>
  </div>
  <div class="form-group" style="margin-top:4px">
    <label>Poids unitaire (g/unité)</label>
    <input type="number" class="form-input" id="db-unit" value="${f.unitWeight || ''}" inputmode="decimal">
  </div>
  <div class="modal-edit-actions nav-spacer">
    <button class="btn-delete" data-action="deleteFoodDB" data-id="${f.id}">Supprimer</button>
    <button class="btn-confirm" data-action="updateFoodDB" data-id="${f.id}">Enregistrer</button>
  </div>`;
}

// ── Modal: Quick Add ─────────────────────────────────────────

function renderQuickAddModal() {
  const { meal } = S.md;
  const d = S.md;
  return `
  <h3 class="modal-title">⚡ Ajout rapide — Repas ${meal}</h3>
  <p style="font-size:13px;color:#666;margin-bottom:14px">Estime les macros sans passer par ta base d'aliments.</p>
  <div class="form-group">
    <label>Nom du plat (optionnel)</label>
    <input type="text" class="form-input" id="qa-name"
      value="${escHtml(d.qaName || '')}" placeholder="ex : Pancakes brunch, Riz poulet…" autocomplete="off">
  </div>
  <div class="form-group">
    <label>Calories (kcal)</label>
    <input type="number" class="form-input" id="qa-kcal"
      value="${d.qaKcal || ''}" placeholder="500" inputmode="decimal">
  </div>
  <div class="form-row-3">
    <div class="form-group">
      <label>Protéines (g)</label>
      <input type="number" class="form-input" id="qa-p"
        value="${d.qaP || ''}" placeholder="25" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Glucides (g)</label>
      <input type="number" class="form-input" id="qa-g"
        value="${d.qaG || ''}" placeholder="60" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Lipides (g)</label>
      <input type="number" class="form-input" id="qa-l"
        value="${d.qaL || ''}" placeholder="15" inputmode="decimal">
    </div>
  </div>
  <button class="btn-confirm nav-spacer" data-action="confirmQuickAdd">Ajouter au Repas ${meal}</button>`;
}

// ── Modal: Add Fav Meal to a repas ──────────────────────────

function renderAddFavMealModal() {
  const { meal } = S.md;
  if (!S.meals.length) {
    return `
    <h3 class="modal-title">★ Repas favoris</h3>
    <p class="empty-state" style="padding:24px 0">Aucun repas favori.<br>Crée-en un dans l'onglet <strong>Aliments</strong>.</p>
    <button class="btn-confirm nav-spacer" data-action="closeModal" style="opacity:0.4">Fermer</button>`;
  }
  const cards = S.meals.map(m => {
    const isQuick = !!m._quick;
    const totals  = isQuick ? { kcal: m.kcal, p: m.p, g: m.g, l: m.l } : calcMacros(m.items);
    return `
    <div class="food-item" data-action="addFavMealToRepas" data-meal-id="${m.id}">
      <div>
        <span class="food-item-name">${escHtml(m.name)}${isQuick ? ' ⚡' : ''}</span>
        <div style="font-size:12px;color:#666;margin-top:2px">
          ${totals.kcal} kcal · P ${totals.p}g · G ${totals.g}g · L ${totals.l}g
        </div>
      </div>
      <span style="font-size:12px;color:#7eb8f7;font-weight:600">+ Ajouter</span>
    </div>`;
  }).join('');
  return `
  <h3 class="modal-title">★ Repas favoris — Repas ${meal}</h3>
  <div class="food-list" style="max-height:65vh">${cards}</div>
  <div style="height:69px"></div>`;
}

// ── Modal: Create/Edit Fav Meal ───────────────────────────────

function renderAddMealModal() {
  const items = S.md.mealItems || [];
  const totals = calcMacros(items);
  // Build item rows
  const itemRows = items.map((it, i) => {
    const f = S.foods.find(x => x.id === it.foodId);
    if (!f) return '';
    return `
    <div class="meal-entry" style="border-radius:10px;background:#1a1a1a;margin-bottom:6px;border:1px solid rgba(255,255,255,0.07)">
      <div class="entry-left">
        <span class="entry-name">${escHtml(f.name)}</span>
        <div class="entry-macros-row">
          <span class="entry-macro-p">P ${+(f.p * it.grams / 100).toFixed(1)}g</span>
          <span class="entry-macro-g">G ${+(f.g * it.grams / 100).toFixed(1)}g</span>
          <span class="entry-macro-l">L ${+(f.l * it.grams / 100).toFixed(1)}g</span>
        </div>
      </div>
      <div class="entry-right">
        <span class="entry-qty">${it.grams}g</span>
        <button class="btn-delete" style="padding:2px 8px;font-size:12px;border-radius:6px" data-action="removeMealItem" data-idx="${i}">✕</button>
      </div>
    </div>`;
  }).join('');

  // Food search for adding items
  const q = S.md.mealSearchQ || '';
  const searchList = q.length >= 1
    ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
    : [];
  const searchItems = searchList.map(f => `
    <div class="food-item" data-action="selectMealIngredient" data-id="${f.id}">
      <span class="food-item-name">${escHtml(f.name)}</span>
      <span class="food-item-kcal">${f.kcal} kcal</span>
    </div>`).join('');

  // If an ingredient is selected, show qty input
  const selIngr = S.md.selectedIngredient;
  const ingrSection = selIngr
    ? `<div style="background:#1a1a1a;border-radius:12px;padding:12px;margin-bottom:12px;border:1px solid rgba(255,255,255,0.07)">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px">${escHtml(selIngr.name)}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <input type="number" class="qty-input" id="meal-ingr-qty"
            value="${S.md.ingrQty || 100}" min="1" inputmode="decimal" style="margin-bottom:0;flex:1;font-size:18px;padding:10px">
          <span style="color:#666;font-size:14px">g</span>
          <button class="btn-save" style="flex-shrink:0" data-action="confirmMealIngredient">Ajouter</button>
        </div>
       </div>`
    : `<input class="search-input" id="meal-ingr-search" type="search"
        placeholder="Ajouter un ingrédient…" value="${escHtml(q)}"
        data-action="searchMealIngredient" autocomplete="off" style="margin-bottom:8px">
       <div class="food-list" style="max-height:25vh">${searchItems}</div>`;

  return `
  <h3 class="modal-title">${S.md.mealId ? 'Modifier le repas' : 'Nouveau repas favori'}</h3>
  <div class="form-group">
    <label>Nom du repas</label>
    <input type="text" class="form-input" id="meal-name"
      value="${escHtml(S.md.mealName || '')}" placeholder="ex : Bol protéiné, Brunch dominical…" autocomplete="off">
  </div>
  <div class="macros-summary-inline" style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap">
    <span style="font-size:14px;font-weight:700;color:#e8e8e8">${totals.kcal} kcal</span>
    <span style="font-size:13px;color:#7eb8f7">P ${totals.p}g</span>
    <span style="font-size:13px;color:#f0c040">G ${totals.g}g</span>
    <span style="font-size:13px;color:#e87070">L ${totals.l}g</span>
  </div>
  ${itemRows}
  <div style="margin-top:12px;margin-bottom:4px;font-size:12px;color:#666">Ajouter un ingrédient</div>
  ${ingrSection}
  ${S.md.mealId
    ? `<div class="modal-edit-actions nav-spacer">
        <button class="btn-delete" data-action="deleteFavMeal" data-id="${S.md.mealId}">Supprimer</button>
        <button class="btn-confirm" data-action="saveFavMeal">Enregistrer</button>
       </div>`
    : `<button class="btn-confirm nav-spacer" data-action="saveFavMeal">Enregistrer le repas</button>`
  }`;
}

function renderEditMealModal() {
  // Re-use addMealModal (state has mealId set)
  return renderAddMealModal();
}

function renderCopyMealModal() {
  const { meal, date } = S.md;
  const isToday    = date === todayStr();
  const isTomorrow = date === tomorrowStr();

  const mealBtns = [1,2,3,4,5,6].map(n => `
    <button class="copy-meal-btn ${n === meal ? 'copy-meal-btn-self' : ''}"
      data-action="confirmCopyMeal" data-dest-meal="${n}" data-dest-date="${date}">
      Repas ${n}${n === meal ? ' ●' : ''}
    </button>`).join('');

  const otherDate = isToday ? tomorrowStr() : todayStr();
  const otherLabel = isToday ? 'demain' : "aujourd'hui";
  const otherMealBtns = [1,2,3,4,5,6].map(n => `
    <button class="copy-meal-btn"
      data-action="confirmCopyMeal" data-dest-meal="${n}" data-dest-date="${otherDate}">
      Repas ${n}
    </button>`).join('');

  return `
  <h3 class="modal-title">⎘ Copier Repas ${meal}</h3>
  <div style="font-size:12px;color:#666;margin-bottom:8px">Même jour</div>
  <div class="copy-meal-grid">${mealBtns}</div>
  <div style="font-size:12px;color:#666;margin:12px 0 8px">Vers ${otherLabel}</div>
  <div class="copy-meal-grid">${otherMealBtns}</div>
  <div style="height:69px"></div>`;
}

// ── Modal: Quick Meal (fav meal macros-only) ─────────────────

function renderQuickMealModal() {
  const d      = S.md;
  const isEdit = !!d.qmId;
  return `
  <h3 class="modal-title">${isEdit ? 'Modifier le repas' : '✦ Nouveau repas favori rapide'}</h3>
  <p style="font-size:13px;color:#666;margin-bottom:14px">Sans ingrédients — juste un nom et les macros globales du repas.</p>
  <div class="form-group">
    <label>Nom du repas</label>
    <input type="text" class="form-input" id="qm-name"
      value="${escHtml(d.qmName || '')}" placeholder="ex : Pancakes brunch, Bol thaï…" autocomplete="off">
  </div>
  <div class="form-group">
    <label>Calories (kcal)</label>
    <input type="number" class="form-input" id="qm-kcal"
      value="${d.qmKcal || ''}" placeholder="500" inputmode="decimal">
  </div>
  <div class="form-row-3">
    <div class="form-group">
      <label>Protéines (g)</label>
      <input type="number" class="form-input" id="qm-p"
        value="${d.qmP || ''}" placeholder="25" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Glucides (g)</label>
      <input type="number" class="form-input" id="qm-g"
        value="${d.qmG || ''}" placeholder="60" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Lipides (g)</label>
      <input type="number" class="form-input" id="qm-l"
        value="${d.qmL || ''}" placeholder="15" inputmode="decimal">
    </div>
  </div>
  ${isEdit
    ? `<div class="modal-edit-actions nav-spacer">
        <button class="btn-delete" data-action="deleteQuickMeal" data-id="${d.qmId}">Supprimer</button>
        <button class="btn-confirm" data-action="saveQuickMeal">Enregistrer</button>
       </div>`
    : `<button class="btn-confirm nav-spacer" data-action="saveQuickMeal">Enregistrer le repas</button>`
  }`;
}

function renderDeleteFoodConfirmModal() {
  const ids    = S.md.deleteIds || [];
  const single = ids.length === 1;
  const f      = single ? S.foods.find(x => x.id === ids[0]) : null;
  const uses   = single ? findFoodUsage(ids[0]) : [];

  let usageHtml = '';
  if (single && uses.length) {
    const pills = uses.slice(0, 6).map(u =>
      `<span class="usage-pill">Repas ${u.meal} · ${fmtDateShort(u.date)}</span>`
    ).join('');
    const more = uses.length > 6 ? `<span class="usage-pill">+${uses.length-6}</span>` : '';
    usageHtml = `<div class="usage-warning">
      <div style="font-size:13px;color:#f0c040;font-weight:600;margin-bottom:8px">⚠️ Utilisé dans ${uses.length} repas</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">${pills}${more}</div>
    </div>`;
  } else if (!single) {
    usageHtml = `<p style="font-size:13px;color:#888;margin-bottom:12px">${ids.length} aliments sélectionnés.</p>`;
  }

  return `
  <h3 class="modal-title" style="color:#e87070">Supprimer ${single && f ? escHtml(f.name) : ids.length+' aliments'}</h3>
  ${usageHtml}
  ${single && uses.length ? `
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">
    <button class="btn-confirm" style="background:#e87070;color:#000" data-action="confirmDeleteFoodEverywhere">Supprimer partout (repas inclus)</button>
    <button class="btn-confirm" style="background:#2a2a2a;color:#e8e8e8;font-weight:500" data-action="confirmDeleteFoodKeepMeals">Garder les valeurs dans les repas</button>
  </div>` : `
  <button class="btn-confirm" style="background:#e87070;color:#000;margin-bottom:8px" data-action="confirmDeleteFoodEverywhere">Confirmer</button>`}
  <button style="display:block;width:100%;padding:12px;text-align:center;border-radius:14px;border:1px solid rgba(255,255,255,0.1);color:#666;margin-bottom:69px" data-action="closeModal">Annuler</button>`;
}

// ── Navigation Bar ────────────────────────────────────────────

function renderNav() {
  const tabs = [
    { 
      id: 'today', 
      label: "Aujourd'hui",
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`
    },
    { 
      id: 'history', 
      label: 'Historique',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
    },
    { 
      id: 'foods', 
      label: 'Aliments',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`
    },
    { 
      id: 'settings', 
      label: 'Réglages',
      icon: `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`
    }
  ];

  const nav = document.getElementById('nav');
  nav.innerHTML = tabs.map(t => `
    <button class="nav-btn ${S.tab === t.id ? 'active' : ''}" data-tab="${t.id}">
      <span class="nav-icon">${t.icon}</span>
      <span class="nav-label">${t.label}</span>
    </button>`).join('');

  nav.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      S.tab     = btn.dataset.tab;
      S.modal   = null;
      S.md      = {};
      S.searchQ = '';
      
      if (S.tab === 'today') {
        S.viewDate = todayStr();
      }
      if (S.tab !== 'history') {
        S.histSub  = 'list';
        S.editDate = null;
      }
      
      render();
      renderNav();
    });
  });
}

// ── Main Render ───────────────────────────────────────────────

function render() {
  let view = '';
  switch (S.tab) {
    case 'today':    view = renderDayView(S.viewDate); break;
    case 'history':  view = renderHistory();            break;
    case 'foods':    view = renderFoods();              break;
    case 'settings': view = renderSettings();           break;
  }
  const modal  = S.modal ? renderModal() : '';
  const app    = document.getElementById('app');
  app.innerHTML = view + modal;
}

// ── Event Handling ────────────────────────────────────────────

function bindEvents() {
  // Called ONCE from init — event delegation on persistent #app element
  const app = document.getElementById('app');
  app.addEventListener('click', handleClick);
  app.addEventListener('input', handleInput);
}

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  switch (a) {

    // ── Navigation within views
    case 'back':
      if (S.tab === 'today') {
        S.viewDate = todayStr();
      } else if (S.tab === 'history') {
        S.histSub  = 'list';
        S.editDate = null;
      }
      render();
      break;

    case 'viewTomorrow':
      S.viewDate = tomorrowStr();
      render();
      renderNav();
      break;

    case 'editHistDay':
      S.histSub  = 'edit';
      S.editDate = el.dataset.date;
      render();
      break;

    // ── Day type toggle
    case 'toggleType': {
      const date = el.dataset.date;
      const day  = getDay(date);
      day.type   = day.type === 'sport' ? 'rest' : 'sport';
      save();
      render();
      break;
    }

    // ── Modal: Add food to meal
    case 'openAddFood':
      S.modal   = 'addFood';
      S.searchQ = '';
      S.md      = { meal: +el.dataset.meal, date: el.dataset.date };
      render();
      setTimeout(() => document.getElementById('food-search')?.focus(), 80);
      break;

    case 'noop': break; // modal-sheet click stopper

    case 'closeModal':
      // Only close when clicking the dark backdrop, not inside the sheet
      if (!e.target.closest('.modal-sheet')) {
        S.modal = null;
        S.md    = {};
        S.searchQ = '';
        render();
      }
      break;

    case 'selectFood': {
      const f      = S.foods.find(x => x.id === el.dataset.id);
      if (!f) break;
      S.md.selectedFood = f;
      S.md.useUnits     = !!f.unitWeight;
      S.md.qty          = f.unitWeight ? 1 : 100;
      render();
      setTimeout(() => document.getElementById('qty-input')?.focus(), 80);
      break;
    }

    case 'unselectFood':
      S.md.selectedFood = null;
      render();
      setTimeout(() => document.getElementById('food-search')?.focus(), 80);
      break;

    case 'setUseUnits': {
      const wasUnit     = S.md.useUnits;
      S.md.useUnits     = el.dataset.val === '1';
      const f           = S.md.selectedFood;
      // Convert quantity
      if (wasUnit && !S.md.useUnits && f?.unitWeight) {
        S.md.qty = (S.md.qty || 1) * f.unitWeight;
      } else if (!wasUnit && S.md.useUnits && f?.unitWeight) {
        S.md.qty = Math.max(1, Math.round((S.md.qty || 100) / f.unitWeight));
      } else {
        S.md.qty = S.md.useUnits ? 1 : 100;
      }
      render();
      break;
    }

    case 'stepQty': {
      const step = +el.dataset.d;
      S.md.qty   = Math.max(0.5, (S.md.qty || 1) + step);
      // Update preview without full re-render to avoid keyboard dismiss
      updateMacrosPreview();
      const val = document.querySelector('.stepper-val');
      if (val) val.textContent = S.md.qty;
      const note = document.querySelector('.grams-note');
      if (note && S.md.selectedFood?.unitWeight) {
        note.textContent = `${S.md.qty * S.md.selectedFood.unitWeight}g au total`;
      }
      break;
    }

    case 'confirmAddFood': {
      const { meal, date, selectedFood, useUnits } = S.md;
      let grams;
      if (useUnits) {
        grams = S.md.qty * selectedFood.unitWeight;
      } else {
        const inp = document.getElementById('qty-input');
        grams = inp ? +inp.value : S.md.qty;
      }
      if (!grams || grams <= 0) { showToast('Saisis une quantité valide.'); break; }
      const day = getDay(date);
      day.meals[meal].push({ foodId: selectedFood.id, grams });
      save();
      S.modal = null;
      S.md    = {};
      render();
      break;
    }

    // ── Modal: Edit existing entry
    case 'editEntry': {
      const { meal, idx, date } = el.dataset;
      const entry = S.days[date]?.meals[meal]?.[+idx];
      if (!entry) break;
      const f = S.foods.find(x => x.id === entry.foodId);
      S.modal = 'editEntry';
      S.md    = {
        meal:     +meal,
        idx:      +idx,
        date,
        grams:    entry.grams,
        useUnits: !!(f?.unitWeight)
      };
      render();
      break;
    }

    case 'editSetUseUnits': {
      const wasUnit = S.md.useUnits;
      S.md.useUnits = el.dataset.val === '1';
      const entry   = S.days[S.md.date]?.meals[S.md.meal]?.[S.md.idx];
      const f       = entry ? S.foods.find(x => x.id === entry.foodId) : null;
      if (f?.unitWeight) {
        if (wasUnit && !S.md.useUnits) {
          // grams already stored as grams, no conversion needed
        } else if (!wasUnit && S.md.useUnits) {
          S.md.grams = Math.round(S.md.grams / f.unitWeight) * f.unitWeight || f.unitWeight;
        }
      }
      render();
      break;
    }

    case 'editStepQty': {
      const step  = +el.dataset.d;
      const entry = S.days[S.md.date]?.meals[S.md.meal]?.[S.md.idx];
      const f     = entry ? S.foods.find(x => x.id === entry.foodId) : null;
      const unit  = f?.unitWeight || 1;
      S.md.grams  = Math.max(unit, S.md.grams + step * unit);
      updateMacrosPreview();
      const val = document.querySelector('.stepper-val');
      if (val && f?.unitWeight) val.textContent = +(S.md.grams / f.unitWeight).toFixed(1);
      const note = document.querySelector('.grams-note');
      if (note) note.textContent = `${S.md.grams}g au total`;
      break;
    }

    case 'saveEntry': {
      const { meal, idx, date, useUnits } = S.md;
      let grams;
      if (useUnits) {
        grams = S.md.grams;
      } else {
        const inp = document.getElementById('edit-qty-input');
        grams     = inp ? +inp.value : S.md.grams;
      }
      if (!grams || grams <= 0) { showToast('Quantité invalide.'); break; }
      const day = S.days[date];
      if (day?.meals[meal]?.[idx] !== undefined) {
        day.meals[meal][idx].grams = grams;
        save();
      }
      S.modal = null;
      S.md    = {};
      render();
      break;
    }

    case 'deleteEntry': {
      const { meal, idx, date } = S.md;
      const day = S.days[date];
      if (day?.meals[meal]) {
        day.meals[meal].splice(idx, 1);
        save();
      }
      S.modal = null;
      S.md    = {};
      render();
      break;
    }

    // ── Modal: Add food to database
    case 'openAddFoodDB':
      S.modal = 'addFoodDB';
      S.md    = {};
      render();
      setTimeout(() => document.getElementById('db-name')?.focus(), 80);
      break;

    case 'addFoodToDBFromSearch': {
      const { meal, date } = S.md;
      S.modal = 'addFoodDB';
      S.md    = { name: el.dataset.name, pendingMeal: meal, pendingDate: date };
      render();
      setTimeout(() => document.getElementById('db-kcal')?.focus(), 80);
      break;
    }

    case 'saveFoodDB': {
      const brand = document.getElementById('db-brand')?.value.trim() || '';
      const nom   = document.getElementById('db-name')?.value.trim()  || '';
      const kcal  = +document.getElementById('db-kcal')?.value;
      const p     = +document.getElementById('db-p')?.value    || 0;
      const g     = +document.getElementById('db-g')?.value    || 0;
      const l     = +document.getElementById('db-l')?.value    || 0;
      const uw    = +document.getElementById('db-unit')?.value || null;
      if (!nom)  { showToast('Donne un nom à l\'aliment.'); break; }
      if (!kcal) { showToast('Les calories sont requises.'); break; }
      const fullName = brand ? `${brand} — ${nom}` : nom;
      const food = { id: uid(), name: fullName, kcal, p, g, l, unitWeight: uw || null };
      S.foods.push(food);
      save();
      if (S.md.pendingMeal) {
        S.modal = 'addFood';
        S.md    = {
          meal:         S.md.pendingMeal,
          date:         S.md.pendingDate,
          selectedFood: food,
          useUnits:     !!food.unitWeight,
          qty:          food.unitWeight ? 1 : 100
        };
      } else {
        S.modal = null;
        S.md    = {};
      }
      showToast(`"${fullName}" ajouté à ta base !`);
      render();
      break;
    }

    // ── Modal: Edit food in database
    case 'editFoodDB':
      S.modal = 'editFoodDB';
      S.md    = { foodId: el.dataset.id };
      render();
      break;

    case 'updateFoodDB': {
      const id    = el.dataset.id;
      const f     = S.foods.find(x => x.id === id);
      if (!f) break;
      const brand = document.getElementById('db-brand')?.value.trim() || '';
      const nom   = document.getElementById('db-name')?.value.trim()  || '';
      if (!nom) { showToast('Le nom est requis.'); break; }
      f.name       = brand ? `${brand} — ${nom}` : nom;
      f.kcal       = +document.getElementById('db-kcal')?.value || f.kcal;
      f.p          = +document.getElementById('db-p')?.value    || 0;
      f.g          = +document.getElementById('db-g')?.value    || 0;
      f.l          = +document.getElementById('db-l')?.value    || 0;
      f.unitWeight = +document.getElementById('db-unit')?.value || null;
      save();
      S.modal = null;
      S.md    = {};
      showToast('Aliment mis à jour.');
      render();
      break;
    }

    case 'deleteFoodDB': {
      const id = el.dataset.id;
      S.foods  = S.foods.filter(x => x.id !== id);
      save();
      S.modal = null;
      S.md    = {};
      showToast('Aliment supprimé.');
      render();
      break;
    }

    // ── #2 — toggle meal collapse (ignore clicks on child buttons)
    case 'toggleMeal': {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) break;
      const key = el.dataset.colkey;
      if (!key) break;
      if (S.collapsedMeals[key]) delete S.collapsedMeals[key];
      else S.collapsedMeals[key] = true;
      render();
      break;
    }

    // ── #4 — sort foods
    case 'setFoodsSort':
      S.foodsSort = el.dataset.val;
      render();
      break;

    // ── #5 — not synced toast
    case 'showNotSynced':
      showToast('⚠️ Cet aliment n\'est pas dans foods.csv — non synchronisé');
      break;

    // ── #6 — select mode
    case 'toggleSelectMode':
      S.foodsSelect = !S.foodsSelect;
      S.foodsSelectedIds = [];
      render();
      break;

    case 'toggleSelectFood': {
      const fid = el.dataset.id;
      const fi  = (S.foodsSelectedIds||[]).indexOf(fid);
      if (fi > -1) S.foodsSelectedIds.splice(fi, 1);
      else S.foodsSelectedIds.push(fid);
      render();
      break;
    }

    case 'selectAllFoods':
      S.foodsSelectedIds = S.foods.map(f => f.id);
      render();
      break;

    case 'deleteSelectedFoods':
      if (!(S.foodsSelectedIds||[]).length) { showToast('Sélectionne au moins un aliment.'); break; }
      S.modal = 'deleteFoodConfirm';
      S.md    = { deleteIds: [...S.foodsSelectedIds] };
      render();
      break;

    // ── #7 — delete food with confirm
    case 'deleteFoodDB':
      S.modal = 'deleteFoodConfirm';
      S.md    = { ...S.md, deleteIds: [el.dataset.id] };
      render();
      break;

    case 'confirmDeleteFoodEverywhere': {
      const ids = S.md.deleteIds || [];
      for (const id of ids) {
        S.foods = S.foods.filter(x => x.id !== id);
        for (const day of Object.values(S.days))
          for (let m = 1; m <= 6; m++)
            if (day.meals[m]) day.meals[m] = day.meals[m].filter(e => e.foodId !== id);
      }
      save();
      S.modal = null; S.md = {};
      S.foodsSelect = false; S.foodsSelectedIds = [];
      showToast(`Supprimé${ids.length>1?' ('+ids.length+')'  :''} partout.`);
      render();
      break;
    }

    case 'confirmDeleteFoodKeepMeals': {
      const ids = S.md.deleteIds || [];
      S.foods = S.foods.filter(x => !ids.includes(x.id));
      save();
      S.modal = null; S.md = {};
      S.foodsSelect = false; S.foodsSelectedIds = [];
      showToast('Aliment retiré, repas conservés.');
      render();
      break;
    }

    // ── Settings
    case 'editGoals':
      S.settingsEdit = el.dataset.type;
      S.settingsTemp = { ...S.goals[el.dataset.type] };
      render();
      break;

    case 'saveGoals': {
      const type = el.dataset.type;
      document.querySelectorAll('.settings-input').forEach(inp => {
        S.goals[type][inp.dataset.key] = +inp.value || 0;
      });
      save();
      S.settingsEdit = null;
      showToast('Objectifs enregistrés.');
      render();
      break;
    }

    case 'cancelGoals':
      S.settingsEdit = null;
      render();
      break;

    // ── Copy meal
    case 'openCopyMeal':
      S.modal = 'copyMeal';
      S.md    = { meal: +el.dataset.meal, date: el.dataset.date };
      render();
      break;

    case 'confirmCopyMeal': {
      const { meal, date } = S.md;
      const destMeal = +el.dataset.destMeal;
      const destDate = el.dataset.destDate;
      const src  = S.days[date]?.meals[meal] || [];
      if (!src.length) { showToast('Repas vide.'); break; }
      const dest = getDay(destDate);
      for (const entry of src) {
        dest.meals[destMeal].push({ ...entry });
      }
      save();
      const destLabel = destDate === todayStr() ? "aujourd'hui" : destDate === tomorrowStr() ? 'demain' : fmtDateShort(destDate);
      showToast(`Repas ${meal} → Repas ${destMeal} (${destLabel}) ✓`);
      S.modal = null;
      S.md    = {};
      render();
      break;
    }

    // ── Export (new split)
    case 'exportHistoryCSV': exportHistoryCSV(); break;
    case 'exportHistoryJSON': exportHistoryJSON(); break;
    case 'exportFoodsCSV': exportFoodsCSV(); break;
    case 'exportFullJSON': exportFullJSON(); break;
    // legacy compat
    case 'exportCSV':  exportHistoryCSV(); break;
    case 'exportJSON': exportFullJSON();   break;

    // ── Barcode
    case 'scanBarcode': scanBarcode(); break;

    // ── #8 — AI prompt generator
    case 'copyAiPrompt': {
      const date    = el.dataset.date;
      const day     = S.days[date];
      if (!day) { showToast('Aucune donnée pour ce jour.'); break; }
      const goals   = S.goals[day.type];
      const totals  = calcMacros(allEntries(day));
      const remKcal = goals.kcal - totals.kcal;
      const remP    = +(goals.p - totals.p).toFixed(1);
      const remG    = +(goals.g - totals.g).toFixed(1);
      const remL    = +(goals.l - totals.l).toFixed(1);

      // Build food list per meal
      let mealsText = '';
      for (let m = 1; m <= 6; m++) {
        const entries = day.meals[m] || [];
        if (!entries.length) continue;
        mealsText += `\nRepas ${m} :\n`;
        for (const e of entries) {
          const f = S.foods.find(x => x.id === e.foodId);
          if (!f) continue;
          const qty = f.unitWeight ? `${+(e.grams/f.unitWeight).toFixed(1)} unité(s)` : `${e.grams}g`;
          const mc  = calcMacros([e]);
          mealsText += `  - ${f.name} (${qty}) → ${mc.kcal} kcal | P ${mc.p}g | G ${mc.g}g | L ${mc.l}g\n`;
        }
      }

      const typeLabel = day.type === 'sport' ? 'Sport' : 'Repos';
      const prompt = `Tu es un nutritionniste expert. Voici mon bilan nutritionnel du ${fmtDate(date)} (jour ${typeLabel}) :

OBJECTIFS DU JOUR :
- Calories : ${goals.kcal} kcal | Protéines : ${goals.p}g | Glucides : ${goals.g}g | Lipides : ${goals.l}g

DÉJÀ CONSOMMÉ :
- Calories : ${totals.kcal} kcal | Protéines : ${totals.p}g | Glucides : ${totals.g}g | Lipides : ${totals.l}g
${mealsText}
RESTE À COMBLER :
- Calories : ${remKcal} kcal | Protéines : ${remP}g | Glucides : ${remG}g | Lipides : ${remL}g

Propose-moi 5 idées de repas ou snacks simples et savoureux pour atteindre exactement mes objectifs restants. Pour chaque idée, indique les macros approximatives. Tiens compte de ce que j'ai déjà mangé pour varier les aliments.`;

      navigator.clipboard.writeText(prompt).then(() => {
        showToast('Prompt copié ! Colle-le dans ton IA 🤖');
      }).catch(() => {
        // Fallback: show in a temporary textarea
        const ta = document.createElement('textarea');
        ta.value = prompt;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Prompt copié ! Colle-le dans ton IA 🤖');
      });
      break;
    }

    // ── Foods tab sub-tab
    case 'setFoodsSubTab':
      S.foodsSubTab = el.dataset.val;
      S.foodsSearch = '';
      render();
      break;

    // ── Quick Add
    case 'openQuickAdd':
      S.modal = 'quickAdd';
      S.md    = { meal: +el.dataset.meal, date: el.dataset.date };
      render();
      setTimeout(() => document.getElementById('qa-name')?.focus(), 80);
      break;

    case 'confirmQuickAdd': {
      const { meal, date } = S.md;
      const name  = document.getElementById('qa-name')?.value.trim() || 'Ajout rapide';
      const kcal  = +document.getElementById('qa-kcal')?.value  || 0;
      const p     = +document.getElementById('qa-p')?.value     || 0;
      const g     = +document.getElementById('qa-g')?.value     || 0;
      const l     = +document.getElementById('qa-l')?.value     || 0;
      if (!kcal)  { showToast('Saisis au moins les calories.'); break; }
      // Create a virtual food item (100g = les macros saisies, quantity = 100g)
      const virtualFood = { id: uid(), name, kcal, p, g, l, unitWeight: null, _virtual: true };
      S.foods.push(virtualFood);
      const day = getDay(date);
      day.meals[meal].push({ foodId: virtualFood.id, grams: 100 });
      save();
      S.modal = null;
      S.md    = {};
      showToast(`"${name}" ajouté !`);
      render();
      break;
    }

    // ── Fav Meals: open add from meal header
    case 'openAddFavMeal':
      S.modal = 'addFavMeal';
      S.md    = { meal: +el.dataset.meal, date: el.dataset.date };
      render();
      break;

    case 'addFavMealToRepas': {
      const favMeal = S.meals.find(m => m.id === el.dataset.mealId);
      if (!favMeal) break;
      const { meal, date } = S.md;
      const day = getDay(date);
      if (favMeal._quick) {
        // Quick meal: 1 unit = 100g of virtual food (kcal/p/g/l are per 100g)
        const vf = { id: uid(), name: favMeal.name, kcal: favMeal.kcal, p: favMeal.p, g: favMeal.g, l: favMeal.l, unitWeight: 100, _virtual: true };
        S.foods.push(vf);
        day.meals[meal].push({ foodId: vf.id, grams: 100 }); // 1 unit = 100g
      } else {
        // Regular fav meal: compute totals, create virtual food with unitWeight=100
        // so it shows "1 u." and 1 unit = entire meal's macros
        const totals = calcMacros(favMeal.items);
        const vf = {
          id: uid(),
          name: favMeal.name,
          kcal: totals.kcal, // kcal for 100g = kcal of full meal (quantity will be 100g = 1 unit)
          p: totals.p,
          g: totals.g,
          l: totals.l,
          unitWeight: 100, // 1 unit = 100g
          _virtual: true
        };
        S.foods.push(vf);
        day.meals[meal].push({ foodId: vf.id, grams: 100 }); // 1 unit
      }
      save();
      S.modal = null; S.md = {};
      showToast(`"${favMeal.name}" ajouté au Repas ${meal} !`);
      render();
      break;
    }

    // ── #13 — Quick meal (macros-only fav meal)
    case 'openQuickMeal':
      S.modal = 'quickMeal';
      S.md    = {};
      render();
      setTimeout(() => document.getElementById('qm-name')?.focus(), 80);
      break;

    case 'openEditQuickMeal': {
      const qm = S.meals.find(x => x.id === el.dataset.id);
      if (!qm) break;
      S.modal = 'quickMeal';
      S.md    = { qmId: qm.id, qmName: qm.name, qmKcal: qm.kcal, qmP: qm.p, qmG: qm.g, qmL: qm.l };
      render();
      break;
    }

    case 'saveQuickMeal': {
      const name = document.getElementById('qm-name')?.value.trim();
      const kcal = +document.getElementById('qm-kcal')?.value || 0;
      const p    = +document.getElementById('qm-p')?.value    || 0;
      const g    = +document.getElementById('qm-g')?.value    || 0;
      const l    = +document.getElementById('qm-l')?.value    || 0;
      if (!name) { showToast('Donne un nom au repas.'); break; }
      if (!kcal) { showToast('Les calories sont requises.'); break; }
      if (S.md.qmId) {
        const qm = S.meals.find(x => x.id === S.md.qmId);
        if (qm) { qm.name = name; qm.kcal = kcal; qm.p = p; qm.g = g; qm.l = l; }
      } else {
        S.meals.push({ id: uid(), name, kcal, p, g, l, _quick: true, items: [] });
      }
      save();
      S.modal = null; S.md = {};
      showToast(`"${name}" enregistré !`);
      render();
      break;
    }

    case 'deleteQuickMeal': {
      S.meals = S.meals.filter(x => x.id !== el.dataset.id);
      save();
      S.modal = null; S.md = {};
      showToast('Repas supprimé.');
      render();
      break;
    }

    // ── Fav Meals: create/edit
    case 'openAddMeal':
      S.modal = 'addMeal';
      S.md    = { mealItems: [], mealName: '', mealSearchQ: '' };
      render();
      setTimeout(() => document.getElementById('meal-name')?.focus(), 80);
      break;

    case 'editMeal': {
      const m = S.meals.find(x => x.id === el.dataset.id);
      if (!m) break;
      S.modal = 'editMeal';
      S.md    = { mealId: m.id, mealName: m.name, mealItems: JSON.parse(JSON.stringify(m.items)), mealSearchQ: '' };
      render();
      break;
    }

    case 'selectMealIngredient': {
      const f = S.foods.find(x => x.id === el.dataset.id);
      if (!f) break;
      S.md.selectedIngredient = f;
      S.md.ingrQty = 100;
      render();
      setTimeout(() => document.getElementById('meal-ingr-qty')?.focus(), 80);
      break;
    }

    case 'confirmMealIngredient': {
      const qty = +document.getElementById('meal-ingr-qty')?.value || 100;
      if (!S.md.selectedIngredient) break;
      S.md.mealItems = S.md.mealItems || [];
      S.md.mealItems.push({ foodId: S.md.selectedIngredient.id, grams: qty });
      S.md.selectedIngredient = null;
      S.md.mealSearchQ = '';
      render();
      break;
    }

    case 'removeMealItem': {
      const idx = +el.dataset.idx;
      S.md.mealItems.splice(idx, 1);
      render();
      break;
    }

    case 'saveFavMeal': {
      const name  = document.getElementById('meal-name')?.value.trim();
      const items = S.md.mealItems || [];
      if (!name)        { showToast('Donne un nom au repas.'); break; }
      if (!items.length){ showToast('Ajoute au moins un ingrédient.'); break; }
      if (S.md.mealId) {
        const m = S.meals.find(x => x.id === S.md.mealId);
        if (m) { m.name = name; m.items = items; }
      } else {
        S.meals.push({ id: uid(), name, items });
      }
      save();
      S.modal = null;
      S.md    = {};
      showToast(`Repas "${name}" enregistré !`);
      render();
      break;
    }

    case 'deleteFavMeal': {
      const id = el.dataset.id;
      S.meals = S.meals.filter(x => x.id !== id);
      save();
      S.modal = null;
      S.md    = {};
      showToast('Repas supprimé.');
      render();
      break;
    }

    // ── Foods tab search
    case 'searchFoods': break;
  }
}

function handleInput(e) {
  const el = e.target;
  const a  = el.dataset.action;

  if (a === 'searchMealIngredient') {
    S.md.mealSearchQ = el.value;
    const q = S.md.mealSearchQ;
    const searchList = q.length >= 1
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase())).slice(0, 8)
      : [];
    const searchItems = searchList.map(f => `
      <div class="food-item" data-action="selectMealIngredient" data-id="${f.id}">
        <span class="food-item-name">${escHtml(f.name)}</span>
        <span class="food-item-kcal">${f.kcal} kcal</span>
      </div>`).join('');
    const fl = document.querySelector('.food-list');
    if (fl) fl.innerHTML = searchItems;
    return;
  }

  if (a === 'filterFoods') {
    S.searchQ = el.value;
    const q   = S.searchQ;
    // Re-render food list without full render to keep keyboard open
    const list = q.length >= 1
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
      : S.foods.slice().sort((a, b) => a.name.localeCompare(b, 'fr'));
    const items = list.map(f => `
    <div class="food-item" data-action="selectFood" data-id="${f.id}">
      <span class="food-item-name">${escHtml(f.name)}</span>
      <span class="food-item-kcal">${f.kcal} kcal/100g</span>
    </div>`).join('');
    const addNew = q
      ? `<button class="btn-add-new" data-action="addFoodToDBFromSearch"
           data-name="${escHtml(q)}">➕ Ajouter "${escHtml(q)}" à ma base</button>`
      : '';
    const fl = document.querySelector('.food-list');
    if (fl) {
      fl.innerHTML = items
        ? items + (q ? addNew : '')
        : (q ? addNew : '<p class="empty-state" style="padding:20px 0">Aucun résultat</p>');
      // No manual binding needed — #app delegated listener handles everything
    }
    return;
  }

  if (a === 'searchFoods') {
    S.foodsSearch = el.value;
    // Re-render only the food list section
    const q = S.foodsSearch;
    const filtered = q.length > 0
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
      : [...S.foods];
    filtered.sort((a, b) => a.name.localeCompare(b, 'fr'));
    const rows = filtered.map(f => `
    <div class="food-card" data-action="editFoodDB" data-id="${f.id}">
      <div class="food-name">${escHtml(f.name)}</div>
      <div class="food-macros">
        <span class="food-kcal">${f.kcal} kcal/100g</span>
        <span style="color:#7eb8f7">P ${f.p}g</span>
        <span style="color:#f0c040">G ${f.g}g</span>
        <span style="color:#e87070">L ${f.l}g</span>
        ${f.unitWeight ? `<span class="unit-badge">${f.unitWeight}g/u</span>` : ''}
      </div>
    </div>`).join('');
    // Replace all food-card elements
    const existing = document.querySelectorAll('.food-card, .view-foods .empty-state');
    existing.forEach(el => el.remove());
    const container = document.querySelector('.view-foods');
    if (container) {
      const div = document.createElement('div');
      div.innerHTML = rows || '<p class="empty-state">Aucun résultat.</p>';
      Array.from(div.children).forEach(child => container.appendChild(child));
    }
    return;
  }

  if (a === 'setQty') {
    S.md.qty = +el.value;
    updateMacrosPreview();
  }

  if (a === 'editSetQty') {
    S.md.grams = +el.value;
    updateMacrosPreview();
  }
}

function updateMacrosPreview() {
  const preview = document.getElementById('macros-preview');
  if (!preview) return;
  // Determine which food and grams
  let foodId, grams;
  if (S.modal === 'addFood' && S.md.selectedFood) {
    foodId = S.md.selectedFood.id;
    grams  = S.md.useUnits ? S.md.qty * S.md.selectedFood.unitWeight : S.md.qty;
  } else if (S.modal === 'editEntry') {
    const entry = S.days[S.md.date]?.meals[S.md.meal]?.[S.md.idx];
    if (!entry) return;
    foodId = entry.foodId;
    grams  = S.md.grams;
  }
  if (!foodId || !grams) return;
  const mc = calcMacros([{ foodId, grams }]);
  preview.innerHTML = `
    <span>${mc.kcal} kcal</span>
    <span style="color:#7eb8f7">P ${mc.p}g</span>
    <span style="color:#f0c040">G ${mc.g}g</span>
    <span style="color:#e87070">L ${mc.l}g</span>`;
}

// ── Export ────────────────────────────────────────────────────

function exportHistoryCSV() {
  const header = ['Date', 'Type', 'Calories', 'Protéines (g)', 'Glucides (g)', 'Lipides (g)'];
  const rows   = Object.entries(S.days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const t = calcMacros(allEntries(day));
      return [date, day.type, t.kcal, t.p, t.g, t.l].join(',');
    });
  const csv = [header.join(','), ...rows].join('\n');
  download('macros-historique.csv', csv, 'text/csv;charset=utf-8;');
  showToast('Historique CSV exporté !');
}

function exportHistoryJSON() {
  const data = { exportDate: new Date().toISOString(), days: S.days, goals: S.goals };
  download('macros-historique.json', JSON.stringify(data, null, 2), 'application/json');
  showToast('Historique JSON exporté !');
}

function exportFoodsCSV() {
  // Same format as foods.csv so it can be re-imported
  const header = 'Marque,Nom,Calories,Proteines,Glucides,Lipides,PoidsUnitaire';
  const rows = S.foods
    .filter(f => !f._virtual) // skip quick-add virtual entries
    .map(f => {
      const sep   = f.name.indexOf(' — ');
      const marque = sep > -1 ? f.name.slice(0, sep) : '';
      const nom    = sep > -1 ? f.name.slice(sep + 3) : f.name;
      return [marque, nom, f.kcal, f.p, f.g, f.l, f.unitWeight || ''].join(',');
    });
  const csv = [header, ...rows].join('\n');
  download('macros-aliments.csv', csv, 'text/csv;charset=utf-8;');
  showToast('Aliments CSV exporté !');
}

function exportFullJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    days:  S.days,
    foods: S.foods,
    meals: S.meals,
    goals: S.goals
  };
  download('macros-complet.json', JSON.stringify(data, null, 2), 'application/json');
  showToast('Export complet JSON téléchargé !');
}

function download(filename, content, mime) {
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ── Barcode Scanner ───────────────────────────────────────────

async function scanBarcode() {
  if (!('BarcodeDetector' in window)) {
    showToast('Scanner non disponible — entre le code manuellement.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const overlay = document.createElement('div');
    overlay.className = 'scanner-overlay';
    overlay.innerHTML = `
      <video id="scan-video" autoplay playsinline muted></video>
      <p>Pointe vers le code-barres…</p>
      <button id="scan-cancel">Annuler</button>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#scan-video').srcObject = stream;

    const stopScan = () => {
      clearInterval(timer);
      stream.getTracks().forEach(t => t.stop());
      overlay.remove();
    };
    overlay.querySelector('#scan-cancel').onclick = stopScan;

    const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
    const timer    = setInterval(async () => {
      const vid = overlay.querySelector('#scan-video');
      if (!vid || !vid.readyState >= 2) return;
      try {
        const barcodes = await detector.detect(vid);
        if (barcodes.length > 0) {
          stopScan();
          await fetchOpenFoodFacts(barcodes[0].rawValue);
        }
      } catch (_) { /* continue scanning */ }
    }, 500);

  } catch (err) {
    showToast('Caméra non accessible : ' + err.message);
  }
}

async function fetchOpenFoodFacts(barcode) {
  showToast('Recherche du produit…');
  try {
    const res  = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    if (data.status !== 1) {
      showToast('Produit non trouvé. Saisis les infos manuellement.');
      return;
    }
    const prod = data.product;
    const n    = prod.nutriments;
    const kcal = Math.round(
      n['energy-kcal_100g'] ||
      (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0)
    );
    const { meal, date } = S.md;
    S.modal = 'addFoodDB';
    S.md    = {
      name:        prod.product_name_fr || prod.product_name || `Produit ${barcode}`,
      kcal,
      p:           +(n['proteins_100g']       || 0).toFixed(1),
      g:           +(n['carbohydrates_100g']  || 0).toFixed(1),
      l:           +(n['fat_100g']            || 0).toFixed(1),
      pendingMeal: meal,
      pendingDate: date
    };
    render();
    showToast('Produit trouvé ! Vérifie les infos.');
  } catch (err) {
    showToast('Erreur réseau : ' + err.message);
  }
}

// ── Toast ─────────────────────────────────────────────────────

function showToast(msg) {
  // Remove existing toast
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className   = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => t.classList.add('toast-show'));
  });
  setTimeout(() => {
    t.classList.remove('toast-show');
    setTimeout(() => t.remove(), 300);
  }, 2800);
}

// ── CSV Loader ────────────────────────────────────────────────

async function loadCSVFoods() {
  try {
    const res = await fetch('./foods.csv');
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.trim().split('\n').slice(1); // skip header
    let added = 0;
    for (const line of lines) {
      // Handle commas inside quoted fields (basic)
      const cols = line.split(',');
      if (cols.length < 6) continue;
      const [marque, nom, kcal, p, g, l, uw] = cols.map(c => c.trim());
      if (!nom || !kcal) continue;
      const fullName = marque ? `${marque} — ${nom}` : nom;
      const existing = S.foods.find(f => f.name === fullName);
      if (existing) {
        // Already in localStorage — just ensure it's marked as from CSV
        if (!existing._fromCSV) { existing._fromCSV = true; added++; }
        continue;
      }
      S.foods.push({
        id:         uid(),
        name:       fullName,
        kcal:       +kcal  || 0,
        p:          +p     || 0,
        g:          +g     || 0,
        l:          +l     || 0,
        unitWeight: uw ? +uw : null,
        _fromCSV:   true
      });
      added++;
    }
    if (added > 0) {
      save();
    }
  } catch (err) {
    console.warn('[Macros] Impossible de charger foods.csv :', err);
  }
}

// ── Init ──────────────────────────────────────────────────────

async function init() {
  load();
  S.viewDate = todayStr();
  getDay(S.viewDate);
  render();
  renderNav();
  bindEvents();
  await loadCSVFoods();
  if (S.tab === 'foods') render();

  // #11 — auto-refresh when date changes (check every 30s)
  let _lastDate = todayStr();
  setInterval(() => {
    const now = todayStr();
    if (now !== _lastDate) {
      _lastDate = now;
      S.viewDate = now;
      getDay(now);
      render();
      renderNav();
    }
  }, 30000);
}

document.addEventListener('DOMContentLoaded', init);