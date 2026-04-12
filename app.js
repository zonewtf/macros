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
  tab:         'today',
  viewDate:    '',           // date shown in today tab
  histSub:     'list',       // 'list' | 'edit'
  editDate:    null,         // date being edited in history
  modal:       null,         // null | 'addFood' | 'editEntry' | 'addFoodDB' | 'editFoodDB'
  md:          {},           // modal context data
  searchQ:     '',           // food search in modal
  foodsSearch: '',           // food search in foods tab
  settingsEdit: null,        // null | 'sport' | 'rest'
  settingsTemp: {},
  days:        {},
  foods:       [],
  goals:       {}
};

// ── Storage ──────────────────────────────────────────────────

function load() {
  S.days  = JSON.parse(localStorage.getItem('macros_days')  || '{}');
  S.foods = JSON.parse(localStorage.getItem('macros_foods') || '[]');
  S.goals = JSON.parse(localStorage.getItem('macros_goals') || JSON.stringify(DEFAULT_GOALS));
  // Ensure goals have both types
  if (!S.goals.sport) S.goals.sport = { ...DEFAULT_GOALS.sport };
  if (!S.goals.rest)  S.goals.rest  = { ...DEFAULT_GOALS.rest  };
}

function save() {
  localStorage.setItem('macros_days',  JSON.stringify(S.days));
  localStorage.setItem('macros_foods', JSON.stringify(S.foods));
  localStorage.setItem('macros_goals', JSON.stringify(S.goals));
}

// ── Date Helpers ─────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
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

function uid() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
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
  const color = over ? '#e87070' : '#c8d8f0';
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
       </div>`
    : `<div class="day-header">
         <button class="btn-back" data-action="back">← Retour</button>
         <button class="btn-toggle" data-action="toggleType" data-date="${date}">${badge}</button>
       </div>
       <h2 class="day-title">${isTomorrow ? 'Demain — ' : ''}${fmtDate(date)}</h2>`;

  const overAlert = (totals.kcal > goals.kcal || totals.p > goals.p || totals.g > goals.g || totals.l > goals.l)
    ? `<div class="over-alert">⚠️ Un ou plusieurs objectifs sont dépassés</div>` : '';

  const summary = `
  <div class="summary-card">
    ${renderRing(totals.kcal, goals.kcal)}
    <div class="macros-detail">
      ${renderBar('Protéines', totals.p, goals.p, '#c8d8f0')}
      ${renderBar('Glucides',  totals.g, goals.g, '#f0c040')}
      ${renderBar('Lipides',   totals.l, goals.l, '#e87070')}
      <div class="pills-row">
        ${renderPill('P', totals.p, goals.p, '#c8d8f0')}
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
    mealsHtml += `
    <div class="meal-section">
      <div class="meal-header">
        <span class="meal-title">Repas ${m}</span>
        <span class="meal-kcal">${hasFood ? mTotals.kcal + ' kcal' : ''}</span>
        <button class="btn-add-meal" data-action="openAddFood" data-meal="${m}" data-date="${date}">+ Ajouter</button>
      </div>
      ${entriesHtml}
    </div>`;
  }
  mealsHtml += '</div>';

  const tomorrowBtn = isToday
    ? `<button class="btn-tomorrow" data-action="viewTomorrow">Planifier demain →</button>`
    : '';

  return `
  <div class="view-day">
    ${header}
    ${overAlert}
    ${summary}
    ${mealsHtml}
    ${tomorrowBtn}
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
      <span class="pill-sm" style="color:#c8d8f0">P ${tomT.p}g</span>
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
    return `
    <div class="hist-card">
      <div class="hist-card-head">
        <span class="hist-date">${fmtDate(d)}</span>
        ${badge}
        <button class="btn-edit-sm" data-action="editHistDay" data-date="${d}">✎ Modifier</button>
      </div>
      <div class="hist-macros">
        <span class="hist-kcal">${totals.kcal} kcal</span>
        <span class="pill-sm" style="color:#c8d8f0">P ${totals.p}g</span>
        <span class="pill-sm" style="color:#f0c040">G ${totals.g}g</span>
        <span class="pill-sm" style="color:#e87070">L ${totals.l}g</span>
      </div>
      <div class="hist-bar-track">
        <div class="hist-bar-fill" style="width:${pct}%"></div>
      </div>
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
  const q        = S.foodsSearch || '';
  const filtered = q.length > 0
    ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()))
    : [...S.foods];
  filtered.sort((a, b) => a.name.localeCompare(b, 'fr'));

  const rows = filtered.map(f => `
  <div class="food-card" data-action="editFoodDB" data-id="${f.id}">
    <div class="food-name">${escHtml(f.name)}</div>
    <div class="food-macros">
      <span class="food-kcal">${f.kcal} kcal/100g</span>
      <span style="color:#c8d8f0">P ${f.p}g</span>
      <span style="color:#f0c040">G ${f.g}g</span>
      <span style="color:#e87070">L ${f.l}g</span>
      ${f.unitWeight ? `<span class="unit-badge">${f.unitWeight}g/u</span>` : ''}
    </div>
  </div>`).join('');

  return `
  <div class="view-foods">
    <div class="foods-header">
      <h2>Aliments</h2>
      <button class="btn-primary-sm" data-action="openAddFoodDB">+ Nouveau</button>
    </div>
    <input class="search-input" type="search" placeholder="Rechercher dans ma base…"
      value="${escHtml(q)}" data-action="searchFoods" autocomplete="off">
    ${rows || '<p class="empty-state">Aucun aliment.<br>Appuie sur <strong>+ Nouveau</strong> pour commencer !</p>'}
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
        <span style="color:#c8d8f0">P ${g.p}g</span>
        <span style="color:#f0c040">G ${g.g}g</span>
        <span style="color:#e87070">L ${g.l}g</span>
      </div>
    </div>`;
  }).join('');

  // C'est ici qu'on assemble tout le HTML final
  return `
  <div class="view-settings">
    <h2>Réglages</h2>
    
    ${blocks}

    <div class="settings-block">
      <div class="settings-block-head">
        <span class="settings-label">Export des données</span>
      </div>
      <div class="export-row">
        <button class="btn-export" data-action="exportCSV">⬇ Exporter CSV</button>
        <button class="btn-export" data-action="exportJSON">⬇ Exporter JSON</button>
      </div>
    </div>

    <div style="margin-top: 32px; text-align: center; padding-bottom: 20px;">
      <div style="color: #555; font-size: 12px; font-weight: 500;">
        MES MACROS — Version 6.0
      </div>
      <div style="color: #333; font-size: 10px; margin-top: 4px;">
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

    const addNew = q
      ? `<button class="btn-add-new" data-action="addFoodToDBFromSearch"
           data-name="${escHtml(q)}">➕ Ajouter "${escHtml(q)}" à ma base</button>`
      : '';

    return `
    <h3 class="modal-title">Repas ${meal}</h3>
    <input id="food-search" class="search-input" type="search"
      placeholder="Rechercher un aliment…" value="${escHtml(q)}"
      data-action="filterFoods" autocomplete="off" autocorrect="off">
    <div class="food-list">
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
      <span style="color:#c8d8f0">P ${mc.p}g</span>
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
    <span style="color:#c8d8f0">P ${mc.p}g</span>
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

    // ── Export
    case 'exportCSV':  exportCSV();  break;
    case 'exportJSON': exportJSON(); break;

    // ── Barcode
    case 'scanBarcode': scanBarcode(); break;

    // ── Foods tab search
    case 'searchFoods': break; // handled in handleInput
  }
}

function handleInput(e) {
  const el = e.target;
  const a  = el.dataset.action;

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
        <span style="color:#c8d8f0">P ${f.p}g</span>
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
    <span style="color:#c8d8f0">P ${mc.p}g</span>
    <span style="color:#f0c040">G ${mc.g}g</span>
    <span style="color:#e87070">L ${mc.l}g</span>`;
}

// ── Export ────────────────────────────────────────────────────

function exportCSV() {
  const header = ['Date', 'Type', 'Calories', 'Protéines (g)', 'Glucides (g)', 'Lipides (g)'];
  const rows   = Object.entries(S.days)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const t = calcMacros(allEntries(day));
      return [date, day.type, t.kcal, t.p, t.g, t.l].join(',');
    });
  const csv = [header.join(','), ...rows].join('\n');
  download('macros-export.csv', csv, 'text/csv;charset=utf-8;');
  showToast('Export CSV téléchargé !');
}

function exportJSON() {
  const data = {
    exportDate: new Date().toISOString(),
    days:  S.days,
    foods: S.foods,
    goals: S.goals
  };
  download('macros-export.json', JSON.stringify(data, null, 2), 'application/json');
  showToast('Export JSON téléchargé !');
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
      if (S.foods.some(f => f.name === fullName)) continue;
      S.foods.push({
        id:         uid(),
        name:       fullName,
        kcal:       +kcal  || 0,
        p:          +p     || 0,
        g:          +g     || 0,
        l:          +l     || 0,
        unitWeight: uw ? +uw : null
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
  bindEvents(); // single call — event delegation on #app
  // Load CSV in background — re-render foods tab if needed
  await loadCSVFoods();
  if (S.tab === 'foods') render();
}

document.addEventListener('DOMContentLoaded', init);