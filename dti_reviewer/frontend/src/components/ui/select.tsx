import * as SelectPrimitive from "@radix-ui/react-select"
import { CaretDown, CaretUp, Check } from "@phosphor-icons/react"

export function Select({ label, value, onValueChange, options, placeholder }: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
}) {
  return <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
    <SelectPrimitive.Trigger className="reviewer-select-trigger" aria-label={label} disabled={options.length === 0}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon asChild><CaretDown aria-hidden="true" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content className="reviewer-select-menu" position="popper" sideOffset={4} collisionPadding={16}>
        <SelectPrimitive.ScrollUpButton className="reviewer-select-scroll"><CaretUp /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport>
          {options.map((option) => <SelectPrimitive.Item className="reviewer-select-option" key={option.value} value={option.value}>
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator><Check aria-hidden="true" /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="reviewer-select-scroll"><CaretDown /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
}
