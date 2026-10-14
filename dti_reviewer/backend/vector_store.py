import json
import os
from uuid import uuid4

from redis import Redis
from scipy import sparse

# Expire query vectors after one hour
VECTOR_TTL_SECONDS = 3600
redis_client = Redis.from_url(
    os.environ.get("CELERY_RESULT_BACKEND", "redis://localhost:6379/0")
)


def save_vector(vector: sparse.csr_matrix) -> str:
    """Save a query vector in Redis for later use.

    Parameters
    ----------
    vector : scipy.sparse.csr_matrix
        This is the query vector to save.

    Returns
    -------
    str
        The new ID can be passed to ``load_vector`` to retrieve the vector.

    Notes
    -----
    The vector is saved as JSON and expires after ``VECTOR_TTL_SECONDS``,
    currently one hour. Storage errors are not caught here.
    """
    vector_id = str(uuid4())
    payload = {
        "data": vector.data.tolist(),
        "indices": vector.indices.tolist(),
        "indptr": vector.indptr.tolist(),
        "shape": vector.shape,
    }
    redis_client.setex(
        f"query-vector:{vector_id}",
        VECTOR_TTL_SECONDS,
        json.dumps(payload),
    )
    return vector_id


def load_vector(vector_id: str) -> sparse.csr_matrix | None:
    """Load a query vector from Redis.

    Parameters
    ----------
    vector_id : str
        This is the vector ID returned by ``save_vector``.

    Returns
    -------
    scipy.sparse.csr_matrix or None
        The result is the saved vector, or None if it is missing or has expired.

    Notes
    -----
    Loading a vector does not extend its expiry time. Errors from Redis or
    invalid stored data are not caught here.
    """
    stored_vector = redis_client.get(f"query-vector:{vector_id}")
    if stored_vector is None:
        return None

    payload = json.loads(stored_vector)
    return sparse.csr_matrix(
        (payload["data"], payload["indices"], payload["indptr"]),
        shape=payload["shape"],
    )
