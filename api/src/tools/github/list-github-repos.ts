import { tool } from "langchain";
import * as z from "zod";
import { getConfig } from "../../config/index.ts";
import { githubFetch } from "./github-fetch.ts";

export const listGithubRepos = tool(
  ({ sort, direction, perPage, page }) =>
    githubFetch(`/users/${getConfig().github.user}/repos`, {
      sort,
      direction,
      per_page: perPage,
      page,
    }),
  {
    name: "list_github_repos",
    description:
      "List Pedro Monteiro's public GitHub repositories with name, description, language, stars, forks and dates.",
    schema: z.object({
      sort: z
        .enum(["created", "updated", "pushed", "full_name"])
        .optional()
        .describe("Sort field. Defaults to full_name."),
      direction: z.enum(["asc", "desc"]).optional().describe("Sort direction."),
      perPage: z.number().int().min(1).max(100).optional().describe("Items per page, max 100. Defaults to 30."),
      page: z.number().int().min(1).optional().describe("Page number. Defaults to 1."),
    }),
  },
);
