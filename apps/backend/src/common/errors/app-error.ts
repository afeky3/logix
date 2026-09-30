/**
 * Stable, documented error codes — see backend/md/05-api-conventions.md §5.
 * Clients map these to X07/X08 system states; never rely on `message` text.
 */
export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'TOKEN_EXPIRED'
  | 'FORBIDDEN'
  | 'WORKSPACE_NOT_ACTIVE'
  | 'VERIFICATION_REQUIRED'
  | 'ACTIVITY_NOT_APPROVED'
  | 'NOT_FOUND'
  | 'INVALID_STATE_TRANSITION'
  | 'VERSION_CONFLICT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'QUOTE_EXPIRED'
  | 'STOCK_INSUFFICIENT'
  | 'MOQ_NOT_MET'
  | 'BUSINESS_RULE_VIOLATION'
  | 'RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UNKNOWN';

export interface AppErrorDetail {
  field: string;
  code: string;
}

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  TOKEN_EXPIRED: 401,
  FORBIDDEN: 403,
  WORKSPACE_NOT_ACTIVE: 403,
  VERIFICATION_REQUIRED: 403,
  ACTIVITY_NOT_APPROVED: 403,
  NOT_FOUND: 404,
  INVALID_STATE_TRANSITION: 409,
  VERSION_CONFLICT: 409,
  IDEMPOTENCY_CONFLICT: 409,
  QUOTE_EXPIRED: 409,
  STOCK_INSUFFICIENT: 409,
  MOQ_NOT_MET: 409,
  BUSINESS_RULE_VIOLATION: 422,
  RATE_LIMITED: 429,
  UPSTREAM_UNAVAILABLE: 503,
  UNKNOWN: 500,
};

/** Thrown anywhere in application code; the global filter maps it to the API envelope. */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly httpStatus: number;
  readonly details?: AppErrorDetail[];
  readonly retryable: boolean;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: { details?: AppErrorDetail[]; retryable?: boolean },
  ) {
    super(message);
    this.code = code;
    this.httpStatus = STATUS_BY_CODE[code];
    this.details = options?.details;
    this.retryable = options?.retryable ?? code === 'UPSTREAM_UNAVAILABLE';
  }
}
