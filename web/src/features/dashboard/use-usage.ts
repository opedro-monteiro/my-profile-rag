import * as React from "react"
import { fetchUsage, type UsageRange, type UsageRecord } from "@/lib/api"

type UsageState =
  | { status: "loading"; records?: UsageRecord[] }
  | { status: "error"; error: string }
  | { status: "ready"; records: UsageRecord[] }

interface Loaded {
  key: string
  records?: UsageRecord[]
  error?: string
}

/** Usage recorded by the API, refetched when the range or `refreshKey` changes. */
export function useUsage(range: UsageRange, refreshKey?: unknown) {
  const [attempt, setAttempt] = React.useState(0)
  const [loaded, setLoaded] = React.useState<Loaded | null>(null)
  const key = `${range}|${String(refreshKey)}|${attempt}`

  React.useEffect(() => {
    const controller = new AbortController()

    fetchUsage(range, controller.signal)
      .then((records) => setLoaded({ key, records }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoaded({
          key,
          error:
            error instanceof TypeError
              ? "Could not reach the API."
              : error instanceof Error
                ? error.message
                : "Something went wrong.",
        })
      })

    return () => controller.abort()
  }, [range, key])

  const reload = React.useCallback(() => setAttempt((value) => value + 1), [])

  let state: UsageState
  if (loaded?.key === key && loaded.error)
    state = { status: "error", error: loaded.error }
  else if (loaded?.key === key && loaded.records)
    state = { status: "ready", records: loaded.records }
  // Keep the previous numbers on screen while the new ones load.
  else state = { status: "loading", records: loaded?.records }

  return { state, reload }
}
