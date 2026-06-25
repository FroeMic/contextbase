import { mapAppErrorToHttp } from "@contextbase/core/shared/errors"
import { TRPCError } from "@trpc/server"

type TrpcErrorCode = ConstructorParameters<typeof TRPCError>[0]["code"]

const trpcCodeByHttpStatus = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  422: "BAD_REQUEST",
  500: "INTERNAL_SERVER_ERROR",
} satisfies Record<number, TrpcErrorCode>

export function toTrpcError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error

  if (typeof error === "object" && error !== null && "_tag" in error) {
    const mapped = mapAppErrorToHttp(error as Parameters<typeof mapAppErrorToHttp>[0])
    return new TRPCError({
      cause: error,
      code: trpcCodeByHttpStatus[mapped.status] ?? "INTERNAL_SERVER_ERROR",
      message: mapped.body.error.message,
    })
  }

  return new TRPCError({
    cause: error,
    code: "INTERNAL_SERVER_ERROR",
    message: "Unexpected server error.",
  })
}

export async function runTrpcEffect<TData>(action: () => Promise<TData>): Promise<TData> {
  try {
    return await action()
  } catch (error) {
    throw toTrpcError(error)
  }
}
