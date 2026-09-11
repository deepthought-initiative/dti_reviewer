import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import React from "react";
import logo from "../assets/logo.png"
import GITHUB from "../assets/github-mark.svg"

export default function Component() {
    return (
        <header className="flex h-20 w-full shrink-0 items-center px-4 md:px-6">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                        <MenuIcon className="h-6 w-6" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <div className="flex flex-col h-full">
                        {/* Header section */}
                        <div className="flex items-center p-6 border-b border-gray-200">
                            <img height="40" width="40" className="animate-wiggle animate-infinite" src={logo} />
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
                                        <img height="20" width="20" className="animate-wiggle animate-infinite mr-2" src={GITHUB} />
                                        <span>GitHub</span>
                                    </div>
                                </Link>
                            </div>
                        </nav>
                    </div>
                </SheetContent>
            </Sheet>

            <Link to="/" className="mr-6 hidden lg:flex items-center">
                <img height="40" width="40" className="animate-wiggle animate-infinite" src={logo} />
                <h2>DTI Reviewer</h2>
            </Link>

            <nav className="ml-auto hidden lg:flex gap-6">
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
                    <img height="20" width="20" className="animate-wiggle animate-infinite mr-2" src={GITHUB} />
                    Code
                </Link>
            </nav>
        </header>
    )
}

function MenuIcon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <line x1="4" x2="20" y1="12" y2="12" />
            <line x1="4" x2="20" y1="6" y2="6" />
            <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
    )
}