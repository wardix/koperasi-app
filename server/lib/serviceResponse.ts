import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { ServiceError } from "../services/errors";

export function mapServiceError(c: Context, err: unknown): Response | null {
  if (err instanceof ServiceError) {
    return c.json({ success: false, message: err.message }, err.status as ContentfulStatusCode);
  }
  return null;
}