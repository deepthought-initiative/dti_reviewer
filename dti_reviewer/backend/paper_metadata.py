import json
import sqlite3
from pathlib import Path

import pandas as pd


METADATA_COLUMNS = ["title", "bibcode", "author", "orcid_user", "aff"]
FIRST_YEAR = 2004
LAST_YEAR = 2024
YEARS = range(FIRST_YEAR, LAST_YEAR + 1)


def is_valid_year_range(year_start, year_end):
    # type() rather than isinstance(): bool is an int subclass.
    return (
        type(year_start) is int
        and type(year_end) is int
        and FIRST_YEAR <= year_start <= year_end <= LAST_YEAR
    )


def source_signature(ads_dir, embeddings_dir, year):
    paths = [
        Path(ads_dir) / f"year={year}/data.parquet",
        Path(embeddings_dir) / str(year) / "refereed_row_indices.npy",
        Path(embeddings_dir) / str(year) / "tfidf_embeddings_refereed.npz",
    ]
    # shortcut: trusts size and mtime; hash files if these can mask changes.
    stats = [path.stat() for path in paths]
    return json.dumps([
        METADATA_COLUMNS,
        [(stat.st_size, stat.st_mtime_ns) for stat in stats],
    ])


def read_paper_metadata(
    database, ads_dir, embeddings_dir, year, row_indices, on_records_read=None
):
    requested = [int(index) for index in row_indices]
    unique_rows = sorted(set(requested))
    records = {}
    connection = sqlite3.connect(
        Path(database).resolve().as_uri() + "?mode=ro", uri=True
    )
    try:
        source = connection.execute(
            "SELECT signature FROM sources WHERE year = ?", (year,)
        ).fetchone()
        signature = source_signature(ads_dir, embeddings_dir, year)
        if source is None or source[0] != signature:
            raise ValueError(
                f"Paper metadata is outdated for {year}; rebuild the lookup"
            )
        for start in range(0, len(unique_rows), 500):
            batch = unique_rows[start:start + 500]
            placeholders = ",".join("?" for _ in batch)
            rows = connection.execute(
                "SELECT row_index, payload FROM papers WHERE year = ? "
                f"AND row_index IN ({placeholders})", [year, *batch],
            ).fetchall()
            if len(rows) != len(batch):
                raise ValueError(
                    f"Incomplete paper metadata for {year}; rebuild the lookup"
                )
            records.update(
                (index, json.loads(payload)) for index, payload in rows
            )
            if on_records_read is not None:
                on_records_read(len(rows))
    finally:
        connection.close()
    return pd.DataFrame(
        [records[index] for index in requested], columns=METADATA_COLUMNS
    )
