import sqlite3
from secrets import token_hex

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

from admin import admin_bp
from db import get_db


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")
auth_bp.register_blueprint(admin_bp)
login_manager = LoginManager()
oauth = OAuth()


class User(UserMixin):
    def __init__(self, row):
        """Create a user object from a database row.

        Parameters
        ----------
        row : sqlite3.Row
            This row contains ``id``, ``is_admin``, and ``session_id``.
        """
        self.id = row["id"]
        self.is_admin = bool(row["is_admin"])
        self.session_id = row["session_id"]

    def get_id(self):
        return self.session_id


@login_manager.user_loader
def load_user(user_id):
    """Find the logged-in user by their revocable session identifier.

    Parameters
    ----------
    user_id : str
        Flask-Login supplies this identifier from the session.

    Returns
    -------
    User or None
        The result is the matching user, or None if the user no longer exists.

    Notes
    -----
    Flask must know which app is using the database. It sets this up during
    requests. In a standalone script, call this inside ``with app.app_context():``.
    """
    row = get_db().execute(
        "SELECT * FROM users WHERE session_id = ?", (user_id,)
    ).fetchone()
    return User(row) if row and not row["is_blocked"] else None


@login_manager.unauthorized_handler
def unauthorized():
    """Return an error telling the client to log in.

    Returns
    -------
    tuple of (flask.Response, int)
        The response contains ``message="Login required"`` and status 401.
    """
    return jsonify(message="Login required"), 401


@auth_bp.before_request
def protect_auth():
    """Check the CSRF token before handling an unsafe request under /auth.

    Raises
    ------
    flask_wtf.csrf.CSRFError
        The check raises this error if the CSRF token is missing or invalid.

    Notes
    -----
    The CSRF token helps prevent another website from submitting a request
    using the user's login session.
    """
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        current_app.extensions["csrf"].protect()


@auth_bp.get("/session")
def user_session():
    """Return the login status and CSRF token for GET /auth/session.

    Returns
    -------
    flask.Response
        The JSON response contains ``user_id``, ``auth_mode``, and ``csrf_token``
        with status 200. The user ID is null when nobody is logged in. The browser
        is told not to cache this response.
    """
    response = jsonify(
        user_id=str(current_user.id) if current_user.is_authenticated else None,
        auth_mode=current_app.config["AUTH_MODE"],
        is_admin=current_user.is_authenticated and current_user.is_admin,
        csrf_token=generate_csrf(),
    )
    response.headers["Cache-Control"] = "no-store"
    return response


@auth_bp.route("/login", methods=["GET", "POST"])
def login():
    """Handle login requests at /auth/login.

    Returns
    -------
    flask.Response or tuple of (flask.Response, int)
        GET sends the browser to the external provider or the local login page.
        POST logs in a local user and returns status 200 on success. It returns
        status 401 for an incorrect username or password, or status 400 when
        external login is enabled.

    Notes
    -----
    POST requests supply ``username`` and ``password`` as form fields and
    need a valid CSRF token. Successful login replaces the previous session.
    """
    if request.method == "GET":
        if current_app.config["AUTH_MODE"] == "oidc":
            return oauth.identity.authorize_redirect(
                current_app.config["OIDC_REDIRECT_URI"]
            )
        return redirect("/login")
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
    if not password_hash or not valid or row["is_blocked"]:
        return jsonify(message="Invalid username or password"), 401
    session.clear()
    login_user(User(row))
    return jsonify(message="Logged in")


@auth_bp.get("/callback")
def callback():
    """Finish an external login when the provider calls /auth/callback.

    Returns
    -------
    flask.Response or tuple of (flask.Response, int)
        Successful login sends the browser to the home page. The response has
        status 404 if external login is disabled, or status 400 if exchanging
        the login token fails.

    Notes
    -----
    The provider name and its user ID identify the local user record. This
    function creates that record if needed and replaces the previous session.
    """
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
            "INSERT INTO users (issuer, subject, session_id) VALUES (?, ?, ?) "
            "ON CONFLICT (issuer, subject) DO NOTHING",
            (identity["iss"], identity["sub"], token_hex(32)),
        )
    row = db.execute(
        "SELECT * FROM users WHERE issuer = ? AND subject = ?",
        (identity["iss"], identity["sub"]),
    ).fetchone()
    if row["is_blocked"]:
        return jsonify(message="Account is blocked"), 403
    session.clear()
    login_user(User(row))
    return redirect("/")


@auth_bp.post("/logout")
def logout():
    """Log out the user and clear their session at POST /auth/logout.

    Returns
    -------
    flask.Response
        The response contains ``message="Logged out"`` and status 200.

    Notes
    -----
    The request needs a valid CSRF token.
    """
    logout_user()
    session.clear()
    return jsonify(message="Logged out")


@click.command("create-user")
@click.argument("username")
@click.password_option(confirmation_prompt=True)
@click.option("--admin", is_flag=True)
@with_appcontext
def create_user(username, password, admin):
    """Add a local user with the Flask create-user command.

    Parameters
    ----------
    username : str
        The username is saved after surrounding spaces are removed.
    password : str
        The password is hashed before it is saved. The command asks the user
        to enter it twice.

    Raises
    ------
    click.ClickException
        The command raises this error if either value is empty or the username
        already exists.

    Notes
    -----
    The command saves the new user and prints a confirmation. Run it through
    the Flask CLI so Flask can select the app's database.
    """
    username = username.strip()
    if not username or not password:
        raise click.ClickException("Username and password are required.")
    password_hash = generate_password_hash(password)
    db = get_db()
    try:
        with db:
            db.execute(
                "INSERT INTO users (username, password_hash, is_admin, session_id) "
                "VALUES (?, ?, ?, ?)",
                (username, password_hash, admin, token_hex(32)),
            )
    except sqlite3.IntegrityError as error:
        raise click.ClickException("Username already exists.") from error
    click.echo(f"Created user {username}")



@click.command("promote-user")
@click.argument("user_id", type=click.IntRange(1, 9223372036854775807))
@with_appcontext
def promote_user(user_id):
    db = get_db()
    with db:
        result = db.execute(
            "UPDATE users SET is_admin = 1 WHERE id = ?", (user_id,)
        )
    if not result.rowcount:
        raise click.ClickException("User not found.")
    click.echo(f"User {user_id} is now an admin")


def init_auth(app):
    """Set up login, logout, and the user creation command for the app.

    Parameters
    ----------
    app : flask.Flask
        The app supplies ``AUTH_MODE`` and the settings for external login.

    Raises
    ------
    ValueError
        Setup raises this error if the mode is not ``local`` or ``oidc``, or
        a required external login setting is missing.

    Notes
    -----
    The ``oidc`` mode connects to an external login provider. The ``local``
    mode prepares a dummy password hash so unknown usernames still go through
    a password check.
    """
    login_manager.init_app(app)
    app.cli.add_command(create_user)
    app.cli.add_command(promote_user)
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
