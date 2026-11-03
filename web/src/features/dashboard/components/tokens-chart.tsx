import { motion } from "motion/react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { formatDay, formatTokens } from "@/lib/format"
import { fadeUp } from "@/lib/motion"
import type { tokensByDay } from "../stats"
import { TOKENS_CHART_CONFIG } from "./tokens-chart-config"

export function TokensChart({
  days,
}: Readonly<{ days: ReturnType<typeof tokensByDay> }>) {
  return (
    <motion.section variants={fadeUp} className="flex flex-col gap-4">
      <h2 className="text-sm font-medium">Tokens per day</h2>
      <ChartContainer
        config={TOKENS_CHART_CONFIG}
        className="aspect-auto h-72 w-full"
      >
        <BarChart data={days} margin={{ left: 4, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} strokeDasharray="2 4" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={24}
            tickFormatter={formatDay}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={formatTokens}
          />
          <ChartTooltip
            cursor={{ fill: "var(--muted)", opacity: 0.6 }}
            content={
              <ChartTooltipContent
                labelFormatter={(day) => formatDay(String(day))}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="input"
            stackId="tokens"
            fill="var(--color-input)"
            stroke="var(--background)"
            strokeWidth={2}
            maxBarSize={36}
          />
          <Bar
            dataKey="output"
            stackId="tokens"
            fill="var(--color-output)"
            stroke="var(--background)"
            strokeWidth={2}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
        </BarChart>
      </ChartContainer>
    </motion.section>
  )
}
