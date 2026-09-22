from celery_app import celery
from similarity_engine import SimilarityEngineOrcid
from vector_store import load_vector

engine = None

def initialize_similarity_engine():
    """Load one similarity engine for the current process."""
    global engine
    if engine is None:
        engine = SimilarityEngineOrcid()
        engine.load_index_or_build()
    return engine


@celery.task(bind=True)
def query_experts_task(self, vector_id: str, top_n: int = 25):
    """Rank experts for a query vector stored in Redis."""
    self.update_state(state="PROGRESS", meta={"percent": 0.05})
    similarity_engine = initialize_similarity_engine()

    self.update_state(state="PROGRESS", meta={"percent": 0.10})
    query_vector = load_vector(vector_id)
    if query_vector is None:
        raise ValueError("Query vector not found or expired")

    self.update_state(state="PROGRESS", meta={"percent": 0.90})
    results = similarity_engine.rank_experts(query_vector, top_n)

    self.update_state(state="PROGRESS", meta={"percent": 1.0})

    return results.to_dict(orient="records")
