export async function readErrorMessage(response: Response) {
  const body: unknown = await response.json().catch(() => null)
  const message = (body as { message?: unknown } | null)?.message

  return typeof message === "string"
    ? message
    : `Request failed with status ${response.status}`
}
