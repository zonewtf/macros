// ============================================================
// render-modals.js — Toutes les fenêtres modales de l'app
// (ajout/édition d'aliments, repas favoris, exports, etc.)
// Dépend de helpers.js, state.js (S), render-foods/today
// pour certaines données de contexte.
// ============================================================

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
    case 'quickMeal':   content = renderQuickMealModal();   break;
    case 'burnedInput':    content = renderBurnedInputModal();    break;
    case 'exportPeriod':   content = renderExportPeriodModal();   break;
    case 'dayEstimate': content = renderDayEstimateModal(); break;
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
      <span class="food-item-kcal">${f.kcal} kcal</span>
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
      <div class="recent-divider"></div>`;
    }

    // "Tous les aliments" label — shown once only when there are sections above
    const allLabel = (!q && (recentSection || favSection))
      ? `<div class="recent-label">Tous les aliments</div>`
      : '';

    const addNew = q
      ? `<button class="btn-add-new" data-action="addFoodToDBFromSearch"
           data-name="${escHtml(q)}">➕ Ajouter "${escHtml(q)}" à ma base</button>`
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
  const photoPreview = d.photo
    ? `<img src="${d.photo}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;display:block;margin-bottom:8px">`
    : '';
  return `
  <h3 class="modal-title">Nouvel aliment</h3>

  <div class="food-photo-wrap">
    ${photoPreview}
    <label class="btn-photo-pick">
      ${d.photo ? '🔄 Changer la photo' : '📷 Ajouter une photo'}
      <input type="file" accept="image/*" capture="environment" id="db-photo-input" style="display:none" data-action="pickFoodPhoto">
    </label>
  </div>

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

  <div class="calc-toggle-wrap">
    <span class="calc-toggle-label">Valeurs indiquées pour</span>
    <div class="calc-toggle-btns">
      <button class="calc-btn ${!d.calcMode ? 'active' : ''}" data-action="setCalcMode" data-val="100">100g</button>
      <button class="calc-btn ${d.calcMode ? 'active' : ''}" data-action="setCalcMode" data-val="custom">Autre quantité</button>
    </div>
  </div>

  ${d.calcMode ? `
  <div class="form-group">
    <label>Quantité de référence sur le paquet (g)</label>
    <input type="number" class="form-input" id="db-ref-qty"
      value="${d.refQty || ''}" placeholder="ex : 70" inputmode="decimal"
      data-action="recalcPer100g">
  </div>
  <p style="font-size:12px;color:#666;margin:-8px 0 12px">Saisis les valeurs pour ${d.refQty || 'X'}g ci-dessous → l'app les convertira pour 100g</p>
  ` : ''}

  <div class="form-group">
    <label>Calories (kcal ${d.calcMode ? `pour ${d.refQty || '…'}g` : 'pour 100g'})</label>
    <input type="number" class="form-input" id="db-kcal"
      value="${d.kcal || ''}" placeholder="165" inputmode="decimal"
      ${d.calcMode ? 'data-action="recalcPer100g"' : ''}>
  </div>
  <div class="form-row-3">
    <div class="form-group">
      <label>Protéines (g)</label>
      <input type="number" class="form-input" id="db-p"
        value="${d.p || ''}" placeholder="31" inputmode="decimal"
        ${d.calcMode ? 'data-action="recalcPer100g"' : ''}>
    </div>
    <div class="form-group">
      <label>Glucides (g)</label>
      <input type="number" class="form-input" id="db-g"
        value="${d.g || ''}" placeholder="0" inputmode="decimal"
        ${d.calcMode ? 'data-action="recalcPer100g"' : ''}>
    </div>
    <div class="form-group">
      <label>Lipides (g)</label>
      <input type="number" class="form-input" id="db-l"
        value="${d.l || ''}" placeholder="3.6" inputmode="decimal"
        ${d.calcMode ? 'data-action="recalcPer100g"' : ''}>
    </div>
  </div>

  ${d.calcMode && d.refQty && (d.kcal || d.p || d.g || d.l) ? `
  <div class="calc-preview">
    <span style="font-size:12px;color:#7eb8f7;font-weight:600">= Pour 100g :</span>
    <span>${d.kcal ? Math.round(d.kcal * 100 / d.refQty) + ' kcal' : ''}</span>
    ${d.p ? `<span style="color:#7eb8f7">P ${+(d.p * 100 / d.refQty).toFixed(1)}g</span>` : ''}
    ${d.g ? `<span style="color:#f0c040">G ${+(d.g * 100 / d.refQty).toFixed(1)}g</span>` : ''}
    ${d.l ? `<span style="color:#e87070">L ${+(d.l * 100 / d.refQty).toFixed(1)}g</span>` : ''}
  </div>
  ` : ''}

  <div class="form-group" style="margin-top:4px">
    <label>Poids unitaire (g/unité) — optionnel</label>
    <input type="number" class="form-input" id="db-unit"
      value="${d.unitWeight || ''}" placeholder="ex : 120 pour un œuf entier" inputmode="decimal">
  </div>
  <div class="form-group">
    <label>Code-barres — optionnel</label>
    <input type="text" class="form-input" id="db-barcode"
      value="${escHtml(d.barcode || '')}" placeholder="ex : 8801234567890" inputmode="numeric" autocomplete="off">
  </div>
  <button class="btn-confirm nav-spacer" data-action="saveFoodDB">Enregistrer dans ma base</button>`;
}

function renderEditFoodDBModal() {
  const f = S.foods.find(x => x.id === S.md.foodId);
  if (!f) return '<p style="padding:20px;color:#888">Introuvable.</p>';
  const sep   = f.name.indexOf(' — ');
  const brand = sep > -1 ? f.name.slice(0, sep) : '';
  const nom   = sep > -1 ? f.name.slice(sep + 3) : f.name;
  const photoPreview = f.photo
    ? `<img src="${f.photo}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;display:block;margin-bottom:8px">`
    : '';
  return `
  <h3 class="modal-title">Modifier un aliment</h3>

  <div class="food-photo-wrap">
    ${photoPreview}
    <label class="btn-photo-pick">
      ${f.photo ? '🔄 Changer la photo' : '📷 Ajouter une photo'}
      <input type="file" accept="image/*" capture="environment" id="db-photo-input" style="display:none" data-action="pickFoodPhoto">
    </label>
    ${f.photo ? `<button class="btn-photo-remove" data-action="removeFoodPhoto" data-id="${f.id}">✕ Supprimer</button>` : ''}
  </div>

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
  <div class="form-group">
    <label>Code-barres — optionnel</label>
    <input type="text" class="form-input" id="db-barcode"
      value="${escHtml(f.barcode || '')}" placeholder="ex : 8801234567890" inputmode="numeric" autocomplete="off">
  </div>
  <div class="modal-edit-actions nav-spacer">
    <button class="btn-delete" data-action="deleteFoodDB" data-id="${f.id}">Supprimer</button>
    <button class="btn-confirm" data-action="updateFoodDB" data-id="${f.id}">Enregistrer</button>
  </div>`;
}

// ── Modal: Day Estimation ────────────────────────────────────

function renderDayEstimateModal() {
  const date = S.md.date || '';
  const day  = S.days[date];
  const est  = day?.estimated;
  return `
  <h3 class="modal-title">~ Estimer ma journée</h3>
  <p style="font-size:13px;color:#666;margin-bottom:16px;line-height:1.5">
    Tu n'as pas journalisé ce jour. Rentre une estimation globale — elle sera utilisée dans les statistiques avec un badge "Estimé".
  </p>
  <div class="form-group">
    <label>Calories estimées (kcal)</label>
    <input type="number" class="form-input" id="est-kcal"
      value="${est?.kcal || ''}" placeholder="ex : 2100" inputmode="decimal">
  </div>
  <div class="form-row-3">
    <div class="form-group">
      <label>Protéines (g)</label>
      <input type="number" class="form-input" id="est-p"
        value="${est?.p || ''}" placeholder="150" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Glucides (g)</label>
      <input type="number" class="form-input" id="est-g"
        value="${est?.g || ''}" placeholder="200" inputmode="decimal">
    </div>
    <div class="form-group">
      <label>Lipides (g)</label>
      <input type="number" class="form-input" id="est-l"
        value="${est?.l || ''}" placeholder="70" inputmode="decimal">
    </div>
  </div>
  <div class="modal-edit-actions nav-spacer">
    ${est ? `<button class="btn-delete" data-action="clearDayEstimate">Supprimer</button>` : ''}
    <button class="btn-confirm ${est ? '' : 'nav-spacer'}" data-action="saveDayEstimate">Enregistrer</button>
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
          <span class="entry-macro-p">P ${+(f.p * it.grams / 100).toFixed(1)}g ${macroPct(f.kcal * it.grams / 100, f.p * it.grams / 100, 4)}</span>
          <span class="entry-macro-g">G ${+(f.g * it.grams / 100).toFixed(1)}g ${macroPct(f.kcal * it.grams / 100, f.g * it.grams / 100, 4)}</span>
          <span class="entry-macro-l">L ${+(f.l * it.grams / 100).toFixed(1)}g ${macroPct(f.kcal * it.grams / 100, f.l * it.grams / 100, 9)}</span>
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

  const mealBtns = [1,2,3,4,5,6,7,8,9,10].map(n => `
    <button class="copy-meal-btn ${n === meal ? 'copy-meal-btn-self' : ''}"
      data-action="confirmCopyMeal" data-dest-meal="${n}" data-dest-date="${date}">
      Repas ${n}${n === meal ? ' ●' : ''}
    </button>`).join('');

  const otherDate = isToday ? tomorrowStr() : todayStr();
  const otherLabel = isToday ? 'demain' : "aujourd'hui";
  const otherMealBtns = [1,2,3,4,5,6,7,8,9,10].map(n => `
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

// ── Modal: Export Period ─────────────────────────────────────

function renderExportPeriodModal() {
  const { period, from, to } = S.md;
  const today = todayStr();

  // Count matching days
  const count = Object.keys(S.days).filter(d => {
    const day = S.days[d];
    if (d >= today) return false;
    if (isDayEmpty(day)) return false;
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  }).length;

  const periodLabels = { week: 'Cette semaine', month: 'Ce mois', '30': '30 derniers jours', all: 'Tout l\'historique', custom: 'Période personnalisée' };

  const dateFields = period === 'custom' ? `
  <div class="form-row" style="gap:10px;margin-bottom:14px">
    <div class="form-group" style="flex:1">
      <label>Du</label>
      <input type="date" class="form-input" id="export-from" value="${from || ''}" max="${today}">
    </div>
    <div class="form-group" style="flex:1">
      <label>Au</label>
      <input type="date" class="form-input" id="export-to" value="${to}" max="${today}">
    </div>
  </div>` : `<p style="font-size:13px;color:#888;margin-bottom:16px">${periodLabels[period]} · <strong style="color:#e8e8e8">${count} jour${count>1?'s':''}</strong> journalisé${count>1?'s':''}</p>`;

  const customUpdate = period === 'custom' ? `
  <button class="sort-btn" style="width:100%;margin-bottom:12px" data-action="refreshExportCount">Calculer</button>` : '';

  return `
  <h3 class="modal-title">Exporter l'historique</h3>
  <p style="font-size:12px;color:#666;margin-bottom:12px">${periodLabels[period]}</p>
  ${dateFields}
  ${customUpdate}
  <div style="font-size:12px;color:#666;margin-bottom:10px">Choisir le format</div>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:69px">
    <button class="btn-export" style="text-align:left;padding:12px 14px" data-action="doExport" data-fmt="csv">
      <span style="font-weight:600">⬇ CSV</span> <span style="color:#666;font-size:12px">— tableur Excel / Numbers</span>
    </button>
    <button class="btn-export" style="text-align:left;padding:12px 14px" data-action="doExport" data-fmt="json">
      <span style="font-weight:600">⬇ JSON</span> <span style="color:#666;font-size:12px">— données complètes structurées</span>
    </button>
    <button class="btn-export" style="text-align:left;padding:12px 14px;border-color:rgba(126,184,247,0.2);color:#7eb8f7" data-action="doExport" data-fmt="md">
      <span style="font-weight:600">🤖 Markdown</span> <span style="color:#666;font-size:12px">— pour analyse IA</span>
    </button>
  </div>`;
}

function renderBurnedInputModal() {
  const date   = S.md.date || '';
  const burned = S.days[date]?.burned;
  return `
  <h3 class="modal-title">⌚ Calories dépensées</h3>
  <p style="font-size:13px;color:#666;margin-bottom:16px">Entre le total de calories actives brûlées d'après ton Apple Watch pour le ${fmtDate(date)}.</p>
  <div class="form-group">
    <label>Calories dépensées (kcal)</label>
    <input type="number" class="form-input" id="burned-input"
      value="${burned || ''}" placeholder="ex : 480" inputmode="decimal">
  </div>
  <button class="btn-confirm nav-spacer" data-action="saveBurned">Enregistrer</button>`;
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