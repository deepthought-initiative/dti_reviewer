import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, expect, it, vi } from "vitest"
import "@testing-library/jest-dom"
import FormPage from "./FormPage"

afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

it("shows the test-run hint after one second and preserves Tab autofill", () => {
    vi.useFakeTimers()
    vi.stubGlobal("ResizeObserver", class {
        observe() {}
        unobserve() {}
        disconnect() {}
    })
    render(<MemoryRouter><FormPage /></MemoryRouter>)
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(1000) })
    const tooltip = screen.getByRole("tooltip")
    expect(tooltip).toHaveTextContent("Press Tab in an empty field")
    expect(tooltip.closest("form")).toBeNull()
    const objective = screen.getByLabelText("Objective (search name)")
    fireEvent.keyDown(objective, { key: "Tab" })
    expect(objective).toHaveValue("Supermassive Black Holes and Active Galaxies")
    fireEvent.keyDown(objective, { key: "Escape" })
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
})
