const About = () => {
    return (
        <main className="max-w-4xl mx-auto p-6 space-y-8">
            <section>
                <h1 className="text-3xl font-bold mb-4">About DTI Reviewer</h1>
                <p>
                    DTI Reviewer is an open-source tool for identifying experts in physics for tasks like peer review and collaboration.
                    As the global research community grows, finding qualified reviewers has become increasingly difficult.
                    DTI Reviewer addresses this challenge using deterministic machine learning techniques to identify experts based on a dataset created by cross-matching NASA/ADS publications with ORCID profiles.
                    Our initial approach uses TF-IDF to rank expertise.
                </p>

                <h3 className="text-2xl font-semibold mt-6 mb-2">Example: Finding Experts with Research Vectors</h3>
                <p>
                    For each researcher, we build a knowledge vector by combining the titles and abstracts of their publications.
                    These are embedded into a numerical vector space.
                    When a user submits a query (e.g., the abstract of a new manuscript), we embed that query in the same space.
                    We then compute cosine similarity between the query and each researcher’s vector to rank potential reviewers by how closely their past work aligns with the query.
                    Submit your query via the web interface to get a ranked list of experts.
                    Submit any length of text from a few words to a full-text paper.
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
