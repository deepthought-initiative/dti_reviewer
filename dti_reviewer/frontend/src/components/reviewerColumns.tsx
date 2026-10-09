import { CaretDown, CaretRight, ArrowSquareOut } from "@phosphor-icons/react"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"

interface Paper {
  title: string
  year: number
  similarity: number
}

export interface Author {
  author: string
  orcid: string
  affiliation: string
  block: string
  n_papers: number
  best_similarity: number
  total_similarity: number
  papers: Paper[]
}

export interface SearchResults {
  counts: { papers: number; author_rows: number; with_orcid: number; people: number }
  authors: Author[]
}

export const reviewerColumns: ColumnDef<Author>[] = [
  {
    accessorKey: "author", header: "Author", size: 220, minSize: 160,
    cell: ({ row }) => (
      <div className="author-cell">
        <Button variant="ghost" size="icon" className="expand-author"
          aria-label={`${row.getIsExpanded() ? "Hide" : "Show"} papers for ${row.original.author}`}
          aria-expanded={row.getIsExpanded()} aria-controls={`papers-${row.id}`}
          onClick={row.getToggleExpandedHandler()}>
          {row.getIsExpanded() ? <CaretDown /> : <CaretRight />}
        </Button>
        <span className="truncate font-medium" title={row.original.author}>{row.original.author}</span>
      </div>
    ),
  },
  {
    accessorKey: "affiliation", header: "Affiliation", size: 270, minSize: 160,
    cell: ({ getValue }) => <span className="block truncate" title={getValue<string>()}>{getValue<string>() || "Not listed"}</span>,
  },
  {
    accessorKey: "orcid", header: "ORCID", size: 205, minSize: 180,
    cell: ({ getValue }) => (
      <a className="orcid-link" href={`https://orcid.org/${getValue<string>()}`} target="_blank" rel="noopener noreferrer">
        {getValue<string>()}<ArrowSquareOut size={12} aria-hidden="true" />
      </a>
    ),
  },
  { accessorKey: "n_papers", header: "Papers", size: 85, minSize: 75, enableGlobalFilter: false },
  {
    accessorKey: "best_similarity", header: "Best similarity", size: 130, minSize: 125, enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="score-value">{getValue<number>().toFixed(3)}</span>,
  },
  {
    accessorKey: "total_similarity", header: "Total similarity", size: 140, minSize: 130, enableGlobalFilter: false,
    cell: ({ getValue }) => <span className="total-score">{getValue<number>().toFixed(3)}</span>,
  },
]
