import LoginPage from "./components/pages/LoginPage"
import About from "./components/pages/About"
import FormPage from "./components/pages/FormPage"
import { useEffect, useState } from "react"
import { Navigate, Outlet, Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"

function RequireLogin() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`${import.meta.env.BASE_URL}auth/session`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Session check failed")
        const session = await response.json()
        if (active) setAuthenticated(Boolean(session.user_id))
      })
      .catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [])

  if (error) return <p role="alert">Unable to check login. Please reload the page.</p>
  if (authenticated === null) return <p role="status">Loading…</p>
  return authenticated ? <Outlet /> : <Navigate to="/login" replace />
}

function App() {

  return (
    <>
    <Navbar />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireLogin />}>
          <Route path="/" element={<FormPage />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Routes>
    </>

  )

}

export default App
