// ============================================================
// handlers-foods.js — Gestion des clics : onglet "Aliments"
// Recherche, tri, sélection multiple, suppression, sync CSV,
// ajout/édition dans la base d'aliments.
//
// NOTE : le case 'deleteFoodDB' supprime l'aliment IMMÉDIATEMENT
// sans confirmation. Il existait un second case 'deleteFoodDB'
// dans le code original (censé ouvrir une modale de
// confirmation) mais il était inatteignable (code mort en JS,
// un switch ne retient que le premier case d'une valeur donnée)
// — il a été volontairement omis ici pour ne pas semer la
// confusion. Comportement actuel inchangé par rapport à avant
// le découpage.
//
// handleFoodsAction(a, el, e) retourne true si l'action a été
// traitée. Voir init.js pour le routeur principal.
// ============================================================

function handleFoodsAction(a, el, e) {
  switch (a) {

    case 'openAddFoodDB':
      S.modal = 'addFoodDB';
      S.md    = { calcMode: false };
      render();
      setTimeout(() => document.getElementById('db-name')?.focus(), 80);
      break;

    case 'setCalcMode':
      S.md.calcMode = el.dataset.val === 'custom';
      S.md.refQty   = null;
      render();
      setTimeout(() => document.getElementById(S.md.calcMode ? 'db-ref-qty' : 'db-kcal')?.focus(), 80);
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
      const brand   = document.getElementById('db-brand')?.value.trim() || '';
      const nom     = document.getElementById('db-name')?.value.trim()  || '';
      let   kcal    = +document.getElementById('db-kcal')?.value;
      let   p       = +document.getElementById('db-p')?.value    || 0;
      let   g       = +document.getElementById('db-g')?.value    || 0;
      let   l       = +document.getElementById('db-l')?.value    || 0;
      const uw      = +document.getElementById('db-unit')?.value || null;
      if (!nom)  { showToast('Donne un nom à l\'aliment.'); break; }
      if (!kcal) { showToast('Les calories sont requises.'); break; }
      // If custom qty mode, convert proportionally to per 100g
      if (S.md.calcMode && S.md.refQty && S.md.refQty !== 100) {
        const r = 100 / S.md.refQty;
        kcal = Math.round(kcal * r);
        p    = +(p * r).toFixed(1);
        g    = +(g * r).toFixed(1);
        l    = +(l * r).toFixed(1);
      }
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

    case 'setFoodsSort':
      S.foodsSort = el.dataset.val;
      render();
      break;

    case 'showNotSynced':
      showToast('⚠️ Cet aliment n\'est pas dans foods.csv — non synchronisé');
      break;

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

    case 'confirmDeleteFoodEverywhere': {
      const ids = S.md.deleteIds || [];
      for (const id of ids) {
        S.foods = S.foods.filter(x => x.id !== id);
        for (const day of Object.values(S.days))
          for (let m = 1; m <= 10; m++)
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

    case 'dismissSyncWarning':
      S.syncWarningDismissed = true;
      render();
      break;

    case 'syncCSVNow':
      showToast('Synchronisation en cours…');
      loadCSVFoods().then(() => {
        showToast('✅ Base synchronisée avec foods.csv !');
        render();
      });
      break;

    case 'setFoodsSubTab':
      S.foodsSubTab = el.dataset.val;
      S.foodsSearch = '';
      render();
      break;


    default:
      return false;
  }
  return true;
}