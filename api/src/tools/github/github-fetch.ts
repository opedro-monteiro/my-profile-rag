import { getConfig } from "../../config/index.ts";

export async function githubFetch(path: string, params: Record<string, string | number | undefined> = {}) {
  const { baseUrl } = getConfig().github;
  const url = new URL(path, baseUrl);

  for (const [key, value] of Object.entries(params))
    if (value !== undefined) url.searchParams.set(key, String(value));

  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "my-profile-rag",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok)
    return JSON.stringify({ error: `GitHub responded ${response.status} ${response.statusText}`, path });

  return JSON.stringify(await response.json());
}
