// ============================================================
// handlers-settings-export.js — Gestion des clics : Réglages
// et exports. Objectifs Sport/Repos, sauvegarde iCloud, export
// CSV/JSON/Markdown avec sélection de période.
//
// handleSettingsExportAction(a, el, e) retourne true si
// l'action a été traitée. Voir init.js pour le routeur
// principal. Inclut aussi les anciens triggers d'export directs
// (exportHistoryCSV/JSON/Markdown, exportFoodsCSV, exportFullJSON,
// exportCSV/exportJSON) conservés pour compatibilité.
// ============================================================

function handleSettingsExportAction(a, el, e) {
  switch (a) {

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

    case 'backupToiCloud': {
      const now  = new Date();
      const pad  = n => String(n).padStart(2,'0');
      const name = `macros-backup-${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
      const data = {
        backupDate: now.toISOString(),
        version: 'v1',
        days:  S.days,
        foods: S.foods,
        meals: S.meals,
        goals: S.goals
      };
      download(name, JSON.stringify(data, null, 2), 'application/json');
      localStorage.setItem('macros_last_backup', now.toISOString());
      showToast('☁️ Sauvegarde téléchargée ! Enregistre-la dans iCloud Drive.');
      render(); // refresh last-backup label
      break;
    }

    case 'exportHistoryCSV':      exportHistoryCSV();      break;

    case 'exportHistoryJSON':     exportHistoryJSON();     break;

    case 'exportHistoryMarkdown': exportHistoryMarkdown(); break;

    case 'refreshExportCount': {
      const fromVal = document.getElementById('export-from')?.value || null;
      const toVal   = document.getElementById('export-to')?.value   || todayStr();
      S.md.from = fromVal;
      S.md.to   = toVal;
      render();
      break;
    }

    case 'openExportPeriod': {
      const period = el.dataset.period;
      const today  = todayStr();
      let from = null, to = today;

      if (period === 'week') {
        from = getISOWeek(today).monday;
      } else if (period === 'month') {
        from = today.slice(0, 7) + '-01';
      } else if (period === '30') {
        const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() - 29);
        from = d.toISOString().slice(0, 10);
      } else if (period === 'all') {
        from = null; // no from = all history
      }
      S.modal  = 'exportPeriod';
      S.md     = { period, from, to: today };
      render();
      break;
    }

    case 'doExport': {
      const fmt  = el.dataset.fmt;
      const from = S.md.from || null;
      const to   = S.md.to   || todayStr();
      S.modal = null; S.md = {};
      render();
      setTimeout(() => {
        if (fmt === 'csv')      exportHistoryCSV(from, to);
        else if (fmt === 'json') exportHistoryJSON(from, to);
        else if (fmt === 'md')   exportHistoryMarkdown(from, to);
      }, 50);
      break;
    }

    case 'exportFoodsCSV':        exportFoodsCSV();        break;

    case 'exportFullJSON':        exportFullJSON();        break;

    case 'exportCSV':  exportHistoryCSV(); break;

    case 'exportJSON': exportFullJSON();   break;


    default:
      return false;
  }
  return true;
}