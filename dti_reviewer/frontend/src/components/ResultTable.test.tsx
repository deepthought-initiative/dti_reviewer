
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ResultTable } from "../components/ResultTable";

describe("ResultTable component", () => {
    it("renders <td> elements when data is provided", () => {
        const mockData = [
            {
                orcid: "A123",
                author: "Alice",
                similarity: 0.95,
                name_variations: ["Alice A.", "A. Author"],
            },
            {
                orcid: "B456",
                author: "Bob",
                similarity: 0.85,
                name_variations: ["Bob B."],
            },
        ];

        render(<ResultTable dataToDisplay={mockData} />);
        // <td> elements have role="cell"
        const cells = screen.getAllByRole("cell");
        expect(cells.length).toBeGreaterThan(0);
    });
});
