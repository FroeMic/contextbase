import type { ApiClient } from "../client"

export function createFileClient(client: ApiClient) {
  return {
    download: (fileId: string) => client.getRaw(`/api/v1/files/${fileId}/content`),
    downloadFile: (fileId: string) => client.getRaw(`/api/v1/files/${fileId}/content`),
  }
}
