(function () {
  const CFG = window.APP_CONFIG;
  const state = {
    lang: "fr",
    items: [],
    meta: null,
    view: "home",
    layout: "grid",
    query: "",
    filters: { app: "", trend: "", market: "", date: "", trendType: "", country: "" },
    matrixActive: null,
    lastVisitSeen: JSON.parse(localStorage.getItem("ir_seen_ids") || "[]"),
    shortlist: JSON.parse(localStorage.getItem("ir_shortlist") || "[]"), // array of {type:'inno'|'bev', id}
    watchlist: { clients: [], competitors: [] }
  };

  function isShortlisted(type, id) {
    return state.shortlist.some(s => s.type === type && s.id === id);
  }
  function toggleShortlist(type, id) {
    const idx = state.shortlist.findIndex(s => s.type === type && s.id === id);
    if (idx >= 0) state.shortlist.splice(idx, 1);
    else state.shortlist.push({ type, id });
    localStorage.setItem("ir_shortlist", JSON.stringify(state.shortlist));
    render();
  }
  // Expose for inline onclick handlers
  window.__toggleShortlist = toggleShortlist;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const t = (key) => CFG.I18N[state.lang][key] || key;

  // ---------------------------------------------------------------------
  // DATA LOADING
  // ---------------------------------------------------------------------
  async function loadData() {
    try {
      const res = await fetch("/api/innovations", { cache: "no-store" });
      if (!res.ok) throw new Error("api-error");
      const json = await res.json();
      state.items = json.items || [];
      state.meta = json.meta || null;
    } catch (e) {
      // Fallback local (utile en dev sans Netlify, ou si le sync n'a jamais tourné)
      try {
        const res = await fetch("data/innovations.json");
        state.items = await res.json();
        state.meta = { lastSync: null, sourceStatuses: [] };
      } catch (e2) {
        state.items = [];
        state.meta = null;
      }
    }
    render();
  }

  async function syncNow() {
    const btn = $("#syncBtn");
    btn.disabled = true;
    btn.querySelector(".lbl").textContent = t("syncing");
    try {
      await fetch("/api/sync-now", { method: "POST" });
    } catch (e) { /* ignore, on recharge quand même */ }
    await loadData();
    await loadWatchlist();
    btn.disabled = false;
    btn.querySelector(".lbl").textContent = t("syncNow");
  }

  // ---------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------
  function isWithin(days, dateStr) {
    const d = new Date(dateStr).getTime();
    return Date.now() - d <= days * 24 * 3600 * 1000;
  }

  function isNew(item) {
    return isWithin(1, item.publishedAt);
  }

  function filteredItems() {
    return state.items.filter(it => {
      if (state.filters.app && it.category !== state.filters.app) return false;
      if (state.filters.trend && !(it.tags || []).includes(state.filters.trend)) return false;
      if (state.filters.market) {
        const inMarket = it.country === state.filters.market || (it.africaMarkets || []).includes(state.filters.market);
        if (!inMarket) return false;
      }
      if (state.filters.date) {
        const map = { today: 1, last7: 7, last30: 30, last90: 90 };
        if (!isWithin(map[state.filters.date], it.publishedAt)) return false;
      }
      if (state.query) {
        const q = state.query.toLowerCase();
        const hay = [it.title, it.description, it.source, it.category, ...(it.tags || [])].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }

  function escapeHtml(s = "") {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  function formatDate(dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString(state.lang === "fr" ? "fr-FR" : "en-US", { day: "2-digit", month: "short", year: "numeric" });
    } catch (e) { return dateStr; }
  }

  // ---------------------------------------------------------------------
  // RENDER: CARDS
  // ---------------------------------------------------------------------
  function cardHtml(item) {
    const img = item.image
      ? `<img src="${escapeHtml(item.image)}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<svg class=&quot;fi ph-icon&quot; viewBox=&quot;0 0 24 24&quot; fill=&quot;none&quot; stroke=&quot;currentColor&quot; stroke-width=&quot;1.6&quot;><rect x=&quot;3&quot; y=&quot;3&quot; width=&quot;18&quot; height=&quot;18&quot; rx=&quot;3&quot;/><circle cx=&quot;8.5&quot; cy=&quot;8.5&quot; r=&quot;1.5&quot;/><path d=&quot;M21 15l-5-5L5 21&quot;/></svg>'">`
      : `<svg class="fi ph-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`;
    return `
      <article class="inno-card">
        <div class="card-img">
          ${isNew(item) ? `<span class="badge-new">${t("newBadge")}</span>` : ""}
          ${img}
        </div>
        <div class="card-body">
          <div class="card-tags" style="justify-content:space-between;align-items:flex-start">
            <div style="display:flex;gap:6px;flex-wrap:wrap">${(item.tags || []).slice(0, 3).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
            <button class="star-btn ${isShortlisted("inno", item.id) ? "active" : ""}" onclick="window.__toggleShortlist('inno','${item.id}')" title="${t("addToShortlist")}">★</button>
          </div>
          <h3 class="card-title">${escapeHtml(item.title)}</h3>
          <p class="card-desc">${escapeHtml(item.description)}</p>
          <div class="card-meta">
            <span class="card-source">${escapeHtml(item.source)}</span>
            <span>${formatDate(item.publishedAt)}</span>
          </div>
          <a class="card-link" href="${escapeHtml(item.url)}" target="_blank" rel="noopener">
            ${t("viewSource")}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 17L17 7M7 7h10v10"/></svg>
          </a>
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------------
  // RENDER: EACH VIEW
  // ---------------------------------------------------------------------
  function renderDashboard() {
    const total = state.items.length;
    const new24h = state.items.filter(i => isWithin(1, i.publishedAt)).length;
    const new7d = state.items.filter(i => isWithin(7, i.publishedAt)).length;
    const sourcesCount = CFG.SOURCES.length;

    $("#statTotal").textContent = total;
    $("#stat24h").textContent = new24h;
    $("#stat7d").textContent = new7d;
    $("#statSources").textContent = sourcesCount;

    const grid = $("#dashboardGrid");
    const recent = [...state.items].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)).slice(0, 6);
    grid.innerHTML = recent.length ? recent.map(cardHtml).join("") : emptyStateHtml();
  }

  function emptyStateHtml() {
    return `<div class="empty-state">
      <svg class="fi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <div>${t("noResults")}</div>
    </div>`;
  }

  function renderLatest() {
    const grid = $("#latestGrid");
    grid.className = "cards-grid" + (state.layout === "list" ? " list-mode" : "");
    const items = filteredItems().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    grid.innerHTML = items.length ? items.map(cardHtml).join("") : emptyStateHtml();
  }

  function renderTrends() {
    const counts = {};
    CFG.TRENDS.forEach(tr => counts[tr] = 0);
    state.items.forEach(it => (it.tags || []).forEach(tag => { if (counts[tag] !== undefined) counts[tag]++; }));
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = Math.max(1, sorted[0]?.[1] || 1);
    $("#trendList").innerHTML = sorted.map(([name, count]) => `
      <div class="trend-row">
        <div class="trend-name">${escapeHtml(name)}</div>
        <div class="trend-bar-track"><div class="trend-bar-fill" style="width:${(count / max * 100).toFixed(0)}%"></div></div>
        <div class="trend-count">${count}</div>
      </div>`).join("");
  }

  function renderIow() {
    const sorted = [...state.items].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    const pick = sorted[0];
    const box = $("#iowBox");
    if (!pick) { box.innerHTML = emptyStateHtml(); return; }
    box.innerHTML = `
      <div class="iow-card">
        <div class="iow-img">
          ${pick.image ? `<img src="${escapeHtml(pick.image)}" alt="">` : `<svg class="fi" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M12 2l2.9 6.6L22 9.3l-5 4.9 1.2 7.1L12 17.8 5.8 21.3 7 14.2 2 9.3l7.1-.7z"/></svg>`}
        </div>
        <div class="iow-body">
          <div class="iow-star">⭐ ${t("iowTitle")}</div>
          <h3 class="iow-title">${escapeHtml(pick.title)}</h3>
          <p class="card-desc">${escapeHtml(pick.description)}</p>
          <div class="card-tags">${(pick.tags || []).map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>
          <div class="iow-why"><b>${t("iowWhy")}:</b> ${escapeHtml(pick.source)} — ${escapeHtml(pick.category)}, publié le ${formatDate(pick.publishedAt)}.</div>
          <a class="card-link" href="${escapeHtml(pick.url)}" target="_blank" rel="noopener">${t("viewSource")} →</a>
        </div>
      </div>`;
  }

  function bevTrendCardHtml(tr) {
    const scoreSlug = tr.overallScore.replace(/\s+/g, "-");
    const name = state.lang === "fr" ? tr.name_fr : tr.name;
    const desc = state.lang === "fr" ? tr.desc_fr : tr.desc_en;
    const opp = state.lang === "fr" ? tr.opportunity_fr : tr.opportunity_en;
    const q = state.lang === "fr" ? tr.strategicQuestion_fr : tr.strategicQuestion_en;
    return `
      <article class="bevtrend-card">
        <div class="bevtrend-head">
          <div>
            <div class="bevtrend-num">${tr.num}</div>
            <div class="bevtrend-name">${escapeHtml(name)}</div>
            <div class="bevtrend-type">${escapeHtml(tr.trendType)}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <button class="star-btn ${isShortlisted("bev", tr.id) ? "active" : ""}" onclick="window.__toggleShortlist('bev','${tr.id}')" title="${t("addToShortlist")}">★</button>
            <span class="status-badge status-${tr.status}">${tr.status}</span>
          </div>
        </div>
        <p class="bevtrend-desc">${escapeHtml(desc)}</p>
        <div class="bevtrend-sub"><b>${t("applications")}:</b> ${escapeHtml((tr.applications || []).join(", "))}</div>
        <div class="bevtrend-sub"><b>${t("regionalRelevance")}:</b> ${escapeHtml(tr.regionalRelevance)}</div>
        <div class="bevtrend-sub"><b>${t("opportunity")}:</b> ${escapeHtml(opp)}</div>
        ${tr.flavors && tr.flavors.length ? `<div class="bevtrend-flavors">${tr.flavors.map(f => `<span class="tag">${escapeHtml(f)}</span>`).join("")}</div>` : ""}
        <div class="bevtrend-question">💬 ${escapeHtml(q)}</div>
        <div class="bevtrend-footer">
          <span class="score-badge score-${scoreSlug}">${tr.overallScore}</span>
        </div>
      </article>`;
  }

  function renderDriverGrid() {
    const max = Math.max(...CFG.CONSUMER_DRIVERS.map(d => d.weight));
    $("#driverGrid").innerHTML = CFG.CONSUMER_DRIVERS.map(d => `
      <div class="driver-row">
        <div class="driver-name">${escapeHtml(d.name)}</div>
        <div class="driver-desc">${escapeHtml(state.lang === "fr" ? d.desc_fr : d.desc_en)}</div>
        <div class="driver-bar-track"><div class="driver-bar-fill" style="width:${(d.weight / max * 100).toFixed(0)}%"></div></div>
      </div>`).join("");
  }

  function filteredBevTrends() {
    return CFG.BEVERAGE_TRENDS.filter(tr => !state.filters.trendType || tr.trendType === state.filters.trendType);
  }

  function renderBevTrends() {
    const grid = $("#bevTrendGrid");
    const items = filteredBevTrends();
    grid.innerHTML = items.length ? items.map(bevTrendCardHtml).join("") : emptyStateHtml();
  }

  function renderMatrix() {
    const wrap = $("#matrixChips");
    wrap.innerHTML = CFG.FLAVOR_INDUSTRY_MATRIX.map(row => `
      <button class="matrix-chip ${state.matrixActive === row.trend ? "active" : ""}" data-trend="${escapeHtml(row.trend)}">${escapeHtml(row.trend)}</button>
    `).join("");
    $$(".matrix-chip", wrap).forEach(btn => btn.addEventListener("click", () => {
      state.matrixActive = state.matrixActive === btn.dataset.trend ? null : btn.dataset.trend;
      renderMatrix();
    }));
    const flavorsEl = $("#matrixFlavors");
    const active = CFG.FLAVOR_INDUSTRY_MATRIX.find(r => r.trend === state.matrixActive);
    flavorsEl.innerHTML = active ? active.flavors.map(f => `<span class="tag">${escapeHtml(f)}</span>`).join("") : "";
  }

  function renderAromatechGrid() {
    $("#aromatechGrid").innerHTML = CFG.AROMATECH_OPPORTUNITIES.map(o => `
      <div class="aromatech-card">
        <div class="aromatech-num">${o.num}</div>
        <div class="aromatech-title">${escapeHtml(state.lang === "fr" ? o.title_fr : o.title_en)}</div>
        <div class="aromatech-desc">${escapeHtml(state.lang === "fr" ? o.desc_fr : o.desc_en)}</div>
        ${o.examples ? `<div class="bevtrend-flavors" style="margin-top:8px">${o.examples.map(e => `<span class="tag">${escapeHtml(e)}</span>`).join("")}</div>` : ""}
      </div>`).join("");
  }

  function renderLibrary() {
    $("#libraryGrid").innerHTML = CFG.AFRICA_FLAVOR_LIBRARY.map(ing => `
      <div class="library-card">
        <div class="library-icon">🌿</div>
        <div class="library-name">${escapeHtml(ing.name)}</div>
        <div class="library-desc">${escapeHtml(state.lang === "fr" ? ing.desc_fr : ing.desc_en)}</div>
      </div>`).join("");
  }

  function renderCountryView() {
    const country = state.filters.country;
    const innoItems = state.items.filter(it => {
      if (!country) return it.country === "Africa" || (it.africaMarkets || []).length > 0;
      return it.country === country || (it.africaMarkets || []).includes(country);
    });
    $("#countryGrid").innerHTML = innoItems.length ? innoItems.map(cardHtml).join("") : emptyStateHtml();

    // Toutes les tendances Beverage Trends sont potentiellement pertinentes ;
    // on met en avant celles à forte "African relevance".
    const bevItems = CFG.BEVERAGE_TRENDS.filter(tr => ["High", "Very High"].includes(tr.scoring.african));
    $("#countryBevTrendGrid").innerHTML = bevItems.map(bevTrendCardHtml).join("");
  }

  function renderShortlist() {
    const innoIds = new Set(state.shortlist.filter(s => s.type === "inno").map(s => s.id));
    const bevIds = new Set(state.shortlist.filter(s => s.type === "bev").map(s => s.id));
    const innoItems = state.items.filter(it => innoIds.has(it.id));
    const bevItems = CFG.BEVERAGE_TRENDS.filter(tr => bevIds.has(tr.id));
    $("#shortlistInnoGrid").innerHTML = innoItems.length ? innoItems.map(cardHtml).join("") : `<div class="empty-state">${t("shortlistEmpty")}</div>`;
    $("#shortlistBevGrid").innerHTML = bevItems.length ? bevItems.map(bevTrendCardHtml).join("") : "";
  }

  function renderScoringTable() {
    $("#scoringTbody").innerHTML = CFG.BEVERAGE_TRENDS.map(tr => {
      const scoreSlug = tr.overallScore.replace(/\s+/g, "-");
      return `<tr>
        <td><b>${escapeHtml(state.lang === "fr" ? tr.name_fr : tr.name)}</b></td>
        <td>${escapeHtml(tr.scoring.market)}</td>
        <td>${escapeHtml(tr.scoring.african)}</td>
        <td>${escapeHtml(tr.scoring.flavor)}</td>
        <td>${escapeHtml(tr.scoring.innovation)}</td>
        <td><span class="score-badge score-${scoreSlug}">${tr.overallScore}</span></td>
      </tr>`;
    }).join("");
  }

  // ---------------------------------------------------------------------
  // FLAVOR TRENDS 2026 — rapport éditorial
  // ---------------------------------------------------------------------
  let frMatrixActive = null;

  function frFlavorCardHtml(fl) {
    return `<div class="fr-flavor-card">
      <h4>${escapeHtml(fl.name)}</h4>
      ${fl.localName ? `<div class="local-name">${escapeHtml(fl.localName)}</div>` : ""}
      <div class="markets">${escapeHtml((fl.countries || []).join(" • "))}</div>
      <div class="positioning">${escapeHtml(fl.positioning)}</div>
      <div class="apps">${(fl.applications || []).map(a => `<span class="tag">${escapeHtml(a)}</span>`).join("")}</div>
    </div>`;
  }

  function renderFlavorReport() {
    if (!$("#frKpiRow")) return; // vue pas encore dans le DOM (sécurité)

    $("#frKpiRow").innerHTML = CFG.FLAVOR_TRENDS_2026_KPIS.map(k => `
      <div class="fr-kpi"><div class="ico">${k.icon}</div><div class="lbl">${escapeHtml(k.label)}</div></div>
    `).join("");

    $("#frOverviewGrid").innerHTML = CFG.FLAVOR_2026_OVERVIEW.map(o => `
      <div class="fr-overview-card">
        <h4>${escapeHtml(o.title)}</h4>
        <div class="items">${o.items.map(i => `<span class="tag">${escapeHtml(i)}</span>`).join("")}</div>
      </div>`).join("");

    const byCat = cat => CFG.FLAVOR_TRENDS_2026.filter(f => f.category === cat);
    $("#frBeverageGrid").innerHTML = byCat("Beverage").map(frFlavorCardHtml).join("");
    $("#frDairyGrid").innerHTML = byCat("Dairy").map(frFlavorCardHtml).join("");
    $("#frSavoryGrid").innerHTML = byCat("Savory").filter(f => f.name !== "Suya").map(frFlavorCardHtml).join("");

    const suya = CFG.FLAVOR_TRENDS_2026.find(f => f.name === "Suya");
    if (suya) {
      $("#frSuyaSpotlight").innerHTML = `
        <span class="badge">${t("frSuyaSpotlight")}</span>
        <h3>SUYA / YAJI</h3>
        <div class="composition">Peanut + Ginger + Chili + Bouillon</div>
        <div class="apps-line">${escapeHtml(suya.applications.join(" | "))}</div>
        <p>${t("frSuyaQuote")}</p>`;
    }

    $("#frRegionGrid").innerHTML = CFG.FLAVOR_2026_REGIONS.map(r => `
      <div class="fr-region-card">
        <h4>${escapeHtml(r.title)}</h4>
        <div class="fr-region-flags">${r.countries.map(c => c.flag).join(" ")}</div>
        <div class="fr-region-trends">${r.trends.map(tr => `<span class="tag">${escapeHtml(tr)}</span>`).join("")}</div>
        <div class="fr-region-tooltip">
          <b>${r.countries.map(c => c.name).join(", ")}</b><br>
          ${escapeHtml(r.strongCategories)}<br>
          <i>${escapeHtml(r.applications)}</i>
        </div>
      </div>`).join("");

    const matrixWrap = $("#frMatrixFlavors");
    matrixWrap.innerHTML = CFG.FLAVOR_TRENDS_2026.map(f => `
      <button class="${frMatrixActive === f.name ? "active" : ""}" data-flavor="${escapeHtml(f.name)}">${escapeHtml(f.name)}</button>
    `).join("");
    $$("button", matrixWrap).forEach(btn => btn.addEventListener("click", () => {
      frMatrixActive = frMatrixActive === btn.dataset.flavor ? null : btn.dataset.flavor;
      renderFlavorReport();
    }));
    const resultEl = $("#frMatrixResult");
    const activeFlavor = CFG.FLAVOR_TRENDS_2026.find(f => f.name === frMatrixActive);
    resultEl.innerHTML = activeFlavor
      ? `<b>${escapeHtml(activeFlavor.name)}</b> → ${activeFlavor.applications.map(a => `<span class="tag" style="margin:0 4px">${escapeHtml(a)}</span>`).join("")}`
      : `<i style="color:var(--gray-500)">${t("frMatrixHint")}</i>`;

    $("#frOppGrid").innerHTML = CFG.FLAVOR_2026_OPPORTUNITIES.map(o => `
      <div class="fr-opp-card">
        <div class="ico">${o.icon}</div>
        <h4>${escapeHtml(o.title)}</h4>
        <p>${escapeHtml(state.lang === "fr" ? o.desc_fr : o.desc_en)}</p>
      </div>`).join("");

    $("#frAromatechGrid").innerHTML = CFG.FLAVOR_2026_AROMATECH_ANGLE.map(a => `
      <div class="fr-aromatech-card">
        <div class="num">${a.num}</div>
        <h4>${escapeHtml(a.title)}</h4>
        <p>${escapeHtml(state.lang === "fr" ? a.desc_fr : a.desc_en)}</p>
      </div>`).join("");

    $("#frSources").innerHTML = CFG.FLAVOR_2026_SOURCES.map(s => `
      <a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.name)}</a>
    `).join("");
  }

  function renderOpportunities() {
    // Lecture indicative: on regroupe les items qui combinent >=2 tendances
    const combos = {};
    state.items.forEach(it => {
      const tags = (it.tags || []);
      if (tags.length >= 2) {
        const key = tags.slice(0, 2).join(" + ");
        combos[key] = combos[key] || { count: 0, category: it.category, tags };
        combos[key].count++;
      }
    });
    const entries = Object.entries(combos).sort((a, b) => b[1].count - a[1].count).slice(0, 8);
    const grid = $("#oppGrid");
    if (!entries.length) { grid.innerHTML = emptyStateHtml(); return; }
    grid.innerHTML = entries.map(([name, d]) => {
      const stars = Math.min(5, Math.max(1, d.count));
      return `<div class="opp-card">
        <div class="opp-tag">🔥 Opportunity</div>
        <div class="opp-title">${escapeHtml(name)}</div>
        <div class="opp-row"><span>Application</span><b>${escapeHtml(d.category || "—")}</b></div>
        <div class="opp-row"><span>Trend</span><b>${escapeHtml(d.tags.join(", "))}</b></div>
        <div class="opp-row"><span>Potential</span><span class="stars">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</span></div>
      </div>`;
    }).join("");
  }

  function renderSources() {
    const statusMap = {};
    (state.meta?.sourceStatuses || []).forEach(s => statusMap[s.id] = s);
    const rows = CFG.SOURCES.map(src => {
      const st = statusMap[src.id];
      let dotClass = "warning", label = state.lang === "fr" ? "Non synchronisé" : "Not synced yet", lastSync = "—";
      if (st) {
        if (st.status === "active") { dotClass = ""; label = "Active"; }
        else if (st.status === "manual") { dotClass = "manual"; label = state.lang === "fr" ? "Accès manuel (activé)" : "Manual access (enabled)"; }
        else if (st.status === "warning") { dotClass = "warning"; label = "Warning"; }
        else { dotClass = "error"; label = "Error"; }
        lastSync = st.lastSync ? formatDate(st.lastSync) : "—";
      }
      return `<tr>
        <td><b>${escapeHtml(src.name)}</b><br><a href="${escapeHtml(src.url)}" target="_blank" rel="noopener" style="font-size:11px;color:var(--gray-500)">${escapeHtml(src.url)}</a></td>
        <td>${escapeHtml(src.category)}</td>
        <td>${escapeHtml(src.country)}</td>
        <td><span class="status-pill"><span class="dot ${dotClass}"></span>${label}</span></td>
        <td>${lastSync}</td>
      </tr>`;
    }).join("");
    $("#sourcesTbody").innerHTML = rows;

    const manualEl = $("#manualLinksList");
    if (manualEl) {
      manualEl.innerHTML = (CFG.MANUAL_LINKS || []).map(l => `
        <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener" title="${escapeHtml(state.lang === "fr" ? l.note_fr : l.note_en)}">🔗 ${escapeHtml(l.name)}</a>
      `).join("");
    }
  }

  function populateFilterOptions() {
    const fillSelect = (sel, values, allLabel) => {
      sel.innerHTML = `<option value="">${allLabel}</option>` + values.map(v => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
    };
    fillSelect($("#filterApp"), CFG.APPLICATIONS, t("all"));
    fillSelect($("#filterTrend"), CFG.TRENDS, t("all"));
    fillSelect($("#filterMarket"), CFG.MARKETS, t("all"));
    fillSelect($("#filterTrendType"), CFG.TREND_TYPES, t("all"));
    fillSelect($("#filterCountry"), CFG.AFRICA_MARKETS, t("allAfrica"));
  }

  function renderSyncStatus() {
    const el = $("#syncStatus");
    const dot = state.meta?.lastSync ? "" : "warning";
    const label = state.meta?.lastSync
      ? `${t("lastSync")}: ${formatDate(state.meta.lastSync)}`
      : `${t("lastSync")}: ${t("never")}`;
    el.innerHTML = `<span class="dot ${dot}"></span>${label}`;
  }

  async function loadWatchlist() {
    try {
      const res = await fetch("/api/watchlist", { cache: "no-store" });
      if (!res.ok) throw new Error("api-error");
      state.watchlist = await res.json();
    } catch (e) {
      // Pas de backend Netlify disponible (document autonome, ou hors ligne) :
      // on retombe sur une sauvegarde locale dans le navigateur.
      state.watchlist = JSON.parse(localStorage.getItem("ir_watchlist") || '{"clients":[],"competitors":[]}');
    }
    renderWatchLists();
  }

  async function addCompany(type, name, url, feedUrl) {
    try {
      const res = await fetch("/api/watchlist-add", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, name, url, feedUrl: feedUrl || null })
      });
      if (!res.ok) throw new Error("api-error");
      state.watchlist = await res.json();
    } catch (e) {
      const bucket = type === "client" ? "clients" : "competitors";
      const id = "wl_" + Date.now().toString(36);
      state.watchlist[bucket].push({
        id, name, url, feedUrl: feedUrl || null,
        status: feedUrl ? "pending" : "manual",
        addedAt: new Date().toISOString(), lastSync: null, items: []
      });
      localStorage.setItem("ir_watchlist", JSON.stringify(state.watchlist));
    }
    renderWatchLists();
  }

  async function removeCompany(type, id) {
    try {
      const res = await fetch("/api/watchlist-remove", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, id })
      });
      if (!res.ok) throw new Error("api-error");
      state.watchlist = await res.json();
    } catch (e) {
      const bucket = type === "client" ? "clients" : "competitors";
      state.watchlist[bucket] = state.watchlist[bucket].filter(c => c.id !== id);
      localStorage.setItem("ir_watchlist", JSON.stringify(state.watchlist));
    }
    renderWatchLists();
  }
  window.__removeCompany = removeCompany;

  function watchCardHtml(type, c) {
    const statusMap = { active: ["", t("watchStatusActive")], manual: ["manual", t("watchStatusManual")], warning: ["warning", t("watchStatusWarning")], pending: ["warning", t("watchStatusPending")] };
    const [dotClass, label] = statusMap[c.status] || statusMap.manual;
    return `<div class="watch-card">
      <div class="watch-card-head">
        <div>
          <h4>${escapeHtml(c.name)}</h4>
          <a class="site-link" href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.url)}</a>
        </div>
        <button class="watch-remove-btn" title="${t("watchRemoveBtn")}" onclick="window.__removeCompany('${type}','${c.id}')">✕</button>
      </div>
      <div class="watch-status-row">
        <span class="status-pill"><span class="dot ${dotClass}"></span>${label}</span>
        <span>${t("watchLastCheck")}: ${c.lastSync ? formatDate(c.lastSync) : "—"}</span>
      </div>
      <div class="watch-items">
        ${(c.items && c.items.length)
          ? c.items.slice(0, 4).map(it => `<div class="watch-item"><a href="${escapeHtml(it.url)}" target="_blank" rel="noopener">${escapeHtml(it.title)}</a><span class="date">${formatDate(it.publishedAt)}</span></div>`).join("")
          : `<div class="watch-item" style="color:var(--gray-500)">${t("watchNoItems")}</div>`}
      </div>
    </div>`;
  }

  function renderWatchLists() {
    const clientGrid = $("#clientWatchGrid");
    const compGrid = $("#competitorWatchGrid");
    if (clientGrid) {
      clientGrid.innerHTML = state.watchlist.clients.length
        ? state.watchlist.clients.map(c => watchCardHtml("client", c)).join("")
        : `<div class="empty-state">${t("watchEmpty")}</div>`;
    }
    if (compGrid) {
      compGrid.innerHTML = state.watchlist.competitors.length
        ? state.watchlist.competitors.map(c => watchCardHtml("competitor", c)).join("")
        : `<div class="empty-state">${t("watchEmpty")}</div>`;
    }
  }


  function render() {
    renderDashboard();
    renderLatest();
    renderTrends();
    renderIow();
    renderDriverGrid();
    renderBevTrends();
    renderMatrix();
    renderAromatechGrid();
    renderLibrary();
    renderCountryView();
    renderFlavorReport();
    renderOpportunities();
    renderScoringTable();
    renderShortlist();
    renderWatchLists();
    renderSources();
    renderSyncStatus();
  }

  // ---------------------------------------------------------------------
  // NAV / VIEW SWITCHING
  // ---------------------------------------------------------------------
  function switchView(id) {
    state.view = id;
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + id));
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === id));
    document.querySelector(".sidebar")?.classList.remove("open");
  }

  function applyI18n() {
    $$("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-placeholder]").forEach(el => { el.placeholder = t(el.dataset.i18nPlaceholder); });
    populateFilterOptions();
    render();
  }

  // ---------------------------------------------------------------------
  // WIRE UP
  // ---------------------------------------------------------------------
  function init() {
    $$(".nav-item").forEach(btn => btn.addEventListener("click", () => switchView(btn.dataset.view)));
    $("#menuToggle")?.addEventListener("click", () => $(".sidebar").classList.toggle("open"));

    $("#searchInput").addEventListener("input", (e) => { state.query = e.target.value; renderLatest(); });
    $("#filterApp").addEventListener("change", (e) => { state.filters.app = e.target.value; renderLatest(); });
    $("#filterTrend").addEventListener("change", (e) => { state.filters.trend = e.target.value; renderLatest(); });
    $("#filterMarket").addEventListener("change", (e) => { state.filters.market = e.target.value; renderLatest(); });
    $("#filterDate").addEventListener("change", (e) => { state.filters.date = e.target.value; renderLatest(); });
    $("#filterTrendType").addEventListener("change", (e) => { state.filters.trendType = e.target.value; renderBevTrends(); });
    $("#filterCountry").addEventListener("change", (e) => { state.filters.country = e.target.value; renderCountryView(); });

    $$(".view-toggle button").forEach(b => b.addEventListener("click", () => {
      state.layout = b.dataset.layout;
      $$(".view-toggle button").forEach(x => x.classList.toggle("active", x === b));
      renderLatest();
    }));

    $$(".lang-toggle button").forEach(b => b.addEventListener("click", () => {
      state.lang = b.dataset.lang;
      $$(".lang-toggle button").forEach(x => x.classList.toggle("active", x === b));
      applyI18n();
    }));

    $("#syncBtn").addEventListener("click", syncNow);

    const backToTop = $("#frBackToTop");
    if (backToTop) {
      window.addEventListener("scroll", () => {
        backToTop.classList.toggle("show", window.scrollY > 400);
      });
      backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
    }

    function wireWatchForm(formId, type) {
      const form = $(formId);
      if (!form) return;
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = fd.get("name").trim();
        const url = fd.get("url").trim();
        const feedUrl = (fd.get("feedUrl") || "").trim();
        if (!name || !url) return;
        addCompany(type, name, url, feedUrl);
        form.reset();
      });
    }
    wireWatchForm("#clientWatchForm", "client");
    wireWatchForm("#competitorWatchForm", "competitor");

    populateFilterOptions();
    loadData();
    loadWatchlist();
    // Auto-refresh toutes les 5 minutes (lecture seule, pas de sync forcé)
    setInterval(loadData, 5 * 60 * 1000);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
