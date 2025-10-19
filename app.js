// ===== helpers =====
function getPayload(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent || "{}"); } catch { return null; }
}

// универсальный авто-ресайз для любого plotly-графика
function attachAutoResize(el) {
  const ro = new ResizeObserver(() => {
    try { Plotly.Plots.resize(el); } catch {}
  });
  ro.observe(el);
}

// Быстрое правило: на узких экранах — 1 график в ряд (span 12),
// на широких — 2 графика в ряд (span 6)
function computeSpan() {
  return window.matchMedia('(max-width: 900px)').matches ? 12 : 6;
}

// переназначить span всем дочерним .chart внутри контейнера-сетки
function applySpans(container) {
  const span = computeSpan();
  Array.from(container.querySelectorAll('.chart')).forEach(div => {
    div.style.gridColumn = `span ${span}`;
  });
}

// следим за изменением ширины контейнера — обновляем span
function watchGrid(container) {
  const ro = new ResizeObserver(() => applySpans(container));
  ro.observe(container);
  // первичная расстановка
  applySpans(container);
}

// общий конфиг для plotly
const PLOTLY_CONFIG = { responsive: true, displayModeBar: false };

// ===== renderers =====
function renderOverview() {
  const data = getPayload("data-overview");
  if (!data) return;
  document.getElementById("shape").textContent = `${data.n_rows} × ${data.n_cols}`;

  const tbody = document.getElementById("dtypes-tbody");
  tbody.innerHTML = "";
  Object.entries(data.dtypes).forEach(([col, dtype]) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${col}</td><td>${dtype}</td>`;
    tbody.appendChild(tr);
  });
}

function renderMissing() {
  const data = getPayload("data-missing") || {};
  const categories = Object.keys(data);
  const values = Object.values(data);
  const div = document.getElementById("missing-chart");

  if (!categories.length) {
    div.innerHTML = "<em>Пропусков нет.</em>";
    return;
  }

  Plotly.newPlot(div, [{
    type: "bar",
    x: categories,
    y: values
  }], {
    title: "Пропуски по столбцам",
    margin: { t: 36, r: 10, b: 40, l: 50 },
    xaxis: { automargin: true, tickfont: { size: 11 } },
    yaxis: { title: "Количество", automargin: true, tickfont: { size: 11 } }
  }, PLOTLY_CONFIG);

  attachAutoResize(div);
}

function renderDists() {
  const d = getPayload("data-dists") || {};
  const container = document.getElementById("dist-charts");
  container.innerHTML = "";

  // следим за контейнером и расставляем span детям
  watchGrid(container);

  Object.entries(d).forEach(([col, arr]) => {
    const div = document.createElement("div");
    div.className = "chart";
    // span выставится через applySpans/watchGrid
    container.appendChild(div);

    const trace = {
      x: arr,
      type: "histogram",
      nbinsx: 40,
      hovertemplate: "%{x}<extra></extra>"
    };

    const layout = {
      title: `Распределение: ${col}`,
      margin: { t: 36, r: 10, b: 40, l: 50 },
      autosize: true,
      xaxis: { automargin: true, tickfont: { size: 11 } },
      yaxis: { automargin: true, tickfont: { size: 11 } }
    };

    Plotly.newPlot(div, [trace], layout, PLOTLY_CONFIG);
    attachAutoResize(div);
  });

  // первичное выставление span (на случай, если графики уже добавлены)
  applySpans(container);
}

function renderCats() {
  const body = getPayload("data-cat-body") || [];
  const drive = getPayload("data-cat-drive") || [];
  const make = getPayload("data-cat-make") || [];

  const makeDiv = document.getElementById("cat-make");
  const bodyDiv = document.getElementById("cat-body");
  const driveDiv = document.getElementById("cat-drive");

  const mk = { x: make.map(o=>o.category), y: make.map(o=>o.count), type: "bar" };
  const bd = { x: body.map(o=>o.category), y: body.map(o=>o.count), type: "bar" };
  const dw = { x: drive.map(o=>o.category), y: drive.map(o=>o.count), type: "bar" };

  const layoutCommon = {
    margin: { t: 36, r: 10, b: 60, l: 50 },
    xaxis: { automargin: true, tickangle: -30, tickfont: { size: 11 } },
    yaxis: { automargin: true, tickfont: { size: 11 } }
  };

  Plotly.newPlot(makeDiv, [mk], { ...layoutCommon, title: "TOP-15 брендов (частоты)" }, PLOTLY_CONFIG);
  Plotly.newPlot(bodyDiv, [bd], { ...layoutCommon, title: "Body style (частоты)" }, PLOTLY_CONFIG);
  Plotly.newPlot(driveDiv, [dw], { ...layoutCommon, title: "Drive wheels (частоты)" }, PLOTLY_CONFIG);

  attachAutoResize(makeDiv);
  attachAutoResize(bodyDiv);
  attachAutoResize(driveDiv);
}

function renderCorr() {
  const payload = getPayload("data-corr");
  if (!payload) return;
  const cols = payload.columns;
  const z = payload.matrix;

  const div = document.getElementById("corr-heatmap");
  Plotly.newPlot(div, [{
    z: z, x: cols, y: cols, type: "heatmap", zmin: -1, zmax: 1,
    colorbar: { thickness: 12 }
  }], {
    title: "Матрица корреляций",
    margin: { t: 36, r: 30, b: 40, l: 60 },
    xaxis: { automargin: true, tickfont: { size: 10 } },
    yaxis: { automargin: true, tickfont: { size: 10 } }
  }, PLOTLY_CONFIG);

  attachAutoResize(div);
}

function renderConclusions() {
  const payload = getPayload("data-conclusions") || { bullets: [] };
  const ul = document.getElementById("conclusions-list");
  ul.innerHTML = "";
  payload.bullets.forEach(b => {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  });
}

function renderEngineered() {
  const payload = getPayload("data-engineered") || { new_features: [] };
  const ul = document.getElementById("engineered-list");
  ul.innerHTML = "";
  payload.new_features.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    ul.appendChild(li);
  });
}

function renderHeadTable() {
  const payload = getPayload("data-head") || { rows: [] };
  const rows = payload.rows || [];
  const table = document.getElementById("head-table");
  const thead = document.getElementById("head-thead");
  const tbody = document.getElementById("head-tbody");
  table.style.display = rows.length ? "table" : "none";
  if (!rows.length) return;

  const cols = Object.keys(rows[0]);
  thead.innerHTML = "<tr>" + cols.map(c=>`<th>${c}</th>`).join("") + "</tr>";
  tbody.innerHTML = rows.map(r=>"<tr>"+cols.map(c=>`<td>${r[c]}</td>`).join("")+"</tr>").join("");
}

// ===== bootstrap =====
function hydrateAll() {
  renderOverview();
  renderMissing();
  renderDists();        // теперь нормальная сетка и ресайз
  renderCats();
  renderCorr();
  renderConclusions();
  renderEngineered();
  renderHeadTable();
}

function observeReady() {
  const flag = document.getElementById("eda-ready-flag");
  if (!flag) return;

  const runIfReady = () => {
    if (flag.textContent === "ready") hydrateAll();
  };

  runIfReady();
  const obs = new MutationObserver(runIfReady);
  obs.observe(flag, { childList: true });
}

document.addEventListener("DOMContentLoaded", observeReady);
