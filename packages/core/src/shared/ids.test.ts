import { describe, expect, test } from "vitest"

import { createId } from "./ids"

describe("createId", () => {
  test("creates prefixed opaque ids", () => {
    expect(createId("wrk")).toMatch(/^wrk_[a-z0-9]{24}$/)
    expect(createId("biz")).toMatch(/^biz_[a-z0-9]{24}$/)
    expect(createId("file")).toMatch(/^file_[a-z0-9]{24}$/)
    expect(createId("att")).toMatch(/^att_[a-z0-9]{24}$/)
    expect(createId("ref")).toMatch(/^ref_[a-z0-9]{24}$/)
    expect(createId("goal")).toMatch(/^goal_[a-z0-9]{24}$/)
    expect(createId("ver")).toMatch(/^ver_[a-z0-9]{24}$/)
    expect(createId("ffr")).toMatch(/^ffr_[a-z0-9]{24}$/)
    expect(createId("avt")).toMatch(/^avt_[a-z0-9]{24}$/)
    expect(createId("cnt")).toMatch(/^cnt_[a-z0-9]{24}$/)
    expect(createId("cia")).toMatch(/^cia_[a-z0-9]{24}$/)
  })
})
