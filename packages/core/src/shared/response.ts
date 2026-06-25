export type SuccessEnvelope<TData> = {
  ok: true
  data: TData
}

export type ListEnvelope<TData> = {
  ok: true
  data: TData[]
  page: {
    next_cursor: string | null
  }
}

export type ErrorEnvelope<TDetails extends Record<string, unknown> = Record<string, unknown>> = {
  ok: false
  error: {
    code: string
    message: string
    details: TDetails
  }
}

export function successEnvelope<TData>(data: TData): SuccessEnvelope<TData> {
  return {
    ok: true,
    data,
  }
}

export function listEnvelope<TData>(
  data: TData[],
  page: { nextCursor?: string | null } = {},
): ListEnvelope<TData> {
  return {
    ok: true,
    data,
    page: {
      next_cursor: page.nextCursor ?? null,
    },
  }
}

export function errorEnvelope<TDetails extends Record<string, unknown> = Record<string, unknown>>(
  code: string,
  message: string,
  details = {} as TDetails,
): ErrorEnvelope<TDetails> {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  }
}
