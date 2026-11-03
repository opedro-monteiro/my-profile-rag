import * as React from "react"
import { animate, motion, useReducedMotion } from "motion/react"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { IconChartBar, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { findModel, MODELS } from "@/config/models"
import { getToolMeta } from "@/config/tools"
import { useChatStore } from "@/features/chat/chat-store"
import { formatDuration, formatNumber, formatTokens } from "@/lib/format"
import { fadeUp, stagger } from "@/lib/motion"
import {
  byModel,
  byTool,
  filterByRange,
  summarize,
  tokensByDay,
  type Range,
} from "./stats"

const CHART_CONFIG = {
  input: { label: "Input", color: "var(--chart-2)" },
  output: { label: "Output", color: "var(--chart-1)" },
} satisfies ChartConfig

const DAY_LABEL = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
})
const CONFIRM_WINDOW_MS = 3000

function AnimatedNumber({
  value,
  format,
}: {
  value: number
  format: (value: number) => string
}) {
  const reduce = useReducedMotion()
  const ref = React.useRef<HTMLSpanElement>(null)
  const previous = React.useRef(0)

  React.useEffect(() => {
    const node = ref.current
    if (!node) return

    if (reduce) {
      node.textContent = format(value)
      return
    }

    const controls = animate(previous.current, value, {
      duration: 0.9,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        node.textContent = format(latest)
      },
    })
    previous.current = value
    return () => controls.stop()
  }, [value, format, reduce])

  return <span ref={ref}>{format(0)}</span>
}

const roundTokens = (value: number) => formatTokens(Math.round(value))
const roundNumber = (value: number) => formatNumber(Math.round(value))
const asDuration = (value: number) => formatDuration(value)

function Figure({
  label,
  hint,
  value,
  format,
  emphasis,
}: {
  label: string
  hint: string
  value: number
  format: (value: number) => string
  emphasis?: boolean
}) {
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

function ResetButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = React.useState(false)

  React.useEffect(() => {
    if (!armed) return
    const timeout = setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS)
    return () => clearTimeout(timeout)
  }, [armed])

  return (
    <Button
      variant={armed ? "destructive" : "ghost"}
      size="sm"
      onClick={() => {
        if (!armed) return setArmed(true)
        setArmed(false)
        onConfirm()
      }}
    >
      <IconTrash data-icon="inline-start" />
      {armed ? "Click again to reset" : "Reset stats"}
    </Button>
  )
}

export function DashboardView() {
  const { usage, clearUsage } = useChatStore()
  const [range, setRange] = React.useState<Range>("7d")

  const records = React.useMemo(
    () => filterByRange(usage, range),
    [usage, range]
  )
  const summary = React.useMemo(() => summarize(records), [records])
  const days = React.useMemo(
    () => tokensByDay(records, range),
    [records, range]
  )
  const models = React.useMemo(() => byModel(records), [records])
  const tools = React.useMemo(() => byTool(records), [records])
  const topTool = tools[0]?.calls ?? 0

  function reset() {
    clearUsage()
    toast.success("Usage stats cleared")
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Dashboard">
        {usage.length > 0 ? <ResetButton onConfirm={reset} /> : null}
      </PageHeader>

      <motion.div
        variants={stagger(0.06)}
        initial="hidden"
        animate="visible"
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10 sm:px-8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <motion.div variants={fadeUp} className="flex flex-col gap-2">
            <h1 className="font-display text-5xl leading-none tracking-tight">
              Usage
            </h1>
            <p className="text-muted-foreground">
              Tokens and replies recorded in this browser.
            </p>
          </motion.div>
          <motion.div variants={fadeUp}>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              value={range}
              onValueChange={(value) => value && setRange(value as Range)}
              aria-label="Time range"
            >
              <ToggleGroupItem value="7d">7 days</ToggleGroupItem>
              <ToggleGroupItem value="30d">30 days</ToggleGroupItem>
              <ToggleGroupItem value="all">All time</ToggleGroupItem>
            </ToggleGroup>
          </motion.div>
        </div>

        {records.length === 0 ? (
          <motion.div variants={fadeUp}>
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconChartBar />
                </EmptyMedia>
                <EmptyTitle>No usage in this range</EmptyTitle>
                <EmptyDescription>
                  Every reply records its tokens, model, tools and latency here.
                  Ask something in the chat to see the first numbers.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button asChild variant="outline" size="sm">
                  <a href="#/chat">Open the chat</a>
                </Button>
              </EmptyContent>
            </Empty>
          </motion.div>
        ) : (
          <>
            <motion.dl
              variants={stagger(0.05)}
              className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]"
            >
              <Figure
                emphasis
                label="Total tokens"
                hint="Input plus output, across every reply"
                value={summary.totalTokens}
                format={roundTokens}
              />
              <Figure
                label="Input"
                hint="Prompt, history and retrieved passages sent to the model"
                value={summary.inputTokens}
                format={roundTokens}
              />
              <Figure
                label="Output"
                hint="Tokens the model generated"
                value={summary.outputTokens}
                format={roundTokens}
              />
              <Figure
                label="Replies"
                hint={`${summary.failures} failed`}
                value={summary.replies}
                format={roundNumber}
              />
              <Figure
                label="Avg. latency"
                hint="From sending the message to the end of the reply"
                value={summary.averageMs}
                format={asDuration}
              />
            </motion.dl>

            <motion.section variants={fadeUp} className="flex flex-col gap-4">
              <h2 className="text-sm font-medium">Tokens per day</h2>
              <ChartContainer
                config={CHART_CONFIG}
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
                    tickFormatter={(day: string) =>
                      DAY_LABEL.format(new Date(`${day}T00:00`))
                    }
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={44}
                    tickFormatter={(value: number) => formatTokens(value)}
                  />
                  <ChartTooltip
                    cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(day) =>
                          DAY_LABEL.format(new Date(`${day}T00:00`))
                        }
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

            <div className="grid gap-10 lg:grid-cols-[1.6fr_1fr]">
              <motion.section
                variants={fadeUp}
                className="flex min-w-0 flex-col gap-4"
              >
                <h2 className="text-sm font-medium">By model</h2>
                <div className="overflow-hidden rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Model</TableHead>
                        <TableHead className="text-right">Replies</TableHead>
                        <TableHead className="text-right">Input</TableHead>
                        <TableHead className="text-right">Output</TableHead>
                        <TableHead className="text-right">
                          Avg. latency
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {models.map((row) => {
                        const known = MODELS.some(
                          (model) => model.id === row.modelId
                        )
                        return (
                          <TableRow key={row.modelId}>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">
                                  {known
                                    ? findModel(row.modelId).label
                                    : row.modelId}
                                </span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {row.provider}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {row.replies}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {formatNumber(row.inputTokens)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {formatNumber(row.outputTokens)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs tabular-nums">
                              {formatDuration(row.durationMs / row.replies)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </motion.section>

              <motion.section variants={fadeUp} className="flex flex-col gap-4">
                <h2 className="text-sm font-medium">Tool calls</h2>
                {tools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No tools called in this range.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-4">
                    {tools.map((tool) => {
                      const meta = getToolMeta(tool.name)
                      const Icon = meta.icon
                      return (
                        <li key={tool.name} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="flex items-center gap-2">
                              <Icon
                                className="size-4 text-muted-foreground"
                                aria-hidden
                              />
                              {meta.label}
                            </span>
                            <Badge variant="secondary" className="tabular-nums">
                              {formatNumber(tool.calls)}
                            </Badge>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <motion.div
                              className="h-full origin-left rounded-full bg-primary"
                              initial={{ scaleX: 0 }}
                              animate={{ scaleX: tool.calls / topTool }}
                              transition={{
                                duration: 0.8,
                                ease: [0.16, 1, 0.3, 1],
                              }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </motion.section>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
