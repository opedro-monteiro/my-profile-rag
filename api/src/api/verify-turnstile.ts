const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export type HumanVerifier = (
  token: string | undefined,
  remoteIp: string,
) => Promise<boolean>;

export interface TurnstileOptions {
  secret: string;
  hostnames: string[];
  action: string;
  fetch?: typeof fetch;
}

interface SiteverifyResult {
  success?: boolean;
  action?: string;
  hostname?: string;
}

export function createTurnstileVerifier({
  secret,
  hostnames,
  action,
  fetch: fetchImpl = fetch,
}: TurnstileOptions): HumanVerifier {
  const expectedHostnames = new Set(hostnames);

  return async (token, remoteIp) => {
    if (
      typeof token !== "string" ||
      token.length === 0 ||
      token.length > 2048 ||
      expectedHostnames.size === 0
    )
      return false;

    try {
      const response = await fetchImpl(SITEVERIFY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(10_000),
        body: new URLSearchParams({ secret, response: token, remoteip: remoteIp }),
      });
      if (!response.ok) return false;

      const result = (await response.json()) as SiteverifyResult;

      return (
        result.success === true &&
        result.action === action &&
        typeof result.hostname === "string" &&
        expectedHostnames.has(result.hostname)
      );
    } catch {
      return false;
    }
  };
}
