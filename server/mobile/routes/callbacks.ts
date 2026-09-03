import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "../support/validator.js";
import { sql } from "../db/index.js";
import { verifyLoanCallbackSignature } from "../middleware/loan-signature.js";

const callbackRouter = new Hono();

const statusCallbackSchema = z.object({
  reference: z.string().min(1),
  status: z.enum(["approved", "disbursed", "rejected", "cancelled"]),
  event: z.string().optional(),
  decided_by_name: z.string().optional(),
  rejection_reason: z.string().optional(),
  disbursed_at: z.string().optional(),
  decided_at: z.string().optional(),
});

callbackRouter.post(
  "/loans/status",
  verifyLoanCallbackSignature,
  zValidator("json", statusCallbackSchema),
  async (c) => {
    const payload = c.req.valid("json");

    const rows = await sql`
      SELECT * FROM loan_applications
      WHERE reference = ${payload.reference}
      LIMIT 1
    `;

    if (rows.length === 0) {
      console.warn("Koperasi loan callback references unknown application:", payload.reference);
      return c.json(
        {
          message: "Unknown loan reference.",
          error_code: "loan_not_found",
        },
        404
      );
    }

    const application = rows[0];
    const currentStatus = application.status;
    const targetStatus = payload.status;

    // Transition rules
    const allowedTransitions: Record<string, string[]> = {
      pending_approval: ["approved", "rejected", "cancelled"],
      approved: ["disbursed", "rejected", "cancelled"],
      disbursed: [],
      rejected: [],
      cancelled: [],
    };

    const isAllowed = allowedTransitions[currentStatus]?.includes(targetStatus);

    if (!isAllowed) {
      // Duplicate, out-of-order, or invalid transition: return 200 with applied: false
      return c.json({
        received: true,
        applied: false,
        status: currentStatus,
      });
    }

    // Apply status update
    const decidedAt = payload.decided_at ? new Date(payload.decided_at) : new Date();
    const disbursedAt = targetStatus === "disbursed"
      ? payload.disbursed_at ? new Date(payload.disbursed_at) : new Date()
      : application.disbursed_at;

    await sql`
      UPDATE loan_applications
      SET status = ${targetStatus},
          decided_at = ${decidedAt},
          decided_by_name = ${payload.decided_by_name || application.decided_by_name || null},
          rejection_reason = ${payload.rejection_reason || application.rejection_reason || null},
          disbursed_at = ${disbursedAt || null},
          updated_at = NOW()
      WHERE id = ${application.id}
    `;

    return c.json({
      received: true,
      applied: true,
      status: targetStatus,
    });
  }
);

export default callbackRouter;
