import pytest
from flask import Flask

from api import api_bp


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config["LOGIN_DISABLED"] = True
    app.register_blueprint(api_bp)
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def test_missing_query_key(client):
    resp = client.post("/vectorize", json={})
    assert resp.status_code == 400
    assert resp.get_json()["message"] == "Missing 'abstract' parameter"


def test_empty_query_string(client):
    resp = client.post("/vectorize", json={"abstract": "   "})
    assert resp.status_code == 400
    assert resp.get_json()["message"] == "Abstract cannot be empty"


def test_query_too_short(client):
    resp = client.post("/vectorize", json={"abstract": "hi"})
    assert resp.status_code == 400
    message = resp.get_json()["message"]
    assert message == "Abstract too short. Minimum 3 characters"
