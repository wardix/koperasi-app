import type { Hono } from "hono";
import type { Context } from "hono";
import { LEGACY_AUTH_ALIASES } from "./authPaths";

function withDeprecation(res: Response, successor: string): Response {
  const headers = new Headers(res.headers);
  headers.set("Deprecation", "true");
  headers.set("Link", `<${successor}>; rel="successor-version"`);
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
}

function createLegacyHandler(fetchApp: (req: Request) => Response | Promise<Response>, canonical: string) {
  return async (c: Context) => {
    const url = new URL(c.req.url);
    url.pathname = canonical;
    const res = await fetchApp(new Request(url, c.req.raw));
    return withDeprecation(res, canonical);
  };
}

/**
 * Register deprecated aliases for pre-#208 auth paths.
 * Must be called after canonical auth routes are mounted.
 */
export function registerLegacyAuthAliases(app: Hono): void {
  const fetchApp = app.fetch.bind(app);

  for (const alias of LEGACY_AUTH_ALIASES) {
    const handler = createLegacyHandler(fetchApp, alias.canonical);
    switch (alias.method) {
      case "GET":
        app.get(alias.legacy, handler);
        break;
      case "POST":
        app.post(alias.legacy, handler);
        break;
      case "PUT":
        app.put(alias.legacy, handler);
        break;
      case "DELETE":
        app.delete(alias.legacy, handler);
        break;
    }
  }
}