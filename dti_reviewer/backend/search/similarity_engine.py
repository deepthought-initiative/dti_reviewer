import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from search.embedding_cache import EmbeddingCache
from storage.paper_metadata import read_paper_metadata


REVIEWER_PAPER_COUNT = 10000


def aligned_author_values(values, author_count):
    # A mismatched array cannot safely identify which author owns each value.
    if values is None or len(values) != author_count:
        return [""] * author_count
    return [value.strip() if value and value.strip() != "-" else "" for value in values]


def blockize(author):
    name = author.split(",")
    last = name[0].strip()
    if len(name) > 1 and name[1].strip():
        initial = name[1].lstrip()[0]
    else:
        initial = "blank"
    return f"{initial}.{last}".lower()


class SimilarityEnginePapers:
    def __init__(self):
        self.ads_unified_dir = Path(os.environ["ADS_UNIFIED_DIR"])
        self.embeddings_dir = Path(os.environ["EMBEDDINGS_DIR"])
        self.vectorizer_path = Path(os.environ["VECTORIZER_PATH"])
        self.vectorizer = joblib.load(self.vectorizer_path)
        self.embedding_cache = EmbeddingCache(
            self.embeddings_dir,
            int(os.environ.get("VECTOR_CACHE_MB", "0")) * 1024**2,
        )

    def read_matched_paper_records(
        self, year, row_indices, on_records_read=None
    ):
        return read_paper_metadata(
            os.environ["PAPER_METADATA_PATH"], self.ads_unified_dir,
            self.embeddings_dir, year, row_indices, on_records_read,
        )

    def load_year_embeddings(self, year):
        return self.embedding_cache.load(year)

    def vectorize(self, text):
        return self.vectorizer.transform([text])

    def score_papers_for_year(self, query_vector, year):
        proposal_hits = []
        embeddings, original_row_indices = self.load_year_embeddings(year)

        sims = cosine_similarity(query_vector, embeddings).ravel()

        top_idx = np.argsort(sims)[-REVIEWER_PAPER_COUNT:][::-1]

        for idx in top_idx:
            similarity = float(sims[idx])

            if similarity >= 0.92:
                continue

            original_row_index = int(original_row_indices[idx])
            proposal_hits.append((year, original_row_index, similarity))

        return proposal_hits, len(original_row_indices)

    def attach_records(self, hits, objective, on_records_read=None):
        merged_hits = []
        hits = pd.DataFrame(hits, columns=["year", "row_index", "similarity"])
        hits["paper_rank"] = hits["similarity"].rank(ascending=False)
        records = pd.DataFrame()
        if len(hits):
            records = pd.concat(
                self.read_matched_paper_records(
                    year, group["row_index"].to_numpy(), on_records_read
                ).set_index(group.index)
                for year, group in hits.groupby("year")
            ).loc[hits.index]

        for (_, df_row), year, row_index, similarity, paper_rank in zip(
            records.iterrows(), hits["year"], hits["row_index"], hits["similarity"],
            hits["paper_rank"],
        ):
            authors = df_row["author"]
            if authors is None or len(authors) == 0:
                continue

            merged_hits.append(
                {
                    "objective": objective,
                    "title": df_row["title"],
                    "bibcode": df_row["bibcode"],
                    "author": df_row["author"],
                    "affiliation": aligned_author_values(df_row["aff"], len(authors)),
                    "orcid": aligned_author_values(df_row["orcid_user"], len(authors)),
                    "year": year,
                    "similarity": similarity,
                    "paper_rank": paper_rank,
                    "paper_key": (year, row_index),
                }
            )

        read_in = pd.DataFrame(
            merged_hits,
            columns=[
                "objective",
                "title",
                "bibcode",
                "author",
                "affiliation",
                "orcid",
                "year",
                "similarity",
                "paper_rank",
                "paper_key",
            ],
        )
        read_in["author"] = read_in["author"].apply(list)

        cols = ["author", "orcid", "affiliation"]
        read_in = read_in.explode(cols, ignore_index=True)
        read_in["title"] = read_in["title"].str[0]
        read_in["author"] = read_in["author"].fillna("").str.strip()
        names = read_in["author"].str.replace(r"\s+", " ", regex=True).str.casefold()
        # shortcut: names can merge people; use author IDs when available.
        read_in["reviewer_key"] = ("name:" + names).where(
            read_in["orcid"].eq(""), "orcid:" + read_in["orcid"],
        )
        unnamed = read_in["author"].eq("") & read_in["orcid"].eq("")
        read_in.loc[unnamed, "reviewer_key"] = "entry:" + read_in.index[unnamed].astype(str)
        read_in["author"] = read_in["author"].replace("", "Not listed")
        read_in["block"] = read_in["author"].apply(blockize)
        read_in.attrs = {
            "papers": len(merged_hits),
            "author_rows": len(read_in),
        }
        return read_in

    def rollup(self, rows):
        people = []

        unique_papers = rows.drop_duplicates(["reviewer_key", "paper_key"])
        for _, group in unique_papers.groupby("reviewer_key", sort=False):
            papers = [
                {
                    "title": row.title,
                    "bibcode": row.bibcode,
                    "year": row.year,
                    "similarity": row.similarity,
                }
                for row in group.itertuples()
            ]
            papers = sorted(
                papers,
                key=lambda paper: paper["similarity"],
                reverse=True,
            )
            people.append(
                {
                    "author": group["author"].iloc[0],
                    "orcid": group["orcid"].iloc[0],
                    "affiliation": group["affiliation"].iloc[0],
                    "block": group["block"].iloc[0],
                    "n_papers": len(group),
                    "top_similarity": group["similarity"].max(),
                    "average_similarity": group["similarity"].mean(),
                    "position_score": (1 / group["paper_rank"]).sum(),
                    "papers": papers,
                }
            )

        ranked = (
            pd.DataFrame(
                people,
                columns=[
                    "author",
                    "orcid",
                    "affiliation",
                    "block",
                    "n_papers",
                    "top_similarity",
                    "average_similarity",
                    "position_score",
                    "papers",
                ],
            )
            .sort_values("average_similarity", ascending=False)
            .reset_index(drop=True)
        )
        ranked["similarity_rank"] = ranked["average_similarity"].rank(
            ascending=False
        )
        ranked["position_rank"] = ranked["position_score"].rank(
            ascending=False
        )
        ranked["combined_rank"] = (
            ranked["similarity_rank"] + ranked["position_rank"]
        )
        return ranked
