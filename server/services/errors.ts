export class ServiceError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ServiceError";
    this.status = status;
  }
}

export function isForeignKeyError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.includes("FOREIGN KEY constraint failed") || message.includes("foreign key");
}