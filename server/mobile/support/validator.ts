import type { MiddlewareHandler } from "hono";
import type { ZodType } from "zod";

export function zValidator(
  target: "json" | "query" | "param",
  schema: ZodType<any>
): MiddlewareHandler {
  return async (c, next) => {
    let data: unknown;
    if (target === "json") {
      data = await c.req.json().catch(() => ({}));
    } else if (target === "query") {
      data = c.req.query();
    } else if (target === "param") {
      data = c.req.param();
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      return c.json(
        {
          message: "The given data was invalid.",
          errors: result.error.flatten().fieldErrors,
        },
        400
      );
    }
    c.req.addValidatedData(target as any, result.data);
    await next();
  };
}
