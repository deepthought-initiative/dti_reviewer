from pathlib import Path

project = "dti_reviewer"
author = "Deep Thought Initiative"
extensions = ["autoapi.extension", "sphinx.ext.napoleon"]

root_doc = "index"
autoapi_dirs = [str(Path(__file__).resolve().parents[1] / "dti_reviewer/backend")]
autoapi_ignore = ["*/tests/*"]
autoapi_options = ["members", "undoc-members", "show-inheritance"]
napoleon_google_docstring = False
exclude_patterns = ["_build", "api.rst", "architecture.rst", "getting_started.rst"]
html_theme = "alabaster"
