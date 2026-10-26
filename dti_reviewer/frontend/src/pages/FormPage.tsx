import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MagnifyingGlass } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import panelFields from "@/data/panelFields.json"
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
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])
    const [field, setField] = useState("")
    const [objective, setObjective] = useState("")
    const [title, setTitle] = useState("")
    const [abstract, setAbstract] = useState("")
    const [yearStart, setYearStart] = useState(String(FIRST_YEAR))
    const [yearEnd, setYearEnd] = useState(String(LAST_YEAR))
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const keywords = panelFields[field as keyof typeof panelFields]

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        const query = panel ? {
            objective: field,
            title: `Panel builder: ${field}`,
            abstract: keywords,
        } : { objective, title, abstract }
        if (loading || !query.objective.trim() || !query.title.trim() || !query.abstract?.trim()) return

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
                <h1>{panel ? "Panel builder" : "Find a reviewer"}</h1>
                <p>
                    {panel
                        ? "Choose a research field to find potential panel members using its predefined keywords."
                        : "Match your research with authors and their published work."}
                </p>
            </header>
            <form onSubmit={handleSubmit} className="reviewer-form">
                {panel ? (
                    <div className="abstract-field">
                        <label>
                            <span>Research field</span>
                            <select autoFocus value={field} onChange={(event) => setField(event.target.value)} required>
                                <option value="" disabled>Choose a field</option>
                                {Object.keys(panelFields).map((name) => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </label>
                        {keywords && (
                            <details className="saved-abstract">
                                <summary>View search keywords</summary>
                                <p>{keywords}</p>
                            </details>
                        )}
                    </div>
                ) : <>
                    <p className="mb-4 text-xs text-muted-foreground">Press Tab in an empty field to fill with example data.</p>
                    <div className="proposal-fields">
                        <label><span>Objective</span>
                            <Input autoFocus value={objective} onChange={(event) => setObjective(event.target.value)}
                                onKeyDown={(event) => fillExampleOnTab(event, setObjective)}
                                placeholder="Supermassive Black Holes and Active Galaxies" required />
                        </label>
                        <label><span>Title</span>
                            <Input value={title} onChange={(event) => setTitle(event.target.value)}
                                onKeyDown={(event) => fillExampleOnTab(event, setTitle)}
                                placeholder="Black Hole Growth and Galaxy Evolution" required />
                        </label>
                    </div>
                    <label className="abstract-field"><span>Abstract</span>
                        <Textarea value={abstract} onChange={(event) => setAbstract(event.target.value)}
                            onKeyDown={(event) => fillExampleOnTab(event, setAbstract)}
                            placeholder="We study supermassive black hole growth in active galactic nuclei and its relationship to galaxy evolution. We examine accretion disks, jets, and X-ray emission from quasars. We investigate black hole mass measurements, host galaxy properties, and the effects of active galactic nuclei on star formation." required />
                    </label>
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
                    <Button type="submit" disabled={loading} size="lg">
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
