/**
 * CI guard: ensure openapi.yaml documents every route in OPENAPI_ROUTE_MANIFEST.
 *
 * Usage: bun run scripts/openapi-check.ts
 */
import { OPENAPI_ROUTE_MANIFEST } from "../server/openapi/routeManifest";

const SPEC_PATH = new URL("../openapi.yaml", import.meta.url);

type OpenApiSpec = {
  paths?: Record<string, Partial<Record<string, unknown>>>;
  components?: {
    schemas?: Record<string, unknown>;
  };
};

function normalizeMethod(method: string): string {
  return method.toLowerCase();
}

async function loadSpec(): Promise<OpenApiSpec> {
  const file = Bun.file(SPEC_PATH);
  if (!(await file.exists())) {
    throw new Error(`Missing OpenAPI spec at ${SPEC_PATH.pathname}`);
  }
  return Bun.YAML.parse(await file.text()) as OpenApiSpec;
}

function collectMissingRoutes(spec: OpenApiSpec): string[] {
  const paths = spec.paths ?? {};
  const missing: string[] = [];

  for (const entry of OPENAPI_ROUTE_MANIFEST) {
    const pathItem = paths[entry.path];
    const method = normalizeMethod(entry.method);
    if (!pathItem || !(method in pathItem)) {
      missing.push(`${entry.method} ${entry.path}`);
    }
  }

  return missing;
}

function collectEnvelopeIssues(spec: OpenApiSpec): string[] {
  const schemas = spec.components?.schemas ?? {};
  const required = ["ApiSuccessEnvelope", "ApiDataEnvelope", "ApiMessageEnvelope", "ApiErrorEnvelope"];
  return required.filter((name) => !(name in schemas));
}

export async function checkOpenApiSpec(): Promise<{ ok: boolean; errors: string[] }> {
  const spec = await loadSpec();
  const errors: string[] = [];

  errors.push(...collectMissingRoutes(spec).map((route) => `Missing documented route: ${route}`));
  errors.push(...collectEnvelopeIssues(spec).map((schema) => `Missing response schema: ${schema}`));

  return { ok: errors.length === 0, errors };
}

if (import.meta.main) {
  const result = await checkOpenApiSpec();
  if (!result.ok) {
    console.error("OpenAPI spec check failed:\n");
    for (const error of result.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }
  console.log(`OpenAPI spec OK (${OPENAPI_ROUTE_MANIFEST.length} routes, envelope schemas present)`);
}