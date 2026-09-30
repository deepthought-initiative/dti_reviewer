from celery_app import celery
from similarity_engine import SimilarityEngineOrcid
from vector_store import load_vector

engine = None

def initialize_similarity_engine():
    """Create and load the search engine once for this Python process.

    Returns
    -------
    SimilarityEngineOrcid
        The result is the shared search engine for this process.

    Notes
    -----
    The first call loads the index. Later calls reuse the engine. Errors
    while loading the index are not caught here.
    """
    global engine
    if engine is None:
        engine = SimilarityEngineOrcid()
        engine.load_index_or_build()
    return engine


@celery.task(bind=True)
def query_experts_task(self, vector_id: str, top_n: int = 25):
    """Run an expert search in the background using a stored vector.

    Parameters
    ----------
    self : celery.Task
        Celery supplies this task object so the function can report progress.
    vector_id : str
        This is the stored vector ID returned by ``save_vector``.
    top_n : int, optional
        The search uses this result limit. The default is 25.

    Returns
    -------
    list of dict
        Each match contains ``orcid``, ``author``, ``similarity``, and
        ``name_variations``.

    Raises
    ------
    ValueError
        The task raises this error if the vector is missing or has expired.

    Notes
    -----
    The task reports progress as 0.05, 0.10, 0.90, and 1.0. These are fractions,
    so 1.0 means 100 percent. Celery handles any errors raised by the search.
    """
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
