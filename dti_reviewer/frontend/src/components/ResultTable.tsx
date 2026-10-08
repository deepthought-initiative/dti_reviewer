import { Fragment, useState } from "react"
import { ArrowDown, ArrowUp, ArrowsDownUp, CaretLeft, CaretRight, MagnifyingGlass, X } from "@phosphor-icons/react"
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, type SortingState,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { reviewerColumns, type SearchResults } from "./reviewerColumns"

import { AuthorPapers } from "./AuthorPapers"

export type { SearchResults } from "./reviewerColumns"

export function ResultTable({ results }: { results: SearchResults }) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "total_similarity", desc: true }])
  const [filter, setFilter] = useState("")
  const table = useReactTable({
    data: results.authors,
    columns: reviewerColumns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    globalFilterFn: "includesString",
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (author) => author.orcid,
    getRowCanExpand: () => true,
    columnResizeMode: "onChange",
    enableSortingRemoval: false,
    initialState: { pagination: { pageSize: 25 } },
  })
  const count = table.getFilteredRowModel().rows.length
  const { pageIndex, pageSize } = table.getState().pagination
  const first = count ? pageIndex * pageSize + 1 : 0
  const last = Math.min((pageIndex + 1) * pageSize, count)

  return (
    <div className="reviewer-results">
      <div className="results-summary">
        <div><h2>Suggested reviewers <span>{results.counts.people.toLocaleString()}</span></h2>
          <p>From {results.counts.papers.toLocaleString()} matched papers</p></div>
        <details className="search-counts"><summary>Search breakdown</summary>
          <dl><div><dt>Author entries</dt><dd>{results.counts.author_rows.toLocaleString()}</dd></div>
            <div><dt>Entries with ORCID</dt><dd>{results.counts.with_orcid.toLocaleString()}</dd></div></dl>
        </details>
      </div>
      <div className="results-toolbar">
        <div className="reviewer-filter">
          <MagnifyingGlass size={18} aria-hidden="true" />
          <Input aria-label="Filter reviewers" placeholder="Filter by name, affiliation or ORCID"
            value={filter} onChange={(event) => setFilter(event.target.value)} />
          {filter && <Button variant="ghost" size="icon" aria-label="Clear filter" onClick={() => setFilter("")}><X /></Button>}
        </div>
        <span className="results-hint">Drag column edges to resize</span>
      </div>
      <div className="reviewer-table-scroll" role="region" aria-label="Reviewer results" tabIndex={0}>
        <Table className="reviewer-table" style={{ width: table.getTotalSize(), minWidth: "100%", tableLayout: "fixed" }}>
          <TableHeader>{table.getHeaderGroups().map((group) => (
            <TableRow key={group.id}>{group.headers.map((header) => {
              const sort = header.column.getIsSorted()
              const label = String(header.column.columnDef.header)
              return (
                <TableHead key={header.id} style={{ width: header.getSize() }}
                  aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}>
                  <button className="column-sort" onClick={header.column.getToggleSortingHandler()}>
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {sort === "asc" ? <ArrowUp weight="bold" /> : sort === "desc" ? <ArrowDown weight="bold" /> : <ArrowsDownUp />}
                  </button>
                  <div role="separator" aria-label={`Resize ${label} column`} aria-orientation="vertical"
                    aria-valuenow={header.getSize()} aria-valuemin={header.column.columnDef.minSize}
                    tabIndex={0} className="column-resizer" data-resizing={header.column.getIsResizing()}
                    onMouseDown={header.getResizeHandler()} onTouchStart={header.getResizeHandler()}
                    onDoubleClick={() => header.column.resetSize()}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                        event.preventDefault()
                        const change = event.key === "ArrowRight" ? 20 : -20
                        table.setColumnSizing((sizes) => ({ ...sizes, [header.column.id]: Math.max(header.column.columnDef.minSize ?? 75, header.getSize() + change) }))
                      }
                    }} />
                </TableHead>
              )
            })}</TableRow>
          ))}</TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <Fragment key={row.id}>
                <TableRow data-expanded={row.getIsExpanded()}>
                  {row.getVisibleCells().map((cell) => <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>)}
                </TableRow>
                {row.getIsExpanded() && <TableRow className="expanded-paper-row"><TableCell colSpan={reviewerColumns.length}>
                  <AuthorPapers author={row.original} id={`papers-${row.id}`} />
                </TableCell></TableRow>}
              </Fragment>
            ))}
            {count === 0 && <TableRow><TableCell colSpan={reviewerColumns.length}>
              <div className="empty-filter">No reviewers match this filter.<Button variant="link" onClick={() => setFilter("")}>Clear filter</Button></div>
            </TableCell></TableRow>}
          </TableBody>
        </Table>
      </div>
      <div className="table-pagination">
        <span role="status">{first.toLocaleString()}–{last.toLocaleString()} of {count.toLocaleString()} reviewers</span>
        <div className="pagination-controls">
          <label>Rows <select aria-label="Rows per page" value={pageSize} onChange={(event) => table.setPageSize(Number(event.target.value))}>
            <option value={25}>25</option><option value={50}>50</option>
          </select></label>
          <Button variant="outline" size="icon" aria-label="Previous page" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}><CaretLeft /></Button>
          <span>{pageIndex + 1} / {Math.max(1, table.getPageCount())}</span>
          <Button variant="outline" size="icon" aria-label="Next page" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}><CaretRight /></Button>
        </div>
      </div>
    </div>
  )
}
