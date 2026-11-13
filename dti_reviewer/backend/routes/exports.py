import json
import logging
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory

import pandas as pd
from flask import Blueprint, current_app, jsonify, request, send_file
from flask_login import current_user, login_required

from routes.admin import no_cache
from storage.db import get_db


exports_bp = Blueprint("exports", __name__, url_prefix="/api/exports")
exports_bp.after_request(no_cache)
logger = logging.getLogger(__name__)
FIELDS = {
    "author", "affiliation", "orcid", "n_papers", "top_similarity",
    "average_similarity", "top_k_similarity", "combined_rank",
}
FORMATS = {
    "csv": "text/csv",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "parquet": "application/vnd.apache.parquet",
    "h5": "application/x-hdf5",
    "json": "application/json",
}


@exports_bp.before_request
@login_required
def protect_exports():
    current_app.extensions["csrf"].protect()


@exports_bp.post("/<search_id>")
def export_reviewers(search_id):
    if request.content_length is not None and request.content_length > 4_000_000:
        return jsonify(message="Export selection is too large."), 413
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify(message="Expected an export selection."), 400
    fields = data.get("columns")
    indices = data.get("rows")
    kind = data.get("format")
    k = data.get("k")
    if not isinstance(kind, str) or kind not in FORMATS:
        return jsonify(message="Unsupported export format."), 400
    if (not isinstance(fields, list) or not fields
            or any(not isinstance(field, str) or field not in FIELDS for field in fields)
            or len(set(fields)) != len(fields)):
        return jsonify(message="Choose valid export columns."), 400
    if (not isinstance(indices, list) or not indices
            or any(type(index) is not int for index in indices)
            or len(set(indices)) != len(indices)):
        return jsonify(message="Choose unique reviewer rows."), 400
    if type(k) is not int or not 1 <= k <= 9_007_199_254_740_991:
        return jsonify(message="K must be a positive whole number."), 400

    row = get_db().execute(
        "SELECT state, results FROM searches WHERE id = ? AND user_id = ?",
        (search_id, current_user.id),
    ).fetchone()
    if row is None:
        return jsonify(message="Search not found."), 404
    if row["state"] != "SUCCESS":
        return jsonify(message="Only completed searches can be exported."), 409
    authors = json.loads(row["results"])["authors"]
    if any(index < 0 or index >= len(authors) for index in indices):
        return jsonify(message="Reviewer selection is out of range. Reload the search."), 400

    records = []
    for index in indices:
        author = authors[index]
        record = {field: author[field] for field in fields if field != "top_k_similarity"}
        if "top_k_similarity" in fields:
            papers = author["papers"][:k]
            record["top_k_similarity"] = (
                sum(paper["similarity"] for paper in papers) / len(papers) if papers else 0
            )
        records.append(record)
    frame = pd.DataFrame.from_records(records, columns=fields).rename(
        columns={"top_k_similarity": f"top_{k}_average_similarity"}
    )
    try:
        content = serialize_export(frame, kind)
    except (OSError, ValueError, ImportError):
        logger.exception("Could not generate %s reviewer export", kind)
        return jsonify(message="Could not generate this export. Please try again."), 500
    return send_file(
        BytesIO(content), mimetype=FORMATS[kind], as_attachment=True,
        download_name=f"reviewers.{kind}", max_age=0,
    )


def serialize_export(frame, kind):
    if kind == "json":
        return frame.to_json(orient="records", force_ascii=False, double_precision=15).encode()
    if kind == "csv":
        # Spreadsheet apps can execute formula-like text even inside quoted CSV fields.
        frame = frame.copy()
        for field in frame.select_dtypes(include=["object", "string"]).columns:
            frame[field] = frame[field].map(
                lambda value: "'" + value
                if value.lstrip().startswith(("=", "+", "-", "@")) else value
            )
        return frame.to_csv(index=False).encode("utf-8-sig")
    output = BytesIO()
    if kind == "xlsx":
        if any(len(value) > 32767 for field in frame.select_dtypes(include=["object", "string"]).columns for value in frame[field]):
            raise ValueError("Excel cannot store text longer than 32767 characters per cell")
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            frame.to_excel(writer, index=False, sheet_name="Reviewers")
            sheet = writer.sheets["Reviewers"]
            sheet.freeze_panes = "A2"
            sheet.auto_filter.ref = sheet.dimensions
            # Explicit string cells preserve ORCIDs and prevent formula execution.
            for cells in sheet.iter_rows():
                for cell in cells:
                    if isinstance(cell.value, str):
                        cell.data_type = "s"
        return output.getvalue()
    if kind == "parquet":
        frame.to_parquet(output, engine="pyarrow", index=False)
        return output.getvalue()
    with TemporaryDirectory(prefix="reviewer-export-") as directory:
        path = Path(directory) / "reviewers.h5"
        frame.to_hdf(path, key="reviewers", mode="w", format="table", index=False)
        return path.read_bytes()
