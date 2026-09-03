import { createHmac, timingSafeEqual } from "node:crypto";
import type { Context, Next } from "hono";

export async function verifyLoanCallbackSignature(c: Context, next: Next) {
  const secret = process.env.LOAN_CALLBACK_SECRET || "";
  if (!secret) {
    console.error("A koperasi loan callback arrived but LOAN_CALLBACK_SECRET is not configured");
    return c.json(
      {
        message: "Callback verification is not configured.",
        error_code: "callback_not_configured",
      },
      503
    );
  }

  const header = c.req.header("X-Loan-Signature");
  if (!header) {
    return c.json({ message: "Invalid signature.", error_code: "invalid_signature" }, 401);
  }

  const parts = header.split(",").reduce((acc, segment) => {
    const [key, val] = segment.trim().split("=");
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
  }, {} as Record<string, string>);

  const timestampStr = parts["t"];
  const provided = parts["v1"];

  if (!timestampStr || !provided || !/^\d+$/.test(timestampStr)) {
    return c.json({ message: "Invalid signature.", error_code: "invalid_signature" }, 401);
  }

  const timestamp = parseInt(timestampStr, 10);
  const now = Math.floor(Date.now() / 1000);
  const tolerance = parseInt(process.env.LOAN_CALLBACK_TOLERANCE || "300", 10);

  if (Math.abs(now - timestamp) > tolerance) {
    return c.json({ message: "Invalid signature.", error_code: "invalid_signature" }, 401);
  }

  const rawBody = await c.req.text();
  const message = `${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", secret).update(message).digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const providedBuffer = Buffer.from(provided, "hex");

  if (
    expectedBuffer.length !== providedBuffer.length ||
    !timingSafeEqual(expectedBuffer, providedBuffer)
  ) {
    return c.json({ message: "Invalid signature.", error_code: "invalid_signature" }, 401);
  }

  // Pass rawBody on context so controller doesn't need to re-read
  c.set("rawBody", rawBody);
  await next();
}
