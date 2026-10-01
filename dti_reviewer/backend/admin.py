import sqlite3
from secrets import token_hex

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required
from werkzeug.security import generate_password_hash

from db import get_db


admin_bp = Blueprint("admin", __name__, url_prefix="/admin/users")


@admin_bp.before_request
@login_required
def require_admin():
    if not current_user.is_admin:
        return jsonify(message="Admin access required"), 403


@admin_bp.after_request
def no_cache(response):
    response.headers["Cache-Control"] = "no-store"
    return response


@admin_bp.route("", methods=["GET", "POST"])
def users():
    db = get_db()

    if request.method == "GET":
        rows = db.execute(
            "SELECT id, username, issuer, subject, is_admin, is_blocked, "
            "password_hash IS NOT NULL AS is_local FROM users ORDER BY id"
        ).fetchall()
        return jsonify(users=[dict(row) for row in rows])

    if current_app.config["AUTH_MODE"] != "local":
        return jsonify(message="Use your identity provider to create users"), 400
    data = request.get_json()

    if not isinstance(data, dict):
        return jsonify(message="Expected a JSON object"), 400

    username = data.get("username")
    password = data.get("password")

    if not isinstance(username, str) or not username.strip():
        return jsonify(message="Username is required"), 400
    if not isinstance(password, str) or not password:
        return jsonify(message="Password is required"), 400

    try:
        with db:
            result = db.execute(
                "INSERT INTO users (username, password_hash, session_id) "
                "VALUES (?, ?, ?)",
                (username.strip(), generate_password_hash(password), token_hex(32)),
            )
    except sqlite3.IntegrityError:
        return jsonify(message="Username already exists"), 409
        
    return jsonify(user_id=result.lastrowid), 201


@admin_bp.route(
    "/<int:user_id>", methods=["PATCH", "DELETE"]
)
def update_user(user_id):
    if request.method == "DELETE" and user_id == current_user.id:
        return jsonify(message="You cannot delete your own account"), 400
    db = get_db()
    if request.method == "PATCH":
        data = request.get_json()
        if not isinstance(data, dict):
            return jsonify(message="Expected a JSON object"), 400
        if "is_blocked" in data:
            blocked = data["is_blocked"]
            if type(blocked) is not bool or "password" in data:
                return jsonify(message="Provide only a boolean is_blocked"), 400
            if blocked and user_id == current_user.id:
                return jsonify(message="You cannot block your own account"), 400
            with db:
                result = db.execute(
                    "UPDATE users SET is_blocked = ?, session_id = ? "
                    "WHERE id = ?",
                    (blocked, token_hex(32), user_id),
                )
        else:
            password = data.get("password")
            if not isinstance(password, str) or not password:
                return jsonify(message="Password is required"), 400
            with db:
                result = db.execute(
                    "UPDATE users SET password_hash = ?, session_id = ? "
                    "WHERE id = ? AND password_hash IS NOT NULL",
                    (generate_password_hash(password), token_hex(32), user_id),
                )
    else:
        with db:
            result = db.execute(
                "DELETE FROM users WHERE id = ? AND password_hash IS NOT NULL",
                (user_id,),
            )
            if not result.rowcount:
                result = db.execute(
                    "UPDATE users SET is_blocked = 1, session_id = ? "
                    "WHERE id = ? AND password_hash IS NULL",
                    (token_hex(32), user_id),
                )
    if not result.rowcount:
        return jsonify(
            message="User not found or action unavailable for this account"
        ), 404
    return "", 204
