import { motion } from "motion/react"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { fadeUp } from "@/lib/motion"
import { AnimatedNumber } from "./animated-number"

export function Figure({
  label,
  hint,
  value,
  format,
  emphasis,
}: Readonly<{
  label: string
  hint: string
  value: number
  format: (value: number) => string
  emphasis?: boolean
}>) {
  return (
    <motion.div
      variants={fadeUp}
      className="flex flex-col gap-1.5 bg-background px-5 py-5"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <dt className="w-fit cursor-default text-xs font-medium tracking-[0.12em] text-muted-foreground uppercase">
            {label}
          </dt>
        </TooltipTrigger>
        <TooltipContent>{hint}</TooltipContent>
      </Tooltip>
      <dd
        className={
          emphasis
            ? "font-display text-5xl leading-none tabular-nums"
            : "font-display text-4xl leading-none tabular-nums"
        }
      >
        <AnimatedNumber value={value} format={format} />
      </dd>
    </motion.div>
  )
}
