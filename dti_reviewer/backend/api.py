import logging

from celery.result import AsyncResult
from flask import Blueprint, jsonify, request
from flask_login import login_required

from celery_app import celery
from tasks import initialize_similarity_engine, query_experts_task
from vector_store import save_vector


logger = logging.getLogger(__name__)
api_bp = Blueprint("api", __name__)


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

    fields = {
        "vector_id": vector_id,
        "objective": objective,
        "title": title,
    }
    for name, value in fields.items():
        if not isinstance(value, str) or not value.strip():
            return jsonify(message=f"Missing '{name}' parameter"), 400

    celery_task = query_experts_task.delay(vector_id, objective, title)
    logger.info(f"Celery task {celery_task.id} submitted for {client_ip}")
    return jsonify(message="Task submitted", task_id=celery_task.id), 202


@api_bp.route("/status/<task_id>", methods=["GET"])
def task_status(task_id):
    client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
    logger.info(f"Status check for task {task_id} from {client_ip}")

    async_result = AsyncResult(task_id, app=celery)
    state = async_result.state
    resp = {"state": state}

    if state == "PENDING":
        return jsonify(resp), 202

    if state == "PROGRESS":
        resp.update(async_result.info)
        return jsonify(resp), 202

    if state == "SUCCESS":
        resp["results"] = async_result.result
        return jsonify(resp), 200

    resp["message"] = str(async_result.info or "Unknown error")
    return jsonify(resp), 500
