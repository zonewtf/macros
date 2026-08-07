// ============================================================
// render-foods.js — Affichage de l'onglet "Aliments"
// (sous-onglets : Aliments / Repas favoris)
// Dépend de helpers.js (macroPct, foodUseCount, escHtml…) et
// state.js (S).
// ============================================================

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
  const syncDismissed = S.syncWarningDismissed || false;
  const syncBanner = (!syncDismissed && unsynced > 0)
    ? `<div class="sync-warning" style="display:flex;align-items:center;justify-content:space-between;gap:8px">
         <span>⚠️ ${unsynced} aliment${unsynced>1?'s':''} ajouté${unsynced>1?'s':''} manuellement — pense à mettre à jour foods.csv depuis ton ordi</span>
         <button style="flex-shrink:0;color:#f0c040;font-size:16px;padding:0 4px;background:none;border:none" data-action="dismissSyncWarning">✕</button>
       </div>`
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
  } else if (sort === 'prot') {
    filtered.sort((a, b) => (b.kcal > 0 ? b.p*4/b.kcal : 0) - (a.kcal > 0 ? a.p*4/a.kcal : 0));
  } else if (sort === 'gluc') {
    filtered.sort((a, b) => (b.kcal > 0 ? b.g*4/b.kcal : 0) - (a.kcal > 0 ? a.g*4/a.kcal : 0));
  } else if (sort === 'lip') {
    filtered.sort((a, b) => (b.kcal > 0 ? b.l*9/b.kcal : 0) - (a.kcal > 0 ? a.l*9/a.kcal : 0));
  }

  const rows = filtered.map(f => {
    const isSel  = selIds.includes(f.id);
    const notCSV = !f._fromCSV;
    const cnt    = sort === 'used' ? foodUseCount(f.id) : null;
    return `
    <div class="food-card ${selMode && isSel ? 'food-card-selected' : ''}"
      data-action="${selMode ? 'toggleSelectFood' : 'editFoodDB'}" data-id="${f.id}">
      ${selMode ? `<span class="food-select-box">${isSel ? '✓' : ''}</span>` : ''}
      ${f.photo ? `<img src="${f.photo}" class="food-thumb js-view-photo" alt="">` : ''}
      <div class="food-card-body">
        <div class="food-name">${escHtml(f.name)}</div>
        <div class="food-macros">
          <span class="food-kcal">${f.kcal} kcal</span>
          <span style="color:#7eb8f7">P ${f.p}g ${macroPct(f.kcal, f.p, 4)}</span>
          <span style="color:#f0c040">G ${f.g}g ${macroPct(f.kcal, f.g, 4)}</span>
          <span style="color:#e87070">L ${f.l}g ${macroPct(f.kcal, f.l, 9)}</span>
          ${cnt !== null ? `<span class="unit-badge" style="color:#f0c040">${cnt}×</span>` : ''}
          ${f.barcode ? `<span class="unit-badge" style="color:#555">🔖 ${f.barcode}</span>` : ''}
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
      <button class="sort-btn ${sort==='prot'   ? 'active':''}" data-action="setFoodsSort" data-val="prot" style="color:#7eb8f7">P%↓</button>
      <button class="sort-btn ${sort==='gluc'   ? 'active':''}" data-action="setFoodsSort" data-val="gluc" style="color:#f0c040">G%↓</button>
      <button class="sort-btn ${sort==='lip'    ? 'active':''}" data-action="setFoodsSort" data-val="lip"  style="color:#e87070">L%↓</button>
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