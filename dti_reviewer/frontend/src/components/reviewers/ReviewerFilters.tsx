import { ColumnSummary, AffiliationValues } from "./ReviewerColumnInsights"
import { Select } from "@/components/ui/select"
import { FunnelSimple, X } from "@phosphor-icons/react"
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "@/components/ui/popover"
import { useState } from "react"
import type { Column, FilterFn } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Author } from "./reviewerColumns"

const textFields = new Set(["author", "affiliation", "orcid"])
const operators = { contains: "Contains", excludes: "Does not contain", equals: "Equals", starts: "Starts with", missing: "Missing", present: "Present" }
type TextOperator = keyof typeof operators
export type ValueSelection = { values: Set<string>; exclude: boolean }
export type ReviewerFilter = ValueSelection | { operator: TextOperator; text: string } | { min: string; max: string }

export const filterReviewer: FilterFn<Author> = (row, id, value: ReviewerFilter) => {
  if ("values" in value) return value.values.has(row.getValue<string>(id)) !== value.exclude
  if ("operator" in value) {
    const text = row.getValue<string>(id).trim().toLowerCase()
    const query = value.text.trim().toLowerCase()
    switch (value.operator) {
      case "missing": return text === ""
      case "present": return text !== ""
      case "contains": return text.includes(query)
      case "excludes": return !text.includes(query)
      case "equals": return text === query
      case "starts": return text.startsWith(query)
    }
  }
  const number = row.getValue<number>(id)
  return (value.min === "" || number >= Number(value.min)) && (value.max === "" || number <= Number(value.max))
}
filterReviewer.autoRemove = (value: ReviewerFilter | undefined) => {
  // TanStack calls this with undefined when a filter is cleared.
  if (value === undefined) return true
  if ("values" in value) return value.values.size === 0
  if ("operator" in value) return !["missing", "present"].includes(value.operator) && !value.text.trim()
  return value.min === "" && value.max === ""
}

export function ColumnFilter({ column }: { column: Column<Author> }) {
  const label = String(column.columnDef.header)
  return <Popover>
    <PopoverTrigger asChild><Button variant="ghost" size="icon" className="column-filter-trigger"
      data-active={column.getIsFiltered()} aria-label={`Filter ${label}`}>
      <FunnelSimple weight={column.getIsFiltered() ? "fill" : "regular"} />
    </Button></PopoverTrigger>
    <PopoverContent aria-label={`Filter ${label}`}>
      <div className="explorer-panel-heading"><h3>{label}</h3>
        <PopoverClose asChild><Button variant="ghost" size="icon" aria-label="Close filter"><X /></Button></PopoverClose>
      </div>
      <FilterEditor column={column} />
    </PopoverContent>
  </Popover>
}

export function FilterEditor({ column }: { column: Column<Author> }) {
  return <div className="filter-editor">
    <ColumnSummary column={column} />
    {textFields.has(column.id) ? <TextFilter column={column} /> : <NumericFilter column={column} />}
    {column.id === "affiliation" && <AffiliationValues column={column} />}
    {column.getIsFiltered() && <Button variant="ghost" size="sm" onClick={() => column.setFilterValue(undefined)}>Clear this filter</Button>}
  </div>
}

function NumericFilter({ column }: { column: Column<Author> }) {
  const value = column.getFilterValue() as { min: string; max: string } | undefined
  const [selected, setMode] = useState(value?.max ? value.min ? "between" : "maximum" : "minimum")
  const label = String(column.columnDef.header)
  const similarity = column.id.endsWith("similarity")
  const step = similarity ? 0.001 : column.id === "n_papers" ? 1 : 0.5
  const bounds = selected === "between" ? ["min", "max"] as const : selected === "maximum" ? ["max"] as const : ["min"] as const
  return <div className="column-filter-fields">
    <Select label={`${label} condition`} value={selected} onValueChange={(next) => {
      setMode(next)
      column.setFilterValue({ min: next === "maximum" ? "" : value?.min ?? "", max: next === "minimum" ? "" : value?.max ?? "" })
    }} options={[{ value: "minimum", label: "At least" }, { value: "maximum", label: "At most" }, { value: "between", label: "Between" }]} />
    <div className="numeric-filter-bounds">{bounds.map((bound) => <label key={bound}><span className="sr-only">{bound === "min" ? "Minimum" : "Maximum"}</span>
      <Input type="number" step={step} min={0} max={similarity ? 1 : undefined} placeholder={similarity ? "0.000" : "Any"} aria-label={`${label} ${bound === "min" ? "minimum" : "maximum"}`}
        value={value?.[bound] ?? ""} onChange={(event) => column.setFilterValue({ min: "", max: "", ...value, [bound]: event.target.value })} />
    </label>)}</div>
    {value && value.min !== "" && value.max !== "" && Number(value.min) > Number(value.max)
      && <p role="alert">Minimum exceeds maximum. No rows match.</p>}
  </div>
}

function TextFilter({ column }: { column: Column<Author> }) {
  const value = column.getFilterValue() as Extract<ReviewerFilter, { operator: string }> | undefined
  const [operator, setOperator] = useState<TextOperator>(column.id === "orcid" ? "equals" : "contains")
  const selected = value?.operator ?? operator
  return <div className="column-filter-fields">
    <Select label={`${String(column.columnDef.header)} condition`} value={selected}
      onValueChange={(operator) => {
        setOperator(operator as TextOperator)
        column.setFilterValue({ operator, text: value?.text ?? "" })
      }} options={Object.entries(operators)
        .filter(([id]) => column.id !== "orcid" || ["equals", "missing", "present"].includes(id))
        .map(([value, label]) => ({ value, label: column.id === "orcid" && value === "equals" ? "Exact match" : label }))} />
    {!["missing", "present"].includes(selected) && <Input
      aria-label={`${String(column.columnDef.header)} filter text`} value={value?.text ?? ""}
      onChange={(event) => column.setFilterValue({ operator: selected, text: event.target.value })} />}
  </div>
}

export function describeFilter(value: ReviewerFilter) {
  if ("values" in value) return `${value.exclude ? "excludes" : "includes"} ${value.values.size} recorded ${value.values.size === 1 ? "value" : "values"}`
  if ("operator" in value) return `${operators[value.operator].toLowerCase()} ${["missing", "present"].includes(value.operator) ? "" : `“${value.text}”`}`.trim()
  if (value.min === "") return `at most ${value.max}`
  if (value.max === "") return `at least ${value.min}`
  return `between ${value.min} and ${value.max}`
}
