from pathlib import Path
import pickle
import pandas as pd
from scipy import sparse
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from abc import ABC, abstractmethod

class BaseSimilarityEngine(ABC):
    name = "BaseSimilarityEngine"
    description = "Base class for similarity engines"
    def __init__(self):
        pass
    @abstractmethod
    def query_experts(self, query_text: str, top_n: int = 25):
        raise NotImplementedError("Subclasses must implement this method")
    
class SimilarityEngineOrcid(BaseSimilarityEngine):
    """
    A class to handle the similarity engine for expert authors.
    It builds and queries a TF-IDF index of author texts.
    """

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

    def query_experts(self, query_text: str, top_n: int = 25):
        self.load_index_or_build()
        query_vector = self.vectorize(query_text)
        return self.rank_experts(query_vector, top_n)

    def vectorize(self, query_text: str):
        """Convert query text using the fitted author-text vocabulary."""
        return self.vectorizer.transform([query_text])

    def rank_experts(self, query_vector, top_n: int = 25):
        """Return the authors most similar to a query vector."""
        sims = cosine_similarity(query_vector, self.tfidf_matrix).flatten()
        top_indices = sims.argsort()[::-1][:top_n]
        top_authors = self.combined_texts.iloc[top_indices].copy()
        top_authors["similarity"] = sims[top_indices]

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
