// ============================================================
// handlers-today.js — Gestion des clics : onglet "Aujourd'hui"
// (et édition d'un jour depuis l'historique, qui réutilise la
// même vue). Repas, eau, créatine, Watch, estimation, navigation.
//
// handleTodayAction(a, el, e) retourne true si l'action a été
// traitée (et donc qu'il ne faut PAS essayer les autres
// gestionnaires). Voir init.js pour le routeur principal.
// ============================================================

function handleTodayAction(a, el, e) {
  switch (a) {

    case 'viewPhoto': {
      const src = el.dataset.src;
      if (!src) break;
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:999;display:flex;align-items:center;justify-content:center;cursor:pointer';
      overlay.innerHTML = `<img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">`;
      overlay.addEventListener('click', () => overlay.remove());
      document.body.appendChild(overlay);
      break;
    }

    case 'toggleWeek': {
      const key = el.dataset.key;
      // false = explicitly expanded, delete key = back to default (collapsed)
      if (S.collapsedWeeks[key] === false) {
        delete S.collapsedWeeks[key]; // collapse it (back to default)
      } else {
        S.collapsedWeeks[key] = false; // expand it
      }
      render();
      break;
    }

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

    case 'toggleType': {
      const date = el.dataset.date;
      const day  = getDay(date);
      day.type   = day.type === 'sport' ? 'rest' : 'sport';
      save();
      render();
      break;
    }

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

    case 'toggleMeal': {
      if (e.target.tagName === 'BUTTON' || e.target.closest('button')) break;
      const key = el.dataset.colkey;
      if (!key) break;
      if (S.collapsedMeals[key]) delete S.collapsedMeals[key];
      else S.collapsedMeals[key] = true;
      render();
      break;
    }

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

    case 'takeCreatine': {
      const date = el.dataset.date;
      const day  = getDay(date);
      if (day.creatine) break; // already taken, can't uncheck
      const now  = new Date();
      day.creatine = `${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
      save();
      showToast(`💪 Créatine prise à ${day.creatine} !`);
      render();
      break;
    }

    case 'openBurnedInput':
      S.modal = 'burnedInput';
      S.md    = { date: el.dataset.date };
      render();
      setTimeout(() => document.getElementById('burned-input')?.focus(), 80);
      break;

    case 'openDayEstimate':
      S.modal = 'dayEstimate';
      S.md    = { date: el.dataset.date };
      render();
      setTimeout(() => document.getElementById('est-kcal')?.focus(), 80);
      break;

    case 'saveDayEstimate': {
      const kcal = +document.getElementById('est-kcal')?.value || 0;
      const p    = +document.getElementById('est-p')?.value    || 0;
      const g    = +document.getElementById('est-g')?.value    || 0;
      const l    = +document.getElementById('est-l')?.value    || 0;
      const date = S.md.date;
      if (!kcal) { showToast('Entre au moins les calories.'); break; }
      const day  = getDay(date);
      day.estimated = { kcal, p, g, l };
      save();
      S.modal = null; S.md = {};
      showToast('Estimation enregistrée ~');
      render();
      break;
    }

    case 'clearDayEstimate': {
      const date = S.md.date;
      const day  = getDay(date);
      day.estimated = null;
      save();
      S.modal = null; S.md = {};
      showToast('Estimation supprimée.');
      render();
      break;
    }

    case 'saveBurned': {
      const val  = +document.getElementById('burned-input')?.value || 0;
      const date = S.md.date;
      const day  = getDay(date);
      day.burned = val > 0 ? val : null;
      save();
      S.modal = null; S.md = {};
      showToast(val > 0 ? `⌚ ${val} kcal enregistrées !` : 'Valeur supprimée.');
      render();
      break;
    }

    case 'copyAiPrompt': {
      const date   = el.dataset.date;
      const day    = S.days[date];
      if (!day) { showToast('Aucune donnée pour ce jour.'); break; }
      const goals  = S.goals[day.type];
      const totals = getEffectiveTotals(day);
      const remKcal = totals.kcal - goals.kcal;
      const remP    = +(totals.p - goals.p).toFixed(1);
      const remG    = +(totals.g - goals.g).toFixed(1);
      const remL    = +(totals.l - goals.l).toFixed(1);

      // Build food list per meal (exact format requested)
      let mealsText = '';
      for (let m = 1; m <= 10; m++) {
        const entries = day.meals[m] || [];
        if (!entries.length) continue;
        mealsText += `\nRepas ${m} :\n`;
        for (const e of entries) {
          const f = S.foods.find(x => x.id === e.foodId);
          if (!f) continue;
          const qty = f.unitWeight
            ? `${+(e.grams / f.unitWeight).toFixed(1)} unité(s)`
            : `${e.grams}g`;
          const mc = calcMacros([e]);
          mealsText += `  - ${f.name} (${qty}) → ${mc.kcal} kcal | P ${mc.p}g | G ${mc.g}g | L ${mc.l}g\n`;
        }
      }

      // If estimated day with no real meals
      if (!mealsText && day.estimated) {
        mealsText = `\n~ Journée estimée globalement\n`;
      }

      const fmtRem = v => v > 0 ? `+${v}` : `${v}`;
      const recap = `OBJECTIFS DU JOUR :
- Calories : ${goals.kcal} kcal | Protéines : ${goals.p}g | Glucides : ${goals.g}g | Lipides : ${goals.l}g

DÉJÀ CONSOMMÉ :
- Calories : ${totals.kcal} kcal | Protéines : ${totals.p}g | Glucides : ${totals.g}g | Lipides : ${totals.l}g
${mealsText}
RESTE À COMBLER :
- Calories : ${fmtRem(remKcal)} kcal | Protéines : ${fmtRem(remP)}g | Glucides : ${fmtRem(remG)}g | Lipides : ${fmtRem(remL)}g`;

      navigator.clipboard.writeText(recap).then(() => {
        showToast('Récap copié ! 📋');
      }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = recap;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('Récap copié ! 📋');
      });
      break;
    }

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


    default:
      return false; // pas traité ici, le routeur essaiera le fichier suivant
  }
  return true; // traité par un des case ci-dessus
}