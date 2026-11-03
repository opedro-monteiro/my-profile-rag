import * as React from "react"
import { AnimatePresence, MotionConfig, motion } from "motion/react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatStoreProvider, useChatStore } from "@/features/chat/chat-store"
import { ChatView } from "@/features/chat/chat-view"
import { DashboardView } from "@/features/dashboard/dashboard-view"
import { ToolsView } from "@/features/tools/tools-view"
import { useHashRoute, type View } from "@/hooks/use-hash-route"
import { transitions } from "@/lib/motion"

const VIEWS: Record<View, React.ComponentType> = {
  chat: ChatView,
  dashboard: DashboardView,
  tools: ToolsView,
}

function Shell() {
  const { route, navigate } = useHashRoute()
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
    // Only a route change should drive the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route])

  React.useEffect(() => {
    if (route.view === "chat" && activeId && activeId !== route.conversationId)
      navigate({ view: "chat", conversationId: activeId }, true)
    // Only a new active conversation should rewrite the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId])

  const View = VIEWS[route.view]

  return (
    <SidebarProvider>
      <AppSidebar route={route} onNavigate={navigate} />
      <SidebarInset className="min-w-0">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={route.view}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={transitions.quick}
            className="flex min-h-0 flex-1 flex-col"
          >
            <View />
          </motion.div>
        </AnimatePresence>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <ChatStoreProvider>
          <Shell />
          <Toaster position="bottom-right" />
        </ChatStoreProvider>
      </TooltipProvider>
    </MotionConfig>
  )
}

export default App
