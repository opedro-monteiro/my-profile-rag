import { tool } from "langchain";
import * as z from "zod";
import { getConfig } from "../../config/index.ts";
import { githubFetch } from "./github-fetch.ts";

export const getGithubRepo = tool(
  ({ repo }) => githubFetch(`/repos/${getConfig().github.user}/${encodeURIComponent(repo)}`),
  {
    name: "get_github_repo",
    description:
      "Get the details of one of Pedro Monteiro's public GitHub repositories: description, language, topics, stars, forks, open issues, license, default branch and dates.",
    schema: z.object({
      repo: z.string().min(1).describe("Repository name, without the owner."),
    }),
  },
);
