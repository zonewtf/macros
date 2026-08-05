// ============================================================
// render-today.js — Affichage de l'onglet "Aujourd'hui"
// (aussi utilisé pour éditer un jour depuis l'historique)
// Dépend de helpers.js (calcMacros, getDay, escHtml, macroPct…)
// et state.js (S).
// ============================================================

// ── SVG Ring ─────────────────────────────────────────────────

function renderRing(consumed, goal) {
  const r = 54, cx = 80, cy = 80, size = 160;
  const circ = 2 * Math.PI * r;
  const pct = goal > 0 ? clamp(consumed / goal, 0, 1) : 0;
  const offset = circ * (1 - pct);
  const over = consumed > goal;
  const color = over ? '#e87070' : '#7eb8f7';
  return `
  <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="10"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
      stroke-linecap="round"
      stroke-dasharray="${circ.toFixed(2)}"
      stroke-dashoffset="${offset.toFixed(2)}"
      transform="rotate(-90 ${cx} ${cy})"
      class="ring-fill"/>
    <text x="${cx}" y="${cy - 8}" text-anchor="middle" class="ring-val">${consumed}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="ring-sub">/ ${goal} kcal</text>
  </svg>`;
}

function renderBar(label, consumed, goal, color) {
  const pct = goal > 0 ? clamp(consumed / goal * 100, 0, 100) : 0;
  const over = consumed > goal;
  const c = over ? '#e87070' : color;
  return `
  <div class="bar-row">
    <span class="bar-label">${label}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${c}"></div></div>
    <span class="bar-num" style="color:${c}">${consumed}g</span>
  </div>`;
}

// Pills delta pour aujourd'hui : couleur fixe, signe +/- selon dépassement ou manque
function renderPillDelta(val, goal, color, prefix, unit) {
  const diff = val - goal;          // positive = dépassé, negative = manque
  const sign = diff >= 0 ? '+' : ''; // '-' est déjà dans le nombre négatif
  const rounded = Number.isInteger(diff) ? diff : +diff.toFixed(1);
  const display = `${prefix}${sign}${rounded}${unit}`;
  return `<span style="
    display:inline-block;
    font-size:12px;
    font-weight:600;
    padding:3px 8px;
    border-radius:20px;
    background:rgba(255,255,255,0.06);
    color:${color};
    border:1px solid rgba(255,255,255,0.08);
  ">${display}</span>`;
}

// ── Tab: Day View (Today & History edit) ─────────────────────

function renderDayView(date) {
  const isToday    = date === todayStr();
  const isTomorrow = date === tomorrowStr();
  const day        = getDay(date);
  const goals      = S.goals[day.type];
  const realEntries = allEntries(day);
  const hasRealFood = realEntries.length > 0;
  const totals      = getEffectiveTotals(day);
  const isEstimated = !hasRealFood && !!day.estimated;

  const badge = day.type === 'sport'
    ? `<span class="badge-sport">Sport ⚡</span>`
    : `<span class="badge-rest">Repos 🌙</span>`;

  const header = isToday
    ? `<div class="day-header">
         <h2>${fmtDate(date)}</h2>
         <button class="btn-toggle" data-action="toggleType" data-date="${date}">${badge}</button>
       </div>
       ${(() => { const s = getStreak(); return s >= 1 ? `<div class="streak-row">🔥 <span class="streak-count">${s} jour${s>1?'s':''} d'affilée</span></div>` : ''; })()}`
    : `<div class="day-header">
         <button class="btn-back" data-action="back">← Retour</button>
         <button class="btn-toggle" data-action="toggleType" data-date="${date}">${badge}</button>
       </div>
       <h2 class="day-title">${isTomorrow ? 'Demain — ' : ''}${fmtDate(date)}</h2>`;

  // Créatine + Watch
  const creatineBtn = (() => {
    const taken  = day.creatine;
    const burned = day.burned;
    const creatinePart = taken
      ? `<div class="action-taken">💪🏼 ${taken}</div>`
      : `<button class="btn-action-half" data-action="takeCreatine" data-date="${date}">💪🏼 Créatine</button>`;
    const burnedPart = (burned !== null && burned !== undefined)
      ? `<div class="action-taken">⌚ ${burned} kcal</div>`
      : `<button class="btn-action-half" data-action="openBurnedInput" data-date="${date}">⌚ Watch</button>`;
    return `<div class="action-row">${creatinePart}${burnedPart}</div>`;
  })();

  // Estimation badge + edit button
  const estimateBadge = isEstimated
    ? `<div class="estimate-banner">
         <span>~ Journée estimée</span>
         <button class="btn-estimate-edit" data-action="openDayEstimate" data-date="${date}">Modifier</button>
       </div>`
    : '';

  const summary = `
  <div class="summary-card ${isEstimated ? 'summary-estimated' : ''}">
    ${renderRing(totals.kcal, goals.kcal)}
    <div class="macros-detail">
      ${renderBar('Protéines', totals.p, goals.p, '#7eb8f7')}
      ${renderBar('Glucides',  totals.g, goals.g, '#f0c040')}
      ${renderBar('Lipides',   totals.l, goals.l, '#e87070')}
      <div class="pills-row">
        ${renderPillDelta(totals.kcal, goals.kcal, '#aaaaaa', '',   ' kcal')}
        ${renderPillDelta(totals.p,    goals.p,    '#7eb8f7', 'P ', 'g')}
        ${renderPillDelta(totals.g,    goals.g,    '#f0c040', 'G ', 'g')}
        ${renderPillDelta(totals.l,    goals.l,    '#e87070', 'L ', 'g')}
      </div>
    </div>
  </div>`;

  // Estimate button — only when 0 real food AND no estimation yet
  const estimateBtn = (!hasRealFood && !day.estimated)
    ? `<button class="btn-estimate" data-action="openDayEstimate" data-date="${date}">
         ~ Estimer ma journée
       </button>`
    : '';

  let mealsHtml = '<div class="meals">';
  for (let m = 1; m <= 10; m++) {
    const entries  = day.meals[m] || [];
    const mTotals  = calcMacros(entries);
    const hasFood  = entries.length > 0;
    const colKey   = `${date}-${m}`;
    const collapsed = !!S.collapsedMeals[colKey];

    const entriesHtml = entries.map((e, i) => {
      const f = S.foods.find(x => x.id === e.foodId);
      if (!f) return '';
      const qty = f.unitWeight
        ? `${+(e.grams / f.unitWeight).toFixed(1)} u.`
        : `${e.grams}g`;
      const mc = calcMacros([e]);
      return `<div class="meal-entry" data-action="editEntry" data-meal="${m}" data-idx="${i}" data-date="${date}">
        <div class="entry-left">
          <span class="entry-name">${escHtml(f.name)}</span>
          <div class="entry-macros-row">
            <span class="entry-macro-p">P ${mc.p}g ${macroPct(mc.kcal, mc.p, 4)}</span>
            <span class="entry-macro-g">G ${mc.g}g ${macroPct(mc.kcal, mc.g, 4)}</span>
            <span class="entry-macro-l">L ${mc.l}g ${macroPct(mc.kcal, mc.l, 9)}</span>
          </div>
        </div>
        <div class="entry-right">
          <span class="entry-qty">${qty}</span>
          <span class="entry-kcal">${mc.kcal} kcal</span>
        </div>
      </div>`;
    }).join('');

    const mealMacroSub = hasFood
      ? `<div class="meal-macro-sub">
           <span style="color:#7eb8f7">P ${mTotals.p}g</span>
           <span style="color:#f0c040">G ${mTotals.g}g</span>
           <span style="color:#e87070">L ${mTotals.l}g</span>
         </div>`
      : '';

    mealsHtml += `
    <div class="meal-section">
      <div class="meal-header" data-action="toggleMeal" data-colkey="${colKey}">
        <span class="meal-chevron ${collapsed ? 'collapsed' : ''}">›</span>
        <div class="meal-header-left">
          <span class="meal-title">Repas ${m}${hasFood ? ` <span class="meal-kcal-inline">· ${mTotals.kcal} kcal</span>` : ''}</span>
          ${mealMacroSub}
        </div>
        <button class="btn-meal-icon" data-action="openQuickAdd" data-meal="${m}" data-date="${date}" title="Ajout rapide">⚡</button>
        ${hasFood ? `<button class="btn-meal-icon" data-action="openCopyMeal" data-meal="${m}" data-date="${date}" title="Copier ce repas">📋</button>` : ''}
        <button class="btn-meal-icon" data-action="openAddFood" data-meal="${m}" data-date="${date}">➕</button>
      </div>
      ${collapsed ? '' : entriesHtml}
    </div>`;
  }
  mealsHtml += '</div>';

  const tomorrowBtn = isToday
    ? `<button class="btn-tomorrow" data-action="viewTomorrow">Planifier demain →</button>`
    : '';

  const aiBtn = `<button class="btn-ai-prompt" data-action="copyAiPrompt" data-date="${date}">🤖 Générer un prompt IA</button>`;

  return `
  <div class="view-day">
    ${header}
    ${creatineBtn}
    ${estimateBadge}
    ${summary}
    ${estimateBtn}
    ${mealsHtml}
    ${tomorrowBtn}
    ${aiBtn}
  </div>`;
}