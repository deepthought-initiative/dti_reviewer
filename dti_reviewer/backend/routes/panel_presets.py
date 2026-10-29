import sqlite3

from flask import Blueprint, current_app, jsonify, request
from flask_login import current_user, login_required

from routes.admin import no_cache
from storage.db import get_db


panel_presets_bp = Blueprint(
    "panel_presets", __name__, url_prefix="/api/panel-presets"
)
panel_presets_bp.after_request(no_cache)
PRESET_COLUMNS = "id, name, keywords, source_field, created_at, updated_at"


@panel_presets_bp.before_request
@login_required
def protect_presets():
    if request.method in {"POST", "PUT", "DELETE"}:
        current_app.extensions["csrf"].protect()


@panel_presets_bp.get("")
def list_presets():
    rows = get_db().execute(
        f"SELECT {PRESET_COLUMNS} FROM panel_presets "
        "WHERE user_id = ? ORDER BY name COLLATE NOCASE, id",
        (current_user.id,),
    ).fetchall()
    return jsonify(presets=[dict(row) for row in rows])


@panel_presets_bp.delete("/<int:preset_id>")
def delete_preset(preset_id):
    db = get_db()
    with db:
        result = db.execute(
            "DELETE FROM panel_presets WHERE id = ? AND user_id = ?",
            (preset_id, current_user.id),
        )
    if not result.rowcount:
        return jsonify(message="Preset not found"), 404
    return "", 204


@panel_presets_bp.post("")
@panel_presets_bp.put("/<int:preset_id>")
def save_preset(preset_id=None):
    db = get_db()
    if preset_id is not None and db.execute(
        "SELECT id FROM panel_presets WHERE id = ? AND user_id = ?",
        (preset_id, current_user.id),
    ).fetchone() is None:
        return jsonify(message="Preset not found"), 404

    data = request.get_json()
    if not isinstance(data, dict):
        return jsonify(message="Expected a JSON object"), 400
    name = data.get("name")
    keywords = data.get("keywords")
    source_field = data.get("source_field")
    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 120:
        return jsonify(message="Use a preset name between 1 and 120 characters"), 400
    if not isinstance(keywords, str) or not 3 <= len(keywords.strip()) <= 20000:
        return jsonify(message="Use keywords between 3 and 20,000 characters"), 400
    if source_field is not None and (
        not isinstance(source_field, str)
        or not 1 <= len(source_field.strip()) <= 200
    ):
        return jsonify(message="Invalid source field"), 400

    values = (name.strip(), keywords.strip(),
              source_field.strip() if source_field is not None else None)
    creating = preset_id is None
    try:
        with db:
            if creating:
                result = db.execute(
                    "INSERT INTO panel_presets "
                    "(name, keywords, source_field, user_id) VALUES (?, ?, ?, ?)",
                    (*values, current_user.id),
                )
                preset_id = result.lastrowid
            else:
                result = db.execute(
                    "UPDATE panel_presets SET name = ?, keywords = ?, "
                    "source_field = ?, "
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') "
                    "WHERE id = ? AND user_id = ?",
                    (*values, preset_id, current_user.id),
                )
                if not result.rowcount:
                    return jsonify(message="Preset not found"), 404
    except sqlite3.IntegrityError as error:
        if error.sqlite_errorname != "SQLITE_CONSTRAINT_UNIQUE":
            raise
        return jsonify(message="You already have a preset with that name"), 409

    row = db.execute(
        f"SELECT {PRESET_COLUMNS} FROM panel_presets WHERE id = ? AND user_id = ?",
        (preset_id, current_user.id),
    ).fetchone()
    return jsonify(preset=dict(row)), 201 if creating else 200
