import type {
  CaptureClientPairBody,
  CaptureClientPairResponse,
  SessionCaptureManualSyncBody,
  SessionCaptureManualSyncResponse,
} from "@contextbase/contracts"

import type { ApiClient } from "../client"

export function createSessionCaptureClient(client: ApiClient) {
  return {
    pairClient: (payload: CaptureClientPairBody) =>
      client.post<CaptureClientPairResponse>("/api/v1/session-capture/clients", payload),
    syncManual: (payload: SessionCaptureManualSyncBody) =>
      client.post<SessionCaptureManualSyncResponse>("/api/v1/session-capture/sync/manual", payload),
  }
}
