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
    """Store a sparse query vector temporarily and return its identifier."""
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
    """Load a stored query vector, or return None after it expires."""
    stored_vector = redis_client.get(f"query-vector:{vector_id}")
    if stored_vector is None:
        return None

    payload = json.loads(stored_vector)
    return sparse.csr_matrix(
        (payload["data"], payload["indices"], payload["indptr"]),
        shape=payload["shape"],
    )
