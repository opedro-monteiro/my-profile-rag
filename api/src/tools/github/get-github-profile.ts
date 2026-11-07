import { tool } from "langchain";
import * as z from "zod";
import { getConfig } from "../../config/index.ts";
import { githubFetch } from "./github-fetch.ts";

export const getGithubProfile = tool(
  () => githubFetch(`/users/${getConfig().github.user}`),
  {
    name: "get_github_profile",
    description:
      "Get Pedro Monteiro's public GitHub profile: name, bio, company, location, blog, followers, following and number of public repositories.",
    schema: z.object({}),
  },
);
