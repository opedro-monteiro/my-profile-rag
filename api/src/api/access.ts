import { createHash, timingSafeEqual } from "node:crypto";

export type AccessCheck = (authorization: string | undefined) => boolean;

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

/**
 * Checks `Authorization: Bearer <token>` against the configured tokens.
 * With no tokens configured, nobody is granted access.
 */
export function createAccessCheck(tokens: readonly string[]): AccessCheck {
  const digests = tokens.map(digest);

  return (authorization) => {
    const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
    if (!match) return false;

    const candidate = digest(match[1]);
    let granted = false;
    for (const known of digests)
      granted = timingSafeEqual(known, candidate) || granted;
    return granted;
  };
}
