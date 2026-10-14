import logging
from pathlib import Path
from time import monotonic

import numpy as np
from scipy import sparse


logger = logging.getLogger(__name__)


class EmbeddingCache:
    def __init__(self, directory, budget_bytes):
        if budget_bytes < 0:
            raise ValueError("VECTOR_CACHE_MB must be zero or greater")
        self.directory = Path(directory)
        self.budget_bytes = budget_bytes
        self.cached_bytes = 0
        self.entries = {}

    def load(self, year):
        directory = self.directory / str(year)
        paths = [
            directory / "tfidf_embeddings_refereed.npz",
            directory / "refereed_row_indices.npy",
        ]
        stats = [path.stat() for path in paths]
        # shortcut: trusts size and mtime; hash files if these can mask changes.
        signature = [(stat.st_size, stat.st_mtime_ns) for stat in stats]
        cached = self.entries.get(year)
        if cached is not None:
            old_signature, vectors, rows, size = cached
            if signature == old_signature:
                return vectors, rows
            self.cached_bytes -= size
            del self.entries[year]

        vectors = sparse.load_npz(paths[0])
        rows = np.load(paths[1], allow_pickle=False)
        size = sum(array.nbytes for array in (
            vectors.data, vectors.indices, vectors.indptr, rows
        ))
        if self.cached_bytes + size <= self.budget_bytes:
            self.entries[year] = (signature, vectors, rows, size)
            self.cached_bytes += size
        return vectors, rows

    def preload(self, years):
        started = monotonic()
        for year in years:
            if self.cached_bytes >= self.budget_bytes:
                break
            self.load(year)
            if year not in self.entries:
                break
        logger.info(
            "Preloaded %d years of vectors: %.1f MiB in %.1fs",
            len(self.entries), self.cached_bytes / 1024**2,
            monotonic() - started,
        )
