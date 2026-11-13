import { Select } from "@/components/ui/select"
import { useId, useState } from "react"
import type { Table } from "@tanstack/react-table"
import { ArrowUp, ArrowsDownUp, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "@/components/ui/popover"
import type { Author } from "./reviewerColumns"

const isPositiveInteger = (value: string) => Number.isSafeInteger(Number(value)) && Number(value) >= 1

export function ReviewerSort({ table, k, onKChange }: { table: Table<Author>; k: number; onKChange: (k: number) => void }) {
  const [draft, setDraft] = useState(String(k))
  const id = useId()
  const sorting = table.getState().sorting
  const validK = isPositiveInteger(draft)
  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" className="explorer-trigger"><ArrowsDownUp />Sort <span>{sorting.length}</span></Button></PopoverTrigger>
    <PopoverContent className="sort-popover" aria-label="Sort reviewers">
      <div className="explorer-panel-heading"><h3>Sort reviewers</h3>
        <PopoverClose asChild><Button variant="ghost" size="icon" aria-label="Close sorting"><X /></Button></PopoverClose>
      </div>
      <p className="explorer-help">Rules apply from top to bottom. Later rules break ties.</p>
      <div className="sort-rules">{sorting.map((sort, index) => <div className="sort-rule" key={sort.id}>
        <span className="sort-priority">{index + 1}</span>
        <strong>{String(table.getColumn(sort.id)?.columnDef.header)}</strong>
        <Button variant="ghost" size="icon" disabled={index === 0} aria-label={`Move ${sort.id} earlier`} onClick={() => {
          const next = [...sorting]
          next[index - 1] = sort
          next[index] = sorting[index - 1]
          table.setSorting(next)
        }}><ArrowUp /></Button>
        <Button variant="ghost" size="icon" aria-label={`Remove sort ${sort.id}`} onClick={() => table.setSorting(sorting.filter((item) => item.id !== sort.id))}><X /></Button>
        <Select label={`Direction for ${sort.id}`} value={sort.desc ? "desc" : "asc"}
          onValueChange={(direction) => table.setSorting(sorting.map((item) => item.id === sort.id ? { ...item, desc: direction === "desc" } : item))}
          options={[{ value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }]} />
      </div>)}</div>
      <Select label="Add sort priority" value="" placeholder="Add a sort rule…" onValueChange={(id) => {
        const column = table.getColumn(id)!
        table.setSorting([...sorting, { id, desc: column.getFirstSortDir() === "desc" }])
        column.toggleVisibility(true)
      }} options={table.getAllLeafColumns().filter((column) => !sorting.some((sort) => sort.id === column.id))
        .map((column) => ({ value: column.id, label: String(column.columnDef.header) }))} />
      <div className="sort-k">
        <label htmlFor={`${id}-k`}>Papers per person (K)</label>
        <Input id={`${id}-k`} type="number" min={1} step={1} value={draft} aria-invalid={!validK} aria-describedby={`${id}-help`}
          onChange={(event) => { setDraft(event.target.value); if (isPositiveInteger(event.target.value)) onKChange(Number(event.target.value)) }}
          onBlur={() => setDraft(String(k))} />
        <p id={`${id}-help`}>{validK ? "Used for Top K average. If fewer papers are available, we average those papers." : "Enter a whole number of 1 or more."}</p>
      </div>
      <details className="rank-reference"><summary>How combined rank works</summary>
        <p className="font-semibold">Combined rank reference</p>
        <ol className="list-decimal space-y-3 pl-4">
          <li><strong>Paper positions.</strong> The system ranks papers by similarity, highest first. Each person's position score is the sum of <strong>1 / paper rank</strong> across their papers.</li>
          <li><strong>Person ranks.</strong> The system ranks people separately by position score and average similarity. Higher scores get lower rank numbers.</li>
          <li><strong>Combined rank.</strong> The system adds each person's two ranks. The lowest sum comes first.</li>
        </ol>
        <div className="space-y-2 pt-3 text-xs leading-5">
          <p>Equal scores share the average of their rank positions.</p>
          <p>When sorting only by combined rank, ties use average similarity, then ORCID and author name. Additional sort rules replace that default tie order.</p>
          <p>Filtering the reviewer list does not change these ranks.</p>
        </div>
      </details>
    </PopoverContent>
  </Popover>
}
