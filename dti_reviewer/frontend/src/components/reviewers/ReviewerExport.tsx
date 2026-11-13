import { useState } from "react"
import { useNavigate } from "react-router-dom"
import type { Table } from "@tanstack/react-table"
import { DownloadSimple, X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverTrigger, PopoverContent, PopoverClose } from "@/components/ui/popover"
import type { Author } from "./reviewerColumns"

const primaryFormats = [{ id: "xlsx", label: "Excel", extension: ".xlsx" }, { id: "csv", label: "CSV", extension: ".csv" }]
const moreFormats = [{ id: "parquet", label: "Parquet", extension: ".parquet" }, { id: "h5", label: "HDF5", extension: ".h5" }, { id: "json", label: "JSON", extension: ".json" }]

export function ReviewerExport({ table, searchId, k }: { table: Table<Author>; searchId: string; k: number }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const navigate = useNavigate()
  const count = table.getPrePaginationRowModel().rows.length

  async function download(format: string) {
    if (busy) return
    setBusy(true)
    setError("")
    const selection = JSON.stringify({
      format, k,
      rows: table.getPrePaginationRowModel().rows.map((row) => Number(row.id)),
      columns: table.getVisibleLeafColumns().map((column) => column.id),
    })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 120_000)
    try {
      const sessionResponse = await fetch(`${import.meta.env.BASE_URL}auth/session`, { signal: controller.signal })
      if (!sessionResponse.ok) throw new Error("Could not check your session. Please try again.")
      const session = await sessionResponse.json()
      if (!session.user_id) { navigate("/login"); return }
      const response = await fetch(`${import.meta.env.BASE_URL}api/exports/${encodeURIComponent(searchId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRFToken": session.csrf_token },
        signal: controller.signal,
        body: selection,
      })
      if (response.status === 401) { navigate("/login"); return }
      if (!response.ok) {
        const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null
        throw new Error(data?.message || "Could not export reviewers. Please try again.")
      }
      const url = URL.createObjectURL(await response.blob())
      const link = document.createElement("a")
      link.href = url
      link.download = `reviewers.${format}`
      document.body.appendChild(link)
      link.click()
      link.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (error) {
      setError(controller.signal.aborted ? "Export timed out. Try fewer reviewers or another format."
        : error instanceof Error ? error.message : "Could not download the export.")
    } finally {
      clearTimeout(timeout)
      setBusy(false)
    }
  }

  function formatButton(format: { id: string; label: string; extension: string }) {
    return <Button key={format.id} variant="ghost" className="export-format" disabled={busy || count === 0}
      onClick={() => void download(format.id)}>{format.label}<span>{format.extension}</span></Button>
  }

  return <Popover>
    <PopoverTrigger asChild><Button variant="outline" className="explorer-trigger"><DownloadSimple />Export</Button></PopoverTrigger>
    <PopoverContent aria-label="Export reviewers">
      <div className="explorer-panel-heading"><h3>Export reviewers</h3>
        <PopoverClose asChild><Button variant="ghost" size="icon" aria-label="Close export"><X /></Button></PopoverClose>
      </div>
      <p className="explorer-help">{count.toLocaleString()} filtered reviewers, in the current sort order. Includes visible columns across all pages. Supporting papers are not included.</p>
      {primaryFormats.map(formatButton)}
      <details className="export-more"><summary>More formats</summary>{moreFormats.map(formatButton)}</details>
      {busy && <p role="status" className="explorer-help">Preparing download…</p>}
      {error && <p role="alert" className="export-error">{error}</p>}
    </PopoverContent>
  </Popover>
}
