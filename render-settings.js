// ============================================================
// render-settings.js — Affichage de l'onglet "Réglages"
// Objectifs Sport/Repos, sync CSV, sauvegarde iCloud, exports.
// Dépend de state.js (S) et utilise window.caches (API native).
// ============================================================

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
        <span class="settings-label">Base d'aliments (foods.csv)</span>
      </div>
      <p style="font-size:12px;color:#555;margin-bottom:12px;line-height:1.5">
        Synchronise ta base locale avec le fichier <strong style="color:#888">foods.csv</strong> déployé sur GitHub. Les aliments CSV supprimés ou modifiés seront mis à jour. Tes aliments ajoutés manuellement sont conservés.
      </p>
      <button class="btn-confirm" style="margin-bottom:4px;font-size:14px;background:#1a2a1a;color:#66ffaa;border:1px solid rgba(102,255,170,0.2)" data-action="syncCSVNow">🔄 Synchroniser avec foods.csv</button>
    </div>

    <div class="settings-block">
      <div class="settings-block-head">
        <span class="settings-label">Sauvegarde iCloud</span>
      </div>
      <p style="font-size:12px;color:#555;margin-bottom:12px;line-height:1.5">
        Le fichier téléchargé se sauvegarde dans <strong style="color:#888">Fichiers → iCloud Drive</strong> si iCloud Drive est activé sur ton iPhone.
      </p>
      <button class="btn-confirm" style="margin-bottom:10px;font-size:14px" data-action="backupToiCloud">☁️ Sauvegarder maintenant</button>
      <div style="font-size:12px;color:#555;margin-bottom:8px" id="last-backup-label">${(() => {
        const d = localStorage.getItem('macros_last_backup');
        return d ? `Dernière sauvegarde : ${new Date(d).toLocaleDateString('fr-FR', {day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}` : 'Aucune sauvegarde récente';
      })()}</div>
      <label class="btn-export" style="display:block;text-align:center;cursor:pointer">
        ⬆️ Restaurer depuis un fichier
        <input type="file" accept=".json" data-action="restoreFromFile" style="display:none">
      </label>
    </div>

    <div class="settings-block">
      <div class="settings-block-head">
        <span class="settings-label">Export des données</span>
      </div>
      <div style="font-size:12px;color:#666;margin-bottom:10px">Historique des jours</div>
      <div class="export-period-grid">
        <button class="btn-export-period" data-action="openExportPeriod" data-period="week">📅 Cette semaine</button>
        <button class="btn-export-period" data-action="openExportPeriod" data-period="month">📅 Ce mois</button>
        <button class="btn-export-period" data-action="openExportPeriod" data-period="30">📅 30 derniers jours</button>
        <button class="btn-export-period" data-action="openExportPeriod" data-period="all">📅 Tout l'historique</button>
      </div>
      <button class="btn-export" style="width:100%;margin-top:8px" data-action="openExportPeriod" data-period="custom">✏️ Choisir les dates</button>
      <div style="font-size:12px;color:#666;margin:12px 0 10px">Ma base d'aliments</div>
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