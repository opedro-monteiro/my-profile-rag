import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import type { Range } from "../stats"

export function RangeToggle({
  value,
  onChange,
}: Readonly<{ value: Range; onChange: (range: Range) => void }>) {
  return (
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => next && onChange(next as Range)}
      aria-label="Time range"
    >
      <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
      <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
      <ToggleGroupItem value="all">All time</ToggleGroupItem>
    </ToggleGroup>
  )
}
