import { AnimatePresence, motion } from "motion/react"
import {
  IconDeviceDesktop,
  IconDots,
  IconLayoutDashboard,
  IconMessage,
  IconMoon,
  IconPencilPlus,
  IconSun,
  IconTool,
  IconTrash,
} from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Kbd } from "@/components/ui/kbd"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useTheme } from "@/components/theme-provider"
import { useChatStore } from "@/features/chat/chat-store"
import type { Route, View } from "@/hooks/use-hash-route"
import { formatRelative } from "@/lib/format"
import { transitions } from "@/lib/motion"

const NAV: {
  view: View
  label: string
  hint: string
  icon: typeof IconMessage
}[] = [
  {
    view: "chat",
    label: "Chat",
    hint: "Talk to the assistant",
    icon: IconMessage,
  },
  {
    view: "dashboard",
    label: "Dashboard",
    hint: "Tokens, models and latency",
    icon: IconLayoutDashboard,
  },
  {
    view: "tools",
    label: "Tools",
    hint: "What the agent can call",
    icon: IconTool,
  },
]

const THEMES = [
  { value: "light", label: "Light", icon: IconSun },
  { value: "dark", label: "Dark", icon: IconMoon },
  { value: "system", label: "System", icon: IconDeviceDesktop },
] as const

function ActiveMark() {
  return (
    <motion.span
      layoutId="sidebar-active"
      transition={transitions.spring}
      className="absolute inset-y-1.5 -left-2 w-0.5 rounded-full bg-sidebar-primary"
      aria-hidden
    />
  )
}

function ThemeMenu() {
  const { theme, setTheme } = useTheme()
  const current = THEMES.find((item) => item.value === theme) ?? THEMES[2]
  const Icon = current.icon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton tooltip="Theme">
          <Icon />
          <span>Theme</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {current.label}
          </span>
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between">
            Theme <Kbd>D</Kbd>
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(value) => setTheme(value as typeof theme)}
          >
            {THEMES.map((item) => (
              <DropdownMenuRadioItem key={item.value} value={item.value}>
                <item.icon />
                {item.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface AppSidebarProps {
  route: Route
  onNavigate: (route: Route) => void
}

export function AppSidebar({ route, onNavigate }: AppSidebarProps) {
  const { conversations, activeId, streamingId, remove } = useChatStore()
  const { isMobile, setOpenMobile } = useSidebar()

  function go(next: Route) {
    onNavigate(next)
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon" variant="sidebar">
      <SidebarHeader className="gap-3 pt-4">
        <div className="flex items-baseline gap-1 px-2 group-data-[collapsible=icon]:hidden">
          <span className="font-display text-2xl leading-none">Profile</span>
          <span className="font-display text-2xl leading-none text-sidebar-primary italic">
            RAG
          </span>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="New chat"
              variant="outline"
              className="bg-background"
              onClick={() => go({ view: "chat", conversationId: null })}
            >
              <IconPencilPlus />
              <span>New chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => {
                const active = route.view === item.view
                return (
                  <SidebarMenuItem key={item.view} className="relative">
                    {active ? <ActiveMark /> : null}
                    <SidebarMenuButton
                      isActive={active}
                      tooltip={{ children: item.hint }}
                      onClick={() =>
                        go({
                          view: item.view,
                          conversationId:
                            item.view === "chat" ? activeId : null,
                        })
                      }
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="group-data-[collapsible=icon]:hidden">
          <SidebarGroupLabel>Recents</SidebarGroupLabel>
          <SidebarGroupContent>
            {conversations.length === 0 ? (
              <p className="px-2 py-1 text-xs text-muted-foreground">
                Your conversations will show up here.
              </p>
            ) : (
              <SidebarMenu>
                <AnimatePresence initial={false}>
                  {conversations.map((conversation) => (
                    <motion.li
                      key={conversation.id}
                      layout
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      transition={transitions.quick}
                      data-slot="sidebar-menu-item"
                      data-sidebar="menu-item"
                      className="group/menu-item relative"
                    >
                      <SidebarMenuButton
                        isActive={
                          route.view === "chat" && conversation.id === activeId
                        }
                        onClick={() =>
                          go({ view: "chat", conversationId: conversation.id })
                        }
                        title={`${conversation.title} · ${formatRelative(conversation.updatedAt)}`}
                      >
                        {streamingId === conversation.id ? (
                          <span
                            className="size-1.5 shrink-0 animate-pulse rounded-full bg-sidebar-primary"
                            aria-label="Replying"
                          />
                        ) : null}
                        <span className="truncate">{conversation.title}</span>
                      </SidebarMenuButton>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <SidebarMenuAction
                            showOnHover
                            aria-label="Conversation actions"
                          >
                            <IconDots />
                          </SidebarMenuAction>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="right" align="start">
                          <DropdownMenuGroup>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                remove(conversation.id)
                                if (conversation.id === activeId)
                                  go({ view: "chat", conversationId: null })
                              }}
                            >
                              <IconTrash />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuGroup>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <ThemeMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
