import { useEffect, useState } from "react"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { Button } from "../ui/button"
import "../../reviewer.css"

type Entry = { id: string; title: string; objective: string; created_at: string; state: string }
type History = { searches: Entry[]; next_cursor: string | null }
const labels: Record<string, string> = { PENDING: "Queued", PROGRESS: "Running", SUCCESS: "Completed", FAILURE: "Failed" }

export default function HistoryPage() {
  const [params] = useSearchParams()
  const before = params.get("before") || ""
  const navigate = useNavigate()
  const [history, setHistory] = useState<History | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    setHistory(null)
    setError("")
    async function load() {
      try {
        const response = await fetch(`/api/history${before ? `?before=${encodeURIComponent(before)}` : ""}`, { signal: controller.signal })
        if (response.status === 401) return navigate("/login", { replace: true })
        if (!response.ok) throw new Error("Could not load search history. Please refresh.")
        const data: History = await response.json()
        if (controller.signal.aborted) return
        setHistory(data)
        if (data.searches.some(search => ["PENDING", "PROGRESS"].includes(search.state))) timer = setTimeout(load, 5000)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load history.")
      }
    }
    void load()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [before, navigate])

  return (
    <main className="reviewer-page">
      <header className="reviewer-heading"><h1>Chats</h1><p>Your research, searches, and reviewer shortlists.</p></header>
      {error ? <p role="alert" className="search-error">{error}</p>
        : !history ? <p role="status">Loading history…</p>
        : history.searches.length === 0 ? <p className="reviewer-empty">No saved searches yet.</p>
        : <ul className="search-history">{history.searches.map(search => (
          <li key={search.id}><Link to={`/chat/${search.id}`}>
            <div><h2>{search.title}</h2><p>{search.objective}</p><time dateTime={search.created_at}>{new Date(search.created_at).toLocaleString()}</time></div>
            <span className="history-state" data-state={search.state}>{labels[search.state] || search.state}</span>
          </Link></li>
        ))}</ul>}
      <div className="form-actions">
        <Button asChild><Link to="/">New search</Link></Button>
        {before && <Button asChild variant="outline"><Link to="/chats">Latest searches</Link></Button>}
        {history?.next_cursor && <Button asChild variant="outline"><Link to={`/chats?before=${encodeURIComponent(history.next_cursor)}`}>Older searches</Link></Button>}
      </div>
    </main>
  )
}
