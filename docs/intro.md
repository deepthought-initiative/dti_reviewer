# dti_reviewer

Reviewer matching for STScI proposals. Paste a research abstract and get a
ranked list of astronomers, identified by ORCID, whose published work is most
similar to it.

The system has two components: a React frontend and a Flask API backed by a
Celery worker, which matches queries to authors with TF IDF cosine similarity.
