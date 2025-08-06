from celery_app import celery
from similarity_engine import SimilarityEngineOrcid
from sklearn.metrics.pairwise import cosine_similarity

engine = None

def initialize_similarity_engine():
    global engine
    if engine is None:
        engine = SimilarityEngineOrcid()
        engine.load_index_or_build()


@celery.task(bind=True)
def query_experts_task(self, query_text: str, top_n: int = 25):
    self.update_state(state="PROGRESS", meta={"percent": 0.05})
    initialize_similarity_engine()

    self.update_state(state="PROGRESS", meta={"percent": 0.10})
    q_vec = engine.vectorizer.transform([query_text])

    self.update_state(state="PROGRESS", meta={"percent": 0.10})
    sims = cosine_similarity(q_vec, engine.tfidf_matrix).flatten()

    self.update_state(state="PROGRESS", meta={"percent": 0.90})

    top_indices = sims.argsort()[::-1][:top_n]
    top_authors = engine.combined_texts.iloc[top_indices].copy()
    top_authors["similarity"] = sims[top_indices]
    self.update_state(state="PROGRESS", meta={"percent": 0.95})

    author_info = (
        engine.authors[["@path", "author"]]
        .groupby("@path")
        .agg({"author": "first"})
        .reset_index()
    )
    results = top_authors.merge(author_info, on="@path", how="left")[
        ["@path", "author", "similarity"]
    ]
    self.update_state(state="PROGRESS", meta={"percent": 0.98})

    name_variations = (
        engine.authors[["@path", "author"]]
        .dropna()
        .groupby("@path")["author"]
        .apply(lambda names: list(sorted(set(names))))
        .reset_index()
        .rename(columns={"author": "name_variations"})
    )
    results = results.merge(name_variations, on="@path", how="left").rename(
        columns={"@path": "orcid"}
    )

    self.update_state(state="PROGRESS", meta={"percent": 1.0})

    return results.to_dict(orient="records")

import faiss
import numpy as np

def query_experts_with_faiss(self, query_text: str, top_n: int = 25, progress_callback=None):
    self.load_index_or_build()

    # 1. Transform to TF-IDF (sparse) and convert to dense
    if progress_callback:
        progress_callback(percent=0.10, message="Transforming query...")
    q_vec = self.vectorizer.transform([query_text]).toarray().astype(np.float32)
    docs = self.tfidf_matrix.toarray().astype(np.float32)

    # 2. Normalize both query and documents to unit length for cosine via IP
    #    (FAISS only supports L2 or inner-product directly)
    faiss.normalize_L2(q_vec)
    faiss.normalize_L2(docs)

    # 3. (Re)build or load a FAISS index
    d = docs.shape[1]  # dimensionality
    index = faiss.IndexFlatIP(d)        # flat (exact) inner-product index
    index.add(docs)                     # add all doc vectors

    if progress_callback:
        progress_callback(percent=0.20, message="Index built, searching top experts…")
    D, I = index.search(q_vec, top_n)   # D: similarities, I: indices

    # 4. Gather results exactly as before
    top_indices = I.flatten()
    top_authors = self.combined_texts.iloc[top_indices].copy()
    top_authors["similarity"] = D.flatten()

    # …and then the same author-info and name-variation merges you already have:
    if progress_callback:
        progress_callback(percent=0.80, message="Fetching author information…")
    author_info = (
        self.authors[["@path", "author"]]
        .groupby("@path")
        .agg({"author": "first"})
        .reset_index()
    )
    results = top_authors.merge(author_info, on="@path", how="left")

    if progress_callback:
        progress_callback(percent=0.90, message="Resolving name variations…")
    name_variations = (
        self.authors[["@path", "author"]]
        .dropna()
        .groupby("@path")["author"]
        .apply(lambda names: list(sorted(set(names))))
        .reset_index()
        .rename(columns={"author": "name_variations"})
    )
    results = (
        results
        .merge(name_variations, on="@path", how="left")
        .rename(columns={"@path": "orcid"})
    )

    if progress_callback:
        progress_callback(percent=0.95, message="Done.")
    return results
