import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"

import { ResultTable } from "./ResultTable"


describe("ResultTable component", () => {
    it("renders cells when data is provided", () => {
        const results = {
            year_start: 2004, year_end: 2024,
            counts: {
                papers: 1,
                author_rows: 2,
                with_orcid: 1,
                people: 1,
            },
            authors: [{
                author: "Alice Author",
                orcid: "0000-0000-0000-0001",
                affiliation: "Institute",
                block: "a.author",
                n_papers: 1,
                top_similarity: 0.95,
                average_similarity: 0.95,
                position_score: 1,
                similarity_rank: 1,
                position_rank: 1,
                combined_rank: 2,
                papers: [{ title: "Paper", bibcode: "2024ApJ...970...42S", year: 2024, similarity: 0.95 }],
            }],
        }

        render(<ResultTable results={results} />)
        expect(screen.getAllByRole("cell").length).toBeGreaterThan(0)
    })
})
