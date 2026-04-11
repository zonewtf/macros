class MacrosApp {
  constructor() {
    this.initData();
    this.currentDate = new Date().toISOString().split('T')[0];
    this.activeTab = 'today';
    this.render();
  }

  initData() {
    const defaultGoals = {
      sport: { kcal: 2500, p: 160, c: 250, f: 80 },
      rest: { kcal: 2000, p: 150, c: 120, f: 70 }
    };
    this.goals = JSON.parse(localStorage.getItem('macros_goals')) || defaultGoals;
    this.foods = JSON.parse(localStorage.getItem('macros_foods')) || [];
    this.days = JSON.parse(localStorage.getItem('macros_days')) || {};
  }

  save() {
    localStorage.setItem('macros_goals', JSON.stringify(this.goals));
    localStorage.setItem('macros_foods', JSON.stringify(this.foods));
    localStorage.setItem('macros_days', JSON.stringify(this.days));
  }

  getDay(date) {
    if (!this.days[date]) {
      this.days[date] = { type: 'sport', meals: [[],[],[],[],[],[]] };
      this.save();
    }
    return this.days[date];
  }

  navigate(tab) {
    this.activeTab = tab;
    document.querySelectorAll('.nav-item').forEach((el, idx) => {
      el.classList.toggle('active', ['today','history','foods','settings'].indexOf(tab) === idx);
    });
    this.render();
  }

  /* --- RENDERS --- */
  render() {
    const root = document.getElementById('app');
    if (this.activeTab === 'today') root.innerHTML = this.renderDayView(this.currentDate);
    else if (this.activeTab === 'history') root.innerHTML = this.renderHistory();
    else if (this.activeTab === 'foods') root.innerHTML = this.renderFoods();
    else if (this.activeTab === 'settings') root.innerHTML = this.renderSettings();
  }

  renderDayView(date) {
    const day = this.getDay(date);
    const goals = this.goals[day.type];
    
    // Calculate totals
    let tKcal = 0, tP = 0, tC = 0, tF = 0;
    day.meals.flat().forEach(entry => {
      const ratio = entry.amount / 100;
      tKcal += entry.food.kcal * ratio;
      tP += entry.food.p * ratio; tC += entry.food.c * ratio; tF += entry.food.f * ratio;
    });

    const isToday = date === this.currentDate;
    const tomorrow = new Date(new Date(date).getTime() + 86400000).toISOString().split('T')[0];

    let mealsHtml = '';
    for(let i=0; i<6; i++) {
      let itemsHtml = day.meals[i].map((entry, idx) => `
        <div class="meal-item" onclick="app.openEditEntry('${date}', ${i}, ${idx})">
          <div>${entry.food.name} <span style="color:#888;font-size:12px">${entry.amount}g</span></div>
          <div>${Math.round((entry.food.kcal * entry.amount)/100)} kcal</div>
        </div>
      `).join('');
      mealsHtml += `
        <div class="meal-section">
          <div class="meal-header">
            <h3>Repas ${i+1}</h3>
            <button class="btn" style="padding: 6px 12px; font-size: 14px;" onclick="app.openAddFood('${date}', ${i})">+ Ajouter</button>
          </div>
          ${itemsHtml}
        </div>
      `;
    }

    const pct = Math.min((tKcal / goals.kcal) * 100, 100);
    const strokeDash = 251.2; // 2 * pi * 40
    const offset = strokeDash - (pct / 100) * strokeDash;

    return `
      <header>
        <h1>${isToday ? "Aujourd'hui" : date}</h1>
        <div class="badge ${day.type}" onclick="app.toggleDayType('${date}')">${day.type === 'sport' ? 'Sport ⚡' : 'Repos'}</div>
      </header>
      
      <div class="card">
        <div class="ring-container">
          <svg width="120" height="120" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#333" stroke-width="10"/>
            <circle cx="50" cy="50" r="40" fill="none" stroke="white" stroke-width="10" 
                    stroke-dasharray="${strokeDash}" stroke-dashoffset="${offset}" 
                    stroke-linecap="round" style="transition: 0.5s; transform: rotate(-90deg); transform-origin: 50% 50%;"/>
          </svg>
          <div class="ring-text">
            <div>${Math.round(tKcal)}</div>
            <span>/ ${goals.kcal}</span>
          </div>
        </div>

        <div class="macro-bars">
          ${this.renderMacroBar('Protéines', tP, goals.p, 'var(--p)')}
          ${this.renderMacroBar('Glucides', tC, goals.c, 'var(--c)')}
          ${this.renderMacroBar('Lipides', tF, goals.f, 'var(--f)')}
        </div>
        
        <div style="display:flex; gap:10px; margin-top:20px;">
          <div class="pill ${goals.p - tP < 0 ? 'over' : ''}" style="flex:1">${Math.round(goals.p - tP)}g P</div>
          <div class="pill ${goals.c - tC < 0 ? 'over' : ''}" style="flex:1">${Math.round(goals.c - tC)}g G</div>
          <div class="pill ${goals.f - tF < 0 ? 'over' : ''}" style="flex:1">${Math.round(goals.f - tF)}g L</div>
        </div>
      </div>

      ${mealsHtml}

      ${isToday ? `<div style="padding: 16px"><button class="btn" style="width:100%" onclick="app.renderDayView('${tomorrow}'); document.getElementById('app').innerHTML = app.renderDayView('${tomorrow}')">Planifier demain →</button></div>` : 
                  `<div style="padding: 16px"><button class="btn" style="width:100%" onclick="app.render()">← Retour à Aujourd'hui</button></div>`}
    `;
  }

  renderMacroBar(name, current, goal, color) {
    const pct = Math.min((current / goal) * 100, 100);
    return `
      <div class="macro-col">
        <span style="color:${color}">${name}</span>
        <div class="progress-bg"><div class="progress-fill" style="width:${pct}%; background:${color}"></div></div>
        <span>${Math.round(current)} / ${goal}</span>
      </div>
    `;
  }

  renderHistory() {
    const dates = Object.keys(this.days).sort((a,b) => b.localeCompare(a));
    return `<header><h1>Historique</h1></header> ` + dates.map(date => {
      const d = this.days[date];
      return `
        <div class="card">
          <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
            <h3>${date}</h3>
            <span class="badge ${d.type}">${d.type}</span>
          </div>
          <button class="btn" style="width:100%" onclick="app.currentDate='${date}'; app.navigate('today'); document.getElementById('app').innerHTML = app.renderDayView('${date}')">✎ Modifier</button>
        </div>
      `;
    }).join('');
  }

  renderFoods() {
    let list = this.foods.map((f, i) => `
      <div class="food-list-item">
        <div><strong>${f.name}</strong><br><span style="color:#888; font-size:12px;">${f.kcal}kcal | ${f.p}P ${f.c}G ${f.f}L</span></div>
      </div>
    `).join('');
    return `
      <header>
        <h1>Ma Base</h1>
        <button class="btn" onclick="app.openNewFood()">+ Nouveau</button>
      </header>
      <div style="padding: 16px;">${list}</div>
    `;
  }

  renderSettings() {
    return `
      <header><h1>Réglages</h1></header>
      <div class="card">
        <h3>Exportation</h3>
        <p style="color:#888; margin:10px 0;">Sauvegarde tes données localement.</p>
        <button class="btn btn-primary" onclick="app.exportData()">Exporter JSON</button>
      </div>
    `;
  }

  /* --- ACTIONS & MODALS --- */
  toggleDayType(date) {
    this.days[date].type = this.days[date].type === 'sport' ? 'rest' : 'sport';
    this.save();
    this.render();
  }

  openModal(html) {
    document.getElementById('modal-body').innerHTML = html;
    document.getElementById('modal').classList.add('show');
  }
  
  closeModal() {
    document.getElementById('modal').classList.remove('show');
  }

  openAddFood(date, mealIndex) {
    let opts = this.foods.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    this.openModal(`
      <h3>Ajouter un aliment</h3>
      <select id="food-select" style="width:100%; padding:14px; background:#222; color:white; border:none; border-radius:12px; margin: 15px 0;">
        ${opts}
      </select>
      <input type="number" id="food-amount" placeholder="Quantité (grammes)" inputmode="numeric">
      <button class="btn btn-primary" style="width:100%; margin-top:10px;" onclick="app.saveEntry('${date}', ${mealIndex})">Ajouter</button>
    `);
  }

  saveEntry(date, mealIndex) {
    const foodId = document.getElementById('food-select').value;
    const amount = parseFloat(document.getElementById('food-amount').value);
    if(!amount || !foodId) return;
    
    const food = this.foods.find(f => f.id == foodId);
    this.days[date].meals[mealIndex].push({ food, amount });
    this.save();
    this.closeModal();
    this.render();
  }

  openEditEntry(date, mealIndex, entryIndex) {
    const entry = this.days[date].meals[mealIndex][entryIndex];
    this.openModal(`
      <h3>Modifier ${entry.food.name}</h3>
      <input type="number" id="edit-amount" value="${entry.amount}" inputmode="numeric">
      <div style="display:flex; gap:10px; margin-top:10px">
        <button class="btn btn-danger" style="flex:1" onclick="app.deleteEntry('${date}', ${mealIndex}, ${entryIndex})">Supprimer</button>
        <button class="btn btn-primary" style="flex:1" onclick="app.updateEntry('${date}', ${mealIndex}, ${entryIndex})">Enregistrer</button>
      </div>
    `);
  }

  updateEntry(date, mealIndex, entryIndex) {
    this.days[date].meals[mealIndex][entryIndex].amount = parseFloat(document.getElementById('edit-amount').value);
    this.save();
    this.closeModal();
    this.render();
  }

  deleteEntry(date, mealIndex, entryIndex) {
    this.days[date].meals[mealIndex].splice(entryIndex, 1);
    this.save();
    this.closeModal();
    this.render();
  }

  openNewFood() {
    this.openModal(`
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px">
        <h3>Créer un aliment</h3>
        <button class="btn" style="padding:8px" onclick="app.scanBarcode()">📷 Scan</button>
      </div>
      <input type="text" id="nf-name" placeholder="Nom">
      <input type="number" id="nf-kcal" placeholder="Kcal pour 100g" inputmode="numeric">
      <div style="display:flex; gap:10px">
        <input type="number" id="nf-p" placeholder="Prot" inputmode="numeric">
        <input type="number" id="nf-c" placeholder="Gluc" inputmode="numeric">
        <input type="number" id="nf-f" placeholder="Lip" inputmode="numeric">
      </div>
      <button class="btn btn-primary" style="width:100%; margin-top:10px" onclick="app.saveNewFood()">Créer dans la base</button>
    `);
  }

  saveNewFood() {
    const f = {
      id: Date.now(),
      name: document.getElementById('nf-name').value,
      kcal: parseFloat(document.getElementById('nf-kcal').value) || 0,
      p: parseFloat(document.getElementById('nf-p').value) || 0,
      c: parseFloat(document.getElementById('nf-c').value) || 0,
      f: parseFloat(document.getElementById('nf-f').value) || 0
    };
    if(!f.name) return;
    this.foods.push(f);
    this.save();
    this.closeModal();
    this.render();
  }

  async scanBarcode() {
    if (!('BarcodeDetector' in window)) {
      alert("Le scanner natif iOS (BarcodeDetector) n'est pas actif sur ce navigateur.");
      return;
    }
    // Note: L'implémentation complète nécessite d'ouvrir la caméra avec getUserMedia et un canvas.
    // Pour rester dans un fichier simple statique, voici la requête API OpenFoodFacts préparée :
    alert("Simulation: Code scanné (nécessite l'accès caméra via getUserMedia dans un environnement HTTPS).");
    /*
    Exemple de l'appel que tu ferais une fois le code EAN détecté :
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await res.json();
    document.getElementById('nf-name').value = data.product.product_name;
    document.getElementById('nf-kcal').value = data.product.nutriments['energy-kcal_100g'];
    */
  }

  exportData() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({days: this.days, foods: this.foods}));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", "macros_export.json");
    a.click();
  }
}

const app = new MacrosApp();