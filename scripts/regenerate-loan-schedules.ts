/**
 * Manually regenerate all approved/outstanding loan installment schedules
 * using annuity (declining-balance) principal/interest split.
 *
 * Usage:
 *   bun run scripts/regenerate-loan-schedules.ts
 *   bun run scripts/regenerate-loan-schedules.ts --loan <loanId>
 *
 * Safe to re-run: deletes schedule rows, recreates them, re-applies payments.
 */
import db from "../server/db";
import {
  regenerateAllLoanInstallmentSchedules,
  regenerateLoanInstallmentSchedule,
} from "../server/services/loanService";

const args = process.argv.slice(2);
const loanFlag = args.indexOf("--loan");
const loanId = loanFlag >= 0 ? args[loanFlag + 1] : undefined;

async function main() {
  if (loanId) {
    const result = await regenerateLoanInstallmentSchedule(db, loanId);
    console.log(
      `Regenerated schedule for loan ${loanId}: ${result.rows} installments, monthlyPayment=${result.monthlyPayment}`
    );
  } else {
    const result = await regenerateAllLoanInstallmentSchedules(db);
    console.log(`Regenerated schedules for ${result.processed} loan(s)`);
    if (result.loanIds.length > 0 && result.loanIds.length <= 20) {
      console.log(`IDs: ${result.loanIds.join(", ")}`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
