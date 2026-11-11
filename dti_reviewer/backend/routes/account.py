from secrets import token_hex

from flask import Blueprint, current_app, jsonify, request, session
from flask_login import current_user, login_required, logout_user
from werkzeug.security import check_password_hash, generate_password_hash

from storage.db import get_db


account_bp = Blueprint("account", __name__)


@account_bp.post("/password")
@login_required
def change_password():
    if current_app.config["AUTH_MODE"] != "local":
        return jsonify(message="Manage your password with your identity provider"), 400
    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify(message="Expected a JSON object"), 400
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    confirmation = data.get("confirm_password")
    if any(not isinstance(value, str) or not value for value in (
        current_password, new_password, confirmation,
    )):
        return jsonify(message="All password fields are required"), 400
    if new_password != confirmation:
        return jsonify(message="New passwords do not match"), 400

    db = get_db()
    row = db.execute(
        "SELECT password_hash, session_id FROM users WHERE id = ?",
        (current_user.id,),
    ).fetchone()
    if not row or not row["password_hash"]:
        return jsonify(message="Manage your password with your identity provider"), 400
    if row["session_id"] != current_user.session_id:
        return jsonify(message="Account changed. Log in again and retry."), 409
    if not check_password_hash(row["password_hash"], current_password):
        return jsonify(message="Current password is incorrect"), 400
    password_hash = generate_password_hash(new_password)
    with db:
        result = db.execute(
            "UPDATE users SET password_hash = ?, session_id = ? "
            "WHERE id = ? AND password_hash = ? AND session_id = ? "
            "AND is_blocked = 0",
            (password_hash, token_hex(32), current_user.id,
             row["password_hash"], row["session_id"]),
        )
    if not result.rowcount:
        return jsonify(message="Account changed. Log in again and retry."), 409
    logout_user()
    session.clear()
    return "", 204
