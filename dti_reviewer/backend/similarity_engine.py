import os
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity

from embedding_cache import EmbeddingCache
from paper_metadata import read_paper_metadata


REVIEWER_PAPER_COUNT = 10000


def truncate_list(input_list, truncation_level=2):
    return input_list[:truncation_level]


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

            if similarity >= 0.98:
                continue

            original_row_index = int(original_row_indices[idx])
            proposal_hits.append((year, original_row_index, similarity))

        return proposal_hits, len(original_row_indices)

    def attach_records(self, hits, objective, on_records_read=None):
        merged_hits = []
        hits = pd.DataFrame(hits, columns=["year", "row_index", "similarity"])
        records = pd.DataFrame()
        if len(hits):
            records = pd.concat(
                self.read_matched_paper_records(
                    year, group["row_index"].to_numpy(), on_records_read
                ).set_index(group.index)
                for year, group in hits.groupby("year")
            ).loc[hits.index]

        for (_, df_row), year, similarity in zip(
            records.iterrows(), hits["year"], hits["similarity"]
        ):
            authors = df_row["author"]
            if authors is None or len(authors) == 0:
                continue

            aff = (
                df_row["aff"]
                if df_row["aff"] is not None
                else ["-"] * len(authors)
            )
            orcid = (
                df_row.get("orcid_user")
                if df_row.get("orcid_user") is not None
                else ["-"] * len(authors)
            )

            if len(aff) != len(authors) or len(orcid) != len(authors):
                continue

            merged_hits.append(
                {
                    "objective": objective,
                    "title": df_row["title"],
                    "author": df_row["author"],
                    "affiliation": df_row["aff"],
                    "orcid": orcid,
                    "year": year,
                    "similarity": similarity,
                }
            )

        read_in = pd.DataFrame(
            merged_hits,
            columns=[
                "objective",
                "title",
                "author",
                "affiliation",
                "orcid",
                "year",
                "similarity",
            ],
        )
        read_in["author"] = read_in["author"].apply(truncate_list)
        read_in["affiliation"] = read_in["affiliation"].apply(truncate_list)
        read_in["orcid"] = read_in["orcid"].apply(truncate_list)
        read_in["author"] = read_in["author"].apply(list)

        cols = ["author", "orcid", "affiliation"]
        read_in = read_in.explode(cols, ignore_index=True)
        read_in["title"] = read_in["title"].str[0]
        read_in["affiliation"] = read_in["affiliation"].apply(
            lambda x: x[0] if isinstance(x, list) else x
        )

        paper_count = len(merged_hits)
        author_row_count = len(read_in)
        read_in = (
            read_in.loc[read_in["orcid"].str.strip().ne("-")]
            .reset_index(drop=True)
        )
        read_in["block"] = read_in["author"].apply(blockize)
        read_in = read_in[
            [
                "objective",
                "title",
                "author",
                "affiliation",
                "orcid",
                "year",
                "similarity",
                "block",
            ]
        ]
        read_in.attrs = {
            "papers": paper_count,
            "author_rows": author_row_count,
        }
        return read_in

    def rollup(self, rows):
        people = []

        for orcid, group in rows.groupby("orcid", sort=False):
            papers = [
                {
                    "title": row.title,
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
                    "orcid": orcid,
                    "affiliation": group["affiliation"].iloc[0],
                    "block": group["block"].iloc[0],
                    "n_papers": len(group),
                    "top_similarity": group["similarity"].max(),
                    "average_similarity": group["similarity"].mean(),
                    "papers": papers,
                }
            )

        return (
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
                    "papers",
                ],
            )
            .sort_values("average_similarity", ascending=False)
            .reset_index(drop=True)
        )
