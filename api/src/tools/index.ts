import { getGithubProfile } from "./github/get-github-profile.ts";
import { getGithubRepo } from "./github/get-github-repo.ts";
import { listGithubCommits } from "./github/list-github-commits.ts";
import { listGithubRepos } from "./github/list-github-repos.ts";
import { searchProfile } from "./search-profile.ts";

export const tools = [
  searchProfile,
  getGithubProfile,
  listGithubRepos,
  getGithubRepo,
  listGithubCommits,
];
