import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import { formatEmployee } from "../support/resources.js";

const profileRouter = new Hono();

// GET /api/profile (Read-only)
profileRouter.get("/", authMiddleware, async (c) => {
  const employee = c.get("employee");
  return c.json({ data: formatEmployee(employee) });
});

export default profileRouter;
