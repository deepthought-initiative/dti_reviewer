import About from "./components/pages/About"
import FormPage from "./components/pages/FormPage"
import { Routes, Route } from "react-router-dom"
import Navbar from "./components/Navbar"

function App() {

  return (
    <>
    <Navbar />
      <Routes>
        <Route path="/" element={<FormPage />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </>

  )

}

export default App
