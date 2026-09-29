"""
SupportNova Knowledge Base retrieval.
Default path is pure lexical (milliseconds). Optional embeddings via env SUPPORTNOVA_USE_EMBEDDINGS=1.
"""
import os
import re
from typing import Dict, List
from python_engine.database import get_db

STOP = {
    "the", "and", "for", "with", "this", "that", "from", "your", "have", "has",
    "are", "was", "were", "but", "not", "you", "my", "our", "to", "of", "in",
    "on", "is", "a", "an",
}

# Process-level cache so a long-lived interpreter (if used) does not re-query.
_ROWS_CACHE: List[Dict[str, str]] | None = None


def _tokens(text: str):
    return {t for t in re.findall(r"[a-z0-9]{3,}", (text or "").lower()) if t not in STOP}


def _rows(force: bool = False):
    global _ROWS_CACHE
    if _ROWS_CACHE is not None and not force:
        return _ROWS_CACHE
    conn = get_db()
    rows = conn.execute(
        """
        SELECT c.id, c.document_id, c.section, c.heading, c.page_ref, c.version, c.chunk_text,
               d.title, d.status, d.source
        FROM document_chunks c
        JOIN documents d ON d.id = c.document_id
        WHERE d.status = 'Active'
        """
    ).fetchall()
    conn.close()
    _ROWS_CACHE = [dict(r) for r in rows]
    return _ROWS_CACHE


def _lexical(query: str, rows: List[Dict[str, str]], limit: int):
    q = _tokens(query)
    if not q:
        # Fall back to returning active policy chunks so grounding is never empty.
        return [
            r | {"retrieval_score": 0.0, "retrieval_method": "lexical_fallback"}
            for r in rows[:limit]
        ]
    scored = []
    for row in rows:
        tokens = _tokens(row["chunk_text"] + " " + (row.get("title") or "") + " " + (row.get("document_id") or ""))
        overlap = len(q & tokens)
        if overlap == 0:
            continue
        score = overlap / max(1, len(q))
        scored.append((score, overlap, row))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    if not scored:
        return [
            r | {"retrieval_score": 0.0, "retrieval_method": "lexical_fallback"}
            for r in rows[:limit]
        ]
    return [
        item[2] | {"retrieval_score": round(item[0], 4), "retrieval_method": "lexical"}
        for item in scored[:limit]
    ]


def retrieve_policy_chunks(query: str, limit: int = 5) -> List[Dict[str, str]]:
    rows = _rows()
    if not rows:
        return []

    use_embeddings = os.getenv("SUPPORTNOVA_USE_EMBEDDINGS", "").strip() in ("1", "true", "TRUE", "yes")
    if use_embeddings:
        try:
            from sentence_transformers import SentenceTransformer
            import faiss
            import numpy as np

            texts = [r["chunk_text"] for r in rows]
            model = SentenceTransformer("all-MiniLM-L6-v2")
            matrix = model.encode(texts, normalize_embeddings=True, show_progress_bar=False)
            index = faiss.IndexFlatIP(matrix.shape[1])
            index.add(np.asarray(matrix, dtype="float32"))
            qvec = model.encode([query], normalize_embeddings=True, show_progress_bar=False)
            scores, ids = index.search(np.asarray(qvec, dtype="float32"), min(limit, len(rows)))
            results = []
            for score, idx in zip(scores[0], ids[0]):
                if idx >= 0:
                    results.append(
                        rows[int(idx)]
                        | {"retrieval_score": round(float(score), 4), "retrieval_method": "embedding_faiss"}
                    )
            if results:
                return results
        except Exception:
            pass

    return _lexical(query, rows, limit)
