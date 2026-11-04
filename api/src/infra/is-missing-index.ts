export function isMissingIndex(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const code = (error as { code?: unknown }).code;
  return (
    code !== "Neo.ClientError.Database.DatabaseNotFound" &&
    error.message.includes("does not exist")
  );
}
