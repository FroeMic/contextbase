import { Schema } from "effect"
import { describe, expect, test } from "vitest"

import { ListEnvelopeSchema, SuccessEnvelopeSchema } from "./envelopes.js"

describe("API envelope contracts", () => {
  test("decodes success and list envelopes with next_cursor", () => {
    const success = Schema.decodeUnknownSync(
      SuccessEnvelopeSchema(Schema.Struct({ id: Schema.String })),
    )({
      data: { id: "tsk_123" },
      ok: true,
    })
    const list = Schema.decodeUnknownSync(ListEnvelopeSchema(Schema.Struct({ id: Schema.String })))(
      {
        data: [{ id: "tsk_123" }],
        ok: true,
        page: { next_cursor: null },
      },
    )

    expect(success.data.id).toBe("tsk_123")
    expect(list.page.next_cursor).toBeNull()
  })
})
