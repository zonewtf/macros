// ============================================================
// handlers-modals.js — Gestion des clics : modales communes
// Repas favoris (créer/éditer/ajouter), repas rapide (macros
// seules), copie de repas, ajout d'ingrédient à un repas favori.
//
// handleModalsAction(a, el, e) retourne true si l'action a été
// traitée. Voir init.js pour le routeur principal.
// ============================================================

function handleModalsAction(a, el, e) {
  switch (a) {

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


    default:
      return false;
  }
  return true;
}