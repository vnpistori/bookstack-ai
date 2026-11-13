"""
recommendation.py — Serviço de recomendação KNN para o bookstack-ai.

Algoritmo (Content-Based Filtering com Negative Feedback):
1. Filtra livros lidos:
   - Gostados (rating >= min_rating): constroem o PERFIL POSITIVO
   - Não gostados (rating < min_rating): constroem o PERFIL NEGATIVO
2. Pondera cada lido por nota e decaimento temporal (λ=0.4/ano):
   - 5★ = 2×, 4★ = 1× (positivos)
   - 1★ = 2×, 2★ = 1.5×, 3★ = 0.5× penalização (negativos)
3. Codifica features categóricas (book_class, category, type) + numéricas
   (score, year) — no mesmo espaço combinado (lidos + fila).
4. Calcula centroide ponderado positivo (gosto) e negativo (desgosto).
5. Treina KNN na FILA e mede:
   - dist_pos: distância ao perfil positivo (menor = melhor)
   - dist_neg: distância ao perfil negativo (menor = pior)
6. Score final = similaridade_positiva - β × similaridade_negativa
   com β = 0.35 (penalização moderada)
"""

from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

try:
    import numpy as np

    _NUMPY_AVAILABLE = True
except ImportError:
    _NUMPY_AVAILABLE = False
    np = None

# sklearn é opcional — se não instalado, o endpoint retorna 503
try:
    from sklearn.neighbors import NearestNeighbors
    from sklearn.preprocessing import LabelEncoder

    _SKLEARN_AVAILABLE = True
except ImportError:
    _SKLEARN_AVAILABLE = False


# ── Constantes ────────────────────────────────────────────────────────────────
LAMBDA = 0.4  # decaimento temporal (meia-vida ≈ 1.7 anos)
NEG_BETA = 0.35  # peso da penalização negativa (0 = ignorar dislikes)
MIN_LIDOS = 2  # mínimo de lidos top para gerar recomendações
CAT_COLS = ["book_class", "category", "type"]
NUM_COLS = ["score", "year"]


def _temporal_weight(date_read: str | None, rating: int, positive: bool) -> float:
    """Retorna peso = rating_weight × decaimento_temporal."""
    if positive:
        rating_w = 2.0 if rating >= 5 else 1.0
    else:
        # penalização: 1★ = 2×, 2★ = 1.5×, 3★ = 0.5×
        rating_w = {1: 2.0, 2: 1.5, 3: 0.5}.get(rating, 1.0)

    if not date_read:
        return rating_w * math.exp(-LAMBDA * 10)
    try:
        ds = str(date_read)[:10]
        dt = datetime.fromisoformat(ds).replace(tzinfo=timezone.utc)
        years_ago = (datetime.now(timezone.utc) - dt).days / 365.25
    except (ValueError, TypeError):
        years_ago = 10.0
    return rating_w * math.exp(-LAMBDA * years_ago)


def _encode(combined_dicts: list[dict], col: str) -> np.ndarray:
    vals = [str(d.get(col) or "?") for d in combined_dicts]
    return LabelEncoder().fit_transform(vals).astype(float)


def _encode_num(combined_dicts: list[dict], col: str) -> np.ndarray | None:
    vals = np.array([float(d.get(col) or 0) for d in combined_dicts])
    std = vals.std()
    if std == 0:
        return None
    return (vals - vals.mean()) / std


def _build_feature_matrix(combined: list[dict]) -> np.ndarray:
    parts: list[np.ndarray] = []
    for col in CAT_COLS:
        parts.append(_encode(combined, col))
    for col in NUM_COLS:
        arr = _encode_num(combined, col)
        if arr is not None:
            parts.append(arr)
    if not parts:
        return np.empty((len(combined), 0))
    return np.column_stack(parts)


def _weighted_centroid(
    X: np.ndarray, books: list[dict], positive: bool
) -> np.ndarray | None:
    """Calcula centroide ponderado (perfil positivo ou negativo)."""
    weights = np.array(
        [
            _temporal_weight(b.get("date_read"), b.get("rating") or 4, positive)
            for b in books
        ]
    )
    w_sum = weights.sum()
    if w_sum == 0:
        return None
    weights /= w_sum
    return (X * weights[:, np.newaxis]).sum(axis=0).reshape(1, -1)


def get_recommendations(
    books: list[dict[str, Any]],
    top_n: int = 10,
    min_rating: int = 4,
) -> list[dict[str, Any]]:
    """
    Recebe a lista completa de livros do usuário e retorna até `top_n`
    recomendações da fila ordenadas por score ajustado (KNN + negative feedback).

    Parâmetros
    ----------
    books     : lista de dicts com campos do modelo Book
    top_n     : número de recomendações a retornar
    min_rating: nota mínima para perfil positivo (padrão: 4)

    Retorno
    -------
    Lista de dicts (livros da fila) com campo extra `match_score` (0–100).
    """
    if not _SKLEARN_AVAILABLE:
        raise RuntimeError(
            "scikit-learn não está instalado. Execute: pip install scikit-learn"
        )
    if not _NUMPY_AVAILABLE:
        raise RuntimeError("numpy não está instalado. Execute: pip install numpy")

    lidos_pos = [
        b
        for b in books
        if b.get("status") == "Lido" and (b.get("rating") or 0) >= min_rating
    ]
    lidos_neg = [
        b
        for b in books
        if b.get("status") == "Lido"
        and (b.get("rating") or 0) > 0
        and (b.get("rating") or 0) < min_rating
    ]
    fila = [b for b in books if b.get("status") == "A Ler"]

    if len(lidos_pos) < MIN_LIDOS or not fila:
        return []

    # ── Feature matrix no espaço combinado ────────────────────────────────
    combined = lidos_pos + lidos_neg + fila
    X = _build_feature_matrix(combined)

    if X.shape[1] == 0:
        return []

    n_pos = len(lidos_pos)
    n_neg = len(lidos_neg)
    X_pos = X[:n_pos]
    X_neg = X[n_pos : n_pos + n_neg] if n_neg > 0 else None
    X_fila = X[n_pos + n_neg :]

    # ── Perfis (centroides ponderados) ─────────────────────────────────────
    profile_pos = _weighted_centroid(X_pos, lidos_pos, positive=True)
    profile_neg = (
        _weighted_centroid(X_neg, lidos_neg, positive=False)
        if X_neg is not None and len(lidos_neg) >= 1
        else None
    )

    # ── KNN na fila — distâncias ao perfil positivo ────────────────────────
    k = min(len(fila), max(top_n * 2, 20))  # candidatos extras antes de filtrar
    nn_pos = NearestNeighbors(n_neighbors=k, metric="euclidean")
    nn_pos.fit(X_fila)
    dist_pos_all, idx_pos_all = nn_pos.kneighbors(profile_pos)
    dist_pos_all = dist_pos_all[0]
    idx_pos_all = idx_pos_all[0]

    # ── Distâncias ao perfil negativo (se houver) ──────────────────────────
    neg_dist_map: dict[int, float] = {}
    if profile_neg is not None:
        nn_neg = NearestNeighbors(n_neighbors=len(fila), metric="euclidean")
        nn_neg.fit(X_fila)
        dist_neg_full, idx_neg_full = nn_neg.kneighbors(profile_neg)
        for di, ii in zip(dist_neg_full[0], idx_neg_full[0]):
            neg_dist_map[int(ii)] = float(di)

    # ── Score ajustado ─────────────────────────────────────────────────────
    max_pos = dist_pos_all.max() if dist_pos_all.max() > 0 else 1.0
    max_neg = max(neg_dist_map.values()) if neg_dist_map else 1.0

    results = []
    for dist, idx in zip(dist_pos_all, idx_pos_all):
        sim_pos = 1.0 - dist / (max_pos * 1.25)  # 0–1, maior = melhor
        sim_neg = 0.0
        if idx in neg_dist_map:
            d_neg = neg_dist_map[idx]
            sim_neg = 1.0 - d_neg / (
                max_neg * 1.25
            )  # 0–1, maior = mais parecido com algo não gostado

        adjusted = sim_pos - NEG_BETA * sim_neg
        match_score = max(1, min(100, round(adjusted * 100)))

        book = dict(fila[int(idx)])
        book["match_score"] = match_score
        book["_sim_pos"] = round(sim_pos * 100)
        book["_sim_neg"] = round(sim_neg * 100)
        results.append(book)

    # Ordena por score ajustado e retorna top_n
    results.sort(key=lambda b: b["match_score"], reverse=True)
    return results[:top_n]
