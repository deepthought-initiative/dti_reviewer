import json
import sqlite3


def save_search_state(database, search_id, state, *, progress=None, results=None, error=None):
    if database is None:
        return
    connection = sqlite3.connect(database, timeout=5)
    try:
        with connection:
            connection.execute(
                "UPDATE searches SET state = ?, progress = ?, results = ?, error = ? WHERE id = ?",
                (state, json.dumps(progress) if progress is not None else None,
                 json.dumps(results) if results is not None else None, error, search_id),
            )
    finally:
        connection.close()
