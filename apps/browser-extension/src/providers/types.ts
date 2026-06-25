import type {
  CapturedMessageRole,
  SessionCaptureManualSyncBody,
  SessionCaptureMessageInput,
  SessionCaptureProviderInput,
  SessionCaptureSessionInput,
  SessionCaptureSourceSnapshotInput,
} from "@contextbase/contracts"

export type ProviderMatch = {
  displayName: string
  providerKey: string
}

export type ExtractedMessage = SessionCaptureMessageInput & {
  role: CapturedMessageRole
}

export type ExtractedSession = {
  messages: ExtractedMessage[]
  parserVersion: string
  provider: SessionCaptureProviderInput
  session: SessionCaptureSessionInput
  sourceSnapshot?: SessionCaptureSourceSnapshotInput
}

export type ProviderAdapter = {
  detectProvider: (url: URL) => ProviderMatch | null
  extractSession: (document: Document, url: URL) => ExtractedSession
  parserVersion: string
  providerKey: string
  toManualSyncPayload: (session: ExtractedSession) => SessionCaptureManualSyncBody
}
