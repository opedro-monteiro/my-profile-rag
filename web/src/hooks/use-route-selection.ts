import * as React from "react"
import { useChatStore } from "@/features/chat/chat-store"
import type { useHashRoute } from "@/hooks/use-hash-route"

export function useRouteSelection({
  route,
  navigate,
}: ReturnType<typeof useHashRoute>) {
  const { activeId, conversations, select } = useChatStore()

  React.useEffect(() => {
    if (route.view !== "chat") return

    const exists = conversations.some(
      (item) => item.id === route.conversationId
    )
    if (route.conversationId && !exists) {
      navigate({ view: "chat", conversationId: null }, true)
      return
    }

    select(route.conversationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  React.useEffect(() => {
    if (route.view === "chat" && activeId && activeId !== route.conversationId)
      navigate({ view: "chat", conversationId: activeId }, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])
}
