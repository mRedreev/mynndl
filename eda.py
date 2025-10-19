
import json
import math
import pandas as pd
import numpy as np
from pyodide.ffi import to_js
from js import document, console

DATA_URL_DEFAULT = "https://raw.githubusercontent.com/evgpat/edu_stepik_practical_ml/main/datasets/cars_prices.csv"

def coerce_numeric(df, cols):
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df

def load_and_clean(url: str = DATA_URL_DEFAULT) -> pd.DataFrame:
    df = pd.read_csv(url, decimal='.')
    # Convert '?' to NaN
    df = df.replace('?', np.nan)
    # Drop rows with missing target
    if 'price' in df.columns:
        df = df[~df['price'].isna()].copy()
    # Coerce numerics
    numeric_guess = [
        'symboling','normalized-losses','wheel-base','length','width','height','curb-weight',
        'engine-size','bore','stroke','compression-ratio','horsepower','peak-rpm','city-mpg','highway-mpg','price'
    ]
    df = coerce_numeric(df, numeric_guess)
    return df.reset_index(drop=True)

def impute_values(df: pd.DataFrame) -> pd.DataFrame:
    work = df.copy()
    # Example required columns from your assignment
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
    # Simple derived features
    if {'horsepower','curb-weight'}.issubset(work.columns):
        work['power_to_weight'] = work['horsepower'] / work['curb-weight']
    if {'length','width','height'}.issubset(work.columns):
        work['car_volume'] = work['length'] * work['width'] * work['height']
    if {'engine-size','bore','stroke'}.issubset(work.columns):
        # crude displacement proxy
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
            # Use histogram-ready arrays
            out[c] = series.values.tolist()
    return out

def cat_frequencies(df: pd.DataFrame, col, top=15):
    data = []
    if col in df.columns:
        vc = df[col].astype(str).value_counts().head(top)
        data = [{'category': k, 'count': int(v)} for k,v in vc.items()]
    return data

def corr_matrix(df: pd.DataFrame, target_first=True):
    num_df = df.select_dtypes(include=[np.number]).dropna(axis=1, how='all')
    cmat = num_df.corr()
    if target_first and 'price' in cmat.columns:
        # reorder columns and rows placing 'price' first
        cols = ['price'] + [c for c in cmat.columns if c != 'price']
        cmat = cmat.loc[cols, cols]
    return {
        'columns': cmat.columns.tolist(),
        'matrix': cmat.values.tolist()
    }

def top_price_correlations(df: pd.DataFrame, k=8):
    if 'price' not in df.columns:
        return []
    corr = df.select_dtypes(include=[np.number]).corr()['price'].drop('price', errors='ignore').dropna()
    corr_sorted = corr.reindex(corr.abs().sort_values(ascending=False).index)
    items = []
    for feat, val in corr_sorted.head(k).items():
        items.append({'feature': feat, 'corr_with_price': float(val)})
    return items

def dataset_overview(df: pd.DataFrame):
    dtypes = {c: str(t) for c,t in df.dtypes.items()}
    return {
        'n_rows': int(df.shape[0]),
        'n_cols': int(df.shape[1]),
        'columns': list(df.columns),
        'dtypes': dtypes
    }

def make_conclusions(corr_items):
    bullets = []
    for item in corr_items:
        feat = item['feature']
        val = item['corr_with_price']
        direction = "выше" if val>0 else "ниже"
        bullets.append(f"Признак '{feat}' имеет {'высокую' if abs(val)>=0.5 else 'умеренную' if abs(val)>=0.3 else 'слабую'} корреляцию с ценой ({val:.2f}): чем {feat} больше, тем {direction} цена (в среднем).")
    return bullets

def to_json_script(id_: str, payload: dict):
    el = document.getElementById(id_)
    if el is None:
        el = document.createElement("script")
        el.setAttribute("type", "application/json")
        el.setAttribute("id", id_)
        document.body.appendChild(el)
    el.textContent = json.dumps(payload)

def generate_prepared_csv(df: pd.DataFrame):
    # Save to a CSV in memory and expose a download link (base64 data URI)
    csv_bytes = df.to_csv(index=False).encode("utf-8")
    b64 = base64.b64encode(csv_bytes).decode("utf-8")
    href = f"data:text/csv;base64,{b64}"
    a = document.getElementById("download-prepared-link")
    a.setAttribute("href", href)
    a.setAttribute("download", "cars_prepared.csv")
    a.style.display = "inline-block"

import base64

def run_eda(url: str = None):
    url = url or DATA_URL_DEFAULT
    df_raw = load_and_clean(url)
    overview = dataset_overview(df_raw)
    missing = missing_summary(df_raw)

    df_imp = impute_values(df_raw)
    df_enriched = engineer_features(df_imp)

    # Which numeric columns to show distributions for
    numeric_cols_show = [c for c in ['price','horsepower','engine-size','curb-weight','city-mpg','highway-mpg'] if c in df_enriched.columns]
    dists = numeric_distributions(df_enriched, numeric_cols_show)

    cats_body = cat_frequencies(df_enriched, 'body-style')
    cats_drive = cat_frequencies(df_enriched, 'drive-wheels')
    cats_make = cat_frequencies(df_enriched, 'make', top=15)

    corr = corr_matrix(df_enriched, target_first=True)
    top_corr = top_price_correlations(df_enriched, k=8)
    conclusions = make_conclusions(top_corr)

    # Expose JSON payloads for app.js
    to_json_script("data-overview", overview)
    to_json_script("data-missing", missing)
    to_json_script("data-dists", dists)
    to_json_script("data-cat-body", cats_body)
    to_json_script("data-cat-drive", cats_drive)
    to_json_script("data-cat-make", cats_make)
    to_json_script("data-corr", corr)
    to_json_script("data-conclusions", {'bullets': conclusions})

    # Show engineered feature names
    eng_list = [c for c in df_enriched.columns if c not in df_raw.columns]
    to_json_script("data-engineered", {'new_features': eng_list})

    # Prepare downloadable CSV (imputed + engineered)
    generate_prepared_csv(df_enriched)

    # Render a few preview rows
    head_json = json.loads(df_enriched.head(10).to_json(orient="records"))
    to_json_script("data-head", {'rows': head_json})

    # Inform the page that data is ready
    ready_flag = document.getElementById("eda-ready-flag")
    if ready_flag:
        ready_flag.textContent = "ready"

# Hook up to a button if present
def _on_click_run(evt=None):
    # read url from input if provided
    url_input = document.getElementById("data-url-input")
    url = url_input.value.strip() if url_input and url_input.value.strip() else DATA_URL_DEFAULT
    run_eda(url)

def attach_handlers():
    btn = document.getElementById("run-eda-btn")
    if btn:
        from pyodide.ffi.wrappers import add_event_listener
        add_event_listener(btn, "click", _on_click_run)

# Auto attach on import
attach_handlers()
