import { useEffect, useState, type FormEvent } from "react"
import { Link, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Session = { user_id: string | null; auth_mode: string; csrf_token: string }

export default function LoginPage() {
    const navigate = useNavigate()
    const [session, setSession] = useState<Session | null>(null)
    const [error, setError] = useState("")
    const [busy, setBusy] = useState(false)

    async function refreshSession() {
        const response = await fetch(`${import.meta.env.BASE_URL}auth/session`)
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
            const response = await fetch(`${import.meta.env.BASE_URL}auth/${session.user_id ? "logout" : "login"}`, {
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
        <main className="max-w-md mx-auto my-12 p-8 border border-border rounded-lg">
            <h1 className="text-2xl font-semibold mb-6">{session?.user_id ? "Account" : "Log in"}</h1>
            {error && <p role="alert" className="mb-4 text-red-700">{error}</p>}
            {!session ? (
                !error && <p role="status">Loading…</p>
            ) : session.user_id ? (
                <form onSubmit={submit} className="space-y-4">
                    <p>You are signed in. <Link to="/" className="underline">Return to search</Link></p>
                    <Button disabled={busy} type="submit">Log out</Button>
                </form>
            ) : session.auth_mode === "oidc" ? (
                <Button asChild><a href={`${import.meta.env.BASE_URL}auth/login`}>Continue with your identity provider</a></Button>
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
    )
}
