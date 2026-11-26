import * as React from "react"
import { fetchModels, type ModelList } from "@/lib/api"

export type ModelsState =
  | { status: "loading" }
  | { status: "error"; error: string }
  | ({ status: "ready" } & ModelList)

export function useModels() {
  const [state, setState] = React.useState<ModelsState>({ status: "loading" })
  const [attempt, setAttempt] = React.useState(0)

  React.useEffect(() => {
    const controller = new AbortController()

    fetchModels(controller.signal)
      .then((list) => setState({ status: "ready", ...list }))
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
