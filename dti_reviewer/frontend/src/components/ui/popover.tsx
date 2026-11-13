import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root
const PopoverTrigger = PopoverPrimitive.Trigger
const PopoverClose = PopoverPrimitive.Close

function PopoverContent({ className, align = "end", sideOffset = 8, ...props }: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content align={align} sideOffset={sideOffset} collisionPadding={16}
      className={cn("reviewer-popover", className)} {...props} />
  </PopoverPrimitive.Portal>
}

export { Popover, PopoverTrigger, PopoverContent, PopoverClose }
