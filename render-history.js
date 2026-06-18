// ============================================================
// render-history.js — Affichage de l'onglet "Historique"
// Groupement par semaine ISO, recherche, cartes journalières.
// Dépend de helpers.js, render-today.js (renderDayView est
// appelée pour le mode édition), et state.js (S).
// ============================================================

// ── Tab: History ──────────────────────────────────────────────

// ── Week helpers ──────────────────────────────────────────────

function getISOWeek(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  const day = d.getDay() || 7; // Mon=1 … Sun=7
  d.setDate(d.getDate() + 4 - day); // Thursday of current week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return {
    week: Math.ceil(((d - yearStart) / 86400000 + 1) / 7),
    year: d.getFullYear(),
    monday: (() => {
      const m = new Date(dateStr + 'T12:00:00');
      const wd = m.getDay() || 7;
      m.setDate(m.getDate() - wd + 1);
      return m.toISOString().slice(0, 10);
    })()
  };
}

function weekLabel(weekNum, mondayStr, sundayStr) {
  const fmt = ds => new Date(ds + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  const monD = new Date(mondayStr + 'T12:00:00');
  const sunD = new Date(sundayStr + 'T12:00:00');
  const monYear = monD.getFullYear();
  const sunYear = sunD.getFullYear();
  const yearSuffix = monYear !== sunYear ? ` ${String(sunYear).slice(2)}` : '';
  return `Semaine ${weekNum} — ${fmt(mondayStr)} au ${fmt(sundayStr)}${yearSuffix}`;
}

function groupDaysByWeek(dates) {
  // Returns array of { weekNum, year, monday, sunday, label, dates[] } sorted newest first
  const map = {};
  for (const d of dates) {
    const { week, year, monday } = getISOWeek(d);
    const key = `${year}-${String(week).padStart(2, '0')}`;
    if (!map[key]) {
      const sun = new Date(monday + 'T12:00:00');
      sun.setDate(sun.getDate() + 6);
      const sunday = sun.toISOString().slice(0, 10);
      map[key] = { weekNum: week, year, monday, sunday, label: weekLabel(week, monday, sunday), dates: [] };
    }
    map[key].dates.push(d);
  }
  return Object.values(map).sort((a, b) => b.monday.localeCompare(a.monday));
}

function renderHistory() {
  if (S.histSub === 'edit' && S.editDate) {
    return renderDayView(S.editDate);
  }

  const today   = todayStr();
  const tom     = tomorrowStr();
  const tomDay  = getDay(tom);
  const tomT    = calcMacros(allEntries(tomDay));
  const tomBadge = tomDay.type === 'sport'
    ? `<span class="badge-sport">Sport ⚡</span>`
    : `<span class="badge-rest">Repos 🌙</span>`;

  const tomorrowCard = `
  <div class="hist-card hist-tomorrow">
    <div class="hist-card-head">
      <span class="hist-date">Demain — ${fmtDateShort(tom)}</span>
      ${tomBadge}
      <button class="btn-edit-sm" data-action="editHistDay" data-date="${tom}">✎ Modifier</button>
    </div>
    <div class="hist-macros">
      <span class="hist-kcal">${tomT.kcal} kcal</span>
      <span class="pill-sm" style="color:#7eb8f7">P ${tomT.p}g</span>
      <span class="pill-sm" style="color:#f0c040">G ${tomT.g}g</span>
      <span class="pill-sm" style="color:#e87070">L ${tomT.l}g</span>
    </div>
  </div>`;

  // ── Render a single day card ────────────────────────────────
  const renderDayCard = (d, highlight = '') => {
    const day     = S.days[d];
    const totals  = getEffectiveTotals(day);
    const goals   = S.goals[day.type];
    const isEst   = !allEntries(day).length && !!day.estimated;
    const isEmpty = isDayEmpty(day);
    const pct     = goals.kcal > 0 ? clamp(totals.kcal / goals.kcal * 100, 0, 100) : 0;
    const badge  = day.type === 'sport'
      ? `<span class="badge-sport">Sport ⚡</span>`
      : `<span class="badge-rest">Repos 🌙</span>`;
    const dKcal  = totals.kcal - goals.kcal;
    const dP     = +(totals.p - goals.p).toFixed(1);
    const dG     = +(totals.g - goals.g).toFixed(1);
    const dL     = +(totals.l - goals.l).toFixed(1);
    const fmtP   = (label, v, unit) => {
      const sign = v > 0 ? '+' : '';
      const lbl  = label ? label + ' ' : '';
      return `<span class="pill-sm" style="color:#555">${lbl}${sign}${v}${unit}</span>`;
    };
    const burned  = day.burned;
    const deficit = burned ? burned - totals.kcal : null;
    const missingBurned = !burned
      ? `<button class="btn-add-burned" data-action="openBurnedInput" data-date="${d}">⌚ +Watch</button>`
      : `<span class="pill-sm" style="color:#f0c040">⌚ ${burned} kcal</span>`;
    const deficitLine = burned
      ? `<div class="hist-deficit-neutral">
           ${deficit > 0 ? `Déficit : −${deficit} kcal` : `Surplus : +${Math.abs(deficit)} kcal`}
         </div>`
      : '';

    // Highlight matching food names in search mode
    const highlightItems = highlight ? (() => {
      const q = highlight.toLowerCase();
      const matches = [];
      for (let m = 1; m <= 10; m++) {
        for (const e of (day.meals[m] || [])) {
          const f = S.foods.find(x => x.id === e.foodId);
          if (f && f.name.toLowerCase().includes(q)) {
            const mc = calcMacros([e]);
            matches.push(`<span style="font-size:11px;color:#7eb8f7">↳ Repas ${m} : ${escHtml(f.name)} (${mc.kcal} kcal)</span>`);
          }
        }
      }
      return matches.length ? `<div style="display:flex;flex-direction:column;gap:2px;margin-top:6px">${matches.join('')}</div>` : '';
    })() : '';

    return `
    <div class="hist-card${highlight ? ' hist-card-search-match' : ''}${isEmpty ? ' hist-card-empty' : ''}">
      <div class="hist-card-head">
        <span class="hist-date">${fmtDate(d)}</span>
        ${badge}
        ${isEst ? `<span class="badge-estimated">~ Estimé</span>` : ''}
        ${day.creatine ? `<span title="Créatine prise">💪🏼</span>` : ''}
        <button class="btn-edit-sm" data-action="editHistDay" data-date="${d}">✎ Modifier</button>
      </div>
      ${isEmpty ? `
      <div class="hist-empty-day">
        <span>Non journalisée</span>
        <div style="display:flex;gap:8px;align-items:center">
          ${!day.burned
            ? `<button class="btn-add-burned" data-action="openBurnedInput" data-date="${d}">⌚ +Watch</button>`
            : `<span class="pill-sm" style="color:#f0c040">⌚ ${day.burned} kcal</span>`}
          <button class="btn-estimate-sm" data-action="openDayEstimate" data-date="${d}">~ Estimer</button>
        </div>
      </div>` : `
      <div class="hist-macros">
        <span class="hist-kcal">${totals.kcal} kcal</span>
        <span class="pill-sm" style="color:#7eb8f7">P ${totals.p}g</span>
        <span class="pill-sm" style="color:#f0c040">G ${totals.g}g</span>
        <span class="pill-sm" style="color:#e87070">L ${totals.l}g</span>
        ${missingBurned}
      </div>
      <div class="hist-macros" style="margin-top:5px">
        ${fmtP('', dKcal, ' kcal')}
        ${fmtP('P', dP, 'g')}
        ${fmtP('G', dG, 'g')}
        ${fmtP('L', dL, 'g')}
      </div>
      ${deficitLine}
      ${highlightItems}
      <div class="hist-bar-track">
        <div class="hist-bar-fill" style="width:${pct}%"></div>
      </div>`}
    </div>`;
  };

  // ── Render week summary header ──────────────────────────────
  const renderWeekHeader = (wDates, wg, isCurrent, isCollapsed) => {
    // Exclude truly empty days from averages
    const activeDates = wDates.filter(d => !isDayEmpty(S.days[d]));
    const n = activeDates.length;
    if (n === 0) return ''; // no data yet this week
    let sumK = 0, sumP = 0, sumG = 0, sumL = 0, sumB = 0, bCount = 0, sport = 0;
    for (const d of activeDates) {
      const day = S.days[d];
      const t = getEffectiveTotals(day);
      sumK += t.kcal; sumP += t.p; sumG += t.g; sumL += t.l;
      if (day.burned) { sumB += day.burned; bCount++; }
      if (day.type === 'sport') sport++;
    }
    const avgK = Math.round(sumK / n);
    const avgP = +(sumP / n).toFixed(1);
    const avgG = +(sumG / n).toFixed(1);
    const avgL = +(sumL / n).toFixed(1);
    const avgB = bCount > 0 ? Math.round(sumB / bCount) : null;
    const def  = avgB ? avgB - avgK : null;
    const defLine = def !== null
      ? `<div style="font-size:12px;margin-top:5px;color:#888">
           ${def > 0 ? `Déficit moy. −${def} kcal/j` : `Surplus moy. +${Math.abs(def)} kcal/j`}
         </div>`
      : '';

    // #2 — Weekly calorie balance + theoretical fat
    const weeklyBalanceLine = (() => {
      if (!avgB || n < 1) return '';
      const totalIngested = Math.round(sumK);
      const totalBurned   = Math.round(sumB);
      const totalBalance  = totalBurned - totalIngested;
      const fatGrams      = Math.round(Math.abs(totalBalance) / 7.7);
      const sign          = totalBalance >= 0 ? '−' : '+';
      const label         = totalBalance >= 0 ? 'Déficit' : 'Surplus';
      return `<div style="font-size:12px;margin-top:4px;color:#666">
        ${label} semaine : ${sign}${Math.abs(totalBalance)} kcal · ≈ ${sign}${fatGrams}g de gras théorique
      </div>`;
    })();
    const totalDays = wDates.length; // all days including empty (for display)
    const weekKey = `${wg.year}-${String(wg.weekNum).padStart(2,'0')}`;
    const toggleBtn = !isCurrent
      ? `<button class="week-collapse-btn" data-action="toggleWeek" data-key="${weekKey}">${isCollapsed ? '▸' : '▾'}</button>`
      : '';
    const label = isCurrent ? `📅 Semaine en cours — ${wg.label.replace(/^Semaine \d+ — /, '')}` : wg.label;
    return `
    <div class="week-header-block ${isCurrent ? 'week-current' : ''}">
      <div class="week-header-row" ${!isCurrent ? `data-action="toggleWeek" data-key="${weekKey}"` : ''}>
        <div class="week-header-left">
          <span class="week-label">${label}</span>
          <span class="week-badges">${sport}⚡ ${n-sport}🌙 · ${n}j journalisés${totalDays > n ? ` (${totalDays-n} vide${totalDays-n>1?'s':''})` : ''}</span>
        </div>
        ${toggleBtn}
      </div>
      <div class="hist-macros" style="margin-top:8px">
        <span class="hist-kcal">${avgK} kcal/j</span>
        <span class="pill-sm" style="color:#7eb8f7">P ${avgP}g</span>
        <span class="pill-sm" style="color:#f0c040">G ${avgG}g</span>
        <span class="pill-sm" style="color:#e87070">L ${avgL}g</span>
        ${avgB ? `<span class="pill-sm" style="color:#f0c040">⌚ ${avgB}</span>` : ''}
      </div>
      ${defLine}
      ${weeklyBalanceLine}
    </div>`;
  };

  // ── Search mode ─────────────────────────────────────────────
  const q = (S.histSearch || '').trim().toLowerCase();
  if (q) {
    const matchDates = Object.keys(S.days)
      .filter(d => d < today)
      .filter(d => {
        const day = S.days[d];
        return [1,2,3,4,5,6,7,8,9,10].some(m =>
          (day.meals[m] || []).some(e => {
            const f = S.foods.find(x => x.id === e.foodId);
            return f && f.name.toLowerCase().includes(q);
          })
        );
      })
      .sort((a, b) => b.localeCompare(a));

    const resultCards = matchDates.map(d => renderDayCard(d, q)).join('');
    const countLabel  = matchDates.length
      ? `<div style="font-size:12px;color:#666;margin-bottom:10px">${matchDates.length} jour${matchDates.length > 1 ? 's' : ''} trouvé${matchDates.length > 1 ? 's' : ''}</div>`
      : `<p class="empty-state">Aucun jour trouvé avec "${escHtml(S.histSearch)}"</p>`;
    return `
    <div class="view-history">
      <h2>Historique</h2>
      <div class="hist-search-wrap">
        <input class="search-input" type="search" placeholder="Rechercher un aliment…"
          value="${escHtml(S.histSearch)}" data-action="searchHistory" autocomplete="off">
      </div>
      ${countLabel}
      ${resultCards}
    </div>`;
  }

  // ── Normal mode ──────────────────────────────────────────────
  const pastDates = Object.keys(S.days)
    .filter(d => d < today)
    .sort((a, b) => b.localeCompare(a));

  const weekGroups = groupDaysByWeek(pastDates);
  const currentWeekMonday = getISOWeek(today).monday;

  let currentWeekHtml = '';
  let pastWeeksHtml   = '';

  for (const wg of weekGroups) {
    const isCurrent  = wg.monday === currentWeekMonday;
    const weekKey    = `${wg.year}-${String(wg.weekNum).padStart(2,'0')}`;
    // Past weeks collapsed by default (unless user expanded them), current always open
    const isCollapsed = !isCurrent && (S.collapsedWeeks[weekKey] !== false);
    const sortedDates = wg.dates.sort((a, b) => b.localeCompare(a));
    const header      = renderWeekHeader(sortedDates, wg, isCurrent, isCollapsed);
    const dayCards    = (isCurrent || !isCollapsed)
      ? sortedDates.map(d => renderDayCard(d)).join('')
      : '';

    if (isCurrent) {
      currentWeekHtml = `<div class="hist-section">${header}${dayCards}</div>`;
    } else {
      pastWeeksHtml += `<div class="hist-section hist-section-past">${header}${isCollapsed ? '' : dayCards}</div>`;
    }
  }

  const separator = currentWeekHtml
    ? `<div class="hist-separator"><span>Semaines passées</span></div>`
    : '';

  return `
  <div class="view-history">
    <div class="hist-top-bar">
      <h2>Historique</h2>
    </div>
    <div class="hist-search-wrap">
      <input class="search-input" type="search" placeholder="🔍 Rechercher un aliment…"
        value="${escHtml(S.histSearch)}" data-action="searchHistory" autocomplete="off">
    </div>
    ${tomorrowCard}
    <div class="hist-separator"><span>Semaine en cours</span></div>
    ${currentWeekHtml || '<p class="empty-state" style="padding:12px 0">Aucune donnée cette semaine.</p>'}
    ${separator}
    ${pastWeeksHtml || ''}
  </div>`;
}