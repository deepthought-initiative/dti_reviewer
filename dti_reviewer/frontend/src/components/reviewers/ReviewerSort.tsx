import { useEffect, useId, useRef, useState } from "react"
import { CaretDown, FunnelSimple, Info } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const options = [
  { id: "average_similarity", label: "Average similarity", detail: "Average of matched papers" },
  { id: "top_similarity", label: "Top similarity", detail: "Highest-scoring paper" },
  { id: "top_k_similarity", label: "Top K average", detail: "Each person's K most similar papers" },
  { id: "combined_rank", label: "Combined rank", detail: "Paper position + average similarity" },
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
            <div className="sort-option" key={option.id}>
              <label>
                <input type="radio" name={id} value={option.id} checked={sortId === option.id}
                  onChange={() => onSort(option.id)} />
                <span>{option.label}<small>{option.detail}</small></span>
              </label>
              {option.id === "combined_rank" && <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" aria-label="Combined rank reference" className="sort-info"><Info size={17} aria-hidden="true" /></button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end" sideOffset={8} collisionPadding={16}
                  className="max-w-[min(320px,calc(100vw-32px))] space-y-3 p-4 text-left leading-5 text-pretty">
                  <p className="font-semibold">Combined rank reference</p>
                  <ol className="list-decimal space-y-3 pl-4">
                    <li><strong>Paper positions.</strong> The system ranks papers by similarity, highest first. Each person's position score is the sum of <strong>1 / paper rank</strong> across their papers.</li>
                    <li><strong>Person ranks.</strong> The system ranks people separately by position score and average similarity. Higher scores get lower rank numbers.</li>
                    <li><strong>Combined rank.</strong> The system adds each person's two ranks. The lowest sum comes first.</li>
                  </ol>
                  <div className="space-y-2 border-t border-white/20 pt-3 text-[11px] leading-4">
                    <p>Equal scores share the average of their rank positions.</p>
                    <p>For equal sums, the system sorts by average similarity, highest first. If those scores also match, it sorts by ORCID.</p>
                    <p>Filtering the reviewer list does not change these ranks.</p>
                  </div>
                </TooltipContent>
              </Tooltip>}
            </div>
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
        <p className="sort-note">
          {sortId === "combined_rank" ? "Lowest rank sum first" : "Highest scores first"}
        </p>
      </div>}
    </div>
  )
}
