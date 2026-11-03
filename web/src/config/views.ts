import type * as React from "react"
import { ChatView } from "@/features/chat/chat-view"
import { DashboardView } from "@/features/dashboard/dashboard-view"
import { ToolsView } from "@/features/tools/tools-view"
import type { View } from "@/hooks/use-hash-route"

export const VIEWS: Record<View, React.ComponentType> = {
  chat: ChatView,
  dashboard: DashboardView,
  tools: ToolsView,
}
