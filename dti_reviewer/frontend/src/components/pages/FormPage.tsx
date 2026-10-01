import { useState, useRef, type ChangeEvent } from "react"
import { useNavigate } from "react-router-dom"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ResultTable } from "../ResultTable"
import { FileDashed, MagnifyingGlass } from "@phosphor-icons/react"
import logo from "../../assets/logo.png"


const FormPage = () => {
    const navigate = useNavigate()
    const [query, setQuery] = useState<string>("")
    const [tableData, setTableData] = useState<[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [hasSearched, setHasSearched] = useState<boolean>(false)
    const [percent, setPercent] = useState<number | null>(null)
    const taskIdRef = useRef<string | null>(null)

    const handleQuery = (e: ChangeEvent<HTMLTextAreaElement>): void => {
        setQuery(e.target.value)
    }


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading || !query.trim()) return

        setLoading(true)
        setHasSearched(true)
        setTableData([])
        setPercent(null)

        try {
            // 1) Vectorize the abstract
            const vectorResp = await fetch("/vectorize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            })
            if (vectorResp.status === 401) return navigate("/login", { replace: true })
            if (!vectorResp.ok) throw new Error(`Vectorization failed: HTTP ${vectorResp.status}`)
            const { vector_id } = await vectorResp.json()

            // 2) Enqueue the search using the stored vector
            const resp = await fetch("/search", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ vector_id }),
            })
            if (resp.status === 401) return navigate("/login", { replace: true })
            if (!resp.ok) throw new Error(`Enqueue failed: HTTP ${resp.status}`)
            const { task_id } = await resp.json()
            taskIdRef.current = task_id

            // 3) Poll for status
            while (true) {
                const statusResp = await fetch(`/status/${task_id}`)
                if (statusResp.status === 401) return navigate("/login", { replace: true })
                if (!statusResp.ok) {
                    console.error("Status check error", await statusResp.text())
                    break
                }
                const payload = await statusResp.json()
                const state = payload.state as string

                if (state === "PENDING") {
                    setPercent(null)
                } else if (state === "PROGRESS") {
                    setPercent(Math.round((payload.percent ?? 0) * 100))
                } else if (state === "SUCCESS") {
                    setTableData(payload.results)
                    break
                } else {
                    console.error("Task failed or unexpected state", payload)
                    break
                }

                // wait before next poll
                // eslint-disable-next-line no-await-in-loop
                await new Promise((r) => setTimeout(r, 1500))
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }
    return (
        <>
            <div className="max-w-5xl mx-auto px-6 grid grid-cols-5 gap-6 py-8">
                {/* Row 1 */}
                <div className="col-span-5 flex items-center justify-center gap-3 lg:hidden">
                    <img height="60" width="60" src={logo} />
                    <h1 className="font-bold text-center">DTI Reviewer</h1>
                </div>

                {/* Row 2 */}
                <form
                    onSubmit={handleSubmit}
                    className="grid grid-cols-1 md:grid-cols-5 border border-border rounded-lg md:gap-4 col-span-5"
                >
                    <div className="md:col-span-5 p-6">
                        <h2>Find a physics expert</h2>
                        <p className="text-gray-600">
                            Paste a research abstract or topic below to discover similar physics researchers.
                        </p>
                        <Textarea
                            autoFocus
                            placeholder="Paste your research abstract or topic here…"
                            value={query}
                            onChange={handleQuery}
                            className="mt-5 mb-4 w-full min-h-32 resize-y max-h-[300px]"
                            required
                        />
                        <Button
                            type="submit"
                            disabled={loading}
                            className="flex w-full sm:ml-auto sm:w-fit sm:px-6"
                        >
                            <MagnifyingGlass size={16} aria-hidden="true" />
                            <strong>{loading ? <span>Searching…</span> : <span>Search</span>}</strong>
                        </Button>
                    </div>
                </form>

                {/* Row 3 */}
                <div className="col-span-5 min-h-0 flex flex-col border border-border rounded-lg">
                    <div className="shrink-0 px-6 pt-5 pb-2">
                        <h2 className="text-lg!">Results</h2>
                    </div>
                    <div className="min-h-0 overflow-y-auto max-h-[60vh]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                {percent === null ? (
                                    <>
                                        <div
                                            className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"
                                        />
                                        <p className="text-lg">Searching for experts...</p>
                                    </>
                                ) : (
                                    <div className="w-full px-6">
                                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                                            <div
                                                className="h-4 bg-primary"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <p className="text-center mt-2 text-sm">{percent}%</p>
                                    </div>
                                )}
                            </div>
                        ) : !hasSearched ? (
                            <div className="px-6 pb-6 text-muted-foreground">
                                <p>Paste an abstract above to see researchers ranked by similarity.</p>
                            </div>
                        ) : tableData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <FileDashed size={48} className="mb-4 text-neutral-400" />
                                <p className="text-center text-lg">No results</p>
                            </div>
                        ) : (
                            <div className="px-6 pb-6">
                                <ResultTable dataToDisplay={tableData} />
                            </div>
                        )}
                    </div>
                </div>
            </div></>
    )
}

export default FormPage
