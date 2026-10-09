import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { MagnifyingGlass } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
    const mounted = useRef(true)
    useEffect(() => {
        mounted.current = true
        return () => { mounted.current = false }
    }, [])
    const [objective, setObjective] = useState("")
    const [title, setTitle] = useState("")
    const [abstract, setAbstract] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault()
        if (loading || !objective.trim() || !title.trim() || !abstract.trim()) return

        setLoading(true)
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
                body: JSON.stringify({ vector_id, objective, title, abstract }),
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
            {error && <div className="search-error" role="alert"><strong>Search could not start</strong><p>{error}</p></div>}
        </main>
    )
}

export default FormPage
