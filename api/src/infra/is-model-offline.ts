export function isModelOffline(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "fetch failed")
    return true;

  const status = (error as { status_code?: unknown } | null)?.status_code;
  return typeof status === "number" && [502, 503, 504, 530].includes(status);
}
