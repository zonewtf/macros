// ============================================================
// export.js — Génération des exports (CSV, JSON, Markdown)
// Construction des données journalières/hebdomadaires et
// téléchargement de fichiers.
// Dépend de helpers.js (calcMacros, getEffectiveTotals,
// isDayEmpty, getISOWeek, weekLabel, groupDaysByWeek…) et
// state.js (S).
// ============================================================

// ── Export ────────────────────────────────────────────────────

// ── Helpers export ───────────────────────────────────────────

function buildDayExportData(date, day) {
  const goals   = S.goals[day.type];
  const totals  = getEffectiveTotals(day);   // ← utilise estimation si pas de nourriture
  const burned  = day.burned || null;
  const deficit = burned !== null ? burned - totals.kcal : null;
  const isEst   = allEntries(day).length === 0 && !!day.estimated;

  const mealsDetail = {};
  for (let m = 1; m <= 10; m++) {
    const entries = day.meals[m] || [];
    if (!entries.length) continue;
    const mTotals = calcMacros(entries);
    mealsDetail[`Repas ${m}`] = {
      total: mTotals,
      aliments: entries.map(e => {
        const f  = S.foods.find(x => x.id === e.foodId);
        if (!f) return null;
        const mc = calcMacros([e]);
        const qty = f.unitWeight
          ? `${+(e.grams / f.unitWeight).toFixed(1)} unité(s) (${e.grams}g)`
          : `${e.grams}g`;
        return { nom: f.name, quantite: qty, kcal: mc.kcal, p: mc.p, g: mc.g, l: mc.l };
      }).filter(Boolean)
    };
  }

  return {
    date,
    jour: fmtDate(date),
    type: day.type,
    journalise: isEst ? 'estimé' : (allEntries(day).length > 0 ? 'oui' : 'non'),
    creatine: day.creatine || null,
    calories_depensees_watch: burned,
    deficit_net_kcal: deficit,
    objectifs: { kcal: goals.kcal, p: goals.p, g: goals.g, l: goals.l },
    consomme:  { kcal: totals.kcal, p: totals.p, g: totals.g, l: totals.l },
    delta: {
      kcal: totals.kcal - goals.kcal,
      p: +(totals.p - goals.p).toFixed(1),
      g: +(totals.g - goals.g).toFixed(1),
      l: +(totals.l - goals.l).toFixed(1)
    },
    repas: mealsDetail
  };
}

// ── Export CSV Historique (étendu) ────────────────────────────

function exportHistoryCSV(from = null, to = null) {
  const today   = todayStr();
  const cutTo   = to || today;
  const header = [
    'Date', 'Jour', 'Type', 'Journalise',
    'Kcal_consommees', 'Kcal_objectif', 'Kcal_delta',
    'P_g', 'P_objectif', 'P_delta',
    'G_g', 'G_objectif', 'G_delta',
    'L_g', 'L_objectif', 'L_delta',
    'Calories_Watch', 'Deficit_net', 'Creatine',
    'Repas1_kcal','Repas2_kcal','Repas3_kcal','Repas4_kcal','Repas5_kcal',
    'Repas6_kcal','Repas7_kcal','Repas8_kcal','Repas9_kcal','Repas10_kcal'
  ];

  const rows = Object.entries(S.days)
    .filter(([date, day]) => {
      if (date >= today) return false;
      if (isDayEmpty(day)) return false;
      if (from && date < from) return false;
      if (date > cutTo) return false;
      return true;
    })
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, day]) => {
      const d = buildDayExportData(date, day);
      const mKcal = [1,2,3,4,5,6,7,8,9,10].map(m => {
        const entries = day.meals[m] || [];
        return entries.length ? calcMacros(entries).kcal : '';
      });
      return [
        date, `"${d.jour}"`, d.type, d.journalise,
        d.consomme.kcal, d.objectifs.kcal, d.delta.kcal,
        d.consomme.p, d.objectifs.p, d.delta.p,
        d.consomme.g, d.objectifs.g, d.delta.g,
        d.consomme.l, d.objectifs.l, d.delta.l,
        d.calories_depensees_watch ?? '',
        d.deficit_net_kcal ?? '',
        d.creatine ? 'Oui' : 'Non',
        ...mKcal
      ].join(',');
    });

  const csv = [header.join(','), ...rows].join('\n');
  const suffix = from ? `_${from}_au_${cutTo}` : '';
  download(`macros-historique${suffix}.csv`, csv, 'text/csv;charset=utf-8;');
  showToast(`CSV exporté — ${rows.length} jour(s)`);
}

// ── Export JSON Historique (étendu) ───────────────────────────

function exportHistoryJSON(from = null, to = null) {
  const today  = todayStr();
  const cutTo  = to || today;
  const sortedDates = Object.keys(S.days)
    .filter(d => {
      const day = S.days[d];
      if (d >= today) return false;
      if (isDayEmpty(day)) return false;
      if (from && d < from) return false;
      if (d > cutTo) return false;
      return true;
    })
    .sort((a, b) => b.localeCompare(a));

  const days = sortedDates.map(date => buildDayExportData(date, S.days[date]));

  // Weekly summaries using getEffectiveTotals, excluding empty days
  const weeks = {};
  for (const date of sortedDates) {
    const day  = S.days[date];
    const t    = getEffectiveTotals(day);
    const dt   = new Date(date + 'T12:00:00');
    const mon  = new Date(dt); mon.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
    const wKey = mon.toISOString().slice(0, 10);
    if (!weeks[wKey]) weeks[wKey] = { debut: wKey, jours: 0, totaux: { kcal: 0, p: 0, g: 0, l: 0, burned: 0, burnedCount: 0, sport: 0, repos: 0 } };
    weeks[wKey].jours++;
    weeks[wKey].totaux.kcal += t.kcal;
    weeks[wKey].totaux.p    += t.p;
    weeks[wKey].totaux.g    += t.g;
    weeks[wKey].totaux.l    += t.l;
    if (day.burned) { weeks[wKey].totaux.burned += day.burned; weeks[wKey].totaux.burnedCount++; }
    day.type === 'sport' ? weeks[wKey].totaux.sport++ : weeks[wKey].totaux.repos++;
  }

  const weeklySummaries = Object.values(weeks)
    .sort((a, b) => b.debut.localeCompare(a.debut))
    .map(w => {
      const n         = w.jours;
      const avgBurned = w.totaux.burnedCount > 0 ? Math.round(w.totaux.burned / w.totaux.burnedCount) : null;
      const avgKcal   = Math.round(w.totaux.kcal / n);
      const sun       = new Date(w.debut + 'T12:00:00'); sun.setDate(sun.getDate() + 6);
      const { week }  = getISOWeek(w.debut);
      const totalBal  = avgBurned ? (w.totaux.burned / w.totaux.burnedCount) * n - w.totaux.kcal : null;
      return {
        semaine:        weekLabel(week, w.debut, sun.toISOString().slice(0, 10)),
        semaine_debut:  w.debut,
        nb_jours_journalises: n,
        repartition:    `${w.totaux.sport} sport · ${w.totaux.repos} repos`,
        moyennes: {
          kcal:           avgKcal,
          p:              +(w.totaux.p / n).toFixed(1),
          g:              +(w.totaux.g / n).toFixed(1),
          l:              +(w.totaux.l / n).toFixed(1),
          calories_watch: avgBurned
        },
        deficit_moyen_jour:   avgBurned ? avgBurned - avgKcal : null,
        bilan_semaine_kcal:   totalBal !== null ? Math.round(totalBal) : null,
        gras_theorique_g:     totalBal !== null ? Math.round(Math.abs(totalBal) / 7.7) : null
      };
    });

  const data = {
    export_date: new Date().toISOString(),
    app: 'Mes Macros',
    objectifs: S.goals,
    resume_global: {
      nb_jours_journalises: days.length,
      periode: days.length ? `${days[days.length-1].date} → ${days[0].date}` : 'N/A'
    },
    resumés_hebdomadaires: weeklySummaries,
    jours: days
  };

  download(`macros-historique${from ? '_'+from+'_au_'+cutTo : '-complet'}.json`, JSON.stringify(data, null, 2), 'application/json');
  showToast(`JSON exporté — ${days.length} jour(s)`);
}

// ── Export Markdown (pour analyse IA) ─────────────────────────

function exportHistoryMarkdown(from = null, to = null) {
  const today  = todayStr();
  const cutTo  = to || today;
  const sortedDates = Object.keys(S.days)
    .filter(d => {
      const day = S.days[d];
      if (d >= today) return false;
      if (isDayEmpty(day)) return false;
      if (from && d < from) return false;
      if (d > cutTo) return false;
      return true;
    })
    .sort((a, b) => b.localeCompare(a));

  if (!sortedDates.length) { showToast('Aucun jour journalisé sur cette période.'); return; }

  const lines = [];
  lines.push('# Mes Macros — Export Historique Nutritionnel');
  lines.push(`\n*Exporté le ${new Date().toLocaleDateString('fr-FR', {day:'numeric',month:'long',year:'numeric'})}*\n`);
  lines.push('---\n');

  lines.push('## Objectifs');
  for (const [type, g] of [['Sport ⚡', S.goals.sport], ['Repos 🌙', S.goals.rest]]) {
    lines.push(`\n**${type}** — ${g.kcal} kcal | P ${g.p}g | G ${g.g}g | L ${g.l}g`);
  }
  lines.push('\n---\n');

  // Weekly summaries — use getEffectiveTotals, exclude empty days
  lines.push('## Résumés hebdomadaires\n');
  const wGroups = groupDaysByWeek(sortedDates);
  for (const wg of wGroups) {
    const wDates = wg.dates.filter(d => !isDayEmpty(S.days[d])).sort((a, b) => a.localeCompare(b));
    if (!wDates.length) continue;
    const n = wDates.length;
    let sumK = 0, sumP = 0, sumG = 0, sumL = 0, sumB = 0, bCount = 0, sport = 0;
    for (const d of wDates) {
      const day = S.days[d];
      const t   = getEffectiveTotals(day);
      sumK += t.kcal; sumP += t.p; sumG += t.g; sumL += t.l;
      if (day.burned) { sumB += day.burned; bCount++; }
      if (day.type === 'sport') sport++;
    }
    const avgK = Math.round(sumK/n);
    const avgB = bCount ? Math.round(sumB/bCount) : null;
    const def  = avgB ? avgB - avgK : null;
    lines.push(`### ${wg.label}`);
    lines.push(`- ${n} jours journalisés : ${sport} Sport · ${n-sport} Repos`);
    lines.push(`- Moy. kcal ingérées : **${avgK} kcal** | P ${+(sumP/n).toFixed(1)}g | G ${+(sumG/n).toFixed(1)}g | L ${+(sumL/n).toFixed(1)}g`);
    if (avgB) lines.push(`- Moy. kcal dépensées (Watch) : ${avgB} kcal`);
    if (def)  lines.push(`- Déficit moyen : **${def > 0 ? '−'+def : '+'+Math.abs(def)} kcal/j**`);
    lines.push('');
  }

  lines.push('---\n');
  lines.push('## Détail par jour\n');

  for (const date of sortedDates) {
    const day = S.days[date];
    const d   = buildDayExportData(date, day);
    const isEst = d.journalise === 'estimé';
    const typeLabel = d.type === 'sport' ? 'Sport ⚡' : 'Repos 🌙';
    const deltaSign = v => v > 0 ? `+${v}` : `${v}`;

    lines.push(`### ${d.jour} — ${typeLabel}${isEst ? ' *(estimé)*' : ''}`);
    lines.push(`**Consommé :** ${d.consomme.kcal} kcal | P ${d.consomme.p}g | G ${d.consomme.g}g | L ${d.consomme.l}g`);
    lines.push(`**Objectif :** ${d.objectifs.kcal} kcal | P ${d.objectifs.p}g | G ${d.objectifs.g}g | L ${d.objectifs.l}g`);
    lines.push(`**Delta :** ${deltaSign(d.delta.kcal)} kcal | P ${deltaSign(d.delta.p)}g | G ${deltaSign(d.delta.g)}g | L ${deltaSign(d.delta.l)}g`);
    if (d.calories_depensees_watch) {
      const def = d.deficit_net_kcal;
      lines.push(`**Watch :** ${d.calories_depensees_watch} kcal → ${def > 0 ? 'Déficit −'+def : 'Surplus +'+Math.abs(def)} kcal`);
    }
    if (d.creatine) lines.push(`**Créatine :** prise à ${d.creatine} 💪🏼`);

    if (isEst) {
      lines.push(`*Journée estimée globalement — pas de détail par repas*`);
    } else {
      for (const [mealName, mealData] of Object.entries(d.repas)) {
        lines.push(`\n**${mealName}** (${mealData.total.kcal} kcal | P ${mealData.total.p}g | G ${mealData.total.g}g | L ${mealData.total.l}g)`);
        for (const item of mealData.aliments) {
          lines.push(`  - ${item.nom} — ${item.quantite} → ${item.kcal} kcal | P ${item.p}g | G ${item.g}g | L ${item.l}g`);
        }
      }
    }
    lines.push('');
  }

  download(`macros-historique${from ? '_'+from+'_au_'+cutTo : '-ia'}.md`, lines.join('\n'), 'text/markdown;charset=utf-8;');
  showToast(`Markdown exporté — ${sortedDates.length} jour(s)`);
}

// ── Export CSV Aliments ───────────────────────────────────────

function exportFoodsCSV() {
  const header = 'Marque,Nom,Calories,Proteines,Glucides,Lipides,PoidsUnitaire,Utilisations';
  const rows = S.foods
    .filter(f => !f._virtual)
    .sort((a, b) => foodUseCount(b.id) - foodUseCount(a.id)) // tri par usage décroissant
    .map(f => {
      const sep    = f.name.indexOf(' — ');
      const marque = sep > -1 ? f.name.slice(0, sep) : '';
      const nom    = sep > -1 ? f.name.slice(sep + 3) : f.name;
      const count  = foodUseCount(f.id);
      return [marque, nom, f.kcal, f.p, f.g, f.l, f.unitWeight || '', count].join(',');
    });
  const csv = [header, ...rows].join('\n');
  download('macros-aliments.csv', csv, 'text/csv;charset=utf-8;');
  showToast(`Aliments CSV exporté — ${rows.length} aliment(s)`);
}

// ── Export JSON Complet ───────────────────────────────────────

function exportFullJSON() {
  const foods = S.foods
    .filter(f => !f._virtual)
    .map(f => ({
      ...f,
      utilisations:    foodUseCount(f.id),
      derniere_utilisation: foodLastUsed(f.id) || null
    }));
  const data = {
    export_date: new Date().toISOString(),
    app: 'Mes Macros',
    days:  S.days,
    foods,
    meals: S.meals,
    goals: S.goals
  };
  download('macros-complet.json', JSON.stringify(data, null, 2), 'application/json');
  showToast('Export complet JSON téléchargé !');
}

function download(filename, content, mime) {
  const a = document.createElement('a');
  a.href     = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}