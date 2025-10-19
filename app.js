// ============ helpers ============
function getPayload(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try { return JSON.parse(el.textContent || "{}"); } catch { return null; }
}

const PLOTLY_CONFIG = { responsive: true, displayModeBar: false };

function attachAutoResize(el) {
  const ro = new ResizeObserver(() => {
    try { Plotly.Plots.resize(el); } catch {}
  });
  ro.observe(el);
}

// ============ renderers ============
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
    div.innerHTML = "<em>No missing values.</em>";
    return;
  }

  Plotly.newPlot(div, [{
    type: "bar",
    x: categories,
    y: values
  }], {
    title: "Missing values in columns",
    margin: { t: 36, r: 10, b: 40, l: 50 },
    xaxis: { automargin: true, tickfont: { size: 11 } },
    yaxis: { title: "Quantity", automargin: true, tickfont: { size: 11 } }
  }, PLOTLY_CONFIG);

  attachAutoResize(div);
}

/**
 * ОДИН график + селект числовых колонок.
 */
function renderDists() {
  const d = getPayload("data-dists") || {};
  const container = document.getElementById("dist-charts");

  // полная очистка контейнера (чтобы не осталось старых mini-чартов)
  container.replaceChildren();

  const cols = Object.keys(d);
  if (!cols.length) {
    container.innerHTML = "<em>No numeric columns.</em>";
    return;
  }

  // UI: селект + количество корзин + вид графика
  const ui = document.createElement("div");
  ui.className = "controls";
  ui.style.marginBottom = "8px";

  const mkLabel = (text) => {
    const l = document.createElement("label");
    l.textContent = text;
    l.style.opacity = 0.8;
    return l;
  };

  const select = document.createElement("select");
  Object.assign(select.style, {
    background: "#0c1430",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "8px 10px",
    minWidth: "220px"
  });
  cols.forEach(c => {
    const opt = document.createElement("option");
    opt.value = c; opt.textContent = c;
    select.appendChild(opt);
  });

  const bins = document.createElement("input");
  Object.assign(bins, { type: "number", min: "5", max: "200", value: "40", step: "5" });
  Object.assign(bins.style, {
    width: "90px",
    background: "#0c1430",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "8px 10px"
  });

  const mode = document.createElement("select");
  ["hist","box","violin"].forEach(m => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = ({hist:"Histogram", box:"Box plot", violin:"Violin"})[m];
    mode.appendChild(o);
  });
  Object.assign(mode.style, {
    background: "#0c1430",
    color: "var(--text)",
    border: "1px solid var(--border)",
    borderRadius: "12px",
    padding: "8px 10px",
    minWidth: "160px"
  });

  ui.appendChild(mkLabel("Column:"));
  ui.appendChild(select);
  ui.appendChild(mkLabel("Plot type:"));
  ui.appendChild(mode);
  ui.appendChild(mkLabel("Buckets:"));
  ui.appendChild(bins);

  // контейнер для одного графика
  const plot = document.createElement("div");
  plot.id = "dist-chart";
  plot.className = "chart";

  container.appendChild(ui);
  container.appendChild(plot);

  const draw = () => {
    const col = select.value;
    const arr = d[col] || [];
    const nb = Math.max(5, Math.min(200, parseInt(bins.value || "40", 10)));
    const m = mode.value;

    let trace, layoutTitle = `Distribution: ${col}`;

    if (m === "hist") {
      trace = {
        x: arr, type: "histogram", nbinsx: nb,
        hovertemplate: "%{x}<extra></extra>"
      };
    } else if (m === "box") {
      trace = {
        y: arr, type: "box", boxpoints: false,
        hovertemplate: "%{y}<extra></extra>"
      };
      layoutTitle = `Box plot: ${col}`;
    } else { // violin
      trace = {
        y: arr, type: "violin", points: "none",
        hovertemplate: "%{y}<extra></extra>"
      };
      layoutTitle = `Violin: ${col}`;
    }

    const layout = {
      title: layoutTitle,
      margin: { t: 36, r: 10, b: 40, l: 50 },
      autosize: true,
      xaxis: { automargin: true, tickfont: { size: 11 } },
      yaxis: { automargin: true, tickfont: { size: 11 }, title: m==="hist" ? "Frequency" : "" }
    };

    Plotly.newPlot(plot, [trace], layout, PLOTLY_CONFIG);
    attachAutoResize(plot);
  };

  // события
  select.addEventListener("change", draw);
  mode.addEventListener("change", draw);
  bins.addEventListener("input", draw);
  bins.addEventListener("change", draw);

  // первый рендер
  draw();
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

  Plotly.newPlot(makeDiv, [mk], { ...layoutCommon, title: "TOP-15 brands (frequences)" }, PLOTLY_CONFIG);
  Plotly.newPlot(bodyDiv, [bd], { ...layoutCommon, title: "Body style (frequences)" }, PLOTLY_CONFIG);
  Plotly.newPlot(driveDiv, [dw], { ...layoutCommon, title: "Drive wheels (frequences)" }, PLOTLY_CONFIG);

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
    title: "Correlation matrix",
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

// ============ bootstrap ============
function hydrateAll() {
  renderOverview();
  renderMissing();
  renderDists();        // <- селект + одиночная гистограмма/box/violin
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
