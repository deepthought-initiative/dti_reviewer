import { useMemo, useState } from "react"
import type { Column } from "@tanstack/react-table"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import type { Author } from "./reviewerColumns"
import type { ValueSelection } from "./ReviewerFilters"

export function ColumnSummary({ column }: { column: Column<Author> }) {
  const values = column.getFacetedUniqueValues()
  const summary = useMemo(() => {
    let missing = 0
    let total = 0
    let distinct = 0
    let min = Infinity
    let max = -Infinity
    for (const [value, count] of values) {
      total += count
      if (typeof value === "string" && !value.trim()) missing += count
      else distinct += 1
      if (typeof value === "number") {
        min = Math.min(min, value)
        max = Math.max(max, value)
      }
    }
    const bins = Array.from({ length: 10 }, () => 0)
    if (Number.isFinite(min)) {
      // Faceted values are frequencies, so weight each bin by its reviewer count.
      for (const [value, count] of values) {
        const index = max === min ? 0 : Math.min(9, Math.floor((value - min) / (max - min) * 10))
        bins[index] += count
      }
    }
    return { missing, total, distinct, min, max, bins }
  }, [values])
  return <div className="column-summary">
    <dl><div><dt>Missing</dt><dd>{summary.missing.toLocaleString()}</dd></div>
      {column.id === "orcid"
        ? <div><dt>Present</dt><dd>{(summary.total - summary.missing).toLocaleString()}</dd></div>
        : <div><dt>Distinct</dt><dd>{summary.distinct.toLocaleString()}</dd></div>}
      {Number.isFinite(summary.min) && <>
        <div><dt>Min</dt><dd>{summary.min.toLocaleString(undefined, { maximumFractionDigits: 3 })}</dd></div>
        <div><dt>Max</dt><dd>{summary.max.toLocaleString(undefined, { maximumFractionDigits: 3 })}</dd></div>
      </>}
    </dl>
    {Number.isFinite(summary.min) && <div className="column-distribution" role="img"
      aria-label={`${String(column.columnDef.header)} distribution across ${summary.total.toLocaleString()} reviewers, from ${summary.min} to ${summary.max}`}>
      {summary.bins.map((count, index) => <span key={index} style={{ height: `${count / Math.max(1, ...summary.bins) * 100}%` }}
        title={`${(summary.min + (summary.max - summary.min) * index / 10).toFixed(3)} to ${(summary.min + (summary.max - summary.min) * (index + 1) / 10).toFixed(3)}: ${count.toLocaleString()} reviewers`} />)}
    </div>}
    <p>{summary.total.toLocaleString()} reviewers before this column’s filter</p>
  </div>
}

export function AffiliationValues({ column }: { column: Column<Author> }) {
  const [query, setQuery] = useState("")
  const [exclude, setExclude] = useState(false)
  const filter = column.getFilterValue() as ValueSelection | undefined
  const selection = filter && "values" in filter ? filter : undefined
  const values = column.getFacetedUniqueValues()
  const entries = useMemo(() => [...values.entries()] as [string, number][], [values])
  const matches = useMemo(() => entries.filter(([value]) => value.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])), [entries, query])
  const limit = 50
  return <details className="affiliation-values">
    <summary>Choose recorded values{selection ? ` (${selection.values.size})` : ""}</summary>
    <p>Exact affiliation text, not grouped institutions. Choosing values replaces the text condition above.</p>
    <Input aria-label="Search affiliation values" placeholder="Find affiliation values…" value={query} onChange={(event) => setQuery(event.target.value)} />
    <Select label="Affiliation selection mode" value={(selection?.exclude ?? exclude) ? "exclude" : "include"}
      onValueChange={(mode) => {
        setExclude(mode === "exclude")
        if (selection) column.setFilterValue({ ...selection, exclude: mode === "exclude" })
      }} options={[{ value: "include", label: "Include selected values" }, { value: "exclude", label: "Exclude selected values" }]} />
    <div className="affiliation-value-list">{matches.slice(0, limit).map(([value, count]) => <label key={value}>
      <input type="checkbox" checked={selection?.values.has(value) ?? false} onChange={(event) => {
        const selected = new Set(selection?.values)
        if (event.target.checked) selected.add(value)
        else selected.delete(value)
        column.setFilterValue({ values: selected, exclude: selection?.exclude ?? exclude })
      }} />
      <span title={value}>{value.trim() || "Missing affiliation"}</span><small>{count.toLocaleString()}</small>
    </label>)}</div>
    <p role="status">{matches.length === 0 ? "No matching values." : `Showing ${Math.min(limit, matches.length)} of ${matches.length.toLocaleString()} values. Search to narrow the list.`}</p>
  </details>
}
