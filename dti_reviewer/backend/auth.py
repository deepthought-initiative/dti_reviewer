import sqlite3

import click
from authlib.integrations.flask_client import OAuth
from authlib.integrations.base_client.errors import OAuthError
from flask import (
    Blueprint, current_app, jsonify, redirect, request, session,
)
from flask.cli import with_appcontext
from flask_login import (
    LoginManager, UserMixin, current_user, login_user, logout_user,
)
from flask_wtf.csrf import generate_csrf
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")
login_manager = LoginManager()
oauth = OAuth()


class User(UserMixin):
    def __init__(self, row):
        self.id = row["id"]


@login_manager.user_loader
def load_user(user_id):
    row = get_db().execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return User(row) if row else None


@login_manager.unauthorized_handler
def unauthorized():
    return jsonify(message="Login required"), 401


@auth_bp.before_request
def protect_auth():
    if request.method == "POST":
        current_app.extensions["csrf"].protect()


@auth_bp.get("/session")
def user_session():
    response = jsonify(
        user_id=current_user.get_id(),
        auth_mode=current_app.config["AUTH_MODE"],
        csrf_token=generate_csrf(),
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "GET":
        if current_app.config["AUTH_MODE"] == "oidc":
            return oauth.identity.authorize_redirect(
                current_app.config["OIDC_REDIRECT_URI"]
            )
        return redirect(current_app.config["APPLICATION_ROOT"] + "login")
    if current_app.config["AUTH_MODE"] != "local":
        return jsonify(message="Use external login"), 400
    row = get_db().execute(
        "SELECT * FROM users WHERE username = ?",
        (request.form.get("username", "").strip(),),
    ).fetchone()
    password_hash = row["password_hash"] if row else None
    valid = check_password_hash(
        password_hash or current_app.config["DUMMY_PASSWORD_HASH"],
        request.form.get("password", ""),
    )
    if not password_hash or not valid:
        return jsonify(message="Invalid username or password"), 401
    session.clear()
    login_user(User(row))
    return jsonify(message="Logged in")


@auth_bp.get("/callback")
def callback():
    if current_app.config["AUTH_MODE"] != "oidc":
        return jsonify(message="External login is not enabled"), 404
    try:
        token = oauth.identity.authorize_access_token()
    except OAuthError:
        return jsonify(message="External login failed"), 400
    identity = token["userinfo"]
    db = get_db()
    with db:
        db.execute(
            "INSERT INTO users (issuer, subject) VALUES (?, ?) "
            "ON CONFLICT (issuer, subject) DO NOTHING",
            (identity["iss"], identity["sub"]),
        )
    row = db.execute(
        "SELECT * FROM users WHERE issuer = ? AND subject = ?",
        (identity["iss"], identity["sub"]),
    ).fetchone()
    session.clear()
    login_user(User(row))
    return redirect(current_app.config["APPLICATION_ROOT"])


@auth_bp.post("/logout")
def logout():
    logout_user()
    session.clear()
    return jsonify(message="Logged out")


@click.command("create-user")
@click.argument("username")
@click.password_option(confirmation_prompt=True)
@with_appcontext
def create_user(username, password):
    username = username.strip()
    if not username or not password:
        raise click.ClickException("Username and password are required.")
    password_hash = generate_password_hash(password)
    db = get_db()
    try:
        with db:
            db.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (username, password_hash),
            )
    except sqlite3.IntegrityError as error:
        raise click.ClickException("Username already exists.") from error
    click.echo(f"Created user {username}")


def init_auth(app):
    login_manager.init_app(app)
    app.cli.add_command(create_user)
    app.register_blueprint(auth_bp)
    if app.config["AUTH_MODE"] not in {"local", "oidc"}:
        raise ValueError("AUTH_MODE must be local or oidc")
    if app.config["AUTH_MODE"] == "oidc":
        for key in (
            "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET",
            "OIDC_METADATA_URL", "OIDC_REDIRECT_URI",
        ):
            if not app.config.get(key):
                raise ValueError(f"{key} is required for OIDC login")
        oauth.init_app(app)
        oauth.register(
            "identity",
            client_id=app.config["OIDC_CLIENT_ID"],
            client_secret=app.config["OIDC_CLIENT_SECRET"],
            server_metadata_url=app.config["OIDC_METADATA_URL"],
            client_kwargs={"scope": "openid profile email"},
        )
    else:
        app.config["DUMMY_PASSWORD_HASH"] = generate_password_hash("unused password")
