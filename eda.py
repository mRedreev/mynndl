import json
import pandas as pd
import numpy as np

# ---- Detect environment: PyScript/Pyodide (browser) vs regular Python
IS_PYODIDE = False
try:
    from js import document, console  # available only in PyScript/Pyodide
    from pyodide.ffi import create_proxy
    import pyodide_http  # enables network access for pandas/urllib under Pyodide
    pyodide_http.patch_all()
    IS_PYODIDE = True
except Exception:
    # Fallback shims for local/regular Python so the same file runs in notebooks/CLI
    class _DummyConsole:
        def log(self, *a, **k): print(*a)
        def error(self, *a, **k): print(*a)
    class _DummyDocument:
        def getElementById(self, *a, **k): return None
        def createElement(self, *a, **k): return None
        def body(self): return None
    console = _DummyConsole()
    document = _DummyDocument()
    def create_proxy(fn): return fn

# ---- Constants
DATA_URL_DEFAULT = "https://github.com/mRedreev/mynndl/blob/codex/-eda-hjfild/data.csv"
AUTORUN = True  # auto-run in browser when PyScript is ready

# ---- Helpers
def coerce_numeric(df, cols):
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df

def load_and_clean(url: str = DATA_URL_DEFAULT) -> pd.DataFrame:
    df = pd.read_csv(url, decimal='.')
    df = df.replace('?', np.nan)
    if 'price' in df.columns:
        df = df[~df['price'].isna()].copy()
    numeric_guess = [
        'symboling','normalized-losses','wheel-base','length','width','height','curb-weight',
        'engine-size','bore','stroke','compression-ratio','horsepower','peak-rpm','city-mpg','highway-mpg','price'
    ]
    df = coerce_numeric(df, numeric_guess)
    return df.reset_index(drop=True)

def impute_values(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    num_cols_to_mean = ['bore','stroke','horsepower','peak-rpm','normalized-losses']
    cat_cols_to_mode = ['num-of-doors']
    for c in num_cols_to_mean:
        if c in work.columns:
            work[c] = work[c].astype(float)
            work[c] = work[c].fillna(work[c].mean())
    for c in cat_cols_to_mode:
        if c in work.columns:
            mode_val = work[c].mode(dropna=True)
            if len(mode_val):
                work[c] = work[c].fillna(mode_val.iloc[0])
    return work

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    if {'horsepower','curb-weight'}.issubset(work.columns):
        work['power_to_weight'] = work['horsepower'] / work['curb-weight']
    if {'length','width','height'}.issubset(work.columns):
        work['car_volume'] = work['length'] * work['width'] * work['height']
    if {'engine-size','bore','stroke'}.issubset(work.columns):
        work['displacement_proxy'] = work['engine-size'] * work['bore'] * work['stroke']
    if 'aspiration' in work.columns:
        work['is_turbo'] = (work['aspiration'].astype(str).str.lower() == 'turbo').astype(int)
    if 'num-of-doors' in work.columns:
        work['is_two_door'] = (work['num-of-doors'].astype(str).str.contains('two', case=False, na=False)).astype(int)
    return work

def missing_summary(df: pd.DataFrame):
    ms = df.isna().sum().sort_values(ascending=False)
    return ms[ms>0].to_dict()

def numeric_distributions(df: pd.DataFrame, cols):
    out = {}
    for c in cols:
        if c in df.columns and pd.api.types.is_numeric_dtype(df[c]):
            series = df[c].dropna().astype(float)
            out[c] = series.values.tolist()
    return out

def cat_frequencies(df: pd.DataFrame, col, top=15):
    data = []
    if col in df.columns:
        vc = df[col].astype(str).value_counts().head(top)
        data = [{'category': k, 'count': int(v)} for k, v in vc.items()]
    return data

def corr_matrix(df: pd.DataFrame, target_first=True):
    num_df = df.select_dtypes(include=[np.number]).dropna(axis=1, how='all')
    cmat = num_df.corr()
    if target_first and 'price' in cmat.columns:
        cols = ['price'] + [c for c in cmat.columns if c != 'price']
        cmat = cmat.loc[cols, cols]
    return {'columns': cmat.columns.tolist(), 'matrix': cmat.values.tolist()}

def top_price_correlations(df: pd.DataFrame, k=8):
    if 'price' not in df.columns:
        return []
    corr = df.select_dtypes(include=[np.number]).corr()['price'].drop('price', errors='ignore').dropna()
    corr_sorted = corr.reindex(corr.abs().sort_values(ascending=False).index)
    return [{'feature': feat, 'corr_with_price': float(val)} for feat, val in corr_sorted.head(k).items()]

def dataset_overview(df: pd.DataFrame):
    dtypes = {c: str(t) for c, t in df.dtypes.items()}
    return {'n_rows': int(df.shape[0]), 'n_cols': int(df.shape[1]), 'columns': list(df.columns), 'dtypes': dtypes}

def make_conclusions(corr_items):
    bullets = []
    for item in corr_items:
        feat = item['feature']
        val = item['corr_with_price']
        direction = "выше" if val > 0 else "ниже"
        strength = 'высокую' if abs(val) >= 0.5 else ('умеренную' if abs(val) >= 0.3 else 'слабую')
        bullets.append(f"Признак '{feat}' имеет {strength} корреляцию с ценой ({val:.2f}): чем {feat} больше, тем {direction} цена (в среднем).")
    return bullets

# ---- Output helpers (DOM in browser, memory/local files in Python)
_JSON_CACHE = {}

def to_json_script(id_: str, payload: dict):
    if IS_PYODIDE:
        el = document.getElementById(id_)
        if el is None:
            el = document.createElement("script")
            el.setAttribute("type", "application/json")
            el.setAttribute("id", id_)
            document.body.appendChild(el)
        el.textContent = json.dumps(payload, ensure_ascii=False)
    else:
        _JSON_CACHE[id_] = payload

def generate_prepared_csv(df: pd.DataFrame):
    if IS_PYODIDE:
        import base64
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        b64 = base64.b64encode(csv_bytes).decode("utf-8")
        href = f"data:text/csv;base64,{b64}"
        a = document.getElementById("download-prepared-link")
        if a:
            a.setAttribute("href", href)
            a.setAttribute("download", "cars_prepared.csv")
            a.style.display = "inline-block"
    else:
        df.to_csv("cars_prepared.csv", index=False)
        console.log("Saved cars_prepared.csv in current directory")

# ---- Main EDA pipeline
def run_eda(url: str = None):
    try:
        url = url or DATA_URL_DEFAULT
        df_raw = load_and_clean(url)
        overview = dataset_overview(df_raw)
        missing = missing_summary(df_raw)

        df_imp = impute_values(df_raw)
        df_enriched = engineer_features(df_imp)

        numeric_cols_show = [c for c in ['price','horsepower','engine-size','curb-weight','city-mpg','highway-mpg'] if c in df_enriched.columns]
        dists = numeric_distributions(df_enriched, numeric_cols_show)

        cats_body = cat_frequencies(df_enriched, 'body-style')
        cats_drive = cat_frequencies(df_enriched, 'drive-wheels')
        cats_make = cat_frequencies(df_enriched, 'make', top=15)

        corr = corr_matrix(df_enriched, target_first=True)
        top_corr = top_price_correlations(df_enriched, k=8)
        conclusions = make_conclusions(top_corr)

        to_json_script("data-overview", overview)
        to_json_script("data-missing", missing)
        to_json_script("data-dists", dists)
        to_json_script("data-cat-body", cats_body)
        to_json_script("data-cat-drive", cats_drive)
        to_json_script("data-cat-make", cats_make)
        to_json_script("data-corr", corr)
        to_json_script("data-conclusions", {'bullets': conclusions})

        eng_list = [c for c in df_enriched.columns if c not in df_raw.columns]
        to_json_script("data-engineered", {'new_features': eng_list})

        generate_prepared_csv(df_enriched)

        head_json = json.loads(df_enriched.head(10).to_json(orient="records"))
        to_json_script("data-head", {'rows': head_json})

        if IS_PYODIDE:
            ready_flag = document.getElementById("eda-ready-flag")
            if ready_flag:
                ready_flag.textContent = "ready"
        console.log("EDA finished successfully")
        return {
            "overview": overview,
            "top_corr": top_corr,
            "engineered": eng_list
        }
    except Exception as e:
        console.error("EDA error:", str(e))
        import traceback as _tb
        console.error(_tb.format_exc())
        raise

# ---- Button (only in browser)
_event_proxies = {}
def _on_click_run(evt=None):
    url = None
    if IS_PYODIDE:
        url_input = document.getElementById("data-url-input")
        url = url_input.value.strip() if url_input and url_input.value and url_input.value.strip() else DATA_URL_DEFAULT
    run_eda(url)

def attach_handlers():
    if not IS_PYODIDE:
        return
    btn = document.getElementById("run-eda-btn")
    if btn:
        cb = create_proxy(_on_click_run)
        _event_proxies["run_eda_btn"] = cb  # prevent GC of proxy
        btn.addEventListener("click", cb, False)

attach_handlers()

# ---- Autorun
if AUTORUN:
    try:
        run_eda(DATA_URL_DEFAULT)
    except Exception:
        pass

# ---- Local run (python eda.py)
if __name__ == "__main__":
    out = run_eda()
    print("\n== Overview ==")
    print(out["overview"])
    print("\n== Top correlations with price ==")
    for item in out["top_corr"]:
        print(item)
    print("\n== Engineered features ==")
    print(out["engineered"])
