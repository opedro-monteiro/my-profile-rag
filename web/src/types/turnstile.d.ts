interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  appearance?: "always" | "execute" | "interaction-only"
  execution?: "render" | "execute"
  callback?: (token: string) => void
  "error-callback"?: (code: string) => boolean | void
  "timeout-callback"?: () => void
}

interface Turnstile {
  render(container: HTMLElement, options: TurnstileRenderOptions): string
  execute(widgetId: string): void
  reset(widgetId: string): void
}

interface Window {
  turnstile?: Turnstile
}
