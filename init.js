// ============================================================
// init.js — Point d'entrée de l'application
// Contient le routeur léger handleClick (qui chaîne les 4
// gestionnaires handlers-*.js), handleInput, updateMacrosPreview,
// bindEvents, showToast, et init() — appelée au DOMContentLoaded.
//
// Doit être chargé EN DERNIER (après tous les autres scripts),
// puisque c'est lui qui démarre réellement l'application.
// ============================================================

// ── Routeur principal des clics ──────────────────────────────
// Remplace l'ancien switch unique de 882 lignes : chaque
// handleXxxAction() ci-dessous (définie dans son propre fichier
// handlers-*.js) retourne true si elle a traité l'action — dans
// ce cas on arrête la chaîne, sinon on essaie le fichier suivant.

function handleClick(e) {
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;

  if (handleTodayAction(a, el, e))          return;
  if (handleFoodsAction(a, el, e))          return;
  if (handleModalsAction(a, el, e))         return;
  if (handleSettingsExportAction(a, el, e)) return;
  // Si aucune des 4 fonctions ci-dessus n'a reconnu l'action,
  // on ne fait rien (comportement identique à l'ancien switch
  // sans case correspondant).
}

// ── Gestion des événements "input" (saisie en temps réel) ────

function handleInput(e) {
  const el = e.target;
  const a  = el.dataset.action;

  if (a === 'searchMealIngredient') {
    S.md.mealSearchQ = el.value;
    const q = S.md.mealSearchQ;
    const searchList = q.length >= 1
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()) || (f.barcode && f.barcode.includes(q))).slice(0, 8)
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

  // Photo picker — compress to 80x80 WebP base64
  if (el.id === 'db-photo-input' && el.files?.[0]) {
    const file = el.files[0];
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const SIZE = 200;
        const canvas = document.createElement('canvas');
        canvas.width  = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext('2d');
        // Cover crop: center-crop to square then draw at 200x200
        const side = Math.min(img.width, img.height);
        const sx   = (img.width  - side) / 2;
        const sy   = (img.height - side) / 2;
        ctx.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
        // WebP at 0.88 quality — ~20-40KB typically
        const base64 = canvas.toDataURL('image/webp', 0.88);
        S.md.photo = base64;
        // Re-render the modal to show preview (keeps all other field values)
        render();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    el.value = ''; // reset so same file can be picked again
    return;
  }

  if (a === 'restoreFromFile') {
    const file = el.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        // Validate structure
        if (!data.days || !data.foods || !data.goals) {
          showToast('❌ Fichier invalide ou corrompu.');
          return;
        }
        // Confirm before overwriting
        if (!confirm(`Restaurer la sauvegarde du ${new Date(data.backupDate || 0).toLocaleDateString('fr-FR')} ?\n\nToutes tes données actuelles seront remplacées.`)) return;
        S.days  = data.days  || {};
        S.foods = data.foods || [];
        S.meals = data.meals || [];
        S.goals = data.goals || {};
        if (!S.goals.sport) S.goals.sport = { ...DEFAULT_GOALS.sport };
        if (!S.goals.rest)  S.goals.rest  = { ...DEFAULT_GOALS.rest };
        save();
        showToast('✅ Données restaurées avec succès !');
        render();
        renderNav();
      } catch {
        showToast('❌ Impossible de lire le fichier.');
      }
    };
    reader.readAsText(file);
    el.value = ''; // reset so same file can be picked again
    return;
  }

  if (a === 'searchHistory') {
    S.histSearch = el.value;
    render(); // full re-render to filter
    // Keep focus after render
    setTimeout(() => {
      const inp = document.querySelector('[data-action="searchHistory"]');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }, 10);
    return;
  }

  if (a === 'recalcPer100g') {
    // Sync md with current field values and re-render preview
    const refQty = +document.getElementById('db-ref-qty')?.value || S.md.refQty;
    S.md.refQty = refQty || null;
    S.md.kcal   = +document.getElementById('db-kcal')?.value || null;
    S.md.p      = +document.getElementById('db-p')?.value    || null;
    S.md.g      = +document.getElementById('db-g')?.value    || null;
    S.md.l      = +document.getElementById('db-l')?.value    || null;
    // Only re-render the preview block, not the whole modal (to keep keyboard open)
    const preview = document.querySelector('.calc-preview');
    // Update labels
    document.querySelectorAll('[id^="db-kcal"], [id^="db-p"], [id^="db-g"], [id^="db-l"]').forEach(inp => {
      const label = inp.closest('.form-group')?.querySelector('label');
      if (label && S.md.calcMode) {
        const base = inp.id === 'db-kcal' ? 'Calories (kcal' : inp.id === 'db-p' ? 'Protéines (g' : inp.id === 'db-g' ? 'Glucides (g' : 'Lipides (g';
        label.textContent = `${base} pour ${S.md.refQty || '…'}g)`;
      }
    });
    // Rebuild preview inline without full render
    if (S.md.refQty && (S.md.kcal || S.md.p || S.md.g || S.md.l)) {
      const r = 100 / S.md.refQty;
      const html = `
        <span style="font-size:12px;color:#7eb8f7;font-weight:600">= Pour 100g :</span>
        <span>${S.md.kcal ? Math.round(S.md.kcal * r) + ' kcal' : ''}</span>
        ${S.md.p ? `<span style="color:#7eb8f7">P ${+(S.md.p * r).toFixed(1)}g</span>` : ''}
        ${S.md.g ? `<span style="color:#f0c040">G ${+(S.md.g * r).toFixed(1)}g</span>` : ''}
        ${S.md.l ? `<span style="color:#e87070">L ${+(S.md.l * r).toFixed(1)}g</span>` : ''}`;
      if (preview) {
        preview.innerHTML = html;
      } else {
        // Insert preview before unit field
        const unitGroup = document.querySelector('#db-unit')?.closest('.form-group');
        if (unitGroup) {
          const div = document.createElement('div');
          div.className = 'calc-preview';
          div.innerHTML = html;
          unitGroup.before(div);
        }
      }
    } else if (preview) {
      preview.innerHTML = '';
    }
    return;
  }

  if (a === 'filterFoods') {
    S.searchQ = el.value;
    const q   = S.searchQ;
    // Re-render food list without full render to keep keyboard open
    const list = q.length >= 1
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()) || (f.barcode && f.barcode.includes(q)))
      : S.foods.slice().sort((a, b) => a.name.localeCompare(b, 'fr'));
    const items = list.map(f => `
    <div class="food-item" data-action="selectFood" data-id="${f.id}">
      <span class="food-item-name">${escHtml(f.name)}</span>
      <span class="food-item-kcal">${f.kcal} kcal</span>
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
      ? S.foods.filter(f => f.name.toLowerCase().includes(q.toLowerCase()) || (f.barcode && f.barcode.includes(q)))
      : [...S.foods];
    filtered.sort((a, b) => a.name.localeCompare(b, 'fr'));
    const rows = filtered.map(f => `
    <div class="food-card" data-action="editFoodDB" data-id="${f.id}">
      <div class="food-name">${escHtml(f.name)}</div>
      <div class="food-macros">
        <span class="food-kcal">${f.kcal} kcal</span>
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

// ── Liaison des événements globaux ───────────────────────────

function bindEvents() {
  // Called ONCE from init — event delegation on persistent #app element
  const app = document.getElementById('app');
  app.addEventListener('click', handleClick);
  app.addEventListener('input', handleInput);

  // Photo viewer — delegated on class .js-view-photo
  // Uses capture phase so it runs before the parent card's click handler
  app.addEventListener('click', e => {
    const img = e.target.closest('.js-view-photo');
    if (!img) return;
    e.stopPropagation();
    const src = img.src;
    if (!src) return;
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:999;display:flex;align-items:center;justify-content:center;cursor:pointer';
    overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
    overlay.addEventListener('click', () => overlay.remove());
    document.body.appendChild(overlay);
  }, true); // capture: true → runs before bubbling phase → stopPropagation works
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
  // Remind to backup if more than 7 days since last backup
  const lastBackup = localStorage.getItem('macros_last_backup');
  const daysSince  = lastBackup
    ? (Date.now() - new Date(lastBackup).getTime()) / 86400000
    : Infinity;
  if (daysSince > 7) {
    setTimeout(() => showToast('☁️ Pense à sauvegarder tes données (Réglages)'), 2500);
  }
}

document.addEventListener('DOMContentLoaded', init);