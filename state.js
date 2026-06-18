// ============================================================
// state.js — État global de l'application "Mes Macros"
// Contient l'objet S (state) et les constantes par défaut.
// Doit être chargé EN PREMIER, avant tous les autres scripts.
// ============================================================

// ── Defaults ────────────────────────────────────────────────

const DEFAULT_GOALS = {
  sport: { kcal: 2500, p: 180, g: 250, l: 70 },
  rest:  { kcal: 1850, p: 160, g: 180, l: 60 }
};

// ── State ────────────────────────────────────────────────────

let S = {
  tab:              'today',
  viewDate:         '',
  histSub:          'list',
  editDate:         null,
  histSearch:       '',            // search query in history
  collapsedWeeks:   {},            // key "YYYY-WW" → true when collapsed
  modal:            null,
  md:               {},
  searchQ:          '',
  foodsSearch:      '',
  foodsSubTab:      'foods',
  foodsSort:        'alpha',     // #4: 'alpha' | 'used' | 'recent'
  foodsSelect:      false,       // #6: multi-select mode
  foodsSelectedIds: [],          // #6
  syncWarningDismissed: false,
  collapsedMeals:   {},          // #2: key "date-meal" → true
  settingsEdit:     null,
  settingsTemp:     {},
  days:             {},
  foods:            [],
  meals:            [],
  goals:            {}
};