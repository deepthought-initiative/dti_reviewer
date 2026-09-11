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
