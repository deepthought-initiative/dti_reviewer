import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import { GithubLogo, List } from "@phosphor-icons/react"
import logo from "../assets/logo.png"

export default function Component() {
    return (
        <header className="flex h-20 w-full shrink-0 items-center px-6 md:px-8">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                        <List />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <div className="flex flex-col h-full">
                        {/* Header section */}
                        <div className="flex items-center gap-3 p-6 border-b border-gray-200">
                            <img height="48" width="48" src={logo} />
                            <h3 className="text-lg font-semibold text-gray-900">DTI Reviewer</h3>
                        </div>

                        {/* Navigation links */}
                        <nav className="flex-1 p-4">
                            <div className="space-y-2">
                                <Link
                                    to="/"
                                    className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 group"
                                >
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                        <span>Home</span>
                                    </div>
                                </Link>

                                <Link
                                    to="/about"
                                    className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 group"
                                >
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                        <span>About Us</span>
                                    </div>
                                </Link>
                                <Link
                                    to="https://github.com/deepthought-initiative/dti_reviewer"
                                    className="flex items-center w-full px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 group"
                                >
                                    <div className="flex items-center">
                                        <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200"></div>
                                        <GithubLogo size={20} className="mr-2" />
                                        <span>GitHub</span>
                                    </div>
                                </Link>
                            </div>
                        </nav>
                    </div>
                </SheetContent>
            </Sheet>

            <Link to="/" className="mr-6 hidden lg:flex items-center gap-3">
                <img height="48" width="48" src={logo} />
                <h2>DTI Reviewer</h2>
            </Link>

            <Button asChild variant="outline" className="ml-auto mr-4">
                <Link to="/login">Login / account</Link>
            </Button>
            <nav className="hidden lg:flex gap-6">
                <Link
                    to="/"
                    className="group inline-flex h-9 w-max items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    Home
                </Link>
                <Link
                    to="/about"
                    className="group inline-flex h-9 w-max items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    About Us
                </Link>
                <Link
                    to="https://github.com/deepthought-initiative/dti_reviewer"
                    className="group inline-flex h-9 w-max items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <GithubLogo size={20} className="mr-2" />
                    Code
                </Link>
            </nav>
        </header>
    )
}