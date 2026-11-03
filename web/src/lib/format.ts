const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
})
const full = new Intl.NumberFormat("en")
const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

export function formatTokens(value: number) {
  return value < 1000 ? String(value) : compact.format(value)
}

export function formatNumber(value: number) {
  return full.format(value)
}

export function formatDuration(ms: number) {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`

  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)}s`

  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
]

export function formatRelative(timestamp: number, now = Date.now()) {
  const diff = timestamp - now

  for (const [unit, size] of UNITS)
    if (Math.abs(diff) >= size)
      return relative.format(Math.round(diff / size), unit)

  return "just now"
}
