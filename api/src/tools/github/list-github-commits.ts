import { tool } from "langchain";
import * as z from "zod";
import { getConfig } from "../../config/index.ts";
import { githubFetch } from "./github-fetch.ts";

export const listGithubCommits = tool(
  ({ repo, branch, since, until, perPage, page }) =>
    githubFetch(`/repos/${getConfig().github.user}/${encodeURIComponent(repo)}/commits`, {
      sha: branch,
      since,
      until,
      per_page: perPage,
      page,
    }),
  {
    name: "list_github_commits",
    description:
      "List the latest commits of one of Pedro Monteiro's public GitHub repositories, newest first.",
    schema: z.object({
      repo: z.string().min(1).describe("Repository name, without the owner."),
      branch: z.string().optional().describe("Branch name or commit SHA to list from. Defaults to the default branch."),
      since: z.string().optional().describe("Only commits after this ISO 8601 date, e.g. 2025-01-01T00:00:00Z."),
      until: z.string().optional().describe("Only commits before this ISO 8601 date."),
      perPage: z.number().int().min(1).max(100).optional().describe("Items per page, max 100. Defaults to 30."),
      page: z.number().int().min(1).optional().describe("Page number. Defaults to 1."),
    }),
  },
);
