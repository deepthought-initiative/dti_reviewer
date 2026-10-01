import sqlite3
from pathlib import Path

from flask import current_app, g


def get_db():
    """Open the app's database connection, or reuse it if it is already open.

    Returns
    -------
    sqlite3.Connection
        The connection lets callers read columns by name and checks foreign
        keys. It waits up to five seconds when the database is locked.

    Notes
    -----
    Flask must know which app's ``DATABASE`` setting to use. It sets this up
    during requests. In a standalone script, call this function inside
    ``with app.app_context():``. Calls within that block share one connection.
    """
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"], timeout=5)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


def close_db(error=None):
    """Close the database connection that Flask opened for this request or block.

    Parameters
    ----------
    error : BaseException, optional
        Flask supplies any error that occurred while handling the request.
        This function does not use it.

    Notes
    -----
    This function does nothing if no connection was opened. It does not save
    any uncommitted database changes.
    """
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db(app):
    """Create the users table and arrange for Flask to close database connections.

    Parameters
    ----------
    app : flask.Flask
        The app's ``DATABASE`` setting gives the path to the SQLite file.

    Notes
    -----
    This function creates the database directory and users table if needed.
    It enables SQLite's write-ahead log so reads can continue during a write.
    """
    app.teardown_appcontext(close_db)
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    with app.app_context():
        db = get_db()
        db.execute("PRAGMA journal_mode = WAL")
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                username TEXT UNIQUE,
                password_hash TEXT,
                issuer TEXT,
                subject TEXT,
                is_admin INTEGER NOT NULL DEFAULT 0,
                is_blocked INTEGER NOT NULL DEFAULT 0,
                session_id TEXT NOT NULL UNIQUE,
                UNIQUE (issuer, subject)
            );
        """)
