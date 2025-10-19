
// Helper to get JSON payload pushed by Python
function getPayload(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent || "{}"); } catch(e) { return null; }
}

function renderOverview() {
  const data = getPayload("data-overview");
  if (!data) return;
  document.getElementById("shape").textContent = `${data.n_rows} × ${data.n_cols}`;

  // dtypes table
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
  }], {title: "Пропуски по столбцам", xaxis: {automargin: true}, yaxis: {title: "Количество"}});
}

function renderDists() {
  const d = getPayload("data-dists") || {};
  const container = document.getElementById("dist-charts");
  container.innerHTML = "";
  Object.entries(d).forEach(([col, arr]) => {
    const div = document.createElement("div");
    div.className = "chart";
    container.appendChild(div);
    Plotly.newPlot(div, [{
      x: arr, type: "histogram"
    }], {title: `Распределение: ${col}`});
  });
}

function renderCats() {
  const body = getPayload("data-cat-body") || [];
  const drive = getPayload("data-cat-drive") || [];
  const make = getPayload("data-cat-make") || [];

  const makeDiv = document.getElementById("cat-make");
  const bodyDiv = document.getElementById("cat-body");
  const driveDiv = document.getElementById("cat-drive");

  const mk = {x: make.map(o=>o.category), y: make.map(o=>o.count), type: "bar"};
  const bd = {x: body.map(o=>o.category), y: body.map(o=>o.count), type: "bar"};
  const dw = {x: drive.map(o=>o.category), y: drive.map(o=>o.count), type: "bar"};

  Plotly.newPlot(makeDiv, [mk], {title: "TOP-15 брендов (частоты)", xaxis: {automargin: true}});
  Plotly.newPlot(bodyDiv, [bd], {title: "Body style (частоты)", xaxis: {automargin: true}});
  Plotly.newPlot(driveDiv, [dw], {title: "Drive wheels (частоты)", xaxis: {automargin: true}});
}

function renderCorr() {
  const payload = getPayload("data-corr");
  if (!payload) return;
  const cols = payload.columns;
  const z = payload.matrix;

  const div = document.getElementById("corr-heatmap");
  Plotly.newPlot(div, [{
    z: z, x: cols, y: cols, type: "heatmap", zmin: -1, zmax: 1
  }], {title: "Матрица корреляций"});
}

function renderConclusions() {
  const payload = getPayload("data-conclusions") || {bullets: []};
  const ul = document.getElementById("conclusions-list");
  ul.innerHTML = "";
  payload.bullets.forEach(b => {
    const li = document.createElement("li");
    li.textContent = b;
    ul.appendChild(li);
  });
}

function renderEngineered() {
  const payload = getPayload("data-engineered") || {new_features: []};
  const ul = document.getElementById("engineered-list");
  ul.innerHTML = "";
  payload.new_features.forEach(n => {
    const li = document.createElement("li");
    li.textContent = n;
    ul.appendChild(li);
  });
}

function renderHeadTable() {
  const payload = getPayload("data-head") || {rows: []};
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

function hydrateAll() {
  renderOverview();
  renderMissing();
  renderDists();
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
    if (flag.textContent === "ready") {
      hydrateAll();
    }
  };

  // Run immediately in case PyScript finished before the observer was attached.
  runIfReady();

  const obs = new MutationObserver(runIfReady);
  obs.observe(flag, {childList: true});
}

document.addEventListener("DOMContentLoaded", observeReady);
