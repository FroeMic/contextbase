import { Data } from "effect"

import { type ErrorEnvelope, errorEnvelope } from "./response"

export type ErrorCode =
  | "invalid_request"
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invariant_violation"
  | "internal_error"

type ErrorFields = {
  code: ErrorCode
  details?: Record<string, unknown>
  message: string
}

export class InvalidRequestError extends Data.TaggedError("InvalidRequestError")<ErrorFields> {}

export class AuthenticationError extends Data.TaggedError("AuthenticationError")<ErrorFields> {}

export class ForbiddenError extends Data.TaggedError("ForbiddenError")<ErrorFields> {}

export class NotFoundError extends Data.TaggedError("NotFoundError")<ErrorFields> {}

export class ConflictError extends Data.TaggedError("ConflictError")<ErrorFields> {}

export class InvariantViolationError extends Data.TaggedError(
  "InvariantViolationError",
)<ErrorFields> {}

export class InternalError extends Data.TaggedError("InternalError")<ErrorFields> {}

export type AppError =
  | InvalidRequestError
  | AuthenticationError
  | ForbiddenError
  | NotFoundError
  | ConflictError
  | InvariantViolationError
  | InternalError
  | {
      _tag: "AuthenticationError"
      code: "unauthenticated"
      details?: Record<string, unknown>
      message: string
    }

export type HttpErrorMapping = {
  body: ErrorEnvelope
  status: 400 | 401 | 403 | 404 | 409 | 422 | 500
}

export function mapAppErrorToHttp(error: AppError): HttpErrorMapping {
  const statusByTag = {
    AuthenticationError: 401,
    ConflictError: 409,
    ForbiddenError: 403,
    InternalError: 500,
    InvalidRequestError: 400,
    InvariantViolationError: 422,
    NotFoundError: 404,
  } as const

  const status = statusByTag[error._tag] ?? 500

  return {
    status,
    body: errorEnvelope(error.code, error.message, error.details ?? {}),
  }
}
