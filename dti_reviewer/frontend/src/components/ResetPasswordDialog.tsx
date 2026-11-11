import { useState, type FormEvent } from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Props = {
    userId: number
    name: string
    busy: boolean
    error: string
    onOpen: () => void
    onReset: (form: HTMLFormElement) => Promise<boolean | undefined>
}

export default function ResetPasswordDialog({ userId, name, busy, error, onOpen, onReset }: Props) {
    const [open, setOpen] = useState(false)
    const [validationError, setValidationError] = useState("")

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget
        const data = new FormData(form)
        if (data.get("password") !== data.get("confirm_password")) {
            setValidationError("New passwords do not match")
            return
        }
        setValidationError("")
        if (await onReset(form)) setOpen(false)
    }

    return (
        <Dialog.Root open={open} onOpenChange={(next) => {
            if (busy) return
            setOpen(next)
            setValidationError("")
            if (next) onOpen()
        }}>
            <Dialog.Trigger asChild><Button type="button" variant="outline" size="sm" aria-label={`Reset password for ${name}`}>Reset password</Button></Dialog.Trigger>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background p-6 shadow-lg">
                    <Dialog.Title className="text-lg font-semibold">Reset password for {name}</Dialog.Title>
                    <Dialog.Description className="my-3 text-sm">This signs the user out on all devices. Their current password is not required.</Dialog.Description>
                    {(validationError || error) && <p role="alert" className="mb-3 text-red-700">{validationError || error}</p>}
                    <form onSubmit={submit}>
                        <fieldset disabled={busy} className="space-y-4">
                            <div><label htmlFor={`reset-password-${userId}`}>New password</label><Input id={`reset-password-${userId}`} name="password" type="password" autoComplete="new-password" required /></div>
                            <div><label htmlFor={`reset-confirm-${userId}`}>Confirm new password</label><Input id={`reset-confirm-${userId}`} name="confirm_password" type="password" autoComplete="new-password" required /></div>
                            <div className="flex justify-end gap-2">
                                <Dialog.Close asChild><Button type="button" variant="outline">Cancel</Button></Dialog.Close>
                                <Button type="submit">{busy ? "Saving…" : "Reset password"}</Button>
                            </div>
                        </fieldset>
                    </form>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
