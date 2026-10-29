import { useEffect, useState } from "react"
import { useNavigate, useOutletContext } from "react-router-dom"
import { ArrowCounterClockwise, FloppyDisk, Trash } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import panelFields from "@/data/panelFields.json"
import type { Session } from "@/pages/LoginPage"

type Preset = { id: number; name: string; keywords: string; source_field: string | null }
const endpoint = `${import.meta.env.BASE_URL}api/panel-presets`

export default function PanelFields({ name, keywords, disabled, onChange, onSavingChange }: {
    name: string
    keywords: string
    disabled: boolean
    onChange: (name: string, keywords: string) => void
    onSavingChange: (saving: boolean) => void
}) {
    const session = useOutletContext<Session>()
    const navigate = useNavigate()
    const [presets, setPresets] = useState<Preset[] | null>(null)
    const [selection, setSelection] = useState("")
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const preset = presets?.find((item) => `preset:${item.id}` === selection)
    const field = selection.startsWith("field:") ? selection.slice(6) : null
    const originalName = preset?.name ?? field ?? ""
    const originalKeywords = preset?.keywords ?? (field ? panelFields[field as keyof typeof panelFields] : "")
    const dirty = name !== originalName || keywords !== originalKeywords
    const valid = name.trim().length > 0 && keywords.trim().length >= 3

    useEffect(() => {
        let active = true
        fetch(endpoint)
            .then(async (response) => {
                if (response.status === 401) {
                    if (active) navigate("/login", { replace: true })
                    return
                }
                if (!response.ok) throw new Error("Unable to load your presets. Reload the page to try again.")
                const data = await response.json()
                if (active) setPresets(data.presets)
            })
            .catch((err: Error) => { if (active) setError(err.message) })
        return () => { active = false }
    }, [navigate])

    function choose(value: string) {
        if (dirty && !window.confirm("Discard your unsaved keyword and name changes?")) return
        const saved = presets?.find((item) => `preset:${item.id}` === value)
        const source = value.startsWith("field:") ? value.slice(6) : null
        setSelection(value)
        onChange(saved?.name ?? source ?? "", saved?.keywords ?? (source ? panelFields[source as keyof typeof panelFields] : ""))
        setError("")
        setMessage("")
    }

    async function mutate(action: "save" | "delete") {
        if (disabled) return
        if (action === "delete") {
            if (!preset || !window.confirm(`Delete "${preset.name}"? This permanently removes the preset and discards unsaved edits. Past searches will still be visible in chat history.`)) return
        } else if (!valid) return
        onSavingChange(true)
        setError("")
        setMessage("")
        try {
            const response = await fetch(preset ? `${endpoint}/${preset.id}` : endpoint, {
                method: action === "delete" ? "DELETE" : preset ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", "X-CSRFToken": session.csrf_token },
                body: action === "delete" ? undefined : JSON.stringify({ name, keywords, source_field: preset?.source_field ?? field }),
            })
            if (response.status === 401) {
                navigate("/login", { replace: true })
                return
            }
            if (!response.ok) {
                const data = response.headers.get("content-type")?.includes("application/json") ? await response.json() : null
                throw new Error(data?.message || `Unable to ${action} your preset. Your edits are still here. Try again.`)
            }
            if (action === "delete") {
                setPresets((items) => (items ?? []).filter((item) => item.id !== preset?.id))
                setSelection("")
                onChange("", "")
                setMessage("Preset deleted.")
                return
            }
            const { preset: saved }: { preset: Preset } = await response.json()
            setPresets((items) => [...(items ?? []).filter((item) => item.id !== saved.id), saved]
                .sort((a, b) => a.name.localeCompare(b.name)))
            setSelection(`preset:${saved.id}`)
            onChange(saved.name, saved.keywords)
            setMessage("Preset saved to your account.")
        } catch (err) {
            setError(err instanceof Error ? err.message : `Unable to ${action}. Your edits are still here. Try again.`)
        } finally {
            onSavingChange(false)
        }
    }

    return (
        <fieldset className="panel-fields" disabled={disabled || presets === null}>
            <label>
                <span>Research field or saved preset</span>
                <select autoFocus value={selection} onChange={(event) => choose(event.target.value)} required>
                    <option value="" disabled>Choose a field</option>
                    <option value="custom">Custom keywords</option>
                    {presets && presets.length > 0 && <optgroup label="Your saved presets">
                        {presets.map((item) => <option key={item.id} value={`preset:${item.id}`}>{item.name}</option>)}
                    </optgroup>}
                    <optgroup label="Research fields">
                        {Object.keys(panelFields).map((item) => <option key={item} value={`field:${item}`}>{item}</option>)}
                    </optgroup>
                </select>
            </label>
            {selection && <>
                <label>
                    <span>Preset name</span>
                    <Input value={name} maxLength={120} required placeholder="e.g. Black hole panel"
                        onChange={(event) => { onChange(event.target.value, keywords); setMessage("") }} />
                </label>
                <label>
                    <span>Keywords</span>
                    <Textarea value={keywords} minLength={3} maxLength={20000} required
                        aria-describedby="panel-keywords-help" placeholder="e.g. black holes, accretion disks, active galactic nuclei"
                        onChange={(event) => { onChange(name, event.target.value); setMessage("") }} />
                </label>
                <p id="panel-keywords-help" className="text-sm text-muted-foreground">Separate keywords with commas. Save this list to use it again.</p>
                <div className="flex flex-wrap items-center gap-3">
                    <Button type="button" variant="outline" disabled={!valid || (Boolean(preset) && !dirty)} onClick={() => void mutate("save")}>
                        <FloppyDisk size={16} aria-hidden="true" />{preset ? "Save changes" : "Save preset"}
                    </Button>
                    <Button type="button" variant="ghost" disabled={!dirty} onClick={() => {
                        onChange(originalName, originalKeywords)
                        setError("")
                        setMessage("Changes reset.")
                    }}><ArrowCounterClockwise size={16} aria-hidden="true" />Reset changes</Button>
                    {preset && <Button type="button" variant="destructive" onClick={() => void mutate("delete")}>
                        <Trash size={16} aria-hidden="true" />Delete preset
                    </Button>}
                    {dirty && <span className="text-sm text-muted-foreground">Unsaved changes</span>}
                </div>
            </>}
            {presets === null && !error && <p role="status">Loading your presets…</p>}
            {message && <p role="status" className="text-sm">{message}</p>}
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </fieldset>
    )
}
