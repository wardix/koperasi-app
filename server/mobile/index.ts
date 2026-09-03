import { Hono } from "hono";
import { errorHandler } from "./middleware/error-handler.js";

import authRouter from "./routes/auth.js";
import walletRouter from "./routes/wallet.js";
import withdrawalRouter from "./routes/withdrawals.js";
import profileRouter from "./routes/profile.js";
import fcmRouter from "./routes/fcm-tokens.js";
import loanRouter from "./routes/loans.js";
import callbackRouter from "./routes/callbacks.js";

const mobileApp = new Hono();

// Custom Domain Error Handling for Flutter (returns standard message and error_code)
mobileApp.onError(errorHandler);

// Mount all mobile routes
mobileApp.route("/auth", authRouter);
mobileApp.route("/wallet", walletRouter);
mobileApp.route("/withdrawals", withdrawalRouter);
mobileApp.route("/profile", profileRouter);
mobileApp.route("/fcm-tokens", fcmRouter);
mobileApp.route("/loans", loanRouter);
mobileApp.route("/callbacks", callbackRouter);

export default mobileApp;
