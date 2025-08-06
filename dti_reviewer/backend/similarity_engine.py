from pathlib import Path
import pickle
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from abc import ABC, abstractmethod
import faiss
import numpy as np
class BaseSimilarityEngine(ABC):
    engine_id = "base_similarity_engine"
    name = "BaseSimilarityEngine"
    description = "Base class for similarity engines"

    @abstractmethod
    def query_experts(self, query_text: str, top_n: int = 25, progress_callback=None):
        pass
    
class SimilarityEngineOrcid(BaseSimilarityEngine):
    """
    A class to handle the similarity engine for expert authors.
    It builds and queries a TF-IDF index of author texts.
    """
    engine_id = "orcid_similarity_engine"
    name = "ORCID Similarity Engine"
    description = "TF-IDF based similarity engine for ORCID authors"

    def __init__(self):
        self.dataset_path = Path("expert-data/LSPO_v1.h5")
        self.index_dir = Path("expert-data/indexed-data")

        self.vectorizer = None
        self.tfidf_matrix = None
        self.combined_texts = None
        self.authors = None

    def combine_texts(self, group):
        combined = (
            group["title"].fillna("") + " " + group["abstract"].fillna("")
        ).str.strip()
        return pd.Series({"text": " ".join(combined)})

    def build_and_save_index(self):
        authors = pd.read_hdf(self.dataset_path)
        combined_texts = (
            authors.groupby("@path").apply(self.combine_texts).reset_index()
        )

        vectorizer = TfidfVectorizer(stop_words="english", max_features=10000)
        tfidf_matrix = vectorizer.fit_transform(combined_texts["text"])

        self.index_dir.mkdir(parents=True, exist_ok=True)
        sparse.save_npz(self.index_dir / "tfidf_matrix.npz", tfidf_matrix)
        print(f"Saved TF-IDF matrix to {self.index_dir / 'tfidf_matrix.npz'}")
        with open(self.index_dir / "vectorizer.pkl", "wb") as f:
            pickle.dump(vectorizer, f)
        print(f"Saved vectorizer to {self.index_dir / 'vectorizer.pkl'}")
        with open(self.index_dir / "combined_texts.pkl", "wb") as f:
            pickle.dump(combined_texts, f)
        print(f"Saved combined texts to {self.index_dir / 'combined_texts.pkl'}")
        with open(self.index_dir / "authors.pkl", "wb") as f:
            pickle.dump(authors, f)
        print(f"Saved authors data to {self.index_dir / 'authors.pkl'}")
        print("✓ Index built and saved successfully!")

    def load_index_or_build(self):
        required = [
            "tfidf_matrix.npz",
            "vectorizer.pkl",
            "combined_texts.pkl",
            "authors.pkl",
        ]
        missing = [fn for fn in required if not (self.index_dir / fn).exists()]
        if missing:
            self.build_and_save_index()

        self.tfidf_matrix = sparse.load_npz(self.index_dir / "tfidf_matrix.npz")
        with open(self.index_dir / "vectorizer.pkl", "rb") as f:
            self.vectorizer = pickle.load(f)
        with open(self.index_dir / "combined_texts.pkl", "rb") as f:
            self.combined_texts = pickle.load(f)
        with open(self.index_dir / "authors.pkl", "rb") as f:
            self.authors = pickle.load(f)

    def query_experts(self, query_text: str, top_n: int = 25, progress_callback=None):
        self.load_index_or_build()

        if progress_callback:
            progress_callback(percent=0.10, message="Transforming query...")
        q_vec = self.vectorizer.transform([query_text])

        if progress_callback:
            progress_callback(percent=0.20, message="Calculating similarities...")
        sims = cosine_similarity(q_vec, self.tfidf_matrix).flatten()

        if progress_callback:
            progress_callback(percent=0.80, message="Identifying top experts...")
        top_indices = sims.argsort()[::-1][:top_n]
        top_authors = self.combined_texts.iloc[top_indices].copy()
        top_authors["similarity"] = sims[top_indices]

        if progress_callback:
            progress_callback(percent=0.90, message="Fetching author information...")
        author_info = (
            self.authors[["@path", "author"]]  # , 'doi']
            # .dropna(subset=['doi'])  # Remove missing DOIs
            .groupby("@path")
            .agg(
                {
                    "author": "first"
                    #'doi': lambda x: list(x.unique())[:3]  # Sample up to 3 unique DOIs
                }
            )
            .reset_index()
        )
        results = top_authors.merge(author_info, on="@path", how="left")
        results = results[["@path", "author", "similarity"]]

        if progress_callback:
            progress_callback(percent=0.95, message="Resolving name variations...")
        name_variations = (
            self.authors[["@path", "author"]]
            .dropna()
            .groupby("@path")["author"]
            .apply(lambda names: list(sorted(set(names))))
            .reset_index()
            .rename(columns={"author": "name_variations"})
        )

        results = results.merge(name_variations, on="@path", how="left")
        results = results.rename(columns={"@path": "orcid"})
        return results
    
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

def list_all_engines():
    available_engines = []
    for cls in BaseSimilarityEngine.__subclasses__():
        engine_data = {
            "engine_id": cls.engine_id or cls.__name__.lower(),
            "name": cls.name,
            "description": cls.description
        }
        available_engines.append(engine_data)

    return available_engines
