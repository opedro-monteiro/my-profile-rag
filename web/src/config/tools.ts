import {
  IconCloud,
  IconFileSearch,
  IconTool,
  type Icon,
} from "@tabler/icons-react"

export interface ToolMeta {
  label: string
  icon: Icon
  running: string
  done: string
  failed: string
  hint: string
}

const TOOL_META: Record<string, ToolMeta> = {
  search_profile: {
    label: "Profile search",
    icon: IconFileSearch,
    running: "Searching the profile",
    done: "Searched the profile",
    failed: "Profile search failed",
    hint: "Vector search over the chunks of Profile.pdf stored in Neo4j.",
  },
  get_weather: {
    label: "Weather",
    icon: IconCloud,
    running: "Checking the weather",
    done: "Checked the weather",
    failed: "Weather lookup failed",
    hint: "Demo stub. Always answers that it is sunny.",
  },
}

export function getToolMeta(name: string): ToolMeta {
  return (
    TOOL_META[name] ?? {
      label: name,
      icon: IconTool,
      running: `Running ${name}`,
      done: `Ran ${name}`,
      failed: `${name} failed`,
      hint: "Tool exposed by the agent.",
    }
  )
}
