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
        """Create the base engine without loading any data."""
        pass
    @abstractmethod
    def query_experts(self, query_text: str, top_n: int = 25):
        """Require subclasses to provide their own expert search method.

        Parameters
        ----------
        query_text : str
            The search uses this research text to find matching experts.
        top_n : int, optional
            The caller requests this many matches. The default is 25.

        Raises
        ------
        NotImplementedError
            This base method always raises an error. Each subclass must replace
            it with a method that performs the search.
        """
        raise NotImplementedError("Subclasses must implement this method")
    
class SimilarityEngineOrcid(BaseSimilarityEngine):
    """
    A class to handle the similarity engine for expert authors.
    It builds and queries a TF-IDF index of author texts.
    """

    def __init__(self):
        """Set the dataset paths and leave the search index unloaded.

        Notes
        -----
        The paths start from the directory where the program is running. Creating
        the engine does not read any files.
        """
        self.dataset_path = Path("expert-data/LSPO_v1.h5")
        self.index_dir = Path("expert-data/indexed-data")

        self.vectorizer = None
        self.tfidf_matrix = None
        self.combined_texts = None
        self.authors = None

    def combine_texts(self, group):
        """Join one author's publication titles and abstracts into a single text.

        Parameters
        ----------
        group : pandas.DataFrame
            These publication rows must have ``title`` and ``abstract`` columns.
            Missing values are treated as empty strings.

        Returns
        -------
        pandas.Series
            The result has one entry named ``text``. It contains the publication
            texts joined with spaces.
        """
        combined = (
            group["title"].fillna("") + " " + group["abstract"].fillna("")
        ).str.strip()
        return pd.Series({"text": " ".join(combined)})

    def build_and_save_index(self):
        """Build the author search index and save it to disk.

        Notes
        -----
        This method reads ``dataset_path`` and groups publications by author ID
        (``@path``). It builds a TF-IDF index using up to 10,000 terms and ignores
        common English words. It saves the index and author data in ``index_dir``,
        replacing any existing files. Call ``load_index_or_build`` to load them.
        """
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
        """Load the saved search index, or build it if any required file is missing.

        Notes
        -----
        Every call reads the index and author data from disk. If a required file
        is missing, all four files are rebuilt. Existing files are reused even if
        the dataset has changed. Only load pickle files from a trusted source.
        """
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
        """Find the authors whose publications best match a research abstract.

        Parameters
        ----------
        query_text : str
            The search compares this text with the authors' publications.
        top_n : int, optional
            This limits the number of matches. The default is 25. Use zero or a
            positive value for a normal result limit.

        Returns
        -------
        pandas.DataFrame
            The table lists the best matches first. Its columns are ``orcid``,
            ``author``, ``similarity``, and ``name_variations``.

        Notes
        -----
        This method reloads the index on every call. It passes ``top_n`` to
        ``rank_experts`` without checking the value.
        """
        self.load_index_or_build()
        query_vector = self.vectorize(query_text)
        return self.rank_experts(query_vector, top_n)

    def vectorize(self, query_text: str):
        """Convert research text into a TF-IDF vector for the search.

        Parameters
        ----------
        query_text : str
            This is the research text to convert.

        Returns
        -------
        scipy.sparse.csr_matrix
            The matrix has one row and one column for each term in the vocabulary.

        Notes
        -----
        Call ``load_index_or_build`` first. Words that are not in the index
        vocabulary are ignored.
        """
        return self.vectorizer.transform([query_text])

    def rank_experts(self, query_vector, top_n: int = 25):
        """Compare a query vector with the authors and return the closest matches.

        Parameters
        ----------
        query_vector : scipy.sparse.spmatrix or numpy.ndarray
            The matrix must have one row and use the same vocabulary as the index.
        top_n : int, optional
            This limits the number of matches. The default is 25. Zero returns no
            matches. A negative value drops that many authors from the end of the
            sorted list.

        Returns
        -------
        pandas.DataFrame
            The table lists the best matches first. Each row contains ``orcid``,
            ``author``, ``similarity``, and ``name_variations``. The author name is
            the first recorded name; name variations are unique and sorted.

        Notes
        -----
        Call ``load_index_or_build`` first. Matches with a similarity score of
        zero can still appear if they fall within the requested limit.
        """
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
