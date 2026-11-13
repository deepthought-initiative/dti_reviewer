import { ReviewerExport } from "./ReviewerExport"
import { Select } from "@/components/ui/select"
import { useState } from "react"
import type { Table } from "@tanstack/react-table"
import { Columns, FunnelSimple, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "@/components/ui/popover"
import { FilterEditor, describeFilter, type ReviewerFilter } from "./ReviewerFilters"
import { ReviewerSort } from "./ReviewerSort"
import type { Author } from "./reviewerColumns"

export function ReviewerControls({ table, searchId, k, onKChange }: { table: Table<Author>; searchId: string; k: number; onKChange: (k: number) => void }) {
  const [field, setField] = useState("author")
  const columns = table.getAllLeafColumns()
  const filters = table.getState().columnFilters
  return <div className="explorer-actions">
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" className="explorer-trigger"><FunnelSimple />Filters {filters.length > 0 && <span>{filters.length}</span>}</Button></PopoverTrigger>
      <PopoverContent aria-label="Filter reviewers by column">
        <div className="explorer-panel-heading"><h3>Filter reviewers</h3>
          <PopoverClose asChild><Button variant="ghost" size="icon" aria-label="Close filters"><X /></Button></PopoverClose>
        </div>
        <p className="explorer-help">Reviewers must match every active filter. Scores and ranks stay unchanged.</p>
        <div className="filter-field-label">Column<Select label="Column to filter" value={field} onValueChange={setField}
          options={columns.map((column) => ({ value: column.id, label: `${String(column.columnDef.header)}${column.getIsFiltered() ? " (filtered)" : ""}` }))} />
        </div>
        <FilterEditor key={field} column={table.getColumn(field)!} />
        {filters.length > 0 && <div className="active-filter-list"><h4>Active filters</h4>
          {filters.map(({ id, value }) => <button key={id} onClick={() => setField(id)}>
            <strong>{String(table.getColumn(id)?.columnDef.header)}</strong> {describeFilter(value as ReviewerFilter)}
          </button>)}
        </div>}
      </PopoverContent>
    </Popover>
    <ReviewerSort table={table} k={k} onKChange={onKChange} />
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" className="explorer-trigger"><Columns />Columns</Button></PopoverTrigger>
      <PopoverContent aria-label="Visible columns">
        <div className="explorer-panel-heading"><h3>Visible columns</h3>
          <PopoverClose asChild><Button variant="ghost" size="icon" aria-label="Close columns"><X /></Button></PopoverClose>
        </div>
        <div className="column-choices">{columns.map((column) => <label key={column.id}>
          <input type="checkbox" checked={column.getIsVisible()} disabled={column.id === "author"} onChange={column.getToggleVisibilityHandler()} />
          <span>{String(column.columnDef.header)}</span>{column.getIsFiltered() && <FunnelSimple size={14} aria-label="Filtered" />}
        </label>)}</div>
        <p className="explorer-help">Hiding a column keeps its filters and sort rules active.</p>
      </PopoverContent>
    </Popover>
    <ReviewerExport table={table} searchId={searchId} k={k} />
  </div>
}

export function ReviewerView({ table, clear }: { table: Table<Author>; clear: () => void }) {
  const { columnFilters, globalFilter } = table.getState()
  return <div className="reviewer-view">
    <span role="status"><strong>{table.getFilteredRowModel().rows.length.toLocaleString()}</strong> of {table.getCoreRowModel().rows.length.toLocaleString()} reviewers</span>
    <div className="filter-chips">
      {globalFilter && <Button variant="outline" size="sm" onClick={() => table.setGlobalFilter("")}>Search: {globalFilter}<X /></Button>}
      {columnFilters.map(({ id, value }) => <Button variant="outline" size="sm" key={id} aria-label={`Remove ${id} filter`}
        onClick={() => table.getColumn(id)?.setFilterValue(undefined)}>{String(table.getColumn(id)?.columnDef.header)} {describeFilter(value as ReviewerFilter)}<X /></Button>)}
      {(columnFilters.length > 0 || globalFilter) && <Button variant="ghost" size="sm" onClick={clear}>Clear all</Button>}
    </div>
  </div>
}
