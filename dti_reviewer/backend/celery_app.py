from celery import Celery

celery = Celery(
    "expert_finder_tasks",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
    include=["search.tasks"]
)
