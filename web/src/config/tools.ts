import {
  IconBrandGithub,
  IconFileSearch,
  IconFolder,
  IconFolders,
  IconGitCommit,
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
  get_github_profile: {
    label: "GitHub profile",
    icon: IconBrandGithub,
    running: "Reading the GitHub profile",
    done: "Read the GitHub profile",
    failed: "GitHub profile lookup failed",
    hint: "Public profile data from the GitHub API: bio, followers and repository count.",
  },
  list_github_repos: {
    label: "GitHub repositories",
    icon: IconFolders,
    running: "Listing the GitHub repositories",
    done: "Listed the GitHub repositories",
    failed: "Listing the GitHub repositories failed",
    hint: "Public repositories of the configured GitHub user, read from the GitHub API.",
  },
  get_github_repo: {
    label: "GitHub repository",
    icon: IconFolder,
    running: "Reading a GitHub repository",
    done: "Read a GitHub repository",
    failed: "GitHub repository lookup failed",
    hint: "Details of one public repository: language, topics, stars, forks and license.",
  },
  list_github_commits: {
    label: "GitHub commits",
    icon: IconGitCommit,
    running: "Listing the GitHub commits",
    done: "Listed the GitHub commits",
    failed: "Listing the GitHub commits failed",
    hint: "Latest commits of one public repository, newest first.",
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
