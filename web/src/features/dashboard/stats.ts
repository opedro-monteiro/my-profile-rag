import type { UsageRange as Range, UsageRecord } from "@/lib/api"

export type { Range }

const DAY_MS = 86_400_000

export const RANGE_DAYS: Record<Exclude<Range, "all">, number> = {
  "7d": 7,
  "30d": 30,
}

export function summarize(records: UsageRecord[]) {
  let inputTokens = 0
  let outputTokens = 0
  let durationMs = 0
  let failures = 0

  for (const record of records) {
    inputTokens += record.inputTokens
    outputTokens += record.outputTokens
    durationMs += record.durationMs
    if (record.status === "error") failures++
  }

  return {
    replies: records.length,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    averageMs: records.length ? durationMs / records.length : 0,
    failures,
  }
}

function dayKey(timestamp: number) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

/** One row per calendar day in the range, including days with no usage. */
export function tokensByDay(
  records: UsageRecord[],
  range: Range,
  now = Date.now()
) {
  const first =
    range === "all"
      ? Math.min(now, ...records.map((record) => record.at))
      : now - (RANGE_DAYS[range] - 1) * DAY_MS
  const start = new Date(first)
  start.setHours(0, 0, 0, 0)

  const days = new Map<string, { day: string; input: number; output: number }>()
  for (let time = start.getTime(); time <= now; time += DAY_MS) {
    const key = dayKey(time)
    days.set(key, { day: key, input: 0, output: 0 })
  }

  for (const record of records) {
    const bucket = days.get(dayKey(record.at))
    if (!bucket) continue
    bucket.input += record.inputTokens
    bucket.output += record.outputTokens
  }

  return [...days.values()]
}

export function byModel(records: UsageRecord[]) {
  const models = new Map<
    string,
    {
      modelId: string
      provider: string
      replies: number
      inputTokens: number
      outputTokens: number
      durationMs: number
    }
  >()

  for (const record of records) {
    const entry = models.get(record.modelId) ?? {
      modelId: record.modelId,
      provider: record.provider,
      replies: 0,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: 0,
    }
    entry.replies++
    entry.inputTokens += record.inputTokens
    entry.outputTokens += record.outputTokens
    entry.durationMs += record.durationMs
    models.set(record.modelId, entry)
  }

  return [...models.values()].sort(
    (a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens)
  )
}

export function byTool(records: UsageRecord[]) {
  const tools = new Map<string, number>()
  for (const record of records)
    for (const name of record.tools) tools.set(name, (tools.get(name) ?? 0) + 1)

  return [...tools.entries()]
    .map(([name, calls]) => ({ name, calls }))
    .sort((a, b) => b.calls - a.calls)
}
