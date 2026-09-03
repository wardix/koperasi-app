import type { Context } from "hono";
import { DomainException } from "../domain/exceptions.js";

export function errorHandler(err: Error, c: Context) {
  if (err instanceof DomainException) {
    return c.json(
      {
        message: err.message,
        error_code: err.errorCode,
        context: Object.keys(err.context).length > 0 ? err.context : undefined,
      },
      err.statusCode as any
    );
  }

  console.error("Unhandled error:", err);
  return c.json(
    {
      message: "Server error.",
      error_code: "internal_server_error",
    },
    500
  );
}
