import { createHmac, timingSafeEqual } from "node:crypto"

export type FileDownloadTokenPayload = {
  exp: number
  fileId: string
  principalId: string
  principalKind: string
  workspaceId: string
  workspaceSlug: string
}

export function createFileDownloadToken(payload: FileDownloadTokenPayload, secret: string) {
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  return `${encodedPayload}.${sign(encodedPayload, secret)}`
}

export function verifyFileDownloadToken(token: string, secret: string, now = new Date()) {
  const [encodedPayload, signature] = token.split(".")
  if (!encodedPayload || !signature) return null
  if (!constantTimeEqual(signature, sign(encodedPayload, secret))) return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as FileDownloadTokenPayload
    if (!isPayload(payload) || payload.exp <= Math.floor(now.getTime() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
}

function isPayload(value: unknown): value is FileDownloadTokenPayload {
  if (typeof value !== "object" || value === null) return false
  const payload = value as Record<string, unknown>
  return (
    typeof payload.exp === "number" &&
    typeof payload.fileId === "string" &&
    typeof payload.principalId === "string" &&
    typeof payload.principalKind === "string" &&
    typeof payload.workspaceId === "string" &&
    typeof payload.workspaceSlug === "string"
  )
}
