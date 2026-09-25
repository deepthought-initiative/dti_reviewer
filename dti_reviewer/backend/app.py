import os
from pathlib import Path

from flask import Flask
from flask_cors import CORS
from flask_wtf.csrf import CSRFProtect

from auth import init_auth
from db import init_db


def create_app(test_config=None):
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, origins="*")
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("SECRET_KEY"),
        DATABASE=os.environ.get("DATABASE", str(Path(app.instance_path) / "reviewer.sqlite")),
        AUTH_MODE=os.environ.get("AUTH_MODE", "local"),
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=(
            os.environ.get("SESSION_COOKIE_SECURE", "false").lower() == "true"
        ),
        WTF_CSRF_CHECK_DEFAULT=False,
    )
    for key in ("OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET", "OIDC_METADATA_URL", "OIDC_REDIRECT_URI"):
        app.config[key] = os.environ.get(key)
    if test_config is None:
        app.config.from_pyfile("config.py", silent=True)
    else:
        app.config.from_mapping(test_config)
    if not app.config["SECRET_KEY"]:
        raise ValueError(
            "Set SECRET_KEY to a persistent random secret before starting the backend"
        )

    CSRFProtect(app)
    init_db(app)
    init_auth(app)

    from api import api_bp
    app.register_blueprint(api_bp)
    return app


app = create_app()
