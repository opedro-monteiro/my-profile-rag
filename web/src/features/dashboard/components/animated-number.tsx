import * as React from "react"
import { animate, useReducedMotion } from "motion/react"
import { EASE_OUT_EXPO } from "@/lib/motion"

export function AnimatedNumber({
  value,
  format,
}: Readonly<{
  value: number
  format: (value: number) => string
}>) {
  const reduce = useReducedMotion()
  const ref = React.useRef<HTMLSpanElement>(null)
  const previous = React.useRef(0)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    if (reduce) {
      node.textContent = format(Math.round(value))
      return
    }

    const controls = animate(previous.current, value, {
      duration: 0.9,
      ease: EASE_OUT_EXPO,
      onUpdate: (latest) => {
        node.textContent = format(Math.round(latest))
      },
    })
    previous.current = value
    return () => controls.stop()
  }, [value, format, reduce])

  return <span ref={ref}>{format(0)}</span>
}
