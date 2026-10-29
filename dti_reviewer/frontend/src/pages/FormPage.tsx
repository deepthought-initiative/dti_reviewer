import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { ArrowLineRight, Info, MagnifyingGlass } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import PanelFields from "@/components/PanelFields"
import "../reviewer.css"

const FIRST_YEAR = 2004
const LAST_YEAR = 2024

const fillExampleOnTab = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    setValue: (value: string) => void,
) => {
    if (event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey
        && !event.metaKey && !event.currentTarget.value) {
        setValue(event.currentTarget.placeholder)
    }
}

const FormPage = ({ panel = false }: { panel?: boolean }) => {
    const navigate = useNavigate()
    const [showExampleHint, setShowExampleHint] = useState(false)
    const [exampleHintOpen, setExampleHintOpen] = useState(true)
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        const timer = window.setTimeout(() => setShowExampleHint(true), 1000)
        return () => {
            mounted.current = false
            window.clearTimeout(timer)
        }
    }, [])
    const [savingPreset, setSavingPreset] = useState(false)
    const [objective, setObjective] = useState("")
    const [title, setTitle] = useState("")
    const [abstract, setAbstract] = useState("")
    const [yearStart, setYearStart] = useState(String(FIRST_YEAR))
    const [yearEnd, setYearEnd] = useState(String(LAST_YEAR))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        const query = panel ? {
            objective,
            title: `Panel builder: ${objective}`,
            abstract,
        } : { objective, title, abstract }
        if (loading || savingPreset || !query.objective.trim() || !query.title.trim() || !query.abstract?.trim()) return

        setLoading(true)
        setError(null)

        try {
            const vectorResp = await fetch(`${import.meta.env.BASE_URL}vectorize`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ abstract: query.abstract }),
            })
            if (vectorResp.status === 401) return navigate("/login", { replace: true })
            if (!vectorResp.ok) throw new Error(`Vectorization failed: HTTP ${vectorResp.status}`)
            const { vector_id } = await vectorResp.json()

            const resp = await fetch(`${import.meta.env.BASE_URL}search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    vector_id,
                    ...query,
                    year_start: Number(yearStart),
                    year_end: Number(yearEnd),
                }),
            })
            if (resp.status === 401) return navigate("/login", { replace: true })
            if (!resp.ok) throw new Error(`Enqueue failed: HTTP ${resp.status}`)
            const { task_id } = await resp.json()

            if (mounted.current) navigate(`/chat/${task_id}`)

        } catch (error) {
            console.error(error)
            setError(error instanceof Error ? error.message : "Search failed. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <main className="reviewer-page">
            <header className="reviewer-heading">
                <h1>{panel ? "Panel Builder" : "Advanced Search"}</h1>
                <p>
                    {panel
                        ? "Choose a research field or use your own keywords to find potential panel members."
                        : "Match your research with authors and their published work."}
                </p>
            </header>
            <form onSubmit={handleSubmit} className={`reviewer-form${panel ? " panel-form" : ""}`}>
                {panel ? (
                    <PanelFields name={objective} keywords={abstract} disabled={loading || savingPreset}
                        onSavingChange={setSavingPreset} onChange={(name, keywords) => {
                            setObjective(name)
                            setAbstract(keywords)
                        }} />
                ) : <>
                    <div className="mb-2 flex items-center gap-2">
                        <label htmlFor="search-objective">Objective (search name)</label>
                        <Tooltip>
                            <TooltipTrigger asChild><button type="button" aria-label="About the search name" className="text-muted-foreground"><Info size={16} aria-hidden="true" /></button></TooltipTrigger>
                            <TooltipContent className="max-w-xs">A name to identify this search. This does not affect reviewer matching.</TooltipContent>
                        </Tooltip>
                    </div>
                    <Tooltip open={showExampleHint && exampleHintOpen} onOpenChange={setExampleHintOpen}>
                        <TooltipTrigger asChild>
                            <Input id="search-objective" autoFocus value={objective} onChange={(event) => setObjective(event.target.value)}
                                onKeyDown={(event) => fillExampleOnTab(event, setObjective)}
                                placeholder="Supermassive Black Holes and Active Galaxies" required />
                        </TooltipTrigger>
                        <TooltipContent
                            side="top" align="end" sideOffset={10}
                            avoidCollisions collisionPadding={16} sticky="always"
                            className="max-w-[min(220px,calc(100vw-32px),var(--radix-tooltip-content-available-width))] px-3 py-2 text-left text-xs leading-5 text-pretty"
                        >Press <span className="inline-flex items-center gap-1 align-middle"><ArrowLineRight size={13} aria-hidden="true" />Tab</span> in an empty field to try an example.</TooltipContent>
                    </Tooltip>
                    <fieldset className="my-6 border-t border-slate-200 pt-4">
                        <legend className="pr-3 text-sm font-semibold"><span className="inline-flex items-center gap-2">Proposal
                            <Tooltip>
                                <TooltipTrigger asChild><button type="button" aria-label="About proposal matching" className="text-muted-foreground"><Info size={16} aria-hidden="true" /></button></TooltipTrigger>
                                <TooltipContent className="max-w-xs">Keep the proposal title and abstract together. Only the abstract is used to find matching reviewers.</TooltipContent>
                            </Tooltip>
                        </span></legend>
                        <label htmlFor="proposal-title" className="mb-2">Title</label>
                        <Input id="proposal-title" value={title} onChange={(event) => setTitle(event.target.value)}
                            onKeyDown={(event) => fillExampleOnTab(event, setTitle)}
                            placeholder="Black Hole Growth and Galaxy Evolution" required />
                        <label htmlFor="proposal-abstract" className="abstract-field mb-2">Abstract</label>
                        <Textarea id="proposal-abstract" value={abstract} onChange={(event) => setAbstract(event.target.value)}
                            onKeyDown={(event) => fillExampleOnTab(event, setAbstract)}
                            placeholder="We study supermassive black hole growth in active galactic nuclei and its relationship to galaxy evolution. We examine accretion disks, jets, and X-ray emission from quasars. We investigate black hole mass measurements, host galaxy properties, and the effects of active galactic nuclei on star formation." required />
                    </fieldset>
                </>}
                <div className="proposal-fields">
                    <label>
                        <span>From year (inclusive)</span>
                        <Input type="number" min={FIRST_YEAR} max={Number(yearEnd)} step={1}
                            value={yearStart} onChange={(event) => setYearStart(event.target.value)} required />
                    </label>
                    <label>
                        <span>To year (inclusive)</span>
                        <Input type="number" min={Number(yearStart)} max={LAST_YEAR} step={1}
                            value={yearEnd} onChange={(event) => setYearEnd(event.target.value)} required />
                    </label>
                </div>
                <div className="form-actions">
                    <span>Paper coverage: {FIRST_YEAR}–{LAST_YEAR}</span>
                    <Button type="submit" disabled={loading || savingPreset} size="lg">
                        <MagnifyingGlass size={17} aria-hidden="true" />
                        {loading ? "Searching…" : panel ? "Find panel members" : "Find reviewers"}
                    </Button>
                </div>
            </form>
            {error && (
                <div className="search-error" role="alert">
                    <strong>Search could not start</strong>
                    <p>{error}</p>
                </div>
            )}
        </main>
    )
}

export default FormPage
