export class DomainException extends Error {
  constructor(
    message: string,
    public readonly errorCode: string,
    public readonly statusCode: number = 422,
    public readonly context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class WithdrawalException extends DomainException {
  static employeeFrozen(): WithdrawalException {
    return new WithdrawalException(
      "Your account is currently on hold. Please contact your HR team.",
      "employee_frozen",
      403
    );
  }

  static employeeInactive(): WithdrawalException {
    return new WithdrawalException(
      "Your account is no longer active.",
      "employee_inactive",
      403
    );
  }

  static employerSuspended(): WithdrawalException {
    return new WithdrawalException(
      "Salary advances are temporarily unavailable at your company.",
      "employer_suspended",
      403
    );
  }

  static exceedsAvailable(requested: number, available: number): WithdrawalException {
    return new WithdrawalException(
      "That is more than you have available right now.",
      "exceeds_available",
      422,
      { requested, available }
    );
  }

  static belowMinimum(requested: number, minimum: number): WithdrawalException {
    return new WithdrawalException(
      `The smallest amount you can request is Rp ${minimum.toLocaleString("id-ID")}.`,
      "below_minimum",
      422,
      { requested, minimum }
    );
  }

  static tooManyOpenRequests(limit: number): WithdrawalException {
    return new WithdrawalException(
      `You already have ${limit} requests waiting to be processed.`,
      "too_many_open_requests",
      422,
      { limit }
    );
  }

  static missingBankDetails(): WithdrawalException {
    return new WithdrawalException(
      "Your bank account details are missing. Ask your HR team to add them.",
      "missing_bank_details",
      422
    );
  }

  static feeUnavailable(requested: number): WithdrawalException {
    return new WithdrawalException(
      "We could not work out the fee for that amount. Please contact your HR team.",
      "fee_unavailable",
      422,
      { requested }
    );
  }

  static invalidTransition(from: string, to: string): WithdrawalException {
    return new WithdrawalException(
      `A request that is already '${from}' cannot become '${to}'.`,
      "invalid_status_transition",
      422,
      { from, to }
    );
  }

  static notFlaggable(status: string): WithdrawalException {
    return new WithdrawalException(
      `Only transferred requests can be flagged; this one is '${status}'.`,
      "not_flaggable",
      422
    );
  }
}

export class LoanException extends DomainException {
  static notAMember(): LoanException {
    return new LoanException(
      "You are not registered as a koperasi member yet. Please join the koperasi first.",
      "not_a_member",
      422
    );
  }

  static membershipInactive(status: string): LoanException {
    return new LoanException(
      "Your koperasi membership is not active. Please contact the koperasi.",
      "membership_inactive",
      422,
      { membership_status: status }
    );
  }

  static termsUnavailable(): LoanException {
    return new LoanException(
      "We could not work out the instalments for that loan. Please contact the koperasi.",
      "loan_terms_unavailable",
      422
    );
  }

  static rejectedBySubmission(reason: string): LoanException {
    return new LoanException(reason, "loan_submission_refused", 422);
  }
}

export class SsoException extends DomainException {
  constructor(
    message: string,
    errorCode: string = "sso_error",
    statusCode: number = 401,
    context: Record<string, unknown> = {}
  ) {
    super(message, errorCode, statusCode, context);
  }
}

export class FeeScheduleException extends DomainException {
  static empty(): FeeScheduleException {
    return new FeeScheduleException("A fee table must have at least one band.", "fee_table_empty", 500);
  }

  static negativeFee(fee: number): FeeScheduleException {
    return new FeeScheduleException(`Fee cannot be negative (${fee}).`, "negative_fee", 500);
  }

  static unboundedBandNotLast(position: number): FeeScheduleException {
    return new FeeScheduleException(`Only the final band may be open-ended; band ${position} has no upper bound.`, "unbounded_band_not_last", 500);
  }

  static bandNotAscending(min: number, max: number): FeeScheduleException {
    return new FeeScheduleException(`Band upper bound (${max}) must be greater than or equal to lower bound (${min}).`, "band_not_ascending", 500);
  }

  static noTierFor(amount: number): FeeScheduleException {
    return new FeeScheduleException(`Amount ${amount} exceeds the highest band in the fee schedule.`, "amount_uncovered", 422);
  }
}

export class InvalidPayPeriodException extends DomainException {
  static cutoffDayOutOfRange(day: number): InvalidPayPeriodException {
    return new InvalidPayPeriodException(`Cutoff day must be between 1 and 28 (got ${day}).`, "cutoff_day_out_of_range", 400);
  }
}
