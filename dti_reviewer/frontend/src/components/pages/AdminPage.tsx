import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate, useOutletContext } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, FloppyDisk, Trash, UserPlus } from "@phosphor-icons/react"
import type { Session } from "./LoginPage"

type User = { id: number; username: string | null; issuer: string | null; subject: string | null; is_admin: number; is_blocked: number; is_local: number }
const endpoint = "/auth/admin/users"

export default function AdminPage() {
    const session = useOutletContext<Session>()
    const navigate = useNavigate()
    const allowed = session.is_admin
    const [users, setUsers] = useState<User[] | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")

    useEffect(() => {
        if (!allowed) return
        let active = true
        fetch(endpoint)
            .then(async (response) => {
                if (!active) return
                if (response.status === 401) {
                    navigate("/login", { replace: true })
                    return
                }
                if (!response.ok) throw new Error("Unable to load users. Reload to try again.")
                const data = await response.json()
                if (active) setUsers(data.users)
            })
            .catch(() => { if (active) setError("Unable to load users. Reload to try again.") })
        return () => { active = false }
    }, [allowed, navigate])

    async function mutate(method: "POST" | "PATCH" | "DELETE", user?: User, form?: HTMLFormElement) {
        if (busy) return
        if (method === "DELETE" && !window.confirm(`Delete ${user?.username || user?.subject}? They will lose access immediately.`)) return
        const data = form ? Object.fromEntries(new FormData(form)) : undefined
        setBusy(true)
        setError("")
        setMessage("")
        try {
            const response = await fetch(user ? `${endpoint}/${user.id}` : endpoint, {
                method,
                headers: { "Content-Type": "application/json", "X-CSRFToken": session.csrf_token },
                body: data ? JSON.stringify(data) : undefined,
            })
            if (response.status === 401) {
                navigate("/login", { replace: true })
                return
            }
            if (!response.ok) {
                const data = response.headers.get("content-type")?.includes("application/json")
                    ? await response.json() : null
                throw new Error(data?.message || "Unable to save. Reload and try again.")
            }
            form?.reset()
            if (method === "PATCH" && String(user?.id) === session.user_id) {
                navigate("/login", { replace: true, state: { passwordChanged: true } })
                return
            }
            setMessage(method === "POST" ? "User created." : method === "PATCH" ? "Password changed." : "User deleted.")
            setUsers(null)
            await fetch(endpoint)
                .then(async (refreshed) => {
                    if (!refreshed.ok) throw new Error("Refresh failed")
                    setUsers((await refreshed.json()).users)
                })
                .catch(() => setError("Change saved, but the user list could not refresh. Reload the page."))
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to connect. Try again.")
        } finally {
            setBusy(false)
        }
    }

    function submit(event: FormEvent<HTMLFormElement>, user?: User) {
        event.preventDefault()
        void mutate(user ? "PATCH" : "POST", user, event.currentTarget)
    }

    if (!allowed) return (
        <main className="management-page max-w-5xl mx-auto my-10 px-6">
            <h1 className="text-2xl font-semibold">Admin access required</h1>
            <p>This page is for administrators.</p>
            <Link to="/" className="underline">Return to search</Link>
        </main>
    )

    return (
        <main className="management-page max-w-5xl mx-auto my-10 px-6">
            <Link to="/login" className="inline-flex items-center gap-1 text-sm underline mb-6"><ArrowLeft size={16} aria-hidden="true" />Account</Link>
            <h1 className="font-semibold">Manage users</h1>
            <p className="text-gray-600 mt-2">Deleted external accounts remain listed and cannot access this app. Their identity provider accounts are unchanged.</p>
            {error && <p role="alert" className="my-4 text-red-700">{error}</p>}
            {message && <p role="status" className="my-4">{message}</p>}
            {busy && <p role="status" className="my-4">Saving…</p>}
            {users === null ? (
                !error && <p role="status" className="my-4">Loading users…</p>
            ) : (
                <fieldset disabled={busy} className="space-y-12 mt-8 min-w-0">
                    {session.auth_mode === "local" && <section className="border border-border rounded-lg p-8">
                        <h2 className="font-semibold">Create user</h2>
                        <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] items-end gap-3 mt-3">
                            <div><label htmlFor="new-username">Username</label><Input id="new-username" name="username" autoComplete="off" required /></div>
                            <div><label htmlFor="new-password">Password</label><Input id="new-password" name="password" type="password" autoComplete="new-password" required /></div>
                            <Button type="submit"><UserPlus size={16} aria-hidden="true" />Create user</Button>
                        </form>
                    </section>}
                    <section>
                        <h2 className="font-semibold">Users</h2>
                        <p className="text-gray-600 mt-1 mb-3">Changing a password signs that user out on all devices. Changing your own password returns you to login.</p>
                        <div className="mt-4 overflow-x-auto border border-border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead scope="col">User</TableHead>
                                        <TableHead scope="col">Role</TableHead>
                                        <TableHead scope="col">Status</TableHead>
                                        <TableHead scope="col">Password</TableHead>
                                        <TableHead scope="col" className="text-right!">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {users.map((user) => {
                                        const name = user.username || user.subject
                                        const deleted = !user.is_local && Boolean(user.is_blocked)
                                        return (
                                            <TableRow key={user.id} className={deleted ? "bg-muted/50 text-muted-foreground" : undefined}>
                                                <TableCell className="font-medium max-w-64 whitespace-normal break-words">
                                                    {name}{String(user.id) === session.user_id && " (you)"}
                                                    {!user.is_local && <div className="text-xs text-muted-foreground break-all">{user.issuer}</div>}
                                                </TableCell>
                                                <TableCell>{user.is_admin ? "Admin" : "User"}</TableCell>
                                                <TableCell>{deleted ? "Deleted" : user.is_blocked ? "Blocked" : "Active"}</TableCell>
                                                <TableCell>
                                                    {user.is_local ? (
                                                        <form onSubmit={(event) => submit(event, user)} className="flex items-center gap-2">
                                                            <label className="sr-only" htmlFor={`password-${user.id}`}>New password for {name}</label>
                                                            <Input id={`password-${user.id}`} name="password" type="password" autoComplete="new-password" className="w-40" required />
                                                            <Button type="submit" variant="outline" size="sm" aria-label={`Change password for ${name}`}><FloppyDisk size={16} aria-hidden="true" />Save</Button>
                                                        </form>
                                                    ) : deleted ? "" : "Managed externally"}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {!deleted && String(user.id) !== session.user_id && <Button type="button" variant="destructive" size="sm" aria-label={`Delete ${name}`} onClick={() => void mutate("DELETE", user)}><Trash size={16} aria-hidden="true" />Delete</Button>}
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </section>
                </fieldset>
            )}
        </main>
    )
}
