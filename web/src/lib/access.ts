import { readJson, writeJson } from "@/lib/storage"

const TOKEN_KEY = "profile-rag:access-token"
const TOKEN_PARAM = "token"

let token: string | null = null

/**
 * Reads `?token=` from the link Pedro shares, keeps it for later visits and
 * removes it from the address bar so it is not copied along with the URL.
 * A link with a new token replaces the saved one.
 */
export function captureAccessToken() {
  const url = new URL(window.location.href)
  const fromUrl = url.searchParams.get(TOKEN_PARAM)?.trim()

  if (fromUrl) {
    writeJson(TOKEN_KEY, fromUrl)
    url.searchParams.delete(TOKEN_PARAM)
    window.history.replaceState(window.history.state, "", url)
  }

  token = fromUrl || readJson<string | null>(TOKEN_KEY, null)
}

export function accessHeaders(): Record<string, string> {
  return token ? { authorization: `Bearer ${token}` } : {}
}
