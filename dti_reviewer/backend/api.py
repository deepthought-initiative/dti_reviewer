import logging
from flask import Blueprint, request, jsonify
from tasks import initialize_similarity_engine, query_experts_task
from vector_store import save_vector
from celery.result import AsyncResult
from celery_app import celery

# Set up logger for this module
logger = logging.getLogger(__name__)

api_bp = Blueprint("api", __name__)


def get_query(client_ip):
    """Read and validate the query in the current JSON request.

    Parameters
    ----------
    client_ip : str or None
        This address identifies the client in log messages.

    Returns
    -------
    query : str or None
        The query has surrounding spaces removed. It is None if validation fails.
    error : tuple of (flask.Response, int) or None
        This contains a JSON error message and status 400 if validation fails.
        It is None when the query is valid.

    Notes
    -----
    Call this function while Flask is handling a request. The JSON body should
    be an object with a ``query`` string containing at least three characters
    after spaces are removed. Errors from reading the JSON are not caught here.
    """
    data = request.get_json()
    query = data.get("query") if data else None

    if query is None:
        logger.warning(f"Missing query parameter in request from {client_ip}")
        return None, (jsonify(message="Missing 'query' parameter"), 400)
    if not isinstance(query, str):
        logger.warning(f"Non-string query received from {client_ip}")
        return None, (jsonify(message="Query must be a string"), 400)

    query = query.strip()
    if not query:
        logger.warning(f"Empty query received from {client_ip}")
        return None, (jsonify(message="Query cannot be empty"), 400)
    if len(query) < 3:
        logger.warning(f"Query shorter than three characters from {client_ip}")
        return None, (
            jsonify(message="Query too short. Minimum 3 characters"),
            400,
        )

    return query, None


@api_bp.route("/vectorize", methods=["POST"])
def vectorize():
    """Handle POST /vectorize by storing a query vector in Redis.

    Returns
    -------
    tuple of (flask.Response, int)
        The response contains ``vector_id`` and status 201 on success. Invalid
        queries return status 400. Other errors return status 500.

    Notes
    -----
    The request body supplies ``query``. It must contain at least three
    characters after surrounding spaces are removed. The stored vector expires
    after one hour. Errors from reading the JSON also return status 500.
    """
    client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
    logger.info(f"Search request received from {client_ip}")

    try:
        query, error = get_query(client_ip)
        if error:
            return error

        engine = initialize_similarity_engine()
        vector_id = save_vector(engine.vectorize(query))
        logger.info(f"Query vector {vector_id} created for {client_ip}")
        return jsonify(vector_id=vector_id), 201

    except Exception as e:
        logger.error(
            f"Error processing search request from {client_ip}: {str(e)}", exc_info=True
        )
        return jsonify(message="Server error creating query vector"), 500


@api_bp.route("/search", methods=["POST"])
def search():
    """Handle POST /search by queuing a search for a stored vector.

    Returns
    -------
    tuple of (flask.Response, int)
        The response contains ``message``, ``task_id``, and status 202 when the
        search is queued. An invalid vector ID returns status 400. Other errors
        return status 500.

    Notes
    -----
    The JSON body must supply a nonempty ``vector_id`` string. The worker
    checks whether the vector exists and finds up to 25 matches. Errors from
    reading the JSON return status 500.
    """
    client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)

    try:
        data = request.get_json()
        vector_id = data.get("vector_id") if data else None
        if not isinstance(vector_id, str) or not vector_id.strip():
            return jsonify(message="Missing 'vector_id' parameter"), 400

        celery_task = query_experts_task.delay(vector_id, top_n=25)
        logger.info(f"Celery task {celery_task.id} submitted for {client_ip}")
        return jsonify(message="Task submitted", task_id=celery_task.id), 202
    except Exception as e:
        logger.error(
            f"Error submitting search request from {client_ip}: {str(e)}",
            exc_info=True,
        )
        return jsonify(message="Server error enqueuing task", task_id=None), 500


@api_bp.route("/status/<task_id>", methods=["GET"])
def task_status(task_id):
    """Handle GET /status/<task_id> by reading the Celery task result.

    Parameters
    ----------
    task_id : str
        This is the task ID supplied in the URL.

    Returns
    -------
    tuple of (flask.Response, int)
        The JSON response always includes ``state``. PENDING and PROGRESS return
        status 202, and PROGRESS also includes ``percent``. SUCCESS includes
        ``results`` and returns status 200. Other states return an error message
        and status 500. A failed status lookup returns state ERROR and status 500.

    Notes
    -----
    The ``percent`` value is a fraction: 0.5 means 50 percent. Unknown task IDs
    usually appear as PENDING too.
    """
    client_ip = request.environ.get("HTTP_X_FORWARDED_FOR", request.remote_addr)
    logger.info(f"Status check for task {task_id} from {client_ip}")

    try:
        async_result = AsyncResult(task_id, app=celery)
        state = async_result.state

        logger.debug(f"Task {task_id} state: {state}")

        # Base response always includes the state
        resp = {"state": state}

        if state == "PENDING":
            logger.debug(f"Task {task_id} is pending")
            return jsonify(resp), 202

        if state == "PROGRESS":
            percent = async_result.info.get("percent", 0)
            resp["percent"] = percent
            logger.debug(f"Task {task_id} in progress: {percent}%")
            return jsonify(resp), 202

        if state == "SUCCESS":
            result_count = len(async_result.result) if async_result.result else 0
            resp["results"] = async_result.result
            logger.info(
                f"Task {task_id} completed successfully with {result_count} results"
            )
            return jsonify(resp), 200

        # Handle failure states (FAILURE, RETRY, REVOKED, etc.)
        error_info = str(async_result.info) if async_result.info else "Unknown error"
        resp["message"] = error_info
        logger.error(f"Task {task_id} failed with state {state}: {error_info}")
        return jsonify(resp), 500

    except Exception as e:
        logger.error(
            f"Error checking status for task {task_id} from {client_ip}: {str(e)}",
            exc_info=True,
        )
        return jsonify(
            {"state": "ERROR", "message": "Error retrieving task status"}
        ), 500
