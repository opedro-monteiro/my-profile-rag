import { MotionConfig } from "motion/react"
import { AppShell } from "@/components/layout/app-shell"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ChatStoreProvider } from "@/features/chat/chat-store"

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <TooltipProvider delayDuration={300}>
        <ChatStoreProvider>
          <AppShell />
          <Toaster position="bottom-right" />
        </ChatStoreProvider>
      </TooltipProvider>
    </MotionConfig>
  )
}
