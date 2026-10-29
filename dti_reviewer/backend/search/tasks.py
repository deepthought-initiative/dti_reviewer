from time import monotonic

from celery.signals import worker_init

from celery_app import celery
from search.similarity_engine import REVIEWER_PAPER_COUNT, SimilarityEnginePapers
from storage.vector_store import load_vector
from storage.search_history import save_search_state
from storage.paper_metadata import YEARS, is_valid_year_range


engine = None


def initialize_similarity_engine():
    global engine
    if engine is None:
        engine = SimilarityEnginePapers()
    return engine


@worker_init.connect
def preload_embeddings(**kwargs):
    initialize_similarity_engine().embedding_cache.preload(YEARS)


@celery.task(bind=True)
def query_experts_task(
    self, vector_id, objective, title, year_start, year_end, database=None
):
    try:
        results = find_reviewers(
            self, vector_id, objective, title, database, year_start, year_end
        )
        save_search_state(database, self.request.id, "SUCCESS", results=results)
        return results
    except Exception:
        save_search_state(
            database, self.request.id, "FAILURE",
            error="Search failed. Please start a new search.",
        )
        raise


def find_reviewers(
    self, vector_id, objective, title, database, year_start, year_end
):
    if not is_valid_year_range(year_start, year_end):
        raise ValueError("Invalid search year range")
    similarity_engine = initialize_similarity_engine()
    query_vector = load_vector(vector_id)
    if query_vector is None:
        raise ValueError("Query vector not found or expired")

    proposal_hits = []
    papers_scored = 0

    def report_progress(stage, percent, **details):
        progress = {
            "stage": stage,
            "percent": percent,
            "papers_scored": papers_scored,
            **details,
        }
        save_search_state(database, self.request.id, "PROGRESS", progress=progress)
        self.update_state(state="PROGRESS", meta=progress)

    report_progress("scoring", 0)
    for year in range(year_start, year_end + 1):
        year_hits, year_paper_count = similarity_engine.score_papers_for_year(
            query_vector, year
        )
        proposal_hits.extend(year_hits)
        papers_scored += year_paper_count
        scored_share = (year - year_start + 1) / (year_end - year_start + 1)
        report_progress("scoring", scored_share, year=year)

    proposal_hits = sorted(
        proposal_hits,
        key=lambda hit: hit[2],
        reverse=True,
    )
    top_papers_for_objective = proposal_hits[:REVIEWER_PAPER_COUNT]
    total_papers = len(top_papers_for_objective)
    papers_read = 0
    last_update = monotonic()
    report_progress("reading", 0, papers_read=0, total_papers=total_papers)

    def report_records_read(count):
        nonlocal papers_read, last_update
        papers_read += count
        now = monotonic()
        if now - last_update >= 0.5 or papers_read == total_papers:
            report_progress(
                "reading",
                papers_read / total_papers,
                papers_read=papers_read,
                total_papers=total_papers,
            )
            last_update = now

    rows = similarity_engine.attach_records(
        top_papers_for_objective,
        objective,
        on_records_read=report_records_read,
    )
    report_progress(
        "grouping", 1, papers_read=papers_read, total_papers=total_papers
    )
    authors = similarity_engine.rollup(rows)

    return {
        "year_start": year_start,
        "year_end": year_end,
        "counts": {
            "papers": rows.attrs["papers"],
            "author_rows": rows.attrs["author_rows"],
            "with_orcid": len(rows),
            "people": rows["orcid"].nunique(),
        },
        "authors": authors.to_dict(orient="records"),
    }
