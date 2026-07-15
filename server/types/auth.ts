/**
 * JWT payload shape used by Hono jwt middleware and route handlers.
 */
export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  exp: number;
  jti?: string;
}

/** Hono Variables binding for authenticated routes. */
export type AppVariables = {
  jwtPayload: JwtPayload;
};
