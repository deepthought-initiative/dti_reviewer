from flask import Flask
from flask_cors import CORS
from similarity_engine import list_all_engines

def create_app(test_config=None):
    # create and configure the app
    app = Flask(__name__, instance_relative_config=True)
    CORS(app, origins="*")
    if test_config is None:
        # load the instance config, if it exists, when not testing
        app.config.from_pyfile('config.py', silent=True)
        app.config['available_engines'] = list_all_engines()
    else:
        # load the test config if passed in
        app.config.from_mapping(test_config)

    from api import api_bp
    app.register_blueprint(api_bp)

    return app

app = create_app()
