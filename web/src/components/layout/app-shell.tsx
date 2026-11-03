import { AnimatePresence, motion } from "motion/react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { VIEWS } from "@/config/views"
import { useHashRoute } from "@/hooks/use-hash-route"
import { useRouteSelection } from "@/hooks/use-route-selection"
import { transitions } from "@/lib/motion"

export function AppShell() {
  const hashRoute = useHashRoute()
  const { route, navigate } = hashRoute
  useRouteSelection(hashRoute)

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
