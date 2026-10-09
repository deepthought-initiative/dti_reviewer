import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { ChatsCircle } from "@phosphor-icons/react"
import { ResultTable, type SearchResults } from "../ResultTable"
import { ReviewerProgress, type SearchProgress } from "../ReviewerProgress"
import { Button } from "../ui/button"
import "../../reviewer.css"

type SavedSearch = SearchProgress & {
  title: string
  objective: string
  abstract: string
  state: "PENDING" | "PROGRESS" | "SUCCESS" | "FAILURE"
  results?: SearchResults
  message?: string
}

export default function SearchPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState<SavedSearch | null>(null)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    setSearch(null)
    setError("")
    async function poll() {
      try {
        const response = await fetch(`/status/${id}`, { signal: controller.signal })
        if (response.status === 401) return navigate("/login", { replace: true })
        if (!response.ok) throw new Error(response.status === 404
          ? "Search not found." : "Could not load this search. Refresh to reconnect.")
        const data: SavedSearch = await response.json()
        if (controller.signal.aborted) return
        setSearch(data)
        if (data.state === "PENDING" || data.state === "PROGRESS") timer = setTimeout(poll, 1500)
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load search.")
      }
    }
    void poll()
    return () => { controller.abort(); clearTimeout(timer) }
  }, [id, navigate])

  const running = search?.state === "PENDING" || search?.state === "PROGRESS"
  return (
    <main className="reviewer-page">
      <header className="reviewer-heading">
        <div className="chat-heading-row">
          <h1>{search?.title || "Your search"}</h1>
          <Button asChild variant="outline">
            <Link to="/chats"><ChatsCircle size={18} aria-hidden="true" />All chats</Link>
          </Button>
        </div>
        {search && <p>{search.objective}</p>}
      </header>
      {search && <details className="saved-abstract"><summary>View abstract</summary><p>{search.abstract}</p></details>}
      {error ? <p role="alert" className="search-error">{error}</p>
        : !search ? <p role="status">Loading search…</p>
        : running ? <ReviewerProgress progress={search.state === "PROGRESS" ? search : null} />
        : search.state === "FAILURE" ? <p role="alert" className="search-error">{search.message}</p>
        : search.results && (search.results.authors.length
          ? <ResultTable results={search.results} />
          : <p className="reviewer-empty">No reviewers found. Try a more detailed abstract.</p>)}
      <div className="form-actions"><Button asChild variant="outline"><Link to="/">New search</Link></Button></div>
    </main>
  )
}
