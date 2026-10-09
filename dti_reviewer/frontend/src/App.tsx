import AdminPage from "./components/pages/AdminPage"
import LoginPage, { type Session } from "./components/pages/LoginPage"
import About from "./components/pages/About"
import HistoryPage from "./components/pages/HistoryPage"
import SearchPage from "./components/pages/SearchPage"
import FormPage from "./components/pages/FormPage"
import { useEffect, useState } from "react"
import { Navigate, Outlet, Routes, Route, useLocation, useParams } from "react-router-dom"
import Navbar from "./components/Navbar"

function RequireLogin() {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetch("/auth/session")
      .then(async (response) => {
        if (!response.ok) throw new Error("Session check failed")
        const session = await response.json()
        if (active) setSession(session)
      })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])

  return (
    <>
      <Navbar isAdmin={Boolean(session?.user_id && session.is_admin)} />
      {error ? <p role="alert">Unable to check login. Please reload the page.</p>
        : session === null ? <p role="status">Loading…</p>
        : session.user_id ? <Outlet context={session} /> : <Navigate to="/login" replace />}
    </>
  )
}

function HistoryRedirect() {
  const { id } = useParams()
  const { search } = useLocation()
  return <Navigate to={`${id ? `/chat/${id}` : "/chats"}${search}`} replace />
}

function App() {

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navbar isAdmin={false} />} />
        <Route element={<RequireLogin />}>
          <Route path="/" element={<FormPage />} />
          <Route path="/chats" element={<HistoryPage />} />
          <Route path="/history" element={<HistoryRedirect />} />
          <Route path="/chat/:id" element={<SearchPage />} />
          <Route path="/history/:id" element={<HistoryRedirect />} />
          <Route path="/about" element={<About />} />
          <Route path="/admin" element={<AdminPage />} />
        </Route>
      </Routes>
    </>

  )

}

export default App
