import * as React from "react"
import { motion } from "motion/react"
import { IconPlugConnectedX, IconRefresh } from "@tabler/icons-react"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getToolMeta } from "@/config/tools"
import { useChatStore } from "@/features/chat/chat-store"
import { API_URL, type ToolDescriptor } from "@/lib/api"
import { formatNumber } from "@/lib/format"
import { fadeUp, stagger } from "@/lib/motion"
import { useTools } from "./use-tools"

function ToolEntry({
  tool,
  index,
  calls,
}: {
  tool: ToolDescriptor
  index: number
  calls: number
}) {
  const meta = getToolMeta(tool.name)
  const Icon = meta.icon
  const properties = Object.entries(tool.parameters.properties ?? {})
  const required = new Set(tool.parameters.required ?? [])

  return (
    <motion.article
      variants={fadeUp}
      className="grid gap-x-8 gap-y-4 border-t py-8 first:border-t-0 md:grid-cols-[minmax(0,14rem)_1fr]"
    >
      <div className="flex flex-col gap-3">
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex items-center gap-2.5">
          <Icon className="size-5 text-primary" aria-hidden />
          <h2 className="font-display text-2xl leading-none">{meta.label}</h2>
        </div>
        <code className="w-fit font-mono text-xs text-muted-foreground">
          {tool.name}
        </code>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="secondary"
              className="w-fit cursor-default tabular-nums"
            >
              {formatNumber(calls)} {calls === 1 ? "call" : "calls"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            Times the agent used it in this browser
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex min-w-0 flex-col gap-5">
        <p className="max-w-prose leading-7 text-pretty">{tool.description}</p>
        <p className="text-sm text-muted-foreground">{meta.hint}</p>

        {properties.length > 0 ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-xs font-medium tracking-[0.14em] text-muted-foreground uppercase">
              Parameters
            </h3>
            <dl className="divide-y rounded-md border">
              {properties.map(([name, schema]) => (
                <div
                  key={name}
                  className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:gap-6"
                >
                  <dt className="flex shrink-0 items-center gap-2 sm:w-40">
                    <code className="font-mono text-sm">{name}</code>
                    <span className="font-mono text-xs text-muted-foreground">
                      {schema.type ?? "any"}
                    </span>
                    {required.has(name) ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-primary" aria-label="Required">
                            *
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Required</TooltipContent>
                      </Tooltip>
                    ) : null}
                  </dt>
                  <dd className="text-sm text-muted-foreground">
                    {schema.description ?? "No description."}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </motion.article>
  )
}

function ToolsSkeleton() {
  return (
    <div className="flex flex-col gap-10 py-8">
      {[0, 1].map((key) => (
        <div key={key} className="grid gap-8 md:grid-cols-[14rem_1fr]">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-3 w-6" />
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ToolsView() {
  const { state, reload } = useTools()
  const { usage } = useChatStore()

  const calls = React.useMemo(() => {
    const counts = new Map<string, number>()
    for (const record of usage)
      for (const name of record.tools)
        counts.set(name, (counts.get(name) ?? 0) + 1)
    return counts
  }, [usage])

  return (
    <div className="flex min-h-dvh flex-col">
      <PageHeader title="Tools">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Reload tools"
              onClick={reload}
            >
              <IconRefresh />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reload from the API</TooltipContent>
        </Tooltip>
      </PageHeader>

      <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-8">
        <motion.header
          variants={stagger(0.06)}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-3 pb-6"
        >
          <motion.h1
            variants={fadeUp}
            className="font-display text-5xl leading-none tracking-tight"
          >
            Tools
          </motion.h1>
          <motion.p
            variants={fadeUp}
            className="max-w-xl text-muted-foreground"
          >
            What the agent can call while it answers. It decides on its own when
            a question needs one.
          </motion.p>
          {state.status === "ready" ? (
            <motion.div
              variants={fadeUp}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {state.tools.length} registered at{" "}
              <code className="font-mono">{API_URL}</code>
            </motion.div>
          ) : null}
        </motion.header>

        {state.status === "loading" ? <ToolsSkeleton /> : null}

        {state.status === "error" ? (
          <Empty className="border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <IconPlugConnectedX />
              </EmptyMedia>
              <EmptyTitle>Can’t load the tools</EmptyTitle>
              <EmptyDescription>
                {state.error} Start it with{" "}
                <code className="font-mono">npm run api</code> in the api
                folder, then try again.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" size="sm" onClick={reload}>
                <IconRefresh data-icon="inline-start" />
                Try again
              </Button>
            </EmptyContent>
          </Empty>
        ) : null}

        {state.status === "ready" ? (
          <motion.div
            variants={stagger(0.08, 0.1)}
            initial="hidden"
            animate="visible"
          >
            {state.tools.map((tool, index) => (
              <ToolEntry
                key={tool.name}
                tool={tool}
                index={index}
                calls={calls.get(tool.name) ?? 0}
              />
            ))}
          </motion.div>
        ) : null}
      </div>
    </div>
  )
}
