import * as React from "react"

export type View = "chat" | "dashboard" | "tools"

export interface Route {
  view: View
  conversationId: string | null
}

function parse(hash: string): Route {
  const [view, id] = hash.replace(/^#\/?/, "").split("/")

  if (view === "dashboard" || view === "tools")
    return { view, conversationId: null }

  return { view: "chat", conversationId: id || null }
}

export function toHash(route: Route) {
  if (route.view !== "chat") return `#/${route.view}`

  return route.conversationId ? `#/chat/${route.conversationId}` : "#/chat"
}

function subscribe(callback: () => void) {
  window.addEventListener("hashchange", callback)
  return () => window.removeEventListener("hashchange", callback)
}

export function useHashRoute() {
  const hash = React.useSyncExternalStore(subscribe, () => window.location.hash)
  const route = React.useMemo(() => parse(hash), [hash])

  const navigate = React.useCallback((next: Route, replace = false) => {
    const target = toHash(next)
    if (window.location.hash === target) return

    if (replace) {
      history.replaceState(null, "", target)
      window.dispatchEvent(new HashChangeEvent("hashchange"))
      return
    }

    window.location.hash = target
  }, [])

  return { route, navigate }
}
