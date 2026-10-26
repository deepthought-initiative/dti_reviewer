import { useEffect, useId, useRef, useState } from "react"
import { CaretDown, FunnelSimple } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const options = [
  { id: "average_similarity", label: "Average similarity", detail: "All matched papers" },
  { id: "top_similarity", label: "Top similarity", detail: "The single highest paper score" },
  { id: "top_k_similarity", label: "Top K average", detail: "Each person's K most similar papers" },
]

const isPositiveInteger = (value: string) => Number.isSafeInteger(Number(value)) && Number(value) >= 1

export function ReviewerSort({ sortId, label, k, onSort, onKChange }: {
  sortId: string
  label: string
  k: number
  onSort: (id: string) => void
  onKChange: (k: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(String(k))
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const id = useId()
  const validK = isPositiveInteger(draft)

  useEffect(() => {
    if (!open) return
    root.current?.querySelector<HTMLInputElement>("input:checked")?.focus()
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener("pointerdown", dismiss)
    document.addEventListener("keydown", escape)
    return () => {
      document.removeEventListener("pointerdown", dismiss)
      document.removeEventListener("keydown", escape)
    }
  }, [open])

  return (
    <div className="reviewer-sort" ref={root}>
      <Button ref={trigger} variant="outline" className="sort-trigger" aria-label={`Sort reviewers: ${label}`}
        aria-expanded={open} aria-controls={id} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <FunnelSimple aria-hidden="true" /><span>{label}</span><CaretDown aria-hidden="true" />
      </Button>
      {open && <div id={id} className="sort-panel" role="dialog" aria-label="Sort reviewers">
        <fieldset>
          <legend>Sort by</legend>
          {options.map((option) => (
            <label className="sort-option" key={option.id}>
              <input type="radio" name={id} value={option.id} checked={sortId === option.id}
                onChange={() => onSort(option.id)} />
              <span>{option.label}<small>{option.detail}</small></span>
            </label>
          ))}
        </fieldset>
        {sortId === "top_k_similarity" && <div className="sort-k">
          <label htmlFor={`${id}-k`}>Papers per person (K)</label>
          <Input id={`${id}-k`} type="number" min={1} step={1} value={draft}
            aria-invalid={!validK} aria-describedby={`${id}-help`}
            onChange={(event) => {
              const value = event.target.value
              setDraft(value)
              if (isPositiveInteger(value)) onKChange(Number(value))
            }}
            onBlur={() => setDraft(String(k))} />
          <p id={`${id}-help`}>{validK
            ? "Fewer than K papers? We average the papers available."
            : "Enter a whole number of 1 or more."}</p>
        </div>}
        <p className="sort-note">Highest scores first. Results update instantly.</p>
      </div>}
    </div>
  )
}
