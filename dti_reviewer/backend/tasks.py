from time import monotonic

from celery_app import celery
from similarity_engine import REVIEWER_PAPER_COUNT, SimilarityEnginePapers
from vector_store import load_vector


engine = None


def initialize_similarity_engine():
    global engine
    if engine is None:
        engine = SimilarityEnginePapers()
    return engine


@celery.task(bind=True)
def query_experts_task(self, vector_id, objective, title):
    similarity_engine = initialize_similarity_engine()
    query_vector = load_vector(vector_id)
    if query_vector is None:
        raise ValueError("Query vector not found or expired")

    proposal_hits = []
    papers_scored = 0

    def report_progress(stage, percent, **details):
        self.update_state(
            state="PROGRESS",
            meta={
                "stage": stage,
                "percent": percent,
                "papers_scored": papers_scored,
                **details,
            },
        )

    report_progress("scoring", 0)
    for year in range(2004, 2025):
        year_hits, year_paper_count = similarity_engine.score_papers_for_year(
            query_vector, year
        )
        proposal_hits.extend(year_hits)
        papers_scored += year_paper_count
        report_progress("scoring", (year - 2003) / 21, year=year)

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
        "counts": {
            "papers": rows.attrs["papers"],
            "author_rows": rows.attrs["author_rows"],
            "with_orcid": len(rows),
            "people": rows["orcid"].nunique(),
        },
        "authors": authors.to_dict(orient="records"),
    }
