// ============================================================
// render-nav.js — Barre de navigation + orchestrateur principal
// render() est appelée à chaque changement d'état pour
// re-générer le HTML de l'onglet actif + la modale ouverte.
// Dépend de toutes les fonctions renderXxx des autres fichiers
// render-*.js, ainsi que de helpers.js (todayStr) et state.js.
// ============================================================

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
        S.histSub    = 'list';
        S.editDate   = null;
        S.histSearch = '';
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