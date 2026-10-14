import json
import logging
from uuid import uuid4

from celery.result import AsyncResult
from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from celery_app import celery
from tasks import initialize_similarity_engine, query_experts_task
from vector_store import save_vector
from db import get_db
from search_history import save_search_state
from admin import no_cache


logger = logging.getLogger(__name__)
api_bp = Blueprint("api", __name__)
api_bp.after_request(no_cache)


@api_bp.before_request
@login_required
def require_login():
    return None


def get_query(client_ip):
    data = request.get_json()
    query = data.get("abstract") if data else None

    if query is None:
        logger.warning(f"Missing abstract parameter from {client_ip}")
        return None, (jsonify(message="Missing 'abstract' parameter"), 400)
    if not isinstance(query, str):
        logger.warning(f"Non string abstract received from {client_ip}")
        return None, (jsonify(message="Abstract must be a string"), 400)

    query = query.strip()
    if not query:
        logger.warning(f"Empty abstract received from {client_ip}")
        return None, (jsonify(message="Abstract cannot be empty"), 400)
    if len(query) < 3:
        logger.warning(f"Abstract under three characters from {client_ip}")
        return None, (
            jsonify(message="Abstract too short. Minimum 3 characters"),
            400,
        )

    return query, None


@api_bp.route("/vectorize", methods=["POST"])
def vectorize():
    client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
    logger.info(f"Search request received from {client_ip}")

    query, error = get_query(client_ip)
    if error:
        return error

    engine = initialize_similarity_engine()
    vector_id = save_vector(engine.vectorize(query))
    logger.info(f"Query vector {vector_id} created for {client_ip}")
    return jsonify(vector_id=vector_id), 201


@api_bp.route("/search", methods=["POST"])
def search():
    client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
    data = request.get_json()
    vector_id = data.get("vector_id") if data else None
    objective = data.get("objective") if data else None
    title = data.get("title") if data else None

    abstract, error = get_query(client_ip)
    if error:
        return error

    fields = {
        "vector_id": vector_id,
        "objective": objective,
        "title": title,
    }
    for name, value in fields.items():
        if not isinstance(value, str) or not value.strip():
            return jsonify(message=f"Missing '{name}' parameter"), 400

    search_id = str(uuid4())
    db = get_db()
    db.execute(
        "INSERT INTO searches (id, user_id, title, objective, abstract) VALUES (?, ?, ?, ?, ?)",
        (search_id, current_user.id, title, objective, abstract),
    )
    db.commit()
    try:
        query_experts_task.apply_async(
            args=[vector_id, objective, title],
            kwargs={"database": current_app.config["DATABASE"]},
            task_id=search_id,
        )
    except Exception:
        logger.exception("Could not queue search %s", search_id)
        save_search_state(current_app.config["DATABASE"], search_id, "FAILURE",
                          error="Search could not be queued. Please start a new search.")
    return jsonify(message="Task submitted", task_id=search_id), 202


@api_bp.route("/api/history", methods=["GET"])
def search_history():
    before = request.args.get("before", "9999")
    rows = get_db().execute(
        "SELECT id, title, objective, created_at, state FROM searches "
        "WHERE user_id = ? AND (created_at || id) < ? "
        "ORDER BY (created_at || id) DESC LIMIT 51",
        (current_user.id, before),
    ).fetchall()
    entries = [dict(row) for row in rows[:50]]
    return jsonify(searches=entries, next_cursor=(
        entries[-1]["created_at"] + entries[-1]["id"] if len(rows) > 50 else None
    ))


@api_bp.route("/status/<task_id>", methods=["GET"])
def task_status(task_id):
    row = get_db().execute(
        "SELECT * FROM searches WHERE id = ? AND user_id = ?",
        (task_id, current_user.id),
    ).fetchone()
    if row is None:
        return jsonify(message="Search not found"), 404
    state = row["state"]
    if state in {"PENDING", "PROGRESS"}:
        async_result = AsyncResult(task_id, app=celery)
        if async_result.state in {"FAILURE", "REVOKED"}:
            state = "FAILURE"
            save_search_state(current_app.config["DATABASE"], task_id, state,
                              error="Search was interrupted. Please start a new search.")
    response = {
        "id": row["id"], "title": row["title"], "objective": row["objective"],
        "abstract": row["abstract"], "created_at": row["created_at"], "state": state,
    }
    if state == "SUCCESS":
        response["results"] = json.loads(row["results"])
    elif state == "PROGRESS":
        response.update(json.loads(row["progress"]))
    elif state == "FAILURE":
        response["message"] = row["error"] or "Search was interrupted. Please start a new search."
    return jsonify(response)
