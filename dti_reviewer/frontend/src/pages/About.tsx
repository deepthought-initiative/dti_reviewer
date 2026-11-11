const About = () => {
    return (
        <main className="max-w-4xl mx-auto px-6 py-16 space-y-12">
            <section>
                <h1 className="text-3xl font-bold mb-4">About DTI Reviewer</h1>
                <p>
                    DTI Reviewer is an open-source tool for identifying experts in physics for tasks like peer review and collaboration.
                    As the global research community grows, finding qualified reviewers has become increasingly difficult.
                    DTI Reviewer searches a local collection of publication records from SciX, with precomputed TF-IDF vectors for refereed papers from 2004 through 2024.
                    It compares your search text with individual papers, then groups matching papers by author to suggest reviewers.
                </p>

                <h3 className="text-2xl font-semibold mt-6 mb-2">How reviewers are ranked</h3>
                <p>
                    Your search text is transformed using the same TF-IDF model as the papers.
                    Cosine similarity measures how closely their vocabulary matches within your selected years.
                    The search selects up to 10,000 matching papers and excludes scores of 0.92 or higher as possible copies or close variations.
                    Reviewers are initially ranked by the average similarity of their included papers, with other sorting options available in the results.
                    Similarity measures how closely the vocabulary of a paper matches your search text. It does not directly measure a researcher’s expertise.
                </p>

                <h3 className="text-2xl font-semibold mt-6 mb-2">Author coverage and ORCID</h3>
                <p>
                    The current algorithm considers only the first two authors of each selected paper.
                    It uses the ORCID identifiers already recorded in the publication metadata to group papers belonging to the same researcher.
                    It does not look up or cross-match external ORCID profiles during a search.
                    Authors without a recorded ORCID are currently excluded from reviewer results, so relevant researchers may be missing.
                </p>

                <p>
                    <strong>Code Repository:</strong>{" "}
                    <a
                        href="https://github.com/deepthought-initiative/dti_reviewer"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                    >
                        GitHub
                    </a>
                </p>
                <p>
                    <strong>Dataset (Version 1):</strong>{" "}
                    <a
                        href="https://zenodo.org/records/11489161"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                    >
                        Zenodo
                    </a>
                </p>


            </section>
            <section>
                <h1 className="text-3xl font-bold mb-4">About DeepThought Initiative</h1>
                <p>
                    <a
                        href="https://deepthought-initiative.github.io/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary underline"
                    >
                        DeepThought Initiative
                    </a> is an interdisciplinary collaboration of astrophysicists and data scientists researching computational meta-research in astrophysics.
                    As our global research community continues to grow at an unprecedented rate, our traditional research practices struggle to keep up.
                    We can leverage recent technological advancements, such as machine learning, to improve research processes from peer review to research management.
                    Our goal is to assist researchers through the entire research cycle, from optimizing resource allocation to reducing bias in peer review.
                    Explore our website to learn more about our work and stay up-to-date with the latest news and developments!
                </p>
            </section>
        </main>
    )
}

export default About
