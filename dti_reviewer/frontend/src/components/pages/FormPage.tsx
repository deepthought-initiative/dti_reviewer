import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { FileDashed, MagnifyingGlass } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ResultTable, type SearchResults } from "../ResultTable"
import { ReviewerProgress, type SearchProgress } from "../ReviewerProgress"
import "../../reviewer.css"

const fillExampleOnTab = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    setValue: (value: string) => void,
) => {
    if (event.key === "Tab" && !event.shiftKey && !event.altKey && !event.ctrlKey
        && !event.metaKey && !event.currentTarget.value) {
        setValue(event.currentTarget.placeholder)
    }
}

const FormPage = () => {
    const navigate = useNavigate()
    const [objective, setObjective] = useState("")
    const [title, setTitle] = useState("")
    const [abstract, setAbstract] = useState("")
    const [results, setResults] = useState<SearchResults | null>(null)
    const [loading, setLoading] = useState(false)
    const [hasSearched, setHasSearched] = useState(false)
    const [progress, setProgress] = useState<SearchProgress | null>(null)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (loading || !objective.trim() || !title.trim() || !abstract.trim()) return

        setLoading(true)
        setHasSearched(true)
        setResults(null)
        setProgress(null)
        setError(null)

        try {
            const vectorResp = await fetch("/vectorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ abstract }),
            })
            if (vectorResp.status === 401) return navigate("/login", { replace: true })
            if (!vectorResp.ok) throw new Error(`Vectorization failed: HTTP ${vectorResp.status}`)
            const { vector_id } = await vectorResp.json()

            const resp = await fetch("/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vector_id, objective, title }),
            })
            if (resp.status === 401) return navigate("/login", { replace: true })
            if (!resp.ok) throw new Error(`Enqueue failed: HTTP ${resp.status}`)
            const { task_id } = await resp.json()

            while (true) {
                const statusResp = await fetch(`/status/${task_id}`)
                if (statusResp.status === 401) return navigate("/login", { replace: true })
                if (!statusResp.ok) {
                    console.error("Status check error", await statusResp.text())
                    throw new Error("Search failed. Please try again.")
                }
                const payload = await statusResp.json()

                if (payload.state === "PENDING") {
                    setProgress(null)
                } else if (payload.state === "PROGRESS") {
                    setProgress(payload)
                } else if (payload.state === "SUCCESS") {
                    setResults(payload.results)
                    break
                } else {
                    console.error("Task failed or unexpected state", payload)
                    throw new Error("Search failed. Please try again.")
                }

                await new Promise((resolve) => setTimeout(resolve, 1500))
            }
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
                <h1>Find a reviewer</h1>
                <p>Match your research with authors and their published work.</p>
            </header>
            <form onSubmit={handleSubmit} className="reviewer-form">
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
                <div className="form-actions">
                    <span>Paper coverage: 2004–2024</span>
                    <Button type="submit" disabled={loading} size="lg">
                        <MagnifyingGlass size={17} aria-hidden="true" />
                        {loading ? "Searching…" : "Find reviewers"}
                    </Button>
                </div>
            </form>
            <section className="reviewer-output" aria-label="Search results" aria-busy={loading}>
                {loading ? <ReviewerProgress progress={progress} />
                    : error ? <div className="search-error" role="alert"><strong>Search could not finish</strong><p>{error}</p></div>
                    : hasSearched && results?.authors.length === 0 ? (
                        <div className="reviewer-empty"><FileDashed size={30} aria-hidden="true" />
                            <h2>No reviewers found</h2><p>Try an abstract with more detail about the research topic.</p></div>
                    ) : results ? <ResultTable results={results} />
                    : <div className="reviewer-empty"><MagnifyingGlass size={28} aria-hidden="true" />
                        <h2>Your reviewer shortlist starts here</h2><p>Search an abstract to explore authors and supporting papers.</p></div>}
            </section>
        </main>
    )
}

export default FormPage
