import { Sheet, SheetTrigger, SheetContent } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Link, NavLink } from "react-router-dom"
import { GithubLogo, List } from "@phosphor-icons/react"
import logo from "../assets/logo.png"

export default function Component({ isAdmin }: { isAdmin: boolean }) {
    return (
        <header className="flex h-20 w-full shrink-0 items-center gap-2 border-b border-border px-4 md:px-6">
            <Sheet>
                <SheetTrigger asChild>
                    <Button variant="outline" size="icon" className="lg:hidden">
                        <List aria-hidden="true" />
                        <span className="sr-only">Toggle navigation menu</span>
                    </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 p-0">
                    <div className="flex h-full flex-col">
                        <div className="flex items-center gap-3 border-b border-border p-6">
                            <img height="40" width="40" src={logo} alt="" />
                            <span className="font-semibold">DTI Reviewer</span>
                        </div>
                        <nav className="flex flex-col gap-1 p-4" aria-label="Mobile navigation">
                            <Button asChild variant="ghost" className="justify-start"><NavLink to="/" end className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">Home</NavLink></Button>
                            <Button asChild variant="ghost" className="justify-start"><NavLink to="/chats">Chats</NavLink></Button>
                            <Button asChild variant="ghost" className="justify-start"><NavLink to="/about" className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">About Us</NavLink></Button>
                            <Button asChild variant="ghost" className="justify-start"><a href="https://github.com/deepthought-initiative/dti_reviewer" target="_blank" rel="noopener noreferrer"><GithubLogo size={18} aria-hidden="true" />GitHub</a></Button>
                        </nav>
                    </div>
                </SheetContent>
            </Sheet>
            <Link to="/" className="mr-auto hidden items-center gap-2 lg:flex">
                <img height="36" width="36" src={logo} alt="" />
                <span className="font-semibold">DTI Reviewer</span>
            </Link>
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Main navigation">
                <Button asChild variant="ghost"><NavLink to="/" end className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">Home</NavLink></Button>
                <Button asChild variant="ghost"><NavLink to="/chats">Chats</NavLink></Button>
                <Button asChild variant="ghost"><NavLink to="/about" className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">About Us</NavLink></Button>
                <Button asChild variant="ghost"><a href="https://github.com/deepthought-initiative/dti_reviewer" target="_blank" rel="noopener noreferrer"><GithubLogo size={18} aria-hidden="true" />Code</a></Button>
            </nav>
            <div className="ml-auto flex items-center gap-2 lg:ml-2">
                <Button asChild variant="outline"><NavLink to="/login" className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">Login / account</NavLink></Button>
                {isAdmin && (
                    <Button asChild variant="outline"><NavLink to="/admin" className="aria-[current=page]:bg-accent aria-[current=page]:text-accent-foreground">Admin</NavLink></Button>
                )}
            </div>
        </header>
    )
}
