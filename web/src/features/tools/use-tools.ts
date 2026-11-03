import * as React from "react"
import { fetchTools, type ToolDescriptor } from "@/lib/api"

type ToolsState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; tools: ToolDescriptor[] }

export function useTools() {
  const [state, setState] = React.useState<ToolsState>({ status: "loading" })
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()

    fetchTools(controller.signal)
      .then((tools) => setState({ status: "ready", tools }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({
          status: "error",
          error:
            error instanceof TypeError
              ? "Could not reach the API."
              : error instanceof Error
                ? error.message
                : "Something went wrong.",
        })
      })

    return () => controller.abort()
  }, [attempt])

  const reload = React.useCallback(() => {
    setState({ status: "loading" })
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload }
}
