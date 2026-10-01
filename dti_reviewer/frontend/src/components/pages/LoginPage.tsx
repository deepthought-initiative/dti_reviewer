import { useEffect, useState, type FormEvent } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Navbar from "../Navbar"
import { ArrowLeft, SignOut, Users } from "@phosphor-icons/react"

export type Session = { user_id: string | null; auth_mode: string; csrf_token: string; is_admin: boolean }

export default function LoginPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const [session, setSession] = useState<Session | null>(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    async function refreshSession() {
        const response = await fetch("/auth/session")
        if (!response.ok) throw new Error("Unable to load login. Please reload the page.")
        setSession(await response.json())
    }

    useEffect(() => {
        refreshSession().catch((err: Error) => setError(err.message))
    }, [])

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!session || busy) return
        const data = new FormData(event.currentTarget)
        setBusy(true)
        setError("")
        try {
            const response = await fetch(session.user_id ? "/auth/logout" : "/auth/login", {
                method: "POST",
                headers: { "X-CSRFToken": session.csrf_token },
                body: data,
            })
            if (!response.ok) {
                throw new Error(response.status === 401
                    ? "Invalid username or password"
                    : "Unable to complete login or logout. Please reload and try again.")
            }
            if (session.user_id) {
                await refreshSession()
            } else {
                navigate("/", { replace: true })
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to connect. Please try again.")
        } finally {
            setBusy(false)
        }
    }

    return (
        <>
        <Navbar isAdmin={Boolean(session?.user_id && session.is_admin)} />
        <div className="flex justify-center px-4 py-16">
        <main className="management-page w-full max-w-lg p-8 border border-border rounded-lg">
            <h1 className="font-semibold mb-4!">{session?.user_id ? "Account" : "Log in"}</h1>
            {location.state?.passwordChanged && <p role="status" className="mb-4">Password changed. Log in with your new password.</p>}
            {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
            {!session ? (
                !error && <p role="status">Loading…</p>
            ) : session.user_id ? (
                <form onSubmit={submit} className="space-y-6">
                    <p>You are signed in.</p>
                    <div className="flex flex-wrap gap-2">
                        <Button asChild variant="outline"><Link to="/"><ArrowLeft size={16} aria-hidden="true" />Return to search</Link></Button>
                        {session.is_admin && (
                            <Button asChild><Link to="/admin"><Users size={16} aria-hidden="true" />Manage users</Link></Button>
                        )}
                        <Button disabled={busy} type="submit" variant="outline"><SignOut size={16} aria-hidden="true" />Log out</Button>
                    </div>
                </form>
            ) : session.auth_mode === "oidc" ? (
                <Button asChild><a href="/auth/login">Continue with your identity provider</a></Button>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    <div>
                        <label htmlFor="username">Username</label>
                        <Input id="username" name="username" autoComplete="username" required />
                    </div>
                    <div>
                        <label htmlFor="password">Password</label>
                        <Input id="password" name="password" type="password" autoComplete="current-password" required />
                    </div>
                    <Button disabled={busy} type="submit">{busy ? "Logging in…" : "Log in"}</Button>
                </form>
            )}
        </main>
        </div>
        </>
    )
}
