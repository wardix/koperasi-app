import { Hono } from "hono";
import { join } from "node:path";

const OPENAPI_PATH = join(process.cwd(), "openapi.yaml");

const docs = new Hono();

docs.get("/openapi.yaml", async (c) => {
  const file = Bun.file(OPENAPI_PATH);
  if (!(await file.exists())) {
    return c.json({ success: false, message: "OpenAPI spec not found" }, 404);
  }
  return c.body(await file.text(), 200, { "Content-Type": "application/yaml; charset=utf-8" });
});

docs.get("/doc", (c) => {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Koperasi API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/openapi.yaml',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis],
      layout: 'BaseLayout',
    });
  </script>
</body>
</html>`;
  return c.html(html);
});

export default docs;