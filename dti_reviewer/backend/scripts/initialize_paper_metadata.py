import json
import os
import sqlite3
from pathlib import Path
from time import monotonic

import numpy as np
import pyarrow.parquet as pq

from storage.paper_metadata import METADATA_COLUMNS, YEARS, source_signature


def build_year(connection, ads_dir, embeddings_dir, year):
    signature = source_signature(ads_dir, embeddings_dir, year)
    year_dir = embeddings_dir / str(year)
    indices = np.load(
        year_dir / "refereed_row_indices.npy", allow_pickle=False
    )
    with np.load(
        year_dir / "tfidf_embeddings_refereed.npz", allow_pickle=False
    ) as vectors:
        vector_count = int(vectors["shape"][0])
    with pq.ParquetFile(ads_dir / f"year={year}/data.parquet") as parquet:
        if indices.ndim != 1 or not np.issubdtype(indices.dtype, np.integer):
            raise ValueError(f"Invalid refereed row indices for {year}")
        indices = np.sort(indices)
        if (
            len(indices) != vector_count
            or len(np.unique(indices)) != len(indices)
        ):
            raise ValueError(f"Vector rows do not match paper rows for {year}")
        if len(indices) and (
            indices[0] < 0 or indices[-1] >= parquet.metadata.num_rows
        ):
            raise ValueError(f"Paper row index is out of bounds for {year}")
        offset = 0
        inserted = 0
        for batch in parquet.iter_batches(
            batch_size=8192, columns=METADATA_COLUMNS, use_threads=False
        ):
            end = offset + batch.num_rows
            selected = indices[
                np.searchsorted(indices, offset):np.searchsorted(indices, end)
            ]
            if len(selected):
                records = batch.take(selected - offset).to_pylist()
                connection.executemany(
                    "INSERT INTO papers VALUES (?, ?, ?)",
                    (
                        (year, int(index), json.dumps(
                            record, ensure_ascii=False, separators=(",", ":")
                        ))
                        for index, record in zip(selected, records)
                    ),
                )
                inserted += len(selected)
            offset = end
        if inserted != vector_count:
            raise ValueError(f"Incomplete metadata build for {year}")
    if source_signature(ads_dir, embeddings_dir, year) != signature:
        raise ValueError(f"Source files changed during the build for {year}")
    connection.execute(
        "INSERT INTO sources VALUES (?, ?, ?)", (year, signature, inserted)
    )
    connection.commit()
    return inserted


def build_metadata(ads_dir, embeddings_dir, output):
    ads_dir = Path(ads_dir)
    embeddings_dir = Path(embeddings_dir)
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_name(output.name + ".building")
    temporary.touch(exist_ok=False)
    connection = None
    started = monotonic()
    total = 0
    try:
        connection = sqlite3.connect(temporary)
        connection.executescript("""
            CREATE TABLE papers (
                year INTEGER NOT NULL,
                row_index INTEGER NOT NULL,
                payload TEXT NOT NULL,
                PRIMARY KEY (year, row_index)
            ) WITHOUT ROWID;
            CREATE TABLE sources (
                year INTEGER PRIMARY KEY,
                signature TEXT NOT NULL,
                papers INTEGER NOT NULL
            );
        """)
        for year in YEARS:
            count = build_year(connection, ads_dir, embeddings_dir, year)
            total += count
            print(
                f"{year}: {count:,} papers; "
                f"elapsed {monotonic() - started:.1f}s", flush=True,
            )
        print("Checking metadata database integrity...", flush=True)
        if connection.execute("PRAGMA quick_check").fetchone() != ("ok",):
            raise ValueError("Metadata database integrity check failed")
        actual_count = connection.execute(
            "SELECT count(*) FROM papers"
        ).fetchone()[0]
        if actual_count != total:
            raise ValueError("Metadata database row count is incorrect")
        connection.close()
        connection = None
        os.replace(temporary, output)
        print(
            f"Ready: {total:,} papers in {output}; "
            f"{monotonic() - started:.1f}s", flush=True,
        )
    finally:
        if connection is not None:
            connection.close()
        temporary.unlink(missing_ok=True)


def metadata_is_current(ads_dir, embeddings_dir, output):
    if not output.is_file():
        return False
    connection = sqlite3.connect(
        output.resolve().as_uri() + "?mode=ro", uri=True
    )
    try:
        sources = dict(connection.execute(
            "SELECT year, signature FROM sources"
        ))
        return sources == {
            year: source_signature(ads_dir, embeddings_dir, year)
            for year in YEARS
        }
    except sqlite3.DatabaseError:
        return False
    finally:
        connection.close()


def main():
    ads_dir = Path(os.environ["ADS_UNIFIED_DIR"])
    embeddings_dir = Path(os.environ["EMBEDDINGS_DIR"])
    output = Path(os.environ["PAPER_METADATA_PATH"])
    output.parent.mkdir(parents=True, exist_ok=True)
    if metadata_is_current(ads_dir, embeddings_dir, output):
        print("Paper metadata is current; no rebuild needed.", flush=True)
        return
    # Docker runs one initializer; these are leftovers from interrupted builds.
    for suffix in (".building", ".building-journal"):
        output.with_name(output.name + suffix).unlink(missing_ok=True)
    build_metadata(ads_dir, embeddings_dir, output)


if __name__ == "__main__":
    main()
