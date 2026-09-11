import { useState, useRef, type ChangeEvent } from "react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { ResultTable } from "../ResultTable"
import { FileDashed, MagnifyingGlass } from "@phosphor-icons/react"
import logo from "../../assets/logo.png"


const FormPage = () => {
    const [query, setQuery] = useState<string>("")
    const [tableData, setTableData] = useState<[]>([])
    const [loading, setLoading] = useState<boolean>(false)
    const [hasSearched, setHasSearched] = useState<boolean>(false)
    const [percent, setPercent] = useState<number | null>(null)
    const taskIdRef = useRef<string | null>(null)

    const handleQuery = (e: ChangeEvent<HTMLTextAreaElement>): void => {
        setQuery(e.target.value)
    }


    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ""

    // uncomment this in development
    // const API_BASE_URL = "http://localhost:5000"


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (loading || !query.trim()) return

        setLoading(true)
        setHasSearched(true)
        setTableData([])
        setPercent(null)

        try {
            // 1) Enqueue the task
            const resp = await fetch(`${API_BASE_URL}/search`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query }),
            })
            if (!resp.ok) throw new Error(`Enqueue failed: HTTP ${resp.status}`)
            const { task_id } = await resp.json()
            taskIdRef.current = task_id

            // 2) Poll for status
            while (true) {
                const statusResp = await fetch(`${API_BASE_URL}/status/${task_id}`)
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
            <div className="w-4/5 max-w-5xl m-auto grid grid-cols-5 gap-10 py-12">
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
                    <div className="md:col-span-5 p-8">
                        <h2>Find a physics expert</h2>
                        <p className="text-gray-600">
                            Paste a research abstract or topic below to discover similar physics researchers.
                        </p>
                        <Textarea
                            autoFocus
                            placeholder="Paste your research abstract or topic here…"
                            value={query}
                            onChange={handleQuery}
                            className="mt-6 mb-4 w-full min-h-[50px] md:min-h-[60px] resize-y max-h-[300px]"
                            required
                        />
                        <Button
                            type="submit"
                            disabled={loading}
                            className={`w-full ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-primary hover:bg-primary/90"}`}
                        >
                            <strong>{loading ? <span>Searching…</span> : <span>Search</span>}</strong>
                        </Button>
                    </div>
                </form>

                {/* Row 3 */}
                <div className="col-span-5 border border-border rounded-lg">
                    <div className="px-8 pt-8 pb-2">
                        <h2>Search Results</h2>
                    </div>
                    <div className="overflow-y-auto h-[50vh] max-h-[60vh]">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center h-full">
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
                            <div className="h-full flex flex-col items-center justify-center text-stone-500 p-12">
                                <div className="w-20 h-20 rounded-full bg-neutral-100 flex items-center justify-center mb-6">
                                    <MagnifyingGlass size={40} />
                                </div>
                                <p className="text-xl font-semibold mb-2">Ready to explore</p>
                                <p className="text-base text-stone-400">
                                    Enter your paragraph above to begin analysis
                                </p>
                            </div>
                        ) : tableData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full">
                                <FileDashed size={48} className="mb-4 text-neutral-400" />
                                <p className="text-center text-lg">No results</p>
                            </div>
                        ) : (
                            <div className="px-8 pb-8">
                                <ResultTable dataToDisplay={tableData} />
                            </div>
                        )}
                    </div>
                </div>
            </div></>
    )
}

export default FormPage