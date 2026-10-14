import type { Author } from "./reviewerColumns"

export function AuthorPapers({ author, id }: { author: Author; id: string }) {
  return (
    <section id={id} className="author-papers" aria-label={`Papers for ${author.author}`}>
      <div className="paper-context">
        <h3>{author.author}</h3>
        <p>{author.affiliation || "Affiliation not listed"}</p>
        <span>{author.papers.length.toLocaleString()} supporting papers</span>
      </div>
      <ol className="paper-list">
        {author.papers.map((paper, index) => (
          <li key={index}>
            <span className="paper-year">{paper.year}</span>
            <span>{paper.title}</span>
            <span className="paper-score" title="Paper similarity">{paper.similarity.toFixed(3)}</span>
          </li>
        ))}
      </ol>
    </section>
  )
}
