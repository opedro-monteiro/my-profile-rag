import { TURNSTILE } from "@/config/turnstile"
import { loadTurnstile } from "@/lib/load-turnstile"

const widget: {
  id?: string
  settle?: (token: string | undefined) => void
} = {}

export async function getTurnstileToken() {
  if (!TURNSTILE.siteKey) return undefined

  const turnstile = await loadTurnstile()
  const token = new Promise<string | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 60_000)
    widget.settle = (value) => {
      clearTimeout(timer)
      resolve(value)
    }
  })

  if (widget.id === undefined) {
    const container = document.createElement("div")
    container.className = "fixed right-4 bottom-4 z-50"
    document.body.append(container)
    widget.id = turnstile.render(container, {
      sitekey: TURNSTILE.siteKey,
      action: TURNSTILE.action,
      appearance: "interaction-only",
      execution: "execute",
      callback: (value) => widget.settle?.(value),
      "error-callback": () => {
        widget.settle?.(undefined)
        return true
      },
      "timeout-callback": () => widget.settle?.(undefined),
    })
  } else turnstile.reset(widget.id)

  turnstile.execute(widget.id)
  return token
}
